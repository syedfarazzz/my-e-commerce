const mongoose = require("mongoose");
const User = require("../models/userSchema");
// const { client } = require("../config/redisConnection");
const { cacheInvalidation } = require('../utils/cacheInavlidation');
const { getPagination, buildPaginationObject } = require('../services/pagination');
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");
const axios = require('axios');
const userAgentParser = require('ua-parser-js');  // To parse the user-agent string
const storeSessionSchema = require("../models/storeSessionSchema");


//@desc Fetch All Users with search and filter functionality
//@route POST /v1/users/
//@access admin
exports.fetchUsers = async (req, res) => {
  try {
    const { page, limit, startIndex, endIndex } = getPagination(req.query);

    let pagination;
    const filter = req.body.filter || {};

    // Search functionality: get the search query from the request
    const searchQuery = req.body.search || '';

    // If there is a search term, build a search filter for specific fields
    if (searchQuery) {
      const regex = new RegExp(searchQuery, 'i'); // Case-insensitive regex for partial match

      // Search across relevant fields like uuidUser, email, fullName, country, and city
      filter.$or = filter.$or || [];  // Ensure we don't overwrite existing $or filter if there is one
      filter.$or.push(
        { 'uuidUser': { $regex: regex } },
        { 'email': { $regex: regex } },
        { 'fullName': { $regex: regex } },
        { 'country': { $regex: regex } },
        { 'city': { $regex: regex } }
      );
    }

    // If there's a phone filter, convert it to a regex for matching phone numbers starting with the provided string
    if (filter.phone) {
      const phoneRegex = new RegExp(`^${filter.phone}`, 'i'); // Case-insensitive, starts with the given value
      filter.phone = phoneRegex;
    }

    // Get the total number of matching users
    const totalRecords = await User.countDocuments({ role: ROLES.customer, ...filter }).exec();
    pagination = buildPaginationObject(page, limit, startIndex, endIndex, totalRecords);

    // Fetch users with the applied filters and pagination
    const users = await User.find({ role: ROLES.customer, ...filter })
      .select('-password -emailVerified -otp -resetPasswordOTP') // Exclude sensitive fields
      .populate({
        path: 'likedProducts savedProducts viewedProducts productsBought',
        select: 'title description price discount likes views saved images features averageRatings mockupImage variants',
        populate: {
          path: 'categories',
          select: 'tag categoryImage productCount',
        }
      })
      .populate({
        path: 'myOrders',
        select: 'customer email totalItems status totalAmount transactionId products',
        populate: [
          {
            path: 'products.productId',
            select: 'title description price discount likes views saved images features averageRatings mockupImage variants',
            populate: {
              path: 'categories',
              select: 'tag categoryImage productCount',
            },
          },
        ],
      })
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .exec();

    // If users are found, return the data and pagination details
    return res.status(STATUS_CODE.OK).json({
      message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
      data: users,
      pagination
    });

  } catch (error) {
    console.error(error);
    return res.status(STATUS_CODE.SERVER_ERROR).json({
      message: ERRORS.INVALID.SERVER_ERROR,
      error: error.message
    });
  }
};


//@desc Fetch Single User by Id
//@route GET /v1/users/:id
//@access admin, customer
exports.fetchUserById = async (req, res) => {
  try {
    const userId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }
    console.log("controller start");

    const user = await User.findById(userId)
      .select('-password -emailVerified -otp -resetPassword')
      .populate({
        path: 'likedProducts savedProducts viewedProducts productsBought',
        select: 'title description price discount likes views saved images features averageRatings features mockupImage variants',
        populate: {
          path: 'categories',
          select: 'tag categoryImage productCount',
        }
      })
      .populate({
        path: 'myOrders',
        select: 'customer email totalItems status totalAmount transactionId products',
        populate: {
          path: 'products.productId',
          select: 'title description price discount likes views saved images features averageRatings features mockupImage variants',
        }
      })
      .exec();
    console.log("controller");


    if (!user) {
      return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.NOT_FOUND });
    }

    res.status(200).json({ message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE, user });
  } catch (error) {
    return res.status(STATUS_CODE.SERVER_ERROR).json({ message: error.message });
  }
};

//@desc Fetch Current User by Token
//@route GET /v1/users/me
//@access admin, customer
exports.currentUser = async (req, res) => {
  try {
    const currentUserId = req.user._id; // Get the current user's ID from the authenticated request
    const userAgent = req.headers['user-agent'];  
    const parsedUA = userAgentParser(userAgent); // Parse the User-Agent string
    const currentPlatform = parsedUA.os.name || 'Unknown Platform'; // e.g., Windows, macOS, Android
    const currentBrowser = parsedUA.browser.name || 'Unknown Browser'; // e.g., Chrome, Firefox

    // Find the user's active sessions (allow multiple sessions per user)
    const storeSessions = await storeSessionSchema.find({ userId: currentUserId });

    // If no session is found, create a new session
    if (!storeSessions || storeSessions.length === 0) {
      return res.status(STATUS_CODE.UNAUTHORIZED).json({
        message: 'No active session found for the current user.'
      });
    }

    // If the session platform/browser doesn't match the stored session, allow new session
    const existingSession = storeSessions.find(session => session.platform == currentPlatform && session.browser == currentBrowser);

    // ########### Do not remove this Comment code ###########
    // Optionally log out the other sessions if desired
    // await storeSessionSchema.deleteMany({ userId: currentUserId, _id: { $ne: existingSession._id } });
    // ########### Do not remove this Comment code ###########


    // Retrieve the user details and populate related data
    const user = await User.findById(currentUserId)
      .select('-password -emailVerified -otp -resetPassword') // Exclude sensitive fields
      .populate({
        path: 'likedProducts savedProducts viewedProducts productsBought',
        select: 'title description price discount likes views saved images features averageRatings mockupImage variants',
        populate: {
          path: 'categories',
          select: 'tag categoryImage productCount',
        },
      })
      .populate({
        path: 'myOrders',
        select: 'customer email totalItems status totalAmount transactionId products',
        populate: [
          {
            path: 'products.productId',
            select: 'title description price discount likes views saved images features averageRatings mockupImage variants',
            populate: {
              path: 'categories',
              select: 'tag categoryImage productCount',
            },
          },
        ],
      })
      .lean()
      .exec();

    // If user not found, return an error
    if (!user) {
      return res.status(STATUS_CODE.NOT_FOUND).json({
        message: 'User not found.'
      });
    }

    // Send a success response with the user data
    return res.status(STATUS_CODE.OK).json({
      message: SUCCESS_MSG.SUCCESS_MESSAGES.RETRIEVE,
      sessionId: existingSession._id,
      data: user
    });

  } catch (error) {
    console.error('Error retrieving current user:', error.message);
    return res.status(STATUS_CODE.SERVER_ERROR).json({
      message: ERRORS.INVALID.SERVER_ERROR,
      error: error.message
    });
  }
};

//@desc Update User by Id
//@route PUT /v1/users/:id
//@access admin, customer
exports.updateUser = async (req, res) => {
  try {
    const userId = req.params.id
    const { firstName, lastName, fullName, phone, country, city, profilePicture, address, state, postalCode, discount } = req.body
    const currentUser = req.user;

    // Validate if the provided user ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Validate incase siblings level user update eachother
    if (currentUser.role == ROLES.customer && currentUser._id != userId) {
      return res.status(STATUS_CODE.FORBIDDEN).json({ message: ERRORS.INVALID.FORBIDDEN });
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.USER_NOT_FOUND });
    }

    // Check if req.body is empty
    if (Object.keys(req.body).length === 0) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({ message: 'No fields to update' });
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id,
      {
        // firstName,
        // lastName,
        fullName,
        phone,
        country,
        city,
        profilePicture,
        address,
        state,
        postalCode,
        discount
      },
      { new: true })
      .select('email role fullName phone country city profilePicture createdAt address state postalCode discount');

    if (updatedUser) {
      // After a successful update
      // await cacheInvalidation(userId, null);

      return res.status(STATUS_CODE.OK).json({
        message: SUCCESS_MSG.SUCCESS_MESSAGES.UPDATE,
        data: updatedUser
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

//@desc Delete User by Id
//@route DELETE /v1/users/:id
//@access admin
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id

    // Validate if the provided user ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(STATUS_CODE.BAD_REQUEST).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId)
    if (!user) {
      return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.USER_NOT_FOUND });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (deletedUser) {
      // After a successful delete, remove from cache
      // await cacheInvalidation(userId, null);

      return res.status(STATUS_CODE.OK).json({
        message: SUCCESS_MSG.SUCCESS_MESSAGES.DELETE,
        data: deletedUser
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




// Import dependencies

exports.verifyRecaptcha = async (req, res) => {
  const { token: recaptchaToken } = req.body;
  const siteSecret = process.env.RECAPTCHA_SECRET_KEY;
  const verificationUrl = `https://www.google.com/recaptcha/api/siteverify`;

  try {
    // Make a POST request to the reCAPTCHA verification API
    const { data } = await axios.post(
      verificationUrl,
      null, // No body required, send data via params
      {
        params: {
          secret: siteSecret,
          response: recaptchaToken,
        },
      }
    );


    // Check if verification was successful
    if (data.success) {
      return res.status(200).json({ message: 'Verification successful' });
    } else {
      // Handle specific error codes
      const errorMessages = {
        'timeout-or-duplicate': 'The token is expired or has already been used.',
        'missing-input-secret': 'The secret parameter is missing.',
        'invalid-input-secret': 'The secret parameter is invalid or malformed.',
        'missing-input-response': 'The response parameter is missing.',
        'invalid-input-response': 'The response parameter is invalid or malformed.',
      };

      const errors = data['error-codes']?.map(code => errorMessages[code] || code) || ['Unknown error'];
      console.log("=========?>", errors)
      return res.status(400).json({
        message: 'Verification failed',
        errors,
      });
    }
  } catch (error) {
    console.error("🚀 ~ exports.verifyRecaptcha= ~ error:", error.message);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};


