const jwt = require("jsonwebtoken");
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");
const User = require("../models/userSchema");
const roles = require("../constants/userRoles");


exports.authenticate = async (req, res, next) => {
    let token;
    let authHeader = req.headers.authorization || req.headers.Authorization;
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
    }

    if (!token) {
        return res.status(STATUS_CODE.UNAUTHORIZED).json({ message: ERRORS.UNAUTHORIZED.NOT_LOGGED_IN });
    }

    try {
        const decoded = jwt.verify(token, process.env.SERVERSECRETKEY);
        
        const currentUser = await User.findOne({ _id: decoded._id })
            // .select('email role firstName lastName phone country city profilePicture createdAt likedProducts savedProducts viewedProducts productsBought myOrders')
            .select('-password -emailVerified -otp -resetPassword')
              .exec();

        if (!currentUser) {
            return (res.status(STATUS_CODE.UNAUTHORIZED).json({
                message: ERRORS.INVALID.USER_NOT_FOUND
            }));
        }

        req.user = currentUser;
        next();

    } catch (error) {
        return res.status(STATUS_CODE.UNAUTHORIZED).json({
            statusCode: STATUS_CODE.UNAUTHORIZED,
            message: ERRORS.UNAUTHORIZED.INVALID_JWT
        })
    }
};