/**
 * MySQL Query Optimization Hints
 *
 * Supports MySQL 8.0+ optimizer hints and provides query analysis
 * for performance optimization suggestions.
 */

/**
 * Available optimizer hint types for MySQL 8.0+
 */
export type OptimizerHintType =
  // Join-Order Optimizer Hints
  | "JOIN_FIXED_ORDER" // Force tables to be joined in the order specified in the FROM clause
  | "JOIN_ORDER" // Use specified table order for join
  | "JOIN_PREFIX" // Use specified tables first in join order
  | "JOIN_SUFFIX" // Use specified tables last in join order
  // Table-Level Optimizer Hints
  | "BKA" // Batched Key Access join
  | "NO_BKA" // Disable BKA
  | "BNL" // Block Nested Loop join (deprecated in MySQL 8.0.18+)
  | "NO_BNL" // Disable BNL
  | "HASH_JOIN" // Use hash join
  | "NO_HASH_JOIN" // Disable hash join
  | "MERGE" // Merge derived tables/views into outer query
  | "NO_MERGE" // Don't merge derived tables/views
  // Index-Level Optimizer Hints
  | "INDEX" // Use specific indexes
  | "NO_INDEX" // Don't use specific indexes
  | "INDEX_MERGE" // Use index merge optimization
  | "NO_INDEX_MERGE" // Disable index merge
  | "MRR" // Multi-Range Read optimization
  | "NO_MRR" // Disable MRR
  | "NO_ICP" // Disable Index Condition Pushdown
  | "NO_RANGE_OPTIMIZATION" // Disable range optimization
  | "SKIP_SCAN" // Use skip scan
  | "NO_SKIP_SCAN" // Disable skip scan
  // Subquery Optimizer Hints
  | "SEMIJOIN" // Use semi-join strategy
  | "NO_SEMIJOIN" // Disable semi-join
  | "SUBQUERY" // Use specific subquery strategy
  // Caching Hints
  | "SQL_NO_CACHE" // Don't cache result (deprecated but kept for compatibility)
  | "SQL_CACHE" // Cache result (deprecated but kept for compatibility)
  // Miscellaneous
  | "MAX_EXECUTION_TIME" // Set maximum execution time
  | "RESOURCE_GROUP" // Use specific resource group
  | "SET_VAR"; // Set session variable for the statement

/**
 * Optimizer hint configuration
 */
export interface OptimizerHint {
  type: OptimizerHintType;
  table?: string; // Table name for table/index-level hints
  index?: string | string[]; // Index name(s) for index-level hints
  value?: string | number; // Value for hints like MAX_EXECUTION_TIME
  tables?: string[]; // Table list for join order hints
  strategy?: string; // Strategy for SEMIJOIN/SUBQUERY hints
}

/**
 * Query optimization hints configuration
 */
export interface QueryHints {
  hints?: OptimizerHint[];
  forceIndex?: string | string[]; // Shorthand for INDEX hint
  ignoreIndex?: string | string[]; // Shorthand for NO_INDEX hint
  useIndex?: string | string[]; // Shorthand for USE INDEX (non-hint syntax)
  maxExecutionTime?: number; // Maximum execution time in milliseconds
  straightJoin?: boolean; // Use STRAIGHT_JOIN
  noCache?: boolean; // SQL_NO_CACHE
  highPriority?: boolean; // HIGH_PRIORITY for SELECT
  sqlBigResult?: boolean; // SQL_BIG_RESULT
  sqlSmallResult?: boolean; // SQL_SMALL_RESULT
  sqlBufferResult?: boolean; // SQL_BUFFER_RESULT
  sqlCalcFoundRows?: boolean; // SQL_CALC_FOUND_ROWS (deprecated in MySQL 8.0.17+)
}

/**
 * Query analysis result
 */
export interface QueryAnalysis {
  originalQuery: string;
  queryType: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "OTHER";
  tables: string[];
  hasJoins: boolean;
  hasSubqueries: boolean;
  hasGroupBy: boolean;
  hasOrderBy: boolean;
  hasLimit: boolean;
  estimatedComplexity: "LOW" | "MEDIUM" | "HIGH";
  suggestions: OptimizationSuggestion[];
}

/**
 * Optimization suggestion
 */
export interface OptimizationSuggestion {
  type: "INDEX" | "HINT" | "REWRITE" | "STRUCTURE";
  priority: "LOW" | "MEDIUM" | "HIGH";
  description: string;
  suggestedAction: string;
  hint?: OptimizerHint;
}

/**
 * Query Optimizer class
 * Provides MySQL query optimization hints and analysis
 */
export class QueryOptimizer {
  private static instance: QueryOptimizer;

  private constructor() {}

  /**
   * Get singleton instance
   */
  public static getInstance(): QueryOptimizer {
    if (!QueryOptimizer.instance) {
      QueryOptimizer.instance = new QueryOptimizer();
    }
    return QueryOptimizer.instance;
  }

  /**
   * Escape special regex characters in a string
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Validate that an identifier is safe to use
   */
  private isValidIdentifier(identifier: string): boolean {
    // Must start with letter or underscore, contain only valid chars
    // Max length 64 (MySQL limit)
    return /^[a-zA-Z_][a-zA-Z0-9_\.]{0,63}$/.test(identifier);
  }

  /**
   * Return the values that are safe identifiers. Hints are added after the
   * query has been validated, so anything else is dropped rather than quoted.
   */
  private safeIdentifiers(value: unknown): string[] {
    const values = Array.isArray(value) ? value : [value];
    return values.filter(
      (item): item is string =>
        typeof item === "string" && this.isValidIdentifier(item),
    );
  }

  /**
   * Return a SEMIJOIN/SUBQUERY strategy list if every strategy is allowed
   */
  private safeStrategy(strategy: unknown, allowed: string[]): string | null {
    if (typeof strategy !== "string") {
      return null;
    }
    const strategies = strategy
      .split(",")
      .map((item) => item.trim().toUpperCase());
    return strategies.every((item) => allowed.includes(item))
      ? strategies.join(", ")
      : null;
  }

  /**
   * Return a positive integer no larger than max, or null
   */
  private safePositiveInteger(value: unknown, max: number): number | null {
    const number = Number(value);
    return Number.isInteger(number) && number > 0 && number <= max
      ? number
      : null;
  }

  /**
   * Apply optimizer hints to a SELECT query
   */
  public applyHints(query: string, hints: QueryHints): string {
    const normalizedQuery = query.trim();
    const upperQuery = normalizedQuery.toUpperCase();

    // Only apply hints to SELECT queries
    if (!upperQuery.startsWith("SELECT")) {
      return normalizedQuery;
    }

    let hintBlock = this.buildHintBlock(hints);
    let modifiedQuery = normalizedQuery;

    // Handle STRAIGHT_JOIN
    if (hints.straightJoin) {
      modifiedQuery = modifiedQuery.replace(/^SELECT/i, "SELECT STRAIGHT_JOIN");
    }

    // Handle SQL modifiers (HIGH_PRIORITY, SQL_BIG_RESULT, etc.)
    const sqlModifiers: string[] = [];
    if (hints.highPriority) sqlModifiers.push("HIGH_PRIORITY");
    if (hints.sqlBigResult) sqlModifiers.push("SQL_BIG_RESULT");
    if (hints.sqlSmallResult) sqlModifiers.push("SQL_SMALL_RESULT");
    if (hints.sqlBufferResult) sqlModifiers.push("SQL_BUFFER_RESULT");
    if (hints.sqlCalcFoundRows) sqlModifiers.push("SQL_CALC_FOUND_ROWS");
    if (hints.noCache) sqlModifiers.push("SQL_NO_CACHE");

    if (sqlModifiers.length > 0) {
      const modifiersStr = sqlModifiers.join(" ");
      modifiedQuery = modifiedQuery.replace(
        /^SELECT(\s+STRAIGHT_JOIN)?/i,
        `SELECT$1 ${modifiersStr}`,
      );
    }

    // Insert hint block after SELECT keyword
    if (hintBlock) {
      // Find the position after SELECT (and any modifiers)
      const selectMatch = modifiedQuery.match(
        /^SELECT(\s+STRAIGHT_JOIN)?(\s+(?:HIGH_PRIORITY|SQL_BIG_RESULT|SQL_SMALL_RESULT|SQL_BUFFER_RESULT|SQL_CALC_FOUND_ROWS|SQL_NO_CACHE)\s*)*/i,
      );
      if (selectMatch) {
        const insertPos = selectMatch[0].length;
        modifiedQuery =
          modifiedQuery.slice(0, insertPos) +
          ` /*+ ${hintBlock} */ ` +
          modifiedQuery.slice(insertPos);
      }
    }

    // Handle USE INDEX / FORCE INDEX / IGNORE INDEX (traditional syntax)
    modifiedQuery = this.applyIndexHintsTraditional(modifiedQuery, hints);

    return modifiedQuery.replace(/\s+/g, " ").trim();
  }

  /**
   * Build the optimizer hint block string
   */
  private buildHintBlock(hints: QueryHints): string {
    const hintParts: string[] = [];

    // Process explicit hints array
    if (hints.hints && hints.hints.length > 0) {
      for (const hint of hints.hints) {
        const hintStr = this.formatHint(hint);
        if (hintStr) {
          hintParts.push(hintStr);
        }
      }
    }

    // Process shorthand hints
    if (hints.maxExecutionTime !== undefined) {
      // Max 1 year in ms
      const maxTime = this.safePositiveInteger(
        Math.floor(Math.abs(Number(hints.maxExecutionTime))),
        31536000000,
      );
      if (maxTime !== null) {
        hintParts.push(`MAX_EXECUTION_TIME(${maxTime})`);
      }
    }

    if (hints.forceIndex) {
      const indexes = this.safeIdentifiers(hints.forceIndex);
      if (indexes.length > 0) {
        hintParts.push(`INDEX(${indexes.join(", ")})`);
      }
    }

    if (hints.ignoreIndex) {
      const indexes = this.safeIdentifiers(hints.ignoreIndex);
      if (indexes.length > 0) {
        hintParts.push(`NO_INDEX(${indexes.join(", ")})`);
      }
    }

    return hintParts.join(" ");
  }

  /**
   * Format a single optimizer hint
   */
  private formatHint(hint: OptimizerHint): string {
    const table = this.safeIdentifiers(hint.table)[0];
    if (hint.table !== undefined && !table) {
      return "";
    }

    switch (hint.type) {
      // Join-Order Hints
      case "JOIN_FIXED_ORDER":
        return "JOIN_FIXED_ORDER()";
      case "JOIN_ORDER":
      case "JOIN_PREFIX":
      case "JOIN_SUFFIX":
        if (hint.tables && hint.tables.length > 0) {
          const tables = this.safeIdentifiers(hint.tables);
          if (tables.length === hint.tables.length) {
            return `${hint.type}(${tables.join(", ")})`;
          }
        }
        return "";

      // Table-Level Hints
      case "BKA":
      case "NO_BKA":
      case "BNL":
      case "NO_BNL":
      case "HASH_JOIN":
      case "NO_HASH_JOIN":
      case "MERGE":
      case "NO_MERGE":
        if (table) {
          return `${hint.type}(${table})`;
        }
        return `${hint.type}()`;

      // Index-Level Hints
      case "INDEX":
      case "NO_INDEX":
      case "INDEX_MERGE":
      case "NO_INDEX_MERGE":
      case "MRR":
      case "NO_MRR":
      case "NO_ICP":
      case "NO_RANGE_OPTIMIZATION":
      case "SKIP_SCAN":
      case "NO_SKIP_SCAN":
        if (table && hint.index) {
          const indexes = this.safeIdentifiers(hint.index);
          const indexCount = Array.isArray(hint.index) ? hint.index.length : 1;
          if (indexes.length === 0 || indexes.length !== indexCount) {
            return "";
          }
          return `${hint.type}(${table} ${indexes.join(", ")})`;
        } else if (table) {
          return `${hint.type}(${table})`;
        }
        return "";

      // Subquery Hints
      case "SEMIJOIN":
      case "NO_SEMIJOIN":
        if (hint.strategy) {
          const strategy = this.safeStrategy(hint.strategy, [
            "DUPSWEEDOUT", "FIRSTMATCH", "LOOSESCAN", "MATERIALIZATION",
          ]);
          return strategy ? `${hint.type}(${strategy})` : "";
        }
        return `${hint.type}()`;
      case "SUBQUERY": {
        const strategy = this.safeStrategy(hint.strategy, [
          "INTOEXISTS", "MATERIALIZATION",
        ]);
        return strategy ? `SUBQUERY(${strategy})` : "";
      }

      // Miscellaneous
      case "MAX_EXECUTION_TIME": {
        const maxTime = this.safePositiveInteger(hint.value, 31536000000);
        return maxTime !== null ? `MAX_EXECUTION_TIME(${maxTime})` : "";
      }
      case "RESOURCE_GROUP": {
        const group = this.safeIdentifiers(hint.value)[0];
        return group ? `RESOURCE_GROUP(${group})` : "";
      }
      case "SET_VAR":
        // name=value, where value is a number, a word, or a quoted list such
        // as optimizer_switch='mrr=on,mrr_cost_based=off'
        if (
          typeof hint.value === "string" &&
          /^[a-zA-Z_][a-zA-Z0-9_]{0,63}s*=s*(?:[a-zA-Z0-9_.]{1,64}|'[a-zA-Z0-9_=,.]{1,256}')$/.test(
            hint.value,
          )
        ) {
          return `SET_VAR(${hint.value})`;
        }
        return "";

      // Cache hints (legacy)
      case "SQL_NO_CACHE":
      case "SQL_CACHE":
        return ""; // These are handled as SQL modifiers, not hint block

      default:
        return "";
    }
  }

  /**
   * Apply traditional USE INDEX / FORCE INDEX / IGNORE INDEX syntax
   */
  private applyIndexHintsTraditional(query: string, hints: QueryHints): string {
    if (!hints.useIndex) {
      return query;
    }

    // Find table references and add USE INDEX after them
    const indexes = this.safeIdentifiers(hints.useIndex);
    if (indexes.length === 0) {
      return query;
    }
    const useIndexClause = `USE INDEX (${indexes.join(", ")})`;

    // Simple approach: add after FROM clause table
    // This is a basic implementation - complex queries may need more sophisticated parsing
    const fromMatch = query.match(
      /FROM\s+[\`"']?(\w+)[\`"']?(\s+(?:AS\s+)?[\`"']?\w+[\`"']?)?/i,
    );
    if (fromMatch) {
      const fullMatch = fromMatch[0];
      const insertPos = query.indexOf(fullMatch) + fullMatch.length;
      return (
        query.slice(0, insertPos) +
        " " +
        useIndexClause +
        query.slice(insertPos)
      );
    }

    return query;
  }

  /**
   * Analyze a query and provide optimization suggestions
   */
  public analyzeQuery(query: string): QueryAnalysis {
    const normalizedQuery = query.trim();
    const upperQuery = normalizedQuery.toUpperCase();

    // Determine query type
    let queryType: QueryAnalysis["queryType"] = "OTHER";
    if (upperQuery.startsWith("SELECT")) queryType = "SELECT";
    else if (upperQuery.startsWith("INSERT")) queryType = "INSERT";
    else if (upperQuery.startsWith("UPDATE")) queryType = "UPDATE";
    else if (upperQuery.startsWith("DELETE")) queryType = "DELETE";

    // Extract tables
    const tables = this.extractTables(normalizedQuery);

    // Analyze query structure
    const hasJoins = /\bJOIN\b/i.test(normalizedQuery);
    const hasSubqueries = /\(\s*SELECT\b/i.test(normalizedQuery);
    const hasGroupBy = /\bGROUP\s+BY\b/i.test(normalizedQuery);
    const hasOrderBy = /\bORDER\s+BY\b/i.test(normalizedQuery);
    const hasLimit = /\bLIMIT\b/i.test(normalizedQuery);

    // Estimate complexity
    let complexity: QueryAnalysis["estimatedComplexity"] = "LOW";
    if (hasSubqueries || (hasJoins && tables.length > 3)) {
      complexity = "HIGH";
    } else if (hasJoins || hasGroupBy) {
      complexity = "MEDIUM";
    }

    // Generate suggestions
    const suggestions = this.generateSuggestions({
      queryType,
      tables,
      hasJoins,
      hasSubqueries,
      hasGroupBy,
      hasOrderBy,
      hasLimit,
      query: normalizedQuery,
    });

    return {
      originalQuery: normalizedQuery,
      queryType,
      tables,
      hasJoins,
      hasSubqueries,
      hasGroupBy,
      hasOrderBy,
      hasLimit,
      estimatedComplexity: complexity,
      suggestions,
    };
  }

  /**
   * Extract table names from a query
   */
  private extractTables(query: string): string[] {
    const tables: Set<string> = new Set();

    // Match FROM clause
    const fromMatch = query.match(/FROM\s+([^\s,;()]+)/gi);
    if (fromMatch) {
      for (const match of fromMatch) {
        const table = match.replace(/FROM\s+/i, "").replace(/[\`"']/g, "");
        if (table && !this.isKeyword(table)) {
          tables.add(table);
        }
      }
    }

    // Match JOIN clauses
    const joinMatch = query.match(/JOIN\s+([^\s,;()]+)/gi);
    if (joinMatch) {
      for (const match of joinMatch) {
        const table = match.replace(/JOIN\s+/i, "").replace(/[\`"']/g, "");
        if (table && !this.isKeyword(table)) {
          tables.add(table);
        }
      }
    }

    // Match UPDATE
    const updateMatch = query.match(/UPDATE\s+([^\s,;()]+)/gi);
    if (updateMatch) {
      for (const match of updateMatch) {
        const table = match.replace(/UPDATE\s+/i, "").replace(/[\`"']/g, "");
        if (table && !this.isKeyword(table)) {
          tables.add(table);
        }
      }
    }

    // Match INSERT INTO
    const insertMatch = query.match(/INSERT\s+INTO\s+([^\s,;()]+)/gi);
    if (insertMatch) {
      for (const match of insertMatch) {
        const table = match
          .replace(/INSERT\s+INTO\s+/i, "")
          .replace(/[\`"']/g, "");
        if (table && !this.isKeyword(table)) {
          tables.add(table);
        }
      }
    }

    // Match DELETE FROM
    const deleteMatch = query.match(/DELETE\s+FROM\s+([^\s,;()]+)/gi);
    if (deleteMatch) {
      for (const match of deleteMatch) {
        const table = match
          .replace(/DELETE\s+FROM\s+/i, "")
          .replace(/[\`"']/g, "");
        if (table && !this.isKeyword(table)) {
          tables.add(table);
        }
      }
    }

    return Array.from(tables);
  }

  /**
   * Check if a word is a SQL keyword
   */
  private isKeyword(word: string): boolean {
    const keywords = [
      "SELECT",
      "FROM",
      "WHERE",
      "AND",
      "OR",
      "NOT",
      "IN",
      "LIKE",
      "JOIN",
      "INNER",
      "LEFT",
      "RIGHT",
      "OUTER",
      "CROSS",
      "ON",
      "GROUP",
      "BY",
      "ORDER",
      "HAVING",
      "LIMIT",
      "OFFSET",
      "INSERT",
      "INTO",
      "VALUES",
      "UPDATE",
      "SET",
      "DELETE",
      "CREATE",
      "ALTER",
      "DROP",
      "TABLE",
      "INDEX",
      "VIEW",
      "AS",
      "DISTINCT",
      "ALL",
      "UNION",
      "EXCEPT",
      "INTERSECT",
    ];
    return keywords.includes(word.toUpperCase());
  }

  /**
   * Generate optimization suggestions based on query analysis
   */
  private generateSuggestions(analysis: {
    queryType: string;
    tables: string[];
    hasJoins: boolean;
    hasSubqueries: boolean;
    hasGroupBy: boolean;
    hasOrderBy: boolean;
    hasLimit: boolean;
    query: string;
  }): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];

    // Suggestion: Use index for JOIN operations
    if (analysis.hasJoins && analysis.tables.length > 2) {
      suggestions.push({
        type: "HINT",
        priority: "MEDIUM",
        description: "Consider using HASH_JOIN for large table joins",
        suggestedAction:
          "Add HASH_JOIN hint for better performance on large datasets",
        hint: { type: "HASH_JOIN" },
      });
    }

    // Suggestion: Subquery optimization
    if (analysis.hasSubqueries) {
      suggestions.push({
        type: "HINT",
        priority: "HIGH",
        description: "Subqueries detected - consider semi-join optimization",
        suggestedAction: "Use SEMIJOIN hint or rewrite as JOIN",
        hint: { type: "SEMIJOIN", strategy: "MATERIALIZATION" },
      });
    }

    // Suggestion: ORDER BY without LIMIT
    if (analysis.hasOrderBy && !analysis.hasLimit) {
      suggestions.push({
        type: "STRUCTURE",
        priority: "MEDIUM",
        description: "ORDER BY without LIMIT may cause full result set sorting",
        suggestedAction: "Consider adding LIMIT clause to improve performance",
      });
    }

    // Suggestion: GROUP BY optimization
    if (analysis.hasGroupBy) {
      suggestions.push({
        type: "INDEX",
        priority: "MEDIUM",
        description:
          "GROUP BY operations benefit from indexes on grouped columns",
        suggestedAction: "Ensure indexes exist on GROUP BY columns",
      });
    }

    // Suggestion: Multiple table joins
    if (analysis.tables.length >= 3) {
      suggestions.push({
        type: "HINT",
        priority: "MEDIUM",
        description:
          "Multiple tables joined - join order may impact performance",
        suggestedAction:
          "Consider using JOIN_ORDER hint if you know the optimal order",
        hint: { type: "JOIN_ORDER", tables: analysis.tables },
      });
    }

    // Suggestion: Long-running query protection
    if (analysis.hasSubqueries || (analysis.hasJoins && analysis.hasGroupBy)) {
      suggestions.push({
        type: "HINT",
        priority: "LOW",
        description:
          "Complex query may run long - consider execution time limit",
        suggestedAction:
          "Add MAX_EXECUTION_TIME hint to prevent runaway queries",
        hint: { type: "MAX_EXECUTION_TIME", value: 30000 },
      });
    }

    return suggestions;
  }

  /**
   * Get suggested hints for a specific optimization goal
   */
  public getSuggestedHints(goal: "SPEED" | "MEMORY" | "STABILITY"): QueryHints {
    switch (goal) {
      case "SPEED":
        return {
          hints: [{ type: "HASH_JOIN" }, { type: "MRR" }],
          sqlBigResult: true,
        };
      case "MEMORY":
        return {
          hints: [{ type: "NO_HASH_JOIN" }, { type: "NO_BNL" }],
          sqlSmallResult: true,
        };
      case "STABILITY":
        return {
          maxExecutionTime: 30000, // 30 seconds
          hints: [{ type: "JOIN_FIXED_ORDER" }],
        };
      default:
        return {};
    }
  }
}

export default QueryOptimizer;
