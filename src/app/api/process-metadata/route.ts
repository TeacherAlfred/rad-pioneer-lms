import { NextResponse } from "next/server";
import { fetchAndStoreBookMetadata } from "@/lib/metadata-helper";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { books } = body; 

    if (!books || !Array.isArray(books)) {
      return NextResponse.json({ error: "Invalid payload provided." }, { status: 400 });
    }

    console.log(`\n📦 Starting metadata processing batch for ${books.length} volumes...`);

    // Process sequentially to respect external API rate limits
    for (const book of books) {
      console.log(`🔍 Searching Open Library for: "${book.title}"...`);
      
      const result = await fetchAndStoreBookMetadata(book.id, book.title);
      
      if (result) {
        console.log(`✅ Found: ${result.titles[0]} by ${result.authors[0]}`);
      } else {
        console.log(`❌ No match found for: ${book.title}`);
      }

      // Sleep for 1.5 seconds between requests
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    console.log(`✨ Batch processing complete.\n`);
    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("API Route Error during processing:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}