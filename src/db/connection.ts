import mysql from "mysql2/promise";
import { dbConfig } from "../config/config";
import { QueryLogger } from "./queryLogger";
import { QueryCache } from "../cache/queryCache";

interface TransactionInfo {
  connection: mysql.PoolConnection;
  createdAt: Date;
  lastActivity: Date;
  lastQueryTime?: Date;
  timeout?: NodeJS.Timeout;
  queryCount: number;
  rapidQueryCount?: number;
}

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
      const [results] = await this.pool.query(sql, params);
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

  // Transaction Management Methods
  public async beginTransaction(transactionId: string): Promise<void> {
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
      });
    } catch (error) {
      throw new Error(`Failed to begin transaction: ${error}`);
    }
  }

  public async commitTransaction(transactionId: string): Promise<void> {
    const transaction = this.activeTransactions.get(transactionId);
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
    const transaction = this.activeTransactions.get(transactionId);
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
    return Array.from(this.activeTransactions.keys());
  }

  public hasActiveTransaction(transactionId: string): boolean {
    return this.activeTransactions.has(transactionId);
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
    const transaction = this.activeTransactions.get(transactionId);
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
    const transaction = this.activeTransactions.get(transactionId);
    if (!transaction) {
      throw new Error(`No active transaction found with ID: ${transactionId}`);
    }

    // Update query tracking before execution
    const now = new Date();
    transaction.lastQueryTime = now;
    transaction.queryCount++;

    const startTime = Date.now();
    try {
      const [results] = await transaction.connection.query(sql, params);
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
      throw new Error(`Query execution in transaction failed: ${error}`);
    }
  }
}

export default DatabaseConnection;
