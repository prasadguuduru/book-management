import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  Edit as EditIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import { useBookStore } from '@/store/bookStore';

import { Book, UpdateBookRequest } from '@/types';

const bookSchema = yup.object({
  title: yup
    .string()
    .required('Title is required')
    .min(1, 'Title must be at least 1 character')
    .max(200, 'Title must be less than 200 characters'),
  description: yup
    .string()
    .required('Description is required')
    .max(1000, 'Description must be less than 1000 characters'),
  content: yup
    .string()
    .required('Content is required')
    .max(2000000, 'Content must be less than 2MB'),
  genre: yup
    .string()
    .required('Genre is required')
    .oneOf([
      'fiction',
      'non-fiction',
      'science-fiction',
      'mystery',
      'romance',
      'fantasy',
    ]),
  tags: yup.string().default(''),
});

type BookFormData = yup.InferType<typeof bookSchema>;

const EditorDashboard: React.FC = () => {
  const {
    books,
    userCapabilities,
    workflow,
    isLoading,
    error,
    fetchBooks,
    approveBook,
    rejectBook,
    updateBook,
    fetchBookWorkflow,
    clearError,
  } = useBookStore();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [comments, setComments] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BookFormData>({
    resolver: yupResolver(bookSchema),
  });

  useEffect(() => {
    // Fetch books with role-based filtering (backend will return SUBMITTED_FOR_EDITING + PUBLISHED for editors)
    fetchBooks();
  }, []); // Empty dependency array - fetchBooks is stable from Zustand

  const handleViewBook = (book: Book) => {
    console.log('👁️ Editor Dashboard - Opening view dialog for book:', book);
    setSelectedBook(book);
    fetchBookWorkflow(book.bookId);
    setIsViewDialogOpen(true);
  };

  const handleApproveBook = async () => {
    if (!selectedBook) {
      return;
    }

    try {
      clearError();
      await approveBook(selectedBook.bookId, comments);
      toast.success('Book approved successfully!');
      setIsApproveDialogOpen(false);
      setSelectedBook(null);
      setComments('');
      // Refresh the list
      fetchBooks('SUBMITTED_FOR_EDITING');
    } catch (error) {
      toast.error('Failed to approve book');
    }
  };

  const handleRejectBook = async () => {
    if (!selectedBook || !comments.trim()) {
      toast.error('Please provide comments for rejection');
      return;
    }

    try {
      clearError();
      await rejectBook(selectedBook.bookId, comments);
      toast.success('Book rejected and returned to author');
      setIsRejectDialogOpen(false);
      setSelectedBook(null);
      setComments('');
      // Refresh the list
      fetchBooks('SUBMITTED_FOR_EDITING');
    } catch (error) {
      toast.error('Failed to reject book');
    }
  };

  const handleUpdateBook = async (data: BookFormData) => {
    if (!selectedBook) {
      return;
    }

    try {
      clearError();
      const bookData: UpdateBookRequest = {
        bookId: selectedBook.bookId,
        version: selectedBook.version,
        title: data.title,
        description: data.description,
        content: data.content,
        genre: data.genre as Book['genre'],
        tags: data.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
      };

      await updateBook(bookData);
      toast.success('Book updated successfully!');
      setIsEditDialogOpen(false);
      setSelectedBook(null);
      reset();
      // Refresh the book list to show updated data
      fetchBooks();
    } catch (error) {
      toast.error('Failed to update book');
    }
  };

  const openEditDialog = (book: Book) => {
    setSelectedBook(book);
    setValue('title', book.title);
    setValue('description', book.description);
    setValue('content', book.content);
    setValue('genre', book.genre);
    setValue('tags', book.tags.join(', '));
    setIsEditDialogOpen(true);
  };

  // Use books directly since backend already filters by user role and permissions
  // For editors, backend returns SUBMITTED_FOR_EDITING + PUBLISHED books
  const submittedBooks = books.filter(
    book => book.status === 'SUBMITTED_FOR_EDITING'
  );
  const publishedBooks = books.filter(
    book => book.status === 'PUBLISHED'
  );

  // Enhanced debug logging to understand why books aren't showing
  console.log('📚 Editor Dashboard - All books:', books);
  console.log('📚 Editor Dashboard - Books length:', books?.length);
  console.log('�  Editor Dashboard - Books array type:', Array.isArray(books));
  console.log('📚 Editor Dashboard - Submitted books:', submittedBooks);
  console.log('📚 Editor Dashboard - Submitted books length:', submittedBooks?.length);
  console.log('🔐 Editor capabilities:', userCapabilities);
  console.log('⚠️ Loading state:', isLoading);
  console.log('❌ Error state:', error);

  // Log each book's status for debugging
  if (books && books.length > 0) {
    console.log('📋 Book statuses:', books.map(book => ({
      id: book.bookId,
      title: book.title,
      status: book.status,
      permissions: book.permissions,
      canEdit: book.permissions?.canEdit,
      editCondition: book.permissions?.canEdit || book.status === 'SUBMITTED_FOR_EDITING'
    })));
  } else {
    console.log('⚠️ No books received from API or books array is empty');
  }

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant='h4' component='h1' gutterBottom>
        Editor Dashboard
      </Typography>

      {error && (
        <Alert severity='error' sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant='h6' color='text.secondary'>
                Pending Reviews
              </Typography>
              <Typography variant='h4'>{submittedBooks.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant='h6' color='text.secondary'>
                Published Books
              </Typography>
              <Typography variant='h4'>{publishedBooks.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant='h6' color='text.secondary'>
                Review Queue
              </Typography>
              <Typography
                variant='h4'
                color={
                  submittedBooks.length > 0 ? 'warning.main' : 'success.main'
                }
              >
                {submittedBooks.length > 0 ? 'Active' : 'Clear'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Books Awaiting Review Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
        <Typography variant='h6' sx={{ p: 2 }}>
          Books Awaiting Review ({submittedBooks.length})
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Submitted</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : submittedBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <Typography variant='body2' color='text.secondary'>
                      {publishedBooks.length > 0
                        ? "No books awaiting review. Great job keeping up with the queue!"
                        : "No books submitted for editing yet. Check back later for new submissions."
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                submittedBooks.map(book => (
                  <TableRow key={book.bookId}>
                    <TableCell>
                      <Typography variant='subtitle2'>{book.title}</Typography>
                      <Typography variant='body2' color='text.secondary' noWrap>
                        {book.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>
                        Author ID: {book.authorId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={book.genre} size='small' />
                    </TableCell>
                    <TableCell>{book.wordCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(book.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewBook(book);
                          }}
                          title='View & Review'
                          color='primary'
                        >
                          <ViewIcon />
                        </IconButton>
                        {/* Show edit button for editors on submitted books */}
                        {(book.permissions?.canEdit || book.status === 'SUBMITTED_FOR_EDITING') && (
                          <IconButton
                            size='small'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditDialog(book);
                            }}
                            title='Edit Book'
                            sx={{
                              color: '#6b7280',
                              '&:hover': { backgroundColor: '#f3f4f6', color: '#3b82f6' }
                            }}
                          >
                            <EditIcon fontSize='small' />
                          </IconButton>
                        )}
                        {book.permissions?.canApprove && (
                          <IconButton
                            size='small'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedBook(book);
                              setIsApproveDialogOpen(true);
                            }}
                            title='Approve'
                            color='success'
                          >
                            <ApproveIcon />
                          </IconButton>
                        )}
                        {book.permissions?.canReject && (
                          <IconButton
                            size='small'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setSelectedBook(book);
                              setIsRejectDialogOpen(true);
                            }}
                            title='Reject'
                            color='error'
                          >
                            <RejectIcon />
                          </IconButton>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Published Books Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant='h6' sx={{ p: 2 }}>
          Published Books ({publishedBooks.length})
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {publishedBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <Typography variant='body2' color='text.secondary'>
                      No published books yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                publishedBooks.map(book => (
                  <TableRow key={book.bookId}>
                    <TableCell>
                      <Typography variant='subtitle2'>{book.title}</Typography>
                      <Typography variant='body2' color='text.secondary' noWrap>
                        {book.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant='body2'>
                        Author ID: {book.authorId}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={book.genre} size='small' />
                    </TableCell>
                    <TableCell>{book.wordCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {book.publishedAt
                        ? new Date(book.publishedAt).toLocaleDateString()
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewBook(book);
                          }}
                          title='View Book'
                          color='primary'
                        >
                          <ViewIcon />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Book Dialog */}
      <Dialog
        open={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Review Book: {selectedBook?.title}</DialogTitle>
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : selectedBook ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant='h6' gutterBottom>
                Book Details
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary'>
                    Genre: <Chip label={selectedBook.genre} size='small' />
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary'>
                    Word Count: {selectedBook.wordCount.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant='body2' color='text.secondary'>
                    Tags: {selectedBook.tags.join(', ')}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant='h6' gutterBottom>
                Description
              </Typography>
              <Typography variant='body1' paragraph>
                {selectedBook.description}
              </Typography>

              <Typography variant='h6' gutterBottom>
                Content Preview
              </Typography>
              <Paper
                sx={{
                  p: 2,
                  bgcolor: 'grey.50',
                  maxHeight: 300,
                  overflow: 'auto',
                }}
              >
                <Typography variant='body2' style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedBook.content.substring(0, 1000)}
                  {selectedBook.content.length > 1000 && '...'}
                </Typography>
              </Paper>

              {/* Workflow History */}
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant='h6'>Workflow History</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {workflow && workflow.length > 0 ? (
                    <Box>
                      {workflow.map((entry, index) => (
                        <Box
                          key={index}
                          sx={{
                            mb: 2,
                            p: 2,
                            bgcolor: 'grey.50',
                            borderRadius: 1,
                          }}
                        >
                          <Typography variant='body2'>
                            <strong>{entry.action}</strong> by {entry.actionBy}
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {entry.fromState} → {entry.toState}
                          </Typography>
                          <Typography variant='body2' color='text.secondary'>
                            {new Date(entry.timestamp).toLocaleString()}
                          </Typography>
                          {entry.comments && (
                            <Typography variant='body2' sx={{ mt: 1 }}>
                              Comments: {entry.comments}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant='body2' color='text.secondary'>
                      No workflow history available
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          ) : (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant='body2' color='text.secondary'>
                No book selected or book data unavailable
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          {selectedBook?.permissions?.canApprove && (
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                setIsApproveDialogOpen(true);
              }}
              variant='contained'
              color='success'
            >
              Approve
            </Button>
          )}
          {selectedBook?.permissions?.canReject && (
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                setIsRejectDialogOpen(true);
              }}
              variant='contained'
              color='error'
            >
              Reject
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Approve Book Dialog */}
      <Dialog
        open={isApproveDialogOpen}
        onClose={() => setIsApproveDialogOpen(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Approve Book</DialogTitle>
        <DialogContent>
          <Typography variant='body1' gutterBottom>
            Are you sure you want to approve "{selectedBook?.title}"?
          </Typography>
          <TextField
            fullWidth
            label='Comments (optional)'
            multiline
            rows={3}
            value={comments}
            onChange={e => setComments(e.target.value)}
            margin='normal'
            placeholder='Add any feedback or notes for the author...'
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleApproveBook}
            variant='contained'
            color='success'
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Approve'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Book Dialog */}
      <Dialog
        open={isRejectDialogOpen}
        onClose={() => setIsRejectDialogOpen(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Reject Book</DialogTitle>
        <DialogContent>
          <Typography variant='body1' gutterBottom>
            Please provide feedback for rejecting "{selectedBook?.title}":
          </Typography>
          <TextField
            fullWidth
            label='Rejection Comments *'
            multiline
            rows={4}
            value={comments}
            onChange={e => setComments(e.target.value)}
            margin='normal'
            required
            placeholder='Explain what needs to be improved...'
            error={!comments.trim()}
            helperText={
              !comments.trim() ? 'Comments are required for rejection' : ''
            }
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleRejectBook}
            variant='contained'
            color='error'
            disabled={isLoading || !comments.trim()}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Book Dialog */}
      <Dialog
        open={isEditDialogOpen}
        onClose={() => setIsEditDialogOpen(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Edit Book</DialogTitle>
        <form onSubmit={handleSubmit(handleUpdateBook)}>
          <DialogContent>
            <TextField
              {...register('title')}
              label='Title'
              fullWidth
              margin='normal'
              error={!!errors.title}
              helperText={errors.title?.message}
            />
            <TextField
              {...register('description')}
              label='Description'
              fullWidth
              multiline
              rows={3}
              margin='normal'
              error={!!errors.description}
              helperText={errors.description?.message}
            />
            <FormControl fullWidth margin='normal'>
              <InputLabel>Genre</InputLabel>
              <Select
                {...register('genre')}
                label='Genre'
                error={!!errors.genre}
              >
                <MenuItem value='fiction'>Fiction</MenuItem>
                <MenuItem value='non-fiction'>Non-Fiction</MenuItem>
                <MenuItem value='mystery'>Mystery</MenuItem>
                <MenuItem value='romance'>Romance</MenuItem>
                <MenuItem value='science-fiction'>Science Fiction</MenuItem>
                <MenuItem value='fantasy'>Fantasy</MenuItem>
              </Select>
            </FormControl>
            <TextField
              {...register('tags')}
              label='Tags (comma-separated)'
              fullWidth
              margin='normal'
              placeholder='e.g., adventure, young adult, bestseller'
            />
            <TextField
              {...register('content')}
              label='Content'
              fullWidth
              multiline
              rows={10}
              margin='normal'
              error={!!errors.content}
              helperText={errors.content?.message}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button type='submit' variant='contained'>
              Update Book
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
};

export default EditorDashboard;
