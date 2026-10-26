import mysql from "mysql2/promise";
import { dbConfig } from "../config/config";
import { QueryLogger } from "./queryLogger";
import { QueryCache } from "../cache/queryCache";
import { getRuntimeConfig } from "../config/runtimeConfig";
import { getRequestContext } from "../server/requestContext";

interface TransactionInfo {
  connection: mysql.PoolConnection;
  createdAt: Date;
  lastActivity: Date;
  lastQueryTime?: Date;
  timeout?: NodeJS.Timeout;
  queryCount: number;
  rapidQueryCount?: number;
  /** MCP session that began the transaction; undefined over stdio */
  ownerSessionId?: string;
}

class QueryTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Query exceeded the ${timeoutMs} ms timeout and was cancelled`);
  }
}

const currentSessionId = (): string | undefined => getRequestContext()?.sessionId;

class DatabaseConnection {
  private static instance: DatabaseConnection;
  private pool: mysql.Pool;
  private activeTransactions: Map<string, TransactionInfo>;
  private queryCache: QueryCache;
  private readonly TRANSACTION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes default timeout
  private readonly TRANSACTION_MONITOR_INTERVAL_MS = 60 * 1000; // 1 minute monitoring interval
  private readonly MAX_TRANSACTION_DURATION_MS = 60 * 60 * 1000; // 1 hour maximum duration
  private transactionMonitorInterval?: NodeJS.Timeout;

  private constructor() {
    this.pool = mysql.createPool({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      // No default schema unless one was configured
      database: dbConfig.database || undefined,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });
    this.activeTransactions = new Map();
    this.queryCache = QueryCache.getInstance();
    
    // Start transaction monitoring
    this.startTransactionMonitor();
    
    // Set up periodic cleanup of expired transactions
    setInterval(
      () => {
        this.cleanupExpiredTransactions();
      },
      5 * 60 * 1000,
    ); // Check every 5 minutes
  }

  public static getInstance(): DatabaseConnection {
    if (!DatabaseConnection.instance) {
      DatabaseConnection.instance = new DatabaseConnection();
    }
    return DatabaseConnection.instance;
  }

  public async getConnection(): Promise<mysql.PoolConnection> {
    try {
      return await this.pool.getConnection();
    } catch (error) {
      throw new Error(`Failed to get database connection: ${error}`);
    }
  }

  public async query<T>(
    sql: string,
    params?: any[],
    useCache: boolean = true,
  ): Promise<T> {
    const normalizedSql = sql.trim().toUpperCase();
    const isSelectQuery = normalizedSql.startsWith("SELECT");

    // Check cache for SELECT queries
    if (useCache && isSelectQuery) {
      const cachedEntry = this.queryCache.get(sql, params);
      if (cachedEntry) {
        // Log cache hit
        QueryLogger.log(sql, params, 0, "success", undefined, true);
        return cachedEntry.data as T;
      }
    }

    const startTime = Date.now();
    try {
      const results = await this.runPooledQuery(sql, params);
      const duration = Date.now() - startTime;
      QueryLogger.log(sql, params, duration, "success");

      // Cache SELECT query results
      if (useCache && isSelectQuery) {
        this.queryCache.set(sql, params, results);
      }

      // Invalidate cache for write operations
      this.invalidateCacheForWriteOperation(sql);

      return results as T;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      QueryLogger.log(sql, params, duration, "error", error.message);
      throw new Error(`Query execution failed: ${error}`);
    }
  }

  /**
   * Run a statement on the pool. With MCP_QUERY_TIMEOUT_MS set, the statement
   * runs on a dedicated pool connection so it can be cancelled server-side.
   */
  private async runPooledQuery(sql: string, params?: any[]): Promise<any> {
    const timeoutMs = getRuntimeConfig().queryTimeoutMs;
    if (timeoutMs <= 0) {
      const [results] = await this.pool.query(sql, params);
      return results;
    }

    const connection = await this.getConnection();
    let timedOut = false;
    try {
      const outcome = await this.queryWithTimeout(connection, sql, params, timeoutMs);
      timedOut = outcome.timedOut;
      return outcome.results;
    } catch (error) {
      timedOut = error instanceof QueryTimeoutError;
      throw error;
    } finally {
      // A KILL QUERY that arrives after the statement finished could interrupt
      // the next statement on this connection, so never reuse it.
      if (timedOut) {
        connection.destroy();
      } else {
        connection.release();
      }
    }
  }

  /**
   * Run a statement and cancel it with KILL QUERY once timeoutMs elapses.
   * `timedOut` is true when the cancellation fired, even if the statement won the race.
   */
  private async queryWithTimeout(
    connection: mysql.PoolConnection,
    sql: string,
    params: any[] | undefined,
    timeoutMs: number,
  ): Promise<{ results: any; timedOut: boolean }> {
    let timedOut = false;
    let killing: Promise<void> | undefined;
    const timer = setTimeout(() => {
      timedOut = true;
      killing = this.killQuery(connection.threadId);
    }, timeoutMs);

    try {
      const [results] = await connection.query(sql, params);
      return { results, timedOut };
    } catch (error) {
      if (timedOut) throw new QueryTimeoutError(timeoutMs);
      throw error;
    } finally {
      clearTimeout(timer);
      if (killing) await killing;
    }
  }

  /**
   * Cancel the statement running on a connection. Uses a separate short-lived
   * connection so it works even when the pool is exhausted.
   */
  private async killQuery(threadId: number | null): Promise<void> {
    if (!threadId) return;
    let killer: mysql.Connection | undefined;
    try {
      killer = await mysql.createConnection({
        host: dbConfig.host,
        port: dbConfig.port,
        user: dbConfig.user,
        password: dbConfig.password,
      });
      await killer.query(`KILL QUERY ${Number(threadId)}`);
    } catch (error: any) {
      console.error(`Failed to cancel timed-out query on thread ${threadId}: ${error.message}`);
    } finally {
      if (killer) {
        await killer.end().catch(() => killer?.destroy());
      }
    }
  }

  /**
   * Grants of the connected MySQL account (SHOW GRANTS FOR CURRENT_USER()).
   */
  public async getCurrentUserGrants(): Promise<string[]> {
    const [rows] = await this.pool.query("SHOW GRANTS FOR CURRENT_USER()");
    return (rows as Record<string, unknown>[]).map((row) => String(Object.values(row)[0]));
  }

  /**
   * Whether a statement cannot change data seen by cached SELECTs.
   * EXPLAIN/DESCRIBE ANALYZE executes the wrapped statement, so it is excluded.
   */
  public static isReadOnlyStatement(sql: string): boolean {
    return /^(?:SELECT|SHOW)\b|^(?:EXPLAIN|DESCRIBE|DESC)\b(?!\s+ANALYZE\b)/i.test(
      sql.trim(),
    );
  }

  /**
   * Clear the whole cache when a statement may have changed data. Writes can
   * touch tables that are hard to extract reliably (multi-table UPDATE/DELETE,
   * db-qualified names, DDL, procedures), so no table-level guessing is done.
   */
  private invalidateCacheForWriteOperation(sql: string): void {
    if (!DatabaseConnection.isReadOnlyStatement(sql)) {
      this.queryCache.clear();
    }
  }

  public async testConnection(): Promise<{
    connected: boolean;
    latency: number;
    error?: string;
    errorCode?: string;
  }> {
    const startTime = Date.now();
    try {
      const connection = await this.getConnection();
      connection.release();
      const endTime = Date.now();
      return { connected: true, latency: endTime - startTime };
    } catch (error: any) {
      // Return detailed error information for diagnostics
      return {
        connected: false,
        latency: -1,
        error: error?.message || "Unknown connection error",
        errorCode: error?.code || error?.errno || "UNKNOWN",
      };
    }
  }

  public async closePool(): Promise<void> {
    try {
      await this.pool.end();
    } catch (error) {
      throw new Error(`Failed to close connection pool: ${error}`);
    }
  }

  

  /**
   * Start transaction monitoring system
   */
  private startTransactionMonitor(): void {
    this.transactionMonitorInterval = setInterval(() => {
      this.monitorTransactions();
    }, this.TRANSACTION_MONITOR_INTERVAL_MS);
  }

  /**
   * Monitor all active transactions for timeout and security violations
   */
  private monitorTransactions(): void {
    const now = Date.now();
    const transactionsToCleanup: string[] = [];

    for (const [transactionId, transaction] of this.activeTransactions) {
      const age = now - transaction.createdAt.getTime();
      const inactivity = now - transaction.lastActivity.getTime();

      // Check for maximum duration violation
      if (age > this.MAX_TRANSACTION_DURATION_MS) {
        console.warn(`Transaction ${transactionId} exceeded maximum duration, forcing rollback`);
        transactionsToCleanup.push(transactionId);
        continue;
      }

      // Check for inactivity timeout (server-side verification)
      if (inactivity > this.TRANSACTION_TIMEOUT_MS) {
        console.warn(`Transaction ${transactionId} timed out due to inactivity, forcing rollback`);
        transactionsToCleanup.push(transactionId);
        continue;
      }

      // Check for suspicious activity patterns
      if (this.detectSuspiciousActivity(transaction)) {
        console.warn(`Transaction ${transactionId} shows suspicious activity patterns, forcing rollback`);
        transactionsToCleanup.push(transactionId);
        continue;
      }
    }

    // Clean up flagged transactions
    for (const transactionId of transactionsToCleanup) {
      this.forceRollbackTransaction(transactionId, "Security violation or timeout");
    }
  }

  /**
   * Detect suspicious transaction activity patterns
   */
  private detectSuspiciousActivity(transaction: TransactionInfo): boolean {
    const now = Date.now();
    const age = now - transaction.createdAt.getTime();
    
    // Very new transactions with excessive activity could indicate automated attacks
    if (age < 60000 && transaction.queryCount > 100) { // More than 100 queries in first minute
      return true;
    }
    
    // Transactions with extremely high query count could indicate resource exhaustion attacks
    if (transaction.queryCount > 10000) {
      return true;
    }
    
    // Check for rapid-fire queries (potential DoS)
    if (transaction.lastQueryTime && (now - transaction.lastQueryTime.getTime()) < 10) { // Less than 10ms between queries
      transaction.rapidQueryCount = (transaction.rapidQueryCount || 0) + 1;
      if (transaction.rapidQueryCount > 50) { // More than 50 rapid queries
        return true;
      }
    }
    
    return false;
  }

  /**
   * Enhanced cleanup of expired transactions with security checks
   */
  private cleanupExpiredTransactions(): void {
    const now = Date.now();
    const transactionsToCleanup: string[] = [];

    for (const [transactionId, transaction] of this.activeTransactions) {
      const age = now - transaction.createdAt.getTime();
      const inactivity = now - transaction.lastActivity.getTime();

      // Multiple cleanup criteria for security
      if (inactivity > this.TRANSACTION_TIMEOUT_MS || 
          age > this.MAX_TRANSACTION_DURATION_MS ||
          this.detectSuspiciousActivity(transaction)) {
        transactionsToCleanup.push(transactionId);
      }
    }

    for (const transactionId of transactionsToCleanup) {
      this.forceRollbackTransaction(transactionId, "Automatic cleanup");
    }
  }

  /**
   * Force rollback a transaction (used for timeout handling)
   */
  private forceRollbackTransaction(
    transactionId: string,
    reason: string,
  ): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    try {
      // Clear timeout if exists
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }

      // Attempt to rollback
      transaction.connection.rollback();
      transaction.connection.release();
    } catch (error) {
      console.error(
        `Failed to rollback expired transaction ${transactionId}:`,
        error,
      );
      try {
        // Force release connection even if rollback fails
        transaction.connection.release();
      } catch (releaseError) {
        console.error(
          `Failed to release connection for expired transaction ${transactionId}:`,
          releaseError,
        );
      }
    }

    this.activeTransactions.delete(transactionId);
    console.warn(`Transaction ${transactionId} force rolled back: ${reason}`);
  }

  /**
   * Reset transaction timeout (call this when there's activity)
   */
  private resetTransactionTimeout(transactionId: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;

    // Clear existing timeout
    if (transaction.timeout) {
      clearTimeout(transaction.timeout);
    }

    // Update last activity
    transaction.lastActivity = new Date();

    // Set new timeout
    transaction.timeout = setTimeout(() => {
      this.forceRollbackTransaction(transactionId, "Transaction timeout");
    }, this.TRANSACTION_TIMEOUT_MS);
  }

  /**
   * Transaction visible to the current caller. Transactions begun in another
   * MCP session are reported as missing so their ids are not confirmed.
   */
  private getOwnedTransaction(transactionId: string): TransactionInfo | undefined {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction || transaction.ownerSessionId !== currentSessionId()) {
      return undefined;
    }
    return transaction;
  }

  /**
   * Drop a transaction by destroying its connection; MySQL rolls it back.
   */
  private discardTransaction(transactionId: string, reason: string): void {
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) return;
    if (transaction.timeout) {
      clearTimeout(transaction.timeout);
    }
    this.activeTransactions.delete(transactionId);
    transaction.connection.destroy();
    console.warn(`Transaction ${transactionId} rolled back: ${reason}`);
  }

  /**
   * Roll back every transaction owned by an MCP session (session closed or expired).
   */
  public rollbackTransactionsForSession(sessionId: string): number {
    let count = 0;
    for (const [transactionId, transaction] of this.activeTransactions) {
      if (transaction.ownerSessionId === sessionId) {
        this.discardTransaction(transactionId, `session ${sessionId} closed`);
        count++;
      }
    }
    return count;
  }

  // Transaction Management Methods
  public async beginTransaction(transactionId: string): Promise<void> {
    if (this.activeTransactions.has(transactionId)) {
      // Replacing the entry would leak the open transaction's connection
      throw new Error(
        `Failed to begin transaction: transaction ID ${transactionId} is already in use`,
      );
    }
    try {
      const connection = await this.getConnection();
      await connection.beginTransaction();

      const now = new Date();
      const timeout = setTimeout(() => {
        this.forceRollbackTransaction(transactionId, "Transaction timeout");
      }, this.TRANSACTION_TIMEOUT_MS);

      this.activeTransactions.set(transactionId, {
        connection,
        createdAt: now,
        lastActivity: now,
        lastQueryTime: now,
        timeout,
        queryCount: 0,
        rapidQueryCount: 0,
        ownerSessionId: currentSessionId(),
      });
    } catch (error) {
      throw new Error(`Failed to begin transaction: ${error}`);
    }
  }

  public async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.getOwnedTransaction(transactionId);
    if (!transaction) {
      throw new Error(`No active transaction found with ID: ${transactionId}`);
    }

    try {
      // Clear timeout
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }

      await transaction.connection.commit();
      transaction.connection.release();
      this.activeTransactions.delete(transactionId);

      // Reads cached while the transaction was open predate its committed writes
      this.queryCache.clear();
    } catch (error) {
      // If commit fails, rollback and release connection
      try {
        await transaction.connection.rollback();
        transaction.connection.release();
      } catch (rollbackError) {
        console.error("Failed to rollback after commit error:", rollbackError);
      }
      this.activeTransactions.delete(transactionId);
      throw new Error(`Failed to commit transaction: ${error}`);
    }
  }

  public async rollbackTransaction(transactionId: string): Promise<void> {
    const transaction = this.getOwnedTransaction(transactionId);
    if (!transaction) {
      throw new Error(`No active transaction found with ID: ${transactionId}`);
    }

    try {
      // Clear timeout
      if (transaction.timeout) {
        clearTimeout(transaction.timeout);
      }

      await transaction.connection.rollback();
      transaction.connection.release();
      this.activeTransactions.delete(transactionId);
    } catch (error) {
      transaction.connection.release();
      this.activeTransactions.delete(transactionId);
      throw new Error(`Failed to rollback transaction: ${error}`);
    }
  }

  public getActiveTransactionIds(): string[] {
    const sessionId = currentSessionId();
    return Array.from(this.activeTransactions.entries())
      .filter(([, transaction]) => transaction.ownerSessionId === sessionId)
      .map(([transactionId]) => transactionId);
  }

  public hasActiveTransaction(transactionId: string): boolean {
    return this.getOwnedTransaction(transactionId) !== undefined;
  }

  /**
   * Get transaction information for debugging/monitoring
   */
  public getTransactionInfo(transactionId: string): {
    exists: boolean;
    createdAt?: Date;
    lastActivity?: Date;
    ageMs?: number;
  } {
    const transaction = this.getOwnedTransaction(transactionId);
    if (!transaction) {
      return { exists: false };
    }

    const now = new Date();
    return {
      exists: true,
      createdAt: transaction.createdAt,
      lastActivity: transaction.lastActivity,
      ageMs: now.getTime() - transaction.createdAt.getTime(),
    };
  }

  public getQueryLogs() {
    return QueryLogger.getLogs();
  }

  public getLastQueryLog() {
    return QueryLogger.getLastLog();
  }

  public getFormattedQueryLogs(count: number = 1) {
    return QueryLogger.formatLogs(QueryLogger.getLastLogs(count));
  }

  // Cache Management Methods
  public getCacheStats() {
    return this.queryCache.getStats();
  }

  public getCacheConfig() {
    return this.queryCache.getConfig();
  }

  public setCacheConfig(config: {
    enabled?: boolean;
    ttlMs?: number;
    maxSize?: number;
    maxMemoryMB?: number;
  }) {
    this.queryCache.setConfig(config);
  }

  public clearCache(): number {
    const previousSize = this.queryCache.getStats().currentSize;
    this.queryCache.clear();
    return previousSize;
  }

  public invalidateCache(pattern?: string | RegExp): number {
    return this.queryCache.invalidate(pattern);
  }

  public invalidateCacheForTable(tableName: string): number {
    return this.queryCache.invalidateTable(tableName);
  }

  public enableCache(): void {
    this.queryCache.enable();
  }

  public disableCache(): void {
    this.queryCache.disable();
  }

  public resetCacheStats(): void {
    this.queryCache.resetStats();
  }

  public async executeInTransaction<T>(
    transactionId: string,
    sql: string,
    params?: any[],
  ): Promise<T> {
    const transaction = this.getOwnedTransaction(transactionId);
    if (!transaction) {
      throw new Error(`No active transaction found with ID: ${transactionId}`);
    }

    // Update query tracking before execution
    const now = new Date();
    transaction.lastQueryTime = now;
    transaction.queryCount++;

    const timeoutMs = getRuntimeConfig().queryTimeoutMs;
    const startTime = Date.now();
    try {
      let results: any;
      if (timeoutMs > 0) {
        const outcome = await this.queryWithTimeout(transaction.connection, sql, params, timeoutMs);
        if (outcome.timedOut) {
          // The KILL may still reach this connection, so the transaction cannot continue
          throw new QueryTimeoutError(timeoutMs);
        }
        results = outcome.results;
      } else {
        [results] = await transaction.connection.query(sql, params);
      }
      const duration = Date.now() - startTime;
      QueryLogger.log(sql, params, duration, "success");

      // DDL commits implicitly, so its effects are visible before COMMIT
      this.invalidateCacheForWriteOperation(sql);

      // Reset timeout on successful activity and update last activity
      this.resetTransactionTimeout(transactionId);
      transaction.lastActivity = now;

      return results as T;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      QueryLogger.log(sql, params, duration, "error", error.message);
      if (error instanceof QueryTimeoutError) {
        this.discardTransaction(transactionId, "statement timed out");
        throw new Error(
          `Query execution in transaction failed: ${error.message}; transaction ${transactionId} was rolled back`,
        );
      }
      throw new Error(`Query execution in transaction failed: ${error}`);
    }
  }
}

export default DatabaseConnection;
