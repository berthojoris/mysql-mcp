import Ajv from "ajv";
import { FeatureConfig, ToolCategory } from "../config/featureConfig.js";
import { MaskingLayer } from "./maskingLayer.js";

export class SecurityLayer {
  private ajv: InstanceType<typeof Ajv>;
  private readonly dangerousKeywords: string[];
  private readonly allowedOperations: string[];
  private readonly ddlOperations: string[];
  private featureConfig: FeatureConfig;
  public masking: MaskingLayer;

  constructor(featureConfig?: FeatureConfig) {
    this.ajv = new Ajv();
    this.featureConfig = featureConfig || new FeatureConfig();

    // Masking is intentionally not configurable via environment variables.
    this.masking = new MaskingLayer("none");

    // Define dangerous SQL keywords that should ALWAYS be blocked (critical security threats)
    // These are blocked even with 'execute' permission
    // Note: Avoid blocking common table/column names like "user" or "password"
    this.dangerousKeywords = [
      "GRANT",
      "REVOKE",
      "INTO OUTFILE",
      "INTO DUMPFILE",
      "LOAD DATA",
      "LOAD_FILE",
      "INFORMATION_SCHEMA.USER_PRIVILEGES",
      "MYSQL.USER",
      "MYSQL.DB",
      "PERFORMANCE_SCHEMA",
      "CREATE USER",
      "DROP USER",
      "ALTER USER",
      "SET PASSWORD",
    ];

    // Define basic allowed SQL operations
    this.allowedOperations = ["SELECT", "INSERT", "UPDATE", "DELETE"];

    // Define DDL operations that require special permission
    this.ddlOperations = ["CREATE", "ALTER", "DROP", "TRUNCATE", "RENAME"];
  }

  /**
   * Check if a specific tool is enabled in the feature configuration
   */
  public isToolEnabled(toolName: string): boolean {
    return this.featureConfig.isToolEnabled(toolName);
  }

  /**
   * Check if a query is a read-only information query (SHOW, DESCRIBE, EXPLAIN, etc.)
   * Note: EXPLAIN ANALYZE is handled separately by validateQuery because MySQL
   * executes the wrapped statement, so it is authorized as the inner statement type.
   */
  private isInformationQuery(query: string): boolean {
    return /^(SHOW|DESCRIBE|DESC|EXPLAIN|HELP)\b/i.test(query.trim());
  }

  /**
   * Authorize the SQL operation separately from the enclosing tool.
   */
  validateQueryPermissions(queryType: string): { valid: boolean; error?: string } {
    if (this.ddlOperations.includes(queryType)) {
      return this.featureConfig.isToolEnabled("executeDdl")
        ? { valid: true }
        : { valid: false, error: this.featureConfig.getPermissionError("executeDdl") };
    }

    const requiredPermissions: Record<string, ToolCategory[]> = {
      SELECT: [ToolCategory.READ],
      INSERT: [ToolCategory.CREATE, ToolCategory.EXECUTE],
      UPDATE: [ToolCategory.UPDATE, ToolCategory.EXECUTE],
      DELETE: [ToolCategory.DELETE],
      INFORMATION: [ToolCategory.LIST, ToolCategory.READ],
    };
    const permissions = requiredPermissions[queryType];
    if (!permissions) {
      return { valid: false, error: "Query type not allowed" };
    }
    if (!permissions.some((permission) => this.featureConfig.isCategoryEnabled(permission))) {
      return {
        valid: false,
        error: `Permission denied: ${queryType} requires ${permissions.map((permission) => `'${permission}'`).join(" or ")} permission.`,
      };
    }
    return { valid: true };
  }

  /**
   * Validate input against a JSON schema
   */
  validateInput(schema: object, data: any): { valid: boolean; errors?: any } {
    const validate = this.ajv.compile(schema);
    const valid = validate(data);

    if (!valid) {
      return {
        valid: false,
        errors: validate.errors,
      };
    }

    return { valid: true };
  }

  /**
   * Validate and sanitize table/column names to prevent SQL injection
   */
  validateIdentifier(identifier: string): { valid: boolean; error?: string } {
    if (!identifier || typeof identifier !== "string") {
      return { valid: false, error: "Identifier must be a non-empty string" };
    }

    // Check length
    if (identifier.length > 64) {
      return { valid: false, error: "Identifier too long (max 64 characters)" };
    }

    // MySQL identifier rules: alphanumeric, underscore, dollar sign
    // Must start with letter, underscore, or dollar sign
    const identifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
    if (!identifierRegex.test(identifier)) {
      return { valid: false, error: "Invalid identifier format" };
    }

    // Check against MySQL reserved words (basic list)
    const reservedWords = [
      "SELECT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "FROM",
      "WHERE",
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "OUTER",
      "ON",
      "AS",
      "AND",
      "OR",
      "NOT",
      "NULL",
      "TRUE",
      "FALSE",
      "ORDER",
      "BY",
      "GROUP",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "DISTINCT",
      "ALL",
      "EXISTS",
      "IN",
      "BETWEEN",
      "LIKE",
      "REGEXP",
      "CASE",
      "WHEN",
      "THEN",
      "ELSE",
      "END",
      "IF",
      "IFNULL",
    ];

    if (reservedWords.includes(identifier.toUpperCase())) {
      return { valid: false, error: "Identifier cannot be a reserved word" };
    }

    return { valid: true };
  }

  /**
   * Enhanced SQL query validation for security issues
   * @param query - The SQL query to validate
   * @param allowAdvancedQueries - Allows advanced SELECT features, never dangerous operations
   */
  validateQuery(
    query: string,
    allowAdvancedQueries: boolean = false,
  ): {
    valid: boolean;
    error?: string;
    queryType?: string;
  } {
    if (!query || typeof query !== "string") {
      return { valid: false, error: "Query must be a non-empty string" };
    }

    // Enhanced comment detection - prevent comment-based injection
    const commentCheck = this.detectComments(query);
    if (!commentCheck.valid) {
      return commentCheck;
    }

    // Enhanced multiple statement detection
    const multiStatementCheck = this.detectMultipleStatements(query);
    if (!multiStatementCheck.valid) {
      return multiStatementCheck;
    }

    const trimmedQuery = query.trim().toUpperCase();

    // Check for empty query
    if (trimmedQuery.length === 0) {
      return { valid: false, error: "Query cannot be empty" };
    }

    // Remove trailing semicolon for analysis
    const cleanQuery = trimmedQuery.replace(/;$/, "");

    const dangerousCheck = this.detectDangerousKeywords(cleanQuery, allowAdvancedQueries);
    if (!dangerousCheck.valid) {
      return dangerousCheck;
    }

    // MySQL 8.0.18+ actually executes the statement wrapped by EXPLAIN ANALYZE,
    // including multi-table UPDATE/DELETE. Such queries are authorized as the
    // inner statement instead of being treated as read-only information queries.
    const explainAnalyzeMatch = cleanQuery.match(
      /^(?:EXPLAIN|DESCRIBE|DESC)\s+ANALYZE\s+(?:FORMAT\s*=\s*TREE\s+)?(.+)$/is,
    );

    // Information queries still require permission and mandatory safety checks.
    if (!explainAnalyzeMatch && this.isInformationQuery(trimmedQuery)) {
      const permissionCheck = this.validateQueryPermissions("INFORMATION");
      return permissionCheck.valid
        ? { valid: true, queryType: "INFORMATION" }
        : permissionCheck;
    }

    // Enhanced query type detection with better parsing.
    // EXPLAIN ANALYZE is classified by the inner statement it executes.
    const queryTypeResult = this.detectQueryType(
      explainAnalyzeMatch ? explainAnalyzeMatch[1].trim() : cleanQuery,
    );
    if (!queryTypeResult.valid) {
      return queryTypeResult;
    }

    if (!allowAdvancedQueries) {
      // Additional checks for specific query types
      if (queryTypeResult.queryType === "SELECT") {
        const selectCheck = this.validateSelectQuery(cleanQuery);
        if (!selectCheck.valid) {
          return selectCheck;
        }
      }
    }

    return { valid: true, queryType: queryTypeResult.queryType };
  }

  /**
   * Enhanced comment detection to prevent bypass techniques
   */
  private detectComments(query: string): { valid: boolean; error?: string } {
    // Check for various comment types and bypass attempts
    const commentPatterns = [
      /\/\*[\s\S]*?\*\//g,  // Multi-line comments
      /--.*$/gm,             // Single-line comments
      /#.*$/gm,              // MySQL-style comments
      /\/\*.*$/,             // Unterminated multi-line comment
      /\*\//,                // End comment without start
      /\/\*\*.*?\*\//g,     // Nested comment attempts
      /\/\*!\s*\d+\s+.*?\*\//g, // MySQL version-specific comments
      /\/\*!.*?\*\//g,       // MySQL conditional comments
      /--\s+/,               // Comments with space after --
      /--\t/,                // Comments with tab after --
      /--\r/,                // Comments with carriage return after --
      /--\n/,                // Comments with newline after --
      /\/\*--.*?\*\//g,      // Comments inside multi-line comments
      /\/\*.*?--.*?\*\//g,   // Comments with -- inside multi-line comments
    ];

    for (const pattern of commentPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: "Comments not allowed in queries" };
      }
    }

    // Check for comment-like sequences that could be used for injection
    const suspiciousPatterns = [
      /\/\*/,   // Potential comment start (literal /*)
      /\*\//,   // Potential comment end (literal */)
      /--\s/,   // Potential comment (-- followed by space, not -- in dates)
      /#/,      // Potential comment
      /\/\*.*?/, // Partial comment start
      /.*?\*\//, // Partial comment end
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(query)) {
        return { valid: false, error: "Comment-like sequences not allowed in queries" };
      }
    }

    return { valid: true };
  }

  /**
   * Enhanced multiple statement detection
   */
  private detectMultipleStatements(query: string): { valid: boolean; error?: string } {
    // Remove string literals to avoid false positives
    const queryWithoutStrings = query.replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '');
    
    // Check for multiple semicolons not at the end
    const semicolonMatches = queryWithoutStrings.match(/;/g);
    if (semicolonMatches && semicolonMatches.length > 1) {
      return { valid: false, error: "Multiple statements not allowed" };
    }

    // Check for semicolon not at the very end (after trimming)
    const trimmedQuery = query.trim();
    if (trimmedQuery.includes(';') && !trimmedQuery.endsWith(';')) {
      return { valid: false, error: "Multiple statements not allowed" };
    }

    // Additional check for multiple statements using different delimiters
    // Check for multiple statements separated by whitespace + semicolon + whitespace
    const statementPattern = /\s*;\s*(?=\s*(?:SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|RENAME|SHOW|DESC|EXPLAIN|HELP)\b)/gi;
    if (statementPattern.test(queryWithoutStrings)) {
      return { valid: false, error: "Multiple statements not allowed" };
    }

    return { valid: true };
  }

  /**
   * Enhanced query type detection
   */
  private detectQueryType(cleanQuery: string): { valid: boolean; queryType?: string; error?: string } {
    // More robust query type detection using regex
    const queryTypePatterns = [
      { type: 'SELECT', pattern: /^SELECT\s+/i },
      { type: 'INSERT', pattern: /^INSERT\s+/i },
      { type: 'UPDATE', pattern: /^UPDATE\s+/i },
      { type: 'DELETE', pattern: /^DELETE\s+/i },
      { type: 'CREATE', pattern: /^CREATE\s+/i },
      { type: 'ALTER', pattern: /^ALTER\s+/i },
      { type: 'DROP', pattern: /^DROP\s+/i },
      { type: 'TRUNCATE', pattern: /^TRUNCATE\s+/i },
      { type: 'RENAME', pattern: /^RENAME\s+/i },
    ];

    for (const { type, pattern } of queryTypePatterns) {
      if (pattern.test(cleanQuery)) {
        const permissionCheck = this.validateQueryPermissions(type);
        if (!permissionCheck.valid) {
          return permissionCheck;
        }

        return { valid: true, queryType: type };
      }
    }

    return { valid: false, error: "Query type not allowed" };
  }

  /**
   * Enhanced dangerous keyword detection
   */
  private detectDangerousKeywords(
    cleanQuery: string,
    allowAdvancedQueries: boolean,
  ): { valid: boolean; error?: string } {
    // Remove string literals to avoid false positives
    const queryWithoutStrings = cleanQuery
      .replace(/'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"/g, '')
      .replace(/`([^`]*)`/g, "$1");

    for (const keyword of this.dangerousKeywords) {
      // Enhanced regex with word boundaries and case insensitivity
      const keywordRegex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (keywordRegex.test(queryWithoutStrings)) {
        return {
          valid: false,
          error: `Dangerous keyword detected: ${keyword}. This operation is not allowed.`,
        };
      }
    }

    // Additional dangerous patterns
    const dangerousPatterns = [
      /\b(LOAD_FILE|INTO\s+OUTFILE|INTO\s+DUMPFILE)\b/i,
      /\b(GRANT|REVOKE|CREATE\s+USER|DROP\s+USER|ALTER\s+USER|SET\s+PASSWORD|RENAME\s+USER)\b/i,
      /\b(SLEEP|BENCHMARK|GET_LOCK|RELEASE_LOCK)\b/i,
      /\b(PREPARE|EXECUTE|DEALLOCATE\s+PREPARE)\b/i,
      /\b(LOAD\s+DATA|SELECT\s+.*\s+INTO\s+OUTFILE|SELECT\s+.*\s+INTO\s+DUMPFILE)\b/i,
      /\b(SHOW\s+GRANTS|SHOW\s+CREATE\s+USER|SET\s+GLOBAL|SET\s+PERSIST|FLUSH|SHUTDOWN)\b/i,
      /\b(INSTALL\s+COMPONENT|UNINSTALL\s+COMPONENT|INSTALL\s+PLUGIN|UNINSTALL\s+PLUGIN)\b/i,
      /\b(START\s+SLAVE|STOP\s+SLAVE|CHANGE\s+MASTER|PURGE\s+BINARY\s+LOGS|RESET\s+MASTER|RESET\s+SLAVE)\b/i,
      /\b(XA\s+|KILL\s+\d+)\b/i,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(queryWithoutStrings)) {
        return {
          valid: false,
          error: "Dangerous operation detected. This operation is not allowed.",
        };
      }
    }

    if (!allowAdvancedQueries && /\b(INFORMATION_SCHEMA\.|MYSQL\.|PERFORMANCE_SCHEMA\.|SYS\.)\b/i.test(queryWithoutStrings)) {
      return {
        valid: false,
        error: "System schema queries require 'execute' permission.",
      };
    }

    return { valid: true };
  }

  /**
   * Enhanced SELECT query validation
   */
  private validateSelectQuery(cleanQuery: string): { valid: boolean; error?: string } {
    // Remove string literals to avoid false positives
    const queryWithoutStrings = cleanQuery.replace(/'[^']*'|"[^"]*"/g, '');

    // Check for UNION attacks
    if (/\bUNION\b/i.test(queryWithoutStrings)) {
      return {
        valid: false,
        error: "UNION operations not allowed without 'execute' permission",
      };
    }

    // Check for subqueries in FROM clause
    if (/FROM\s*\(/i.test(queryWithoutStrings)) {
      return {
        valid: false,
        error: "Subqueries in FROM clause not allowed without 'execute' permission",
      };
    }

    // Check for procedural statements
    if (/\b(CALL|EXEC|EXECUTE)\b/i.test(queryWithoutStrings)) {
      return {
        valid: false,
        error: "Procedural statements not allowed without 'execute' permission",
      };
    }

    return { valid: true };
  }

  /**
   * Validate parameter values to prevent injection
   */
  validateParameters(params: any[]): {
    valid: boolean;
    error?: string;
    sanitizedParams?: any[];
  } {
    if (!params) {
      return { valid: true, sanitizedParams: [] };
    }

    if (!Array.isArray(params)) {
      return { valid: false, error: "Parameters must be an array" };
    }

    const sanitizedParams: any[] = [];

    for (let i = 0; i < params.length; i++) {
      const param = params[i];

      // Check for null/undefined
      if (param === null || param === undefined) {
        sanitizedParams.push(null);
        continue;
      }

      // Validate based on type
      if (typeof param === "string") {
        // Check string length
        if (param.length > 65535) {
          return {
            valid: false,
            error: `Parameter ${i} too long (max 65535 characters)`,
          };
        }

        // Don't modify strings - let MySQL handle escaping through prepared statements
        sanitizedParams.push(param);
      } else if (typeof param === "number") {
        // Validate number
        if (!Number.isFinite(param)) {
          return {
            valid: false,
            error: `Parameter ${i} must be a finite number`,
          };
        }
        sanitizedParams.push(param);
      } else if (typeof param === "boolean") {
        sanitizedParams.push(param);
      } else if (param instanceof Date) {
        sanitizedParams.push(param);
      } else {
        return {
          valid: false,
          error: `Parameter ${i} has unsupported type: ${typeof param}`,
        };
      }
    }

    return { valid: true, sanitizedParams };
  }

  /**
   * Check if a query is a read-only SELECT query or information query (SHOW, DESCRIBE, etc.)
   */
  isReadOnlyQuery(query: string, allowAdvancedQueries: boolean = false): boolean {
    const validation = this.validateQuery(query, allowAdvancedQueries);
    return validation.valid && (
      validation.queryType === "SELECT" || validation.queryType === "INFORMATION"
    );
  }

  /**
   * Check if a query contains dangerous operations
   */
  hasDangerousOperations(query: string): boolean {
    const validation = this.validateQuery(query);
    return !validation.valid;
  }

  /**
   * Check if execute permission is enabled
   */
  hasExecutePermission(): boolean {
    return this.featureConfig.isCategoryEnabled(ToolCategory.EXECUTE);
  }

  /**
   * Escape identifier for safe use in SQL queries
   */
  escapeIdentifier(identifier: string): string {
    const validation = this.validateIdentifier(identifier);
    if (!validation.valid) {
      throw new Error(`Invalid identifier: ${validation.error}`);
    }
    // Use backticks to escape MySQL identifiers
    return `\`${identifier}\``;
  }
}

export default SecurityLayer;
