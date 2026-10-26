import fs from "fs";
import path from "path";

const MAX_SQL_LENGTH = 1000;
const SQL_ARGUMENT_NAMES = ["query", "sql"];

export interface AuditEntry {
  event: "tool_call" | "auth_failed" | "session_opened" | "session_closed";
  [key: string]: unknown;
}

/**
 * Writes one JSON line per event to stderr or a file. Never writes to stdout,
 * which carries the stdio MCP protocol.
 */
export class AuditLogger {
  private stream?: fs.WriteStream;
  private readonly toStderr: boolean;
  readonly enabled: boolean;

  constructor(target: string) {
    this.enabled = target !== "off";
    this.toStderr = target === "stderr";
    if (this.enabled && !this.toStderr) {
      const filePath = path.resolve(target);
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      this.stream = fs.createWriteStream(filePath, { flags: "a" });
      this.stream.on("error", (error) => {
        console.error(`Audit log write failed: ${error.message}`);
      });
    }
  }

  log(entry: AuditEntry): void {
    if (!this.enabled) return;
    const line = JSON.stringify({ time: new Date().toISOString(), ...entry });
    if (this.toStderr) {
      console.error(`[audit] ${line}`);
    } else {
      this.stream?.write(`${line}\n`);
    }
  }

  close(): void {
    this.stream?.end();
  }
}

/**
 * Argument summary for audit records: the names of all arguments, plus the SQL
 * text (truncated). Other values are omitted because they may hold row data.
 */
export const summarizeArguments = (args: Record<string, unknown> | undefined) => {
  const input = args || {};
  const summary: { names: string[]; sql?: string } = { names: Object.keys(input) };
  for (const name of SQL_ARGUMENT_NAMES) {
    const value = input[name];
    if (typeof value === "string") {
      summary.sql = value.length > MAX_SQL_LENGTH ? `${value.slice(0, MAX_SQL_LENGTH)}...` : value;
      break;
    }
  }
  return summary;
};
