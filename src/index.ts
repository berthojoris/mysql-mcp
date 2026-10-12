import { DatabaseTools } from "./tools/databaseTools";
import { CrudTools } from "./tools/crudTools";
import { QueryTools } from "./tools/queryTools";
import { UtilityTools } from "./tools/utilityTools";
import { DdlTools } from "./tools/ddlTools";
import { TransactionTools } from "./tools/transactionTools";
import { StoredProcedureTools } from "./tools/storedProcedureTools";
import { DataExportTools } from "./tools/dataExportTools";
import { ViewTools } from "./tools/viewTools";
import { TriggerTools } from "./tools/triggerTools";
import { IndexTools } from "./tools/indexTools";
import { ConstraintTools } from "./tools/constraintTools";
import { MaintenanceTools } from "./tools/maintenanceTools";
import { AnalysisTools } from "./tools/analysisTools";
import { AiTools } from "./tools/aiTools";
import { MacroTools } from "./tools/macroTools";
import { SmartQueryBuilderTools } from "./tools/smartQueryBuilderTools";
import { FulltextSearchTools } from "./tools/fulltextSearchTools";
import { RelationalSeederTools } from "./tools/relationalSeederTools";
import SecurityLayer from "./security/securityLayer";
import DatabaseConnection from "./db/connection";
import { FeatureConfig } from "./config/featureConfig";

/**
 * MySQL Model Context Protocol (MCP)
 * A secure interface for AI models to interact with MySQL databases
 */
export class MySQLMCP {
  private dbTools: DatabaseTools;
  private crudTools: CrudTools;
  private queryTools: QueryTools;
  private utilityTools: UtilityTools;
  private ddlTools: DdlTools;
  private transactionTools: TransactionTools;
  private storedProcedureTools: StoredProcedureTools;
  private dataExportTools: DataExportTools;
  private viewTools: ViewTools;
  private triggerTools: TriggerTools;
  private indexTools: IndexTools;
  private constraintTools: ConstraintTools;
  private maintenanceTools: MaintenanceTools;
  private analysisTools: AnalysisTools;
  private aiTools: AiTools;
  private macroTools: MacroTools;
  private smartQueryBuilderTools: SmartQueryBuilderTools;
  private fulltextSearchTools: FulltextSearchTools;
  private relationalSeederTools: RelationalSeederTools;
  private security: SecurityLayer;
  private featureConfig: FeatureConfig;

  constructor(permissionsConfig?: string, categoriesConfig?: string) {
    this.featureConfig = new FeatureConfig(permissionsConfig, categoriesConfig);
    this.security = new SecurityLayer(this.featureConfig);
    this.dbTools = new DatabaseTools();
    this.crudTools = new CrudTools(this.security);
    this.queryTools = new QueryTools(this.security);
    this.utilityTools = new UtilityTools();
    this.ddlTools = new DdlTools(this.security);
    this.transactionTools = new TransactionTools(this.security);
    this.storedProcedureTools = new StoredProcedureTools(this.security);
    this.dataExportTools = new DataExportTools(this.security);
    this.viewTools = new ViewTools(this.security);
    this.triggerTools = new TriggerTools(this.security);
    this.indexTools = new IndexTools(this.security);
    this.constraintTools = new ConstraintTools(this.security);
    this.maintenanceTools = new MaintenanceTools(this.security);
    this.analysisTools = new AnalysisTools(this.security);
    this.aiTools = new AiTools(this.security);
    this.macroTools = new MacroTools(this.security);
    this.smartQueryBuilderTools = new SmartQueryBuilderTools(this.security);
    this.fulltextSearchTools = new FulltextSearchTools(this.security);
    this.relationalSeederTools = new RelationalSeederTools(this.security);
  }

  // Helper method to check if tool is enabled
  private checkToolEnabled(toolName: string): {
    enabled: boolean;
    error?: string;
  } {
    if (!this.featureConfig.isToolEnabled(toolName)) {
      return {
        enabled: false,
        error: this.featureConfig.getPermissionError(toolName),
      };
    }
    return { enabled: true };
  }

  // Database Tools
  async listDatabases() {
    const check = this.checkToolEnabled("listDatabases");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dbTools.listDatabases();
  }

  async listTables(params: { database?: string }) {
    const check = this.checkToolEnabled("listTables");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dbTools.listTables(params);
  }

  async readTableSchema(params: { table_name: string }) {
    const check = this.checkToolEnabled("readTableSchema");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dbTools.readTableSchema(params);
  }

  async getDatabaseSummary(params: { 
    database?: string;
    max_tables?: number;
    include_relationships?: boolean;
  }) {
    const check = this.checkToolEnabled("getDatabaseSummary");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dbTools.getDatabaseSummary(params);
  }

  async getSchemaERD(params: { database?: string }) {
    const check = this.checkToolEnabled("getSchemaERD");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dbTools.getSchemaERD(params);
  }

  // CRUD Tools
  async createRecord(params: {
    table_name: string;
    data: Record<string, any>;
  }) {
    const check = this.checkToolEnabled("createRecord");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.crudTools.createRecord(params);
  }

  async readRecords(params: {
    table_name: string;
    filters?: any[];
    pagination?: { page: number; limit: number };
    sorting?: { field: string; direction: "asc" | "desc" };
  }) {
    const check = this.checkToolEnabled("readRecords");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.crudTools.readRecords(params);
  }

  async updateRecord(params: {
    table_name: string;
    data: Record<string, any>;
    conditions: any[];
  }) {
    const check = this.checkToolEnabled("updateRecord");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.crudTools.updateRecord(params);
  }

  async deleteRecord(params: { table_name: string; conditions: any[] }) {
    const check = this.checkToolEnabled("deleteRecord");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.crudTools.deleteRecord(params);
  }

  // Query Tools
  async runSelectQuery(params: {
    query: string;
    params?: any[];
    hints?: any;
    useCache?: boolean;
    dry_run?: boolean;
  }) {
    const check = this.checkToolEnabled("runSelectQuery");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }

    // Additional security check
    if (!this.security.isReadOnlyQuery(params.query, this.security.hasExecutePermission())) {
      return {
        status: "error",
        error:
          "Only SELECT queries are allowed with run_select_query. Use execute_write_query for other operations.",
      };
    }
    return await this.queryTools.runSelectQuery(params);
  }

  async executeWriteQuery(params: { query: string; params?: any[] }) {
    const check = this.checkToolEnabled("executeWriteQuery");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }

    return await this.queryTools.executeWriteQuery(params);
  }

  // Analysis Tools
  async getColumnStatistics(params: {
    table_name: string;
    column_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getColumnStatistics");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.analysisTools.getColumnStatistics(params);
  }

  async findTablesByKeyword(params: {
    keyword: string;
    search_in?: "table_names" | "column_names" | "comments" | "all";
    database?: string;
    limit?: number;
  }) {
    const check = this.checkToolEnabled("findTablesByKeyword");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.analysisTools.findTablesByKeyword(params);
  }

  async searchSchema(params: {
    query: string;
    modes?: Array<"table_names" | "column_names" | "comments" | "sample_data">;
    max_results?: number;
    database?: string;
    tables?: string[];
    columns?: string[];
    max_tables?: number;
    limit_per_table?: number;
  }) {
    const check = this.checkToolEnabled("searchSchema");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    if (params?.modes?.includes("sample_data")) {
      const readCheck = this.checkToolEnabled("searchSchemaWithSampleData");
      if (!readCheck.enabled) {
        return { status: "error", error: readCheck.error };
      }
    }
    return await this.analysisTools.searchSchema(params);
  }

  async searchDataAcrossTables(params: {
    keyword: string;
    tables?: string[];
    columns?: string[];
    database?: string;
    limit_per_table?: number;
    max_tables?: number;
  }) {
    const check = this.checkToolEnabled("searchDataAcrossTables");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.analysisTools.searchDataAcrossTables(params);
  }

  async getSchemaRagContext(params: {
    database?: string;
    max_tables?: number;
    max_columns?: number;
    include_relationships?: boolean;
    include_comments?: boolean;
    keyword_filter?: string;
  }) {
    const check = this.checkToolEnabled("getSchemaRagContext");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.analysisTools.getSchemaRagContext(params);
  }

  // DDL Tools
  async createTable(params: any) {
    const check = this.checkToolEnabled("createTable");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.ddlTools.createTable(params);
  }

  async alterTable(params: any) {
    const check = this.checkToolEnabled("alterTable");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.ddlTools.alterTable(params);
  }

  async dropTable(params: any) {
    const check = this.checkToolEnabled("dropTable");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.ddlTools.dropTable(params);
  }

  async executeDdl(params: { query: string }) {
    const check = this.checkToolEnabled("executeDdl");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.ddlTools.executeDdl(params);
  }

  // Utility Tools
  async describeConnection() {
    const check = this.checkToolEnabled("describeConnection");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.describeConnection();
  }

  async testConnection() {
    const check = this.checkToolEnabled("testConnection");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.testConnection();
  }

  async getTableRelationships(params: { table_name: string }) {
    const check = this.checkToolEnabled("getTableRelationships");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.getTableRelationships(params);
  }

  async getAllTablesRelationships(params?: { database?: string }) {
    const check = this.checkToolEnabled("getAllTablesRelationships");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.getAllTablesRelationships(params);
  }

  async readChangelog(params?: { version?: string; limit?: number }) {
    const check = this.checkToolEnabled("read_changelog");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.readChangelog(params);
  }

  async listAllTools(params?: {
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema?: any;
      input_schema?: any;
      output_schema?: any;
    }>;
    enabledToolNames?: string[];
    accessProfile?: any;
    serverName?: string;
    serverVersion?: string;
  }) {
    const check = this.checkToolEnabled("list_all_tools");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.utilityTools.listAllTools(params);
  }

  // Transaction Tools
  async beginTransaction(params?: { transactionId?: string }) {
    const check = this.checkToolEnabled("beginTransaction");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.transactionTools.beginTransaction(params);
  }

  async commitTransaction(params: { transactionId: string }) {
    const check = this.checkToolEnabled("commitTransaction");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.transactionTools.commitTransaction(params);
  }

  async rollbackTransaction(params: { transactionId: string }) {
    const check = this.checkToolEnabled("rollbackTransaction");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.transactionTools.rollbackTransaction(params);
  }

  async getTransactionStatus() {
    const check = this.checkToolEnabled("getTransactionStatus");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.transactionTools.getTransactionStatus();
  }

  async executeInTransaction(params: {
    transactionId: string;
    query: string;
    params?: any[];
  }) {
    const check = this.checkToolEnabled("executeInTransaction");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.transactionTools.executeInTransaction(params);
  }

  // Stored Procedure Tools
  async listStoredProcedures(params: { database?: string }) {
    const check = this.checkToolEnabled("listStoredProcedures");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.listStoredProcedures(params);
  }

  async getStoredProcedureInfo(params: {
    procedure_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getStoredProcedureInfo");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.getStoredProcedureInfo(params);
  }

  async executeStoredProcedure(params: {
    procedure_name: string;
    parameters?: any[];
    database?: string;
  }) {
    const check = this.checkToolEnabled("executeStoredProcedure");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.executeStoredProcedure(params);
  }

  async createStoredProcedure(params: {
    procedure_name: string;
    parameters?: Array<{
      name: string;
      mode: "IN" | "OUT" | "INOUT";
      data_type: string;
    }>;
    body: string;
    comment?: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("createStoredProcedure");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.createStoredProcedure(params);
  }

  async dropStoredProcedure(params: {
    procedure_name: string;
    if_exists?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropStoredProcedure");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.dropStoredProcedure(params);
  }

  async showCreateProcedure(params: {
    procedure_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("showCreateProcedure");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.storedProcedureTools.showCreateProcedure(params);
  }

  // Data Export Tools
  async exportTableToCSV(params: {
    table_name: string;
    filters?: any[];
    pagination?: { page: number; limit: number };
    sorting?: { field: string; direction: "asc" | "desc" };
    include_headers?: boolean;
  }) {
    const check = this.checkToolEnabled("exportTableToCSV");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dataExportTools.exportTableToCSV(params);
  }

  async exportQueryToCSV(params: {
    query: string;
    params?: any[];
    include_headers?: boolean;
  }) {
    const check = this.checkToolEnabled("exportQueryToCSV");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.dataExportTools.exportQueryToCSV(params);
  }

  // AI Productivity Tools
  async repairQuery(params: { query: string; error_message?: string }) {
    const check = this.checkToolEnabled("repairQuery");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.aiTools.repairQuery(params);
  }

  // Workflow Macros
  async safeExportTable(params: {
    table_name: string;
    masking_profile?: string;
    limit?: number;
    include_headers?: boolean;
  }) {
    const check = this.checkToolEnabled("safe_export_table");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.macroTools.safeExportTable(params);
  }

  // Get feature configuration status
  getFeatureStatus() {
    const snapshot = this.featureConfig.getConfigSnapshot();
    return {
      status: "success",
      data: {
        config: snapshot,
        filteringMode: this.featureConfig.getFilteringMode(),
        enabledCategories: this.featureConfig.getEnabledCategories(),
        categoryStatus: this.featureConfig.getCategoryStatus(),
        docCategoryStatus: this.featureConfig.getDocCategoryStatus(),
      },
    };
  }

  /**
   * Check if a specific tool is enabled based on current permissions and categories
   * @param toolName - The tool name in camelCase (e.g., 'listDatabases')
   * @returns boolean indicating if the tool is enabled
   */
  isToolEnabled(toolName: string): boolean {
    return this.featureConfig.isToolEnabled(toolName);
  }

  /**
   * Expose resolved access profile (resolved permissions/categories)
   */
  getAccessProfile() {
    return this.featureConfig.getConfigSnapshot();
  }

  /**
   * Bulk insert multiple records into the specified table
   */
  async bulkInsert(params: {
    table_name: string;
    data: Record<string, any>[];
    batch_size?: number;
  }): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("bulkInsert");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return this.crudTools.bulkInsert(params);
  }

  /**
   * Bulk update multiple records with different conditions and data
   */
  async bulkUpdate(params: {
    table_name: string;
    updates: Array<{
      data: Record<string, any>;
      conditions: any[];
    }>;
    batch_size?: number;
  }): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("bulkUpdate");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return this.crudTools.bulkUpdate(params);
  }

  /**
   * Bulk delete records based on multiple condition sets
   */
  async bulkDelete(params: {
    table_name: string;
    condition_sets: any[][];
    batch_size?: number;
  }): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("bulkDelete");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return this.crudTools.bulkDelete(params);
  }

  // Relational Data Seeder Tools
  async planSeedData(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("planSeedData");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.planSeedData(params);
  }

  async generateSeedPreview(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("generateSeedPreview");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.generateSeedPreview(params);
  }

  async executeSeedPlan(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("executeSeedPlan");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.executeSeedPlan(params);
  }

  async validateSeedIntegrity(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("validateSeedIntegrity");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.validateSeedIntegrity(params);
  }

  async inferSeedRules(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("inferSeedRules");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.inferSeedRules(params);
  }

  async seedFromTemplate(params: any): Promise<{ status: string; data?: any; error?: string }> {
    const check = this.checkToolEnabled("seedFromTemplate");
    if (!check.enabled) {
      return { status: "error", error: check.error };
    }
    return await this.relationalSeederTools.seedFromTemplate(params);
  }

  // Close database connection
  async close() {
    const db = DatabaseConnection.getInstance();
    await db.closePool();
  }

  // ==========================================
  // Query Optimization Tools
  // ==========================================

  /**
   * Analyze a query and get optimization suggestions
   */
  analyzeQuery(params: { query: string }) {
    const analysis = this.queryTools.analyzeQuery(params.query);
    return {
      status: "success",
      data: analysis,
    };
  }

  /**
   * Get suggested optimizer hints for a specific optimization goal
   */
  getOptimizationHints(params: { goal: "SPEED" | "MEMORY" | "STABILITY" }) {
    const hints = this.queryTools.getSuggestedHints(params.goal);
    return {
      status: "success",
      data: {
        goal: params.goal,
        hints,
      },
    };
  }

  // ==========================================
  // View Tools
  // ==========================================

  async listViews(params: { database?: string }) {
    const check = this.checkToolEnabled("listViews");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.listViews(params);
  }

  async getViewInfo(params: { view_name: string; database?: string }) {
    const check = this.checkToolEnabled("getViewInfo");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.getViewInfo(params);
  }

  async createView(params: any) {
    const check = this.checkToolEnabled("createView");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.createView(params);
  }

  async alterView(params: any) {
    const check = this.checkToolEnabled("alterView");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.alterView(params);
  }

  async dropView(params: {
    view_name: string;
    if_exists?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropView");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.dropView(params);
  }

  async showCreateView(params: { view_name: string; database?: string }) {
    const check = this.checkToolEnabled("showCreateView");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.viewTools.showCreateView(params);
  }

  // ==========================================
  // Trigger Tools
  // ==========================================

  async listTriggers(params: { database?: string; table_name?: string }) {
    const check = this.checkToolEnabled("listTriggers");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.triggerTools.listTriggers(params);
  }

  async getTriggerInfo(params: { trigger_name: string; database?: string }) {
    const check = this.checkToolEnabled("getTriggerInfo");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.triggerTools.getTriggerInfo(params);
  }

  async createTrigger(params: any) {
    const check = this.checkToolEnabled("createTrigger");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.triggerTools.createTrigger(params);
  }

  async dropTrigger(params: {
    trigger_name: string;
    if_exists?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropTrigger");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.triggerTools.dropTrigger(params);
  }

  async showCreateTrigger(params: { trigger_name: string; database?: string }) {
    const check = this.checkToolEnabled("showCreateTrigger");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.triggerTools.showCreateTrigger(params);
  }

  // ==========================================
  // Index Tools
  // ==========================================

  async listIndexes(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("listIndexes");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.indexTools.listIndexes(params);
  }

  async getIndexInfo(params: {
    table_name: string;
    index_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getIndexInfo");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.indexTools.getIndexInfo(params);
  }

  async createIndex(params: any) {
    const check = this.checkToolEnabled("createIndex");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.indexTools.createIndex(params);
  }

  async dropIndex(params: {
    table_name: string;
    index_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropIndex");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.indexTools.dropIndex(params);
  }

  async analyzeIndex(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("analyzeIndex");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.indexTools.analyzeIndex(params);
  }

  // ==========================================
  // Constraint Tools
  // ==========================================

  async listForeignKeys(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("listForeignKeys");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.listForeignKeys(params);
  }

  async listConstraints(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("listConstraints");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.listConstraints(params);
  }

  async addForeignKey(params: any) {
    const check = this.checkToolEnabled("addForeignKey");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.addForeignKey(params);
  }

  async dropForeignKey(params: {
    table_name: string;
    constraint_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropForeignKey");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.dropForeignKey(params);
  }

  async addUniqueConstraint(params: any) {
    const check = this.checkToolEnabled("addUniqueConstraint");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.addUniqueConstraint(params);
  }

  async dropConstraint(params: {
    table_name: string;
    constraint_name: string;
    constraint_type: "UNIQUE" | "CHECK";
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropConstraint");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.dropConstraint(params);
  }

  async addCheckConstraint(params: any) {
    const check = this.checkToolEnabled("addCheckConstraint");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.constraintTools.addCheckConstraint(params);
  }

  // ==========================================
  // Table Maintenance Tools
  // ==========================================

  async analyzeTable(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("analyzeTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.analyzeTable(params);
  }

  async optimizeTable(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("optimizeTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.optimizeTable(params);
  }

  async checkTable(params: {
    table_name: string;
    check_type?: "QUICK" | "FAST" | "MEDIUM" | "EXTENDED" | "CHANGED";
    database?: string;
  }) {
    const check = this.checkToolEnabled("checkTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.checkTable(params);
  }

  async repairTable(params: {
    table_name: string;
    quick?: boolean;
    extended?: boolean;
    use_frm?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("repairTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.repairTable(params);
  }

  async truncateTable(params: { table_name: string; database?: string }) {
    const check = this.checkToolEnabled("truncateTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.truncateTable(params);
  }

  async getTableStatus(params: { table_name?: string; database?: string }) {
    const check = this.checkToolEnabled("getTableStatus");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.getTableStatus(params);
  }

  async flushTable(params: {
    table_name?: string;
    with_read_lock?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("flushTable");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.flushTable(params);
  }

  async getTableSize(params: { table_name?: string; database?: string }) {
    const check = this.checkToolEnabled("getTableSize");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.maintenanceTools.getTableSize(params);
  }

  // Smart Query Builder Tools
  async startQueryBuilder(params: {
    intent: string;
    context?: "analytics" | "reporting" | "data_entry" | "schema_exploration";
    database?: string;
  }) {
    const check = this.checkToolEnabled("startQueryBuilder");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.startQueryBuilder(params);
  }

  async addTablesToQuery(params: {
    session_id: string;
    tables: string[];
    database?: string;
  }) {
    const check = this.checkToolEnabled("addTablesToQuery");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.addTablesToQuery(params);
  }

  async defineJoins(params: {
    session_id: string;
    joins: Array<{
      from_table: string;
      from_column: string;
      to_table: string;
      to_column: string;
      join_type?: "INNER" | "LEFT" | "RIGHT" | "FULL";
    }>;
    database?: string;
  }) {
    const check = this.checkToolEnabled("defineJoins");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.defineJoins(params);
  }

  async selectColumns(params: {
    session_id: string;
    columns: Array<{
      table: string;
      column: string;
      alias?: string;
    }>;
    database?: string;
  }) {
    const check = this.checkToolEnabled("selectColumns");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.selectColumns(params);
  }

  async addConditions(params: {
    session_id: string;
    conditions: Array<{
      table: string;
      column: string;
      operator: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "like" | "in" | "not_in" | "is_null" | "is_not_null";
      value?: any;
      values?: any[];
    }>;
    database?: string;
  }) {
    const check = this.checkToolEnabled("addConditions");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.addConditions(params);
  }

  async addAggregations(params: {
    session_id: string;
    aggregations: Array<{
      function: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
      column: string;
      alias: string;
      table: string;
    }>;
    database?: string;
  }) {
    const check = this.checkToolEnabled("addAggregations");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.addAggregations(params);
  }

  async configureGroupingAndOrdering(params: {
    session_id: string;
    group_by?: Array<{
      table: string;
      column: string;
    }>;
    order_by?: Array<{
      table: string;
      column: string;
      direction: "asc" | "desc";
    }>;
    limit?: number;
    offset?: number;
    database?: string;
  }) {
    const check = this.checkToolEnabled("configureGroupingAndOrdering");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.configureGroupingAndOrdering(params);
  }

  async previewQuery(params: {
    session_id: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("previewQuery");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.previewQuery(params);
  }

  async executeQuery(params: {
    session_id: string;
    dry_run?: boolean;
    database?: string;
  }) {
    const check = this.checkToolEnabled("executeQuery");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.executeQuery(params);
  }

  async getSessionState(params: {
    session_id: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getSessionState");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.getSessionState(params);
  }

  async getQueryTemplates(params: {
    category?: "analytics" | "reporting" | "data_entry" | "schema_exploration";
    database?: string;
  }) {
    const check = this.checkToolEnabled("getQueryTemplates");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.getQueryTemplates(params);
  }

  async applyQueryTemplate(params: {
    session_id: string;
    template_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("applyQueryTemplate");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.applyQueryTemplate(params);
  }

  async suggestNextStep(params: {
    session_id: string;
    user_input?: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("suggestNextStep");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.suggestNextStep(params);
  }

  async endSession(params: {
    session_id: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("endSession");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.smartQueryBuilderTools.endSession(params);
  }

  // Full-Text Search Tools
  async createFulltextIndex(params: {
    table_name: string;
    columns: string[];
    index_name?: string;
    parser?: "ngram" | "mecab";
    ngram_token_size?: number;
    database?: string;
  }) {
    const check = this.checkToolEnabled("createFulltextIndex");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.createFulltextIndex(params);
  }

  async fulltextSearch(params: {
    table_name: string;
    search_term: string;
    columns?: string[];
    mode?:
      | "natural_language"
      | "natural_language_with_query_expansion"
      | "boolean"
      | "query_expansion";
    limit?: number;
    offset?: number;
    order_by?: string;
    order_direction?: "ASC" | "DESC";
    database?: string;
  }) {
    const check = this.checkToolEnabled("fulltextSearch");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.fulltextSearch(params);
  }

  async getFulltextInfo(params: {
    table_name: string;
    index_name?: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getFulltextInfo");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.getFulltextInfo(params);
  }

  async dropFulltextIndex(params: {
    table_name: string;
    index_name?: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("dropFulltextIndex");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.dropFulltextIndex(params);
  }

  async getFulltextStats(params: {
    table_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("getFulltextStats");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.getFulltextStats(params);
  }

  async optimizeFulltext(params: {
    table_name: string;
    database?: string;
  }) {
    const check = this.checkToolEnabled("optimizeFulltext");
    if (!check.enabled) return { status: "error", error: check.error };
    return await this.fulltextSearchTools.optimizeFulltext(params);
  }
}

export default MySQLMCP;
