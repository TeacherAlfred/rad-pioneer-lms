import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, BUCKET_NAME } from "@/lib/storage";
import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/require-admin";

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const projectId = formData.get("project_id") as string | null;

  if (!file || !projectId) {
    return NextResponse.json({ error: "Missing file or project_id" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const key = `projects/${projectId}_${Date.now()}_${safeName}`;

  await r2Client.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: file.type || "application/octet-stream",
  }));

  return NextResponse.json({ key, filename: file.name, content_type: file.type, size_bytes: buffer.length });
}
