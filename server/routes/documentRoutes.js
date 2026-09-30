const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const Document = require("../models/Document");
const authMiddleware = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");

const router = express.Router();


// ==========================================
// UPLOAD DIRECTORY
// ==========================================

const uploadDir = path.join(__dirname, "../uploads");

// Create uploads folder automatically if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}


// ==========================================
// MULTER STORAGE CONFIGURATION
// ==========================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },

    filename: (req, file, cb) => {

        const uniqueName =
            Date.now() +
            "-" +
            Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);

        cb(null, uniqueName);
    }

});

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (req, file, cb) => {

        const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain"
        ];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only PDF, PNG, JPG and TXT files are allowed"
                )
            );
        }
    }
});


// ==========================================
// UPLOAD DOCUMENT
// ==========================================

router.post(
    "/upload",
    authMiddleware,
    upload.single("document"),

    async (req, res) => {

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "No document uploaded"
                });
            }

            const document = await Document.create({

                filename: req.file.filename,

                originalName: req.file.originalname,

                filePath: req.file.path,

                uploadedBy: req.user.id

            });


            // Create audit log
            await createAuditLog(
                req.user.id,
                "DOCUMENT_UPLOADED",
                document._id,
                `Uploaded ${document.originalName}`
            );


            res.status(201).json({

                message: "Document uploaded successfully",

                document

            });

        } catch (error) {

            console.log("Upload error:", error.message);

            res.status(500).json({

                message: "Upload failed",

                error: error.message

            });

        }

    }
);


// ==========================================
// GET USER'S DOCUMENTS
// ==========================================

router.get(
    "/",
    authMiddleware,

    async (req, res) => {

        try {

            const documents = await Document.find({

                uploadedBy: req.user.id

            }).sort({
                createdAt: -1
            });


            res.json({

                message: "Documents fetched successfully",

                documents

            });

        } catch (error) {

            console.log("Fetch documents error:", error.message);

            res.status(500).json({

                message: "Failed to fetch documents",

                error: error.message

            });

        }

    }
);


// ==========================================
// DOWNLOAD DOCUMENT
// ==========================================

router.get(
    "/download/:id",
    authMiddleware,

    async (req, res) => {

        try {

            const document = await Document.findOne({

                _id: req.params.id,

                uploadedBy: req.user.id

            });


            if (!document) {

                return res.status(404).json({

                    message: "Document not found"

                });

            }


            // Check that the physical file exists
            if (!fs.existsSync(document.filePath)) {

                return res.status(404).json({

                    message: "File no longer exists on the server"

                });

            }


            // Create audit log
            await createAuditLog(

                req.user.id,

                "DOCUMENT_DOWNLOADED",

                document._id,

                `Downloaded ${document.originalName}`

            );


            res.download(

                document.filePath,

                document.originalName,

                (error) => {

                    if (error) {

                        console.log(
                            "Download error:",
                            error.message
                        );

                    }

                }

            );

        } catch (error) {

            console.log(
                "Download error:",
                error.message
            );

            res.status(500).json({

                message: "Download failed",

                error: error.message

            });

        }

    }
);


// ==========================================
// DELETE DOCUMENT
// ==========================================

router.delete(
    "/:id",
    authMiddleware,

    async (req, res) => {

        try {

            const document = await Document.findOne({

                _id: req.params.id,

                uploadedBy: req.user.id

            });


            if (!document) {

                return res.status(404).json({

                    message: "Document not found"

                });

            }


            // Delete physical file
            if (fs.existsSync(document.filePath)) {

                fs.unlinkSync(document.filePath);

            }


            // Delete database record
            await Document.deleteOne({

                _id: document._id

            });


            // Create audit log
            await createAuditLog(

                req.user.id,

                "DOCUMENT_DELETED",

                document._id,

                `Deleted ${document.originalName}`

            );


            res.json({

                message: "Document deleted successfully"

            });

        } catch (error) {

            console.log(
                "Delete error:",
                error.message
            );

            res.status(500).json({

                message: "Delete failed",

                error: error.message

            });

        }

    }
);


module.exports = router;