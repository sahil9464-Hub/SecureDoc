
const express = require("express");
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");

const Document = require("../models/Document");
const authMiddleware = require("../middleware/authMiddleware");
const createAuditLog = require("../utils/auditLogger");
const supabase = require("../config/supabase");

const router = express.Router();

const bucket = process.env.SUPABASE_BUCKET;


// ==========================================
// MULTER STORAGE CONFIGURATION
// ==========================================

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,

    limits: {
        fileSize: 50 * 1024 * 1024
    },


    fileFilter: (req, file, cb) => {

        const allowedTypes = [
            "application/pdf",
            "image/png",
            "image/jpeg",
            "text/plain"
        ];

        const extension = path.extname(file.originalname).toLowerCase();

        const isNotebook =
            extension === ".ipynb" &&
            [
                "application/json",
                "application/x-ipynb+json",
                "application/octet-stream"
            ].includes(file.mimetype);

        if (allowedTypes.includes(file.mimetype) || isNotebook) {
            cb(null, true);
        } else {
            cb(
                new Error(
                    "Only PDF, PNG, JPG, TXT and IPYNB files are allowed"
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

        let uploadedStoragePath = null;

        try {

            if (!req.file) {
                return res.status(400).json({
                    message: "No document uploaded"
                });
            }

            // Validate Jupyter Notebook files
            if (path.extname(req.file.originalname).toLowerCase() === ".ipynb") {

                try {
                    const notebook = JSON.parse(req.file.buffer.toString("utf8"));

                    if (
                        !Array.isArray(notebook.cells) ||
                        !notebook.metadata ||
                        !notebook.nbformat
                    ) {
                        throw new Error("Invalid notebook structure");
                    }

                } catch (error) {
                    return res.status(400).json({
                        message: "Invalid Jupyter Notebook file"
                    });
                }
            }

            const extension = path.extname(req.file.originalname);

            const uniqueFilename =
                Date.now() +
                "-" +
                crypto.randomUUID() +
                extension;

            const storagePath =
                `${req.user.id}/${uniqueFilename}`;


            // Upload file to Supabase
            const { error: uploadError } = await supabase.storage
                .from(bucket)
                .upload(storagePath, req.file.buffer, {
                    contentType: req.file.mimetype,
                    upsert: false
                });

            if (uploadError) {
                throw uploadError;
            }

            uploadedStoragePath = storagePath;


            // Save document information in MongoDB
            const document = await Document.create({

                filename: uniqueFilename,

                originalName: req.file.originalname,

                storagePath: storagePath,

                uploadedBy: req.user.id

            });


            // MongoDB record created successfully
            uploadedStoragePath = null;


            // Create audit log
            await createAuditLog(
                req.user.id,
                "DOCUMENT_UPLOADED",
                document._id,
                `Uploaded ${document.originalName}`
            );


            // Hide internal Supabase storage path
            const safeDocument = document.toObject();

            delete safeDocument.storagePath;


            res.status(201).json({

                message: "Document uploaded successfully",

                document: safeDocument

            });

        } catch (error) {

            console.log("Upload error:", error.message);


            // Remove uploaded file if MongoDB creation failed
            if (uploadedStoragePath) {

                try {

                    const { error: cleanupError } = await supabase.storage
                        .from(bucket)
                        .remove([uploadedStoragePath]);

                    if (cleanupError) {
                        console.log(
                            "Storage cleanup error:",
                            cleanupError.message
                        );
                    }

                } catch (cleanupError) {

                    console.log(
                        "Storage cleanup error:",
                        cleanupError.message
                    );

                }
            }


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

            })
                .select("-storagePath")
                .sort({
                    createdAt: -1
                });


            res.json({

                message: "Documents fetched successfully",

                documents

            });

        } catch (error) {

            console.log("Fetch documents error:", error.message);

            res.status(500).json({

                message: "Failed to fetch documents"

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


            // Download file from Supabase
            const { data, error } = await supabase.storage
                .from(bucket)
                .download(document.storagePath);


            if (error || !data) {

                console.log(
                    "Supabase download error:",
                    error?.message
                );

                return res.status(404).json({

                    message: "File could not be found in storage"

                });

            }


            // Create audit log
            await createAuditLog(

                req.user.id,

                "DOCUMENT_DOWNLOADED",

                document._id,

                `Downloaded ${document.originalName}`

            );


            // Convert downloaded file into a buffer
            const fileBuffer = Buffer.from(
                await data.arrayBuffer()
            );


            // Send file to user
            res.setHeader(
                "Content-Type",
                "application/octet-stream"
            );

            res.attachment(document.originalName);

            res.send(fileBuffer);

        } catch (error) {

            console.log(
                "Download error:",
                error.message
            );

            res.status(500).json({

                message: "Download failed"

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


            // Delete file from Supabase
            const { error: storageError } = await supabase.storage
                .from(bucket)
                .remove([document.storagePath]);


            if (storageError) {
                throw storageError;
            }


            // Delete MongoDB record
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

                message: "Delete failed"

            });

        }

    }
);


module.exports = router;
