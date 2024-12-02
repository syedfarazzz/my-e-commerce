const { client } = require("../config/redisConnection");

/* =================================== For Users ======================================= */

// Generate cache key for fetching users (with optional query and filter)
const generateFetchUsersKey = async (req) => {
  const version = await client.get('fetchUsersCacheVersion') || '1';
  const queryPart = req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
  const filterPart = req.body.filter ? JSON.stringify(req.body.filter) : '';
  return `users:v${version}:${queryPart}:${filterPart}`;
};

// Generate cache key for fetching a specific user by ID
const generateFetchUserByIdKey = (req) => `user:${req.params.id}`;

// Generate cache key for the current user (based on authenticated user's ID)
const generateCurrentUserKey = (req) => `user:${req.user._id}`;

/* =================================== For Categories ======================================= */

// Cache key generator for fetching all categories
const generateFetchCategoriesKey = async (req) => {
  const version = await client.get('fetchCategoriesCacheVersion') || '1';
  const queryPart = req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
  const filterPart = req.body.filter ? JSON.stringify(req.body.filter) : '';
  const searchQueryPart = req.body.query ? JSON.stringify(req.body.query) : '';
  return `categories:v${version}:${queryPart}:${filterPart}:${searchQueryPart}`;
};

// Cache key generator for fetching public categories
const generateFetchPublicCategoriesKey = async (req) => {
  const version = await client.get('fetchPublicCategoriesCacheVersion') || '1';
  const queryPart = req.query && Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
  const filterPart = req.body.filter ? JSON.stringify(req.body.filter) : '';
  const searchQueryPart = req.body.query ? JSON.stringify(req.body.query) : '';
  return `publicCategories:v${version}:${queryPart}:${filterPart}:${searchQueryPart}`;
};

// Cache key generator for fetching a specific category by ID
const generateFetchCategoryByIdKey = (req) => `category:${req.params.id}`;

module.exports = {
  generateFetchUsersKey,
  generateCurrentUserKey,
  generateFetchUserByIdKey,
  generateFetchCategoriesKey,
  generateFetchPublicCategoriesKey,
  generateFetchCategoryByIdKey
};
