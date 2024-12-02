const Order = require("../models/orderSchema");
const User = require("../models/userSchema");
const Product = require("../models/productSchema");
const moment = require('moment');
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");


exports.dashboardStats = async (req, res) => {
    try {
        // Order statistics
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: "Processing" });
        const completedOrders = await Order.countDocuments({ status: "Completed" });
        const cancelledOrders = await Order.countDocuments({ status: "Cancelled" });

        // Customer statistics
        const totalCustomers = await User.countDocuments({ role: "customer" });

        // New customers in the last 30 days (with name and email)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const newCustomersList = await User.find({
            role: "customer",
            createdAt: { $gte: thirtyDaysAgo }
        }).select('fullName email');  // Include only name and email fields

        const newCustomersCount = newCustomersList.length;  // Get the count of new customers

        // Top customers (those who bought the most products)
        const topCustomers = await User.aggregate([
            {
                $match: { role: "customer" } // Only consider customers
            },
            {
                $project: {
                    fullName: 1,
                    email: 1,
                    productsBoughtCount: { $size: "$productsBought" } // Count the number of products bought
                }
            },
            {
                $sort: { productsBoughtCount: -1 } // Sort by the number of products bought in descending order
            },
            {
                $limit: 5 // Return the top 5 customers
            }
        ]);

        // Total Enabled Products (count all products that are enabled)
        const totalEnabledProducts = await Product.countDocuments({ enabled: true });

        // Total Sold Products (sum of soldCount for all products)
        const totalSoldProducts = await Product.aggregate([
            { $match: { enabled: true } },
            { $group: { _id: null, totalSold: { $sum: "$soldCount" } } }
        ]);

        // Total Revenue (sum of totalAmount for all completed orders)
        const totalRevenue = await Order.aggregate([
            { $match: { status: "Completed" } },  // Only consider completed orders
            { $group: { _id: null, totalRevenue: { $sum: "$totalAmount" } } }
        ]);

        return res.status(200).json({
            success: true,
            data: {
                orders: {
                    totalOrders,
                    pendingOrders,
                    completedOrders,
                    cancelledOrders
                },
                customers: {
                    totalCustomers,
                    newCustomers: {
                        count: newCustomersCount,
                        list: newCustomersList // Include the list of new customers
                    },
                    topCustomers
                },
                products: {  // Return totalSoldProducts in the products object
                    totalSoldProducts: totalSoldProducts[0] ? totalSoldProducts[0].totalSold : 0,
                    totalEnabledProducts
                },
                revenue: {
                    totalRevenue: totalRevenue[0] ? totalRevenue[0].totalRevenue : 0
                }
            }
        });
    } catch (error) {
        console.error("Error getting dashboard stats:", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to get dashboard stats',
            error: error.message
        });
    }
};


// @desc Fetch revenue for chart based on daily, weekly, or monthly intervals
// @route GET /v1/revenue
// @access public
exports.fetchRevenue = async (req, res) => {
    try {
        const { filter = 'monthly', year = new Date().getFullYear(), month } = req.query;

        // Define the start and end of the selected year or month
        const startDate = moment(`${year}-${month || '01'}-01`).startOf(month ? 'month' : 'year');
        const endDate = moment(startDate).endOf(month ? 'month' : 'year');

        // Match orders within the time range
        const matchOrders = {
            createdAt: { $gte: startDate.toDate(), $lte: endDate.toDate() },
            status: 'Completed' // Only count completed orders
        };

        // Grouping and revenue calculations based on the selected filter
        let groupBy;
        if (filter === 'daily') {
            groupBy = { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };
        } else if (filter === 'weekly') {
            groupBy = { $isoWeek: "$createdAt" }; // Group by ISO week
        } else {
            groupBy = { $month: "$createdAt" }; // Group by month
        }

        // Aggregate query to calculate revenue
        const revenueData = await Order.aggregate([
            { $match: matchOrders },
            {
                $group: {
                    _id: groupBy,
                    totalRevenue: { $sum: "$totalAmount" }, // Calculate total revenue
                    orderCount: { $sum: 1 } // Number of orders
                }
            },
            { $sort: { _id: 1 } } // Sort by the group (day/week/month)
        ]);

        res.status(200).json({
            success: true,
            data: {
                filter,
                year,
                month: month || null,
                revenueData
            }
        });
    } catch (error) {
        console.error("Error fetching revenue data:", error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch revenue data',
            error: error.message
        });
    }
};

