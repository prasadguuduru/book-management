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
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import { useBookStore } from '@/store/bookStore';
import { useAuthStore } from '@/store/authStore';
import { Book, CreateBookRequest, UpdateBookRequest } from '@/types';
import {
  WorkflowStatusIndicator,
  WorkflowProgressTracker,
  WorkflowActionButton,
  WorkflowHistory,
} from '@/components/workflow';

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

const AuthorDashboard: React.FC = () => {
  const { user } = useAuthStore();
  const {
    books,
    userCapabilities,
    workflow,
    isLoading,
    error,
    fetchBooks,
    fetchMyBooks,
    createBook,
    updateBook,
    deleteBook,
    submitBookForEditing,
    fetchBookWorkflow,
    setCurrentBook,
    clearError,
  } = useBookStore();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);

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
    // Fetch only the current user's books
    fetchMyBooks();
  }, []); // Empty dependency array - fetchMyBooks is stable from Zustand

  const getStatusColor = (status: Book['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'default';
      case 'SUBMITTED_FOR_EDITING':
        return 'warning';
      case 'READY_FOR_PUBLICATION':
        return 'info';
      case 'PUBLISHED':
        return 'success';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: Book['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'Draft';
      case 'SUBMITTED_FOR_EDITING':
        return 'Under Review';
      case 'READY_FOR_PUBLICATION':
        return 'Ready to Publish';
      case 'PUBLISHED':
        return 'Published';
      default:
        return status;
    }
  };

  const handleCreateBook = async (data: BookFormData) => {
    try {
      clearError();
      const bookData: CreateBookRequest = {
        title: data.title,
        description: data.description,
        content: data.content,
        genre: data.genre as Book['genre'],
        tags: data.tags
          .split(',')
          .map(tag => tag.trim())
          .filter(Boolean),
      };

      await createBook(bookData);
      toast.success('Book created successfully!');
      setIsCreateDialogOpen(false);
      reset();
      // Refresh the book list to show new book
      fetchMyBooks();
    } catch (error) {
      toast.error('Failed to create book');
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
      fetchMyBooks();
    } catch (error) {
      toast.error('Failed to update book');
    }
  };

  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) {
      return;
    }

    try {
      await deleteBook(bookId);
      toast.success('Book deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete book');
    }
  };

  const handleSubmitForEditing = async (bookId: string, comments?: string) => {
    try {
      const result = await submitBookForEditing(bookId);
      if (result) {
        toast.success('Book submitted for editing!');
        // Refresh the book list to show updated status
        fetchMyBooks();
      }
    } catch (error) {
      throw error; // Let WorkflowActionButton handle the error display
    }
  };

  const handleViewBook = (book: Book) => {
    setSelectedBook(book);
    fetchBookWorkflow(book.bookId);
    setIsViewDialogOpen(true);
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

  // Debug logging
  console.log('📚 All books:', JSON.stringify(books, null, 2));
  console.log('👤 Current user:', JSON.stringify(user, null, 2));
  console.log('🔐 User capabilities:', JSON.stringify(userCapabilities, null, 2));

  // Use books directly since backend already filters by user role and permissions
  // Filter out any undefined/null books to prevent runtime errors
  const authorBooks = (books || []).filter(book => book != null);

  console.log('📚 Author books:', JSON.stringify(authorBooks, null, 2));
  const draftBooks = authorBooks.filter(book => book.status === 'DRAFT');
  const submittedBooks = authorBooks.filter(
    book => book.status === 'SUBMITTED_FOR_EDITING'
  );
  const publishedBooks = authorBooks.filter(
    book => book.status === 'PUBLISHED'
  );

  return (
    <Box sx={{ py: 4, px: 3, backgroundColor: '#fafafa', minHeight: '100vh' }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 4,
          p: 3,
          backgroundColor: 'white',
          borderRadius: 2,
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <Box>
          <Typography variant='h4' component='h1' sx={{ fontWeight: 600, color: '#1a1a1a' }}>
            Author Dashboard
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
            Manage your books and track their publishing progress
          </Typography>
        </Box>
        {/* Show Create Book button based on user capabilities with fallback */}
        {(() => {
          const shouldShow = userCapabilities?.canCreateBooks || (user?.role === 'AUTHOR');
          console.log('🔍 Create Book Button Debug:', {
            userCapabilities,
            canCreateBooks: userCapabilities?.canCreateBooks,
            userRole: user?.role,
            shouldShow
          });
          return shouldShow;
        })() && (
            <Button
              variant='contained'
              startIcon={<AddIcon />}
              onClick={() => setIsCreateDialogOpen(true)}
              sx={{
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 600,
                px: 3,
                py: 1.5,
                backgroundColor: '#2563eb',
                '&:hover': {
                  backgroundColor: '#1d4ed8',
                },
              }}
            >
              Create New Book
            </Button>
          )}
      </Box>

      {error && (
        <Alert severity='error' sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            '&:hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500, mb: 1 }}>
                Total Books
              </Typography>
              <Typography variant='h3' sx={{ fontWeight: 700, color: '#1a1a1a' }}>
                {authorBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            '&:hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500, mb: 1 }}>
                Drafts
              </Typography>
              <Typography variant='h3' sx={{ fontWeight: 700, color: '#f59e0b' }}>
                {draftBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            '&:hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500, mb: 1 }}>
                Under Review
              </Typography>
              <Typography variant='h3' sx={{ fontWeight: 700, color: '#3b82f6' }}>
                {submittedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            borderRadius: 2,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            border: '1px solid #e5e7eb',
            '&:hover': { boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }
          }}>
            <CardContent sx={{ p: 3 }}>
              <Typography variant='body2' color='text.secondary' sx={{ fontWeight: 500, mb: 1 }}>
                Published
              </Typography>
              <Typography variant='h3' sx={{ fontWeight: 700, color: '#10b981' }}>
                {publishedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Books Table */}
      <Paper sx={{
        width: '100%',
        overflow: 'hidden',
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        border: '1px solid #e5e7eb'
      }}>
        <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
          <Typography variant='h6' sx={{ fontWeight: 600, color: '#1a1a1a' }}>
            My Books
          </Typography>
          <Typography variant='body2' color='text.secondary' sx={{ mt: 0.5 }}>
            {authorBooks.length} {authorBooks.length === 1 ? 'book' : 'books'} total
          </Typography>
        </Box>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Genre</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Word Count</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Last Updated</TableCell>
                <TableCell sx={{ fontWeight: 600, color: '#374151' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : authorBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <Typography variant='body2' color='text.secondary'>
                      No books found. Create your first book to get started!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                authorBooks.map(book => (
                  <TableRow
                    key={book.bookId}
                    sx={{
                      '&:hover': { backgroundColor: '#f9fafb' },
                      borderBottom: '1px solid #f3f4f6'
                    }}
                  >
                    <TableCell sx={{ py: 2 }}>
                      <Typography variant='subtitle2' sx={{ fontWeight: 600, color: '#1a1a1a' }}>
                        {book.title}
                      </Typography>
                      <Typography variant='body2' color='text.secondary' noWrap sx={{ mt: 0.5 }}>
                        {book.description}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={book.genre}
                        size='small'
                        sx={{
                          backgroundColor: '#f3f4f6',
                          color: '#374151',
                          fontWeight: 500,
                          textTransform: 'capitalize'
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <WorkflowStatusIndicator
                        status={book.status}
                        size="small"
                      />
                    </TableCell>
                    <TableCell sx={{ color: '#374151', fontWeight: 500 }}>
                      {book.wordCount.toLocaleString()}
                    </TableCell>
                    <TableCell sx={{ color: '#6b7280' }}>
                      {new Date(book.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <IconButton
                          size='small'
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleViewBook(book);
                          }}
                          title='View'
                          sx={{
                            color: '#6b7280',
                            '&:hover': { backgroundColor: '#f3f4f6', color: '#374151' }
                          }}
                        >
                          <ViewIcon fontSize='small' />
                        </IconButton>
                        {/* Show edit button for author's own books - fallback when permissions missing */}
                        {(book.permissions?.canEdit || (user?.role === 'AUTHOR' && book.authorId === user?.userId)) && (
                          <IconButton
                            size='small'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              openEditDialog(book);
                            }}
                            title='Edit'
                            sx={{
                              color: '#6b7280',
                              '&:hover': { backgroundColor: '#f3f4f6', color: '#3b82f6' }
                            }}
                          >
                            <EditIcon fontSize='small' />
                          </IconButton>
                        )}
                        {/* Show delete button for author's own draft books - fallback when permissions missing */}
                        {(book.permissions?.canDelete || (user?.role === 'AUTHOR' && book.authorId === user?.userId && book.status === 'DRAFT')) && (
                          <IconButton
                            size='small'
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteBook(book.bookId);
                            }}
                            title='Delete'
                            sx={{
                              color: '#6b7280',
                              '&:hover': { backgroundColor: '#fef2f2', color: '#ef4444' }
                            }}
                          >
                            <DeleteIcon fontSize='small' />
                          </IconButton>
                        )}
                        {/* Show submit button only for draft books */}
                        {book.status === 'DRAFT' && (book.permissions?.canSubmit || (user?.role === 'AUTHOR' && book.authorId === user?.userId)) && (
                          <WorkflowActionButton
                            action="submit"
                            book={book}
                            onAction={handleSubmitForEditing}
                            variant="icon"
                            size="small"
                          />
                        )}
                        {book.status === 'SUBMITTED_FOR_EDITING' && (
                          <Typography
                            variant='caption'
                            sx={{
                              color: '#6b7280',
                              fontStyle: 'italic',
                              px: 1
                            }}
                          >
                            Under review by editor
                          </Typography>
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

      {/* Create Book Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Create New Book</DialogTitle>
        <DialogContent>
          <Box component='form' sx={{ mt: 2 }}>
            <TextField
              {...register('title')}
              fullWidth
              label='Title'
              error={!!errors.title}
              helperText={errors.title?.message}
              margin='normal'
            />
            <TextField
              {...register('description')}
              fullWidth
              label='Description'
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
              margin='normal'
            />
            <FormControl fullWidth margin='normal' error={!!errors.genre}>
              <InputLabel>Genre</InputLabel>
              <Select {...register('genre')} label='Genre'>
                <MenuItem value='fiction'>Fiction</MenuItem>
                <MenuItem value='non-fiction'>Non-Fiction</MenuItem>
                <MenuItem value='science-fiction'>Science Fiction</MenuItem>
                <MenuItem value='mystery'>Mystery</MenuItem>
                <MenuItem value='romance'>Romance</MenuItem>
                <MenuItem value='fantasy'>Fantasy</MenuItem>
              </Select>
            </FormControl>
            <TextField
              {...register('tags')}
              fullWidth
              label='Tags (comma-separated)'
              error={!!errors.tags}
              helperText={
                errors.tags?.message || 'Enter tags separated by commas'
              }
              margin='normal'
            />
            <TextField
              {...register('content')}
              fullWidth
              label='Content'
              multiline
              rows={10}
              error={!!errors.content}
              helperText={errors.content?.message}
              margin='normal'
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit(handleCreateBook)}
            variant='contained'
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Create Book'}
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
        <DialogContent>
          <Box component='form' sx={{ mt: 2 }}>
            <TextField
              {...register('title')}
              fullWidth
              label='Title'
              error={!!errors.title}
              helperText={errors.title?.message}
              margin='normal'
            />
            <TextField
              {...register('description')}
              fullWidth
              label='Description'
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
              margin='normal'
            />
            <FormControl fullWidth margin='normal' error={!!errors.genre}>
              <InputLabel>Genre</InputLabel>
              <Select {...register('genre')} label='Genre'>
                <MenuItem value='fiction'>Fiction</MenuItem>
                <MenuItem value='non-fiction'>Non-Fiction</MenuItem>
                <MenuItem value='science-fiction'>Science Fiction</MenuItem>
                <MenuItem value='mystery'>Mystery</MenuItem>
                <MenuItem value='romance'>Romance</MenuItem>
                <MenuItem value='fantasy'>Fantasy</MenuItem>
              </Select>
            </FormControl>
            <TextField
              {...register('tags')}
              fullWidth
              label='Tags (comma-separated)'
              error={!!errors.tags}
              helperText={
                errors.tags?.message || 'Enter tags separated by commas'
              }
              margin='normal'
            />
            <TextField
              {...register('content')}
              fullWidth
              label='Content'
              multiline
              rows={10}
              error={!!errors.content}
              helperText={errors.content?.message}
              margin='normal'
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleSubmit(handleUpdateBook)}
            variant='contained'
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Update Book'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Book Dialog */}
      <Dialog
        open={isViewDialogOpen}
        onClose={() => setIsViewDialogOpen(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Book Details: {selectedBook?.title}</DialogTitle>
        <DialogContent>
          {selectedBook && (
            <Box sx={{ mt: 2 }}>
              {/* Workflow Progress Section */}
              <Box sx={{ mb: 4 }}>
                <Typography variant='h6' gutterBottom>
                  Publishing Progress
                </Typography>
                <WorkflowProgressTracker
                  currentStatus={selectedBook.status}
                  workflowHistory={workflow}
                  showDetails
                />
              </Box>

              <Typography variant='h6' gutterBottom>
                Book Information
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary'>
                    Status:{' '}
                    <WorkflowStatusIndicator
                      status={selectedBook.status}
                      variant="detailed"
                      showProgress
                    />
                  </Typography>
                </Grid>
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
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary'>
                    Version: {selectedBook.version}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant='body2' color='text.secondary'>
                    Tags: {selectedBook.tags.join(', ')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant='body2' color='text.secondary'>
                    Created: {new Date(selectedBook.createdAt).toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant='body2' color='text.secondary'>
                    Last Updated: {new Date(selectedBook.updatedAt).toLocaleString()}
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
                  <WorkflowHistory workflowHistory={workflow} compact />
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          {selectedBook?.status === 'DRAFT' && (
            <Button
              onClick={() => {
                setIsViewDialogOpen(false);
                openEditDialog(selectedBook);
              }}
              variant='contained'
              startIcon={<EditIcon />}
            >
              Edit
            </Button>
          )}
          {selectedBook?.status === 'DRAFT' && (selectedBook.permissions?.canSubmit || (user?.role === 'AUTHOR' && selectedBook.authorId === user?.userId)) && (
            <WorkflowActionButton
              action="submit"
              book={selectedBook}
              onAction={handleSubmitForEditing}
              variant="button"
              size="medium"
            />
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default AuthorDashboard;
