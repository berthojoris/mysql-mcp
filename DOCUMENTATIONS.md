# MySQL MCP Server - Documentation

**Last Updated:** 2026-10-26 15:57:37
**Version:** 1.45.2
**Total Tools:** 88

Comprehensive documentation for the MySQL MCP Server. For quick start, see [README.md](README.md).

---

## Table of Contents

1. [Configuration](#configuration)
2. [Remote Access: Streamable HTTP Transport](#remote-access-streamable-http-transport-v1450-2026-10-26-144606)
3. [Permission System](#permission-system)
4. [Tool Categories](#tool-categories)
5. [Core Operations](#core-operations)
6. [Advanced Features](#advanced-features)
7. [Security Features](#security-features)
8. [Troubleshooting](#troubleshooting)

---

## Configuration

### Dual-Layer Access Control

Configure MySQL MCP with two access-control layers:

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
        "list,read,utility",
        "database_discovery,custom_queries,analysis"
      ]
    }
  }
}
```

**Layer 1 (Permissions)**: Broad operation control  
**Layer 2 (Categories)**: Fine-grained tool filtering  

> **Credentials with special characters**: if the username or password in the connection string contains URL-reserved characters (`@`, `:`, `/`, `?`, `#`, `%`, `&`, etc.), URL-encode them — e.g. the password `p@ss:w0rd` becomes `p%40ss%3Aw0rd`, giving `mysql://user:p%40ss%3Aw0rd@host:3306/db`. The server passes both the username and password through `decodeURIComponent()` before connecting, including when only one of the two is set.

### Environment Variables

```json
{
  "env": {
    "DB_HOST": "localhost",
    "DB_PORT": "3306", 
    "DB_USER": "root",
    "DB_PASSWORD": "your_password",
    "DB_NAME": "your_database",
    "MCP_PERMISSIONS": "list,read,utility",
    "MCP_CATEGORIES": "database_discovery,custom_queries,analysis"
  }
}
```

### Defaults (v1.44.0, 2026-10-26 13:35:39)

- **Permissions**: when neither permissions nor categories are given, the server starts **read-only** with `list,read,utility`. Earlier versions enabled every tool. To enable everything, pass the full list: `list,read,create,update,delete,execute,ddl,utility,transaction,procedure`.
- **Database**: when the connection string has no database and `DB_NAME` is unset, no database is selected and database-scoped tools return "No database specified". Earlier versions fell back to the `mysql` system schema.
- **Query cache**: disabled by default. Set `CACHE_ENABLED=true` to opt in (`CACHE_TTL_MS`, default `60000`; `CACHE_MAX_SIZE`, default `100`; `CACHE_MAX_MEMORY_MB`, default `50`). When enabled, any statement that can change data (outside or inside a transaction) and every transaction commit clears the whole cache. Writes made by other clients are not detected, so cached results can lag by up to the TTL.

---

### Remote Access: Streamable HTTP Transport (v1.45.0, 2026-10-26 14:46:06)

The server uses **stdio by default**. A remote transport (MCP Streamable HTTP) for ChatGPT connectors / developer mode and other remote MCP clients is **opt-in**. Turn it on and off the same way as permissions, with a CLI argument or an environment variable. If you leave it unset, existing stdio setups keep working exactly as before.

| Setting | CLI flag | Values |
|---------|----------|--------|
| `MCP_TRANSPORT` | `--transport=stdio\|http` (or `--http`) | `stdio` (default) or `http` |
| `MCP_HTTP_HOST` | `--host=<addr>` | Bind address, default `127.0.0.1` |
| `MCP_HTTP_PORT` | `--port=<n>` | Default `3000` |

Flags can go anywhere on the command line. They are not mistaken for the positional permissions/categories arguments, and an unknown `--` option stops startup with an error. A CLI flag overrides the matching environment variable (including values from `.env`).

When the transport is `stdio`, every `MCP_HTTP_*` and `MCP_OAUTH_*` variable is ignored, so even an invalid value cannot affect a stdio setup. In HTTP mode, an invalid or unsafe value stops startup with a message that names the variable.

```bash
# Enable HTTP via CLI
npx -y @berthojoris/mcp-mysql-server mysql://reader:pass@localhost:3306/app "list,read,utility" --transport=http --port=3000

# Enable HTTP via environment; unset MCP_TRANSPORT (or set it to "stdio") to disable
MCP_TRANSPORT=http MCP_HTTP_AUTH=token MCP_HTTP_AUTH_TOKENS=<64-hex-token> \
  npx -y @berthojoris/mcp-mysql-server mysql://reader:pass@localhost:3306/app
```

The MCP endpoint is `http://<host>:<port>/mcp` (set by `MCP_HTTP_PATH`). `GET /health` returns `{"status":"ok"}` and needs no authentication.

#### HTTP settings

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_HTTP_PATH` | `/mcp` | Endpoint path |
| `MCP_HTTP_PUBLIC_URL` | – | Public base URL as clients see it, e.g. `https://mcp.example.com`. Required for `oauth`. Its host is added to the allowed hosts |
| `MCP_HTTP_AUTH` | `none` | `none`, `token`, or `oauth` |
| `MCP_HTTP_AUTH_TOKENS` | – | For `token` mode: comma-separated bearer tokens, each at least 32 characters (`openssl rand -hex 32`) |
| `MCP_OAUTH_ISSUER` | – | For `oauth` mode: issuer of the external authorization server (Auth0, Keycloak, Okta, Entra ID, ...) |
| `MCP_OAUTH_AUDIENCE` | resource URL | Expected `aud` claim. Defaults to `MCP_HTTP_PUBLIC_URL` + `MCP_HTTP_PATH` |
| `MCP_OAUTH_JWKS_URI` | discovered | JWKS URL. When unset, it is discovered from the issuer's OpenID / OAuth metadata |
| `MCP_OAUTH_REQUIRED_SCOPES` | – | Comma-separated scopes that every token must carry |
| `MCP_HTTP_ALLOWED_HOSTS` | see description | Comma-separated `Host` header names (without port), for DNS-rebinding protection. Requests with any other `Host` get `403`. When unset and bound to a loopback address, `localhost`, `127.0.0.1`, and `[::1]` are allowed. When unset and bound to another address (e.g. `0.0.0.0`) with no `MCP_HTTP_PUBLIC_URL`, the check is off and a startup warning is logged |
| `MCP_HTTP_ALLOWED_ORIGINS` | see description | Comma-separated browser `Origin` values (e.g. `https://app.example.com`). A request with any other `Origin` gets `403`. When unset, loopback origins are allowed if the server is bound to loopback, and every `Origin` is rejected otherwise. Requests without `Origin` (server-to-server, such as ChatGPT's backend) are always allowed |
| `MCP_HTTP_TRUST_PROXY` | `false` | Use the first `X-Forwarded-For` address as the client IP for audit logs and rate limits. Enable only behind a trusted reverse proxy |
| `MCP_HTTP_ALLOW_UNAUTHENTICATED` | `false` | Allow `MCP_HTTP_AUTH=none` on a non-loopback bind address or with non-loopback allowed hosts. Not recommended |
| `MCP_HTTP_MAX_SESSIONS` | `100` | Maximum concurrent sessions. New sessions get `503` with `Retry-After: 60` once the limit is reached. `0` means no limit |
| `MCP_HTTP_SESSION_IDLE_TIMEOUT_MS` | `1800000` | Idle sessions are closed after this time, and their open transactions are rolled back. `0` disables expiry |
| `MCP_HTTP_MAX_BODY_BYTES` | `1048576` | Maximum request body size. Larger bodies get `413`. `0` means no limit |

`GET /health` skips the `Host` check, so load balancers can probe the server by IP.

The server does not terminate TLS. Put it behind a reverse proxy or tunnel that serves HTTPS (ChatGPT only connects to public HTTPS URLs), and set `MCP_HTTP_PUBLIC_URL` to that HTTPS address.

#### Authentication

- **`none`**: no authentication. The server only starts in this mode when it is bound to a loopback address and every allowed host is a loopback name. A tunnel that forwards a public hostname is then rejected by the `Host` check. `MCP_HTTP_ALLOW_UNAUTHENTICATED=true` overrides this rule.
- **`token`**: static bearer tokens (`Authorization: Bearer <token>`), compared in constant time. Use this for clients that can send a custom header, such as Claude Code, Cursor, or scripts. Each token gets a stable client id `token-<sha256 prefix>`, used in audit logs and rate limits.
- **`oauth`** (OAuth 2.1 resource server): the server validates JWT access tokens issued by an external authorization server. It does not issue tokens itself.
  - Supported algorithms are RS256/384/512, PS256/384/512, ES256/384/512, and EdDSA. `none` and HMAC algorithms are rejected.
  - The server checks the token's claims. `iss` must equal `MCP_OAUTH_ISSUER` (a trailing slash is ignored), and `aud` must contain the audience. `exp` is required, and `exp`/`nbf` allow 60 seconds of clock skew. Every scope in `MCP_OAUTH_REQUIRED_SCOPES` must appear in `scope` or `scp`; a missing scope returns `403` with `error="insufficient_scope"`.
  - The client id used for sessions, audit logs, and rate limits is taken from `client_id`, then `azp`, then `sub`.
  - Signing keys come from `MCP_OAUTH_JWKS_URI`, or else from `jwks_uri` in `<issuer>/.well-known/openid-configuration`, then from the RFC 8414 `oauth-authorization-server` document. Keys are cached for 10 minutes. A token with an unknown `kid` triggers a refetch, at most once every 30 seconds, so key rotation is picked up.
  - In `oauth` mode only, the server publishes Protected Resource Metadata (RFC 9728) at `/.well-known/oauth-protected-resource` and `/.well-known/oauth-protected-resource<path>`. `401` responses carry `WWW-Authenticate: Bearer resource_metadata="..."` so clients can discover the authorization server.
  - For ChatGPT, the authorization server must support the flow ChatGPT uses: authorization code + PKCE, typically with dynamic client registration.

```bash
MCP_TRANSPORT=http
MCP_HTTP_HOST=127.0.0.1
MCP_HTTP_PUBLIC_URL=https://mcp.example.com
MCP_HTTP_AUTH=oauth
MCP_OAUTH_ISSUER=https://your-tenant.auth0.com/
MCP_OAUTH_REQUIRED_SCOPES=mysql:read
```

#### Sessions

- Each client gets its own MCP session (`Mcp-Session-Id`), created by an `initialize` request. A session is bound to the identity that created it, and a request that presents another identity's session id is rejected with `403`. Other requests without a session id get `400`, and an unknown or expired session id gets `404`. `DELETE /mcp` ends a session.
- Transactions belong to the session that began them. Other sessions cannot see, use, commit, or roll them back; to them the transaction id does not exist. Transactions are rolled back when the session closes, expires, or the server shuts down (`SIGINT`/`SIGTERM`).
- A transaction id that is already in use is rejected instead of silently replacing the open transaction.
- Over stdio there is only one session, so behaviour does not change.

#### Protection settings (both transports)

These settings also apply to stdio, but there they default to **off**, so existing setups behave as before.

| Variable | stdio default | http default | Description |
|----------|---------------|--------------|-------------|
| `MCP_QUERY_TIMEOUT_MS` | `0` (off) | `30000` | Every SQL statement a tool runs is cancelled on the MySQL server with `KILL QUERY` once it runs longer than this. The tool returns `Query exceeded the <n> ms timeout and was cancelled`. If the statement is inside a transaction, that transaction is rolled back |
| `MCP_RATE_LIMIT_PER_MINUTE` | `0` (off) | `60` | Tool calls allowed per client in any 60-second window. The client is the auth identity, or the client IP when there is none (over stdio all calls share one bucket). Extra calls return a tool error with the retry delay |
| `MCP_MAX_RESULT_BYTES` | `0` (off) | `524288` | Maximum size of a tool result (its JSON text). Row arrays are cut to fit and wrapped as `{ rows, truncated, returned_rows, total_rows, message }`. Other oversized results return an error that asks for a narrower query |
| `MCP_AUDIT_LOG` | `off` | `stderr` | `off`, `stderr`, or a file path (relative paths resolve from the working directory; missing directories are created). See [Audit log](#audit-log) |
| `MCP_REQUIRE_READONLY_DB_USER` | `false` | `false` | When `true`, startup fails if the MySQL user holds any privilege beyond `SELECT`, `SHOW VIEW`, `SHOW DATABASES`, `PROCESS`, or `USAGE`. `WITH GRANT OPTION` and granted roles count as write privileges, because a role's privileges cannot be resolved |

In HTTP mode the server always runs `SHOW GRANTS` at startup and logs a warning if the MySQL user can write.

Query timeout details: the timed-out statement is cancelled through a separate short-lived connection that uses the same MySQL account (MySQL allows an account to kill its own threads). The pooled connection that ran the statement is then discarded rather than reused. With the timeout off, queries run on the pool exactly as before.

#### Audit log

Each line is a JSON object with a `time` and an `event`. Over `stderr`, lines are prefixed with `[audit] `. Nothing is ever written to stdout.

| Event | Fields |
|-------|--------|
| `tool_call` | `transport`, `session`, `client`, `ip`, `tool`, `args` (`names` of all arguments, plus `sql` truncated to 1000 characters when the call has a `query`/`sql` argument), `status` (`success`, `error`, `invalid`, `denied`, `rate_limited`), `durationMs`, `error` |
| `auth_failed` | `ip`, `reason` |
| `session_opened` | `session`, `client`, `ip` |
| `session_closed` | `session`, `client`, `reason` (`deleted by client`, `idle timeout`, `transport closed`, `server shutdown`) |

Argument values other than SQL text are not logged, because they can contain row data.

#### Recommended read-only database user

Permissions limit which tools are exposed. A read-only MySQL account limits what any SQL can do, even if a tool is misconfigured. For remote AI clients, connect with a dedicated account and keep the default `list,read,utility` permissions:

```sql
CREATE USER 'mcp_reader'@'%' IDENTIFIED BY '<strong password>';
GRANT SELECT, SHOW VIEW ON app.* TO 'mcp_reader'@'%';
```

#### Tool annotations

Every tool advertises MCP tool annotations: `title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint: false`. They appear in `tools/list` and in the `list_all_tools` catalog. Clients use them to tell read-only tools apart from tools that write or destroy data. ChatGPT uses `readOnlyHint` to decide when to ask the user for confirmation. Annotations are only hints and do not replace permissions.

| Class | Hints | Tools |
|-------|-------|-------|
| Read-only | `readOnlyHint: true` | Discovery, analysis, `read_records`, `run_select_query`, exports, `show_*`/`list_*`/`get_*`, `check_table`, `fulltext_search`, seed planning/preview tools |
| Write | `readOnlyHint: false`, `destructiveHint: false` | `create_record`, `bulk_insert`, `execute_seed_plan`, `begin_transaction`, `rollback_transaction`, `create_table`/`create_index`/`create_trigger`/`create_stored_procedure`/`create_fulltext_index`, `add_*` constraints; idempotent maintenance: `analyze_table`, `analyze_index`, `optimize_table`, `flush_table`, `optimize_fulltext` |
| Destructive | `destructiveHint: true` | `update_record`, `delete_record`, `bulk_update`, `bulk_delete`, `execute_write_query`, `execute_ddl`, `execute_in_transaction`, `commit_transaction`, `execute_stored_procedure`, `cursor_execute_request`, `alter_*`, `drop_*`, `create_view` (can replace a view), `repair_table`, `truncate_table` |

The full mapping is in `src/tools/toolAnnotations.ts`.

---

### Cursor Compatibility Bridge

Some Cursor MCP wrappers can call a tool by name but cannot pass `arguments`. For that flow, write a request file at `.cursor/mysql-mcp-request.json` and call the no-argument `cursor_execute_request` tool.

Execute any existing MCP tool:

```json
{
  "tool": "execute_ddl",
  "arguments": {
    "query": "DROP TABLE IF EXISTS spark_processes;"
  }
}
```

Or execute SQL directly with automatic routing:

```json
{
  "query": "DROP TABLE IF EXISTS spark_processes;",
  "mode": "auto"
}
```

Supported `mode` values are `auto`, `select`, `write`, and `ddl`. Set `MYSQL_MCP_CURSOR_REQUEST_FILE` (or its alias `MCP_MYSQL_REQUEST_FILE`) to override the request file path; relative paths resolve from the working directory.

The bridge requires `utility` permission and the `utilities` category when category filtering is enabled. The requested destination tool must also be enabled. Disabled tools cannot be called directly or through the bridge.

---

### AI Agent Tool Discovery

Use `list_all_tools` first when connecting from Codex, Claude Code CLI, Cursor, Droid CLI, or other MCP agents. It returns the live runtime catalog from the server, enabled/disabled status for each tool, the active permission/category profile, and recommended workflows for common agent tasks.

For CSV exports, use `export_table_to_csv` for table-based exports and `export_query_to_csv` for SELECT query exports.

---

## Permission System

### Available Permissions

| Permission | Operations | Example Tools |
|------------|------------|---------------|
| `list` | List/discover objects | `list_databases`, `list_tables` |
| `read` | Read data | `read_records`, `run_select_query` |
| `create` | Insert records and seed data | `create_record`, `bulk_insert`, `execute_seed_plan` |
| `update` | Update records | `update_record`, `bulk_update` |
| `delete` | Delete records | `delete_record`, `bulk_delete`, DELETE via `execute_write_query` (requires both `execute` and `delete`) |
| `execute` | Custom SQL (INSERT/UPDATE; not DELETE without `delete`) | `execute_write_query` |
| `ddl` | Schema changes; rebuilding, repairing or flushing tables | `create_table`, `alter_table`, `optimize_table`, `repair_table`, `flush_table`, `optimize_fulltext` |
| `utility` | Utility operations | `test_connection`, `analyze_table`, `check_table`, `analyze_index` |
| `transaction` | Transaction management | `begin_transaction`, `commit_transaction` |
| `procedure` | Stored procedures | `create_stored_procedure`, `execute_stored_procedure` |

### Filtering Logic

```
Tool enabled = (Has Permission) AND (Has Category OR No categories specified)
```

With no permissions and no categories configured, the effective permissions are `list,read,utility` (read-only default since v1.44.0). Categories alone keep all permissions and filter by category.

CSV exports require both `utility` and `read` permissions; their category remains `utilities`.

`execute_in_transaction` requires `transaction` plus the permission for the SQL operation: `read` for SELECT, `create` or `execute` for INSERT, `update` or `execute` for UPDATE, and `delete` for DELETE. DDL also requires `ddl` and an enabled `execute_ddl` tool. Transaction permission alone does not authorize reading or modifying data.

Information queries such as SHOW/DESCRIBE/EXPLAIN require `list` or `read`. MySQL DDL may implicitly commit, even when called through a transaction tool.

`EXPLAIN ANALYZE` (MySQL 8.0.18+) executes the statement it wraps, including multi-table UPDATE/DELETE, so it is authorized as that inner statement: `read` for SELECT, `update` or `execute` for UPDATE, and `delete` for DELETE. Plan-only `EXPLAIN` (without ANALYZE) remains an information query and only requires `list` or `read` (2026-10-12 20:39:13).

`optimize_table`, `repair_table`, `flush_table`, and `optimize_fulltext` rebuild, repair, or flush tables, so they require `ddl` instead of `utility` and are no longer part of the read-only default. `flush_table` only flushes tables in the connected database (all of them when `table_name` is omitted) and rejects `with_read_lock`, because the lock would stay held on a pooled connection after the call returns. `analyze_table`, `check_table`, and `analyze_index` remain `utility` tools (2026-10-26 16:39:47).

`run_select_query` optimizer `hints` are added to the SQL after it is validated, so every hint value is checked first: table and index names must be plain identifiers, `SEMIJOIN`/`SUBQUERY` strategies must be MySQL strategy names, `MAX_EXECUTION_TIME` must be a positive integer, and `SET_VAR` must be `name=value`. Invalid values are dropped, and the query with hints applied is validated again before it runs (2026-10-26 16:39:47).

Schema-qualified names are matched with any whitespace around the dot, so `mysql . user` is blocked like `mysql.user`, and `information_schema . tables` still requires `execute` (2026-10-26 16:39:47).

`execute_write_query` accepts only INSERT, UPDATE, and DELETE. Schema changes must use enabled DDL tools, even when `execute` and `ddl` permissions are both present.

---

## Tool Categories

### 1. Database Discovery (4 tools)
- `list_databases` - List all databases
- `list_tables` - List tables in database
- `read_table_schema` - Get table structure
- `get_all_tables_relationships` - Get all FK relationships

### 2. Analysis (7 tools)
- `get_database_summary` - Database overview with statistics
- `get_schema_erd` - Generate Mermaid.js ER diagram
- `get_schema_rag_context` - Compact schema for LLM context, with optional comments and keyword filtering
- `get_column_statistics` - Column data profiling
- `find_tables_by_keyword` - Ranked schema keyword search across table names, column names, and comments
- `search_schema` - Unified discovery for “where is X?” questions using schema metadata and optional sample-data search
- `search_data_across_tables` - Guarded read-only keyword search across text-like data columns

### 3. Data Operations (7 tools)
- `create_record` - Insert single record
- `read_records` - Query with filtering/pagination
- `update_record` - Update records
- `delete_record` - Delete records
- `bulk_insert` - Batch insert (performance)
- `bulk_update` - Batch update (performance)
- `bulk_delete` - Batch delete (performance)

### 4. Seed Operations (6 tools)
- `plan_seed_data` - Build FK-aware relational seed plans
- `generate_seed_preview` - Preview deterministic dummy rows without writing
- `execute_seed_plan` - Execute confirmed seed plans with transaction and rollback safety
- `validate_seed_integrity` - Validate row counts, FK orphans, required columns, and unique collisions
- `infer_seed_rules` - Infer advanced generators from schema, samples, unique indexes, and domain presets
- `seed_from_template` - Create reusable plan-first seed workflows for ecommerce, POS, and CRM domains

### 5. Query Management (2 tools)
- `run_select_query` - Execute SELECT queries
- `execute_write_query` - Execute INSERT/UPDATE (DELETE requires the `delete` permission)

### 6. Schema Management (4 tools)
- `create_table` - Create new tables
- `alter_table` - Modify table structure
- `drop_table` - Delete tables
- `execute_ddl` - Execute raw DDL

### 7. Data Export (2 tools)
- `export_table_to_csv` - Export table data to CSV
- `export_query_to_csv` - Export SELECT query results to CSV

### 8. Index Management (11 tools)
- `list_indexes` - List table indexes
- `get_index_info` - Get index details
- `create_index` - Create indexes
- `drop_index` - Drop indexes
- `analyze_index` - Analyze and update index statistics
- `create_fulltext_index` - Create FULLTEXT indexes for text search
- `fulltext_search` - Perform full-text search with MATCH AGAINST
- `get_fulltext_info` - Get FULLTEXT index information
- `drop_fulltext_index` - Drop FULLTEXT indexes
- `get_fulltext_stats` - Get FULLTEXT index statistics
- `optimize_fulltext` - Optimize FULLTEXT indexes (requires `ddl`)

### 9. Constraint Management (7 tools)
- `list_foreign_keys` - List foreign keys
- `list_constraints` - List all constraints
- `add_foreign_key` - Add foreign key
- `drop_foreign_key` - Remove foreign key
- `add_unique_constraint` - Add unique constraint
- `drop_constraint` - Remove constraint
- `add_check_constraint` - Add check constraint

### 10. Stored Procedures (6 tools)
- `list_stored_procedures` - List procedures
- `get_stored_procedure_info` - Get procedure details
- `execute_stored_procedure` - Execute procedures
- `create_stored_procedure` - Create procedures
- `drop_stored_procedure` - Remove procedures
- `show_create_procedure` - Show CREATE statement

### 11. Views Management (6 tools)
- `list_views` - List views
- `get_view_info` - Get view details
- `create_view` - Create views
- `alter_view` - Modify views
- `drop_view` - Remove views
- `show_create_view` - Show CREATE statement

### 12. Triggers Management (5 tools)
- `list_triggers` - List triggers
- `get_trigger_info` - Get trigger details
- `create_trigger` - Create triggers
- `drop_trigger` - Remove triggers
- `show_create_trigger` - Show CREATE statement

### 13. Table Maintenance (8 tools)
- `analyze_table` - Update statistics
- `optimize_table` - Reclaim space (requires `ddl`)
- `check_table` - Check for errors
- `repair_table` - Repair corrupted tables (requires `ddl`)
- `truncate_table` - Remove all rows
- `get_table_status` - Get table statistics
- `flush_table` - Close/reopen tables in the connected database (requires `ddl`)
- `get_table_size` - Get size information

### 14. Transaction Management (5 tools)
- `begin_transaction` - Start transaction
- `commit_transaction` - Commit transaction
- `rollback_transaction` - Rollback transaction
- `get_transaction_status` - Check transaction state
- `execute_in_transaction` - Execute within transaction

### 15. Query Optimization (3 tools)
- `analyze_query` - Analyze query performance
- `get_optimization_hints` - Get optimizer hints
- `repair_query` - Repair broken SQL queries

### 16. Utilities (5 tools)
- `test_connection` - Test connectivity
- `describe_connection` - Connection info
- `read_changelog` - Read changelog
- `cursor_execute_request` - Execute a file-backed request for clients that cannot send MCP arguments
- `list_all_tools` - Runtime tool catalog with agent guidance

---

## Core Operations

### Database Discovery

Start with these tools to explore any database:

```javascript
// List all databases
await mcp.call("list_databases", {});

// List tables in current database
await mcp.call("list_tables", {});

// Get comprehensive overview
await mcp.call("get_database_summary", {
  max_tables: 50,
  include_relationships: true
});

// Visualize relationships
await mcp.call("get_schema_erd", {});
```

### Schema & Data Discovery

Use these tools when users ask natural-language questions like “which table stores survey data?” or “where is customer feedback saved?”:

```javascript
// Fast metadata search across table names, column names, and comments
await mcp.call("find_tables_by_keyword", {
  keyword: "survey",
  search_in: "all",
  limit: 20
});

// Unified discovery with optional guarded sample-data scan
await mcp.call("search_schema", {
  query: "survey",
  modes: ["table_names", "column_names", "comments", "sample_data"],
  max_results: 20
});

// Direct bounded data scan when the keyword may only exist in row values
await mcp.call("search_data_across_tables", {
  keyword: "survey",
  max_tables: 20,
  limit_per_table: 3
});
```

`find_tables_by_keyword` requires `list`; `search_data_across_tables` requires `read`; `search_schema` uses `list` and requires `read` only when `sample_data` mode is enabled.

### Data Operations

Basic CRUD operations:

```javascript
// Create record
await mcp.call("create_record", {
  table_name: "users",
  data: { name: "John", email: "john@example.com" }
});

// Read with filtering
await mcp.call("read_records", {
  table_name: "users",
  filters: [{ field: "status", operator: "eq", value: "active" }],
  pagination: { page: 1, limit: 10 }
});

// Update records
await mcp.call("update_record", {
  table_name: "users",
  data: { status: "inactive" },
  conditions: [{ field: "last_login", operator: "lt", value: "2024-01-01" }]
});

// Delete records
await mcp.call("delete_record", {
  table_name: "users",
  conditions: [{ field: "status", operator: "eq", value: "deleted" }]
});
```

### Performance Operations

```javascript
// Analyze slow query
await mcp.call("analyze_query", {
  query: "SELECT * FROM users WHERE email LIKE '%@gmail.com'"
});

// Get optimization hints
await mcp.call("get_optimization_hints", {
  goal: "SPEED"
});
```

---

## Advanced Features

### Analysis

The server includes analysis tools for database insights:

- **Database Summary**: Provides readable overviews with statistics
- **ER Diagram Generation**: Automatic Mermaid.js diagrams
- **RAG Context**: Compact schema for LLM prompts, with optional `TABLE_COMMENT` / `COLUMN_COMMENT` inclusion and keyword filtering
- **Column Profiling**: Data quality and distribution analysis
- **Schema Keyword Discovery**: Ranked search for concepts across table names, column names, and metadata comments
- **Unified Search**: One entry point for schema and bounded sample-data discovery
- **Guarded Data Search**: Read-only LIKE scans across text-like columns with strict table/result limits

### Bulk Operations

For high-performance operations with large datasets:

- **Bulk Insert**: Handle thousands of records efficiently
- **Bulk Update**: Update multiple records with different conditions
- **Bulk Delete**: Delete multiple record sets in batches

### Relational Data Seeder

For dummy data on related tables, use the seed workflow:

```javascript
const plan = await mcp.call("plan_seed_data", {
  target_tables: ["orders"],
  rows_per_table: 20,
  include_dependencies: true,
  include_children: true,
  random_seed: 42
});

await mcp.call("generate_seed_preview", {
  plan_id: plan.plan_id,
  max_preview_rows_per_table: 3
});

await mcp.call("execute_seed_plan", {
  plan_id: plan.plan_id,
  dry_run: false,
  confirm_token: plan.confirm_token
});

await mcp.call("validate_seed_integrity", {
  plan_id: plan.plan_id
});
```

`execute_seed_plan` defaults to dry-run, requires confirmation for writes, blocks production-like database names unless explicitly allowed, and uses transaction rollback on errors.

Composite FK/PK support resolves multi-column parent tuples together, so relations such as `(tenant_id, region_id)` or `(tenant_id, region_id, order_id)` are not mixed across different parent rows.

Advanced rule inference and templates:

```javascript
await mcp.call("infer_seed_rules", {
  tables: ["orders", "order_items"],
  domain: "ecommerce",
  sample_size: 25
});

await mcp.call("seed_from_template", {
  template: "ecommerce",
  scale: "small",
  random_seed: 42
});
```

`seed_from_template` is plan-first and does not write data directly. Review its plan/preview, then execute with `execute_seed_plan`.

### Transaction Management

ACID transactions run on a dedicated connection. Run statements inside a transaction with `execute_in_transaction`; other tools such as `create_record` run outside it.

```javascript
const { transactionId } = await mcp.call("begin_transaction", {});
await mcp.call("execute_in_transaction", {
  transactionId,
  query: "INSERT INTO orders (customer_id, total) VALUES (?, ?)",
  params: [42, 99.5]
});
await mcp.call("execute_in_transaction", {
  transactionId,
  query: "UPDATE inventory SET stock = stock - 1 WHERE product_id = ?",
  params: [7]
});
await mcp.call("commit_transaction", { transactionId }); // or rollback_transaction
```

- `begin_transaction` accepts an optional `transactionId`. An id that is already in use is rejected (v1.45.0).
- `get_transaction_status` returns `activeTransactions`, the ids open in the caller's session (v1.45.0; earlier versions returned only a count message).
- Open transactions are rolled back after 30 minutes of inactivity or 1 hour in total. Over HTTP they are also rolled back when their session ends (see [Sessions](#sessions)).

---

## Security Features

### Permission-Based Access Control

- **Layer 1**: Broad permission categories (list, read, create, etc.)
- **Layer 2**: Fine-grained tool category filtering
- **Tool-level**: Each tool requires specific permissions
- **Execution-time enforcement**: Tool permissions and categories are checked for every call, including file-backed Cursor requests.
- **Mandatory SQL restrictions**: File access, account/privilege changes, dangerous server operations, comments, and multiple statements remain blocked even with `execute`. Execute permission permits advanced SELECT features, not bypassing these restrictions.
- **Quoted content (v1.44.0)**: Comment, statement-separator, and keyword checks ignore the contents of string literals and quoted identifiers, so values such as `'#fff'`, `'a;b'`, or `'x -- y'` are accepted. A literal containing a backslash is lexed differently depending on `NO_BACKSLASH_ESCAPES`, so such queries are checked strictly against the raw text.
- **Common table expressions (v1.44.0)**: `WITH ... SELECT/UPDATE/DELETE` is authorized as its main statement. Like derived tables and UNION, a CTE in a read query requires `execute`. A `WITH` clause that cannot be parsed is rejected.

### Vulnerability Reporting

Suspected security issues must be reported privately via GitHub Private Vulnerability Reporting; see `SECURITY.md` for the policy, reporting requirements, and disclosure timeline (added 2026-10-12 21:16:54).

### Data Protection

- **Query Validation**: Input validation and SQL injection prevention
- **No result masking**: Query and export results are returned unmasked. Restrict sensitive columns with database privileges or views.

### Remote Access Security (v1.45.0)

- **Opt-in HTTP**: the Streamable HTTP transport is off unless `MCP_TRANSPORT=http` or `--transport=http` is set. See [Remote Access](#remote-access-streamable-http-transport-v1450-2026-10-26-144606).
- **Authentication**: bearer tokens or OAuth 2.1 JWT validation. Unauthenticated mode is restricted to loopback.
- **DNS-rebinding protection**: `Host` and `Origin` headers are checked against allowlists.
- **Session isolation**: sessions are bound to their identity, and transactions to their session.
- **Database protection**: query timeout with server-side cancellation, a per-client rate limit, a result size limit, and an audit log.

### Connection Security

- **Environment Variables**: Secure credential management
- **Connection Testing**: Validation before operations
- **Error Handling**: Comprehensive error reporting

---

---

## Troubleshooting

### Common Issues

1. **Permission Denied**: Check both permission layers in error messages
2. **Connection Failed**: Verify database credentials and network
3. **Query Errors**: Use `repair_query` for diagnosis
4. **Performance Issues**: Use `analyze_query` and optimization hints

### MCP error `-32000: Connection closed` (local server)

If your client reports `MCP error -32000: Connection closed`, the server process is usually crashing on startup.

If you see `ReferenceError: exports is not defined in ES module scope` in the server stderr logs, update to **v1.33.2+** (fixes an ESM/CJS mismatch that caused the MCP process to exit immediately).

### Development

- `npm run build` removes `dist/` before compiling, so files deleted from `src/` are never published.
- `npm run dev` runs `src/mcp-server.ts` with ts-node (fixed in v1.44.0).
- `npm test` runs the Jest suite in `src/__tests__/` (SQL validator, permission defaults, cache invalidation; since v1.45.0 also runtime config, bearer/OAuth authentication, the Streamable HTTP server, tool annotations, grant inspection, and rate limiting). None of these tests need a database.

### Error Messages

The system provides detailed error messages indicating:

- Which permission layer blocked access
- Required permissions vs current permissions
- Specific category requirements
- SQL syntax and logic errors

---

*For detailed examples and advanced usage patterns, see the project README.md.*
