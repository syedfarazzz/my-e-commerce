// utils/cacheInvalidation.js
const { client } = require("../config/redisConnection");

const cacheInvalidation = async (userId, categoryId) => {
    try {
        console.log("Cache invalidation utils");

        // Clear cache for specific user
        if (userId) {
            await client.del(`user:${userId}`);
            await client.incr('fetchUsersCacheVersion');
            console.log(`Invalidated cache for user ${userId}`);
        }

        // Clear cache for specific category
        if (categoryId) {
            await client.del(`category:${categoryId}`);
            await client.incr('fetchCategoriesCacheVersion');
            await client.incr('fetchPublicCategoriesCacheVersion');
            console.log(`Invalidated cache for category ${categoryId}`);
        }
    } catch (error) {
        console.error('Cache invalidation error:', error);
    }
};

module.exports = { cacheInvalidation };
