import { useEffect, useState } from 'react';
import { ApiResponse, Book } from '../types/book';

// Direct LocalStack endpoint
const BASE_URL = 'http://localhost:4566/restapis/local/local/_user_request_/hello';

export const useBooks = (status?: string) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBooks = async () => {
      try {
        setLoading(true);
        setError(null);

        // Construct URL with optional status parameter
        const url = status ? `${BASE_URL}?status=${status}` : BASE_URL;
        
        console.log('Fetching books from:', url);

        const response = await fetch(url, {
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: ApiResponse = await response.json();
        console.log('Received data:', data);
        setBooks(data.books || []);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        console.error('Error fetching books:', err);
        setError(errorMessage);
        setBooks([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBooks();
  }, [status]);

  return { books, loading, error };
};