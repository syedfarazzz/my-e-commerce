const mongoose = require("mongoose");
const Counter = require("./counterSchema");
const ERRORS = require('../constants/errors')

const orderSchema = new mongoose.Schema(
    {
        customer: {
            type: mongoose.Schema.Types.ObjectId,
            required: [true, ERRORS.REQUIRED.USER_REQUIRED],
            ref: 'users',
        },
        email: {
            type: String,
        },
        uuidOrder: {
            type: String,
            unique: true, // Ensure uniqueness of the order ID
            // required: true,
        },
        products: [
            {
                productId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'products',
                    required: [true, ERRORS.REQUIRED.PRODUCT_ID_REQUIRED],
                },
                productTitle: {
                    type: String, // To keep the product title at the time of purchase
                    required: true,
                },
                originalPrice: {
                    type: Number, // Price of the product at the time of purchase
                    required: [true, ERRORS.REQUIRED.PRICE_REQUIRED],
                },
                discountedPrice: {
                    type: Number,
                    // required: [true, ERRORS.REQUIRED.PRICE_REQUIRED],
                },
                quantity: {
                    type: Number,
                    required: [true, ERRORS.REQUIRED.QUANTITY_REQUIRED],
                    min: [1, ERRORS.REQUIRED.QUANTITY_REQUIRED],
                },
                size: {
                    type: String, // The size variant chosen (if applicable)
                },
                color: {
                    type: String, // The color variant chosen (if applicable)
                }
            }
        ],
        totalItems: {
            type: Number,
            required: [true, ERRORS.REQUIRED.QUANTITY_REQUIRED],
            min: [1, ERRORS.REQUIRED.QUANTITY_REQUIRED],
        },
        status: {
            type: String,
            enum: ["Processing", "Completed", "Cancelled"],
            default: "Processing",
        },
        paymentStatus: {
            type: String,
            default: "Un-Paid"
        },
        totalAmount: {
            type: Number,
            required: [true, ERRORS.REQUIRED.PRICE_REQUIRED],
        },
        transactionId: {
            type: String,
            // required: [true, "transaction Id is required"],
        },
        shippingAddress: {
            fullName: String,
            phone: String,
            country: String,
            addressLine1: String,
            addressLine2: String,
            city: String,
            postalCode: String,
            state: String,
        },
        isDelivered: {
            type: Boolean,
            default: false,
        }
    },
    {
        timestamps: true
    }
);

// Pre-save middleware for generating orderId
orderSchema.pre("save", async function (next) {
    if (this.isNew) {
        try {
            const year = new Date().getFullYear();
            const sequenceName = `order-${year}`;
            
            const counter = await Counter.findOneAndUpdate(
                { sequenceName },
                { $inc: { sequenceValue: 1 } },
                { new: true, upsert: true }
            );
            
            if (!counter || !counter.sequenceValue) {
                throw new Error("Failed to generate a unique order sequence.");
            }
            
            const sequenceValue = counter.sequenceValue.toString().padStart(5, "0");
            this.uuidOrder = `ORD-${year}-${sequenceValue}`;
        } catch (err) {
            return next(err);
        }
    }

    if (!this.uuidOrder) {
        return next(new Error("uuidOrder is required but could not be generated."));
    }
    next();
});


const Order = mongoose.model("orders", orderSchema);
module.exports = Order;