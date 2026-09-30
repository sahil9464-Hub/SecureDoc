const AuditLog = require("../models/AuditLog");

const createAuditLog = async (user, action, document = null, details = "") => {
    try {
        await AuditLog.create({
            user,
            action,
            document,
            details
        });
    } catch (error) {
        console.log("Audit log error:", error.message);
    }
};

module.exports = createAuditLog;