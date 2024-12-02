const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
    sequenceName: {
        type: String,
        required: true,
        unique: true
    },
    sequenceValue: {
        type: Number,
        required: true,
        default: 0
    },
});

const Counter = mongoose.model("counter", counterSchema);
module.exports = Counter;
