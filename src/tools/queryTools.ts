import DatabaseConnection from "../db/connection";
import SecurityLayer from "../security/securityLayer";
import {
  QueryOptimizer,
  QueryHints,
  QueryAnalysis,
} from "../optimization/queryOptimizer";
import {
  validateQuery,
  validateValue,
} from "../validation/inputValidation";

export class QueryTools {
  private db: DatabaseConnection;
  private security: SecurityLayer;
  private optimizer: QueryOptimizer;

  constructor(security: SecurityLayer) {
    this.db = DatabaseConnection.getInstance();
    this.security = security;
    this.optimizer = QueryOptimizer.getInstance();
  }

  /**
   * Execute a safe read-only SELECT query with optional optimizer hints
   */
  async runSelectQuery(queryParams: {
    query: string;
    params?: any[];
    hints?: QueryHints;
    useCache?: boolean;
    dry_run?: boolean;
  }): Promise<{
    status: string;
    data?: any[];
    error?: string;
    optimizedQuery?: string;
    dry_run?: boolean;
    execution_plan?: any;
    estimated_cost?: string;
    message?: string;
  }> {
    try {
      const { query, params = [], hints, useCache = true } = queryParams;

      // Validate query using new input validation
      const queryValidationResult = validateQuery({ query, params });
      if (!queryValidationResult.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${queryValidationResult.errors?.join(', ') || 'Invalid query parameters'}`,
        };
      }

      // Execute permission allows advanced SELECT features, not dangerous operations.
      const hasExecutePermission = this.security.hasExecutePermission();

      // Validate query using security layer
      // Mandatory safety checks apply regardless of execute permission.
      const securityQueryValidation = this.security.validateQuery(
        query,
        hasExecutePermission,
      );
      if (!securityQueryValidation.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${securityQueryValidation.error}`,
        };
      }

      // Ensure it's a SELECT query
      if (securityQueryValidation.queryType !== "SELECT") {
        return {
          status: "error",
          error:
            "Only SELECT queries are allowed with run_select_query. Use execute_write_query for other operations.",
        };
      }

      // Validate parameters
      const paramValidation = this.security.validateParameters(params);
      if (!paramValidation.valid) {
        return {
          status: "error",
          error: `Parameter validation failed: ${paramValidation.error}`,
        };
      }

      // Apply optimizer hints if provided
      let finalQuery = query;
      let optimizedQuery: string | undefined;
      if (hints) {
        finalQuery = this.optimizer.applyHints(query, hints);
        if (finalQuery !== query) {
          optimizedQuery = finalQuery;
        }
      }

      // Handle dry_run: return query plan and cost estimate without executing
      if (queryParams.dry_run) {
        const explainQuery = `EXPLAIN FORMAT=JSON ${finalQuery}`;
        const explainResult = await this.db.query<any[]>(
          explainQuery,
          paramValidation.sanitizedParams!,
        );

        // Try to get cost from JSON format
        let estimatedCost = "Unknown";
        let executionPlan = explainResult;

        if (explainResult[0] && explainResult[0].EXPLAIN) {
          try {
            const explainJson = JSON.parse(explainResult[0].EXPLAIN);
            estimatedCost = explainJson.query_block?.cost_info?.query_cost || "Unknown";
            executionPlan = explainJson;
          } catch (e) {
            // Ignore parsing error
          }
        }

        return {
          status: "success",
          data: [],
          optimizedQuery,
          dry_run: true,
          execution_plan: executionPlan,
          estimated_cost: estimatedCost,
          message: "Dry run completed. Query was not executed."
        };
      }

      // Execute the query with sanitized parameters
      const results = await this.db.query<any[]>(
        finalQuery,
        paramValidation.sanitizedParams!,
        useCache,
      );

      const maskedResults = this.security.masking.processResults(results);

      return {
        status: "success",
        data: maskedResults,
        optimizedQuery,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Analyze a query and get optimization suggestions
   */
  analyzeQuery(query: string): QueryAnalysis {
    return this.optimizer.analyzeQuery(query);
  }

  /**
   * Get suggested hints for a specific optimization goal
   */
  getSuggestedHints(goal: "SPEED" | "MEMORY" | "STABILITY"): QueryHints {
    return this.optimizer.getSuggestedHints(goal);
  }

  /**
   * Execute write operations (INSERT, UPDATE) with validation.
   * DELETE requires the separate delete permission and is validated in the security layer.
   * DDL and information queries must use their dedicated tools.
   */
  async executeWriteQuery(queryParams: { query: string; params?: any[] }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const { query, params = [] } = queryParams;

      // Validate query using new input validation
      const queryValidationResult = validateQuery({ query, params });
      if (!queryValidationResult.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${queryValidationResult.errors?.join(', ') || 'Invalid query parameters'}`,
        };
      }

      // Validate query using security layer
      // Execute permission does not bypass mandatory safety restrictions.
      const securityQueryValidation = this.security.validateQuery(query, true);
      if (!securityQueryValidation.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${securityQueryValidation.error}`,
        };
      }

      if (!["INSERT", "UPDATE", "DELETE"].includes(securityQueryValidation.queryType || "")) {
        return {
          status: "error",
          error:
            "Only INSERT, UPDATE, and DELETE are allowed with execute_write_query. Use run_select_query for SELECT and execute_ddl for schema changes.",
        };
      }

      // Validate parameters
      const paramValidation = this.security.validateParameters(params);
      if (!paramValidation.valid) {
        return {
          status: "error",
          error: `Parameter validation failed: ${paramValidation.error}`,
        };
      }

      // Execute the query with sanitized parameters
      const result = await this.db.query<any>(
        query,
        paramValidation.sanitizedParams!,
      );

      return {
        status: "success",
        data: {
          affectedRows: result.affectedRows || 0,
          insertId: result.insertId || null,
        },
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }
}
