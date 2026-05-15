import { NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export async function POST(req: Request) {
  try {
    const { filePath, fileType } = await req.json();

    if (!filePath || !fileType) {
      return NextResponse.json({ error: 'Missing file details' }, { status: 400 });
    }

    // 1. Explicitly grab and verify Environment Variables
    const accountId = process.env.NEXT_PUBLIC_R2_ACCOUNT_ID;
    const accessKey = process.env.R2_ACCESS_KEY_ID;
    const secretKey = process.env.R2_SECRET_ACCESS_KEY;
    const bucketName = process.env.NEXT_PUBLIC_R2_BUCKET_NAME;

    if (!accountId || !accessKey || !secretKey || !bucketName) {
      console.error("Missing R2 Env Vars:", { 
        accountId: !!accountId, 
        accessKey: !!accessKey, 
        secretKey: !!secretKey, 
        bucketName: !!bucketName 
      });
      throw new Error("Server is missing Cloudflare R2 credentials. Check .env file.");
    }

    // 2. Initialize the S3 Client INSIDE the request (prevents Next.js caching issues)
    const S3 = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
    });

    // 3. Build the command to put an object in the R2 bucket
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      ContentType: fileType,
    });

    // 4. Generate a temporary URL valid for 1 hour (3600 seconds)
    const signedUrl = await getSignedUrl(S3, command, { expiresIn: 3600 });

    return NextResponse.json({ signedUrl, filePath });

  } catch (error: any) {
    console.error("R2 Presign Error:", error);
    // Send the exact error message back to the browser console
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}