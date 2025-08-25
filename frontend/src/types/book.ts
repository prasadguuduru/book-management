export type BookStatus = 'PUBLISHED' | 'DRAFT' | 'SUBMITTED_FOR_EDITING' | 'READY_FOR_PUBLICATION';

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  genre: string;
  publishedDate?: string;
}

export interface ApiResponse {
  message: string;
  books: Book[];
  timestamp: string;
}
