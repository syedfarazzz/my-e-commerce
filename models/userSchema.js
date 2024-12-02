const mongoose = require("mongoose");
const Counter = require("./counterSchema");
// const validator = require("validator");
const ERRORS = require('../constants/errors')

const userSchema = new mongoose.Schema(
    {
        uuidUser: {
            type: String,
            unique: true,
        },
        email: {
            type: String,
            lowercase: true,
            unique: true,
            required: [true, ERRORS.INVALID.INVALID_EMAIL],
            // validate: [validator.isEmail, ERRORS.INVALID.INVALID_EMAIL],
        },
        password: {
            type: String,
            minlength: [8, ERRORS.INVALID.DESCRIPTION_LENGTH],
            // select: false,
        },
        role: {
            type: String,
            enum: ["admin", "customer"],
            lowercase: true,
            default: 'customer'
        },
        emailVerified: {
            type: Boolean,
            default: false,
        },
        otp: Number,
        resetPasswordOTP: Number,
        // firstName: String,
        // lastName: String,
        fullName: String,
        phone: Number,
        address: String,
        country: String,
        state: String,
        city: String,
        postalCode: String,
        profilePicture: {
            type: String,
            default: null,
        },
        likedProducts: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'products'
        },
        savedProducts: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'products'
        },
        viewedProducts: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'products'
        },
        productsBought: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'products'
        },
        myOrders: {
            type: [{ type: mongoose.Schema.Types.ObjectId }],
            ref: 'orders'
        }

    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true },
    }
);

// Pre-save middleware to generate user UUID
userSchema.pre("save", async function (next) {
    if (this.isNew) {
        try {
            const sequenceName = "user";

            // Generate the numeric sequence part of the UUID
            const counter = await Counter.findOneAndUpdate(
                { sequenceName },
                { $inc: { sequenceValue: 1 } },
                { new: true, upsert: true }
            );

            const sequenceValue = counter.sequenceValue.toString().padStart(5, "0");

            // Combine sequence value to create the UUID
            this.uuidUser = `USR-${sequenceValue}`;
        } catch (err) {
            return next(err);
        }
    }
    next();
});

const User = mongoose.model("users", userSchema);
module.exports = User;