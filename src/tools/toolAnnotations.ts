import { Tool, ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";

/**
 * MCP tool annotations (hints for clients such as ChatGPT, which uses
 * readOnlyHint to decide when to ask for confirmation). They describe what a
 * tool can do at most; permissions still decide what it may do.
 */
type Behavior = "read" | "write" | "destructive";

// Reads only: no data, schema, or server state changes
const READ_TOOLS = [
  "list_databases", "list_tables", "get_database_summary", "get_schema_erd",
  "get_schema_rag_context", "find_tables_by_keyword", "search_schema",
  "search_data_across_tables", "get_column_statistics", "read_table_schema",
  "read_records", "plan_seed_data", "generate_seed_preview",
  "validate_seed_integrity", "infer_seed_rules", "seed_from_template",
  "run_select_query", "repair_query", "describe_connection", "read_changelog",
  "test_connection", "list_all_tools", "get_all_tables_relationships",
  "get_transaction_status", "list_stored_procedures", "get_stored_procedure_info",
  "show_create_procedure", "export_table_to_csv", "export_query_to_csv",
  "analyze_query", "get_optimization_hints", "list_views", "get_view_info",
  "show_create_view", "list_triggers", "get_trigger_info", "show_create_trigger",
  "list_indexes", "get_index_info", "list_foreign_keys", "list_constraints",
  "check_table", "get_table_status", "get_table_size", "fulltext_search",
  "get_fulltext_info", "get_fulltext_stats",
];

// Change state but only add to it or maintain it; existing data is kept
const WRITE_TOOLS = [
  "create_record", "bulk_insert", "execute_seed_plan", "begin_transaction",
  "rollback_transaction", "create_table", "create_trigger", "create_index",
  "add_foreign_key", "add_unique_constraint", "add_check_constraint",
  "create_stored_procedure", "create_fulltext_index",
];

// Maintenance statements that leave the same state when repeated
const IDEMPOTENT_WRITE_TOOLS = [
  "analyze_table", "analyze_index", "optimize_table", "flush_table", "optimize_fulltext",
];

// May overwrite or remove data or schema objects, or run arbitrary statements
const DESTRUCTIVE_TOOLS = [
  "update_record", "delete_record", "bulk_update", "bulk_delete",
  "execute_write_query", "alter_table", "drop_table", "execute_ddl",
  "cursor_execute_request", "commit_transaction", "execute_in_transaction",
  "execute_stored_procedure", "drop_stored_procedure", "create_view",
  "alter_view", "drop_view", "drop_trigger", "drop_index", "drop_foreign_key",
  "drop_constraint", "repair_table", "truncate_table", "drop_fulltext_index",
];

const behaviors = new Map<string, { behavior: Behavior; idempotent: boolean }>();
for (const name of READ_TOOLS) behaviors.set(name, { behavior: "read", idempotent: true });
for (const name of WRITE_TOOLS) behaviors.set(name, { behavior: "write", idempotent: false });
for (const name of IDEMPOTENT_WRITE_TOOLS) behaviors.set(name, { behavior: "write", idempotent: true });
for (const name of DESTRUCTIVE_TOOLS) behaviors.set(name, { behavior: "destructive", idempotent: false });

const ACRONYMS: Record<string, string> = { csv: "CSV", erd: "ERD", rag: "RAG", ddl: "DDL" };

const toTitle = (name: string): string =>
  name
    .split("_")
    .map((word) => ACRONYMS[word] || word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export const getToolAnnotations = (name: string): ToolAnnotations => {
  // Unknown tools are treated as destructive, the safest hint
  const entry = behaviors.get(name) || { behavior: "destructive" as Behavior, idempotent: false };
  return {
    title: toTitle(name),
    readOnlyHint: entry.behavior === "read",
    destructiveHint: entry.behavior === "destructive",
    idempotentHint: entry.idempotent,
    openWorldHint: false,
  };
};

export const hasExplicitAnnotations = (name: string): boolean => behaviors.has(name);

export const withToolAnnotations = (tools: Tool[]): Tool[] =>
  tools.map((tool) => ({
    ...tool,
    annotations: { ...getToolAnnotations(tool.name), ...(tool.annotations || {}) },
  }));
