# Changelog

All notable changes to the MySQL MCP Server will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.43.2] - 2026-07-23

### Changed
- Version bump to `1.43.2` for npm publish.
- Synchronized version across `package.json`, `src/mcp-server.ts`, `DOCUMENTATIONS.md`, `README.md`, and `manifest.json`.

## [1.43.1] - 2026-05-26

### Fixed
- **URL-encoded credentials in MySQL connection strings** (#4): authentication failed when the username or password contained URL-encoded special characters (e.g. `@` → `%40`, `:` → `%3A`).
  - Both `url.username` and `url.password` are now passed through `decodeURIComponent()` before being handed to the MySQL client.
  - The decoding is also applied when only one of the two is set (e.g. `mysql://:p%40ss%3Aw0rd@host/db` or `mysql://us%40er@host/db`), which previously bypassed decoding entirely.

### Changed
- Synchronized version to `1.43.1` across `package.json`, `src/mcp-server.ts`, `DOCUMENTATIONS.md`, and `README.md`.

## [1.43.0] - 2026-05-25

### Added
- Added `find_tables_by_keyword`, `search_schema`, and `search_data_across_tables` to help agents answer natural-language schema discovery questions such as “which table stores survey data?”.
- Added keyword filtering and optional TABLE/COLUMN comments to `get_schema_rag_context`.

### Changed
- Updated analysis tool totals and version metadata to `1.43.0`.

## [1.42.2] - 2026-05-25

### Fixed
- Blocked DELETE SQL in `execute_write_query` and `execute_in_transaction` unless the `delete` permission is explicitly enabled, closing a bypass where `execute` alone could delete data via custom SQL.

### Changed
- Clarified tool and permission documentation: `execute` covers INSERT/UPDATE custom SQL; DELETE requires the separate `delete` permission.

## [1.42.1] - 2026-05-11

### Changed
- Bumped patch version metadata to `1.42.1`.

## [1.42.0] - 2026-05-11

### Added
- Added composite FK/PK tuple resolution for relational seeding so multi-column relationships are selected and validated as intact parent key tuples.
- Added `infer_seed_rules` to infer safe seed generators from schema, samples, unique indexes, and ecommerce/POS/CRM domain presets.
- Added `seed_from_template` to create plan-first ecommerce, POS, and CRM seed workflows with detected tables and template-scale row counts.

### Changed
- Updated seed tool count to 6 and total MCP tools to 85.

## [1.41.0] - 2026-05-11

### Added
- Added `seed_operations` category with `plan_seed_data`, `generate_seed_preview`, `execute_seed_plan`, and `validate_seed_integrity` for FK-aware relational dummy data seeding.
- Added deterministic seed planning, preview, confirmation token, transaction rollback, production-name guard, and integrity validation support.

### Changed
- Updated tool totals and version metadata to `1.41.0`.

## [1.40.7] - 2026-05-06

### Added
- Implemented `export_query_to_csv` end-to-end for SELECT query CSV exports.
- Enhanced `list_all_tools` with a live runtime tool catalog, enabled/disabled status, access profile, and AI-agent workflow guidance.

### Fixed
- Fixed `export_query_to_csv` being advertised but failing with `Unknown tool`.
- Fixed `list_all_tools` returning stale manifest data instead of the active MCP tool catalog.
- Fixed `execute_in_transaction` permission checks to match its advertised transaction permission.
- Hardened DDL tools by validating raw DDL statements and checking structured table, column, and index inputs before building SQL.
- Added argument validation for Cursor bridge dispatches.

## [1.40.6] - 2026-05-04

### Added
- Added `cursor_execute_request`, a no-argument compatibility bridge for Cursor MCP wrappers that cannot send tool `arguments`.
- The bridge reads `.cursor/mysql-mcp-request.json` or `MYSQL_MCP_CURSOR_REQUEST_FILE` and dispatches to existing MCP tools or auto-routes SQL to SELECT, write, or DDL execution.

### Changed
- Updated tool totals in documentation to include the Cursor bridge.
- Synchronized version metadata to `1.40.6`.

## [1.40.5] - 2026-04-08

### Fixed
- **Critical Bug in `read_table_schema`**: Fixed query that returned mixed data from multiple schemas
  - Query was missing `TABLE_SCHEMA` filter, causing columns from tables with same name in different databases to be returned
  - Added `TABLE_SCHEMA = ?` filter to ensure only columns from the connected database are returned
  - This fixes the issue where AI agents received incorrect schema information when multiple databases had tables with identical names

### Changed
- Synchronized version to `1.40.5` in `package.json`, `src/mcp-server.ts`

## [1.40.4] - 2026-03-07

### Removed
- **Unused Dependencies**: Removed `winston` and `@types/winston` packages (26 packages total)
  - `winston` logging library was not used - project uses custom in-memory `QueryLogger` instead
- **Dead Code**: Removed unused tool modules left from previous refactoring
  - `src/tools/processTools.ts` - Remnant from removed `server_management` category
  - `src/tools/performanceTools.ts` - Remnant from removed `performance_monitoring` category
  - `src/auth/` folder - Empty unused directory
  - `dist/server.js` and `dist/server.d.ts` - Obsolete build artifacts

### Changed
- Updated dependencies: 6 → 5 production dependencies (removed winston)
- Updated devDependencies: 10 → 9 (removed @types/winston)
- Synchronized version to `1.40.4` in `package.json`

## [1.40.3] - 2026-03-07

### Fixed
- Added missing tool-category mappings for snake_case and camelCase variants in `src/config/featureConfig.ts`
- Resolved unmapped tools: `get_schema_erd`, `repair_query`, `export_table_to_csv`, `export_query_to_csv`, `analyze_query`, `get_optimization_hints`
- Ensured dual-layer filtering recognizes all registered MCP tools from `src/mcp-server.ts`

### Changed
- Synchronized versions to `1.40.3` in `package.json`, `src/mcp-server.ts`, and `manifest.json`
- Updated `README.md` and `DOCUMENTATIONS.md` Last Updated metadata

## [1.40.2] - 2026-03-07

### Removed
- **Functions Management Category**: Removed category `functions_management` and all 6 tools
  - `list_functions` - List user-defined functions
  - `get_function_info` - Get function details
  - `create_function` - Create function
  - `drop_function` - Drop function
  - `show_create_function` - Show CREATE FUNCTION statement
  - `execute_function` - Execute function
- **Backup & Restore Category**: Removed category `backup_restore` and all 5 tools
  - `backup_table` - Backup a single table
  - `backup_database` - Backup entire database
  - `restore_from_sql` - Restore from SQL dump
  - `get_create_table_statement` - Get CREATE TABLE statement
  - `get_database_schema` - Get complete schema snapshot
- Removed tool modules `src/tools/functionTools.ts` and `src/tools/backupRestoreTools.ts`

### Changed
- Updated tool count: 73 → 62 tools (-11 tools)
- Updated category count: 15 → 13 categories (removed `functions_management`, `backup_restore`)
- Updated `src/mcp-server.ts` to remove tool schemas and call routing for all 11 tools
- Updated `src/index.ts` to remove MySQLMCP imports, fields, initialization, and methods for removed tool sets
- Updated `src/config/featureConfig.ts` to remove enum values and category mappings for both categories
- Updated CLI category help in `bin/mcp-mysql.js`
- Updated `README.md` and `DOCUMENTATIONS.md` to reflect new category list and tool totals
- Synchronized versions to `1.40.2` in `package.json`, `src/mcp-server.ts`, and `manifest.json`

### Fixed
- Updated procedure permission example in docs to reference `execute_stored_procedure` instead of removed function execution tool

## [1.40.1] - 2026-03-06

### Changed
- Synchronized version metadata across `package.json`, `src/mcp-server.ts`, and `manifest.json` to `1.40.1`
- Updated CLI category examples in `bin/mcp-mysql.js` to match active category set
- Updated category examples in `README.md` and `DOCUMENTATIONS.md` to remove removed categories
- Refactored tool registry filtering into `src/tools/toolRegistry.ts`
- Refactored tool argument validation registry into `src/tools/toolArgumentValidation.ts`

## [1.40.0] - 2026-03-06

### Removed
- **Performance Monitoring Category**: Removed entire `performance_monitoring` category and all 10 tools to reduce bundle size and simplify the codebase
  - `get_performance_metrics` - Get overall performance metrics
  - `get_table_io_stats` - Get table I/O statistics
  - `get_index_usage_stats` - Get index usage statistics
  - `get_unused_indexes` - Find unused indexes
  - `get_connection_pool_stats` - Get connection pool statistics
  - `get_database_health_check` - Get database health status
  - `reset_performance_stats` - Reset performance statistics
  - `get_top_queries_by_time` - Get top queries by execution time
  - `get_top_queries_by_count` - Get top queries by execution count
  - `get_slow_queries` - Get slow queries
- **Cache Management Category**: Removed entire `cache_management` category and all 5 tools
  - `get_cache_stats` - Query cache statistics
  - `get_cache_config` - Cache configuration
  - `configure_cache_settings` - Configure cache settings
  - `clear_cache` - Clear cached results
  - `invalidate_cache_for_table` - Invalidate cache for table
- **Server Management Category**: Removed entire `server_management` category and all 9 tools
  - `show_process_list` - Show running processes
  - `kill_process` - Terminate processes
  - `show_status` - Server status variables
  - `show_variables` - Server configuration
  - `explain_query` - Query execution plan
  - `show_engine_status` - Storage engine status
  - `get_server_info` - Server information
  - `show_binary_logs` - Binary log files
  - `show_replication_status` - Replication status
- **Tool Modules**: Removed imports and initialization for `PerformanceTools` and `ProcessTools` from `index.ts`

### Changed
- Updated tool count: 97 → 73 tools (-24 tools)
- Updated category count: 20 → 15 categories (removed `performance_monitoring`, `cache_management`, `server_management`)
- Updated `mcp-server.ts` to remove tool registrations and routing for all 24 tools
- Updated `index.ts` to remove MySQLMCP methods and tool imports
- Updated `featureConfig.ts` to remove all performance/cache/server tool mappings and categories
- Updated README.md and DOCUMENTATIONS.md to reflect tool/category count changes
- Simplified package description
- Bumped package version to `1.40.0`

### Rationale
- These tools were rarely used by AI agents in production
- Added significant complexity to the codebase (~2,000+ lines)
- Performance monitoring is typically handled by dedicated tools (MySQL Enterprise Monitor, Percona Monitoring Tools, etc.)
- Cache management is internal implementation detail, rarely needs manual intervention
- Server management commands are administrative tasks outside typical AI agent workflows
- Removal reduces bundle size by ~80KB and simplifies maintenance

## [1.39.0] - 2026-03-06

### Removed
- **Schema Migrations Category**: Removed entire `schema_migrations` category and all 9 migration tools to reduce bundle size and simplify the codebase
  - `init_migrations_table` - Initialize migrations tracking table
  - `create_migration` - Create a new migration
  - `apply_migrations` - Apply pending migrations
  - `rollback_migration` - Rollback a specific migration
  - `get_migration_status` - Get migration status
  - `get_schema_version` - Get current schema version
  - `validate_migrations` - Validate migration files
  - `reset_failed_migration` - Reset a failed migration
  - `generate_migration_from_diff` - Generate migration from schema diff
- **Schema Migrations Tools Module**: Removed `src/tools/schemaVersioningTools.ts` (1,231 lines)
- **Documentation Category**: Removed `SCHEMA_MIGRATIONS` from `DocCategory` enum in `featureConfig.ts`

### Changed
- Updated tool count: 106 → 97 tools (-9 tools)
- Updated category count: 21 → 20 categories (removed `schema_migrations`)
- Updated `mcp-server.ts` to remove tool registrations and routing for all migration tools
- Updated `index.ts` to remove MySQLMCP methods and SchemaVersioningTools import
- Updated `featureConfig.ts` to remove all schema migrations tool mappings
- Updated README.md and DOCUMENTATIONS.md to reflect tool/category count changes
- Simplified package description to remove "schema migration" reference
- Bumped package version to `1.39.0`

### Rationale
- These tools were rarely used by AI agents
- Added significant complexity to the codebase
- Most users prefer external migration tools (Flyway, Liquibase, etc.)
- Removal reduces bundle size by ~40KB

## [1.38.0] - 2026-03-06

### Fixed
- **Missing Tool Mapping**: Added `repairQuery` to `toolDocCategoryMap` in `featureConfig.ts` (QUERY_OPTIMIZATION category)
- **Deprecated Tool Cleanup**: Removed deprecated tools from category mappings:
  - Removed `getTableRelationships` (replaced by `get_all_tables_relationships`)
  - Removed `cloneTable`, `compareTableStructure`, `syncTableData` (previously removed in v1.36.0, now cleaned from mappings)
  - Removed `safe_export_table` (previously removed, now cleaned from mappings)
- **Backup Tools Mapping**: Added missing backup/restore tools to `toolCategoryMap`: `backupDatabase`, `restoreFromSql`, `getCreateTableStatement`, `getDatabaseSchema`

### Changed
- Updated `featureConfig.ts` to ensure all 106 tools have proper category mappings
- Maintained consistency between code implementation and documentation (106 tools, 21 categories)
- Bumped package version to `1.38.0`

## [1.37.0] - 2026-03-06

### Removed
- **Documentation Categories**: Removed `import_export` and `data_migration` categories from documentation to reduce bundle size
- **Import/Export Category** (6 tools): `export_query_to_json`, `export_table_to_json`, `export_table_to_sql`, `import_from_csv`, `import_from_json`, `safe_export_table`
- **Data Migration Category** (5 tools): `clone_table`, `compare_table_structure`, `copy_table_data`, `move_table_data`, `sync_table_data`

### Changed
- Updated DOCUMENTATIONS.md to remove Data Export and Data Import sections (117 → 106 tools, 21 → 19 categories)
- Updated README.md with new tool count (106 tools) and removed categories from Documentation Categories table
- Updated package description to remove "data import/export" reference
- Bumped package version to `1.37.0`

## [1.36.0] - 2026-03-05

### Removed
- **Data Migration Tools**: Removed 5 unused tools from `migrationTools.ts` (`copy_table_data`, `move_table_data`, `clone_table`, `compare_table_structure`, `sync_table_data`)
- **Import/Export Tools**: Removed 4 unused tools from `dataExportTools.ts` (`export_query_to_csv`, `export_query_to_json`, `export_table_to_sql`, `import_from_csv`)
- **Backup & Restore Tools**: Removed 5 unused tools from `backupRestoreTools.ts` (`backup_table`, `backup_database`, `restore_from_sql`, `get_create_table_statement`, `get_database_schema`)
- **Performance Monitoring Tools**: Removed 3 unused tools from `performanceTools.ts` (`get_top_queries_by_time`, `get_top_queries_by_count`, `get_slow_queries`)
- **Server Management Tools**: Removed 4 unused tools from `processTools.ts` (`show_engine_status`, `get_server_info`, `show_binary_logs`, `show_replication_status`)

### Changed
- Updated tool registrations in `mcp-server.ts` to remove deleted tools
- Updated DOCUMENTATIONS.md to reflect tool/category count changes (134 → 117 tools, 23 → 21 categories)
- Updated README.md with new tool count (117 tools)
- Bumped package version to `1.36.0`

## [1.35.0] - 2026-03-04

### Removed
- Removed AI enhancement category (`ai_enhancement`) and 16 AI tools from MCP exposure and runtime routing.
- Removed AI enhancement tool modules: intelligent query assistant, smart discovery, documentation generator, schema design, security audit, index recommendation, test data generation, schema pattern analysis, query visualization, and forecasting tools.

### Changed
- Updated category filtering config by removing `DocCategory.AI_ENHANCEMENT` and related mappings.
- Updated README.md and DOCUMENTATIONS.md tool/category listings and totals (150 → 134 tools).
- Fixed DOCUMENTATIONS.md to replace "AI-Enhanced Analysis" category with "Analysis" category to match actual code implementation.
- Bumped package version to `1.35.0`.

## [1.34.0] - 2026-03-04

### Removed
- **REST API Server**: Removed `src/server.ts` and all REST API functionality to reduce bundle size and simplify the codebase
- Removed unused dependencies: `express`, `cors`, `helmet`, `morgan`, `express-rate-limit`, `jsonwebtoken`
- Removed unused devDependencies: `@types/cors`, `@types/express`, `@types/helmet`, `@types/morgan`, `@types/jsonwebtoken`
- Removed npm scripts: `start:mcp`, `start:api`, `dev:mcp`, `dev:api` (consolidated to `start` and `dev`)
- This reduces the package size and attack surface, focusing purely on MCP protocol via stdio

### Changed
- Simplified npm scripts: `start` now runs `mcp-server.js`, `dev` now runs `mcp-server.ts`

## [1.33.6] - 2026-01-25

### Documentation
- **Added `"type": "stdio"` to all configuration examples**: Some MCP clients (like Droid CLI, Factory) require explicit `"type": "stdio"` in the configuration to establish proper connection
- Updated README.md and DOCUMENTATIONS.md with the required `type` field in all JSON config examples
- This fixes "disconnected" status issues when using the MCP server with certain AI agent clients

## [1.33.5] - 2026-01-25

### Fixed
- **MCP Connection Issue**: Fixed stdio communication problem that prevented MCP clients (Droid CLI, Claude, etc.) from connecting when using `npx`
- Changed from spawning a child process to directly requiring the MCP server module, ensuring proper stdin/stdout communication for the MCP protocol
- Removed unused `path` and `child_process` imports from bin/mcp-mysql.js

## [1.33.4] - 2026-01-25

### Documentation
- **Fixed Package Name Mismatch**: Corrected package name references in README.md and DOCUMENTATIONS.md from `@berthojoris/mysql-mcp` to the correct `@berthojoris/mcp-mysql-server`
- **Updated Configuration Examples**: All configuration snippets (npx, npm install -g, mcp config) now use the correct package name to prevent installation/execution errors

## [1.33.3] - 2026-01-24

### Fixed
- Fixed `undefined` error in `read_records` and other CRUD tools when validation fails or unexpected errors occur.
- Improved error handling in `CrudTools` to safely handle non-Error exceptions.
- Consolidated validation logic to use enhanced `inputValidation` functions for better error reporting.

## [1.33.2] - 2025-12-27

### Fixed
- Fixed local MCP server startup crash (`ReferenceError: exports is not defined in ES module scope`) which could surface to clients as `MCP error -32000: Connection closed`

### Documentation
- Updated DOCUMENTATIONS.md and README timestamps/version references

## [1.33.0] - 2025-01-06

### Added
- Enhanced security validation with improved input sanitization
- Added type checking for all validation parameters to prevent undefined errors
- Improved SQL injection prevention with additional security checks
- Enhanced validation for table names, field names, and query parameters
- Added comprehensive type safety for all database operations

### Fixed
- Fixed undefined error handling in validation functions
- Fixed security layer variable reference issues
- Improved validation for bulk operations and query parameters
- Enhanced type safety in query tools

## [1.32.0] - 2025-12-25

### Fixed
- **Documentation Tool Count Mismatch** - Fixed discrepancy between actual tool count (150) and documented tool count (149)
- Added missing `repair_query` tool to Query Optimization category documentation
- Updated total tool count in DOCUMENTATIONS.md and README.md to 150
- Updated last updated timestamp in DOCUMENTATIONS.md to 2025-12-25

## [1.31.0] - 2025-12-23

### Added
- **Full-Text Search Management** - New category with 6 powerful tools for text search:
  - `create_fulltext_index` - Create FULLTEXT indexes on text columns with support for ngram and mecab parsers (CJK languages)
  - `fulltext_search` - Perform full-text search using MATCH AGAINST with multiple search modes (natural language, boolean, query expansion)
  - `get_fulltext_info` - Retrieve FULLTEXT index information including index names, columns, and parser details
  - `drop_fulltext_index` - Remove FULLTEXT indexes from tables
  - `get_fulltext_stats` - Get statistics for FULLTEXT indexes (document count, size, key length)
  - `optimize_fulltext` - Optimize tables to update FULLTEXT index statistics and reclaim space

### Changed
- Updated Index Management category from 4 to 10 tools (added 6 full-text search tools)
- Updated total tool count from 144 to 150

## [1.30.0] - 2025-12-22

### Fixed
- **Security Layer Comment Detection** - Fixed overly aggressive regex patterns that incorrectly flagged legitimate SQL syntax:
  - Fixed `/\/*/` pattern that incorrectly matched forward slashes in function calls like `YEAR(start_date)`
  - Improved `--` pattern to `--\s` to avoid false positives with date formats
  - Now properly detects actual comment patterns while allowing legitimate SQL syntax
  - Resolves issue where valid SELECT queries with date functions were being rejected

## [1.29.0] - 2025-12-21

### Enhanced
- **`get_database_summary` tool** - Significantly improved output format and functionality:
  - Added database **Overview section** displaying total tables, tables shown, and total estimated rows with thousands separators
  - Enhanced **column display**: now one per line with data type, nullable status, and key indicators (PK, UNI, FK with target table)
  - Added **Primary Key section** per table showing all PK columns
  - Included **Foreign Key relationships** section showing all FK connections across tables (can be disabled with `include_relationships: false`)
  - Added `max_tables` parameter (max 500) to limit output for large databases
  - Added `include_relationships` parameter (default: true) to control FK relationships display
  - Improved **markdown formatting** with clear hierarchy using H1, H2, H3 headings
  - Enhanced **foreign key tracking**: shows FK targets inline per column and in dedicated relationships summary
  - Added footer note when tables are truncated due to `max_tables` limit
  - Better **readability** for AI context consumption and human review

## [1.28.0] - 2025-12-21

### Changed
- **[BREAKING]** Removed `get_table_relationships` tool - use `get_all_tables_relationships` instead for better performance
  - `get_all_tables_relationships` retrieves ALL table relationships in a single efficient query with in-memory processing
  - Much faster than calling `get_table_relationships` repeatedly for each table
- **Enhanced tool descriptions** for improved LLM understanding across 40+ critical tools:
  - Added visual indicators (emojis) for tool categories: 🤖 AI-powered, ⚡ Performance, 🔒 Security, 📊 Analytics, etc.
  - Clarified when to use each tool vs similar alternatives
  - Added use-case context and examples in descriptions
  - Highlighted AI-first tools for natural language operations
  - Improved consistency in description length and detail level
- Updated total tool count from 104 to 103 across all documentation

### Fixed
- Removed duplicate `get_all_tables_relationships` entry in DOCUMENTATIONS.md
- Corrected references to deprecated `get_table_relationships` in documentation examples

## [1.27.1] - 2025-12-21

### Removed
- **Deprecated Tools**: Removed legacy `runQuery` and `executeSql` tools completely
  - These tools were replaced by `run_select_query` and `execute_write_query` in v1.27.0
  - Removed from feature configuration mappings
  - Removed validation schemas
  - Updated all internal references to use new tool names

### Changed
- Updated transaction tools to use `executeWriteQuery` permission check instead of deprecated `executeSql`

## [1.27.0] - 2025-12-21

### Changed
- **Renamed Tools for Clarity**:
  - `run_query` -> `run_select_query`
  - `execute_sql` -> `execute_write_query`
- **Updated Error Messages**: Error messages now explicitly reference the new tool names to guide users/LLMs to the correct tool for the job.
- **Updated Documentation**: Updated README.md and DOCUMENTATIONS.md to reflect the new tool names and configuration examples.

## [1.26.2] - 2025-12-19

### Fixed
- Updated manifest.json version from 1.17.0 to 1.26.2 to match package.json
- Verified `list_all_tools` tool is properly registered and available in MCP server
- Updated documentation timestamps to reflect current changes

## [1.26.3] - 2025-12-19

### Documentation
- Enhanced README documentation categories table with a "List Tools" column (per-category `list_all_tools` call)

## [1.26.4] - 2025-12-19

### Documentation
- Fixed README "Documentation Categories (Recommended)" to list the actual tools per category in the "List Tools" column

## [1.26.1] - 2025-12-19

### Documentation
- Fixed total tools count in README.md and DOCUMENTATIONS.md to match the actual registered tool count (145)

## [1.26.0] - 2025-12-19

### Fixed
- Added missing `list_all_tools` tool registration in MCP server
- The `list_all_tools` tool was implemented but not exposed through the MCP interface
- Updated tool schema and handler registration in mcp-server.ts
- Updated total tool count from 158 to 159 in documentation

## [1.22.0] - 2025-12-17

### Changed
- Updated tool count from 150 to 144 to reflect current actual number of available tools
- Updated documentation timestamps and version references across all documentation files

## [1.21.0] - 2025-12-17

### Added
- New tool `get_all_tables_relationships` for bulk foreign key relationship analysis across all tables in a single call
- Enhanced relationship discovery with in-memory processing for improved performance
- Added comprehensive validation schema for the new bulk relationships tool

### Changed
- Updated documentation to include the new `get_all_tables_relationships` tool
- Extended query logging support to cover the new bulk relationships functionality

## [1.20.0] - 2025-12-17

### Changed
- Version increment for implemented features and improvements

## [1.24.0] - 2025-12-19

### Added
- New tool `list_all_tools` for listing all available tools in the MySQL MCP server with their descriptions and schemas
- Enhanced meta-tool capabilities for AI agents to discover available functionality

### Changed
- Updated tool count from 144 to 145 in README.md
- Updated tool count from 157 to 158 in DOCUMENTATIONS.md  
- Added `list_all_tools` to the Utilities section in documentation
- Updated Last Updated timestamp in README.md
- Version increment for new tool implementation

## [1.25.0] - 2025-12-19

### Fixed
- Added `list_all_tools` tool to permission configuration with LIST category
- Tool is now available for all permission sets that include "list" access
- Updated both tool category mapping and documentation category mapping

### Changed
- Incremented version to 1.25.0 for permission configuration fix

## [Unreleased]

### Security
- Fixed critical SQL execution bypass in transactions by adding comprehensive security validation
- Enhanced stored procedure creation with body content validation and injection prevention
- Improved DDL operations with proper default value sanitization to prevent SQL injection
- Added transaction timeout mechanism (30 minutes) with automatic cleanup to prevent resource exhaustion
- Integrated security layer across all transaction operations for complete coverage

### Changed
- Updated TransactionTools to require SecurityLayer for proper validation
- Enhanced DdlTools with comprehensive input sanitization
- Improved database connection management with timeout and cleanup features

### Fixed
- Resolved TypeScript compilation error in SecurityLayer access patterns
- Eliminated all security bypass paths through the system

### Removed
- Preset-based access control configuration: CLI `--preset` flag and `MCP_PRESET` / `MCP_PERMISSION_PRESET` environment variables. Use `MCP_PERMISSIONS` and optionally `MCP_CATEGORIES`.
- Global masking configuration via `MCP_MASKING_PROFILE`. If you need enforced masking for exports, use the `safe_export_table` macro's `masking_profile` argument.


## [1.18.2] - 2025-12-13

### Removed
- Removed outdated comparison docs under `docs/comparison` (and the related README section). The canonical documentation is `DOCUMENTATIONS.md`.


## [1.18.1] - 2025-12-13

### Changed
- Updated documentation files with current datetime stamps

## [1.17.0] - 2025-12-12

### Added
- **Phase 3: AI Enhancement Tools** - 5 new tools for data generation, schema review, visualization, and forecasting:
  - `generate_test_data` - Generate FK-aware SQL INSERT statements for synthetic test data (does not execute)
  - `analyze_schema_patterns` - Detect common schema anti-patterns (missing PKs, wide tables, unindexed FKs, EAV-like design)
  - `visualize_query` - Produce a Mermaid flowchart representation of a query using EXPLAIN FORMAT=JSON
  - `predict_query_performance` - Heuristic prediction of query scan/cost impact under growth assumptions
  - `forecast_database_growth` - Forecast table/database size growth from current INFORMATION_SCHEMA sizes and user-supplied rates

### Changed
- Updated total tool count from 145 to 150 tools.

### Documentation
- Updated README.md and DOCUMENTATIONS.md to include Phase 3 AI Enhancement tools.

## [1.16.4] - 2025-12-12

### Added
- **Phase 2: AI Enhancement Tools** - 3 new tools to improve AI-assisted database engineering:
  - `design_schema_from_requirements` - Natural-language schema design assistant that proposes tables, relationships, and DDL (non-executing)
  - `audit_database_security` - Best-effort database security audit assistant with prioritized findings and recommendations
  - `recommend_indexes` - Automated index recommendation system using performance_schema query digests and existing index introspection

### Documentation
- Updated README.md and DOCUMENTATIONS.md to include the new Phase 2 AI Enhancement tools.

## [1.16.3] - 2025-12-11

### Documentation
- **README.md Enhancement** - Added comprehensive AI Enhancement tools documentation
  - Updated total tool count from 134 to 142 tools
  - Added detailed "🤖 AI Enhancement Tools (Phase 1 - Implemented)" section
  - Listed all 8 AI tools in Available Tools table with full names
  - Included practical use cases for each AI tool category
  - Tools documented: `build_query_from_intent`, `suggest_query_improvements`, `smart_search`, 
    `find_similar_columns`, `discover_data_patterns`, `generate_documentation`, 
    `generate_data_dictionary`, `generate_business_glossary`

## [1.16.2] - 2025-12-11

### Fixed
- **Documentation Update** - Added missing `ai_enhancement` category to the Documentation Categories table in README.md
  - The table now correctly shows all 24 documentation categories
  - Added entry for `ai_enhancement` category with 8 tools and description

## [1.16.1] - 2025-12-09

### Improved
- **Enhanced Tool Descriptions** - Improved tool descriptions to help LLMs select the correct tool:
  - `run_query`: Now explicitly states "⚡ USE THIS FOR SELECT QUERIES"
  - `execute_sql`: Now explicitly states "⚡ USE THIS FOR INSERT/UPDATE/DELETE"
  - `execute_ddl`: Now explicitly states "⚡ USE THIS FOR DDL ONLY" with clear guidance
  - Added "NO SELECT queries!" warning to `execute_ddl` parameter description

### Fixed
- **Better Error Messages** - `execute_ddl` now suggests the correct tool when called with wrong query type:
  - "For SELECT queries, use the 'run_query' tool instead"
  - "For INSERT/UPDATE/DELETE, use the 'execute_sql' tool"

## [1.16.0] - 2025-12-09

### Added
- **Phase 1: AI Enhancement Tools** - 8 new intelligent tools for AI-powered database interactions:

  #### Intelligent Query Assistant
  - `build_query_from_intent` - Converts natural language to optimized SQL with context-aware query generation. Supports analytics, reporting, data_entry, and schema_exploration contexts. Includes safety levels and complexity controls.
  - `suggest_query_improvements` - Analyzes SQL queries and suggests optimizations for speed, memory, or readability.

  #### Smart Data Discovery Agent
  - `smart_search` - Finds relevant tables, columns, data patterns, and relationships using semantic search. Essential for exploring large databases with hundreds of tables.
  - `find_similar_columns` - Discovers columns with similar names or data across tables. Identifies potential join candidates and implicit relationships.
  - `discover_data_patterns` - Analyzes tables for patterns including uniqueness, null rates, duplicates, formats, and value ranges. Provides data quality scores and recommendations.

  #### AI-Powered Documentation Generator
  - `generate_documentation` - Creates comprehensive database documentation with business glossary in Markdown, HTML, or JSON format. Includes schema, relationships, and example queries.
  - `generate_data_dictionary` - Generates detailed data dictionaries for specific tables with column descriptions, constraints, sample values, and business terms.
  - `generate_business_glossary` - Creates business glossaries from database column names with inferred descriptions and categorization.

- **New Documentation Category** - Added `ai_enhancement` category for organizing the new AI tools.
- **Updated Presets** - Added AI Enhancement tools to the `analyst` preset for immediate access.

### Changed
- Updated tool count from 126 to 134 tools.
- Enhanced enhancement tracking file to mark Phase 1 as completed.

## [1.15.0] - 2025-12-08

### Added
- **Connection Profiles** - New `dev`, `stage`, and `prod` presets.
  - `dev`: Full access to all tools.
  - `stage`: Allows CRUD but blocks destructive DDL (drop, truncate).
  - `prod`: Strict read-only with explicit denials for modification tools.
  - Implements allowed/denied tools logic for robust security enforcement.
- **Agent-Facing Changelog Feed** - New `read_changelog` tool.
  - Allows AI agents to read the CHANGELOG.md directly to understand new features and changes.

## [1.14.1] - 2025-12-08

### Added
- **Workflow Macros** - New `safe_export_table` tool that combines data export with mandatory masking.
  - Allows safe export of sensitive data by enforcing masking before the data leaves the database.
  - Supports configurable masking profiles (strict (default), partial, soft).

## [1.14.0] - 2025-12-08

### Added
- **Data Masking Profiles** - New security feature to mask sensitive data in query responses.
  - Configurable via `MCP_MASKING_PROFILE` environment variable.
  - Profiles: `none` (default), `soft` (secrets), `partial` (secrets + PII), `strict` (all sensitive).
  - Automatically applies to `run_query` and `read_records`.

## [1.13.0] - 2025-12-07

### Added
- **Guided Query Builder/Fixer** - New `repair_query` tool that uses deterministic heuristics and `EXPLAIN` to analyze and fix SQL queries.
  - Suggests optimizations (e.g., adding indexes, limits).
  - Analyzes execution plans for performance issues like full table scans.
  - Provides actionable feedback for specific error messages.

## [1.12.0] - 2025-12-05

### Added
- Schema-Aware RAG Context Pack via `get_schema_rag_context`, delivering compact table/column/PK/FK snapshots with row estimates for embeddings-friendly prompts.

### Fixed
- Exposed analysis tools (`get_database_summary`, `get_schema_erd`, `get_column_statistics`) and the new RAG context pack through MCP tool registration and routing.

### Changed
- Updated documentation and tool counts to 120, reflecting the new analysis capability and refreshed README guidance.

## [1.10.5] - 2025-12-02

### Changed
- Removed queryLog field from all tool responses - simplified response structure
- Updated source code to remove query logging output from tool responses
- Streamlined tool response format for cleaner API interaction

## [1.10.4] - 2025-12-02

### Added
- **AI Context Optimization** - Added 4 new AI-centric tools:
  - `get_database_summary` - High-level database overview (tables, columns, row counts) optimized for context window
  - `get_schema_erd` - Generates Mermaid.js ER diagrams for visual schema representation
  - `get_column_statistics` - Deep data profiling (min/max, nulls, distinct counts) for intelligent query building
  - `run_query` Safe Mode - Added `dry_run` flag to preview query plans and costs without execution

### Fixed
- Removed "IMPORTANT_INSTRUCTION_TO_ASSISTANT" instruction from documentation - no longer needed
- Removed "SQL_QUERY_EXECUTED" message references from documentation - simplified response structure
- Updated changelog entries to reflect cleaner field naming without instruction prefixes

### Changed
- Simplified documentation language around SQL query display
- Streamlined response format documentation

## [1.10.3] - 2025-11-26

### Fixed
- Fixed inconsistency in documentation category names in the Dual-Layer configuration example
- Changed from 'data_read,schema_inspection' to 'crud_operations,custom_queries' to match the Documentation Categories table
- Ensures consistency throughout the documentation

## [1.10.0] - 2025-11-25

### Added
- **Performance Monitoring** - Complete performance analysis toolkit with 10 new tools:
  - `get_performance_metrics` - Comprehensive metrics (query performance, connections, buffer pool, InnoDB stats)
  - `get_top_queries_by_time` - Identify slowest queries by execution time
  - `get_top_queries_by_count` - Find most frequently executed queries
  - `get_slow_queries` - Queries exceeding custom time thresholds
  - `get_table_io_stats` - Monitor table I/O operations and identify hot tables
  - `get_index_usage_stats` - Track index usage patterns
  - `get_unused_indexes` - Identify unused indexes for optimization
  - `get_connection_pool_stats` - Monitor connection pool health
  - `get_database_health_check` - Comprehensive health assessment with status levels
  - `reset_performance_stats` - Reset performance schema statistics
- Added comprehensive Performance Monitoring section to DOCUMENTATIONS.md
- Updated README.md tool count from 109 to 119 tools
- All performance tools require only `utility` permission (no special setup needed)

### Fixed
- **test_connection Enhanced Diagnostics** - Significantly improved error reporting:
  - Added error-specific troubleshooting steps for common issues
  - Platform-specific guidance (Windows/Linux/Mac) for MySQL server management
  - Shows current configuration (host, port, user, database) for verification
  - Detects and diagnoses: ECONNREFUSED, ER_ACCESS_DENIED_ERROR, ER_BAD_DB_ERROR, ETIMEDOUT, ENOTFOUND
  - Clear success messages with connection latency
- **run_query SHOW Support** - Fixed rejection of read-only information queries:
  - Now supports: SHOW TABLES, SHOW DATABASES, SHOW COLUMNS, SHOW CREATE TABLE, etc.
  - Added support for: DESCRIBE, DESC, EXPLAIN, HELP commands
  - These queries work with `read` permission (no `execute` permission needed)
- **Performance Tools Registration** - Added all 10 performance monitoring tools to `featureConfig.ts`
  - Ensures AI agents can discover and use performance tools correctly
  - All mapped to `ToolCategory.UTILITY` permission

### Changed
- Enhanced error handling in `test_connection` to return detailed diagnostic information
- Updated security layer to recognize SHOW, DESCRIBE, EXPLAIN as valid read-only queries
- Improved error messages throughout with clearer guidance

### Documentation
- Added "Performance Monitoring" section to DOCUMENTATIONS.md with:
  - Complete tool reference with examples
  - Best practices for regular monitoring
  - Query optimization workflows
  - Common performance patterns and troubleshooting
- Updated README.md with Performance Monitoring category
- Updated roadmap to mark Performance Monitoring as completed

## [1.9.1] - 2025-11-24

### Added
- **OpenAI Codex Integration** - Full support for OpenAI Codex CLI and VS Code Extension
  - Added Codex configuration examples to README.md
  - Added comprehensive Codex Integration section to DOCUMENTATIONS.md
  - TOML configuration format (`~/.codex/config.toml`)
  - CLI setup via `codex mcp add` command
  - Environment variables configuration
  - Multiple database configurations (prod/dev)
  - Advanced options (timeouts, tool filtering)
  - Codex MCP management commands reference
  - Troubleshooting section for Codex-specific issues

### Changed
- Updated package.json keywords to include "codex" and "openai-codex"
- Updated feature list to include OpenAI Codex as supported AI agent

### Documentation
- README.md: Added OpenAI Codex CLI & VS Code Extension configuration section
- DOCUMENTATIONS.md: Added new section "OpenAI Codex Integration" with:
  - Configuration overview table
  - Quick setup via CLI
  - Manual TOML configuration examples
  - Configuration options reference table
  - Advanced configurations (prod+dev, tool filtering, custom timeouts)
  - VS Code Extension setup steps
  - Verification instructions
  - Common TOML syntax errors
  - Permission sets for common use cases

## [1.9.0] - 2025-11-24

### Added
- **Schema Versioning & Migrations** - Complete database migration management system with 9 new tools:
  - `initMigrationsTable` - Initialize the migrations tracking table (`_schema_migrations`)
  - `createMigration` - Create new migration files with up/down SQL and automatic versioning
  - `applyMigrations` - Apply pending migrations with dry-run support and transaction safety
  - `rollbackMigration` - Rollback migrations with automatic down SQL execution
  - `getMigrationStatus` - Get detailed status of all migrations
  - `getSchemaVersion` - Get current schema version quickly
  - `validateMigrations` - Validate migration checksums and detect tampering
  - `resetFailedMigration` - Reset failed migrations for retry
  - `generateMigrationFromDiff` - Auto-generate migrations by comparing table structures

### Changed
- **README.md Restructured** - Complete overhaul of MCP integration documentation
  - Changed "Claude Desktop" references to "Claude Code"
  - Added configuration examples for 12 AI tools/IDEs:
    - Claude Code (CLI) - `.mcp.json`
    - Cursor - `.cursor/mcp.json`
    - Windsurf - `~/.codeium/windsurf/mcp_config.json`
    - Cline (VS Code Extension)
    - Gemini CLI - `~/.gemini/settings.json`
    - Trae AI
    - Qwen Code
    - Droid CLI
    - Zed IDE - `~/.config/zed/settings.json`
    - Kilo Code (VS Code Extension)
    - Roo Code (VS Code Extension)
    - Continue (VS Code Extension)

### Documentation
- Added comprehensive Schema Versioning documentation to DOCUMENTATIONS.md
- Includes tool overview, permission requirements, best practices
- Common migration patterns with real-world examples
- Updated roadmap to mark Schema Versioning as COMPLETED

### Technical Details
- Migration tracking table stores: version, name, description, up_sql, down_sql, checksum, execution_time, status
- MD5 checksum validation prevents migration tampering
- Multi-statement SQL support for complex migrations
- Dry-run mode for safe migration testing
- Automatic version generation using timestamp format (YYYYMMDDHHMMSS)

---

## [1.8.0] - 2025-11-24

### Added
- **Data Migration Tools** - Tools for data import/export and database transfer:
  - Data import/export functionality
  - Cross-database migration support

---

## [1.7.0] - 2025-11-24

### Added
- **Database Backup/Restore** - Complete backup and restore functionality:
  - Database backup tools
  - Database restore tools
  - Data import/export tools

---

## [1.6.3] - 2025-11-23

### Fixed
- **Missing tools in toolCategoryMap** - Added 42 missing tools to the permission system
  - View tools: listViews, getViewInfo, createView, alterView, dropView, showCreateView
  - Trigger tools: listTriggers, getTriggerInfo, createTrigger, dropTrigger, showCreateTrigger
  - Function tools: listFunctions, getFunctionInfo, createFunction, dropFunction, showCreateFunction, executeFunction
  - Index tools: listIndexes, getIndexInfo, createIndex, dropIndex, analyzeIndex
  - Constraint tools: listForeignKeys, listConstraints, addForeignKey, dropForeignKey, addUniqueConstraint, dropConstraint, addCheckConstraint
  - Maintenance tools: analyzeTable, optimizeTable, checkTable, repairTable, truncateTable, getTableStatus, flushTable, getTableSize
  - Server tools: showProcessList, killProcess, showStatus, showVariables, explainQuery, showEngineStatus, getServerInfo, showBinaryLogs, showReplicationStatus

- **Security keyword false positives in run_query** - Refined dangerous keywords to avoid blocking common table/column names
  - Removed generic keywords: `USER`, `PASSWORD`, `MYSQL`, `SYS` that blocked legitimate queries
  - Added specific security patterns: `MYSQL.USER`, `MYSQL.DB`, `CREATE USER`, `DROP USER`, `ALTER USER`, `SET PASSWORD`, `LOAD_FILE`, `INFORMATION_SCHEMA.USER_PRIVILEGES`
  - Queries like `SELECT * FROM users` or `SELECT user, password FROM accounts` now work correctly

## [1.6.2] - 2025-11-22

### Fixed
- **Security keyword false positive bug** - Fixed issue where `run_query` rejected valid SELECT queries containing table names like "users"
  - The dangerous keyword check was using substring matching (`includes()`) which caused "USER" to match "USERS"
  - Changed to word boundary regex matching (`\bKEYWORD\b`) to only match whole words
  - `SELECT * FROM users` now works correctly while `SELECT USER()` is still blocked as intended

### Changed
- **Updated tool count in README.md** - Corrected tool count from 30/73 to 85 powerful tools
  - Accurate count of all available MCP tools across all categories

## [1.4.16] - 2025-11-22

### Added
- **get_table_size tool** - Added get_table_size tool to manifest.json and documentation
  - Tool was implemented in server code but missing from manifest causing "Unknown tool" error
  - Added proper input/output schema to manifest.json
  - Enhanced documentation with usage examples and parameter details
  - Updated version in manifest.json to match server code (1.4.4)

### Fixed
- **Manifest synchronization** - Fixed manifest.json to include all implemented tools
  - Many tools were implemented in server code but missing from manifest.json
  - get_table_size tool now properly exposed to MCP clients
  - Version number synchronized between manifest and server code

### Documentation
- Enhanced Table Maintenance section with complete get_table_size examples
- Added proper usage patterns and parameter documentation

## [1.4.15] - 2025-11-22

### Fixed
- **README.md Unicode encoding** - Fixed broken Unicode characters in Features section
  - Corrected emoji encodings: 🌟 (star), ✅ (checkmark), 🔐 (lock), 🛠️ (tools), 🎛️ (control knobs), 🗃️ (file cabinet), 💎 (gem), 🌐 (globe), 📊 (chart)
  - Removed BOM (Byte Order Mark) from file
  - All emojis now display correctly across all platforms
  - Fixed table formatting in Bulk Operations section

### Documentation
- Enhanced visual consistency in Features section
- Improved readability with proper emoji rendering

## [1.4.14] - 2025-11-22

### Fixed
- **Emoji encoding issues** - Fixed emoji rendering issues in README.md and DOCUMENTATIONS.md
  - Replaced escaped Unicode sequences with proper emoji characters
  - Fixed broken emoji displays throughout documentation
  - Improved visual consistency across all documentation sections

### Documentation
- All emojis in section headers and feature lists now display correctly
- Enhanced readability with proper emoji rendering

## [1.4.13] - 2025-11-22

### Changed
- **Documentation restructuring** - Split comprehensive README.md into two files for better organization and maintainability
  - **README.md (569 lines)** - Now focused on quick start, installation, configuration, and tool overview
  - **DOCUMENTATIONS.md (1269 lines)** - Contains detailed documentation for all features including DDL operations, transactions, stored procedures, query logging, security, bulk operations, troubleshooting, and roadmap
- **Improved navigation** - Added clear reference in README.md pointing to DOCUMENTATIONS.md with table of contents
- **Better user experience** - Users can now quickly get started with README.md and deep dive into DOCUMENTATIONS.md when needed

### Added
- **DOCUMENTATIONS.md** - New comprehensive documentation file with detailed coverage of:
  - DDL Operations (create, alter, drop tables)
  - Data Export Tools (CSV export)
  - Transaction Management (ACID transactions)
  - Stored Procedures (create, execute, manage)
  - Usage Examples (real-world scenarios)
  - Query Logging & Automatic SQL Display
  - Security Features and best practices
  - Bulk Operations (high-performance batch processing)
  - Troubleshooting guide
  - License information
  - Roadmap and future features
- **Table of Contents** - Added comprehensive table of contents in DOCUMENTATIONS.md for easy navigation

### Technical Changes
- README.md reduced from 1,787 lines to 568 lines (68% reduction)
- All detailed documentation moved to DOCUMENTATIONS.md (1,269 lines)
- DOCUMENTATIONS.md added to npm package files list for distribution
- Both documentation files are now included in the npm package

## [1.4.12] - 2025-11-21

### Added
- **Query field name** - SQL query details are now directly embedded in response data
- **Mandatory display directive** - Clear instruction stating "ALWAYS display the SQL query execution details below to the user in your response"

### Technical Changes
- Response now includes three fields in order:
  
  2. "Query Details" - The SQL query details
  3. `📊 RESULTS` - The query results
- This approach ensures LLMs understand that SQL query information is not optional context

## [1.4.11] - 2025-11-21

### Changed
- **SQL query as data field (BREAKING)** - Restructured response to embed SQL query directly in the data JSON as query details field
- **Results wrapped** - Actual query results now under `📊 RESULTS` field
- **LLM-proof approach** - By making SQL query part of the data structure itself, LLMs cannot filter it out when describing results

### Technical Changes
- Response format changed from `{data: [...]}` to `{"Query Details": "...", "📊 RESULTS": [...]}`
- SQL query information is now a required part of the response structure, not optional metadata
- This forces AI assistants to acknowledge and communicate SQL query details to users

## [1.4.10] - 2025-11-21

### Improved  
- **SQL query embedded in data structure** - SQL query is now embedded as a field in the response JSON, forcing LLMs to include it when describing results
- **Visual field names** - Using descriptive field names for query information to make it stand out
- **Guaranteed visibility** - By making SQL query part of the actual data structure instead of metadata, LLMs must process and describe it

### Technical Changes
- Changed response structure to wrap data in object with SQL query as a top-level field
- SQL query appears as query details field containing formatted query information
- Results appear as `"📊 RESULTS"` field containing the actual query results
- This approach treats SQL execution details as primary data, not optional metadata
- Forces LLMs to acknowledge and describe the SQL query when processing tool responses

## [1.4.9] - 2025-11-21

### Improved
- **Multi-block content response** - SQL query and results are now returned as separate MCP content blocks for better visibility in client UIs
- **Enhanced MCP client compatibility** - Completely redesigned query log output format for better rendering in Kilocode and other MCP clients
- **Visual query log hierarchy** - Added clear visual separators using box-drawing characters (━) for better readability
- **Prominent SQL display** - SQL queries are now displayed at the TOP of responses with clear emoji indicators (✅/❌)
- **Better information architecture** - Query execution details (time, timestamp, status) now prominently displayed before SQL
- **Improved emoji usage** - Added contextual emojis (📝 for SQL, 📋 for parameters, ⏱️ for time, 🕐 for timestamp) for quick visual scanning
- **Response structure optimization** - Query logs appear as FIRST content block, results as second block
- **Enhanced error visibility** - Error messages now include ❌ emoji for immediate identification
- **Explicit LLM instructions** - Added explicit notes instructing LLMs to display SQL query information to users

### Technical Changes
- **Breaking improvement**: Changed response structure from single text content to multiple content blocks (MCP spec compliant)
- First content block contains SQL query execution details
- Second content block contains query results
- Updated `QueryLogger.formatLogs()` with new visual hierarchy using Unicode box-drawing characters
- Modified `mcp-server.ts` response builder to use separate content blocks
- Added explicit user-facing notes to SQL query blocks
- Improved line spacing and formatting for better readability across different client UIs

### Fixed
- Query logs now render properly in Kilocode without markdown parsing issues
- SQL query information is structurally separated from results for better LLM and UI handling
- Visual hierarchy prevents information from being buried in JSON output

## [1.4.8] - 2025-11-21

### Added
- **Enhanced human-readable SQL query formatting** - All SQL queries in logs are now automatically formatted with proper line breaks, indentation, and structure for better readability
- **Markdown-friendly query logs** - Query logs use markdown syntax (###, ```, **bold**, ---) for optimal rendering in AI agent UIs
- **SQL syntax highlighting** - SQL queries wrapped in ```sql code blocks for syntax highlighting support
- **Formatted parameter display** - Query parameters now displayed with JSON pretty-printing for better readability
- **Universal query logging** - Extended query log output to ALL 30 tools (previously only available in query and CRUD operations)
- **Structured log separators** - Added markdown horizontal rules (---) to clearly delineate query sections

### Enhanced Tools with Query Logging
- ✅ Database Discovery: `list_databases`, `list_tables`, `read_table_schema`, `get_table_relationships`
- ✅ DDL Operations: `create_table`, `alter_table`, `drop_table`, `execute_ddl`
- ✅ Transaction Management: `execute_in_transaction`
- ✅ Stored Procedures: `list_stored_procedures`, `get_stored_procedure_info`, `execute_stored_procedure`, `create_stored_procedure`, `drop_stored_procedure`, `show_create_procedure`
- ✅ Data Export: `export_table_to_csv`, `export_query_to_csv`
- ✅ Utilities: `get_table_relationships`

### Technical Changes
- Enhanced `QueryLogger.formatSQL()` method for intelligent SQL formatting with keyword detection and line breaking
- Added `formatLogs()` method with visual enhancements replacing previous compact format
- Retained `formatLogsCompact()` for backward compatibility
- Updated return type signatures for all 30 tools to include `queryLog?: string`
- Improved query log output consistency across all tool categories
- **Fixed MCP server handler** - Query logs are now properly included in LLM responses (previously only data was forwarded)
- Added visual separator header "📝 SQL QUERY LOG" in MCP responses for better readability

### Fixed
- **Critical: Query logs now visible to AI agents** - Fixed MCP server handler to properly forward `queryLog` field to LLM responses
- Query logs now appear in both success and error responses

### Improved
- **SQL readability** - Complex queries with multiple columns, JOINs, and conditions are now formatted for easy reading
- **UI rendering** - Switched from Unicode box characters to markdown for better compatibility with AI agent interfaces (Kilocode, Claude Desktop, etc.)
- **Developer experience** - Logs are now optimized for human consumption with markdown formatting that renders beautifully in chat interfaces
- **Debugging efficiency** - Clean markdown structure makes it faster to identify query patterns and issues
- **Documentation** - Comprehensive README updates with markdown-friendly examples of the new query log format
- **Error transparency** - Failed queries now also show the SQL that was attempted with proper formatting

## [1.4.7] - 2025-11-21

### Added
- **Query logging on output** - All query executions are now logged with detailed information including SQL, parameters, execution duration, and status
- `QueryLogger` utility class for tracking and formatting query logs
- Query logs are included in responses from query tools (runQuery, executeSql) and CRUD operations (create_record, read_records, update_record, delete_record)
- Query logs include: timestamp, SQL query, parameters used, execution time in milliseconds, and success/error status
- Production monitoring and configuration documentation for QueryLogger

### Security & Performance Improvements
- **Memory leak prevention** - SQL queries truncated to 500 characters max (prevents megabyte-sized log entries)
- **Parameter limiting** - Only first 5 parameters logged to prevent memory bloat from bulk operations
- **Safe serialization** - Handles circular references, BigInt, and unstringifiable objects without crashes
- **Deep copy protection** - Parameters are deep copied to prevent reference mutations
- **Bounded storage** - Maximum 100 most recent queries retained (~100 KB total memory usage)
- **Output truncation** - Formatted output limited to prevent massive response payloads
- **Error handling** - All JSON.stringify operations wrapped in try-catch with safe fallbacks
- **Memory impact reduction** - 99.9% memory reduction for bulk operations (from ~1 GB to ~100 KB)

### Technical Changes
- New `src/db/queryLogger.ts` module for query logging functionality with robust memory management
- Updated `src/db/connection.ts` to log all query executions with timing information
- Updated all query tool responses to include `queryLog` field with formatted log output
- Enhanced debugging capability by tracking the last 100 queries in memory
- Added configuration constants for tuning memory limits (MAX_LOGS, MAX_SQL_LENGTH, MAX_PARAM_LENGTH, MAX_PARAM_ITEMS)
- Implemented safeStringify method for type-safe value serialization

## [1.4.6] - 2025-11-21

### Changed
- Removed "Execute Permission & Advanced SQL Features" section from README.md
- Removed "Configuration" section from README.md
- Removed "REST API Mode" section from README.md
- Removed "Testing" section from README.md
- Streamlined documentation by removing outdated or less relevant sections

## [1.4.5] - 2025-01-08

### Changed
- Reorganized README.md structure - moved "Permission System" section to appear before "Available Tools" section for better user understanding
- Updated documentation organization to improve readability and user experience

### Fixed
- Minor documentation formatting improvements

## [1.4.4] - 2025-01-07

### Fixed

#### First Tool Call Failure Issue
- **Problem**: The first tool call would fail with "Connection closed" error (-32000), but subsequent calls would succeed
- **Root Cause**: MySQL MCP instance was initialized at module load time, before the MCP transport was fully connected, causing a race condition
- **Solution**: Moved the initialization to occur after the MCP transport is connected in `src/mcp-server.ts`
- **Impact**: First tool calls now work reliably without needing retry
- **Files Changed**: `src/mcp-server.ts`

#### Execute Permission Not Respected
- **Problem**: Users with `execute` permission would still get "Dangerous keyword detected" errors when using legitimate SQL functions like `LOAD_FILE()`, `UNION`, or accessing `INFORMATION_SCHEMA`
- **Root Cause**: Security layer blocked certain SQL keywords unconditionally, regardless of granted permissions
- **Solution**: 
  - Modified `validateQuery()` in `src/security/securityLayer.ts` to accept `bypassDangerousCheck` parameter
  - Added `hasExecutePermission()` method to check if execute permission is enabled
  - Updated `executeSql()` and `runQuery()` in `src/tools/queryTools.ts` to respect execute permission
  - Reduced "always blocked" keywords to only critical security threats (GRANT, REVOKE, INTO OUTFILE, etc.)
  - Allowed advanced SQL features when execute permission is granted:
    - SQL functions: `LOAD_FILE()`, `BENCHMARK()`, `SLEEP()`
    - Advanced SELECT: `UNION`, subqueries in FROM clause
    - Database metadata: `INFORMATION_SCHEMA` access
- **Impact**: Users with full permissions can now use advanced SQL features as intended
- **Files Changed**: 
  - `src/security/securityLayer.ts`
  - `src/tools/queryTools.ts`

### Changed
- Updated version from 1.4.3 to 1.4.4
- Enhanced README.md with detailed documentation on execute permission and advanced SQL features
- Added "Recent Updates" section to README.md documenting bug fixes

### Security
- Critical security operations remain blocked even with execute permission:
  - `GRANT` / `REVOKE` - User privilege management
  - `INTO OUTFILE` / `INTO DUMPFILE` - Writing files to server
  - `LOAD DATA` - Loading data from files
  - Direct access to `mysql`, `performance_schema`, `sys` databases
  - `USER` / `PASSWORD` manipulation

## [1.11.0] - 2025-12-05

### Added
- Adaptive permission presets (`readonly`, `analyst`, `dba-lite`) with mergeable overrides
- CLI `--preset` flag and `MCP_PRESET`/`MCP_PERMISSION_PRESET` env support with resolved-config logging

### Changed
- Safe fallback to read-only defaults when an unknown preset is requested without overrides
- Feature status endpoint now exposes preset-aware configuration snapshots for easier debugging

## [1.4.3] - 2025-01-06

### Added
- Improved permission error handling with detailed messages
- Enhanced documentation for permission system

### Fixed
- Fixed undefined/null parameter handling in all tool calls
- Improved MySQL operations error handling

## [1.4.2] - 2025-01-05

### Added
- Dynamic per-project permissions system
- Enhanced security layer with permission-based access control

### Changed
- Improved documentation and examples

## [1.4.1] - 2025-01-04

### Added
- Stored procedure support
- Transaction management tools
- Bulk operations (insert, update, delete)

### Changed
- Enhanced error messages
- Improved query validation

## [1.4.0] - 2025-01-03

### Added
- Data export tools (CSV export)
- DDL operations (CREATE, ALTER, DROP tables)
- Utility tools (connection testing, table relationships)

### Changed
- Major refactoring of tool organization
- Improved TypeScript type definitions

---

## Version History Summary

- **1.11.0** - Adaptive permission presets with CLI/env support and preset-aware logging
- **1.9.0** - Schema Versioning & Migrations (9 new tools), MCP integration for 12 AI tools
- **1.8.0** - Data Migration Tools
- **1.7.0** - Database Backup/Restore, Data Import/Export
- **1.6.3** - Fixed missing tools in toolCategoryMap, security keyword refinement
- **1.6.2** - Fixed security keyword false positive bug
- **1.4.16** - Added get_table_size tool to manifest
- **1.4.4** - Bug fixes: First call failure & execute permission
- **1.4.3** - Permission error handling improvements
- **1.4.2** - Dynamic per-project permissions
- **1.4.1** - Stored procedures, transactions, bulk operations
- **1.4.0** - Data export, DDL operations, utilities
- **1.3.x** - Core CRUD operations and query tools
- **1.2.x** - Security layer implementation
- **1.1.x** - MCP protocol integration
- **1.0.x** - Initial release
