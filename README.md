# MySQL MCP Server

<div align="center">

**A production-ready Model Context Protocol (MCP) server for MySQL database integration with AI agents**

**Last Updated:** 2026-10-26 16:39:47

[![npm version](https://img.shields.io/npm/v/@berthojoris/mcp-mysql-server)](https://www.npmjs.com/package/@berthojoris/mcp-mysql-server)
[![npm downloads](https://img.shields.io/npm/dm/@berthojoris/mcp-mysql-server)](https://www.npmjs.com/package/@berthojoris/mcp-mysql-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue.svg)](https://www.typescriptlang.org/)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)

[Installation](#installation) · [Quick Start](#quick-start) · [Configuration](#ai-agent-configuration) · [Remote Access](#remote-access-chatgpt--other-remote-mcp-clients) · [Permissions](#permission-system) · [Tools](#available-tools) · [Documentation](DOCUMENTATIONS.md)

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

For dual-layer and environment-variable configuration, see **[DOCUMENTATIONS.md → Configuration](DOCUMENTATIONS.md#configuration)**. To connect remote clients such as ChatGPT over HTTP, see [Remote Access](#remote-access-chatgpt--other-remote-mcp-clients).

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

See [AI Agent Configuration](#ai-agent-configuration) section below.

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

The examples below use the default stdio transport, where the AI agent starts the server itself. Remote clients connect over HTTP instead; see [Remote Access](#remote-access-chatgpt--other-remote-mcp-clients).

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

More configuration details are in **[DOCUMENTATIONS.md → Configuration](DOCUMENTATIONS.md#configuration)**.

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

### Remote Access (ChatGPT & other remote MCP clients)

stdio stays the default. For remote clients such as ChatGPT connectors / developer mode, you can enable the **Streamable HTTP** transport with a flag or an environment variable, the same way you set permissions. Remove the flag, or set `MCP_TRANSPORT=stdio`, to turn it off again.

```bash
# Read-only MySQL account + bearer token, bound to localhost
export MCP_HTTP_AUTH=token
export MCP_HTTP_AUTH_TOKENS=$(openssl rand -hex 32)   # give this token to your clients
npx -y @berthojoris/mcp-mysql-server mysql://mcp_reader:pass@localhost:3306/app "list,read,utility" --transport=http --port=3000
```

- **Endpoint**: `http://127.0.0.1:3000/mcp`, plus `GET /health`. Publish it over HTTPS with a reverse proxy or tunnel, and set `MCP_HTTP_PUBLIC_URL`.
- **Auth**: `MCP_HTTP_AUTH=token` (bearer tokens) or `oauth` (OAuth 2.1 JWT validation against your authorization server, with RFC 9728 metadata, as needed by ChatGPT). `none` only works on loopback.
- **Isolation**: `Host`/`Origin` checks (DNS-rebinding protection). Each session is bound to its identity, and each transaction to its session. A session's open transactions are rolled back when it closes or expires.
- **Startup checks**: invalid or unsafe HTTP settings stop the server with an error. `MCP_HTTP_*` settings are ignored over stdio.
- **Tool annotations**: every tool reports `readOnlyHint` and `destructiveHint`.

#### Protection defaults

Protections are **on by default in HTTP mode and off by default over stdio**, so existing stdio setups behave as before. Every value can be overridden with an environment variable on either transport.

| Variable | stdio default | HTTP default | What it does |
|----------|---------------|--------------|--------------|
| `MCP_QUERY_TIMEOUT_MS` | `0` (off) | `30000` | Cancels longer statements on the MySQL server with `KILL QUERY`. A timed-out statement inside a transaction rolls that transaction back |
| `MCP_RATE_LIMIT_PER_MINUTE` | `0` (off) | `60` | Tool calls per client per minute. The client is the auth identity, or the IP when there is none |
| `MCP_MAX_RESULT_BYTES` | `0` (off) | `524288` | Maximum result size. Row arrays are truncated to fit; other oversized results return an error |
| `MCP_AUDIT_LOG` | `off` | `stderr` | `off`, `stderr`, or a file path. One JSON line per tool call, authentication failure, and session open/close. SQL text is logged; other argument values are not |
| `MCP_REQUIRE_READONLY_DB_USER` | `false` | `false` | `true` makes startup fail if the MySQL user can write. In HTTP mode a warning is always logged |

#### HTTP settings

| Variable / flag | Default | What it does |
|-----------------|---------|--------------|
| `MCP_TRANSPORT` / `--transport=stdio\|http`, `--http` | `stdio` | Turns the HTTP transport on or off |
| `MCP_HTTP_HOST` / `--host=` | `127.0.0.1` | Bind address |
| `MCP_HTTP_PORT` / `--port=` | `3000` | Port |
| `MCP_HTTP_PATH` | `/mcp` | Endpoint path |
| `MCP_HTTP_PUBLIC_URL` | – | Public HTTPS base URL. Required for `oauth` |
| `MCP_HTTP_AUTH` | `none` | `none` (loopback only), `token`, or `oauth` |
| `MCP_HTTP_AUTH_TOKENS` | – | Comma-separated bearer tokens, at least 32 characters each |
| `MCP_OAUTH_ISSUER` / `MCP_OAUTH_AUDIENCE` / `MCP_OAUTH_JWKS_URI` / `MCP_OAUTH_REQUIRED_SCOPES` | – / resource URL / discovered / – | OAuth 2.1 token validation |
| `MCP_HTTP_ALLOWED_HOSTS` | loopback names when bound to loopback | `Host` allowlist. Off (with a warning) when bound to a non-loopback address and neither this nor `MCP_HTTP_PUBLIC_URL` is set |
| `MCP_HTTP_ALLOWED_ORIGINS` | loopback origins when bound to loopback | Browser `Origin` allowlist. Requests without `Origin` are always allowed |
| `MCP_HTTP_TRUST_PROXY` | `false` | Take the client IP from `X-Forwarded-For` |
| `MCP_HTTP_ALLOW_UNAUTHENTICATED` | `false` | Allow `none` outside loopback (not recommended) |
| `MCP_HTTP_MAX_SESSIONS` | `100` | Maximum concurrent sessions (`0` = no limit) |
| `MCP_HTTP_SESSION_IDLE_TIMEOUT_MS` | `1800000` | Idle sessions close after this time, and their transactions roll back (`0` = never) |
| `MCP_HTTP_MAX_BODY_BYTES` | `1048576` | Maximum request body size (`0` = no limit) |

In HTTP mode the server runs as a standalone service, so put the settings in `.env` (or your process manager) instead of an MCP client's `command` config:

```env
DB_HOST=localhost
DB_USER=mcp_reader
DB_PASSWORD=pass
DB_NAME=app
MCP_PERMISSIONS=list,read,utility
MCP_TRANSPORT=http
MCP_HTTP_PORT=3000
MCP_HTTP_AUTH=token
MCP_HTTP_AUTH_TOKENS=<64-hex-token>
MCP_QUERY_TIMEOUT_MS=15000
MCP_AUDIT_LOG=logs/mcp-audit.log
```

From the directory that holds `.env`, start it with `node dist/mcp-server.js` (from a clone) or the `npx` command above (a connection string argument overrides the `DB_*` values). Then point clients that support remote MCP servers at the URL. For example, in Claude Code's `.mcp.json`:

```json
{
  "mcpServers": {
    "mysql-remote": {
      "type": "http",
      "url": "http://127.0.0.1:3000/mcp",
      "headers": { "Authorization": "Bearer <64-hex-token>" }
    }
  }
}
```

Full details (OAuth setup, sessions, read-only user SQL) are in **[DOCUMENTATIONS.md → Remote Access](DOCUMENTATIONS.md#remote-access-streamable-http-transport-v1450-2026-10-26-144606)**.

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
| `ddl` | CREATE/ALTER/DROP tables; optimize, repair, and flush tables | Schema management |
| `procedure` | Stored procedures (CREATE/DROP/EXECUTE) | Procedure management |
| `transaction` | BEGIN, COMMIT, ROLLBACK | ACID operations |
| `utility` | Connection testing, diagnostics | Troubleshooting |

**Security changes in v1.46.0 (review before upgrading):**
- `optimize_table`, `repair_table`, `flush_table`, and `optimize_fulltext` now require `ddl` instead of `utility`, so the read-only default no longer includes them. `flush_table` is limited to the connected database and no longer accepts `with_read_lock`.
- `run_select_query` drops invalid optimizer hint values and validates the query again after hints are applied.
- System schema names are detected with whitespace around the dot (e.g. `mysql . user`).

**Changes in v1.44.0 (review before upgrading):**
- **Read-only by default**: with no permissions and no categories, the server now enables only `list,read,utility` (previously every tool). To keep full access, pass `list,read,create,update,delete,execute,ddl,utility,transaction,procedure`.
- **No implicit `mysql` schema**: without a database in the connection string or `DB_NAME`, database-scoped tools report "No database specified" instead of using the `mysql` system schema.
- **Query cache off by default**: opt in with `CACHE_ENABLED=true`. Any write and every transaction commit now clears the cache.
- **SQL validation**: `#`, `;`, and `--` inside string values (e.g. `'#fff'`) are no longer rejected. `WITH` (CTE) queries are supported and, like derived tables, need `execute` in read queries.

**Security changes in v1.43.4:**
- `EXPLAIN ANALYZE` runs the statement it wraps (MySQL 8.0.18+), so it now requires that statement's permission: `delete` for DELETE, `update` or `execute` for UPDATE, `read` for SELECT. Plan-only `EXPLAIN` still needs just `list` or `read`.

**Security changes in v1.43.3:**
- CSV exports require both `utility` and `read`; enable the `utilities` category when filtering categories.
- SQL within a transaction requires the corresponding operation permission. `transaction` alone does not permit reads or writes.
- `execute_write_query` accepts only INSERT/UPDATE/DELETE. DDL requires enabled DDL tools.
- Disabled tools cannot be called directly or through the Cursor bridge. The bridge requires `utility` and an enabled destination tool.
- `execute` does not bypass mandatory SQL safety restrictions, including file access and account/privilege changes.

Report suspected security issues privately via [Private Vulnerability Reporting](https://github.com/berthojoris/mysql-mcp/security/advisories/new); see [SECURITY.md](SECURITY.md) for the policy.

Filtering rules and per-permission details are documented in **[DOCUMENTATIONS.md → Permission System](DOCUMENTATIONS.md#permission-system)**.

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

Tool descriptions per category are in **[DOCUMENTATIONS.md → Tool Categories](DOCUMENTATIONS.md#tool-categories)**.

---

## Available Tools

The server exposes **88 tools** organized into categories (CRUD, seed, schema, discovery, and utilities).

- Complete list of tools: **[DOCUMENTATIONS.md → Tool Categories](DOCUMENTATIONS.md#tool-categories)**
- Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`); see **[DOCUMENTATIONS.md → Tool annotations](DOCUMENTATIONS.md#tool-annotations)**

---

## Detailed Documentation

For comprehensive documentation, see **[DOCUMENTATIONS.md](DOCUMENTATIONS.md)**:

- **Remote Access** - Streamable HTTP transport, bearer/OAuth authentication, sessions, protection settings, audit log

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
