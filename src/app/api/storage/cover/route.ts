import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME } from "@/lib/storage";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  if (!key) {
    return new NextResponse("Missing object key", { status: 400 });
  }

  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);

    // Convert the AWS SDK readable stream into a Web Stream for Next.js
    const stream = response.Body?.transformToWebStream();

    if (!stream) {
      throw new Error("Failed to create readable stream");
    }

    return new NextResponse(stream, {
      headers: {
        "Content-Type": response.ContentType || "image/jpeg",
        // Cache the image heavily in the browser so we don't spam R2 on every page refresh
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Image Proxy Error:", error);
    return new NextResponse("Image not found", { status: 404 });
  }
}