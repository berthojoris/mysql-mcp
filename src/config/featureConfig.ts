import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/**
 * Available MCP tool categories (Legacy - for backward compatibility)
 */
export enum ToolCategory {
  LIST = "list", // List databases, tables, etc.
  READ = "read", // Read/select data from tables
  CREATE = "create", // Insert new records
  UPDATE = "update", // Update existing records
  DELETE = "delete", // Delete records
  EXECUTE = "execute", // Execute custom SQL
  DDL = "ddl", // Data Definition Language (CREATE/ALTER/DROP tables)
  UTILITY = "utility", // Utility functions like connection testing
  TRANSACTION = "transaction", // Transaction management (BEGIN, COMMIT, ROLLBACK)
  PROCEDURE = "procedure", // Stored procedure operations (CREATE, EXECUTE, DROP procedures)
}

/**
 * Documentation categories from README
 * More intuitive and matches user mental model
 */
export enum DocCategory {
  DATABASE_DISCOVERY = "database_discovery",
  CRUD_OPERATIONS = "crud_operations",
  BULK_OPERATIONS = "bulk_operations",
  CUSTOM_QUERIES = "custom_queries",
  SCHEMA_MANAGEMENT = "schema_management",
  UTILITIES = "utilities",
  TRANSACTION_MANAGEMENT = "transaction_management",
  STORED_PROCEDURES = "stored_procedures",
  VIEWS_MANAGEMENT = "views_management",
  TRIGGERS_MANAGEMENT = "triggers_management",
  INDEX_MANAGEMENT = "index_management",
  CONSTRAINT_MANAGEMENT = "constraint_management",
  TABLE_MAINTENANCE = "table_maintenance",
  QUERY_OPTIMIZATION = "query_optimization",
  ANALYSIS = "analysis",
  SEED_OPERATIONS = "seed_operations",
}

/**
 * Map of tool names to their legacy categories
 */
export const toolCategoryMap: Record<string, ToolCategory> = {
  // Database tools
  listDatabases: ToolCategory.LIST,
  listTables: ToolCategory.LIST,
  readTableSchema: ToolCategory.LIST,
  listAllTools: ToolCategory.UTILITY,
  list_all_tools: ToolCategory.UTILITY,
  // Analysis tools (added here to group with database tools)
  getDatabaseSummary: ToolCategory.LIST,
  getSchemaERD: ToolCategory.LIST,
  getSchemaErd: ToolCategory.LIST,
  get_schema_erd: ToolCategory.LIST,
  getSchemaRagContext: ToolCategory.LIST,
  findTablesByKeyword: ToolCategory.LIST,
  find_tables_by_keyword: ToolCategory.LIST,
  searchSchema: ToolCategory.LIST,
  search_schema: ToolCategory.LIST,
  searchSchemaWithSampleData: ToolCategory.READ,
  searchDataAcrossTables: ToolCategory.READ,
  search_data_across_tables: ToolCategory.READ,

  // CRUD tools
  createRecord: ToolCategory.CREATE,
  readRecords: ToolCategory.READ,
  updateRecord: ToolCategory.UPDATE,
  deleteRecord: ToolCategory.DELETE,
  // Analysis tools (added here to group with read tools)
  getColumnStatistics: ToolCategory.READ,

  // Bulk operations
  bulkInsert: ToolCategory.CREATE,
  bulkUpdate: ToolCategory.UPDATE,
  bulkDelete: ToolCategory.DELETE,

  // Seed operations
  planSeedData: ToolCategory.LIST,
  plan_seed_data: ToolCategory.LIST,
  generateSeedPreview: ToolCategory.READ,
  generate_seed_preview: ToolCategory.READ,
  executeSeedPlan: ToolCategory.CREATE,
  execute_seed_plan: ToolCategory.CREATE,
  validateSeedIntegrity: ToolCategory.READ,
  validate_seed_integrity: ToolCategory.READ,
  inferSeedRules: ToolCategory.READ,
  infer_seed_rules: ToolCategory.READ,
  seedFromTemplate: ToolCategory.LIST,
  seed_from_template: ToolCategory.LIST,

  // Query tools
  runSelectQuery: ToolCategory.READ,
  executeWriteQuery: ToolCategory.EXECUTE,

  // DDL tools
  createTable: ToolCategory.DDL,
  alterTable: ToolCategory.DDL,
  dropTable: ToolCategory.DDL,
  executeDdl: ToolCategory.DDL,

  // Utility tools
  describeConnection: ToolCategory.UTILITY,
  cursorExecuteRequest: ToolCategory.UTILITY,
  cursor_execute_request: ToolCategory.UTILITY,
  testConnection: ToolCategory.UTILITY,
  getAllTablesRelationships: ToolCategory.UTILITY,
  exportTableToCSV: ToolCategory.UTILITY,
  exportTableToCsv: ToolCategory.UTILITY,
  export_table_to_csv: ToolCategory.UTILITY,
  exportQueryToCSV: ToolCategory.UTILITY,
  exportQueryToCsv: ToolCategory.UTILITY,
  export_query_to_csv: ToolCategory.UTILITY,
  read_changelog: ToolCategory.UTILITY,

  // Transaction tools
  beginTransaction: ToolCategory.TRANSACTION,
  commitTransaction: ToolCategory.TRANSACTION,
  rollbackTransaction: ToolCategory.TRANSACTION,
  getTransactionStatus: ToolCategory.TRANSACTION,
  executeInTransaction: ToolCategory.TRANSACTION,

  // Stored procedure tools
  listStoredProcedures: ToolCategory.LIST,
  getStoredProcedureInfo: ToolCategory.LIST,
  executeStoredProcedure: ToolCategory.PROCEDURE,
  createStoredProcedure: ToolCategory.PROCEDURE,
  dropStoredProcedure: ToolCategory.PROCEDURE,
  showCreateProcedure: ToolCategory.LIST,

  // View tools
  listViews: ToolCategory.LIST,
  getViewInfo: ToolCategory.LIST,
  createView: ToolCategory.DDL,
  alterView: ToolCategory.DDL,
  dropView: ToolCategory.DDL,
  showCreateView: ToolCategory.LIST,

  // Trigger tools
  listTriggers: ToolCategory.LIST,
  getTriggerInfo: ToolCategory.LIST,
  createTrigger: ToolCategory.DDL,
  dropTrigger: ToolCategory.DDL,
  showCreateTrigger: ToolCategory.LIST,

  // Index tools
  listIndexes: ToolCategory.LIST,
  getIndexInfo: ToolCategory.LIST,
  createIndex: ToolCategory.DDL,
  dropIndex: ToolCategory.DDL,
  analyzeIndex: ToolCategory.UTILITY,

  // Constraint tools
  listForeignKeys: ToolCategory.LIST,
  listConstraints: ToolCategory.LIST,
  addForeignKey: ToolCategory.DDL,
  dropForeignKey: ToolCategory.DDL,
  addUniqueConstraint: ToolCategory.DDL,
  dropConstraint: ToolCategory.DDL,
  addCheckConstraint: ToolCategory.DDL,

  // Table maintenance tools
  analyzeTable: ToolCategory.UTILITY,
  optimizeTable: ToolCategory.UTILITY,
  checkTable: ToolCategory.UTILITY,
  repairTable: ToolCategory.UTILITY,
  truncateTable: ToolCategory.DDL,
  getTableStatus: ToolCategory.LIST,
  flushTable: ToolCategory.UTILITY,
  getTableSize: ToolCategory.LIST,

  // Query optimization tools
  analyzeQuery: ToolCategory.UTILITY,
  analyze_query: ToolCategory.UTILITY,
  getOptimizationHints: ToolCategory.UTILITY,
  get_optimization_hints: ToolCategory.UTILITY,
  repairQuery: ToolCategory.UTILITY,
  repair_query: ToolCategory.UTILITY,

  // Full-Text Search Tools
  createFulltextIndex: ToolCategory.DDL,
  fulltextSearch: ToolCategory.READ,
  getFulltextInfo: ToolCategory.LIST,
  dropFulltextIndex: ToolCategory.DDL,
  getFulltextStats: ToolCategory.LIST,
  optimizeFulltext: ToolCategory.UTILITY,
};

const toolAdditionalPermissions: Record<string, ToolCategory[]> = {
  exportTableToCSV: [ToolCategory.READ],
  exportTableToCsv: [ToolCategory.READ],
  export_table_to_csv: [ToolCategory.READ],
  exportQueryToCSV: [ToolCategory.READ],
  exportQueryToCsv: [ToolCategory.READ],
  export_query_to_csv: [ToolCategory.READ],
};

/**
 * Map of tool names to their documentation categories (New Enhanced System)
 */
export const toolDocCategoryMap: Record<string, DocCategory> = {
  // Database Discovery
  listDatabases: DocCategory.DATABASE_DISCOVERY,
  listTables: DocCategory.DATABASE_DISCOVERY,
  readTableSchema: DocCategory.DATABASE_DISCOVERY,
  getAllTablesRelationships: DocCategory.DATABASE_DISCOVERY,

  // CRUD Operations
  createRecord: DocCategory.CRUD_OPERATIONS,
  readRecords: DocCategory.CRUD_OPERATIONS,
  updateRecord: DocCategory.CRUD_OPERATIONS,
  deleteRecord: DocCategory.CRUD_OPERATIONS,

  // Bulk Operations
  bulkInsert: DocCategory.BULK_OPERATIONS,
  bulkUpdate: DocCategory.BULK_OPERATIONS,
  bulkDelete: DocCategory.BULK_OPERATIONS,

  // Seed Operations
  planSeedData: DocCategory.SEED_OPERATIONS,
  plan_seed_data: DocCategory.SEED_OPERATIONS,
  generateSeedPreview: DocCategory.SEED_OPERATIONS,
  generate_seed_preview: DocCategory.SEED_OPERATIONS,
  executeSeedPlan: DocCategory.SEED_OPERATIONS,
  execute_seed_plan: DocCategory.SEED_OPERATIONS,
  validateSeedIntegrity: DocCategory.SEED_OPERATIONS,
  validate_seed_integrity: DocCategory.SEED_OPERATIONS,
  inferSeedRules: DocCategory.SEED_OPERATIONS,
  infer_seed_rules: DocCategory.SEED_OPERATIONS,
  seedFromTemplate: DocCategory.SEED_OPERATIONS,
  seed_from_template: DocCategory.SEED_OPERATIONS,

  // Custom Queries
  runSelectQuery: DocCategory.CUSTOM_QUERIES,
  executeWriteQuery: DocCategory.CUSTOM_QUERIES,

  // Schema Management (DDL)
  createTable: DocCategory.SCHEMA_MANAGEMENT,
  alterTable: DocCategory.SCHEMA_MANAGEMENT,
  dropTable: DocCategory.SCHEMA_MANAGEMENT,
  executeDdl: DocCategory.SCHEMA_MANAGEMENT,

  // Utilities
  testConnection: DocCategory.UTILITIES,
  describeConnection: DocCategory.UTILITIES,
  cursorExecuteRequest: DocCategory.UTILITIES,
  cursor_execute_request: DocCategory.UTILITIES,
  exportTableToCSV: DocCategory.UTILITIES,
  exportTableToCsv: DocCategory.UTILITIES,
  export_table_to_csv: DocCategory.UTILITIES,
  exportQueryToCSV: DocCategory.UTILITIES,
  exportQueryToCsv: DocCategory.UTILITIES,
  export_query_to_csv: DocCategory.UTILITIES,
  read_changelog: DocCategory.UTILITIES,
  listAllTools: DocCategory.UTILITIES,
  list_all_tools: DocCategory.UTILITIES,

  // Transaction Management
  beginTransaction: DocCategory.TRANSACTION_MANAGEMENT,
  commitTransaction: DocCategory.TRANSACTION_MANAGEMENT,
  rollbackTransaction: DocCategory.TRANSACTION_MANAGEMENT,
  getTransactionStatus: DocCategory.TRANSACTION_MANAGEMENT,
  executeInTransaction: DocCategory.TRANSACTION_MANAGEMENT,

  // Stored Procedures
  listStoredProcedures: DocCategory.STORED_PROCEDURES,
  getStoredProcedureInfo: DocCategory.STORED_PROCEDURES,
  executeStoredProcedure: DocCategory.STORED_PROCEDURES,
  createStoredProcedure: DocCategory.STORED_PROCEDURES,
  dropStoredProcedure: DocCategory.STORED_PROCEDURES,
  showCreateProcedure: DocCategory.STORED_PROCEDURES,

  // Views Management
  listViews: DocCategory.VIEWS_MANAGEMENT,
  getViewInfo: DocCategory.VIEWS_MANAGEMENT,
  createView: DocCategory.VIEWS_MANAGEMENT,
  alterView: DocCategory.VIEWS_MANAGEMENT,
  dropView: DocCategory.VIEWS_MANAGEMENT,
  showCreateView: DocCategory.VIEWS_MANAGEMENT,

  // Triggers Management
  listTriggers: DocCategory.TRIGGERS_MANAGEMENT,
  getTriggerInfo: DocCategory.TRIGGERS_MANAGEMENT,
  createTrigger: DocCategory.TRIGGERS_MANAGEMENT,
  dropTrigger: DocCategory.TRIGGERS_MANAGEMENT,
  showCreateTrigger: DocCategory.TRIGGERS_MANAGEMENT,

  // Index Management
  listIndexes: DocCategory.INDEX_MANAGEMENT,
  getIndexInfo: DocCategory.INDEX_MANAGEMENT,
  createIndex: DocCategory.INDEX_MANAGEMENT,
  dropIndex: DocCategory.INDEX_MANAGEMENT,
  analyzeIndex: DocCategory.INDEX_MANAGEMENT,

  // Constraint Management
  listForeignKeys: DocCategory.CONSTRAINT_MANAGEMENT,
  listConstraints: DocCategory.CONSTRAINT_MANAGEMENT,
  addForeignKey: DocCategory.CONSTRAINT_MANAGEMENT,
  dropForeignKey: DocCategory.CONSTRAINT_MANAGEMENT,
  addUniqueConstraint: DocCategory.CONSTRAINT_MANAGEMENT,
  dropConstraint: DocCategory.CONSTRAINT_MANAGEMENT,
  addCheckConstraint: DocCategory.CONSTRAINT_MANAGEMENT,

  // Table Maintenance
  analyzeTable: DocCategory.TABLE_MAINTENANCE,
  optimizeTable: DocCategory.TABLE_MAINTENANCE,
  checkTable: DocCategory.TABLE_MAINTENANCE,
  repairTable: DocCategory.TABLE_MAINTENANCE,
  truncateTable: DocCategory.TABLE_MAINTENANCE,
  getTableStatus: DocCategory.TABLE_MAINTENANCE,
  flushTable: DocCategory.TABLE_MAINTENANCE,
  getTableSize: DocCategory.TABLE_MAINTENANCE,

  // Query Optimization
  analyzeQuery: DocCategory.QUERY_OPTIMIZATION,
  analyze_query: DocCategory.QUERY_OPTIMIZATION,
  getOptimizationHints: DocCategory.QUERY_OPTIMIZATION,
  get_optimization_hints: DocCategory.QUERY_OPTIMIZATION,
  repairQuery: DocCategory.QUERY_OPTIMIZATION,
  repair_query: DocCategory.QUERY_OPTIMIZATION,

  // Analysis
  getDatabaseSummary: DocCategory.ANALYSIS,
  getSchemaERD: DocCategory.ANALYSIS,
  getSchemaErd: DocCategory.ANALYSIS,
  get_schema_erd: DocCategory.ANALYSIS,
  getColumnStatistics: DocCategory.ANALYSIS,
  getSchemaRagContext: DocCategory.ANALYSIS,
  findTablesByKeyword: DocCategory.ANALYSIS,
  find_tables_by_keyword: DocCategory.ANALYSIS,
  searchSchema: DocCategory.ANALYSIS,
  search_schema: DocCategory.ANALYSIS,
  searchSchemaWithSampleData: DocCategory.ANALYSIS,
  searchDataAcrossTables: DocCategory.ANALYSIS,
  search_data_across_tables: DocCategory.ANALYSIS,

  // Full-Text Search
  createFulltextIndex: DocCategory.INDEX_MANAGEMENT,
  fulltextSearch: DocCategory.INDEX_MANAGEMENT,
  getFulltextInfo: DocCategory.INDEX_MANAGEMENT,
  dropFulltextIndex: DocCategory.INDEX_MANAGEMENT,
  getFulltextStats: DocCategory.INDEX_MANAGEMENT,
  optimizeFulltext: DocCategory.INDEX_MANAGEMENT,
};

/**
 * Mapping between legacy categories and documentation categories
 * This allows backward compatibility
 */
const legacyToDocCategoryMap: Record<string, DocCategory[]> = {
  list: [
    DocCategory.DATABASE_DISCOVERY,
    DocCategory.STORED_PROCEDURES,
    DocCategory.VIEWS_MANAGEMENT,
    DocCategory.TRIGGERS_MANAGEMENT,
    DocCategory.INDEX_MANAGEMENT,
    DocCategory.CONSTRAINT_MANAGEMENT,
    DocCategory.TABLE_MAINTENANCE,
    DocCategory.ANALYSIS,
    DocCategory.UTILITIES,
    DocCategory.SEED_OPERATIONS,
  ],
  read: [DocCategory.CRUD_OPERATIONS, DocCategory.CUSTOM_QUERIES, DocCategory.ANALYSIS, DocCategory.SEED_OPERATIONS],
  create: [
    DocCategory.CRUD_OPERATIONS,
    DocCategory.BULK_OPERATIONS,
    DocCategory.SEED_OPERATIONS,
  ],
  update: [
    DocCategory.CRUD_OPERATIONS,
    DocCategory.BULK_OPERATIONS,
  ],
  delete: [
    DocCategory.CRUD_OPERATIONS,
    DocCategory.BULK_OPERATIONS,
  ],
  execute: [DocCategory.CUSTOM_QUERIES],
  ddl: [
    DocCategory.SCHEMA_MANAGEMENT,
    DocCategory.VIEWS_MANAGEMENT,
    DocCategory.TRIGGERS_MANAGEMENT,
    DocCategory.INDEX_MANAGEMENT,
    DocCategory.CONSTRAINT_MANAGEMENT,
    DocCategory.TABLE_MAINTENANCE,
  ],
  utility: [
    DocCategory.UTILITIES,
    DocCategory.TABLE_MAINTENANCE,
    DocCategory.QUERY_OPTIMIZATION,
  ],
  transaction: [DocCategory.TRANSACTION_MANAGEMENT, DocCategory.SEED_OPERATIONS],
  procedure: [DocCategory.STORED_PROCEDURES],
};

/**
 * Permissions used when neither permissions nor categories are configured.
 * Read-only by default; write and schema access must be granted explicitly.
 */
export const DEFAULT_PERMISSIONS = "list,read,utility";

/**
 * Class to manage feature configuration based on runtime or environment variables
 * Supports dual-layer filtering:
 * - Layer 1 (Permissions): Legacy categories (broad control)
 * - Layer 2 (Categories): Documentation categories (fine-grained control, optional)
 */
export class FeatureConfig {
  private enabledLegacyCategories: Set<ToolCategory>;
  private enabledDocCategories: Set<DocCategory>;

  private originalPermissionsString: string;
  private originalCategoriesString: string;
  private useDualLayer: boolean; // Flag to determine if using dual-layer filtering

  constructor(permissionsStr?: string, categoriesStr?: string) {
    // Support both old single-parameter and new dual-parameter signatures
    const permissionsInput =
      permissionsStr ||
      process.env.MCP_PERMISSIONS ||
      process.env.MCP_CONFIG ||
      "";
    const categoriesInput = categoriesStr || process.env.MCP_CATEGORIES || "";

    const mergedPermissions = this.mergeConfigStrings("", permissionsInput);
    const mergedCategories = this.mergeConfigStrings("", categoriesInput);

    this.originalPermissionsString = mergedPermissions;
    this.originalCategoriesString = mergedCategories;
    this.useDualLayer = !!mergedCategories.trim();

    const parsed = this.parseConfig(mergedPermissions, mergedCategories);
    this.enabledLegacyCategories = parsed.legacy;
    this.enabledDocCategories = parsed.doc;
  }

  /**
   * Normalize and merge preset + user-supplied configuration lists
   */
  private mergeConfigStrings(base: string, override: string): string {
    const items = [...(base || "").split(","), ...(override || "").split(",")]
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);
    return Array.from(new Set(items)).join(",");
  }

  /**
   * Parse permissions and categories for dual-layer filtering
   * Layer 1 (permissions): Broad control using legacy categories
   * Layer 2 (categories): Fine-grained control using documentation categories (optional)
   */
  private parseConfig(
    permissionsStr: string,
    categoriesStr: string,
  ): {
    legacy: Set<ToolCategory>;
    doc: Set<DocCategory>;
  } {
    // If both are empty, fall back to the read-only default permissions
    if (!permissionsStr.trim() && !categoriesStr.trim()) {
      permissionsStr = DEFAULT_PERMISSIONS;
    }

    // Parse Layer 1: Permissions (legacy categories)
    let legacySet = new Set<ToolCategory>();
    if (permissionsStr.trim()) {
      const items = permissionsStr
        .split(",")
        .map((c) => c.trim().toLowerCase());
      const validLegacyCategories = items.filter((c) =>
        Object.values(ToolCategory).includes(c as ToolCategory),
      ) as ToolCategory[];
      legacySet = new Set(validLegacyCategories);
    } else {
      // If no permissions specified but categories are, allow all permissions
      legacySet = new Set(Object.values(ToolCategory));
    }

    // Parse Layer 2: Categories (documentation categories)
    let docSet = new Set<DocCategory>();
    if (categoriesStr.trim()) {
      // Categories specified - use them for fine-grained filtering
      const items = categoriesStr.split(",").map((c) => c.trim().toLowerCase());
      const validDocCategories = items.filter((c) =>
        Object.values(DocCategory).includes(c as DocCategory),
      ) as DocCategory[];
      docSet = new Set(validDocCategories);
    } else {
      // No categories specified - derive from permissions
      legacySet.forEach((legacyCat) => {
        const docCats = legacyToDocCategoryMap[legacyCat] || [];
        docCats.forEach((dc) => docSet.add(dc));
      });
    }

    return {
      legacy: legacySet,
      doc: docSet,
    };
  }

  /**
   * Update configuration at runtime
   */
  setConfig(
    permissionsStr: string,
    categoriesStr?: string,
  ): void {
    const mergedPermissions = this.mergeConfigStrings("", permissionsStr);
    const mergedCategories = this.mergeConfigStrings("", categoriesStr || "");

    this.originalPermissionsString = mergedPermissions;
    this.originalCategoriesString = mergedCategories;
    this.useDualLayer = !!(mergedCategories && mergedCategories.trim());
    const parsed = this.parseConfig(mergedPermissions, mergedCategories || "");
    this.enabledLegacyCategories = parsed.legacy;
    this.enabledDocCategories = parsed.doc;
  }

  /**
   * Check if a specific tool is enabled
   * Dual-layer logic:
   * - Layer 1 (Permission): Tool must be allowed by its legacy category
   * - Layer 2 (Category): If categories specified, tool must also be in allowed doc category
   */
  isToolEnabled(toolName: string): boolean {
    const docCategory = toolDocCategoryMap[toolName];
    const legacyCategory = toolCategoryMap[toolName];

    // If tool is not in either map, default to disabled
    if (!docCategory && !legacyCategory) {
      console.warn(`Unknown tool: ${toolName}`);
      return false;
    }

    // Layer 1: Check permission (legacy category)
    const hasPermission = legacyCategory
      ? this.enabledLegacyCategories.has(legacyCategory)
      : false;

    if (!hasPermission) {
      return false;
    }

    if (!(toolAdditionalPermissions[toolName] || []).every(
      (permission) => this.enabledLegacyCategories.has(permission),
    )) {
      return false;
    }

    // Layer 2: Check category (documentation category) if dual-layer mode
    if (this.useDualLayer) {
      const hasCategory = docCategory
        ? this.enabledDocCategories.has(docCategory)
        : false;
      return hasCategory;
    }

    // Single-layer mode: permission is sufficient
    return true;
  }

  /**
   * Get detailed permission error message for a specific tool
   */
  getPermissionError(toolName: string): string {
    const docCategory = toolDocCategoryMap[toolName];
    const legacyCategory = toolCategoryMap[toolName];

    if (!docCategory && !legacyCategory) {
      return `Unknown tool '${toolName}'. This tool is not recognized by the MCP server.`;
    }

    const missingPermission = (toolAdditionalPermissions[toolName] || []).find(
      (permission) => !this.enabledLegacyCategories.has(permission),
    );
    if (legacyCategory && this.enabledLegacyCategories.has(legacyCategory) && missingPermission) {
      return (
        `Permission denied: This tool also requires '${missingPermission}' permission (Layer 1). ` +
        `Add '${missingPermission}' to the permissions argument.`
      );
    }

    // Build error message based on dual-layer or single-layer mode
    if (this.useDualLayer) {
      const hasPermission = legacyCategory
        ? this.enabledLegacyCategories.has(legacyCategory)
        : false;
      const hasCategory = docCategory
        ? this.enabledDocCategories.has(docCategory)
        : false;

      if (!hasPermission) {
        return (
          `Permission denied: This tool requires '${legacyCategory}' permission (Layer 1). ` +
          `Your current permissions: ${this.originalPermissionsString || "none"}. ` +
          `Add '${legacyCategory}' to the permissions argument.`
        );
      }

      if (!hasCategory) {
        return (
          `Permission denied: This tool requires '${docCategory}' category (Layer 2). ` +
          `Your current categories: ${this.originalCategoriesString || "none"}. ` +
          `Add '${docCategory}' to the categories argument.`
        );
      }
    } else {
      // Single-layer mode
      return (
        `Permission denied: This tool requires '${legacyCategory}' permission. ` +
        `Your current configuration allows: ${this.originalPermissionsString || "all"}. ` +
        `Add '${legacyCategory}' to enable this tool.`
      );
    }

    return `Permission denied for tool '${toolName}'.`;
  }

  /**
   * Check if a legacy category is enabled
   */
  isCategoryEnabled(category: ToolCategory): boolean {
    return this.enabledLegacyCategories.has(category);
  }

  /**
   * Check if a documentation category is enabled
   */
  isDocCategoryEnabled(category: DocCategory): boolean {
    return this.enabledDocCategories.has(category);
  }

  /**
   * Get all enabled legacy categories
   */
  getEnabledCategories(): ToolCategory[] {
    return Array.from(this.enabledLegacyCategories);
  }

  /**
   * Get all enabled documentation categories
   */
  getEnabledDocCategories(): DocCategory[] {
    return Array.from(this.enabledDocCategories);
  }

  /**
   * Get all available categories with their status
   */
  getCategoryStatus(): Record<ToolCategory, boolean> {
    const result = {} as Record<ToolCategory, boolean>;

    for (const category of Object.values(ToolCategory)) {
      result[category] = this.enabledLegacyCategories.has(category);
    }

    return result;
  }

  /**
   * Get all available documentation categories with their status
   */
  getDocCategoryStatus(): Record<DocCategory, boolean> {
    const result = {} as Record<DocCategory, boolean>;

    for (const category of Object.values(DocCategory)) {
      result[category] = this.enabledDocCategories.has(category);
    }

    return result;
  }

  /**
   * Check if using dual-layer filtering mode
   */
  isUsingDualLayer(): boolean {
    return this.useDualLayer;
  }

  /**
   * Snapshot of the resolved configuration for logging/telemetry
   */
  getConfigSnapshot(): {
    permissions: string;
    categories: string;
    filteringMode: string;
    enabledLegacy: ToolCategory[];
    enabledDoc: DocCategory[];
  } {
    return {
      permissions:
        this.originalPermissionsString ||
        (this.originalCategoriesString ? "all" : DEFAULT_PERMISSIONS),
      categories:
        this.originalCategoriesString ||
        (this.useDualLayer ? "" : "derived from permissions"),
      filteringMode: this.getFilteringMode(),
      enabledLegacy: this.getEnabledCategories(),
      enabledDoc: this.getEnabledDocCategories(),
    };
  }

  /**
   * Get filtering mode description
   */
  getFilteringMode(): string {
    if (
      !this.originalPermissionsString.trim() &&
      !this.originalCategoriesString.trim()
    ) {
      return `Default read-only (${DEFAULT_PERMISSIONS})`;
    }
    if (this.useDualLayer) {
      return "Dual-layer (Permissions + Categories)";
    }
    return "Single-layer (Permissions only)";
  }
}

// Export singleton instance
export const featureConfig = new FeatureConfig();
