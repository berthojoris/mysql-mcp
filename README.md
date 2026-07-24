# MySQL MCP Server

<div align="center">

**A production-ready Model Context Protocol (MCP) server for MySQL database integration with AI agents**

**Last Updated:** 2026-07-24 08:30:00

[![npm version](https://img.shields.io/npm/v/@berthojoris/mcp-mysql-server)](https://www.npmjs.com/package/@berthojoris/mcp-mysql-server)
[![npm downloads](https://img.shields.io/npm/dm/@berthojoris/mcp-mysql-server)](https://www.npmjs.com/package/@berthojoris/mcp-mysql-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)

[Installation](#-installation) · [Quick Start](#-quick-start) · [Configuration](#-ai-agent-configuration) · [Permissions](#-permission-system) · [Tools](#-available-tools) · [Documentation](DOCUMENTATIONS.md)

</div>

---

## TL;DR - Quick Setup

Run directly with `npx`:

```bash
npx @berthojoris/mcp-mysql-server mysql://user:pass@localhost:3306/mydb "list,read,utility"
```

Add to your AI agent config (`.mcp.json`, `.cursor/mcp.json`, etc.):

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "type": "stdio",
      "args": [
        "-y",
        "@berthojoris/mcp-mysql-server",
        "mysql://user:pass@localhost:3306/mydb",
        "list,read,utility"
      ]
    }
  }
}
```

For agent-specific examples (Codex TOML, Zed, local path, multi-DB), see **[DOCUMENTATIONS.md → Setup & Configuration](DOCUMENTATIONS.md#setup--configuration-extended)**.

---

## Installation

### Option 1: Quick Start with npx (Recommended)

No installation required - run directly:

```bash
npx @berthojoris/mcp-mysql-server mysql://user:pass@localhost:3306/db "list,read,utility"
```

### Option 2: Global Installation

```bash
npm install -g @berthojoris/mcp-mysql-server
mcp-mysql mysql://user:pass@localhost:3306/db "list,read,utility"
```

> **Credentials with special characters**: if your username or password contains characters that have a special meaning in URLs (`@`, `:`, `/`, `?`, `#`, `%`, `&`, etc.), URL-encode them before putting them in the connection string. For example, the password `p@ss:w0rd` becomes `p%40ss%3Aw0rd`, giving `mysql://user:p%40ss%3Aw0rd@host:3306/db`. The server decodes both the username and password before connecting.

---

## Quick Start

### 1. Set Up Environment (Optional)

Create `.env` file for local development:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=yourdatabase
MCP_CONFIG=list,read,utility
```

### 2. Build Project (If Cloned Locally)

```bash
npm install
npm run build
```

### 3. Configure Your AI Agent

See [AI Agent Configuration](#-ai-agent-configuration) section below.

### 4. Restart Your AI Agent

Completely restart your AI agent application to load the MCP server.

### 5. Test It!

Try asking your AI:

> "What databases are available?"
> "Show me all tables in my database"
> "What's the structure of the users table?"
> "Show me the first 5 records from users"

---

## AI Agent Configuration

### Standard JSON Configuration

Most AI agents use a similar JSON configuration format (the file location varies by tool).

If you want ready-to-copy snippets per client (Claude Code/Cursor/Windsurf/Cline/Codex/Zed), see **[DOCUMENTATIONS.md → Agent Configuration Examples](DOCUMENTATIONS.md#agent-configuration-examples)**.

**Universal Configuration Template:**

**Option 1: Single-Layer (Permissions Only) - Simple Setup**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "type": "stdio",
      "args": [
        "-y",
        "@berthojoris/mcp-mysql-server",
        "mysql://user:password@localhost:3306/database",
        "list,read,utility,create,update,ddl"
      ]
    }
  }
}
```

**Option 2: Dual-Layer (Permissions + Categories) - Recommended for Fine Control**
```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "type": "stdio",
      "args": [
        "-y",
        "@berthojoris/mcp-mysql-server",
        "mysql://user:password@localhost:3306/database_name_here",
        "list,read,utility,create,update,ddl,transaction",
        "database_discovery,crud_operations,custom_queries,schema_management,index_management,constraint_management,table_maintenance,query_optimization,analysis,seed_operations"
      ]
    }
  }
}
```

> **💡 Tip:** The dual-layer approach provides granular control. The 4th argument (permissions) controls broad access levels, while the 5th argument (categories) fine-tunes which specific tools are available.

### Environment Variables Configuration

Alternative approach using environment variables instead of connection string:

**Option 1: Permissions Only (Simple)**

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "type": "stdio",
      "args": ["-y", "@berthojoris/mcp-mysql-server"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_NAME": "your_database",
        "MCP_PERMISSIONS": "list,read,utility,create,update,delete"
      }
    }
  }
}
```

**Option 2: Permissions + Categories (Recommended)**

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "type": "stdio",
      "args": ["-y", "@berthojoris/mcp-mysql-server"],
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "3306",
        "DB_USER": "root",
        "DB_PASSWORD": "your_password",
        "DB_NAME": "your_database",
        "MCP_PERMISSIONS": "list,read,utility,create,update,delete",
        "MCP_CATEGORIES": "database_discovery,custom_queries,analysis"
      }
    }
  }
}
```

For more client-specific config snippets, see **[DOCUMENTATIONS.md → Setup & Configuration](DOCUMENTATIONS.md#setup--configuration-extended)**.

---

### Cursor Compatibility Bridge

If a Cursor MCP wrapper can call tools but cannot send `arguments`, use the no-argument `cursor_execute_request` bridge. Create `.cursor/mysql-mcp-request.json` in the workspace, then call `cursor_execute_request`:

```json
{
  "tool": "execute_ddl",
  "arguments": {
    "query": "DROP TABLE IF EXISTS spark_processes;"
  }
}
```

For direct SQL, the bridge can infer the right SQL tool:

```json
{
  "query": "DROP TABLE IF EXISTS spark_processes;",
  "mode": "auto"
}
```

Set `MYSQL_MCP_CURSOR_REQUEST_FILE` to override the request file path.

---

### AI Agent Tool Discovery

For Codex, Claude Code CLI, Cursor, Droid CLI, and other MCP agents, call `list_all_tools` first. It returns the live runtime catalog, enabled/disabled status, active permission/category profile, and recommended workflows for schema exploration, safe SELECT queries, CSV exports, transactions, and data changes.

Use `export_table_to_csv` for table-based exports and `export_query_to_csv` for SELECT query exports.

---

## Permission System

Control database access with a **dual-layer filtering system** that provides both broad and fine-grained control:

- **Layer 1 (Permissions)**: Broad operation-level control using legacy categories
- **Layer 2 (Categories)**: Optional fine-grained tool-level filtering using documentation categories

**Filtering Logic**: `Tool enabled = (Has Permission) AND (Has Category OR No categories specified)`

### Permissions

| Permission | Operations | Use Case |
|------------|------------|----------|
| `list` | List databases, tables, schemas | Database exploration |
| `read` | SELECT queries, read data | Analytics, reporting |
| `create` | INSERT new records | Data entry |
| `update` | UPDATE existing records | Data maintenance |
| `delete` | DELETE records | Data cleanup |
| `execute` | Execute custom INSERT/UPDATE SQL (DELETE requires `delete` permission too) | Complex write operations |
| `ddl` | CREATE/ALTER/DROP tables | Schema management |
| `procedure` | Stored procedures (CREATE/DROP/EXECUTE) | Procedure management |
| `transaction` | BEGIN, COMMIT, ROLLBACK | ACID operations |
| `utility` | Connection testing, diagnostics | Troubleshooting |

Common configuration examples are documented in **[DOCUMENTATIONS.md → Category Filtering System](DOCUMENTATIONS.md#🆕-category-filtering-system)**.

---

### Documentation Categories (Recommended)

Use documentation categories to fine-tune which tools are exposed (Layer 2):

| Category List | Use Case | List Tools |
|---------------|----------|-----------|
| `database_discovery` | Explore databases, tables, and schema structure | `get_all_tables_relationships, list_databases, list_tables, read_table_schema` |
| `crud_operations` | Create, read, update, delete operations on data | `create_record, delete_record, read_records, update_record` |
| `bulk_operations` | High-performance batch processing operations | `bulk_delete, bulk_insert, bulk_update` |
| `seed_operations` | FK-aware relational dummy data seeding | `execute_seed_plan, generate_seed_preview, infer_seed_rules, plan_seed_data, seed_from_template, validate_seed_integrity` |
| `custom_queries` | Execute custom SQL queries and advanced operations | `execute_write_query, run_select_query` |
| `schema_management` | Manage database schema, tables, and structure | `alter_table, create_table, drop_table, execute_ddl` |
| `utilities` | Database utilities, diagnostics, and helper functions | `cursor_execute_request, describe_connection, export_query_to_csv, export_table_to_csv, list_all_tools, read_changelog, test_connection` |
| `transaction_management` | Handle ACID transactions and rollback operations | `begin_transaction, commit_transaction, execute_in_transaction, get_transaction_status, rollback_transaction` |
| `stored_procedures` | Create, execute, and manage stored procedures | `create_stored_procedure, drop_stored_procedure, execute_stored_procedure, get_stored_procedure_info, list_stored_procedures, show_create_procedure` |
| `views_management` | Create and manage database views | `alter_view, create_view, drop_view, get_view_info, list_views, show_create_view` |
| `triggers_management` | Create and manage database triggers | `create_trigger, drop_trigger, get_trigger_info, list_triggers, show_create_trigger` |
| `index_management` | Optimize performance with index and fulltext management | `analyze_index, create_fulltext_index, create_index, drop_fulltext_index, drop_index, fulltext_search, get_fulltext_info, get_fulltext_stats, get_index_info, list_indexes, optimize_fulltext` |
| `constraint_management` | Manage data integrity constraints | `add_check_constraint, add_foreign_key, add_unique_constraint, drop_constraint, drop_foreign_key, list_constraints, list_foreign_keys` |
| `table_maintenance` | Table optimization, repair, and maintenance | `analyze_table, check_table, flush_table, get_table_size, get_table_status, optimize_table, repair_table, truncate_table` |
| `query_optimization` | Analyze and optimize SQL queries | `analyze_query, get_optimization_hints, repair_query` |
| `analysis` | Data analysis, schema discovery, and reporting tools | `find_tables_by_keyword, get_column_statistics, get_database_summary, get_schema_erd, get_schema_rag_context, search_data_across_tables, search_schema` |

<details>
  <summary>Copy/paste list (comma-separated, no spaces)</summary>

```text
database_discovery,crud_operations,bulk_operations,seed_operations,custom_queries,schema_management,utilities,transaction_management,stored_procedures,views_management,triggers_management,index_management,constraint_management,table_maintenance,query_optimization,analysis
```

</details>

Full category → tool mapping (and examples) lives in **[DOCUMENTATIONS.md → Category Filtering System](DOCUMENTATIONS.md#🆕-category-filtering-system)**.

---

## Available Tools

The server exposes **88 tools** organized into categories (CRUD, seed, schema, discovery, and utilities).

- Complete list of tools: **[DOCUMENTATIONS.md → Complete Tools Reference](DOCUMENTATIONS.md#🔧-complete-tools-reference)**

---

## Detailed Documentation

For comprehensive documentation, see **[DOCUMENTATIONS.md](DOCUMENTATIONS.md)**:

- **DDL Operations** - Create, alter, and drop tables
- **Data Export Tools** - Export data to CSV format
- **Relational Data Seeder** - Plan, preview, execute, validate, infer rules, and template FK-aware dummy data
- **Full-Text Search** - Create and search FULLTEXT indexes with multiple search modes
- **Transaction Management** - ACID transactions
- **Stored Procedures** - Create and execute with IN/OUT/INOUT parameters
- **Views & Triggers** - Manage database views and triggers
- **Index & Constraint Management** - Optimize performance and enforce data integrity
- **Table Maintenance** - Analyze, optimize, check, and repair tables
- **Query Logging** - See all SQL queries executed automatically
- **Security Features** - Built-in security and best practices
- **Bulk Operations** - High-performance batch processing
- **Troubleshooting** - Common issues and solutions

---

## MySQL MCP vs Manual Database Access

This MySQL MCP is a **powerful intermediary layer** between AI assistants and MySQL databases.

For full feature coverage and usage examples, see **[DOCUMENTATIONS.md](DOCUMENTATIONS.md)**.

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

<div align="center">

**Made with care for the AI development community**

*Enabling AI agents to interact with MySQL databases safely and efficiently*

[Report Bug](https://github.com/berthojoris/mysql-mcp/issues) · [Request Feature](https://github.com/berthojoris/mysql-mcp/issues) · [Documentation](DOCUMENTATIONS.md)

</div>
