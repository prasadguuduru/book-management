import { useState } from 'react';
import { useBooks } from '../hooks/useBooks';
import { BookStatus } from '../types/book';
import BookCard from './BookCard';

const BookList: React.FC = () => {
  const [selectedStatus, setSelectedStatus] = useState<BookStatus | ''>('');
  const { books, loading, error } = useBooks(selectedStatus || undefined);

  const statuses: BookStatus[] = [
    'PUBLISHED',
    'DRAFT',
    'SUBMITTED_FOR_EDITING',
    'READY_FOR_PUBLICATION'
  ];

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
      </div>
    );
  }

  return (
    <div className="book-list-container">
      <div className="filters">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value as BookStatus | '')}
          className="status-filter"
        >
          <option value="">All Statuses</option>
          {statuses.map(status => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner">Loading...</div>
      ) : (
        <>
          <h2>Books ({books.length})</h2>
          <div className="book-grid">
            {books.map(book => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
          {books.length === 0 && (
            <p className="no-books">No books found</p>
          )}
        </>
      )}
    </div>
  );
};

export default BookList;
