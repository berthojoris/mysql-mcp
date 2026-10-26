import { Tool } from "@modelcontextprotocol/sdk/types.js";
import { MySQLMCP } from "../index";
import { toolCategoryMap, toolDocCategoryMap } from "../config/featureConfig";

const toCamelCase = (value: string): string =>
  value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());

export const isToolEnabled = (mysqlMCP: MySQLMCP, tool: Tool): boolean => {
  const camelCaseName = toCamelCase(tool.name);
  // Some tools are only mapped by their snake_case name; checking an unmapped
  // name logs an "Unknown tool" warning, so pick the mapped one.
  const mappedName =
    toolCategoryMap[camelCaseName] || toolDocCategoryMap[camelCaseName]
      ? camelCaseName
      : tool.name;
  return mysqlMCP.isToolEnabled(mappedName);
};

export const getEnabledTools = (mysqlMCP: MySQLMCP, tools: Tool[]): Tool[] =>
  tools.filter((tool) => isToolEnabled(mysqlMCP, tool));
