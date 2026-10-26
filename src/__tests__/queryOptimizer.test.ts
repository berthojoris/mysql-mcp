import { QueryOptimizer } from "../optimization/queryOptimizer";

const optimizer = QueryOptimizer.getInstance();
const base = "SELECT id FROM orders";
const injection = "PRIMARY) UNION SELECT 1 FROM mysql.user WHERE (1";

describe("QueryOptimizer.applyHints - untrusted hint values", () => {
  it("keeps valid hints", () => {
    expect(
      optimizer.applyHints(base, {
        useIndex: "idx_created",
        forceIndex: ["idx_a"],
        maxExecutionTime: 1000,
        hints: [
          { type: "JOIN_ORDER", tables: ["orders", "items"] },
          { type: "INDEX", table: "orders", index: ["idx_a", "idx_b"] },
          { type: "SEMIJOIN", strategy: "firstmatch, loosescan" },
          { type: "SET_VAR", value: "optimizer_switch='mrr=on,mrr_cost_based=off'" },
        ],
      }),
    ).toBe(
      "SELECT /*+ JOIN_ORDER(orders, items) INDEX(orders idx_a, idx_b) SEMIJOIN(FIRSTMATCH, LOOSESCAN) " +
        "SET_VAR(optimizer_switch='mrr=on,mrr_cost_based=off') MAX_EXECUTION_TIME(1000) INDEX(idx_a) */ " +
        "id FROM orders USE INDEX (idx_created)",
    );
  });

  it.each([
    ["useIndex", { useIndex: injection }],
    ["forceIndex", { forceIndex: [injection] }],
    ["table", { hints: [{ type: "BKA" as const, table: "t) */ SELECT 1 /*" }] }],
    ["tables", { hints: [{ type: "JOIN_ORDER" as const, tables: ["a", "b) */ x /*"] }] }],
    ["index", { hints: [{ type: "INDEX" as const, table: "orders", index: injection }] }],
    ["strategy", { hints: [{ type: "SUBQUERY" as const, strategy: "INTOEXISTS) */ x /*" }] }],
    ["MAX_EXECUTION_TIME", { hints: [{ type: "MAX_EXECUTION_TIME" as const, value: "1) */ x /*" }] }],
    ["RESOURCE_GROUP", { hints: [{ type: "RESOURCE_GROUP" as const, value: "g) */ x /*" }] }],
    ["SET_VAR", { hints: [{ type: "SET_VAR" as const, value: "sort_buffer_size=1) */ x /*" }] }],
  ])("drops an unsafe %s value", (_name, hints) => {
    const result = optimizer.applyHints(base, hints);
    expect(result).not.toMatch(/UNION|\bx\b|mysql\.user|\*\/ SELECT/);
    expect(result.match(/\*\//g)?.length ?? 0).toBeLessThanOrEqual(1);
  });
});
