const bcrypt = require("bcrypt");
const jwt = require('jsonwebtoken');
const User = require("../models/userSchema");
const emailService = require('../services/emailService');
const { cacheInvalidation } = require('../utils/cacheInavlidation');
const { admin } = require('../config/firebaseAdmin');
const Session = require('../models/storeSessionSchema')
const { ERRORS, STATUS_CODE, SUCCESS_MSG, ROLES } = require("../constants/index");
const UAParser = require('ua-parser-js');
const DeviceDetector = require('device-detector-js');


const deviceDetector = new DeviceDetector();

//@desc Register User
//@route POST /v1/auth/register
//@access public
exports.registerUser = async (req, res, next) => {
    try {
        const { email, password, firstName, lastName, fullName, phone, country, state, city, profilePicture } = req.body;
        const subject = 'Welcome to E-Commerce!';
        const intro = 'Welcome to E-Commerce! We\'re very excited to have you on board.'
        const instructions = 'To get started with E-Commerce, kindly enter the OTP on our website:'


        if (!email || !password) {
            return res.status(400).json({ message: "All fields are mendatory" });
        }
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(STATUS_CODE.CONFLICT).json({ message: ERRORS.INVALID.EMAIL_USED });
        }

        //Since we should not store raw password in our Database, So, we hash password
        //Hash Password
        const hashedPassword = await bcrypt.hash(password, 10);     //10 is the number of solved password(no.of times it hashed)

        const otp = emailService.generateOTP();

        const user = await User.create(
            {
                email,
                password: hashedPassword,
                // firstName,
                // lastName,
                fullName,
                phone,
                country,
                state,
                city,
                profilePicture,
                otp
            }
        );

        if (user) {
            // Send OTP email
            const otpResult = await emailService.sendOTP(fullName, intro, instructions, email, subject, otp);
            // await cacheInvalidation(user._id)
            return res.status(STATUS_CODE.CREATED).json(
                {
                    message: "User registered successfully",
                    user: {
                        // _id: user.id,
                        email: user.email,
                        role: user.role,
                        // firstName,
                        // lastName,
                        fullName,
                        phone,
                        country,
                        state,
                        city,
                        profilePicture
                    }
                }
            );
        }
        else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: "User Data is not valid" });
        }
    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Login User
//@route POST /v1/auth/login
//@access public
exports.loginUser = async (req, res, next) => {
    try {
        const { email, password } = req.body;

        // Check if email and password are provided
        if (!email || !password) {
            return res.status(STATUS_CODE.FORBIDDEN).send({
                message: !email ? ERRORS.REQUIRED.EMAIL_REQUIRED : ERRORS.REQUIRED.PASSWORD_REQUIRED
            });
        }

        // Check if the user exists
        const user = await User.findOne({ email });

        if (!user) {
            return res.status(STATUS_CODE.UNAUTHORIZED).send({
                message: ERRORS.INVALID.INVALID_LOGIN_CREDENTIALS
            });
        }

        // Check if the email is verified
        if (user.emailVerified === false) {
            return res.status(STATUS_CODE.FORBIDDEN).send({
                code: "E0012",
                message: ERRORS.UNAUTHORIZED.VERIFY_OTP
            });
        }

        // Validate password
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (isPasswordValid) {
            // Generate JWT token
            const accessToken = jwt.sign(
                {
                    email: user.email,
                    _id: user._id,
                    role: user.role,
                },
                process.env.SERVERSECRETKEY,
                { expiresIn: "24h" }
            );
            const userAgent = req.headers["user-agent"];
            const parser = new UAParser(userAgent);
            const { browser, os, device } = parser.getResult();

            const browserName = browser.name || "Unknown Browser";
            const platform = req.body.platform || os.name || "Unknown Platform"; // Use req.body.platform if present
            const deviceName = req.body.deviceName || deviceDetector.parse(userAgent).device.name || (device.model || device.type ? device.type.charAt(0).toUpperCase() + device.type.slice(1) : platform); // Use req.body.deviceName if present
            // Create a new session

            const session = new Session({
                userId: user._id,
                deviceId: deviceName,
                platform,
                browser: browserName,
                token: accessToken,
                ipAddress: req.ip || "Unknown IP", // Store IP address
            });
            console.log("Create a new session :===>", session)

            await session.save();

            return res.status(STATUS_CODE.OK).send({
                message: SUCCESS_MSG.SUCCESS_MESSAGES.LOGIN,
                user: {
                    _id: user._id,
                    email: user.email,
                    role: user.role,
                    fullName: user.fullName,
                    phone: user.phone,
                    country: user.country,
                    state: user.state,
                    city: user.city,
                    profilePicture: user.profilePicture
                },
                token: accessToken
            });
        } else {
            return res.status(STATUS_CODE.UNAUTHORIZED).send({
                message: ERRORS.INVALID.INVALID_LOGIN_CREDENTIALS
            });
        }
    } catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
};


//@desc Confirm User Email
//@route POST /v1/auth/confirmed
//@access public
exports.confirmEmail = async (req, res, next) => {
    try {
        const { email, otp } = req.body;

        if (!otp) {
            return res.status(400).json({ message: ERRORS.UNAUTHORIZED.VERIFY_OTP });
        }
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(STATUS_CODE.NOT_FOUND).json({ message: ERRORS.INVALID.INVALID_EMAIL });
        }

        if (existingUser.emailVerified == true) {
            return res.status(STATUS_CODE.OK).json({ message: SUCCESS_MSG.SUCCESS_MESSAGES.EMAIL_VERIFIED_ALREADY });
        }

        if (existingUser.otp == otp) {
            const updatedUserOTP = await User.findByIdAndUpdate(existingUser._id, { emailVerified: true, otp: null }, { new: true });
            // await cacheInvalidation(existingUser._id);
            return res.status(200).json(
                {
                    message: "Email is verified, You can Log-in now"
                }
            );
        }
        else {
            return res.status(400).json(
                {
                    message: ERRORS.INVALID.INVALID_OTP
                }
            );
        }
    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Resend OTP
//@route POST /v1/auth/resend
//@access public
exports.resendOTP = async (req, res, next) => {
    try {
        const { email } = req.body;

        const subject = 'Your New OTP!';
        const intro = "Don't worry if you lost your previous OTP! We\'ve got you covered."
        const instructions = 'To get started with E-Commerce, kindly enter the OTP on our website:'

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(STATUS_CODE.NOT_FOUND).send({ message: ERRORS.INVALID.INVALID_OTP });
        }

        if (existingUser.emailVerified == true) {
            return res.status(STATUS_CODE.OK).send({ message: SUCCESS_MSG.SUCCESS_MESSAGES.EMAIL_VERIFIED_ALREADY });
        }

        const otp = emailService.generateOTP();
        const updateOTP = await User.findByIdAndUpdate(existingUser._id, { otp: otp }, { new: true });
        const otpResult = await emailService.sendOTP(existingUser.fullName, intro, instructions, email, subject, otp);
        if (otpResult.success) {
            // await cacheInvalidation(existingUser._id);
            return res.status(STATUS_CODE.OK).json({ message: "An OTP has been sent to your email" });
        }
        else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: `Error sending email to ${email}. Please try again` });
        }
    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Forget Password
//@route POST /v1/auth/forget
//@access public
exports.forgetPassword = async (req, res, next) => {
    try {
        const { email } = req.body;
        const subject = 'Reset Your Password - One-Time Password (OTP)';
        const intro = "You've requested to reset your password for your E-Commerce account."
        const instructions = 'To proceed with the reset, please use the following code:'

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(STATUS_CODE.NOT_FOUND).send({ message: ERRORS.INVALID.INVALID_EMAIL });
        }

        const otp = emailService.generateOTP();
        const updateOTP = await User.findByIdAndUpdate(existingUser._id, { resetPasswordOTP: otp });
        const otpResult = await emailService.sendOTP(existingUser.fullName, intro, instructions, email, subject, otp);

        if (otpResult.success) {
            // await cacheInvalidation(existingUser._id);
            return res.status(STATUS_CODE.OK).json({ message: "An OTP has been sent to your email" });
        }
        else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: `Error sending email to ${email}. Please try again` });
        }
    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Reset Password
//@route POST /v1/auth/reset
//@access public
exports.resetPassword = async (req, res, next) => {
    try {
        const { email, otp, newPassword } = req.body;

        if (!otp) {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.UNAUTHORIZED.VERIFY_OTP });
        }
        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(STATUS_CODE.NOT_FOUND).send({ message: ERRORS.INVALID.INVALID_EMAIL });
        }

        if (!newPassword) {
            return res.status(STATUS_CODE.BAD_REQUEST).send({ message: ERRORS.REQUIRED.PASSWORD_REQUIRED });
        }

        if (existingUser.resetPasswordOTP == otp) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const updatedUserPassword = await User.findByIdAndUpdate(
                existingUser._id,
                {
                    password: hashedPassword,
                    resetPasswordOTP: null
                },
                { new: true }
            );

            // await cacheInvalidation(existingUser._id);
            return res.status(STATUS_CODE.OK).json({ message: "Password updated, You can Log-in now" })
        }
        else {
            return res.status(STATUS_CODE.BAD_REQUEST).json({ message: ERRORS.INVALID.INVALID_OTP });
        }
    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Change Password
//@route POST /v1/auth/change
//@access Customer
exports.changePassword = async (req, res, next) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const email = req.user.email;

        const existingUser = await User.findOne({ email });

        if (!existingUser) {
            return res.status(STATUS_CODE.NOT_FOUND).send({ message: ERRORS.INVALID.INVALID_EMAIL });
        }

        if (!existingUser.password) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            await User.findByIdAndUpdate(existingUser._id, { password: hashedPassword }, { new: true });

            return res.status(200).json({ message: "Password successfully changed" })

        }

        const isPasswordValid = await bcrypt.compare(currentPassword, existingUser.password);

        if (isPasswordValid) {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            const updatedUserPassword = await User.findByIdAndUpdate(existingUser._id, { password: hashedPassword }, { new: true });

            if (updatedUserPassword) {
                // await cacheInvalidation(existingUser._id);
                return res.status(200).json({ message: "Password successfully changed" })
            }
        }
        return res.status(400).json({ message: "Current Password does not match" });

    }
    catch (err) {
        return res.status(STATUS_CODE.SERVER_ERROR).send({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: err.message
        });
    }
}

//@desc Sign Up with Google 
//@route POST /v1/auth/signup
//@access public

exports.signUpWithGmail = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "Token is missing" });
        }

        // Verify Firebase ID token
        const decodedToken = await admin.auth().verifyIdToken(idToken);

        const email = decodedToken.email;
        const fullName = decodedToken.name;
        const profilePicture = decodedToken.picture;

        let user = await User.findOne({ email });

        // Generate JWT token
        const generateToken = (user) =>
            jwt.sign(
                {
                    email: user.email,
                    _id: user._id,
                    role: user.role,
                },
                process.env.SERVERSECRETKEY,
                { expiresIn: "24h" }
            );

        let accessToken;
        if (user) {
            // Existing user: Generate access token
            accessToken = generateToken(user);
        } else {
            // New user: Create user account
            user = await User.create({
                email,
                fullName,
                profilePicture,
                emailVerified: true,
                signUpWithGmail: true,
            });

            if (!user) {
                return res.status(400).json({ message: "User data is not valid" });
            }

            accessToken = generateToken(user);
        }

        // Detect device and platform information
        // Detect device and platform information
        const userAgent = req.headers["user-agent"];
        const parser = new UAParser(userAgent);
        const { browser, os, device } = parser.getResult();

        const browserName = browser.name || "Unknown Browser";
        const platform = os.name || "Unknown Platform";
        const deviceName = deviceDetector.parse(userAgent).device.name || (device.model || device.type ? device.type.charAt(0).toUpperCase() + device.type.slice(1) : platform);

        // Create a new session
        const session = new Session({
            userId: user._id,
            deviceId: deviceName,
            platform,
            browser: browserName,
            token: accessToken,
            ipAddress: req.ip || "Unknown IP", // Store IP address
        });

        await session.save();
        console.log("🚀 ~ exports.signUpWithGmail= ~ session:", session)

        return res.status(200).json({
            message: SUCCESS_MSG.SUCCESS_MESSAGES.LOGIN,
            user: {
                _id: user._id,
                email: user.email,
                role: user.role,
                fullName: user.fullName,
                phone: user.phone,
                country: user.country,
                city: user.city,
                profilePicture: user.profilePicture,
            },
            token: accessToken,
            sessionId: session._id,
        });
    } catch (error) {
        console.error("Sign-up with Gmail error:", error.message);

        return res.status(STATUS_CODE.SERVER_ERROR).json({
            message: ERRORS.INVALID.INTERNAL_SERVER,
            error: error.message,
        });
    }
};



