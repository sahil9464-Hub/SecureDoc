const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
    {
        filename: {
            type: String,
            required: true
        },

        originalName: {
            type: String,
            required: true
        },

        filePath: {
            type: String,
            required: true
        },

        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Document", documentSchema);