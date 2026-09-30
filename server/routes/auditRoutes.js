const express = require("express");
const AuditLog = require("../models/AuditLog");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// Get logged-in user's audit logs
router.get("/", authMiddleware, async (req, res) => {
    try {
        const logs = await AuditLog.find({
            user: req.user.id
        })
            .populate("document", "originalName")
            .sort({ createdAt: -1 });

        res.json({
            message: "Audit logs fetched successfully",
            logs
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch audit logs",
            error: error.message
        });
    }
});

module.exports = router;