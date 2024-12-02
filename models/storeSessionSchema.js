const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true
    },
    deviceId: {
        type: String, required: true
    }, // Device name or identifier
    platform: {
        type: String, required: true
    },
    browser: {
        type: String, required: true
    }, // Browser name (e.g., Chrome, Safari)
    ipAddress: {
        type: String
    },
    lastActive: {
        type: Date, default: Date.now
    },
    token: {
        type: String, required: true
    }, // JWT token
});

module.exports = mongoose.model('Session', sessionSchema);
