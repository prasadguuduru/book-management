import { useEffect, useState } from 'react';
import './App.css';

interface Book {
  id: string;
  title: string;
  author: string;
  status: string;
}

interface ApiResponse {
  message: string;
  books: Book[];
  timestamp: string;
}

function App() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const response = await fetch('http://localhost:4566/restapis/local/local/_user_request_/hello', {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!data) return <div>No data</div>;

  return (
    <div className="App">
      <header className="App-header">
        <h1>{data.message}</h1>
        <p>Timestamp: {data.timestamp}</p>
      </header>
      <main>
        <h2>Books</h2>
        <div className="books-grid">
          {data.books.map((book) => (
            <div key={book.id} className="book-card">
              <h3>{book.title}</h3>
              <p>Author: {book.author}</p>
              <p>Status: {book.status}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

export default App;
