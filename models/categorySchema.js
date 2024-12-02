const mongoose = require("mongoose");
const Counter = require("./counterSchema");

const categorySchema = new mongoose.Schema(
    {
        uuidCategory: {
            type: String,
            unique: true
        },
        tag: {
            type: String,
            required: [true, "Category name is required"]
        },
        isActive: {
            type: Boolean,
            default: true
        },
        categoryImage: {
            type: String,
            required: true
        },
        productCount: {
            type: Number,
            default: 0
        },
        associatedProducts: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'products'
        }
    },
    {
        timestamps: true
    }
);

// Pre-save middleware to generate a unique identifier for categories
categorySchema.pre("save", async function (next) {
    if (this.isNew) {
        try {
            const sequenceName = "category";

            // Generate the numeric sequence part of the UUID
            const counter = await Counter.findOneAndUpdate(
                { sequenceName },
                { $inc: { sequenceValue: 1 } },
                { new: true, upsert: true }
            );

            const sequenceValue = counter.sequenceValue.toString().padStart(5, "0");

            // Generate the initials from the category tag
            const tagInitials = this.tag
                .split(' ')                // Split tag into words
                .map(word => word[0])     // Take the first character of each word
                .join('')                 // Join them together
                .toUpperCase()            // Convert to uppercase
                .slice(0, 3);             // Limit to 3 characters

            // Combine to create the UUID for associated products
            this.uuidCategory = `CAT-${tagInitials}-${sequenceValue}`;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

const Category = mongoose.model("categories", categorySchema);
module.exports = Category;