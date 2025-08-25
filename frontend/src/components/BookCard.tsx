import { Book } from '../types/book';

interface BookCardProps {
  book: Book;
}

const BookCard: React.FC<BookCardProps> = ({ book }) => {
  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'PUBLISHED':
        return '#4CAF50';
      case 'DRAFT':
        return '#FFC107';
      case 'SUBMITTED_FOR_EDITING':
        return '#2196F3';
      case 'READY_FOR_PUBLICATION':
        return '#9C27B0';
      default:
        return '#757575';
    }
  };

  return (
    <div className="book-card">
      <h3>{book.title}</h3>
      <div className="book-details">
        <p><strong>Author:</strong> {book.author}</p>
        <p><strong>Genre:</strong> {book.genre}</p>
        <div 
          className="status-badge"
          style={{ backgroundColor: getStatusColor(book.status) }}
        >
          {book.status}
        </div>
        {book.publishedDate && (
          <p><strong>Published:</strong> {new Date(book.publishedDate).toLocaleDateString()}</p>
        )}
      </div>
    </div>
  );
};

export default BookCard;
