import { FeatureConfig, DEFAULT_PERMISSIONS } from "../config/featureConfig";

describe("FeatureConfig defaults", () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.MCP_PERMISSIONS;
    delete process.env.MCP_CONFIG;
    delete process.env.MCP_CATEGORIES;
  });

  afterAll(() => {
    process.env = savedEnv;
  });

  it("is read-only when nothing is configured", () => {
    const config = new FeatureConfig();

    expect(config.isToolEnabled("listTables")).toBe(true);
    expect(config.isToolEnabled("runSelectQuery")).toBe(true);
    expect(config.isToolEnabled("testConnection")).toBe(true);

    expect(config.isToolEnabled("createRecord")).toBe(false);
    expect(config.isToolEnabled("deleteRecord")).toBe(false);
    expect(config.isToolEnabled("executeWriteQuery")).toBe(false);
    expect(config.isToolEnabled("executeDdl")).toBe(false);
    expect(config.isToolEnabled("dropTable")).toBe(false);
    expect(config.isToolEnabled("beginTransaction")).toBe(false);
  });

  it("reports the default permissions in the access profile", () => {
    const profile = new FeatureConfig().getConfigSnapshot();

    expect(profile.permissions).toBe(DEFAULT_PERMISSIONS);
    expect(profile.filteringMode).toContain("read-only");
  });

  it("enables write tools only when granted", () => {
    const config = new FeatureConfig("list,read,create,ddl");

    expect(config.isToolEnabled("createRecord")).toBe(true);
    expect(config.isToolEnabled("executeDdl")).toBe(true);
    expect(config.isToolEnabled("deleteRecord")).toBe(false);
  });

  it("keeps all permissions when only categories are given", () => {
    const config = new FeatureConfig("", "crud_operations");

    expect(config.isToolEnabled("deleteRecord")).toBe(true);
    expect(config.isToolEnabled("listTables")).toBe(false);
  });
});
