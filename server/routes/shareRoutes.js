const express = require("express");
const Share = require("../models/Share");
const Document = require("../models/Document");
const User = require("../models/User");
const authMiddleware = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");

const router = express.Router();

// Share document with another user
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { documentId, email, expiresAt } = req.body;

    if (!documentId || !email || !expiresAt) {
      return res.status(400).json({
        message: "Document ID, email and expiry time are required",
      });
    }

    // Check document ownership
    const document = await Document.findOne({
      _id: documentId,
      uploadedBy: req.user.id,
    });

    if (!document) {
      return res.status(404).json({
        message: "Document not found or you are not the owner",
      });
    }

    // Find receiving user
    const sharedUser = await User.findOne({
      email: email.toLowerCase(),
    });

    if (!sharedUser) {
      return res.status(404).json({
        message: "User not found",
      });
    }

    // Prevent sharing with yourself
    if (sharedUser._id.toString() === req.user.id) {
      return res.status(400).json({
        message: "You cannot share a document with yourself",
      });
    }

    // Check expiry
    if (new Date(expiresAt) <= new Date()) {
      return res.status(400).json({
        message: "Expiry time must be in the future",
      });
    }

    const share = await Share.create({
      document: documentId,
      sharedBy: req.user.id,
      sharedWith: sharedUser._id,
      expiresAt: new Date(expiresAt),
    });

    await createAuditLog(
      req.user.id,
      "DOCUMENT_SHARED",
      document._id,
      `Shared ${document.originalName} with ${sharedUser.email}`,
    );

    res.status(201).json({
      message: "Document shared successfully",
      share,
    });
  } catch (error) {
    res.status(500).json({
      message: "Sharing failed",
      error: error.message,
    });
  }
});

// Get documents shared with the logged-in user
router.get("/received", authMiddleware, async (req, res) => {
  try {
    const shares = await Share.find({
      sharedWith: req.user.id,
      expiresAt: { $gt: new Date() },
    })
      .populate("document")
      .populate("sharedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({
      message: "Shared documents fetched successfully",
      shares,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch shared documents",
      error: error.message,
    });
  }
});

// =========================
// DOWNLOAD SHARED DOCUMENT
// =========================

router.get(
    "/download/:shareId",
    authMiddleware,
    async (req, res) => {

        try {

            const share = await Share.findOne({
                _id: req.params.shareId,
                sharedWith: req.user.id
            }).populate("document");

            // Share not found or user is not authorized
            if (!share) {

                return res.status(404).json({
                    message:
                        "Shared document not found or access denied"
                });
            }

            // Check expiry
            if (
                new Date(share.expiresAt) <= new Date()
            ) {

                return res.status(403).json({
                    message:
                        "This shared document has expired"
                });
            }

            const document = share.document;

            if (!document) {

                return res.status(404).json({
                    message:
                        "Document no longer exists"
                });
            }

            // Check physical file
            const fs = require("fs");

            if (!fs.existsSync(document.filePath)) {

                return res.status(404).json({
                    message:
                        "File no longer exists on the server"
                });
            }

            // Audit log
            await createAuditLog(
                req.user.id,
                "SHARED_DOCUMENT_DOWNLOADED",
                document._id,
                `Downloaded shared document ${document.originalName}`
            );

            // Download file
            res.download(
                document.filePath,
                document.originalName,
                (error) => {

                    if (error) {

                        console.log(
                            "Shared download error:",
                            error.message
                        );
                    }
                }
            );

        } catch (error) {

            console.log(
                "Shared document download error:",
                error.message
            );

            res.status(500).json({
                message:
                    "Shared document download failed",
                error:
                    error.message
            });
        }
    }
);

module.exports = router;
