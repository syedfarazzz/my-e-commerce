const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { v4: uuidv4 } = require('uuid');

const bucketName = process.env.AWS_BUCKET_NAME;
const region = process.env.AWS_BUCKET_REGION;
const accessKeyId = process.env.AWS_ACCESS_KEY;
const secretAccessKey = process.env.AWS_SECRET_KEY;

// Create an S3 client instance
const s3 = new S3Client({
  region,
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
});

// Function to upload a file to S3
const uploadFile = async (file, folderName = '') => {
  let myFile = file.originalname.split(".");
  const ext = myFile[myFile.length - 1];
  const fileKey = `${folderName}/${uuidv4()}.${ext}`;
  const uploadParams = {
    Bucket: bucketName,
    Body: file.buffer,
    Key: fileKey,
    CacheControl: "max-age=86400",
    ContentType: file.mimetype,
  };

  // Use PutObjectCommand to upload the file
  const command = new PutObjectCommand(uploadParams);
  const obj = await s3.send(command);

  // Construct the hosted URL
  const hostedUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${fileKey}`;

  // return { obj, hostedUrl };
  return { hostedUrl };
};

module.exports = { uploadFile, s3 };