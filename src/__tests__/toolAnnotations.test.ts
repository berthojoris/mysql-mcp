import fs from "fs";
import path from "path";
import { getToolAnnotations, hasExplicitAnnotations } from "../tools/toolAnnotations";

// mcp-server.ts starts the server on import, so read the tool names from its source
const toolNames = Array.from(
  fs.readFileSync(path.join(__dirname, "..", "mcp-server.ts"), "utf8").matchAll(/^ {4}name: "([a-z_]+)",$/gm),
  (match) => match[1],
);

describe("tool annotations", () => {
  it("finds the tool catalog", () => {
    expect(toolNames.length).toBe(88);
  });

  it("classifies every tool explicitly", () => {
    expect(toolNames.filter((name) => !hasExplicitAnnotations(name))).toEqual([]);
  });

  it("marks read tools read-only and write tools as not read-only", () => {
    expect(getToolAnnotations("run_select_query")).toMatchObject({ readOnlyHint: true, destructiveHint: false });
    expect(getToolAnnotations("create_record")).toMatchObject({ readOnlyHint: false, destructiveHint: false });
    expect(getToolAnnotations("drop_table")).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(getToolAnnotations("execute_write_query")).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(getToolAnnotations("cursor_execute_request")).toMatchObject({ readOnlyHint: false, destructiveHint: true });
    expect(getToolAnnotations("export_table_to_csv").title).toBe("Export Table To CSV");
  });

  it("treats unknown tools as destructive", () => {
    expect(getToolAnnotations("future_tool")).toMatchObject({ readOnlyHint: false, destructiveHint: true });
  });
});
