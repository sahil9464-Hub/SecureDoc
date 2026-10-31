
const express = require("express");

const Share = require("../models/Share");
const Document = require("../models/Document");
const User = require("../models/user");
const authMiddleware = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");
const supabase = require("../config/supabase");

const router = express.Router();

const bucket = process.env.SUPABASE_BUCKET;


// ==========================================
// SHARE DOCUMENT
// ==========================================

router.post("/", authMiddleware, async (req, res) => {
    try {
        const { documentId, email, expiresAt } = req.body;

        if (!documentId || !email || !expiresAt) {
            return res.status(400).json({
                message: "Document ID, email and expiry time are required"
            });
        }

        const document = await Document.findOne({
            _id: documentId,
            uploadedBy: req.user.id
        });

        if (!document) {
            return res.status(404).json({
                message: "Document not found or you are not the owner"
            });
        }

        const sharedUser = await User.findOne({
            email: email.toLowerCase()
        });

        if (!sharedUser) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        if (sharedUser._id.toString() === req.user.id) {
            return res.status(400).json({
                message: "You cannot share a document with yourself"
            });
        }

        if (new Date(expiresAt) <= new Date()) {
            return res.status(400).json({
                message: "Expiry time must be in the future"
            });
        }

        const share = await Share.create({
            document: documentId,
            sharedBy: req.user.id,
            sharedWith: sharedUser._id,
            expiresAt: new Date(expiresAt)
        });

        await createAuditLog(
            req.user.id,
            "DOCUMENT_SHARED",
            document._id,
            `Shared ${document.originalName} with ${sharedUser.email}`
        );

        res.status(201).json({
            message: "Document shared successfully",
            share
        });

    } catch (error) {
        console.log("Sharing error:", error.message);

        res.status(500).json({
            message: "Sharing failed"
        });
    }
});


// ==========================================
// GET DOCUMENTS SHARED WITH USER
// ==========================================

router.get("/received", authMiddleware, async (req, res) => {
    try {
        const shares = await Share.find({
            sharedWith: req.user.id,
            expiresAt: { $gt: new Date() }
        })
        .populate({
            path: "document",
            select: "originalName filename uploadedBy createdAt"
        })
        .populate("sharedBy", "name email")
        .sort({ createdAt: -1 });

        res.json({
            message: "Shared documents fetched successfully",
            shares
        });

    } catch (error) {
        console.log("Fetch shared documents error:", error.message);

        res.status(500).json({
            message: "Failed to fetch shared documents"
        });
    }
});


// ==========================================
// DOWNLOAD SHARED DOCUMENT
// ==========================================

router.get("/download/:shareId", authMiddleware, async (req, res) => {
    try {
        const share = await Share.findOne({
            _id: req.params.shareId,
            sharedWith: req.user.id
        }).populate({
            path: "document",
            select: "originalName storagePath"
        });

        if (!share) {
            return res.status(404).json({
                message: "Shared document not found or access denied"
            });
        }

        if (new Date(share.expiresAt) <= new Date()) {
            return res.status(403).json({
                message: "This shared document has expired"
            });
        }

        const document = share.document;

        if (!document) {
            return res.status(404).json({
                message: "Document no longer exists"
            });
        }

        // Download file from private Supabase bucket
        const { data, error } = await supabase.storage
            .from(bucket)
            .download(document.storagePath);

        if (error || !data) {
            console.log("Supabase shared download error:", error?.message);

            return res.status(404).json({
                message: "File could not be found in storage"
            });
        }

        await createAuditLog(
            req.user.id,
            "SHARED_DOCUMENT_DOWNLOADED",
            document._id,
            `Downloaded shared document ${document.originalName}`
        );

        const fileBuffer = Buffer.from(await data.arrayBuffer());

        res.setHeader("Content-Type", "application/octet-stream");
        res.attachment(document.originalName);
        res.send(fileBuffer);

    } catch (error) {
        console.log("Shared download error:", error.message);

        res.status(500).json({
            message: "Shared document download failed"
        });
    }
});

module.exports = router;
