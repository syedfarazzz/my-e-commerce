const mongoose = require("mongoose");
const Counter = require("./counterSchema");
const ERRORS = require('../constants/errors')

const validateImagesLength = function (images) {
    return images.length <= 4;
};
// const validateCategories = function(arr) {
//     return arr && arr.length > 0;
// }

const productSchema = new mongoose.Schema(
    {
        uuidProduct: {
            type: String,
            unique: true,
        },
        title: {
            type: String,
            unique: true,
            required: [true, ERRORS.REQUIRED.TITLE_REQUIRED],
        },
        description: {
            type: String,
            minlength: [15, ERRORS.INVALID.DESCRIPTION_LENGTH]
        },
        price: {
            type: Number,
            required: [true, ERRORS.REQUIRED.PRICE_REQUIRED],
        },
        discount: {
            type: Number,
            default: 0
        },
        likes: {
            type: Number,
            default: 0
        },
        views: {
            type: Number,
            default: 0
        },
        saved: {
            type: Number,
            default: 0
        },
        isLiked: {
            type: Boolean,
            default: false
        },
        isSaved: {
            type: Boolean,
            default: false
        },
        categories: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, "Select atleast one category"],
            ref: 'categories'
        },
        images: {
            type: [String],
            validate: [validateImagesLength, "No more than 4 images allowed"]
        },
        boughtBy: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'users'
        },
        likedBy: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'users'
        },
        ratedBy: {
            type: [{
                user: { type: mongoose.Schema.Types.ObjectId, ref: 'users' },
                rating: { type: Number, min: 1, max: 5 },
                feedback: { type: String },
                createdAt: { type: Date, default: Date.now() }
            }],
            default: []
        },
        ratings: {
            type: [Number],
            min: 1,
            max: 5
        },
        totalRatings: {
            type: Number,
            default: 0
        },
        averageRatings: {
            type: Number,
            default: 0
        },
        // ratedBy: {
        //     type: [{ type: mongoose.Schema.Types.ObjectId }],
        //     ref: 'users',
        //     default: []
        // },
        features: {
            type: [String],
            // default: []
        },
        enabled: {
            type: Boolean,
            default: true
        },
        mockupImage: {
            type: String,
            required: true
        },

        // A flexible field for variant-specific data like sizes, volumes, etc.
        variants: [{
            color: { type: String, required: true, default: 'Single' }, // e.g., "Black", "Red"
            images: [{ type: String }], // Image specific to the color
            availableSizeStocks: [{
                size: { type: String, required: true, default: 'Normal' }, // e.g., "S", "L"
                stock: { type: Number, required: true, default: 0 } // Stock count for that size
            }]
        }],
        soldCount: {
            type: Number,
            default: 0
        }
    },
    {
        timestamps: true
    }
);

productSchema.pre("save", async function (next) {
    if (this.isNew) {
        try {
            const sequenceName = "product";

            // Generate the numeric sequence part of the UUID
            const counter = await Counter.findOneAndUpdate(
                { sequenceName },
                { $inc: { sequenceValue: 1 } },
                { new: true, upsert: true }
            );

            const sequenceValue = counter.sequenceValue.toString().padStart(5, "0");

            // Generate the initials from the product title
            const titleInitials = this.title
                .split(' ')               // Split title into words
                .map(word => word[0])    // Take the first character of each word
                .join('')                // Join them together
                .toUpperCase()           // Convert to uppercase
                .slice(0, 3);            // Limit to 3 characters

                console.log(titleInitials);
                

            // Combine to create the UUID
            this.uuidProduct = `PROD-${titleInitials}-${sequenceValue}`;
            console.log("Generated UUID:", this.uuidProduct);

        } catch (err) {
            return next(err);
        }
    }
    next();
});


const Product = mongoose.model("products", productSchema);
module.exports = Product;