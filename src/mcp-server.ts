#!/usr/bin/env node

import fs from "fs";
import path from "path";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { MySQLMCP } from "./index.js";
import { getEnabledTools } from "./tools/toolRegistry.js";
import { validateToolArguments } from "./tools/toolArgumentValidation.js";

// Get permissions and categories from environment variables (set by bin/mcp-mysql.js)
// Layer 1 (Permissions): MCP_PERMISSIONS or MCP_CONFIG (backward compatible)
// Layer 2 (Categories): MCP_CATEGORIES (optional, for fine-grained control)
const permissions = process.env.MCP_PERMISSIONS || process.env.MCP_CONFIG || "";
const categories = process.env.MCP_CATEGORIES || "";
const SERVER_NAME = "mysql-mcp-server";
const SERVER_VERSION = "1.43.2";

// Declare the MySQL MCP instance (will be initialized in main())
let mysqlMCP: MySQLMCP;

// Define all available tools with their schemas
const TOOLS: Tool[] = [
  {
    name: "list_databases",
    description: "Lists all databases available on the MySQL server. Use this to discover what databases exist before querying them.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_tables",
    description: "Lists all tables in the connected database. Use this as the first step when exploring an unfamiliar database to see available tables.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name to list tables from",
        },
      },
    },
  },
  {
    name: "get_database_summary",
    description:
      "📊 Returns a high-level overview of the database including all tables, their columns, data types, row counts, and relationships. RECOMMENDED: Use this first when exploring a new database to understand its structure quickly. Features: database overview, per-table breakdown with primary keys, columns with nullable info and foreign key references, optional relationship summary, and configurable table limits.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        max_tables: {
          type: "number",
          description: "Optional: maximum number of tables to include (default: all tables, max 500)",
        },
        include_relationships: {
          type: "boolean",
          description: "Optional: include foreign key relationships section (default: true)",
        },
      },
    },
  },
  {
    name: "get_schema_erd",
    description:
      "📈 Generates a visual Mermaid.js ER diagram showing tables and their relationships. Perfect for visualizing database structure and foreign key connections. Use when users ask to 'visualize' or 'diagram' the database.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  {
    name: "get_schema_rag_context",
    description:
      "🎯 AI-OPTIMIZED: Returns ultra-compact schema information (tables, columns, keys, relationships, comments, row estimates) designed specifically for LLM context windows. Use keyword_filter for concept-focused schema discovery.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        max_tables: {
          type: "number",
          description: "Optional: maximum number of tables to include (default 50, max 200)",
        },
        max_columns: {
          type: "number",
          description: "Optional: maximum number of columns per table (default 12, max 200)",
        },
        include_relationships: {
          type: "boolean",
          description: "Whether to include FK relationships section (default: true)",
        },
        include_comments: {
          type: "boolean",
          description: "Optional: include TABLE_COMMENT and COLUMN_COMMENT metadata (default: false)",
        },
        keyword_filter: {
          type: "string",
          description: "Optional: only include tables relevant to this keyword, ranked by table names, column names, and comments",
        },
      },
    },
  },
  {
    name: "find_tables_by_keyword",
    description:
      "🔎 Schema discovery: finds candidate tables for a concept or keyword by searching table names, column names, TABLE_COMMENT, and COLUMN_COMMENT metadata. Use when users ask 'which table stores X?' before reading sample data.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Concept or keyword to find, such as survey, invoice, feedback, or customer",
        },
        search_in: {
          type: "string",
          enum: ["table_names", "column_names", "comments", "all"],
          description: "Where to search (default: all)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        limit: {
          type: "number",
          description: "Optional: maximum number of ranked tables to return (default 20, max 100)",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "search_schema",
    description:
      "🧭 Unified schema discovery for natural-language 'where is X?' questions. Searches schema metadata by default and can optionally perform a guarded sample-data scan when mode sample_data is requested.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Concept or keyword to discover",
        },
        modes: {
          type: "array",
          items: {
            type: "string",
            enum: ["table_names", "column_names", "comments", "sample_data"],
          },
          description: "Discovery modes (default: table_names, column_names, comments). sample_data requires read permission.",
        },
        max_results: {
          type: "number",
          description: "Optional: maximum combined results to return (default 20, max 100)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        tables: {
          type: "array",
          items: { type: "string" },
          description: "Optional: restrict sample_data mode to these tables",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Optional: restrict sample_data mode to these columns",
        },
        max_tables: {
          type: "number",
          description: "Optional: max tables scanned in sample_data mode (default 20, max 100)",
        },
        limit_per_table: {
          type: "number",
          description: "Optional: max matching rows returned per table in sample_data mode (default 5, max 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_data_across_tables",
    description:
      "🔍 Guarded read-only keyword scan across text-like table data. Use only when schema metadata does not reveal where a concept is stored; enforces max table and per-table result limits.",
    inputSchema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "Keyword to search inside text-like column values",
        },
        tables: {
          type: "array",
          items: { type: "string" },
          description: "Optional: restrict scan to these tables",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Optional: restrict scan to these column names",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        max_tables: {
          type: "number",
          description: "Optional: maximum tables to scan (default 20, max 100)",
        },
        limit_per_table: {
          type: "number",
          description: "Optional: maximum rows returned per table (default 5, max 20)",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_column_statistics",
    description:
      "Returns detailed statistics for a specific column: min/max values, average, distinct count, null percentage, and value distribution. Use to understand data quality and ranges in a column before writing queries.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table",
        },
        column_name: {
          type: "string",
          description: "Name of the column",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "column_name"],
    },
  },
  {
    name: "read_table_schema",
    description:
      "Returns complete schema definition for a table: columns, data types, constraints, keys, indexes, and defaults. Use when you need detailed structural information about a specific table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to read schema from",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "create_record",
    description: "Inserts a single new record into a table. For inserting multiple records at once, use bulk_insert for better performance.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to insert into",
        },
        data: {
          type: "object",
          description: "Object containing column names and values to insert",
        },
      },
      required: ["table_name", "data"],
    },
  },
  {
    name: "read_records",
    description:
      "Reads records from a table with built-in filtering, pagination, and sorting. Use this for simple data retrieval. For complex queries with JOINs or aggregations, use run_select_query instead.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to read from",
        },
        filters: {
          type: "array",
          description: "Array of filter conditions",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"],
              },
              value: {
                description:
                  'Value to compare against (can be string, number, boolean, or array for "in" operator)',
              },
            },
            required: ["field", "operator", "value"],
          },
        },
        pagination: {
          type: "object",
          properties: {
            page: {
              type: "number",
              description: "Page number (starting from 1)",
            },
            limit: {
              type: "number",
              description: "Number of records per page",
            },
          },
        },
        sorting: {
          type: "object",
          properties: {
            field: { type: "string", description: "Field name to sort by" },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "update_record",
    description:
      "Updates records in a table based on specified conditions. For updating many records with different values, use bulk_update for better performance.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to update",
        },
        data: {
          type: "object",
          description: "Object containing column names and new values",
        },
        conditions: {
          type: "array",
          description:
            "Array of conditions to identify which records to update",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"],
              },
              value: {},
            },
            required: ["field", "operator", "value"],
          },
        },
      },
      required: ["table_name", "data", "conditions"],
    },
  },
  {
    name: "delete_record",
    description:
      "Deletes records from a table based on specified conditions. Always requires conditions for safety (no WHERE-less deletes). For deleting multiple record sets, use bulk_delete.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to delete from",
        },
        conditions: {
          type: "array",
          description:
            "Array of conditions to identify which records to delete",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"],
              },
              value: {},
            },
            required: ["field", "operator", "value"],
          },
        },
      },
      required: ["table_name", "conditions"],
    },
  },
  {
    name: "bulk_insert",
    description:
      "⚡ PERFORMANCE: Inserts multiple records efficiently using batch processing. Handles 1000s of rows with automatic batching. Use this instead of create_record when inserting many records at once (10+ rows).",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to insert into",
        },
        data: {
          type: "array",
          description:
            "Array of objects containing column names and values to insert",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: true,
          },
        },
        batch_size: {
          type: "number",
          description:
            "Optional batch size for processing (default: 1000, max: 10000)",
          minimum: 1,
          maximum: 10000,
        },
      },
      required: ["table_name", "data"],
    },
  },
  {
    name: "bulk_update",
    description:
      "⚡ PERFORMANCE: Updates multiple records with different values in batches. Each update can have unique conditions and data. Much faster than calling update_record repeatedly for multiple rows.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to update",
        },
        updates: {
          type: "array",
          description: "Array of update operations with data and conditions",
          minItems: 1,
          items: {
            type: "object",
            properties: {
              data: {
                type: "object",
                description: "Object containing column names and new values",
                additionalProperties: true,
              },
              conditions: {
                type: "array",
                description:
                  "Array of conditions to identify which records to update",
                minItems: 1,
                items: {
                  type: "object",
                  properties: {
                    field: { type: "string" },
                    operator: {
                      type: "string",
                      enum: [
                        "eq",
                        "neq",
                        "gt",
                        "gte",
                        "lt",
                        "lte",
                        "like",
                        "in",
                      ],
                    },
                    value: {},
                  },
                  required: ["field", "operator", "value"],
                },
              },
            },
            required: ["data", "conditions"],
          },
        },
        batch_size: {
          type: "number",
          description:
            "Optional batch size for processing (default: 100, max: 1000)",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ["table_name", "updates"],
    },
  },
  {
    name: "bulk_delete",
    description:
      "⚡ PERFORMANCE: Deletes multiple sets of records efficiently in batches. Each condition set defines a separate delete operation. More efficient than calling delete_record multiple times.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to delete from",
        },
        condition_sets: {
          type: "array",
          description:
            "Array of condition sets, each defining records to delete",
          minItems: 1,
          items: {
            type: "array",
            description: "Array of conditions for this delete operation",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                field: { type: "string" },
                operator: {
                  type: "string",
                  enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"],
                },
                value: {},
              },
              required: ["field", "operator", "value"],
            },
          },
        },
        batch_size: {
          type: "number",
          description:
            "Optional batch size for processing (default: 100, max: 1000)",
          minimum: 1,
          maximum: 1000,
        },
      },
      required: ["table_name", "condition_sets"],
    },
  },
  {
    name: "plan_seed_data",
    description:
      "🌱 RELATIONAL SEEDER: Analyzes target tables, foreign keys, constraints, and row counts to build a safe parent-first seed plan. Use this before generating preview or inserting dummy relational data.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific connected database name",
        },
        target_tables: {
          type: "array",
          description: "Target tables to seed",
          minItems: 1,
          items: { type: "string" },
        },
        rows_per_table: {
          oneOf: [
            { type: "number", minimum: 0 },
            { type: "object", additionalProperties: { type: "number", minimum: 0 } },
          ],
          description: "Rows to create for target tables, either a single number or table-to-count map (default: 10)",
        },
        include_dependencies: {
          type: "boolean",
          description: "Include parent tables required by foreign keys (default: true)",
        },
        include_children: {
          type: "boolean",
          description: "Include child tables that reference included tables for nested relational seeding (default: false)",
        },
        child_rows_per_parent: {
          type: "number",
          description: "Rows to create in child tables for each parent row (default: 2)",
          minimum: 1,
          maximum: 20,
        },
        respect_existing_data: {
          type: "boolean",
          description: "Reuse existing parent records when possible instead of creating new parent rows (default: true)",
        },
        strategy: {
          type: "string",
          enum: ["append"],
          description: "Seed strategy (currently append)",
        },
        random_seed: {
          type: "number",
          description: "Deterministic seed for repeatable preview and execution (default: 42)",
        },
        max_rows_per_table: {
          type: "number",
          description: "Safety cap for generated rows per table (default: 1000)",
          minimum: 1,
          maximum: 10000,
        },
        max_related_tables: {
          type: "number",
          description: "Safety cap for dependency/child expansion (default: 25)",
          minimum: 1,
          maximum: 100,
        },
        seed_rules: {
          type: "object",
          description: "Optional generator overrides keyed by table.column or column name",
          additionalProperties: true,
        },
        require_confirmation: {
          type: "boolean",
          description: "Require confirm_token for non-dry-run execution (default: true)",
        },
      },
      required: ["target_tables"],
    },
  },
  {
    name: "generate_seed_preview",
    description:
      "🌱 RELATIONAL SEEDER: Generates deterministic dummy row previews from a seed plan without writing to the database. Shows symbolic foreign-key placeholders for review before execution.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: {
          type: "string",
          description: "Seed plan ID returned by plan_seed_data",
        },
        locale: {
          type: "string",
          description: "Optional locale hint for generated values (default: en_US)",
        },
        realistic: {
          type: "boolean",
          description: "Whether to prefer realistic generated values (default: true)",
        },
        max_preview_rows_per_table: {
          type: "number",
          description: "Maximum preview rows per table (default: 3)",
          minimum: 1,
          maximum: 25,
        },
        email_domain: {
          type: "string",
          description: "Safe email domain for generated emails (default: example.test)",
        },
      },
      required: ["plan_id"],
    },
  },
  {
    name: "execute_seed_plan",
    description:
      "🌱 RELATIONAL SEEDER: Executes a confirmed seed plan with dry-run enabled by default, production-name guard, transaction rollback on errors, and foreign-key ID resolution.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: {
          type: "string",
          description: "Seed plan ID returned by plan_seed_data",
        },
        dry_run: {
          type: "boolean",
          description: "If true, returns execution preview without inserting rows (default: true)",
        },
        use_transaction: {
          type: "boolean",
          description: "Use a transaction and rollback on error (default: true)",
        },
        batch_size: {
          type: "number",
          description: "Reserved batch-size hint for large plans (default: 1 for ID-safe inserts)",
          minimum: 1,
          maximum: 10000,
        },
        on_error: {
          type: "string",
          enum: ["rollback", "stop"],
          description: "Error behavior (default: rollback)",
        },
        confirm_token: {
          type: "string",
          description: "Confirmation token returned by plan_seed_data; required when dry_run is false",
        },
        allow_production: {
          type: "boolean",
          description: "Allow writes to production-like database names (default: false)",
        },
        email_domain: {
          type: "string",
          description: "Safe email domain for generated emails (default: example.test)",
        },
      },
      required: ["plan_id"],
    },
  },
  {
    name: "validate_seed_integrity",
    description:
      "🌱 RELATIONAL SEEDER: Validates seed results with FK orphan checks, required-column checks, unique-collision checks, and inserted row-count checks.",
    inputSchema: {
      type: "object",
      properties: {
        plan_id: {
          type: "string",
          description: "Seed plan ID returned by plan_seed_data",
        },
        tables: {
          type: "array",
          description: "Optional table subset to validate",
          items: { type: "string" },
        },
        check_foreign_keys: {
          type: "boolean",
          description: "Check foreign key integrity (default: true)",
        },
        check_orphans: {
          type: "boolean",
          description: "Alias for check_foreign_keys",
        },
        check_required_columns: {
          type: "boolean",
          description: "Check NOT NULL required columns (default: true)",
        },
        check_unique_collisions: {
          type: "boolean",
          description: "Check unique index collisions (default: true)",
        },
        check_row_counts: {
          type: "boolean",
          description: "Check inserted row counts when execution metadata is available (default: true)",
        },
      },
      required: ["plan_id"],
    },
  },
  {
    name: "infer_seed_rules",
    description:
      "🌱 ADVANCED SEEDER: Infers safe seed generator rules from schema metadata, sample row patterns, unique constraints, and optional ecommerce/POS/CRM domain presets without returning raw PII samples.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific connected database name",
        },
        tables: {
          type: "array",
          description: "Optional table subset to analyze; defaults to schema tables up to max_tables",
          items: { type: "string" },
        },
        domain: {
          type: "string",
          enum: ["auto", "generic", "ecommerce", "pos", "crm"],
          description: "Optional domain preset for better business-like dummy data (default: auto)",
        },
        sample_size: {
          type: "number",
          description: "Number of sample rows per table used to infer ranges and enum-like choices (default: 25, max: 100)",
          minimum: 0,
          maximum: 100,
        },
        max_tables: {
          type: "number",
          description: "Maximum number of tables to analyze when tables is omitted (default: 50)",
          minimum: 1,
          maximum: 200,
        },
      },
    },
  },
  {
    name: "seed_from_template",
    description:
      "🌱 TEMPLATE SEEDER: Creates a plan-first FK-aware seed workflow from ecommerce, POS, or CRM templates. It detects matching tables, applies domain rules, and returns a seed plan for preview/execution.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific connected database name",
        },
        template: {
          type: "string",
          enum: ["ecommerce", "pos", "crm"],
          description: "Business seed template to apply",
        },
        scale: {
          type: "string",
          enum: ["small", "medium", "large"],
          description: "Template size preset (default: small)",
        },
        include: {
          type: "array",
          description: "Optional concrete table list to seed instead of auto-detected template matches",
          items: { type: "string" },
        },
        exclude: {
          type: "array",
          description: "Optional table names to ignore during template matching",
          items: { type: "string" },
        },
        rows_per_table: {
          oneOf: [
            { type: "number", minimum: 0 },
            { type: "object", additionalProperties: { type: "number", minimum: 0 } },
          ],
          description: "Optional row-count override for the generated plan",
        },
        include_dependencies: {
          type: "boolean",
          description: "Include parent tables required by foreign keys (default: true)",
        },
        include_children: {
          type: "boolean",
          description: "Include child tables that reference included template tables (default: false)",
        },
        respect_existing_data: {
          type: "boolean",
          description: "Reuse existing parent records when possible instead of creating new parent rows (default: true)",
        },
        random_seed: {
          type: "number",
          description: "Deterministic seed for repeatable preview and execution",
        },
        require_confirmation: {
          type: "boolean",
          description: "Require confirm_token for non-dry-run execution (default: true)",
        },
      },
      required: ["template"],
    },
  },
  {
    name: "run_select_query",
    description:
      "⚡ PRIMARY TOOL FOR SELECT QUERIES. Executes read-only SELECT statements with parameterization, optimizer hints, query caching, and dry-run mode. Supports complex queries with JOINs, subqueries, and aggregations. ⚠️ ONLY for SELECT - use execute_write_query for INSERT/UPDATE, use execute_ddl for CREATE/ALTER/DROP.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute",
        },
        params: {
          type: "array",
          description: "Optional array of parameters for parameterized queries",
          items: {},
        },
        hints: {
          type: "object",
          description: "Optional MySQL optimizer hints to apply to the query",
          properties: {
            maxExecutionTime: {
              type: "number",
              description: "Maximum execution time in milliseconds",
            },
            forceIndex: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Force usage of specific index(es)",
            },
            ignoreIndex: {
              oneOf: [
                { type: "string" },
                { type: "array", items: { type: "string" } },
              ],
              description: "Ignore specific index(es)",
            },
            straightJoin: {
              type: "boolean",
              description: "Use STRAIGHT_JOIN to force join order",
            },
            noCache: {
              type: "boolean",
              description: "Disable query cache for this query",
            },
            sqlBigResult: {
              type: "boolean",
              description: "Optimize for large result sets",
            },
            sqlSmallResult: {
              type: "boolean",
              description: "Optimize for small result sets",
            },
          },
        },
        useCache: {
          type: "boolean",
          description: "Whether to use query result caching (default: true)",
        },
        dry_run: {
          type: "boolean",
          description:
            "If true, returns query plan and estimated cost without executing (Safe Mode)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "execute_write_query",
    description:
      '⚡ PRIMARY TOOL FOR INSERT/UPDATE QUERIES. Executes data modification statements with parameterization support. Returns affected row count and execution details. DELETE SQL requires the separate "delete" permission in addition to "execute". ⚠️ NOT for SELECT (use run_select_query), NOT for DDL (use execute_ddl for CREATE/ALTER/DROP/TRUNCATE/RENAME).',
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "SQL query to execute (INSERT or UPDATE; DELETE requires the delete permission)",
        },
        params: {
          type: "array",
          description: "Optional array of parameters for parameterized queries",
          items: {},
        },
      },
      required: ["query"],
    },
  },
  {
    name: "repair_query",
    description: "🔧 Diagnoses SQL query errors and suggests fixes. Analyzes syntax errors, missing columns/tables, and logic issues. Provide the query and optional error message to get repair recommendations. Use when a query fails or needs debugging.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The SQL query to analyze or repair",
        },
        error_message: {
          type: "string",
          description: "Optional error message received when executing the query",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "create_table",
    description:
      '🏗️ Creates a new table with columns, data types, constraints, and indexes. Simplified interface compared to raw DDL. Requires "ddl" permission.',
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to create",
        },
        columns: {
          type: "array",
          description: "Array of column definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Column name" },
              type: {
                type: "string",
                description: "MySQL data type (e.g., VARCHAR(255), INT, TEXT)",
              },
              nullable: {
                type: "boolean",
                description: "Whether column can be NULL",
              },
              primary_key: {
                type: "boolean",
                description: "Whether this is the primary key",
              },
              auto_increment: {
                type: "boolean",
                description: "Whether column auto-increments",
              },
              default: { type: "string", description: "Default value" },
            },
            required: ["name", "type"],
          },
        },
        indexes: {
          type: "array",
          description: "Optional indexes to create",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              columns: { type: "array", items: { type: "string" } },
              unique: { type: "boolean" },
            },
          },
        },
      },
      required: ["table_name", "columns"],
    },
  },
  {
    name: "alter_table",
    description:
      '🔧 Modifies existing table structure: add/drop/modify/rename columns, add/drop indexes. Supports multiple operations in one call. Requires "ddl" permission.',
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to alter",
        },
        operations: {
          type: "array",
          description: "Array of alter operations to perform",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: [
                  "add_column",
                  "drop_column",
                  "modify_column",
                  "rename_column",
                  "add_index",
                  "drop_index",
                ],
                description: "Type of alteration",
              },
              column_name: { type: "string" },
              new_column_name: { type: "string" },
              column_type: { type: "string" },
              nullable: { type: "boolean" },
              default: { type: "string" },
              index_name: { type: "string" },
              index_columns: { type: "array", items: { type: "string" } },
              unique: { type: "boolean" },
            },
            required: ["type"],
          },
        },
      },
      required: ["table_name", "operations"],
    },
  },
  {
    name: "drop_table",
    description:
      '🗑️ DESTRUCTIVE: Permanently deletes a table and ALL its data. Cannot be undone! Requires "ddl" permission. ⚠️ WARNING: IRREVERSIBLE!',
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to drop",
        },
        if_exists: {
          type: "boolean",
          description: "If true, will not error if table does not exist",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "execute_ddl",
    description:
      '⚡ PRIMARY TOOL FOR DDL STATEMENTS. Executes schema modification queries: CREATE, ALTER, DROP, TRUNCATE, RENAME. Use for complex DDL that structured tools don\'t cover. ⚠️ NOT for SELECT (use run_select_query), NOT for INSERT/UPDATE/DELETE (use execute_write_query). Requires "ddl" permission.',
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "DDL SQL query to execute (must start with CREATE, ALTER, DROP, TRUNCATE, or RENAME - NO SELECT queries!)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "describe_connection",
    description: "Returns current database connection details: host, database name, user, port, and connection status. Use to verify which database you're connected to.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "cursor_execute_request",
    description:
      "Cursor compatibility bridge for clients that can call MCP tools but cannot send arguments. Reads .cursor/mysql-mcp-request.json (or MYSQL_MCP_CURSOR_REQUEST_FILE) and dispatches to the requested MySQL MCP tool. The request file supports {\"tool\":\"execute_ddl\",\"arguments\":{\"query\":\"DROP TABLE IF EXISTS t;\"}} or direct SQL with {\"query\":\"...\",\"mode\":\"auto\"}.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "read_changelog",
    description:
      "Reads the MySQL MCP Server changelog to see version history, new features, bug fixes, and breaking changes. Useful for understanding tool capabilities and recent updates.",
    inputSchema: {
      type: "object",
      properties: {
        version: {
          type: "string",
          description: "Optional: specific version to read (e.g., '1.0.0')",
        },
        limit: {
          type: "number",
          description: "Optional: limit character count (default: 5000)",
        },
      },
    },
  },
  {
    name: "test_connection",
    description:
      "Tests database connectivity and measures latency. Returns connection status and response time. Use to troubleshoot connection issues or check database availability.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "list_all_tools",
    description:
      "📋 Returns complete catalog of all available tools with names, descriptions, parameters, and current permissions. Use to discover tool capabilities or when users ask 'what can you do?'.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "get_all_tables_relationships",
    description: "Gets ALL table foreign key relationships in the entire database in a single efficient query. Returns a comprehensive relationship map showing parent-child connections between all tables. Much faster than querying table-by-table.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  // Transaction Tools
  {
    name: "begin_transaction",
    description:
      "🔄 Starts a new database transaction and returns a transaction ID. Use with commit_transaction or rollback_transaction to group multiple operations atomically. Essential for data consistency when multiple changes must succeed or fail together.",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description:
            "Optional custom transaction ID. If not provided, one will be generated.",
        },
      },
    },
  },
  {
    name: "commit_transaction",
    description: "✅ Commits an active transaction, making all changes permanent. Use after successful completion of all operations within a transaction started by begin_transaction.",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "The transaction ID to commit",
        },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "rollback_transaction",
    description:
      "↩️ Rolls back an active transaction, undoing ALL changes made within it. Use when an error occurs during transaction or when changes need to be cancelled.",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "The transaction ID to rollback",
        },
      },
      required: ["transactionId"],
    },
  },
  {
    name: "get_transaction_status",
    description: "Shows all active transactions with their IDs, start times, and operation counts. Use to monitor transaction state or debug transaction issues.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "execute_in_transaction",
    description: "Executes a SQL query within an existing transaction context. The query becomes part of the transaction and will be committed or rolled back with it. Use after begin_transaction.",
    inputSchema: {
      type: "object",
      properties: {
        transactionId: {
          type: "string",
          description: "The transaction ID to execute the query within",
        },
        query: {
          type: "string",
          description: "SQL query to execute within the transaction",
        },
        params: {
          type: "array",
          description: "Optional array of parameters for parameterized queries",
          items: {},
        },
      },
      required: ["transactionId", "query"],
    },
  },
  // Stored Procedure Tools
  {
    name: "list_stored_procedures",
    description: "Lists all stored procedures in the specified database.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description:
            "Optional: specific database name to list procedures from",
        },
      },
    },
  },
  {
    name: "get_stored_procedure_info",
    description:
      "Gets detailed information about a specific stored procedure including parameters and metadata.",
    inputSchema: {
      type: "object",
      properties: {
        procedure_name: {
          type: "string",
          description: "Name of the stored procedure to get information for",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["procedure_name"],
    },
  },
  {
    name: "execute_stored_procedure",
    description: "Executes a stored procedure with optional parameters.",
    inputSchema: {
      type: "object",
      properties: {
        procedure_name: {
          type: "string",
          description: "Name of the stored procedure to execute",
        },
        parameters: {
          type: "array",
          description:
            "Optional array of parameters to pass to the stored procedure",
          items: {},
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["procedure_name"],
    },
  },
  {
    name: "create_stored_procedure",
    description:
      "Creates a new stored procedure with the specified parameters and body.",
    inputSchema: {
      type: "object",
      properties: {
        procedure_name: {
          type: "string",
          description: "Name of the stored procedure to create",
        },
        parameters: {
          type: "array",
          description: "Optional array of parameter definitions",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Parameter name" },
              mode: {
                type: "string",
                enum: ["IN", "OUT", "INOUT"],
                description: "Parameter mode",
              },
              data_type: {
                type: "string",
                description: "MySQL data type (e.g., VARCHAR(255), INT)",
              },
            },
            required: ["name", "mode", "data_type"],
          },
        },
        body: {
          type: "string",
          description: "SQL body of the stored procedure",
        },
        comment: {
          type: "string",
          description: "Optional comment for the stored procedure",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["procedure_name", "body"],
    },
  },
  {
    name: "drop_stored_procedure",
    description:
      "Drops (deletes) a stored procedure. WARNING: This is irreversible!",
    inputSchema: {
      type: "object",
      properties: {
        procedure_name: {
          type: "string",
          description: "Name of the stored procedure to drop",
        },
        if_exists: {
          type: "boolean",
          description: "If true, will not error if procedure does not exist",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["procedure_name"],
    },
  },
  {
    name: "show_create_procedure",
    description: "Shows the CREATE statement for a stored procedure.",
    inputSchema: {
      type: "object",
      properties: {
        procedure_name: {
          type: "string",
          description:
            "Name of the stored procedure to show CREATE statement for",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["procedure_name"],
    },
  },
  // Data Export Tools
  {
    name: "export_table_to_csv",
    description:
      "📄 Exports table data to CSV format with filtering, pagination, and sorting. For sensitive data, use safe_export_table instead which includes automatic data masking.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to export",
        },
        filters: {
          type: "array",
          description: "Array of filter conditions",
          items: {
            type: "object",
            properties: {
              field: { type: "string" },
              operator: {
                type: "string",
                enum: ["eq", "neq", "gt", "gte", "lt", "lte", "like", "in"],
              },
              value: {
                description:
                  'Value to compare against (can be string, number, boolean, or array for "in" operator)',
              },
            },
            required: ["field", "operator", "value"],
          },
        },
        pagination: {
          type: "object",
          properties: {
            page: {
              type: "number",
              description: "Page number (starting from 1)",
            },
            limit: {
              type: "number",
              description: "Number of records per page",
            },
          },
        },
        sorting: {
          type: "object",
          properties: {
            field: { type: "string", description: "Field name to sort by" },
            direction: { type: "string", enum: ["asc", "desc"] },
          },
        },
        include_headers: {
          type: "boolean",
          description: "Whether to include column headers in the CSV output",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "export_query_to_csv",
    description: "📄 Executes a SELECT query and exports results to CSV format. Supports complex queries with JOINs and aggregations. For sensitive data, consider using safe_export_table or adding manual data masking.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL SELECT query to execute and export",
        },
        params: {
          type: "array",
          description: "Optional array of parameters for parameterized queries",
          items: {},
        },
        include_headers: {
          type: "boolean",
          description: "Whether to include column headers in the CSV output",
        },
      },
      required: ["query"],
    },
  },
  // Query Optimization Tools
  {
    name: "analyze_query",
    description:
      "🔍 Analyzes a SQL query using EXPLAIN and provides optimization suggestions: missing indexes, inefficient operations, cost estimates. Returns actionable recommendations. Use before running expensive queries.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "SQL query to analyze",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_optimization_hints",
    description:
      "Get suggested MySQL optimizer hints for a specific optimization goal (SPEED, MEMORY, or STABILITY).",
    inputSchema: {
      type: "object",
      properties: {
        goal: {
          type: "string",
          enum: ["SPEED", "MEMORY", "STABILITY"],
          description:
            "Optimization goal: SPEED for faster queries, MEMORY for lower memory usage, STABILITY for consistent performance",
        },
      },
      required: ["goal"],
    },
  },
  // View Tools
  {
    name: "list_views",
    description: "Lists all views in the connected database.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  {
    name: "get_view_info",
    description:
      "Gets detailed information about a specific view including columns and definition.",
    inputSchema: {
      type: "object",
      properties: {
        view_name: { type: "string", description: "Name of the view" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["view_name"],
    },
  },
  {
    name: "create_view",
    description:
      "Creates a new view with the specified SELECT definition. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        view_name: {
          type: "string",
          description: "Name of the view to create",
        },
        definition: {
          type: "string",
          description: "SELECT statement that defines the view",
        },
        or_replace: {
          type: "boolean",
          description: "If true, replaces existing view",
        },
        algorithm: {
          type: "string",
          enum: ["UNDEFINED", "MERGE", "TEMPTABLE"],
          description: "View algorithm",
        },
        security: {
          type: "string",
          enum: ["DEFINER", "INVOKER"],
          description: "Security context",
        },
        check_option: {
          type: "string",
          enum: ["CASCADED", "LOCAL"],
          description: "Check option for updatable views",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["view_name", "definition"],
    },
  },
  {
    name: "alter_view",
    description:
      "Alters an existing view definition. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        view_name: { type: "string", description: "Name of the view to alter" },
        definition: {
          type: "string",
          description: "New SELECT statement that defines the view",
        },
        algorithm: {
          type: "string",
          enum: ["UNDEFINED", "MERGE", "TEMPTABLE"],
          description: "View algorithm",
        },
        security: {
          type: "string",
          enum: ["DEFINER", "INVOKER"],
          description: "Security context",
        },
        check_option: {
          type: "string",
          enum: ["CASCADED", "LOCAL"],
          description: "Check option",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["view_name", "definition"],
    },
  },
  {
    name: "drop_view",
    description:
      "Drops a view. Requires 'ddl' permission. WARNING: This is irreversible!",
    inputSchema: {
      type: "object",
      properties: {
        view_name: { type: "string", description: "Name of the view to drop" },
        if_exists: {
          type: "boolean",
          description: "If true, will not error if view does not exist",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["view_name"],
    },
  },
  {
    name: "show_create_view",
    description: "Shows the CREATE statement for a view.",
    inputSchema: {
      type: "object",
      properties: {
        view_name: { type: "string", description: "Name of the view" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["view_name"],
    },
  },
  // Trigger Tools
  {
    name: "list_triggers",
    description:
      "Lists all triggers in the database, optionally filtered by table.",
    inputSchema: {
      type: "object",
      properties: {
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
        table_name: {
          type: "string",
          description: "Optional: filter triggers for specific table",
        },
      },
    },
  },
  {
    name: "get_trigger_info",
    description: "Gets detailed information about a specific trigger.",
    inputSchema: {
      type: "object",
      properties: {
        trigger_name: { type: "string", description: "Name of the trigger" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["trigger_name"],
    },
  },
  {
    name: "create_trigger",
    description: "Creates a new trigger on a table. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        trigger_name: { type: "string", description: "Name of the trigger" },
        table_name: {
          type: "string",
          description: "Table the trigger is associated with",
        },
        timing: {
          type: "string",
          enum: ["BEFORE", "AFTER"],
          description: "When the trigger fires",
        },
        event: {
          type: "string",
          enum: ["INSERT", "UPDATE", "DELETE"],
          description: "Event that fires the trigger",
        },
        body: { type: "string", description: "SQL statements to execute" },
        definer: {
          type: "string",
          description: "Optional: user who owns the trigger",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["trigger_name", "table_name", "timing", "event", "body"],
    },
  },
  {
    name: "drop_trigger",
    description:
      "Drops a trigger. Requires 'ddl' permission. WARNING: This is irreversible!",
    inputSchema: {
      type: "object",
      properties: {
        trigger_name: {
          type: "string",
          description: "Name of the trigger to drop",
        },
        if_exists: {
          type: "boolean",
          description: "If true, will not error if trigger does not exist",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["trigger_name"],
    },
  },
  {
    name: "show_create_trigger",
    description: "Shows the CREATE statement for a trigger.",
    inputSchema: {
      type: "object",
      properties: {
        trigger_name: { type: "string", description: "Name of the trigger" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["trigger_name"],
    },
  },
  // Index Tools
  {
    name: "list_indexes",
    description: "Lists all indexes for a specific table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "get_index_info",
    description: "Gets detailed information about a specific index.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        index_name: { type: "string", description: "Name of the index" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "index_name"],
    },
  },
  {
    name: "create_index",
    description: "Creates a new index on a table. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        index_name: { type: "string", description: "Name of the index" },
        columns: {
          type: "array",
          description:
            "Columns to index (string or object with column, length, order)",
          items: {},
        },
        unique: { type: "boolean", description: "Whether index is unique" },
        index_type: {
          type: "string",
          enum: ["BTREE", "HASH", "FULLTEXT", "SPATIAL"],
          description: "Index type",
        },
        comment: { type: "string", description: "Optional comment" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "index_name", "columns"],
    },
  },
  {
    name: "drop_index",
    description: "Drops an index from a table. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        index_name: {
          type: "string",
          description: "Name of the index to drop",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "index_name"],
    },
  },
  {
    name: "analyze_index",
    description: "Analyzes a table to update index statistics.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to analyze",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  // Constraint Tools
  {
    name: "list_foreign_keys",
    description: "Lists all foreign key constraints for a table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "list_constraints",
    description:
      "Lists all constraints (PRIMARY KEY, FOREIGN KEY, UNIQUE, CHECK) for a table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "add_foreign_key",
    description:
      "Adds a foreign key constraint to a table. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        constraint_name: {
          type: "string",
          description: "Name of the constraint",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Columns in the foreign key",
        },
        referenced_table: {
          type: "string",
          description: "Referenced table name",
        },
        referenced_columns: {
          type: "array",
          items: { type: "string" },
          description: "Referenced columns",
        },
        on_delete: {
          type: "string",
          enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"],
        },
        on_update: {
          type: "string",
          enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION", "SET DEFAULT"],
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: [
        "table_name",
        "constraint_name",
        "columns",
        "referenced_table",
        "referenced_columns",
      ],
    },
  },
  {
    name: "drop_foreign_key",
    description: "Drops a foreign key constraint. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        constraint_name: {
          type: "string",
          description: "Name of the constraint to drop",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "constraint_name"],
    },
  },
  {
    name: "add_unique_constraint",
    description:
      "Adds a unique constraint to a table. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        constraint_name: {
          type: "string",
          description: "Name of the constraint",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Columns in the unique constraint",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "constraint_name", "columns"],
    },
  },
  {
    name: "drop_constraint",
    description:
      "Drops a UNIQUE or CHECK constraint. Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        constraint_name: {
          type: "string",
          description: "Name of the constraint",
        },
        constraint_type: {
          type: "string",
          enum: ["UNIQUE", "CHECK"],
          description: "Type of constraint",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "constraint_name", "constraint_type"],
    },
  },
  {
    name: "add_check_constraint",
    description:
      "Adds a CHECK constraint to a table (MySQL 8.0.16+). Requires 'ddl' permission.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: { type: "string", description: "Name of the table" },
        constraint_name: {
          type: "string",
          description: "Name of the constraint",
        },
        expression: {
          type: "string",
          description: "Check expression (e.g., 'age >= 18')",
        },
        enforced: {
          type: "boolean",
          description: "Whether constraint is enforced (default: true)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "constraint_name", "expression"],
    },
  },
  // Table Maintenance Tools
  {
    name: "analyze_table",
    description:
      "Analyzes a table to update index statistics for the query optimizer.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to analyze",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "optimize_table",
    description:
      "Optimizes a table to reclaim unused space and defragment data.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to optimize",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "check_table",
    description: "Checks a table for errors.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to check",
        },
        check_type: {
          type: "string",
          enum: ["QUICK", "FAST", "MEDIUM", "EXTENDED", "CHANGED"],
          description: "Type of check",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "repair_table",
    description: "Repairs a corrupted table (MyISAM, ARCHIVE, CSV only).",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to repair",
        },
        quick: { type: "boolean", description: "Quick repair" },
        extended: { type: "boolean", description: "Extended repair" },
        use_frm: { type: "boolean", description: "Use .frm file to repair" },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "truncate_table",
    description:
      "🗑️ DESTRUCTIVE: Removes ALL rows from a table instantly (faster than DELETE). Resets auto-increment counters. Cannot be undone! Requires 'ddl' permission. ⚠️ WARNING: IRREVERSIBLE!",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to truncate",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "get_table_status",
    description: "Gets detailed status and statistics for one or all tables.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Optional: specific table name (omit for all tables)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  {
    name: "flush_table",
    description: "Flushes table(s) - closes and reopens them.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Optional: specific table (omit for all tables)",
        },
        with_read_lock: {
          type: "boolean",
          description: "Acquire read lock after flushing",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  {
    name: "get_table_size",
    description:
      "Gets size information for one or all tables including data and index sizes.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Optional: specific table name (omit for all tables)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
    },
  },
  {
    name: "create_fulltext_index",
    description:
      "Creates a FULLTEXT index on one or more text columns in a table. Supports ngram and mecab parsers for advanced text search capabilities (useful for languages like Chinese, Japanese, Korean). Use this to enable full-text search on text columns.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to create the fulltext index on",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Array of column names to include in the fulltext index",
        },
        index_name: {
          type: "string",
          description: "Optional: custom name for the index (default: auto-generated)",
        },
        parser: {
          type: "string",
          enum: ["ngram", "mecab"],
          description: "Optional: parser for CJK languages (ngram or mecab)",
        },
        ngram_token_size: {
          type: "number",
          description: "Optional: token size for ngram parser (default: 2)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "columns"],
    },
  },
  {
    name: "fulltext_search",
    description:
      "Performs full-text search on a table using MATCH AGAINST clause. Supports natural language, boolean mode, and query expansion. Returns results ordered by relevance score. Use this for efficient text search on indexed columns.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to search",
        },
        search_term: {
          type: "string",
          description: "Search term or query",
        },
        columns: {
          type: "array",
          items: { type: "string" },
          description: "Optional: array of column names to search (default: all fulltext indexed columns)",
        },
        mode: {
          type: "string",
          enum: [
            "natural_language",
            "natural_language_with_query_expansion",
            "boolean",
            "query_expansion",
          ],
          description: "Search mode (default: natural_language)",
        },
        limit: {
          type: "number",
          description: "Optional: maximum number of results (default: 100)",
        },
        offset: {
          type: "number",
          description: "Optional: offset for pagination (default: 0)",
        },
        order_by: {
          type: "string",
          description: "Optional: column to order by (default: relevance_score)",
        },
        order_direction: {
          type: "string",
          enum: ["ASC", "DESC"],
          description: "Optional: order direction (default: DESC)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name", "search_term"],
    },
  },
  {
    name: "get_fulltext_info",
    description:
      "Retrieves information about FULLTEXT indexes on a table including index names, columns, and parser details. Use this to discover what fulltext indexes exist on a table.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table",
        },
        index_name: {
          type: "string",
          description: "Optional: specific index name to query (default: all indexes)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "drop_fulltext_index",
    description:
      "Drops a FULLTEXT index from a table. Use this to remove a fulltext index that is no longer needed.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table",
        },
        index_name: {
          type: "string",
          description: "Optional: name of the index to drop (default: first fulltext index found)",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "get_fulltext_stats",
    description:
      "Retrieves statistics for FULLTEXT indexes on a table including document count, size, and key length. Use this to analyze index performance and size.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
  {
    name: "optimize_fulltext",
    description:
      "Optimizes a table to update FULLTEXT index statistics and reclaim space. Use this after bulk inserts or updates to improve search performance.",
    inputSchema: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description: "Name of the table to optimize",
        },
        database: {
          type: "string",
          description: "Optional: specific database name",
        },
      },
      required: ["table_name"],
    },
  },
];

// Create the MCP server
const server = new Server(
  {
    name: SERVER_NAME,
    version: SERVER_VERSION,
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

// Handle list tools request - filter tools based on permissions and categories
server.setRequestHandler(ListToolsRequestSchema, async () => {
  const enabledTools = getEnabledTools(mysqlMCP, TOOLS);

  // Log the filtering results
  console.error(
    `Tools available: ${enabledTools.length} of ${TOOLS.length} total tools`,
  );

  return {
    tools: enabledTools,
  };
});

type CursorRequestMode = "auto" | "select" | "write" | "ddl";

interface CursorBridgeRequest {
  tool?: string;
  toolName?: string;
  name?: string;
  arguments?: Record<string, any>;
  args?: Record<string, any>;
  query?: string;
  params?: any[];
  mode?: CursorRequestMode;
  dry_run?: boolean;
}

const TOOL_METHOD_OVERRIDES: Record<string, string> = {
  get_schema_erd: "getSchemaERD",
  export_table_to_csv: "exportTableToCSV",
  export_query_to_csv: "exportQueryToCSV",
};

const toCamelCase = (value: string): string =>
  value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

const getRuntimeToolCatalog = () => {
  const enabledTools = getEnabledTools(mysqlMCP, TOOLS);

  return {
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
    enabledToolNames: enabledTools.map((tool) => tool.name),
    accessProfile: mysqlMCP.getAccessProfile(),
    serverName: SERVER_NAME,
    serverVersion: SERVER_VERSION,
  };
};

const getCursorRequestFilePath = (): string => {
  const configuredPath =
    process.env.MYSQL_MCP_CURSOR_REQUEST_FILE ||
    process.env.MCP_MYSQL_REQUEST_FILE ||
    ".cursor/mysql-mcp-request.json";

  return path.isAbsolute(configuredPath)
    ? configuredPath
    : path.resolve(process.cwd(), configuredPath);
};

const inferSqlToolName = (query: string, mode: CursorRequestMode = "auto"): string => {
  const upperQuery = query.trim().toUpperCase();

  if (mode === "select") return "run_select_query";
  if (mode === "write") return "execute_write_query";
  if (mode === "ddl") return "execute_ddl";

  if (/^(CREATE|ALTER|DROP|TRUNCATE|RENAME)\b/.test(upperQuery)) {
    return "execute_ddl";
  }

  if (/^(INSERT|UPDATE|DELETE|REPLACE)\b/.test(upperQuery)) {
    return "execute_write_query";
  }

  if (/^(SELECT|WITH)\b/.test(upperQuery)) {
    return "run_select_query";
  }

  throw new Error(
    "Unable to infer SQL tool. Set mode to one of: select, write, ddl.",
  );
};

const executeToolByName = async (
  toolName: string,
  args: Record<string, any> = {},
): Promise<any> => {
  const knownToolNames = new Set(TOOLS.map((tool) => tool.name));

  if (!knownToolNames.has(toolName)) {
    throw new Error(`Unknown tool for Cursor bridge: ${toolName}`);
  }

  if (toolName === "cursor_execute_request") {
    throw new Error("cursor_execute_request cannot dispatch to itself");
  }

  const validation = validateToolArguments(toolName, args);
  if (!validation.valid) {
    throw new Error(
      `Validation Error: ${validation.errors?.join(", ") || "Invalid arguments"}`,
    );
  }

  if (toolName === "list_all_tools") {
    return await mysqlMCP.listAllTools(getRuntimeToolCatalog());
  }

  const methodName = TOOL_METHOD_OVERRIDES[toolName] || toCamelCase(toolName);
  const method = (mysqlMCP as any)[methodName];

  if (typeof method !== "function") {
    throw new Error(`No handler method found for Cursor bridge tool: ${toolName}`);
  }

  return await method.call(mysqlMCP, args);
};

const executeCursorRequest = async (): Promise<any> => {
  const requestFilePath = getCursorRequestFilePath();

  if (!fs.existsSync(requestFilePath)) {
    return {
      status: "error",
      error:
        `Cursor request file not found: ${requestFilePath}. ` +
        'Create it with JSON like {"tool":"execute_ddl","arguments":{"query":"DROP TABLE IF EXISTS spark_processes;"}}',
    };
  }

  let request: CursorBridgeRequest;
  try {
    request = JSON.parse(fs.readFileSync(requestFilePath, "utf8"));
  } catch (error: any) {
    return {
      status: "error",
      error: `Failed to read Cursor request file: ${error.message}`,
    };
  }

  const requestedTool = request.tool || request.toolName || request.name;

  if (requestedTool) {
    return await executeToolByName(
      requestedTool,
      request.arguments || request.args || {},
    );
  }

  if (request.query) {
    const inferredTool = inferSqlToolName(request.query, request.mode || "auto");
    return await executeToolByName(inferredTool, {
      query: request.query,
      params: request.params,
      dry_run: request.dry_run,
    });
  }

  return {
    status: "error",
    error:
      "Cursor request must contain either tool/toolName/name with arguments, or query with optional mode.",
  };
};

// Handle tool call requests
server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
  const { name, arguments: args } = request.params;

  // Validate tool arguments before execution
  const validation = validateToolArguments(name, args);
  if (!validation.valid) {
    return {
      content: [
        {
          type: "text",
          text: `Validation Error: ${validation.errors?.join(', ') || 'Invalid arguments'}`,
        },
      ],
      isError: true,
    };
  }

  try {
    let result;

    switch (name) {
      case "list_databases":
        result = await mysqlMCP.listDatabases();
        break;

      case "list_tables":
        result = await mysqlMCP.listTables(
          (args || {}) as { database?: string },
        );
        break;

      case "get_database_summary":
        result = await mysqlMCP.getDatabaseSummary(
          (args || {}) as { 
            database?: string;
            max_tables?: number;
            include_relationships?: boolean;
          },
        );
        break;

      case "get_schema_erd":
        result = await mysqlMCP.getSchemaERD(
          (args || {}) as { database?: string },
        );
        break;

      case "get_schema_rag_context":
        result = await mysqlMCP.getSchemaRagContext(
          (args || {}) as {
            database?: string;
            max_tables?: number;
            max_columns?: number;
            include_relationships?: boolean;
            include_comments?: boolean;
            keyword_filter?: string;
          },
        );
        break;

      case "find_tables_by_keyword":
        result = await mysqlMCP.findTablesByKeyword(
          (args || {}) as {
            keyword: string;
            search_in?: "table_names" | "column_names" | "comments" | "all";
            database?: string;
            limit?: number;
          },
        );
        break;

      case "search_schema":
        result = await mysqlMCP.searchSchema(
          (args || {}) as {
            query: string;
            modes?: Array<"table_names" | "column_names" | "comments" | "sample_data">;
            max_results?: number;
            database?: string;
            tables?: string[];
            columns?: string[];
            max_tables?: number;
            limit_per_table?: number;
          },
        );
        break;

      case "search_data_across_tables":
        result = await mysqlMCP.searchDataAcrossTables(
          (args || {}) as {
            keyword: string;
            tables?: string[];
            columns?: string[];
            database?: string;
            limit_per_table?: number;
            max_tables?: number;
          },
        );
        break;

      case "get_column_statistics":
        result = await mysqlMCP.getColumnStatistics(
          (args || {}) as {
            table_name: string;
            column_name: string;
            database?: string;
          },
        );
        break;

      case "read_table_schema":
        result = await mysqlMCP.readTableSchema(
          (args || {}) as { table_name: string },
        );
        break;

      // CRUD Tools
      case "create_record":
        result = await mysqlMCP.createRecord(
          (args || {}) as { table_name: string; data: Record<string, any> },
        );
        break;

      case "read_records":
        result = await mysqlMCP.readRecords(
          (args || {}) as {
            table_name: string;
            filters?: any[];
            pagination?: { page: number; limit: number };
            sorting?: { field: string; direction: "asc" | "desc" };
          },
        );
        break;

      case "update_record":
        result = await mysqlMCP.updateRecord(
          (args || {}) as {
            table_name: string;
            data: Record<string, any>;
            conditions: any[];
          },
        );
        break;

      case "delete_record":
        result = await mysqlMCP.deleteRecord(
          (args || {}) as { table_name: string; conditions: any[] },
        );
        break;

      // Bulk Operations
      case "bulk_insert":
        result = await mysqlMCP.bulkInsert(
          (args || {}) as {
            table_name: string;
            data: Record<string, any>[];
            batch_size?: number;
          },
        );
        break;

      case "bulk_update":
        result = await mysqlMCP.bulkUpdate(
          (args || {}) as {
            table_name: string;
            updates: Array<{
              data: Record<string, any>;
              conditions: any[];
            }>;
            batch_size?: number;
          },
        );
        break;

      case "bulk_delete":
        result = await mysqlMCP.bulkDelete(
          (args || {}) as {
            table_name: string;
            condition_sets: any[][];
            batch_size?: number;
          },
        );
        break;

      case "plan_seed_data":
        result = await mysqlMCP.planSeedData(args || {});
        break;

      case "generate_seed_preview":
        result = await mysqlMCP.generateSeedPreview(args || {});
        break;

      case "execute_seed_plan":
        result = await mysqlMCP.executeSeedPlan(args || {});
        break;

      case "validate_seed_integrity":
        result = await mysqlMCP.validateSeedIntegrity(args || {});
        break;

      case "infer_seed_rules":
        result = await mysqlMCP.inferSeedRules(args || {});
        break;

      case "seed_from_template":
        result = await mysqlMCP.seedFromTemplate(args || {});
        break;

      // Query Tools
      case "run_select_query":
        result = await mysqlMCP.runSelectQuery(
          (args || {}) as {
            query: string;
            params?: any[];
            hints?: any;
            useCache?: boolean;
            dry_run?: boolean;
          },
        );
        break;

      case "execute_write_query":
        result = await mysqlMCP.executeWriteQuery(
          (args || {}) as { query: string; params?: any[] },
        );
        break;

      // DDL Tools
      case "create_table":
        result = await mysqlMCP.createTable(args || {});
        break;

      case "alter_table":
        result = await mysqlMCP.alterTable(args || {});
        break;

      case "drop_table":
        result = await mysqlMCP.dropTable(args || {});
        break;

      case "execute_ddl":
        result = await mysqlMCP.executeDdl((args || {}) as { query: string });
        break;

      case "describe_connection":
        result = await mysqlMCP.describeConnection();
        break;

      case "cursor_execute_request":
        result = await executeCursorRequest();
        break;

      case "test_connection":
        result = await mysqlMCP.testConnection();
        break;

      case "list_all_tools":
        result = await mysqlMCP.listAllTools(getRuntimeToolCatalog());
        break;

      case "read_changelog":
        result = await mysqlMCP.readChangelog(
          (args || {}) as { version?: string; limit?: number },
        );
        break;

      case "get_all_tables_relationships":
        result = await mysqlMCP.getAllTablesRelationships(
          (args || {}) as { database?: string },
        );
        break;

      // Transaction Tools
      case "begin_transaction":
        result = await mysqlMCP.beginTransaction(
          (args || {}) as { transactionId?: string },
        );
        break;

      case "commit_transaction":
        result = await mysqlMCP.commitTransaction(
          (args || {}) as { transactionId: string },
        );
        break;

      case "rollback_transaction":
        result = await mysqlMCP.rollbackTransaction(
          (args || {}) as { transactionId: string },
        );
        break;

      case "get_transaction_status":
        result = await mysqlMCP.getTransactionStatus();
        break;

      case "execute_in_transaction":
        result = await mysqlMCP.executeInTransaction(
          (args || {}) as {
            transactionId: string;
            query: string;
            params?: any[];
          },
        );
        break;

      // Stored Procedure Tools
      case "list_stored_procedures":
        result = await mysqlMCP.listStoredProcedures(
          (args || {}) as { database?: string },
        );
        break;

      case "get_stored_procedure_info":
        result = await mysqlMCP.getStoredProcedureInfo(
          (args || {}) as { procedure_name: string; database?: string },
        );
        break;

      case "execute_stored_procedure":
        result = await mysqlMCP.executeStoredProcedure(
          (args || {}) as {
            procedure_name: string;
            parameters?: any[];
            database?: string;
          },
        );
        break;

      case "create_stored_procedure":
        result = await mysqlMCP.createStoredProcedure((args || {}) as any);
        break;

      case "drop_stored_procedure":
        result = await mysqlMCP.dropStoredProcedure(
          (args || {}) as {
            procedure_name: string;
            if_exists?: boolean;
            database?: string;
          },
        );
        break;

      case "show_create_procedure":
        result = await mysqlMCP.showCreateProcedure(
          (args || {}) as { procedure_name: string; database?: string },
        );
        break;

      // Data Export Tools
      case "export_table_to_csv":
        result = await mysqlMCP.exportTableToCSV((args || {}) as any);
        break;

      case "export_query_to_csv":
        result = await mysqlMCP.exportQueryToCSV(
          (args || {}) as {
            query: string;
            params?: any[];
            include_headers?: boolean;
          },
        );
        break;

      // Query Optimization Tools
      case "analyze_query":
        result = mysqlMCP.analyzeQuery((args || {}) as { query: string });
        break;

      case "get_optimization_hints":
        result = mysqlMCP.getOptimizationHints(
          (args || {}) as { goal: "SPEED" | "MEMORY" | "STABILITY" },
        );
        break;

      // View Tools
      case "list_views":
        result = await mysqlMCP.listViews((args || {}) as any);
        break;
      case "get_view_info":
        result = await mysqlMCP.getViewInfo((args || {}) as any);
        break;
      case "create_view":
        result = await mysqlMCP.createView((args || {}) as any);
        break;
      case "alter_view":
        result = await mysqlMCP.alterView((args || {}) as any);
        break;
      case "drop_view":
        result = await mysqlMCP.dropView((args || {}) as any);
        break;
      case "show_create_view":
        result = await mysqlMCP.showCreateView((args || {}) as any);
        break;

      // Trigger Tools
      case "list_triggers":
        result = await mysqlMCP.listTriggers((args || {}) as any);
        break;
      case "get_trigger_info":
        result = await mysqlMCP.getTriggerInfo((args || {}) as any);
        break;
      case "create_trigger":
        result = await mysqlMCP.createTrigger((args || {}) as any);
        break;
      case "drop_trigger":
        result = await mysqlMCP.dropTrigger((args || {}) as any);
        break;
      case "show_create_trigger":
        result = await mysqlMCP.showCreateTrigger((args || {}) as any);
        break;

      // Index Tools
      case "list_indexes":
        result = await mysqlMCP.listIndexes((args || {}) as any);
        break;
      case "get_index_info":
        result = await mysqlMCP.getIndexInfo((args || {}) as any);
        break;
      case "create_index":
        result = await mysqlMCP.createIndex((args || {}) as any);
        break;
      case "drop_index":
        result = await mysqlMCP.dropIndex((args || {}) as any);
        break;
      case "analyze_index":
        result = await mysqlMCP.analyzeIndex((args || {}) as any);
        break;

      // Constraint Tools
      case "list_foreign_keys":
        result = await mysqlMCP.listForeignKeys((args || {}) as any);
        break;
      case "list_constraints":
        result = await mysqlMCP.listConstraints((args || {}) as any);
        break;
      case "add_foreign_key":
        result = await mysqlMCP.addForeignKey((args || {}) as any);
        break;
      case "drop_foreign_key":
        result = await mysqlMCP.dropForeignKey((args || {}) as any);
        break;
      case "add_unique_constraint":
        result = await mysqlMCP.addUniqueConstraint((args || {}) as any);
        break;
      case "drop_constraint":
        result = await mysqlMCP.dropConstraint((args || {}) as any);
        break;
      case "add_check_constraint":
        result = await mysqlMCP.addCheckConstraint((args || {}) as any);
        break;

      // Table Maintenance Tools
      case "analyze_table":
        result = await mysqlMCP.analyzeTable((args || {}) as any);
        break;
      case "optimize_table":
        result = await mysqlMCP.optimizeTable((args || {}) as any);
        break;
      case "check_table":
        result = await mysqlMCP.checkTable((args || {}) as any);
        break;
      case "repair_table":
        result = await mysqlMCP.repairTable((args || {}) as any);
        break;
      case "truncate_table":
        result = await mysqlMCP.truncateTable((args || {}) as any);
        break;
      case "get_table_status":
        result = await mysqlMCP.getTableStatus((args || {}) as any);
        break;
      case "flush_table":
        result = await mysqlMCP.flushTable((args || {}) as any);
        break;
      case "get_table_size":
        result = await mysqlMCP.getTableSize((args || {}) as any);
        break;

      case "repair_query":
        result = await mysqlMCP.repairQuery(
          (args || {}) as { query: string; error_message?: string },
        );
        break;

      case "create_fulltext_index":
        result = await mysqlMCP.createFulltextIndex(
          (args || {}) as {
            table_name: string;
            columns: string[];
            index_name?: string;
            parser?: "ngram" | "mecab";
            ngram_token_size?: number;
            database?: string;
          },
        );
        break;

      case "fulltext_search":
        result = await mysqlMCP.fulltextSearch(
          (args || {}) as {
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
          },
        );
        break;

      case "get_fulltext_info":
        result = await mysqlMCP.getFulltextInfo(
          (args || {}) as {
            table_name: string;
            index_name?: string;
            database?: string;
          },
        );
        break;

      case "drop_fulltext_index":
        result = await mysqlMCP.dropFulltextIndex(
          (args || {}) as {
            table_name: string;
            index_name?: string;
            database?: string;
          },
        );
        break;

      case "get_fulltext_stats":
        result = await mysqlMCP.getFulltextStats(
          (args || {}) as {
            table_name: string;
            database?: string;
          },
        );
        break;

      case "optimize_fulltext":
        result = await mysqlMCP.optimizeFulltext(
          (args || {}) as {
            table_name: string;
            database?: string;
          },
        );
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Handle the result based on status
    if (result.status === "error") {
      let errorText = `Error: ${"error" in result ? result.error : "Unknown error"}`;

      return {
        content: [
          {
            type: "text",
            text: errorText,
          },
        ],
        isError: true,
      };
    }

    // Return successful result - handle different result types
    let responseData: any;
    if ("data" in result) {
      // Standard result with data property
      responseData = result.data;
    } else if ("transactionId" in result) {
      // Transaction result
      responseData = {
        transactionId: result.transactionId,
      } as any;

      if ("message" in result && result.message) {
        responseData.message = result.message;
      }

      if ("activeTransactions" in result && result.activeTransactions) {
        responseData.activeTransactions = result.activeTransactions;
      }
    } else if ("message" in result) {
      // Simple message result
      responseData = { message: result.message };
    } else {
      // Fallback
      responseData = result;
    }

    // If no query log, return data as before
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(responseData, null, 2),
        },
      ],
    };
  } catch (error: any) {
    // Check if this is a permission error
    if (error.message && error.message.includes("Permission denied")) {
      return {
        content: [
          {
            type: "text",
            text: `❌ ${error.message}`,
          },
        ],
        isError: true,
      };
    }

    // Handle other errors with generic message
    return {
      content: [
        {
          type: "text",
          text: `Error executing tool: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Initialize the MySQL MCP instance AFTER transport is connected
  // This ensures the database connection pool is created when the server is ready
  mysqlMCP = new MySQLMCP(permissions, categories);

  // Log the effective filtering configuration to stderr
  const accessProfile = mysqlMCP.getAccessProfile();
  console.error(`Permissions (resolved): ${accessProfile.permissions}`);
  if (accessProfile.categories) {
    console.error(`Categories (resolved): ${accessProfile.categories}`);
  }
  console.error(`Filtering mode: ${accessProfile.filteringMode}`);

  // Log to stderr (not stdout, which is used for MCP protocol)
  console.error("MySQL MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
