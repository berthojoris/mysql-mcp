#!/usr/bin/env node

/**
 * MCP MySQL Server CLI
 * This script allows the MySQL MCP server to be run via NPX
 * It implements the Model Context Protocol using stdio transport
 */

const dotenv = require("dotenv");

dotenv.config();

// Get MySQL connection string, permissions, and optional categories
const args = process.argv.slice(2);
const mysqlUrl = args.shift();

let permissions;
let categories;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];

  if (permissions === undefined) {
    permissions = arg;
    continue;
  }

  if (categories === undefined) {
    categories = arg;
    continue;
  }
}

if (!mysqlUrl) {
  console.error("Error: MySQL connection URL is required");
  console.error(
    "Usage: mcp-mysql mysql://user:password@host:port/dbname [permissions] [categories]",
  );
  console.error("");
  console.error("Examples:");
  console.error("  # Read-only default (list,read,utility)");
  console.error("  mcp-mysql mysql://root:pass@localhost:3306/mydb");
  console.error("");
  console.error("  # Permission-based filtering only (Layer 1)");
  console.error(
    '  mcp-mysql mysql://root:pass@localhost:3306/mydb "list,read,utility"',
  );
  console.error("");
  console.error(
    "  # Dual-layer: Permissions + Categories (fine-grained control)",
  );
  console.error(
    '  mcp-mysql mysql://root:pass@localhost:3306/mydb "list,read,utility" "database_discovery,custom_queries,analysis"',
  );
  console.error("");
  console.error("Permissions (Layer 1 - Broad Control):");
  console.error(
    "  list, read, create, update, delete, execute, ddl, utility, transaction, procedure",
  );
  console.error("");
  console.error("Categories (Layer 2 - Fine-Grained Control, Optional):");
  console.error(
    "  database_discovery, crud_operations, bulk_operations, custom_queries,",
  );
  console.error(
    "  schema_management, utilities, transaction_management, stored_procedures,",
  );
  console.error(
    "  views_management, triggers_management, index_management,",
  );
  console.error(
    "  constraint_management, table_maintenance, query_optimization,",
  );
  console.error(
    "  analysis, seed_operations",
  );
  console.error("");
  console.error("Filtering Logic:");
  console.error(
    "  - If only permissions: All tools within those permissions enabled",
  );
  console.error(
    "  - If permissions + categories: Only tools matching BOTH layers enabled",
  );
  console.error("  - If nothing specified: Read-only default (list,read,utility)");
  process.exit(1);
}

// Parse the MySQL URL to extract connection details
let connectionConfig;
let database;
try {
  const url = new URL(mysqlUrl);

  // Remove leading slash from pathname and make database optional
  database = url.pathname.replace(/^\//, "") || null;

  // Extract username and password from auth.
  // Both fields may be URL-encoded (e.g. "@" -> "%40"), so always decode
  // whatever the URL parser hands us, including when only one side is set.
  const decodeAuthField = (value) =>
    value ? decodeURIComponent(value) : value;
  const auth = {
    user: decodeAuthField(url.username) || "root",
    password: decodeAuthField(url.password) || "",
  };

  connectionConfig = {
    host: url.hostname,
    port: url.port || 3306,
    ...auth,
    ...(database ? { database } : {}),
  };

  // Set environment variables for the server
  process.env.DB_HOST = connectionConfig.host;
  process.env.DB_PORT = connectionConfig.port;
  process.env.DB_USER = connectionConfig.user;
  process.env.DB_PASSWORD = connectionConfig.password;
  if (database) {
    process.env.DB_NAME = database;
  }
} catch (error) {
  console.error("Error parsing MySQL URL:", error.message);
  console.error(
    "Usage: npx @berthojoris/mcp-mysql-server mysql://user:password@host:port/dbname",
  );
  process.exit(1);
}

const dbMessage = database
  ? `${connectionConfig.host}:${connectionConfig.port}/${database}`
  : `${connectionConfig.host}:${connectionConfig.port} (no specific database selected)`;

// Set permissions/categories as environment variables if provided
if (permissions) {
  process.env.MCP_PERMISSIONS = permissions;
  console.error(`Permissions (Layer 1): ${permissions}`);
}

if (categories) {
  process.env.MCP_CATEGORIES = categories;
  console.error(`Categories (Layer 2): ${categories}`);
}

if (!permissions && !categories) {
  console.error("Access Control: Read-only default (list,read,utility)");
} else if (permissions && categories) {
  console.error("Filtering Mode: Dual-layer (Permissions + Categories)");
} else if (permissions && !categories) {
  console.error("Filtering Mode: Permission-based only");
} else if (!permissions && categories) {
  console.error("Filtering Mode: Category-only");
}

// Log to stderr (not stdout, which is used for MCP protocol)
console.error(`Starting MySQL MCP server with connection to ${dbMessage}`);

// Run the MCP server directly (no child process spawn)
// This ensures proper stdio communication for MCP protocol
try {
  // Directly require and execute the MCP server module
  // This avoids stdio forwarding issues with child processes
  require("../dist/mcp-server.js");
} catch (error) {
  console.error("Error starting MCP server:", error.message);
  process.exit(1);
}
