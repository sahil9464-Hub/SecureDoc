const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        action: {
            type: String,
            required: true
        },

        document: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Document",
            default: null
        },

        details: {
            type: String,
            default: ""
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("AuditLog", auditLogSchema);