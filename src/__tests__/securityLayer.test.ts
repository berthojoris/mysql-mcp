import SecurityLayer from "../security/securityLayer";
import { FeatureConfig } from "../config/featureConfig";

const readOnly = () => new SecurityLayer(new FeatureConfig("list,read,utility"));
const withExecute = () =>
  new SecurityLayer(new FeatureConfig("list,read,utility,update,delete,execute"));

describe("SecurityLayer.validateQuery - quoted content", () => {
  it.each([
    "SELECT * FROM t WHERE color = '#fff'",
    "SELECT * FROM t WHERE note = 'a;b'",
    "SELECT * FROM t WHERE note = 'x -- y'",
    "SELECT * FROM t WHERE note = '/* not a comment */'",
    "SELECT * FROM t WHERE note = \"it's; fine\"",
    "SELECT * FROM t WHERE note = 'it''s # ok'",
    "SELECT `a#b` FROM t",
    "SELECT * FROM t WHERE note = 'grant access'",
    "SELECT * FROM t;",
  ])("accepts %s", (query) => {
    expect(readOnly().validateQuery(query)).toEqual({ valid: true, queryType: "SELECT" });
  });

  it.each([
    ["SELECT 1 # comment", "Comments not allowed"],
    ["SELECT 1 -- comment", "Comments not allowed"],
    ["SELECT 1 /* comment */", "Comments not allowed"],
    ["SELECT 1; SELECT 2", "Multiple statements"],
    ["SELECT 1; DROP TABLE t", "Multiple statements"],
    // A quote inside a backtick identifier must not hide a real comment
    ["SELECT `x'` # ' FROM t", "Comments not allowed"],
    // Unterminated literals are checked against the raw text
    ["SELECT 1 -- it's", "Comments not allowed"],
  ])("rejects %s", (query, error) => {
    const result = readOnly().validateQuery(query);
    expect(result.valid).toBe(false);
    expect(result.error).toContain(error);
  });

  it("checks literals with backslashes against the raw text", () => {
    // Under NO_BACKSLASH_ESCAPES the literal ends at \' and # starts a comment
    const result = readOnly().validateQuery("SELECT 'a\\' # ', 1");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Comment");
  });

  it("still detects dangerous keywords hidden by quoted identifiers", () => {
    const result = withExecute().validateQuery("SELECT * FROM `mysql`.`user`");
    expect(result.valid).toBe(false);
  });

  it("still detects dangerous keywords when a literal contains a backslash", () => {
    const result = withExecute().validateQuery(
      "SELECT * FROM `mysql`.`user` WHERE name = 'a\\\\b'",
    );
    expect(result.valid).toBe(false);
  });

  it("does not let a quote inside an identifier hide a dangerous function", () => {
    const result = withExecute().validateQuery(
      "SELECT `x'`, LOAD_FILE('/etc/passwd'), ' ` FROM t",
    );
    expect(result.valid).toBe(false);
  });
});

describe("SecurityLayer.validateQuery - common table expressions", () => {
  it("requires execute permission for WITH ... SELECT", () => {
    const result = readOnly().validateQuery("WITH x AS (SELECT 1) SELECT * FROM x");
    expect(result.valid).toBe(false);
    expect(result.error).toContain("execute");
  });

  it("classifies WITH ... SELECT as SELECT", () => {
    expect(
      withExecute().validateQuery(
        "WITH RECURSIVE x (n) AS (SELECT 1), `y` AS (SELECT ')' AS p) SELECT * FROM x, y",
        true,
      ),
    ).toEqual({ valid: true, queryType: "SELECT" });
  });

  it("classifies WITH ... UPDATE by its main statement", () => {
    expect(
      withExecute().validateQuery(
        "WITH ids AS (SELECT id FROM a) UPDATE b SET flag = 1 WHERE id IN (SELECT id FROM ids)",
        true,
      ),
    ).toEqual({ valid: true, queryType: "UPDATE" });
  });

  it("requires delete permission for WITH ... DELETE", () => {
    const security = new SecurityLayer(new FeatureConfig("list,read,execute"));
    const result = security.validateQuery(
      "WITH ids AS (SELECT id FROM a) DELETE FROM b WHERE id IN (SELECT id FROM ids)",
      true,
    );
    expect(result.valid).toBe(false);
    expect(result.error).toContain("delete");
  });

  it.each([
    "WITH x AS SELECT 1",
    "WITH x AS (SELECT 1 SELECT * FROM x",
    "WITH x AS (SELECT 'a\\'') SELECT * FROM x",
  ])("rejects unparseable WITH clause %s", (query) => {
    expect(withExecute().validateQuery(query, true).valid).toBe(false);
  });
});
