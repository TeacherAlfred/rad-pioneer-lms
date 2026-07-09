"use server";

import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, BUCKET_NAME } from "@/lib/storage";

/**
 * Generates a secure, temporary reading link valid for 2 hours.
 */
export async function getPresignedReadingUrl(fileKey: string | null): Promise<string | null> {
  if (!fileKey) return null;
  
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileKey,
    });

    // 7200 seconds = 2 hours. After this, the link dies.
    return await getSignedUrl(r2Client, command, { expiresIn: 7200 });
  } catch (error) {
    console.error("Failed to generate viewing token:", error);
    return null;
  }
}