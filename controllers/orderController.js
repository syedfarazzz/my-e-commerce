const mongoose = require("mongoose");
const Order = require("../models/orderSchema");
const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const bcrypt = require("bcrypt");
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");
const { generateOTP, sendCreds } = require("../services/emailService");
const { getPagination, buildPaginationObject } = require('../services/pagination');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); // Initialize Stripe

//@desc Add Order
//@route POST /v1/orders/add
//@access public
exports.addOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { email, customer, fullName, totalItems, products, shippingAddress } = req.body;
        const { phone } = req.body.shippingAddress
        console.log(email, customer, fullName, totalItems, products, shippingAddress);

        // 1. Handle User
        const user = await handleUser({ email, customer, fullName, phone, session });

        // 2. Validate Stocks and Variants & Deduct Stock
        // const { validatedProducts, calculatedTotalAmount } = await validateStocksAndCalculateTotal({ products, session });

        const { validatedProducts, calculatedTotalAmount } = await updateStock({
            products,
            session,
            mode: 'deduct'
        });

        // 3. Create the order without transactionId (payment step hasn't been done yet)
        const order = await createOrder({
            user,
            validatedProducts,
            calculatedTotalAmount,
            totalItems,
            shippingAddress,
            session
        });

        // 4. Update User with the finalized order
        await updateUserWithOrder(user, order, session);

        /*
        // Process For Seperate Session URL on Stripe Page
        // 5. Create Stripe Checkout session (Payment process)
        const stripeSession = await stripe.checkout.sessions.create({
            ui_mode: 'embedded',
            payment_method_types: ['card'],
            line_items: validatedProducts.map(product => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.productTitle,
                    },
                    unit_amount: product.discountedPrice * 100 || product.originalPrice * 100, // Price in cents
                },
                quantity: product.quantity,
            })),
            mode: 'payment',
            customer_email: user.email,
            return_url: `${process.env.FRONT_END}/return?session_id={CHECKOUT_SESSION_ID}`,
            expires_at: Math.floor(Date.now() / 1000) + 1800, // Set to expire 30 minutes from now
            metadata: {
                orderId: order._id.toString(), // Store the order ID in metadata
                userId: user._id.toString() // Optional: Store the user ID as well
            },
            shipping_address_collection: {
                allowed_countries: ['US', 'CA'], // List of allowed countries for shipping
            }
        });
        /*

        /*
        // Process For Session on Website (UI-Embedded)
        // 5. Create Stripe Checkout session (Payment process)
        const stripeSession = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: validatedProducts.map(product => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: product.productTitle,
                    },
                    unit_amount: product.discountedPrice * 100 || product.originalPrice * 100, // Price in cents
                },
                quantity: product.quantity,
            })),
            mode: 'payment',
            customer_email: user.email,
            success_url: `${process.env.DOMAIN_DEV}/v1/orders/complete?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.DOMAIN_DEV}/v1/orders/cancel?session_id={CHECKOUT_SESSION_ID}`,
            expires_at: Math.floor(Date.now() / 1000) + 1800, // Set to expire 30 minutes from now
            metadata: {
                orderId: order._id.toString(), // Store the order ID in metadata
                userId: user._id.toString() // Optional: Store the user ID as well
            }
        });
        */

        // Process For Payment Intents (Supported by both Web and App)
        // 5. Create Payment Intent for both web and mobile
        const paymentIntent = await stripe.paymentIntents.create({
            amount: calculatedTotalAmount * 100, // Amount in cents
            currency: 'usd',
            payment_method_types: ['card'],
            metadata: {
                orderId: order._id.toString(),
                userId: user._id.toString()
            },
            receipt_email: user.email
        });

        await session.commitTransaction(); // Commit the transaction if everything is successful
        session.endSession();

        // res.redirect(stripeSession.url);
        return res.status(201).json({
            message: "Session created successfully",
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id
            // clientSecret: stripeSession.client_secret,
        });

    } catch (error) {
        await session.abortTransaction();
        session.endSession();

        console.log(error);
        return res.status(400).json({ message: error.message });
    }
};

exports.stripeWebhookPaymentIntent = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // const endpointSecret = 'whsec_VUBnI8bL8HxJcwJ0KTdqkXRCses9n6ix';
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        console.error("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const paymentIntent = event.data.object; // PaymentIntent object
        const orderId = paymentIntent.metadata.orderId; // Retrieve order ID from metadata

        if (event.type === 'payment_intent.canceled') {
            console.log("Processing payment_intent.canceled for Order ID:", orderId);

            // 1. Find the order and ensure it exists
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                throw new Error("Order not found.");
            }

            // 2. Early return if the order is already cancelled
            if (order.status === "Cancelled") {
                console.log("Order is already cancelled, skipping cancellation process.");
                await session.commitTransaction();
                return res.status(200).json({ message: "Order was already cancelled, no further action needed." });
            }

            // 3. Revert stock changes for each product in the order
            await updateStock({
                products: order.products,
                session,
                mode: 'revert'
            });

            // 4. Update the order status to "Cancelled"
            order.status = "Cancelled";
            order.paymentStatus = "Un-Paid"
            await order.save({ session });
        } else if (event.type === 'payment_intent.succeeded') {
            console.log("Processing payment_intent.succeeded for Order ID:", orderId);

            // Extract transaction-related info
            const transactionId = paymentIntent.id;
            const paymentStatus = 'Paid';

            // Retrieve the payment method details for card information
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
            const cardDetails = paymentMethod.card ? {
                cardBrand: paymentMethod.card.brand,
                cardLast4: paymentMethod.card.last4,
                cardExpMonth: paymentMethod.card.exp_month,
                cardExpYear: paymentMethod.card.exp_year
            } : null;

            // Update the order with transaction ID, payment status, and shipping address
            await Order.findByIdAndUpdate(orderId, {
                transactionId,
                paymentStatus
            }, { new: true, session });
        }

        await session.commitTransaction();
        res.status(200).json({ received: true });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error processing webhook:", error.message);
        res.status(500).json({ message: "Server error.", error: error.message });
    } finally {
        session.endSession();
    }
};

exports.cancelIntent = async (req, res) => {
    const { paymentIntentId } = req.body;
    try {
        const cancelledPaymentIntent = await stripe.paymentIntents.cancel(paymentIntentId);

        if (cancelledPaymentIntent.status == "canceled") {
            return res.status(200).json({ message: 'Payment has been cancelled successfully' });
        }
        return res.status(400).json({ message: 'Payment has not been cancelled, try again' });

    } catch (error) {
        console.error('Failed to cancel payment:', error);
        return res.status(400).json({ error: 'Failed to cancel payment' });
    }
}

const handleUser = async ({ email, customer, fullName, phone, session }) => {
    let user;

    if (customer) {
        user = await User.findById(customer).session(session);
    } else {
        user = await User.findOne({ email }).session(session);

        if (!user) {
            const password = String(generateOTP());
            const hashedPassword = await bcrypt.hash(password, 10);

            user = new User({
                email,
                email_verified: true,
                password: hashedPassword,
                role: "customer",
                fullName,
                // address,
                // city,
                // state,
                // postalCode,
                // country,
                phone
            });

            await user.save({ session });
            await sendCreds(email, password);
        }
    }

    return user;
};

const updateStock = async ({ products, session, mode }) => {
    const validatedProducts = [];
    let totalAmount = 0;
    const modifiedProducts = []; // Array to collect modified products

    for (const item of products) {
        const { productId, quantity, size, color } = item;
        const product = await Product.findById(productId).session(session);

        if (!product) {
            throw new Error(`Product with ID ${productId} not found.`);
        }

        const variant = product.variants.find(v => v.color === color);
        if (!variant) {
            throw new Error(`Variant not found for color ${color}.`);
        }

        const sizeStock = variant.availableSizeStocks.find(s => s.size === size);
        if (!sizeStock) {
            throw new Error(`Size not found for size ${size}.`);
        }

        if (mode === 'deduct') {
            if (sizeStock.stock < quantity) {
                throw new Error(`Insufficient stock for size ${size} and color ${color}.`);
            }
            sizeStock.stock -= quantity;

            // Calculate and accumulate total amount for deduction
            const discount = product.discount || 0;
            const discountedPrice = product.price * (1 - discount / 100);
            totalAmount += discountedPrice * quantity;

            validatedProducts.push({
                productId: product._id,
                productTitle: product.title,
                originalPrice: product.price,
                discountedPrice,
                discount,
                quantity,
                size,
                color
            });
        } else if (mode === 'revert') {
            sizeStock.stock += quantity;
        }

        // Add modified product to array for batch save
        modifiedProducts.push(product);
    }

    // Perform a single save operation for all modified products
    const savePromises = modifiedProducts.map(product => product.save({ session }));
    await Promise.all(savePromises); // Execute all save operations in parallel

    // Round the total amount to 2 decimal places and ensure integer conversion
    totalAmount = Math.round(totalAmount * 100) / 100; // Two decimal places
    return mode === 'deduct' ? { validatedProducts, calculatedTotalAmount: totalAmount } : null;
};

const createOrder = async ({ user, validatedProducts, calculatedTotalAmount, totalItems, shippingAddress, session }) => {
    const order = await Order.create([{
        customer: user._id,
        totalAmount: calculatedTotalAmount,
        products: validatedProducts,
        totalItems,
        paymentStatus: 'Pending',
        shippingAddress
    }], { session });

    return order[0];
};

const updateUserWithOrder = async (user, order, session) => {
    await User.findByIdAndUpdate(user._id, { $push: { myOrders: order._id } }, { session });
};

// Not using anymore as updated and optimized
const validateStocksAndCalculateTotal = async ({ products, session }) => {
    let totalAmount = 0;
    const validatedProducts = [];

    for (const item of products) {
        const { productId, quantity, size, color } = item;
        const product = await Product.findById(productId).session(session);

        if (!product) {
            throw new Error(`Product with ID ${productId} not found.`);
        }

        const variant = product.variants.find(v => v.color === color);
        if (!variant) {
            throw new Error(`Variant not found for color ${color}.`);
        }

        const sizeStock = variant.availableSizeStocks.find(s => s.size === size);
        if (!sizeStock || sizeStock.stock < quantity) {
            throw new Error(`Insufficient stock for size ${size} and color ${color}.`);
        }

        // Deduct the stock
        sizeStock.stock -= quantity;

        // Calculate price after applying discount
        const discount = product.discount || 0; // Default to 0 if no discount is set
        const discountedPrice = product.price * (1 - discount / 100);

        // Add to total amount
        totalAmount += discountedPrice * quantity;

        // Push validated product info to order array
        validatedProducts.push({
            productId: product._id,
            productTitle: product.title,
            originalPrice: product.price, // Optional: store original price for reference
            discountedPrice: discountedPrice, // Store discounted price
            discount, // Optional: store discount percentage for reference
            quantity,
            size,
            color
        });

        // Save the updated product with deducted stock
        await product.save({ session });
    }

    return { validatedProducts, calculatedTotalAmount: totalAmount };
};

//@desc Fetch All Orders with search and filter functionality
//@route POST /v1/orders/
//@access admin
exports.fetchOrders = async (req, res) => {
    try {
        const { page, limit, startIndex, endIndex } = getPagination(req.query);

        // Default filter is an empty object
        const filter = req.body.filter || {};

        // Search functionality: get the search query from the request
        const searchQuery = req.body.search || '';

        // If there is a search term, build a search filter
        if (searchQuery) {
            const regex = new RegExp(searchQuery, 'i'); // Case-insensitive regex for partial match

            // Search across relevant fields, like customer email, product title, and order status
            filter.$or = filter.$or || [];  // Ensure we don't overwrite existing $or filter if there is one
            filter.$or.push(
                { 'customer.email': { $regex: regex } },
                { 'products.productTitle': { $regex: regex } },
                { 'status': { $regex: regex } },
                { 'uuidOrder': { $regex: regex } }
            );
        }

        const totalRecords = await Order.countDocuments(filter).exec();
        const pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

        const orders = await Order.find(filter)
            .populate('customer', 'email role fullName phone country city image createdAt address state postalCode')
            .populate({
                path: 'products.productId',
                select: 'title description price discount ratedBy ratings averageRatings features mockupImage variants',
                populate: {
                    path: 'categories',
                    select: 'tag categoryImage productCount',
                }
            })
            .sort({ createdAt: -1 })
            .skip(startIndex)
            .limit(limit)
            .exec();

        if (orders.length > 0) {
            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
                data: orders,
                pagination
            });
        }

        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.NOT_FOUND });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};


//@desc Fetch Single Order by Id
//@route GET /v1/orders/:id
//@access customer, admin
exports.fetchOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const order = await Order.findById(orderId)
            .populate('customer', 'email role fullName phone country city image createdAt address state postalCode')
            .populate({
                path: 'products.productId',
                select: 'title description price discount ratedBy ratings averageRatings features mockupImage variants',
                populate: {
                    path: 'categories',
                    select: 'tag categoryImage productCount',
                }
            })
            .exec();


        if (!order) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        res.json({ message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE, order });
    } catch (error) {
        return res.status(STATUS_CODE.SERVER_ERROR).json({ message: error.message });
    }
};


//@desc Edit Order
//@route PUT /v1/orders/:id
//@access admin
exports.editOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { products, totalItems, status, paymentStatus, totalAmount, transactionId, isDelivered } = req.body;
        const orderId = req.params.id;

        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'Invalid ID' });
        }

        const order = await Order.findById(orderId).session(session);
        if (!order) {
            await session.abortTransaction();
            session.endSession();
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        if (Object.keys(req.body).length === 0) {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'No fields to update' });
        }

        if (order.status === "Completed") {
            await session.abortTransaction();
            session.endSession();
            return res.status(400).json({ message: 'You cannot update after the order is completed' });
        }

        // Update the order
        const updatedOrder = await Order.findByIdAndUpdate(
            order._id,
            { products, totalItems, status, paymentStatus, totalAmount, transactionId, isDelivered },
            { new: true, session }
        );

        if (updatedOrder) {
            // If the status is updated to "Completed", update user's productsBought and Product's boughtBy
            if (updatedOrder.status === "Completed" && order.status !== "Completed") {
                const productIds = updatedOrder.products.map(product => product.productId);

                // Update user with purchased products
                const updatedUser = await User.findByIdAndUpdate(
                    order.customer,
                    { $push: { productsBought: { $each: productIds } } },
                    { new: true, session }
                );

                // Update products bought by the user and increment soldCount
                const updatedProduct = await Product.updateMany(
                    { _id: { $in: productIds } },
                    {
                        $push: { boughtBy: order.customer },
                        $inc: { soldCount: 1 } // Increment soldCount for each product in the order
                    },
                    { session }
                );
            }

            await session.commitTransaction();
            session.endSession();

            return res.status(STATUS_CODE.OK).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
                data: updatedOrder
            });
        }

        await session.abortTransaction();
        session.endSession();
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.UNABLE_TO_UPDATE });

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

// Order Controller without Payment gateway
exports.addOrder2 = async (req, res) => {
    const session = await mongoose.startSession(); // Start a session for the transaction
    session.startTransaction(); // Start the transaction

    try {
        const {
            email, customer, products, totalAmount, transactionId, paymentStatus,
            fullName, address, city, state, postalCode, country, phone, totalItems
        } = req.body;

        let user;

        // If customerId exists, fetch the user
        if (customer) {
            user = await User.findById(customer).session(session); // Use session
        }
        // Otherwise, look up by email or create a new customer
        else {
            user = await User.findOne({ email }).session(session);

            if (!user) {
                const password = String(generateOTP());
                const hashedPassword = await bcrypt.hash(password, 10);

                user = new User({
                    email,
                    email_verified: true,
                    password: hashedPassword,
                    role: "customer",
                    fullName,
                    address,
                    city,
                    state,
                    postalCode,
                    country,
                    phone
                });

                await user.save({ session }); // Save within the transaction session
                await sendCreds(email, password); // Send generated credentials to the customer
            }
        }

        if (!user) {
            await session.abortTransaction(); // Abort transaction
            session.endSession(); // End session
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
        }

        // Ensure required fields are provided
        if (!products || !totalAmount || !transactionId) {
            await session.abortTransaction(); // Abort transaction
            session.endSession(); // End session
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.REQUIRED.ALL_FIELDS_REQUIRED });
        }

        // Check product availability and stock
        const validatedProducts = [];
        for (const item of products) {
            const { productId, quantity, size, color } = item;
            const product = await Product.findById(productId).session(session);

            if (!product) {
                await session.abortTransaction(); // Abort transaction
                session.endSession(); // End session
                return res.status(STATUS_CODE.NOT_FOUND).json({ message: `Product with ID ${productId} not found.` });
            }

            // Find the relevant variant (if exists)
            const variant = product.variants.find(v => v.color === color);
            if (!variant) {
                await session.abortTransaction(); // Abort transaction
                session.endSession(); // End session
                return res.status(STATUS_CODE.NOT_FOUND).json({ message: `Variant not found for color ${color}.` });
            }

            const sizeStock = variant.availableSizeStocks.find(s => s.size === size);
            if (!sizeStock || sizeStock.stock < quantity) {
                await session.abortTransaction(); // Abort transaction
                session.endSession(); // End session
                return res.status(STATUS_CODE.BAD_REQUEST).json({
                    message: `Insufficient stock for size ${size} and color ${color}.`
                });
            }

            // Deduct the stock
            sizeStock.stock -= quantity;

            // Push validated product info to order array
            validatedProducts.push({
                productId: product._id,
                productTitle: product.title,
                price: product.price,
                quantity,
                size,
                color
            });

            // Save the updated product
            await product.save({ session }); // Save product within the transaction session
        }

        // Create the order
        const order = await Order.create([{
            customer: user._id,
            totalAmount,
            transactionId,
            products: validatedProducts, // Storing detailed product info
            paymentStatus,
            totalItems
        }], { session }); // Pass session to order creation

        if (order) {
            // Link the order to the customer
            await User.findByIdAndUpdate(user._id, { $push: { myOrders: order[0]._id } }, { session, new: true });

            // Commit transaction if all steps are successful
            await session.commitTransaction();
            session.endSession();

            return res.status(STATUS_CODE.CREATED).json({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.CREATED,
                data: order[0], // As order is an array due to the use of create with a session
            });
        }

        await session.abortTransaction(); // Abort transaction
        session.endSession(); // End session
        return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.REQUIRED.ALL_FIELDS_REQUIRED });

    } catch (error) {
        // In case of an error, abort the transaction and rollback
        await session.abortTransaction();
        session.endSession();
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message,
        });
    }
};

// Not using as Payment Intent is being Used
exports.stripeWebhookCheckout = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
    // const endpointSecret = 'whsec_VUBnI8bL8HxJcwJ0KTdqkXRCses9n6ix';
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        // Invalid signature
        console.error("Webhook Error:", err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const stripeSession = event.data.object; // Stripe session object

        const orderId = stripeSession.metadata.orderId; // Retrieve order ID from metadata

        if (event.type === 'checkout.session.expired') {
            console.log("Processing checkout.session.expired for Order ID:", orderId)

            // 1. Find the order and ensure it exists
            const order = await Order.findById(orderId).session(session);
            if (!order) {
                throw new Error("Order not found.");
            }

            // 2. Early return if order is already cancelled
            if (order.status === "Cancelled") {
                console.log("Order is already cancelled, skipping cancellation process.");
                await session.commitTransaction();
                return res.status(200).json({ message: "Order was already cancelled, no further action needed." });
            }

            // 3. Revert stock changes for each product in the order
            for (const item of order.products) {
                const product = await Product.findById(item.productId).session(session);
                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found.`);
                }

                const variant = product.variants.find(v => v.color === item.color);
                if (!variant) {
                    throw new Error(`Variant not found for color ${item.color}.`);
                }

                const sizeStock = variant.availableSizeStocks.find(s => s.size === item.size);
                if (!sizeStock) {
                    throw new Error(`Size not found for size ${item.size}.`);
                }

                // Revert the deducted stock
                sizeStock.stock += item.quantity;

                // Save the updated product with reverted stock
                await product.save({ session });
            }

            // 4. Update the order status to "Cancelled"
            order.status = "Cancelled";
            await order.save({ session });

        }
        else if (event.type === 'checkout.session.completed') {
            // else if (event.type === 'payment.intent.succeeded') {
            console.log("Processing payment_intent.succeeded for Order ID:", orderId);

            // const stripeSession = event.data.object;
            // const orderId = stripeSession.metadata.orderId;

            // Retrieve the full PaymentIntent object
            const paymentIntent = await stripe.paymentIntents.retrieve(stripeSession.payment_intent);
            // console.log("intent",paymentIntent);


            // Retrieve the full PaymentMethod object from the PaymentIntent
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method);
            // console.log("method",paymentIntent);

            // Extract transaction-related info
            const transactionId = paymentIntent.id;
            const paymentStatus = stripeSession.payment_status;

            // Extract customer details
            const customerEmail = stripeSession.customer_details.email;
            const customerName = stripeSession.customer_details.name;
            const customerAddress = stripeSession.shipping_details;

            const shippingAddress = {
                fullName: customerAddress.name,
                city: customerAddress.address.city,
                country: customerAddress.address.country,
                addressLine1: customerAddress.address.line1,
                addressLine2: customerAddress.address.line2,
                postalCode: customerAddress.address.postal_code,
                state: customerAddress.address.state
            };

            // Extract card information from the payment method
            const cardBrand = paymentMethod.card.brand;
            const cardLast4 = paymentMethod.card.last4;
            const cardExpMonth = paymentMethod.card.exp_month;
            const cardExpYear = paymentMethod.card.exp_year;

            const order = await Order.findByIdAndUpdate(orderId, {
                transactionId: stripeSession.id,
                paymentStatus: 'Paid',
                shippingAddress
            }, { new: true, session });
        }

        await session.commitTransaction();
        res.status(200).json({ received: true });
    } catch (error) {
        await session.abortTransaction();
        console.error("Error processing webhook:", error.message);
        res.status(500).json({ message: "Server error.", error: error.message });
    } finally {
        session.endSession();
    }
};

// For separate stripe session, not using anymore bcz ui embedded
exports.paidOrder = async (req, res) => {
    try {
        const [session, lineItems] = await Promise.all([
            stripe.checkout.sessions.retrieve(req.query.session_id, { expand: ['payment_intent.payment_method'] }),
            stripe.checkout.sessions.listLineItems(req.query.session_id)
        ]);
        const orderId = session.metadata.orderId; // Retrieve order ID from metadata


        // Extract the payment intent and payment method details
        const paymentIntent = session.payment_intent;
        const paymentMethod = paymentIntent.payment_method;

        // Extract transaction-related info
        const transactionId = paymentIntent.id; // Payment Intent ID
        const paymentStatus = session.payment_status; // Should be 'paid'

        // Extract customer details
        const customerEmail = session.customer_details.email;
        const customerName = session.customer_details.name;
        const customerAddress = session.customer_details.address;

        // Extract card information from the payment method
        const cardBrand = paymentMethod.card.brand;
        const cardLast4 = paymentMethod.card.last4;
        const cardExpMonth = paymentMethod.card.exp_month;
        const cardExpYear = paymentMethod.card.exp_year;

        // 6. Update the order with the transactionId (paymentIntentId)
        const order = await Order.findByIdAndUpdate(orderId, {
            transactionId: transactionId,
            paymentStatus: paymentStatus === "paid" ? "Paid" : "Pending"
        }, { new: true });

        return res.status(STATUS_CODE.OK).json({
            message: SUCCESS_MSG.SUCCESS_MESSAGES.CREATED,
            data: order,
        });

    } catch (error) {
        console.error(error);
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.SERVER_ERROR,
            error: error.message
        });
    }
};

// For separate stripe session, not using anymore bcz ui embedded
exports.cancelOrder = async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { session_id } = req.query; // Stripe session ID

        // 1. Retrieve the Stripe session to check its status
        const stripeSession = await stripe.checkout.sessions.retrieve(session_id);
        if (!stripeSession) {
            throw new Error("Stripe session not found.");
        }

        // Check if the session is already expired or completed
        if (stripeSession.status === 'expired') {
            throw new Error("Stripe session is already expired.");
        } else if (stripeSession.status === 'complete') {
            throw new Error("Stripe session has already been completed, cannot cancel the order.");
        }

        const orderId = stripeSession.metadata.orderId; // Retrieve order ID from metadata

        // 2. Find the order and ensure it exists
        const order = await Order.findById(orderId).session(session);
        if (!order) {
            throw new Error("Order not found.");
        }

        // 3. Check if the order is already cancelled
        if (order.status === "Cancelled") {
            throw new Error("Order is already cancelled.");
        }

        // 4. Expire the associated Stripe session
        await stripe.checkout.sessions.expire(session_id);

        // 5. Revert stock changes for each product in the order
        for (const item of order.products) {
            const product = await Product.findById(item.productId).session(session);
            if (!product) {
                throw new Error(`Product with ID ${item.productId} not found.`);
            }

            const variant = product.variants.find(v => v.color === item.color);
            if (!variant) {
                throw new Error(`Variant not found for color ${item.color}.`);
            }

            const sizeStock = variant.availableSizeStocks.find(s => s.size === item.size);
            if (!sizeStock) {
                throw new Error(`Size not found for size ${item.size}.`);
            }

            // Revert the deducted stock
            sizeStock.stock += item.quantity;

            // Save the updated product with reverted stock
            await product.save({ session });
        }

        // 6. Update the order status to "Cancelled"
        order.status = "Cancelled";
        await order.save({ session });

        await session.commitTransaction(); // Commit the transaction if successful
        session.endSession();

        return res.status(200).json({
            message: "Order cancelled and session expired successfully."
        });

    } catch (error) {
        await session.abortTransaction(); // Rollback any changes if there's an error
        session.endSession();

        console.error(error);
        return res.status(500).json({
            message: "Server error.",
            error: error.message
        });
    }
};

exports.webhookCli = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = 'whsec_f258fbc5d06cd678d76d0bf25fb08aa7f09148e38ec9c5e1b4212b3bfeb2f79a';

    let event;
    console.log("sig", sig);
    console.log("req.body", req.body);


    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
        console.log(event);
    } catch (err) {
        // Invalid signature
        console.log(`Webhook Error: ${err.message}`);
    }



    // Return a 200 response to acknowledge receipt of the event
    res.json({ received: true });
};