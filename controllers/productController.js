const mongoose = require("mongoose");
const Product = require("../models/productSchema");
const User = require("../models/userSchema");
const Category = require("../models/categorySchema");
// const { uploadCSV } = require("../middlewares/multer");
const xlsx = require("xlsx");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const { setLikeAndSaveStatus } = require('../utils/productUtills');
const { getPagination, buildPaginationObject } = require('../services/pagination');
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");

//@desc Add Product/Design
//@route POST /v1/products/add
//@access admin
exports.addProduct = async (req, res) => {
    try {
        const { title, description, categories, images, price, features, mockupImage, variants, discount } = req.body;

        if (title && description && categories && variants && price) {
            // Check if the product already exists
            const existingProduct = await Product.findOne({ title });
            if (existingProduct) {
                return res.status(STATUS_CODE.CONFLICT).json({ message: "Product with this title already exists." });
            }

            const product = await Product.create(
                {
                    title,
                    description,
                    categories,
                    images,
                    price,
                    features,
                    mockupImage,
                    variants,
                    discount
                }
            )
            if (product) {
                // Update product count in the category
                await Category.findByIdAndUpdate(categories,
                    {
                        $inc: { productCount: 1 },
                        $push: { associatedProducts: product._id }
                    }
                );
                return res.status(STATUS_CODE.OK).json({
                    message: SUCCESS_MSG.SUCCESS_MESSAGES.CREATED,
                    data: product
                });
            }
        }
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.REQUIRED.ALL_FIELDS_REQUIRED })
    }
    catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

// @desc Add products from CSV/Excel
// @route POST /v1/products/import
// @access admin
exports.addProductFromFile = async (req, res) => {
    try {
        // Check if a file is uploaded
        if (!req.file) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.REQUIRED.FILE_REQUIRED });
        }

        const { buffer, originalname } = req.file;
        const ext = path.extname(originalname).toLowerCase();
        let rows = [];

        // Parse the file
        if (ext === '.csv') {
            rows = await new Promise((resolve, reject) => {
                const results = [];
                const stream = require('stream');
                const readableStream = new stream.Readable();
                readableStream._read = () => {};
                readableStream.push(buffer);
                readableStream.push(null);
                readableStream
                    .pipe(csv())
                    .on('data', (data) => results.push(data))
                    .on('end', () => resolve(results))
                    .on('error', (error) => reject(error));
            });
        } else if (ext === '.xls' || ext === '.xlsx') {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rows = xlsx.utils.sheet_to_json(sheet);
        } else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: "Unsupported file type. Only CSV, XLS, and XLSX are allowed." });
        }

        // Process rows
        let products = [];
        let currentProduct = null;

        for (const row of rows) {
            const {
                title,
                description,
                categories, // This is the UUID format like CAT-S-00001
                images,
                price,
                mockupImage,
                discount,
                variantColor,
                variantSize,
                variantStock,
                variantImages,
            } = row;

            // Fetch the actual category _id from the database
            let categoryId = null;
            if (categories) {
                const category = await Category.findOne({ uuidCategory: categories }); // Assuming `uuid` is the field in the Category schema
                console.log(categories);
                
                if (!category) {
                    return res.status(STATUS_CODE.BAD_REQUEST).json({
                        message: `Category with UUID ${categories} not found.`,
                    });
                }
                categoryId = category._id;
            }

            // Handle main product row
            if (title) {
                if (currentProduct) {
                    products.push(currentProduct);
                }

                currentProduct = {
                    title,
                    description: description || "",
                    categories: categoryId, // Use the resolved MongoDB _id
                    images: images ? images.split(",") : [],
                    price: parseFloat(price) || 0,
                    mockupImage: mockupImage || "",
                    discount: parseFloat(discount) || 0,
                    variants: [],
                };
            }

            // Handle variant row
            if (variantColor || variantSize || variantStock || variantImages) {
                if (!currentProduct) {
                    return res.status(STATUS_CODE.BAD_REQUEST).json({ message: "Variant found without an associated product." });
                }

                let variant = currentProduct.variants.find(v => v.color === variantColor);

                if (!variant) {
                    variant = {
                        color: variantColor || 'Single',
                        images: variantImages ? variantImages.split(",") : [],
                        availableSizeStocks: [],
                    };

                    currentProduct.variants.push(variant);
                }

                variant.availableSizeStocks.push({
                    size: variantSize || 'Normal',
                    stock: parseInt(variantStock, 10) || 0,
                });
            }
        }

        if (currentProduct) {
            products.push(currentProduct);
        }

        // Save products to the database
        for (const productData of products) {
            const existingProduct = await Product.findOne({ title: productData.title });
            if (existingProduct) {
                continue; // Skip existing products
            }

            const newProduct = await Product.create(productData);

            if (newProduct && productData.categories) {
                await Category.findByIdAndUpdate(productData.categories, {
                    $inc: { productCount: 1 },
                    $push: { associatedProducts: newProduct._id },
                });
            }
        }

        return res.status(STATUS_CODE.OK).json({
            message: SUCCESS_MSG.SUCCESS_MESSAGES.UPLOADED,
            data: products.length,
        });
    } catch (error) {
        console.error("Error uploading products:", error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message,
        });
    }
};


//@desc Fetch All Products
//@route POST /v1/products/
//@access admin, customer
exports.fetchProducts = async (req, res) => {
    try {
        const { page, limit, startIndex, endIndex } = getPagination(req.query);

        let pagination;
        let products;
        let myQuery = {};
        const currentUser = req.user;

        switch (currentUser.role) {
            case ROLES.admin:
                myQuery = { ...req.body.filter };
                break;
            case ROLES.customer:
                myQuery = { enabled: true, ...req.body.filter };
                break;

            default:
                // Handle other roles or provide a default query
                myQuery = { enabled: true, ...req.body.filter }
                break;
        }

        // Handle the "search" key for dynamic search on multiple fields
        if (req.body.search) {
            const search = req.body.search.trim();  // The trim() method in JavaScript removes any leading (start) and trailing (end) whitespace characters from a string. This includes spaces, tabs, and newline characters. " my product " => "my product"
            const regex = new RegExp(search, 'i');  // Case-insensitive regex for partial match

            // Add search logic to check `uuidProduct` or `title`
            myQuery.$or = [
                { 'uuidProduct': { $regex: regex } },
                { 'title': { $regex: regex } },
            ];
        }
        

        // Count total records for pagination
        const totalRecords = await Product.countDocuments(myQuery).exec();
        pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

        // Fetch products based on query
        products = await Product.find(myQuery)
            .populate('categories')
            .populate('boughtBy', '-password -emailVerified -otp -resetPassword')
            .populate('likedBy', '-password -emailVerified -otp -resetPassword')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit)
            .lean()
            .exec();


        if (products.length > 0) {
            // Fetch the user's liked and saved products
            const user = await User.findById(currentUser._id).select('likedProducts savedProducts').exec();

            // Check if user liked or saved the product
            products = setLikeAndSaveStatus(products, user);

            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                data: products,
                pagination
            });
        }

        return res.status(STATUS_CODE.NOT_FOUND).json({
            message: ERRORS.INVALID.NOT_FOUND
        });


    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Fetch All Products
//@route POST /v1/products/public
//@access public
exports.fetchProductsPublic = async (req, res) => {
    try {
        const { page, limit, startIndex, endIndex } = getPagination(req.query);
        let pagination;
        let products;

        // Base query for enabled products
        let baseQuery = { enabled: true };

        // Combine filter and search logic
        if (req.body.filter) {
            baseQuery = { ...baseQuery, ...req.body.filter };
        }

        // Handle the "search" key to dynamically search by title or uuidProduct
        if (req.body.search) {
            const search = req.body.search.trim(); // Remove extra spaces
            const regex = new RegExp(search, 'i'); // Case-insensitive regex
            baseQuery.$or = [
                { 'title': { $regex: regex } },
                { 'uuidProduct': { $regex: regex } }
            ];
        }

        // Count total records for pagination
        const totalRecords = await Product.countDocuments(baseQuery).exec();
        pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

        // Fetch products based on the combined query
        products = await Product.find(baseQuery)
            .populate('categories')
            .populate('boughtBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
            .populate('likedBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit)
            .exec();

        // Return the products with pagination
        if (products.length > 0) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                data: products,
                pagination,
            });
        }

        // Handle no products found
        return res.status(STATUS_CODE.NOT_FOUND).json({
            message: ERRORS.INVALID.NOT_FOUND,
        });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message,
        });
    }
};


//@desc Fetch Product by Title from URL
//@route GET /v1/products/title/:title
//@access public
exports.fetchProductByTitle = async (req, res) => {
    try {
        // Extract the title from URL params
        if (req.params.title) {
            // Handle title from URL params (treating underscores as spaces)
            const formattedTitle = req.params.title.replace(/_/g, ' ');
            const titleFilterRegex = new RegExp(`^${formattedTitle}$`, 'i'); // 'i' flag for case-insensitive search and exact match

            const product = await Product.findOne({ enabled: true, title: titleFilterRegex })
                .populate('categories')
                .populate('boughtBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
                .populate('likedBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
                .exec();

            if (product) {
                return res.status(STATUS_CODE.OK).json({
                    message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                    data: product
                });
            } else {
                return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
            }
        } else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.FILTER_MISSING });
        }
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};

//@desc Fetch Single Product by Id
//@route GET /v1/products/:id
//@access public
exports.fetchProductById = async (req, res) => {
    try {
        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const product = await Product.findById(productId)
            .populate('categories')
            .populate('boughtBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
            .populate('likedBy', 'email role fullName phone country city profilePicture createdAt address state postalCode')
            .populate('ratedBy.user', 'email role fullName phone country city profilePicture createdAt address state postalCode')
            .exec();

        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        res.json({ message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE, product });
    } catch (error) {
        return res.status(STATUS_CODE.SERVER_ERROR).json({ message: error.message });
    }
};

//@desc Edit Product/Design
//@route PUT /v1/products/:id
//@access admin
exports.editProduct = async (req, res) => {
    try {
        const { title, description, categories, images, price, features, mockupImage, variants, discount } = req.body;
        const productId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        if (Object.keys(req.body).length == 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        const updatedProduct = await Product.findByIdAndUpdate(product._id,
            {
                title,
                description,
                categories,
                images,
                price,
                features,
                mockupImage,
                variants,
                discount
            },
            { new: true }
        )

        if (updatedProduct) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
                data: updatedProduct
            });
        }
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.UNABLE_TO_UPDATE });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Delete Product by Id
//@route DELETE /v1/products/:id
//@access admin
exports.deleteProduct = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const productId = req.params.id;

        // Check if productId is a valid ObjectId
        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        // Find product by Id
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        // Delete the product
        const deletedProduct = await Product.findByIdAndDelete(productId, { session });

        if (deletedProduct) {
            // Update the category's productCount
            await Category.findByIdAndUpdate(product.categories,
                { $inc: { productCount: -1 } },
                { new: true, session }
            );

            await session.commitTransaction();
            session.endSession();

            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.DELETE,
                data: deletedProduct
            });
        }

        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.UNABLE_TO_DELETE });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};

//@desc Like Product by Id
//@route PUT /v1/products/like/:id
//@access customer
exports.likeProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const currentUser = req.user

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        const isProductLiked = currentUser.likedProducts.includes(productId);

        //Condition For Dislike
        if (isProductLiked) {
            const updateUser = await User.findByIdAndUpdate(currentUser._id, { $pull: { likedProducts: productId } }, { new: true });
            // Decrement the likes field of the product by 1
            const updatedProduct = await Product.findByIdAndUpdate(productId,
                {
                    $inc: { likes: -1 },
                    $pull: { likedBy: currentUser._id }
                },
                { new: true }
            );
            return res.status(STATUS_CODE.OK).json({ message: 'Succefully disliked the product', data: updateUser });
        }

        //Condition For Like
        const updateUser = await User.findByIdAndUpdate(currentUser._id, { $push: { likedProducts: productId } }, { new: true });
        // Increment the likes field of the product by 1
        const updatedProduct = await Product.findByIdAndUpdate(productId,
            {
                $inc: { likes: 1 },
                $push: { likedBy: currentUser._id }
            },
            { new: true });

        return res.status(STATUS_CODE.OK).json({
            message: "Succefully liked the product",
            data: updateUser
        });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Save Product by Id
//@route PUT /v1/products/save/:id
//@access customer
exports.saveProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const currentUser = req.user

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        const isProductSaved = currentUser.savedProducts.includes(productId);

        //Condition For Unsave
        if (isProductSaved) {
            const updateUser = await User.findByIdAndUpdate(currentUser._id, { $pull: { savedProducts: productId } }, { new: true });
            // Decrement the saved field of the product by 1
            const updatedProduct = await Product.findByIdAndUpdate(productId, { $inc: { saved: -1 } }, { new: true });
            return res.status(STATUS_CODE.OK).json({ message: 'Succefully unsaved the product' });
        }

        //Condition For Save
        const updateUser = await User.findByIdAndUpdate(currentUser._id, { $push: { savedProducts: productId } }, { new: true });
        // Increment the saved field of the product by 1
        const updatedProduct = await Product.findByIdAndUpdate(productId, { $inc: { saved: 1 } }, { new: true });

        return res.status(STATUS_CODE.OK).json({ message: "Succefully saved the product" });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Save Product by Id
//@route PUT /v1/products/save/:id
//@access customer
exports.viewProduct = async (req, res) => {
    try {
        const productId = req.params.id
        const currentUser = req.user

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const product = await Product.findById(productId)
        if (!product) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        const isProductViewed = currentUser.viewedProducts.includes(productId);

        //Condition For Already Viewed
        if (isProductViewed) {
            return res.status(STATUS_CODE.OK).json({ message: 'Product already viewed' });
        }

        //Condition For View
        const updateUser = await User.findByIdAndUpdate(currentUser._id, { $push: { viewedProducts: productId } }, { new: true });
        // Increment the views field of the product by 1
        const updatedProduct = await Product.findByIdAndUpdate(productId, { $inc: { views: 1 } }, { new: true });

        return res.status(STATUS_CODE.OK).json({ message: "Product Viewed" });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Ratings
//@route POST /v1/products/ratings/:id
//@access customer
exports.rateProduct = async (req, res) => {
    const session = await Product.startSession();
    session.startTransaction();

    try {
        const productId = req.params.id;
        const { rating, feedback } = req.body;
        const currentUser = req.user;

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Rating must be between 1 and 5' });
        }

        const product = await Product.findById(productId).session(session);
        if (!product) {
            await session.abortTransaction();
            session.endSession();
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        if (Object.keys(req.body).length == 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Enter Ratings' });
        }

        // Check if the user already rated the product
        const isProductRated = product.ratedBy.some(rating => rating.user.toString() === currentUser._id.toString());
        if (isProductRated) {
            await session.abortTransaction();
            session.endSession();
            return res.status(STATUS_CODE.OK).json({ message: 'You have already rated this product' });
        }

        const totalRatedBy = product.ratedBy.length; // Existing number of ratings
        const newAverageRating = (product.averageRatings * totalRatedBy + rating) / (totalRatedBy + 1);

        const updatedProduct = await Product.findByIdAndUpdate(
            productId,
            {
                $push: {
                    ratedBy: { user: currentUser._id, rating, feedback }
                },
                $inc: { totalRatings: rating }, // Increment total ratings
                $set: { averageRatings: newAverageRating } // Set the new average rating
            },
            { new: true, session } // Pass the session to ensure this operation is part of the transaction
        );

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        if (updatedProduct) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
                data: updatedProduct
            });
        }
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.UNABLE_TO_UPDATE });

    } catch (error) {
        await session.abortTransaction(); // Abort the transaction in case of an error
        session.endSession();
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};

/*
//@desc Fetch Top Products
//@route GET /v1/topdiscounts
//@access public
exports.topProducts = async (req, res) => {
    try {
        const topDiscount = await Product.find({
            enabled: true,
            discount: { $gt: 0 }  // Ensure there is a discount
        })
            .sort({ discount: -1 })  // Sort by discount in descending order
            .limit(8);  // Limit to top 8 discounted products

        const bestSelling = await Product.find({
            enabled: true,
            soldCount: { $gt: 0 }  // Only fetch products with soldCount greater than 0
        })
            .sort({ soldCount: -1 })  // Sort by soldCount in descending order
            .limit(8);  // Limit to top 8 best-selling products

        // Top Rated Products (sorted by averageRatings)
        const topRatedProducts = await Product.find({
            enabled: true,
            totalRatings: { $gt: 0 }
        })
            .sort({ averageRatings: -1 })
            .limit(8);  // Limit to top 8 rated products

        // Top Favourites Products (sorted by saved count)
        const topFavouriteProducts = await Product.find({
            enabled: true,
            saved: { $gt: 0 }
        })
            .sort({ saved: -1 })
            .limit(8);  // Limit to top 8 favourite products

        // Check if no products were found
        if (!topDiscount.length && !bestSelling.length && !topRatedProducts.length && !topFavouriteProducts.length) {
            return res.status(404).json({
                success: false,
                message: "No products found."
            });
        }

        res.status(STATUS_CODE.OK).json({
            success: true,
            topDiscountedProducts: topDiscount,
            bestSellingProducts: bestSelling,
            topRatedProducts: topRatedProducts,
            topFavouriteProducts: topFavouriteProducts
        });
    } catch (error) {
        console.error("Error fetching top products:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch top products",
            error: error.message,
        });
    }
};
*/

//@desc Fetch Top Products
//@route POST /v1/topdiscounts
//@access public
exports.topProducts = async (req, res) => {
    try {
        const currentUser = req.body.user;
        let user = null;

        if (currentUser) {
            user = await User.findById(currentUser).select('likedProducts savedProducts').exec();
        }

        const topDiscount = await Product.find({
            enabled: true,
            discount: { $gt: 0 }
        })
            .sort({ discount: -1 })
            .limit(8)
            .lean(); // Use `.lean()` for faster read operations

        const bestSelling = await Product.find({
            enabled: true,
            soldCount: { $gt: 0 }
        })
            .sort({ soldCount: -1 })
            .limit(8)
            .lean();

        const topRatedProducts = await Product.find({
            enabled: true,
            totalRatings: { $gt: 0 }
        })
            .sort({ averageRatings: -1 })
            .limit(8)
            .lean();

        const topFavouriteProducts = await Product.find({
            enabled: true,
            saved: { $gt: 0 }
        })
            .sort({ saved: -1 })
            .limit(8)
            .lean();


        // Apply `isLiked` and `isSaved` for each product list
        const topDiscountedProducts = setLikeAndSaveStatus(topDiscount, user);
        const bestSellingProducts = setLikeAndSaveStatus(bestSelling, user);
        const topRatedProductsWithStatus = setLikeAndSaveStatus(topRatedProducts, user);
        const topFavouriteProductsWithStatus = setLikeAndSaveStatus(topFavouriteProducts, user);

        // Check if no products were found
        if (!topDiscountedProducts.length && !bestSellingProducts.length && !topRatedProductsWithStatus.length && !topFavouriteProductsWithStatus.length) {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                success: false,
                message: "No products found."
            });
        }

        res.status(STATUS_CODE.OK).json({
            success: true,
            topDiscountedProducts,
            bestSellingProducts,
            topRatedProducts: topRatedProductsWithStatus,
            topFavouriteProducts: topFavouriteProductsWithStatus
        });
    } catch (error) {
        console.error("Error fetching top products:", error);
        res.status(STATUS_CODE.SERVER_ERROR).json({
            success: false,
            message: "Failed to fetch top products",
            error: error.message,
        });
    }
};






