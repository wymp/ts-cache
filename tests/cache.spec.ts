import { SimpleLoggerInterface } from "@wymp/ts-simple-interfaces";
import { MockSimpleLogger } from "@wymp/ts-simple-interfaces-testing";
import { Cache, MockCache } from "../src";

// Extend cache to expose internals
class TestCache extends Cache {
  public getCache() {
    return this._cache;
  }
}

describe("Cache", () => {

  let log: SimpleLoggerInterface;
  let db: { test1: number; test2: number; test3: number; };
  let cache: TestCache;
  const t1 = () => Promise.resolve(db.test1);
  const t2 = () => Promise.resolve(db.test2);
  const t3 = () => Promise.resolve(db.test3);
  beforeEach(() => {
    log = new MockSimpleLogger({ outputMessages: false });
    cache = new TestCache({ maxLength: 2 }, log);
    db = {
      test1: 1,
      test2: 2,
      test3: 3,
    }
  });

  test("should cache results", async () => {
    let val = await cache.get("test1", t1);
    expect(val).toBe(1);

    db.test1 = 100;
    val = await cache.get("test1", t1);
    expect(val).toBe(1);

    db.test2 = 200;
    val = await cache.get("test2", t2);
    expect(val).toBe(200);
  });

  test("should clear out old cache keys", async () => {
    let val: number;
    val = await cache.get("test1", t1);
    expect(val).toBe(1);
    val = await cache.get("test2", t2);
    expect(val).toBe(2);

    // Should still have test1 at this point
    db.test1 = 100;
    val = await cache.get("test1", t1);
    expect(val).toBe(1);
    expect(cache.getCache()).toHaveProperty("test1");
    val = await cache.get("test2", t2);
    expect(val).toBe(2);

    // Now test1 is the oldest item in the cache
    val = await cache.get("test3", t3);
    expect(val).toBe(3);

    // Wait a bit for the gc
    await new Promise(res => setTimeout(() => res(), 8));

    expect(cache.getCache()).not.toHaveProperty("test1");
    val = await cache.get("test1", t1);
    expect(val).toBe(100);
  });

  test("should clear values when requested", async () => {
    let val: number;
    val = await cache.get("test1", t1);
    expect(val).toBe(1);
    val = await cache.get("test2", t2);
    expect(val).toBe(2);

    expect(cache.getCache()).toHaveProperty("test1");
    expect(cache.getCache()).toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test3");

    db.test2 = 200;
    cache.clear("test2");
    expect(cache.getCache()).not.toHaveProperty("test2");
    val = await cache.get("test2", t2);
    expect(val).toBe(200);

    val = await cache.get("test3", t3);
    expect(val).toBe(3);
    expect(cache.getCache()).toHaveProperty("test3");
    expect(cache.getCache()).toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test1");

    cache.clear();
    expect(cache.getCache()).not.toHaveProperty("test3");
    expect(cache.getCache()).not.toHaveProperty("test2");
    expect(cache.getCache()).not.toHaveProperty("test1");
  });

  test("should clear values after ttl reached", async () => {
    let val: number;
    cache = new TestCache({ ttlSec: 2 });

    val = await cache.get("test1", t1, 1);
    expect(val).toBe(1);
    val = await cache.get("test2", t2);
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

  test("should handle various types of input correctly", async () => {
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

  test("should lock on multiple 'get' calls", async () => {
    let calls: number = 0;
    const tst = () => Promise.resolve(++calls);

    const res: Array<number> = await Promise.all(
      [ 1, 2, 3 ].map(n => cache.get<number>("test", tst))
    );

    expect(JSON.stringify(res)).toBe("[1,1,1]");
    expect(calls).toBe(1);
  });

  ([
    [ "synchronous success", () => 1 ],
    [ "asynchronous success", () => Promise.resolve(1) ],
    [ "synchronous failure", () => { throw new Error("Test error!"); return 1; } ],
    [ "asynchronous failure", () => {
      return new Promise((res, rej) => {
        setTimeout(() => rej(new Error("Test error!")), 10);
      });
    }],
  ] as Array<[string, (() => Promise<number>) | (() => number)]>).map(testcase => {
    test(`should successfully unlock cache on ${testcase[0]}`, async () => {
      if (testcase[0].match(/success/)) {
        expect(await cache.get<number>("test", testcase[1])).toBe(1);
        expect(await cache.get<number>("test", testcase[1])).toBe(1);
      } else {
        try {
          await cache.get<number>("test", testcase[1]);
        } catch (e) {
          expect(e.message).toBe("Test error!");
        }
        try {
          await cache.get<number>("test", testcase[1]);
        } catch (e) {
          expect(e.message).toBe("Test error!");
        }
      }
    });
  });
});

describe("MockCache", () => {
  test("should correctly fulfill Cache dependencies (TS)", () => {
    const cache: Cache = new MockCache();
    expect(cache).toHaveProperty("clear");
  });

  test("should always return what's given", () => {
    const cache: Cache = new MockCache();
    expect(cache.get('one', () => Promise.resolve(1))).resolves.toBe(1);
    expect(cache.get('one', () => Promise.resolve(2))).resolves.toBe(2);
  });
});

