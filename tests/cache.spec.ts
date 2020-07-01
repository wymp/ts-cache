import { Cache, MockCache } from "../src";

// Extend cache to expose internals
class TestCache extends Cache {
  public getCache() {
    return this._cache;
  }
}

describe("Cache", () => {

  let db: { test1: number; test2: number; test3: number; };
  let cache: TestCache;
  beforeEach(() => {
    cache = new TestCache({ maxLength: 2 });
    db = {
      test1: 1,
      test2: 2,
      test3: 3,
    }
  });

  it("should cache results", async () => {
    let val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(1);

    db.test1 = 100;
    val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(1);

    db.test2 = 200;
    val = await cache.get("test2", async () => { return db.test2; });
    expect(val).toBe(200);
  });

  it("should clear out old cache keys", async () => {
    let val: number;
    val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(1);
    val = await cache.get("test2", async () => { return db.test2; });
    expect(val).toBe(2);

    // Should still have test1 at this point
    db.test1 = 100;
    val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(1);
    expect(cache.getCache()).toHaveProperty("test1");

    val = await cache.get("test3", async () => { return db.test3; });
    expect(val).toBe(3);

    expect(cache.getCache()).not.toHaveProperty("test1");
    val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(100);
  });

  it("should clear values when requested", async () => {
    let val: number;
    val = await cache.get("test1", async () => { return db.test1; });
    expect(val).toBe(1);
    val = await cache.get("test2", async () => { return db.test2; });
    expect(val).toBe(2);

    expect(cache.getCache()).toHaveProperty("test1");
    expect(cache.getCache()).toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test3");

    db.test2 = 200;
    cache.clear("test2");
    expect(cache.getCache()).not.toHaveProperty("test2");
    val = await cache.get("test2", async () => { return db.test2; });
    expect(val).toBe(200);

    val = await cache.get("test3", async () => { return db.test3; });
    expect(val).toBe(3);
    expect(cache.getCache()).toHaveProperty("test3");
    expect(cache.getCache()).toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test1");

    cache.clear();
    expect(cache.getCache()).not.toHaveProperty("test3");
    expect(cache.getCache()).not.toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test1");
  });

  it("should clear values after ttl reached", async () => {
    let val: number;
    cache = new TestCache({ ttlSec: 2 });

    val = await cache.get("test1", async () => { return db.test1; }, 1);
    expect(val).toBe(1);
    val = await cache.get("test2", async () => { return db.test2; });
    expect(val).toBe(2);

    expect(cache.getCache()).toHaveProperty("test1");
    expect(cache.getCache()).toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test3");

    let run = 1;
    let timer: any;
    await new Promise((res, rej) => {
      timer = setInterval(() => {
        if (run === 1) {
          expect(cache.getCache()).toHaveProperty("test1");
          expect(cache.getCache()).toHaveProperty("test2");
          expect(cache.getCache()).not.toHaveProperty("test3");
        } else if (run === 2) {
          expect(cache.getCache()).not.toHaveProperty("test1");
          expect(cache.getCache()).toHaveProperty("test2");
          expect(cache.getCache()).not.toHaveProperty("test3");
        } else if (run === 3) {
          expect(cache.getCache()).not.toHaveProperty("test1");
          expect(cache.getCache()).not.toHaveProperty("test2");
          expect(cache.getCache()).not.toHaveProperty("test3");
          clearInterval(timer);
          res();
        }
        run++;
      }, 800);
    });
  });

  it("should handle various types of input correctly", async () => {
    let val: number | undefined;
    let pval: Promise<number>;

    val = cache.get("test1");
    expect(typeof val).toBe("undefined");

    pval = cache.get("test1", () => 1);
    expect(typeof pval.then).not.toBe("undefined");
    await pval.then((v) => expect(v).toBe(1));

    val = cache.get("test1");
    expect(val).toBe(1);
  });
});

describe("MockCache", () => {
  it("should correctly fulfill Cache dependencies (TS)", () => {
    const cache: Cache = new MockCache();
    expect(cache).toHaveProperty("clear");
  });

  it("should always return what's given", () => {
    const cache: Cache = new MockCache();
    expect(cache.get('one', () => Promise.resolve(1))).resolves.toBe(1);
    expect(cache.get('one', () => Promise.resolve(2))).resolves.toBe(2);
  });
});

