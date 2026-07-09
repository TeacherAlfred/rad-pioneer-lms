import { notFound } from "next/navigation";
import { getBookById } from "../_actions/books";
import { getPresignedReadingUrl } from "../_actions/storage";
import ReaderLayout from "../_components/reader-layout";

export default async function BookReaderPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;
  
  // 1. Fetch the book metadata
  const book = await getBookById(bookId);

  // 2. If it doesn't exist or is still a WIP, boot them out
  if (!book || book.status === 'wip') {
    notFound();
  }

  // 3. Generate the secure streaming URL if a digital file exists
  let fileUrl = null;
  if (book.has_digital && book.file_key) {
    fileUrl = await getPresignedReadingUrl(book.file_key);
  }

  // 4. Mount the interactive Client shell
  return <ReaderLayout book={book} fileUrl={fileUrl} />;
}