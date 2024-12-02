const { ERRORS, STATUS_CODE } = require("../constants/index");

exports.checkRole = (allowedRoles) => {
    return async (req, res, next) => {
        try {
            const currentUserRole = req.user.role;
            if (!allowedRoles.includes(currentUserRole)) {
                return res.status(STATUS_CODE.FORBIDDEN).json({ message: ERRORS.INVALID.FORBIDDEN });
            }
            next();
        } catch (error) {
            return res.status(STATUS_CODE.SERVER_ERROR).json({
                message: ERRORS.INVALID.INTERNAL_SERVER
            });
        }
    };
};