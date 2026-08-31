import { notFound } from "next/navigation";
import { getBookById } from "../../reader/_actions/books";
import { getPresignedReadingUrl } from "../../reader/_actions/storage";
import MeridianReaderLayout from "../_components/meridian-reader-layout";

export default async function MeridianBookPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = await params;

  const book = await getBookById(bookId);
  if (!book || book.status === 'wip') {
    notFound();
  }

  let fileUrl = null;
  if (book.has_digital && book.file_key) {
    fileUrl = await getPresignedReadingUrl(book.file_key);
  }

  return <MeridianReaderLayout book={book} fileUrl={fileUrl} />;
}
