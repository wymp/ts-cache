Cache Library
==========================================================================================

**NOTE: This library is now hosted on github packages at
https://github.com/wymp/ts-cache. For the latest updates, please use the package
`@wymp/cache` and point npm to github package repo
([github guide](https://help.github.com/en/packages/using-github-packages-with-your-projects-ecosystem/configuring-npm-for-use-with-github-packages)).**

This is a very small library that implements a simple in-memory cache. It can be segmented (i.e.,
you can instantiate multiple independent caches with different settings), you can set global and
local TTLs, and you can set a max key count to prevent the cache from growing too large.

The interface is very basic:

* **To get and cache a value,** call `Cache::get` with a key, a function (optionally async) that
  returns the value you want to store, and an optional TTL for that key.
* **To get a value directly from the cache,** call `Cache::get` without the function or TTL and expect
  to handle `undefined` as a return type.
* **To clear a specific key from the cache,** call `Cache::clear(key)`.
* **To clear all keys from the cache,** call `Cache::clear()`.

## Examples

```ts
// Set up a new cache with a global TTL of 600 seconds and at most 10,000 keys
const cache = new Cache({ ttlSec: 600, maxLength: 10000 });

// Get a value from an API through the cache, but give it a shorter TTL
const val = await cache.get(
  "myRemoteVal",
  async () => {
    return await api.getResult();
  }, 
  30
);

// Use the result
if (val === 1) {
  console.log("Remote value is 1");
}

// Get it again for something else
const sameVal = cache.get("myRemoteVal");
if (typeof sameVal !== "undefined") {
  console.log(`Remote val was cached as ${sameVal}`);
}

// Oops! We know something changed that invalidated our cache. Bust it.
cache.clear("myRemoteVal");

// Oh no, lots of uncertainty, what's going on?? Let's just clear the whole cache to be safe....
cache.clear();
```


