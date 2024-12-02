const mongoose = require("mongoose");
const Category = require("../models/categorySchema");
const Product = require("../models/productSchema");
const { cacheInvalidation } = require('../utils/cacheInavlidation');
const { getPagination, buildPaginationObject } = require('../services/pagination');

const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");

//@desc Add Category
//@route POST /v1/categories/add
//@access admin
exports.addCategory = async (req, res) => {
    try {
        const { tag, categoryImage } = req.body;

        if (tag) {
            const category = await Category.create({ tag, categoryImage });

            if (category) {

                // Invalidate cache after adding a category
                // await cacheInvalidation(null, category._id);

                return res.status(STATUS_CODE.OK).json({
                    message: SUCCESS_MSG.SUCCESS_MESSAGES.CREATED,
                    data: category
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

//@desc Fetch All Categories
//@route POST /v1/categories/
//@access customer, admin
exports.fetchCategories = async (req, res) => {
    try {
        const { page, limit, startIndex, endIndex } = getPagination(req.query);
        let pagination;
        let categories;
        const currentUser = req.user;

        let myQuery = {};
        let selectFields;

        // Destructure filter fields
        const { productCount, associatedProducts } = req.body.filter || {};

        // Role-based query customization
        switch (currentUser.role) {
            case ROLES.admin:
                myQuery = { ...req.body.filter };
                selectFields = '-__v';
                break;
            case ROLES.customer:
                myQuery.isActive = true;
                if (productCount) myQuery.productCount = productCount;
                if (associatedProducts) myQuery.associatedProducts = associatedProducts;
                selectFields = '-__v -isActive';
                break;
            default:
                myQuery.isActive = true;
                if (productCount) myQuery.productCount = productCount;
                if (associatedProducts) myQuery.associatedProducts = associatedProducts;
                selectFields = '-__v -isActive';
                break;
        }

        // Unified search functionality for tag and uuidCategory
        if (req.body.search) {
            const search = req.body.search.trim(); // Remove extra spaces
            const regex = new RegExp(search, 'i'); // Case-insensitive regex
            myQuery.$or = [
                { 'tag': { $regex: regex } },
                { 'uuidCategory': { $regex: regex } }
            ];
        }

        // Count total records for pagination
        const totalRecords = await Category.countDocuments(myQuery).exec();
        pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

        // Fetch categories based on the query
        categories = await Category.find(myQuery)
            .select(selectFields)
            .populate('associatedProducts', 'title description price discount ratedBy ratings averageRatings features mockupImage variants')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit)
            .exec();

        // Handle response based on the fetched data
        if (categories && categories.length > 0) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                data: categories,
                pagination
            });
        } else {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                message: ERRORS.INVALID.NO_RECORDS_FOUND
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};

//@desc Fetch All Categories
//@route POST /v1/categories/public
//@access public
exports.fetchPublicCategories = async (req, res) => {
    try {
        const { page, limit, startIndex, endIndex } = getPagination(req.query);
        const { productCount, associatedProducts } = req.body.filter || {};
        let myQuery = { isActive: true }; // Base query for active categories

        // Handle filters if present in the request body
        if (req.body.filter) {
            myQuery.isActive = true;
            // if (tag) myQuery.tag = tag;
            if (productCount) myQuery.productCount = productCount;
            if (associatedProducts) myQuery.associatedProducts = associatedProducts;
        }

        // Unified search for tag and uuidCategory
        if (req.body.search) {
            const search = req.body.search.trim(); // Remove extra spaces
            const regex = new RegExp(search, 'i'); // Case-insensitive regex
            myQuery.$or = [
                { tag: { $regex: regex } },
                { uuidCategory: { $regex: regex } }
            ];
        }

        const totalRecords = await Category.countDocuments(myQuery).exec();
        const pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

        // Fetch categories based on the same query logic
        const categories = await Category.find(myQuery)
            .select('-isActive -__v')
            .populate('associatedProducts', 'title description price discount ratedBy ratings averageRatings features mockupImage variants')
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit)
            .exec();

        if (categories && categories.length > 0) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                data: categories,
                pagination
            });
        } else {
            return res.status(STATUS_CODE.NOT_FOUND).json({
                message: ERRORS.INVALID.NO_RECORDS_FOUND
            });
        }

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Fetch Single Category by Id
//@route GET /v1/categories/:id
//@access public
exports.fetchCategoryById = async (req, res) => {
    try {
        const categoryId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const category = await Category.findById(categoryId)
            .populate('associatedProducts', 'title description price discount ratedBy ratings averageRatings features mockupImage variants')
            .exec();

        if (!category) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        res.json({ message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE, category });
    } catch (error) {
        return res.status(STATUS_CODE.SERVER_ERROR).json({ message: error.message });
    }
};

//@desc Edit Category
//@route PUT /v1/categories/:id
//@access admin
exports.editCategory = async (req, res) => {
    try {
        const { tag, categoryImage } = req.body;
        const categoryId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }
        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        if (Object.keys(req.body).length == 0) {
            return res.status(400).json({ message: 'No fields to update' });
        }
        const updatedCategory = await Category.findByIdAndUpdate(category._id,
            {
                tag,
                categoryImage
            },
            { new: true }
        )

        if (updatedCategory) {
            // Invalidate cache after adding a category
            // await cacheInvalidation(null, category._id);

            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
                data: updatedCategory
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

//@desc Delete Category by Id
//@route DELETE /v1/categories/:id
//@access admin
exports.deleteCategory = async (req, res) => {
    try {
        const categoryId = req.params.id

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const category = await Category.findById(categoryId)
        if (!category) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        const deletedCategory = await Category.findByIdAndDelete(categoryId);

        // Delete associated products if any
        if (category.associatedProducts.length > 0) {
            await Product.deleteMany({ _id: { $in: category.associatedProducts } });
        }

        if (deletedCategory) {
            // Invalidate cache after editing a category
            // await cacheInvalidation(null, categoryId);
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.DELETE,
                data: deletedCategory
            });
        }
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.UNABLE_TO_DELETE });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        })
    }
};

//@desc Disable Category by Id
//@route PUT /v1/categories/:id
//@access admin
exports.disableCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(categoryId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const category = await Category.findById(categoryId)
        if (!category) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        const updatedCategory = await Category.findOneAndUpdate(
            { _id: categoryId },
            { isActive: !category.isActive },
            { new: true }
        );

        await Product.updateMany(
            { _id: { $in: category.associatedProducts } },
            { enabled: updatedCategory.isActive },
            { new: true }
        );

        if (updatedCategory) {
            // Invalidate cache after editing a category
            // await cacheInvalidation(null, categoryId);

            return res.status(200).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
                data: updatedCategory
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};
