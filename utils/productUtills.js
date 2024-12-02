/**
 * Adds `isLiked` and `isSaved` fields to each product based on user preferences.
 * @param {Array} products - Array of products to be updated.
 * @param {Object} user - The user document containing likedProducts and savedProducts.
 * @returns {Array} - Array of products with `isLiked` and `isSaved` fields.
 */
const setLikeAndSaveStatus = (products, user) => {
    const userLikedProducts = user?.likedProducts.map(id => id.toString()) || [];
    const userSavedProducts = user?.savedProducts.map(id => id.toString()) || [];

    return products.map(product => ({
        ...product,
        isLiked: userLikedProducts.includes(product._id.toString()),
        isSaved: userSavedProducts.includes(product._id.toString())
    }));
};

module.exports = { setLikeAndSaveStatus };
