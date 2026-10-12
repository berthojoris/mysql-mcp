import DatabaseConnection from "../db/connection";
import { SecurityLayer } from "../security/securityLayer";

export interface TransactionResult {
  status: "success" | "error";
  transactionId?: string;
  message?: string;
  activeTransactions?: string[];
  error?: string;
}

export class TransactionTools {
  private db: DatabaseConnection;
  private security: SecurityLayer;

  constructor(security: SecurityLayer) {
    this.db = DatabaseConnection.getInstance();
    this.security = security;
  }

  /**
   * Begin a new transaction
   */
  async beginTransaction(params?: {
    transactionId?: string;
  }): Promise<TransactionResult> {
    try {
      const transactionId =
        params?.transactionId ||
        `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      await this.db.beginTransaction(transactionId);

      return {
        status: "success",
        transactionId,
        message: `Transaction ${transactionId} started successfully`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(params: {
    transactionId: string;
  }): Promise<TransactionResult> {
    try {
      if (!params.transactionId) {
        return {
          status: "error",
          error: "Transaction ID is required",
        };
      }

      await this.db.commitTransaction(params.transactionId);

      return {
        status: "success",
        message: `Transaction ${params.transactionId} committed successfully`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(params: {
    transactionId: string;
  }): Promise<TransactionResult> {
    try {
      if (!params.transactionId) {
        return {
          status: "error",
          error: "Transaction ID is required",
        };
      }

      await this.db.rollbackTransaction(params.transactionId);

      return {
        status: "success",
        message: `Transaction ${params.transactionId} rolled back successfully`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Get status of active transactions
   */
  async getTransactionStatus(): Promise<TransactionResult> {
    try {
      const activeTransactions = this.db.getActiveTransactionIds();

      return {
        status: "success",
        activeTransactions,
        message: `Found ${activeTransactions.length} active transaction(s)`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Execute a query within a transaction
   */
  async executeInTransaction(params: {
    transactionId: string;
    query: string;
    params?: any[];
  }): Promise<{
    status: "success" | "error";
    data?: any;
    error?: string;
  }> {
    try {
      if (!params.transactionId) {
        return {
          status: "error",
          error: "Transaction ID is required",
        };
      }

      if (!params.query) {
        return {
          status: "error",
          error: "Query is required",
        };
      }

      // SECURITY VALIDATION: Check if user has execute permission
      const hasExecutePermission = this.security.hasExecutePermission();

      // SECURITY VALIDATION: Validate the query before execution
      const queryValidation = this.security.validateQuery(
        params.query,
        hasExecutePermission,
      );
      if (!queryValidation.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${queryValidation.error}`,
        };
      }

      // SECURITY VALIDATION: Validate and sanitize parameters
      const paramValidation = this.security.validateParameters(
        params.params || [],
      );
      if (!paramValidation.valid) {
        return {
          status: "error",
          error: `Parameter validation failed: ${paramValidation.error}`,
        };
      }

      const result = await this.db.executeInTransaction(
        params.transactionId,
        params.query,
        paramValidation.sanitizedParams!,
      );

      return {
        status: "success",
        data: result,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }
}
