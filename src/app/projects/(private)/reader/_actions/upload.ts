"use server";

import { PutObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2Client, BUCKET_NAME } from "@/lib/storage";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Generates a secure URL allowing the browser to upload a file directly to the WIP folder.
 */
export async function getPresignedUploadUrl(fileName: string, fileType: string) {
  // Sanitize filename for the WIP key
  const safeName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
  const wipKey = `wip/${Date.now()}_${safeName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: wipKey,
    ContentType: fileType,
  });

  const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 }); // Valid for 10 mins

  return { uploadUrl, fileKey: wipKey };
}

/**
 * Registers the uploaded file in the database as a Work-In-Progress (WIP).
 */
export async function registerWipBook(title: string, fileKey: string, fileType: string) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("rad_books")
    .insert({
      title: title, // Initially just the messy filename
      has_digital: true,
      has_physical: false,
      file_key: fileKey,
      file_type: fileType.includes("pdf") ? "pdf" : "epub",
      status: "wip",
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/projects/reader");
  return data;
}

/**
 * Promotes a WIP book to the main library, restructuring its folder path in R2.
 */
export async function publishWipBook(
  bookId: string, 
  oldKey: string, 
  newAuthor: string, 
  newTitle: string, 
  fileExt: string,
  coverKey?: string | null,
  olCoverId?: string | null,
  synopsis?: string | null
) {
  const supabase = await createClient();

  const safeAuthor = newAuthor.replace(/[^a-zA-Z0-9 ]/g, "").trim() || "Unknown Author";
  const safeTitle = newTitle.replace(/[^a-zA-Z0-9 ]/g, "").trim();
  const newKey = `library/${safeAuthor}/${safeTitle}.${fileExt}`;

  let finalCoverKey = coverKey || null;

  try {
    // NEW: If the user selected a manual option with a cover, download it securely to R2 now
    if (olCoverId) {
      const coverUrl = `https://covers.openlibrary.org/b/id/${olCoverId}-L.jpg`;
      const imageRes = await fetch(coverUrl);
      
      if (imageRes.ok) {
        const buffer = Buffer.from(await imageRes.arrayBuffer());
        finalCoverKey = `covers/${bookId}_${Date.now()}.jpg`;

        await r2Client.send(new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: finalCoverKey,
          Body: buffer,
          ContentType: "image/jpeg",
        }));
      }
    }

    // 2. Copy the object to the new permanent location
    await r2Client.send(new CopyObjectCommand({
      Bucket: BUCKET_NAME,
      CopySource: `${BUCKET_NAME}/${oldKey}`,
      Key: newKey,
    }));

    // 3. Delete the original messy file from the WIP folder
    await r2Client.send(new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: oldKey,
    }));

    // 4. Update the database record
    const { error } = await supabase
      .from("rad_books")
      .update({
        title: newTitle,
        author: newAuthor,
        file_key: newKey,
        cover_key: finalCoverKey, 
        synopsis: synopsis || null,
        status: "unread",
      })
      .eq("id", bookId);

    if (error) throw new Error(error.message);
    
    revalidatePath("/projects/reader");
    return { success: true };

  } catch (error) {
    console.error("Failed to move file in R2:", error);
    throw new Error("Could not organize file in storage.");
  }
}