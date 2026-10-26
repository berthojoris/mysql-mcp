import { inspectGrants } from "../security/grantInspector";
import { RateLimiter } from "../server/rateLimiter";

describe("inspectGrants", () => {
  it("accepts a read-only account", () => {
    const result = inspectGrants([
      "GRANT USAGE ON *.* TO `reader`@`%`",
      "GRANT SELECT, SHOW VIEW ON `app`.* TO `reader`@`%`",
      "GRANT SELECT (`id`, `name`) ON `app`.`users` TO `reader`@`%`",
    ]);
    expect(result).toEqual({ readOnly: true, writePrivileges: [] });
  });

  it("flags write privileges, grant option, and roles", () => {
    const result = inspectGrants([
      "GRANT SELECT, INSERT, UPDATE ON `app`.* TO `writer`@`%` WITH GRANT OPTION",
      "GRANT ALL PRIVILEGES ON *.* TO `root`@`localhost`",
      "GRANT `app_role`@`%` TO `writer`@`%`",
    ]);
    expect(result.readOnly).toBe(false);
    expect(result.writePrivileges).toEqual(
      expect.arrayContaining(["INSERT", "UPDATE", "GRANT OPTION", "ALL PRIVILEGES", "ROLE"]),
    );
  });
});

describe("RateLimiter", () => {
  it("is disabled at 0", () => {
    const limiter = new RateLimiter(0);
    for (let i = 0; i < 1000; i++) expect(limiter.consume("a")).toBe(0);
  });

  it("limits per key within a sliding minute", () => {
    let now = 1_000_000;
    const limiter = new RateLimiter(2, () => now);

    expect(limiter.consume("a")).toBe(0);
    now += 10_000;
    expect(limiter.consume("a")).toBe(0);
    expect(limiter.consume("a")).toBe(50_000);
    expect(limiter.consume("b")).toBe(0);

    now += 50_000;
    expect(limiter.consume("a")).toBe(0);
  });
});
