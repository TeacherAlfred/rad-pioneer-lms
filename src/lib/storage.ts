import { S3Client } from "@aws-sdk/client-s3";

if (
  !process.env.R2_LIBRARY_ENDPOINT || 
  !process.env.R2_LIBRARY_ACCESS_KEY_ID || 
  !process.env.R2_LIBRARY_SECRET_ACCESS_KEY
) {
  throw new Error("Missing Cloudflare R2 Library environment credentials.");
}

export const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_LIBRARY_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_LIBRARY_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_LIBRARY_SECRET_ACCESS_KEY,
  },
});

export const BUCKET_NAME = process.env.R2_LIBRARY_BUCKET_NAME || "";