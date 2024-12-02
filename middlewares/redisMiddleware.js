const { client } = require("../config/redisConnection");

const cacheMiddleware = (keyGenerator, duration) => {
  return async (req, res, next) => {
    try {
      console.log("Cache middleware triggered");

      // Generate the cache key, await if keyGenerator is async
      const cacheKey = await keyGenerator(req);
      console.log("Cache key generated:", cacheKey);

      // Check if data exists in cache
      const cachedData = await client.get(cacheKey);
      if (cachedData) {
        console.log("Serving from cache");
        return res.status(200).json(JSON.parse(cachedData));
      }
      console.log("Cache miss - fetching data from controller");

      // Store original res.json function
      const originalJson = res.json.bind(res);

      res.json = (data) => {
        if (res.statusCode === 200) {
          console.log("Setting cache with key:", cacheKey);
          client.setEx(cacheKey, duration, JSON.stringify(data)).catch((err) => {
            console.error("Error setting cache:", err);
          });
        }
        console.log("Sending response from controller");
        originalJson(data); // Send response to client
      };

      next(); // Proceed to controller if no cached data
    } catch (error) {
      console.error("Cache middleware error:", error);
      next(); // Continue without caching if an error occurs
    }
  };
};

module.exports = { cacheMiddleware };
