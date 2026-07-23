import DatabaseConnection from "../db/connection";
import {
  validateListTables,
  validateReadTableSchema,
  TableInfo,
  ColumnInfo,
} from "../validation/schemas";
import { dbConfig } from "../config/config";

export class DatabaseTools {
  private db: DatabaseConnection;

  constructor() {
    this.db = DatabaseConnection.getInstance();
  }

  /**
   * List only the connected database (security restriction)
   * This prevents access to other databases on the MySQL server
   */
  async listDatabases(): Promise<{
    status: string;
    data?: string[];
    error?: string;
  }> {
    try {
      // Only return the database specified in the connection string
      // This is a security measure to prevent access to other databases
      if (!dbConfig.database) {
        return {
          status: "error",
          error:
            "No database specified in connection string. Please specify a database name in your MySQL connection URL.",
        };
      }

      // Verify the database exists and is accessible
      const results = await this.db.query<any[]>(
        "SELECT DATABASE() as current_database",
      );
      const currentDatabase = results[0]?.current_database;

      if (!currentDatabase) {
        return {
          status: "error",
          error:
            "No database selected. Please ensure your connection string includes a valid database name.",
        };
      }

      return {
        status: "success",
        data: [currentDatabase],
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * List all tables in the selected database
   */
  async listTables(params: { database?: string }): Promise<{
    status: string;
    data?: TableInfo[];
    error?: string;
  }> {
    // Validate input
    if (!validateListTables(params)) {
      return {
        status: "error",
        error:
          "Invalid parameters: " + JSON.stringify(validateListTables.errors),
      };
    }

    try {
      // Security validation: if database is specified, ensure it matches the connected database
      if (params.database) {
        if (!dbConfig.database) {
          return {
            status: "error",
            error:
              "No database specified in connection string. Cannot access other databases.",
          };
        }

        if (params.database !== dbConfig.database) {
          return {
            status: "error",
            error: `Access denied. You can only access the connected database '${dbConfig.database}'. Requested database '${params.database}' is not allowed.`,
          };
        }
      }

      let query = "SHOW TABLES";

      // If database is specified and validated, use it
      if (params.database) {
        query = `SHOW TABLES FROM \`${params.database}\``;
      }

      const results = await this.db.query<any[]>(query);
      const tables = results.map((row) => {
        // Extract the table name from the first column (which might have different names)
        const firstColumnName = Object.keys(row)[0];
        return { table_name: row[firstColumnName] };
      });

      return {
        status: "success",
        data: tables,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Read table schema (columns, types, keys, etc.)
   */
  async readTableSchema(params: { table_name: string }): Promise<{
    status: string;
    data?: ColumnInfo[];
    error?: string;
  }> {
    // Validate input
    if (!validateReadTableSchema(params)) {
      return {
        status: "error",
        error:
          "Invalid parameters: " +
          JSON.stringify(validateReadTableSchema.errors),
      };
    }

    try {
      const query = `
        SELECT
          COLUMN_NAME as column_name,
          DATA_TYPE as data_type,
          CHARACTER_MAXIMUM_LENGTH as character_maximum_length,
          IS_NULLABLE as is_nullable,
          COLUMN_KEY as column_key,
          COLUMN_DEFAULT as column_default,
          EXTRA as extra
        FROM
          INFORMATION_SCHEMA.COLUMNS
        WHERE
          TABLE_SCHEMA = ? AND
          TABLE_NAME = ?
        ORDER BY
          ORDINAL_POSITION
      `;

      const results = await this.db.query<ColumnInfo[]>(query, [
        dbConfig.database,
        params.table_name,
      ]);

      return {
        status: "success",
        data: results,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Get a high-level summary of the database (tables, columns, row counts)
   * Optimized for AI context window with better formatting and optional limits
   */
  async getDatabaseSummary(params: { 
    database?: string;
    max_tables?: number;
    include_relationships?: boolean;
  }): Promise<{
    status: string;
    data?: string;
    error?: string;
  }> {
    try {
      // Security validation
      if (params.database && params.database !== dbConfig.database) {
        return {
          status: "error",
          error: `Access denied. You can only access the connected database '${dbConfig.database}'.`,
        };
      }

      const database = params.database || dbConfig.database;
      if (!database) {
        return {
          status: "error",
          error: "No database specified and none connected.",
        };
      }

      const maxTables = params.max_tables ? Math.min(Math.max(params.max_tables, 1), 500) : undefined;
      const includeRelationships = params.include_relationships ?? true;

      // Get total table count first
      const totalCountQuery = `
        SELECT COUNT(*) as total
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
      `;
      const totalCountResult = await this.db.query<any[]>(totalCountQuery, [database]);
      const totalTables = totalCountResult[0]?.total || 0;

      // Get tables and row counts with optional limit
      const tablesQuery = `
        SELECT TABLE_NAME, TABLE_ROWS
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
        ${maxTables ? `LIMIT ${maxTables}` : ''}
      `;
      const tables = await this.db.query<any[]>(tablesQuery, [database]);

      if (tables.length === 0) {
        return {
          status: "success",
          data: `# Database Summary: ${database}\n\nNo tables found in this database.`
        };
      }

      // Get columns for displayed tables
      const tableNames = tables.map(t => t.TABLE_NAME);
      const placeholders = tableNames.map(() => '?').join(',');
      
      const columnsQuery = `
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY, IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `;
      const columns = await this.db.query<any[]>(columnsQuery, [database, ...tableNames]);

      // Get foreign key relationships if requested
      let foreignKeys: any[] = [];
      if (includeRelationships) {
        const fkQuery = `
          SELECT 
            TABLE_NAME,
            COLUMN_NAME,
            REFERENCED_TABLE_NAME,
            REFERENCED_COLUMN_NAME
          FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME IN (${placeholders})
            AND REFERENCED_TABLE_NAME IS NOT NULL
        `;
        foreignKeys = await this.db.query<any[]>(fkQuery, [database, ...tableNames]);
      }

      // Build enhanced summary
      let summary = `# Database Summary: ${database}\n\n`;
      
      // Overview section
      summary += `## Overview\n`;
      summary += `- **Total Tables**: ${totalTables}\n`;
      summary += `- **Tables Shown**: ${tables.length}${maxTables && totalTables > maxTables ? ` (limited to ${maxTables})` : ''}\n`;
      
      const totalRows = tables.reduce((sum, t) => sum + (parseInt(t.TABLE_ROWS) || 0), 0);
      summary += `- **Total Estimated Rows**: ~${totalRows.toLocaleString()}\n\n`;

      // Tables section
      summary += `## Tables\n\n`;
      
      for (const table of tables) {
        const rowCount = parseInt(table.TABLE_ROWS) || 0;
        summary += `### ${table.TABLE_NAME}\n`;
        summary += `**Rows**: ~${rowCount.toLocaleString()}\n\n`;
        
        const tableColumns = columns.filter(c => c.TABLE_NAME === table.TABLE_NAME);
        const tableFKs = foreignKeys.filter(fk => fk.TABLE_NAME === table.TABLE_NAME);
        
        // Primary keys
        const primaryKeys = tableColumns.filter(c => c.COLUMN_KEY === 'PRI');
        if (primaryKeys.length > 0) {
          summary += `**Primary Key(s)**: ${primaryKeys.map(c => c.COLUMN_NAME).join(', ')}\n\n`;
        }
        
        // Columns
        summary += `**Columns** (${tableColumns.length}):\n`;
        for (const col of tableColumns) {
          const nullable = col.IS_NULLABLE === 'YES' ? 'nullable' : 'not null';
          let keys: string[] = [];
          
          if (col.COLUMN_KEY === 'PRI') keys.push('PK');
          else if (col.COLUMN_KEY === 'UNI') keys.push('UNI');
          
          // Check if this column is a foreign key
          const fk = tableFKs.find(f => f.COLUMN_NAME === col.COLUMN_NAME);
          if (fk) {
            keys.push(`FK → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}`);
          } else if (col.COLUMN_KEY === 'MUL') {
            keys.push('Index');
          }
          
          const keyInfo = keys.length > 0 ? ` [${keys.join(', ')}]` : '';
          summary += `  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${nullable})${keyInfo}\n`;
        }
        
        summary += `\n`;
      }

      // Relationships summary if included and exists
      if (includeRelationships && foreignKeys.length > 0) {
        summary += `## Foreign Key Relationships (${foreignKeys.length})\n\n`;
        for (const fk of foreignKeys) {
          summary += `- ${fk.TABLE_NAME}.${fk.COLUMN_NAME} → ${fk.REFERENCED_TABLE_NAME}.${fk.REFERENCED_COLUMN_NAME}\n`;
        }
        summary += `\n`;
      }

      // Footer note if tables were limited
      if (maxTables && totalTables > maxTables) {
        summary += `\n---\n`;
        summary += `*Note: ${totalTables - maxTables} table(s) not shown. Increase \`max_tables\` parameter to see more.*\n`;
      }

      return {
        status: "success",
        data: summary
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message
      };
    }
  }

  /**
   * Get a Mermaid.js ER diagram for the database schema
   */
  async getSchemaERD(params: { database?: string }): Promise<{
    status: string;
    data?: string;
    error?: string;
  }> {
    try {
       // Security validation
      if (params.database && params.database !== dbConfig.database) {
        return {
          status: "error",
          error: `Access denied. You can only access the connected database '${dbConfig.database}'.`,
        };
      }

      const database = params.database || dbConfig.database;
      if (!database) {
        return {
          status: "error",
          error: "No database specified and none connected.",
        };
      }

      // Get tables and columns
      const columnsQuery = `
        SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME, ORDINAL_POSITION
      `;
      const columns = await this.db.query<any[]>(columnsQuery, [database]);

      // Get foreign keys
      const fkQuery = `
        SELECT 
          TABLE_NAME, COLUMN_NAME, 
          REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE TABLE_SCHEMA = ? 
          AND REFERENCED_TABLE_SCHEMA = ? 
          AND REFERENCED_TABLE_NAME IS NOT NULL
      `;
      const fks = await this.db.query<any[]>(fkQuery, [database, database]);

      // Build Mermaid ER diagram
      let mermaid = "erDiagram\n";
      
      // Add entities (tables)
      const tables = [...new Set(columns.map(c => c.TABLE_NAME))];
      for (const table of tables) {
        mermaid += `    ${table} {\n`;
        const tableColumns = columns.filter(c => c.TABLE_NAME === table);
        for (const col of tableColumns) {
          let type = col.DATA_TYPE;
          let key = "";
          if (col.COLUMN_KEY === 'PRI') key = "PK";
          else if (col.COLUMN_KEY === 'MUL') key = "FK";
          
          mermaid += `        ${type} ${col.COLUMN_NAME} ${key}\n`;
        }
        mermaid += `    }\n`;
      }

      // Add relationships
      for (const fk of fks) {
        // Relationship logic: referenced_table ||--o{ table
        // This is a simplification, usually FK implies 1 to Many
        mermaid += `    ${fk.REFERENCED_TABLE_NAME} ||--o{ ${fk.TABLE_NAME} : "${fk.COLUMN_NAME}"\n`;
      }

      return {
        status: "success",
        data: mermaid
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message
      };
    }
  }
}
