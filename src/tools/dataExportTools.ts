import DatabaseConnection from "../db/connection";
import { validateReadRecords, FilterCondition, Pagination, Sorting } from "../validation/schemas";
import SecurityLayer from "../security/securityLayer";
import { dbConfig } from "../config/config";

export class DataExportTools {
  private db: DatabaseConnection;
  private security: SecurityLayer;

  constructor(security: SecurityLayer) {
    this.db = DatabaseConnection.getInstance();
    this.security = security;
  }

  /**
   * Validate database access
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
          "No database configured. Please specify a database in your connection settings.",
      };
    }

    if (requestedDatabase && requestedDatabase !== connectedDatabase) {
      return {
        valid: false,
        database: "",
        error: `Access denied: You are connected to '${connectedDatabase}' but requested '${requestedDatabase}'. Cross-database access is not permitted.`,
      };
    }

    return {
      valid: true,
      database: connectedDatabase,
    };
  }

  /**
   * Escape string value for SQL INSERT statements
   */
  private escapeValue(value: any): string {
    if (value === null) return "NULL";
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "1" : "0";
    if (value instanceof Date) {
      return `'${value.toISOString().slice(0, 19).replace("T", " ")}'`;
    }
    if (Buffer.isBuffer(value)) {
      return `X'${value.toString("hex")}'`;
    }
    // Escape string
    const escaped = String(value)
      .replace(/\\/g, "\\\\")
      .replace(/'/g, "\\'")
      .replace(/"/g, '\\"')
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t")
      .replace(/\0/g, "\\0");
    return `'${escaped}'`;
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return "";

    const normalizedValue = value instanceof Date
      ? value.toISOString()
      : Buffer.isBuffer(value)
        ? value.toString("base64")
        : String(value);

    if (/[",\r\n]/.test(normalizedValue)) {
      return `"${normalizedValue.replace(/"/g, '""')}"`;
    }

    return normalizedValue;
  }

  private rowsToCSV(rows: any[], includeHeaders: boolean): string {
    if (rows.length === 0) {
      return "";
    }

    const columns = Object.keys(rows[0]);
    const csvRows: string[] = [];

    if (includeHeaders) {
      csvRows.push(columns.map((column) => this.escapeCsvValue(column)).join(","));
    }

    for (const row of rows) {
      csvRows.push(columns.map((column) => this.escapeCsvValue(row[column])).join(","));
    }

    return `${csvRows.join("\n")}\n`;
  }

  /**
   * Export table data to CSV format
   */
  async exportTableToCSV(params: {
    table_name: string;
    filters?: FilterCondition[];
    pagination?: Pagination;
    sorting?: Sorting;
    include_headers?: boolean;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const readPermission = this.security.validateQueryPermissions("SELECT");
      if (!readPermission.valid) {
        return { status: "error", error: readPermission.error };
      }

      const {
        table_name,
        filters = [],
        pagination,
        sorting,
        include_headers = true,
      } = params;

      // Validate table name
      const tableValidation = this.security.validateIdentifier(table_name);
      if (!tableValidation.valid) {
        return {
          status: "error",
          error: tableValidation.error,
        };
      }

      // Build WHERE clause
      let whereClause = "";
      const whereParams: any[] = [];

      if (filters && filters.length > 0) {
        const whereConditions: string[] = [];

        for (const filter of filters) {
          // Validate field name
          const fieldValidation = this.security.validateIdentifier(
            filter.field,
          );
          if (!fieldValidation.valid) {
            return {
              status: "error",
              error: `Invalid field name: ${filter.field}`,
            };
          }

          const fieldName = this.security.escapeIdentifier(filter.field);

          switch (filter.operator) {
            case "eq":
              whereConditions.push(`${fieldName} = ?`);
              whereParams.push(filter.value);
              break;
            case "neq":
              whereConditions.push(`${fieldName} != ?`);
              whereParams.push(filter.value);
              break;
            case "gt":
              whereConditions.push(`${fieldName} > ?`);
              whereParams.push(filter.value);
              break;
            case "gte":
              whereConditions.push(`${fieldName} >= ?`);
              whereParams.push(filter.value);
              break;
            case "lt":
              whereConditions.push(`${fieldName} < ?`);
              whereParams.push(filter.value);
              break;
            case "lte":
              whereConditions.push(`${fieldName} <= ?`);
              whereParams.push(filter.value);
              break;
            case "like":
              whereConditions.push(`${fieldName} LIKE ?`);
              whereParams.push(filter.value);
              break;
            case "in":
              if (Array.isArray(filter.value)) {
                const placeholders = filter.value.map(() => "?").join(", ");
                whereConditions.push(`${fieldName} IN (${placeholders})`);
                whereParams.push(...filter.value);
              } else {
                return {
                  status: "error",
                  error: "IN operator requires an array of values",
                };
              }
              break;
            default:
              return {
                status: "error",
                error: `Unsupported operator: ${filter.operator}`,
              };
          }
        }

        if (whereConditions.length > 0) {
          whereClause = "WHERE " + whereConditions.join(" AND ");
        }
      }

      // Build ORDER BY clause
      let orderByClause = "";
      if (sorting) {
        const fieldValidation = this.security.validateIdentifier(sorting.field);
        if (!fieldValidation.valid) {
          return {
            status: "error",
            error: `Invalid sort field name: ${sorting.field}`,
          };
        }

        const fieldName = this.security.escapeIdentifier(sorting.field);
        const direction =
          sorting.direction.toUpperCase() === "DESC" ? "DESC" : "ASC";
        orderByClause = `ORDER BY ${fieldName} ${direction}`;
      }

      // Build LIMIT clause
      let limitClause = "";
      if (pagination) {
        const offset = (pagination.page - 1) * pagination.limit;
        limitClause = `LIMIT ${offset}, ${pagination.limit}`;
      }

      // Construct the query
      const escapedTableName = this.security.escapeIdentifier(table_name);
      const query = `SELECT * FROM ${escapedTableName} ${whereClause} ${orderByClause} ${limitClause}`;

      // Execute query
      const results: any[] = await this.db.query(query, whereParams);

      // If no results, return empty CSV
      if (results.length === 0) {
        return {
          status: "success",
          data: {
            csv: include_headers ? "" : "",
            row_count: 0,
          },
        };
      }

      const csv = this.rowsToCSV(results, include_headers);

      return {
        status: "success",
        data: {
          csv: csv,
          row_count: results.length,
        },
      };
    } catch (error: any) {
      return {
        status: "error",
        error: error.message,
      };
    }
  }

  async exportQueryToCSV(queryParams: {
    query: string;
    params?: any[];
    include_headers?: boolean;
  }): Promise<{
    status: string;
    data?: any;
    error?: string;
  }> {
    try {
      const readPermission = this.security.validateQueryPermissions("SELECT");
      if (!readPermission.valid) {
        return { status: "error", error: readPermission.error };
      }

      const {
        query,
        params = [],
        include_headers = true,
      } = queryParams;

      const queryValidation = this.security.validateQuery(
        query,
        this.security.hasExecutePermission(),
      );
      if (!queryValidation.valid) {
        return {
          status: "error",
          error: `Query validation failed: ${queryValidation.error}`,
        };
      }

      if (queryValidation.queryType !== "SELECT") {
        return {
          status: "error",
          error: "export_query_to_csv only accepts SELECT queries.",
        };
      }

      const paramValidation = this.security.validateParameters(params);
      if (!paramValidation.valid) {
        return {
          status: "error",
          error: `Parameter validation failed: ${paramValidation.error}`,
        };
      }

      const results = await this.db.query<any[]>(
        query,
        paramValidation.sanitizedParams!,
        false,
      );
      const maskedResults = this.security.masking.processResults(results);

      return {
        status: "success",
        data: {
          csv: this.rowsToCSV(maskedResults, include_headers),
          row_count: maskedResults.length,
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
