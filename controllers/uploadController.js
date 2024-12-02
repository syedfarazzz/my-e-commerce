// const { uploadImage } = require('../utils/firebaseUpload')
const { uploadFile } = require("../utils/s3Bucket");

//For Firebase
/*
const uploadSingleImage = async (req, res) => {
    try {
        const file = {
            type: req.file.mimetype,
            buffer: req.file.buffer
        };
        const buildImage = await uploadImage(file, 'single');
        res.send({
            status: "SUCCESS",
            url: buildImage
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            status: "ERROR",
            message: "Internal server error"
        });
    }
};
const uploadMultipleImages = async (req, res) => {
    try {
        const files = req.files.map(file => ({
            type: file.mimetype,
            buffer: file.buffer
        }));

        const buildImages = await uploadImage(files, 'multiple');

        res.send({
            status: "SUCCESS",
            url: buildImages
        });
    } catch (err) {
        console.log(err);
        res.status(500).send({
            status: "ERROR",
            message: "Internal server error"
        });
    }
};
*/

//For AWS
const uploadImages = async (req, res) => {
    try {
        // Using multer for file uploads
        const file = req.file;
        const files = req.files;
        

        if (!file && !files) {
            return res.status(400).json({ error: 'No files provided' });
        }

        const folderName = 'e-commerce';

        if (file) {
            // Single file upload
            const uploadedFile = await uploadFile(file, folderName);
            return res.status(200).json({ 
                message: 'File uploaded successfully', 
                uploadedFile: uploadedFile.obj,
                hostedUrl: uploadedFile.hostedUrl 
            });
        }

        // Multiple file upload
        const uploadResults = await Promise.all(files.map(file => uploadFile(file, folderName)));
        const response = uploadResults.map(result => ({
            uploadedFile: result.obj,
            hostedUrl: result.hostedUrl
        }));

        res.status(200).json({ 
            message: 'Files uploaded successfully', 
            uploadResults: response 
        });
    } catch (error) {
        console.error('Error in file upload route:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

module.exports = { uploadImages };
