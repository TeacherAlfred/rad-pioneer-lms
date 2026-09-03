import { GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME } from "@/lib/storage";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";

export async function GET(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  const filename = searchParams.get("filename") || "download";

  if (!key) {
    return new NextResponse("Missing object key", { status: 400 });
  }

  try {
    const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });
    const response = await r2Client.send(command);

    const stream = response.Body?.transformToWebStream();
    if (!stream) {
      throw new Error("Failed to create readable stream");
    }

    return new NextResponse(stream, {
      headers: {
        "Content-Type": response.ContentType || "application/octet-stream",
        // Arbitrary docs/markdown, not images meant to render inline - force a save-as.
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "")}"`,
      },
    });
  } catch (error) {
    console.error("Project Attachment Proxy Error:", error);
    return new NextResponse("Attachment not found", { status: 404 });
  }
}

export async function DELETE(request: Request) {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");
  if (!key) {
    return new NextResponse("Missing object key", { status: 400 });
  }

  await r2Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
  return NextResponse.json({ ok: true });
}
