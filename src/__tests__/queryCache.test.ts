const poolQuery = jest.fn();
const connectionQuery = jest.fn();
const mockConnection = {
  beginTransaction: jest.fn(),
  commit: jest.fn(),
  rollback: jest.fn(),
  release: jest.fn(),
  query: connectionQuery,
};

jest.mock("mysql2/promise", () => ({
  __esModule: true,
  default: {
    createPool: () => ({
      query: poolQuery,
      getConnection: jest.fn().mockResolvedValue(mockConnection),
      end: jest.fn(),
    }),
  },
}));

import DatabaseConnection from "../db/connection";
import { QueryCache } from "../cache/queryCache";

describe("query cache", () => {
  let db: DatabaseConnection;
  const cache = QueryCache.getInstance();

  beforeAll(() => {
    // The connection starts monitoring intervals; keep them from holding Jest open
    jest.useFakeTimers();
    db = DatabaseConnection.getInstance();
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  beforeEach(() => {
    cache.disable();
    poolQuery.mockReset().mockResolvedValue([[{ id: 1 }]]);
    connectionQuery.mockReset().mockResolvedValue([{ affectedRows: 1 }]);
  });

  it("is disabled by default", () => {
    expect(QueryCache.getInstance().getConfig().enabled).toBe(false);
    expect(process.env.CACHE_ENABLED).toBeUndefined();
  });

  it("does not cache when disabled", async () => {
    await db.query("SELECT * FROM t");
    await db.query("SELECT * FROM t");
    expect(poolQuery).toHaveBeenCalledTimes(2);
  });

  it("clears cached reads after a write, including db-qualified and multi-table writes", async () => {
    cache.enable();

    for (const write of [
      "UPDATE shop.t SET a = 1",
      "UPDATE a JOIN t ON a.id = t.id SET t.x = 1",
      "ALTER TABLE t ADD COLUMN c INT",
      "EXPLAIN ANALYZE DELETE FROM t",
    ]) {
      cache.clear();
      poolQuery.mockClear();
      await db.query("SELECT * FROM t");
      await db.query("SELECT * FROM t");
      expect(poolQuery).toHaveBeenCalledTimes(1);

      await db.query(write);
      await db.query("SELECT * FROM t");
      expect(poolQuery).toHaveBeenCalledTimes(3);
    }
  });

  it("keeps cached reads after read-only statements", async () => {
    cache.enable();

    await db.query("SELECT * FROM t");
    await db.query("SHOW TABLES");
    await db.query("EXPLAIN SELECT * FROM t");
    await db.query("SELECT * FROM t");
    expect(poolQuery).toHaveBeenCalledTimes(3);
  });

  it("clears cached reads when a transaction commits", async () => {
    cache.enable();

    await db.beginTransaction("tx1");
    await db.query("SELECT * FROM t");
    await db.executeInTransaction("tx1", "SELECT * FROM t");
    // Simulate another read caching pre-commit data after the write was issued
    await db.executeInTransaction("tx1", "UPDATE t SET a = 1");
    await db.query("SELECT * FROM t");
    expect(poolQuery).toHaveBeenCalledTimes(2);

    await db.commitTransaction("tx1");
    await db.query("SELECT * FROM t");
    expect(poolQuery).toHaveBeenCalledTimes(3);
  });
});
