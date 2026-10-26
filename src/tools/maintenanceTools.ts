import DatabaseConnection from "../db/connection";
import { SecurityLayer } from "../security/securityLayer";
import { dbConfig } from "../config/config";

export class MaintenanceTools {
  private db: DatabaseConnection;
  private security: SecurityLayer;

  constructor(security: SecurityLayer) {
    this.db = DatabaseConnection.getInstance();
    this.security = security;
  }

  /**
   * Validate database access - ensures only the connected database can be accessed
   */
  private validateDatabaseAccess(requestedDatabase?: string): {
    valid: boolean;
    database: string;
    error?: string;
  } {
    const connectedDatabase = dbConfig.database;

    if (!connectedDatabase) {
      return {
        valid: false,
        database: "",
        error:
          "No database specified in connection string. Cannot access any database.",
      };
    }

    if (!requestedDatabase) {
      return {
        valid: true,
        database: connectedDatabase,
      };
    }

    if (requestedDatabase !== connectedDatabase) {
      return {
        valid: false,
        database: "",
        error: `Access denied. You can only access the connected database '${connectedDatabase}'. Requested database '${requestedDatabase}' is not allowed.`,
      };
    }

    return {
      valid: true,
      database: connectedDatabase,
    };
  }

  /**
   * Analyze table to update index statistics
   */
  async analyzeTable(params: {
    table_name: string;
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name } = params;
      const database = dbValidation.database;

      // Validate table name
      if (!this.security.validateIdentifier(table_name).valid) {
        return { status: "error", error: "Invalid table name" };
      }

      const query = `ANALYZE TABLE \`${database}\`.\`${table_name}\``;
      const results = await this.db.query<any[]>(query);

      return {
        status: "success",
        data: results[0],
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Optimize table to reclaim unused space and defragment
   */
  async optimizeTable(params: {
    table_name: string;
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name } = params;
      const database = dbValidation.database;

      // Validate table name
      if (!this.security.validateIdentifier(table_name).valid) {
        return { status: "error", error: "Invalid table name" };
      }

      const query = `OPTIMIZE TABLE \`${database}\`.\`${table_name}\``;
      const results = await this.db.query<any[]>(query);

      return {
        status: "success",
        data: results[0],
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Check table for errors
   */
  async checkTable(params: {
    table_name: string;
    check_type?: "QUICK" | "FAST" | "MEDIUM" | "EXTENDED" | "CHANGED";
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name, check_type } = params;
      const database = dbValidation.database;

      // Validate table name
      if (!this.security.validateIdentifier(table_name).valid) {
        return { status: "error", error: "Invalid table name" };
      }

      let query = `CHECK TABLE \`${database}\`.\`${table_name}\``;
      if (check_type) {
        query += ` ${check_type}`;
      }

      const results = await this.db.query<any[]>(query);

      return {
        status: "success",
        data: results[0],
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Repair table (MyISAM, ARCHIVE, CSV only)
   */
  async repairTable(params: {
    table_name: string;
    quick?: boolean;
    extended?: boolean;
    use_frm?: boolean;
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const {
        table_name,
        quick = false,
        extended = false,
        use_frm = false,
      } = params;
      const database = dbValidation.database;

      // Validate table name
      if (!this.security.validateIdentifier(table_name).valid) {
        return { status: "error", error: "Invalid table name" };
      }

      let query = `REPAIR TABLE \`${database}\`.\`${table_name}\``;
      const options: string[] = [];

      if (quick) options.push("QUICK");
      if (extended) options.push("EXTENDED");
      if (use_frm) options.push("USE_FRM");

      if (options.length > 0) {
        query += ` ${options.join(" ")}`;
      }

      const results = await this.db.query<any[]>(query);

      return {
        status: "success",
        data: results[0],
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Truncate table (remove all rows quickly)
   */
  async truncateTable(params: {
    table_name: string;
    database?: string;
  }): Promise<{
    status: string;
    message?: string;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name } = params;
      const database = dbValidation.database;

      // Validate table name
      if (!this.security.validateIdentifier(table_name).valid) {
        return { status: "error", error: "Invalid table name" };
      }

      const query = `TRUNCATE TABLE \`${database}\`.\`${table_name}\``;
      await this.db.query(query);

      return {
        status: "success",
        message: `Table '${table_name}' truncated successfully`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Get table status and statistics
   */
  async getTableStatus(params: {
    table_name?: string;
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name } = params;
      const database = dbValidation.database;

      let query = `SHOW TABLE STATUS FROM \`${database}\``;

      if (table_name) {
        if (!this.security.validateIdentifier(table_name).valid) {
          return { status: "error", error: "Invalid table name" };
        }
        query += ` LIKE '${table_name}'`;
      }

      const results = await this.db.query<any[]>(query);

      // Format results for better readability
      const formattedResults = results.map((row) => ({
        table_name: row.Name,
        engine: row.Engine,
        version: row.Version,
        row_format: row.Row_format,
        rows: row.Rows,
        avg_row_length: row.Avg_row_length,
        data_length: row.Data_length,
        max_data_length: row.Max_data_length,
        index_length: row.Index_length,
        data_free: row.Data_free,
        auto_increment: row.Auto_increment,
        create_time: row.Create_time,
        update_time: row.Update_time,
        check_time: row.Check_time,
        collation: row.Collation,
        checksum: row.Checksum,
        create_options: row.Create_options,
        comment: row.Comment,
      }));

      return {
        status: "success",
        data: table_name ? formattedResults[0] : formattedResults,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Flush table(s) of the connected database (close and reopen).
   * WITH READ LOCK is not supported: the lock would stay on a pooled
   * connection and, without a table name, block writes server-wide.
   */
  async flushTable(params: {
    table_name?: string;
    with_read_lock?: boolean;
    database?: string;
  }): Promise<{
    status: string;
    message?: string;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name, with_read_lock = false } = params;
      const database = dbValidation.database;

      if (with_read_lock) {
        return {
          status: "error",
          error: "with_read_lock is not supported: the read lock would outlive this call on a pooled connection.",
        };
      }

      let tableNames: string[];

      if (table_name) {
        if (!this.security.validateIdentifier(table_name).valid) {
          return { status: "error", error: "Invalid table name" };
        }
        tableNames = [table_name];
      } else {
        // Flush only the connected database, never every table on the server
        const rows = await this.db.query<any[]>(
          "SELECT TABLE_NAME AS table_name FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
          [database],
        );
        tableNames = rows.map((row) => row.table_name);
      }

      if (tableNames.length > 0) {
        const tableList = tableNames
          .map((name) => `\`${database}\`.\`${name.replace(/`/g, "``")}\``)
          .join(", ");
        await this.db.query(`FLUSH TABLES ${tableList}`);
      }

      return {
        status: "success",
        message: table_name
          ? `Table '${table_name}' flushed successfully`
          : `${tableNames.length} table(s) in '${database}' flushed successfully`,
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  /**
   * Get table size information
   */
  async getTableSize(params: {
    table_name?: string;
    database?: string;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const dbValidation = this.validateDatabaseAccess(params?.database);
      if (!dbValidation.valid) {
        return { status: "error", error: dbValidation.error! };
      }

      const { table_name } = params;
      const database = dbValidation.database;

      let query = `
        SELECT
          TABLE_NAME as table_name,
          TABLE_ROWS as row_count,
          DATA_LENGTH as data_size_bytes,
          INDEX_LENGTH as index_size_bytes,
          (DATA_LENGTH + INDEX_LENGTH) as total_size_bytes,
          ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as total_size_mb,
          DATA_FREE as free_space_bytes,
          ENGINE as engine,
          TABLE_COLLATION as collation
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = ?
      `;

      const queryParams: any[] = [database];

      if (table_name) {
        if (!this.security.validateIdentifier(table_name).valid) {
          return { status: "error", error: "Invalid table name" };
        }
        query += ` AND TABLE_NAME = ?`;
        queryParams.push(table_name);
      }

      query += ` ORDER BY (DATA_LENGTH + INDEX_LENGTH) DESC`;

      const results = await this.db.query<any[]>(query, queryParams);

      // Calculate totals if getting all tables
      let totalStats = null;
      if (!table_name && results.length > 0) {
        totalStats = {
          total_tables: results.length,
          total_rows: results.reduce((sum, r) => sum + (r.row_count || 0), 0),
          total_data_size_bytes: results.reduce(
            (sum, r) => sum + (r.data_size_bytes || 0),
            0,
          ),
          total_index_size_bytes: results.reduce(
            (sum, r) => sum + (r.index_size_bytes || 0),
            0,
          ),
          total_size_mb: results
            .reduce((sum, r) => sum + (parseFloat(r.total_size_mb) || 0), 0)
            .toFixed(2),
        };
      }

      return {
        status: "success",
        data: {
          tables: table_name ? results[0] : results,
          ...(totalStats && { summary: totalStats }),
        },
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }
}
