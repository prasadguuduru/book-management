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
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Visibility as ViewIcon,
  Publish as PublishIcon,
  Analytics as AnalyticsIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import toast from 'react-hot-toast';

import { useBookStore } from '@/store/bookStore';
import { Book } from '@/types';
import {
  WorkflowStatusIndicator,
  WorkflowProgressTracker,
  WorkflowActionButton,
  WorkflowHistory,
} from '@/components/workflow';

const PublisherDashboard: React.FC = () => {
  const {
    books,
    userCapabilities,
    workflow,
    isLoading,
    error,
    fetchBooks,
    publishBook,
    fetchBookWorkflow,
    setCurrentBook,
    clearError,
  } = useBookStore();

  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  useEffect(() => {
    // Fetch books with role-based filtering (backend will return READY_FOR_PUBLICATION + PUBLISHED for publishers)
    fetchBooks();
  }, []); // Empty dependency array - fetchBooks is stable from Zustand

  const handleViewBook = (book: Book) => {
    console.log('📚 Publisher - Viewing book details:', {
      bookId: book.bookId,
      title: book.title,
      status: book.status,
      permissions: book.permissions
    });

    setSelectedBook(book);
    fetchBookWorkflow(book.bookId);
    setIsViewDialogOpen(true);
  };

  const handlePublishBook = async (bookId: string, comments?: string) => {
    try {
      const publishedBook = await publishBook(bookId);
      
      // Success message with notification context
      toast.success(
        `Book published successfully! Readers will be notified and can now access the book.`
      );

      // Refresh the list to show updated status
      fetchBooks();
    } catch (error) {
      throw error; // Let WorkflowActionButton handle the error display
    }
  };

  const readyBooks = books.filter(
    book => book.status === 'READY_FOR_PUBLICATION'
  );
  const publishedBooks = books.filter(book => book.status === 'PUBLISHED');
  const totalBooks = books.length;

  // Enhanced debug logging to understand what publisher receives
  console.log('📚 Publisher Dashboard - All books:', books);
  console.log('📚 Publisher Dashboard - Books length:', books?.length);
  console.log('📚 Publisher Dashboard - Books array type:', Array.isArray(books));
  console.log('📚 Publisher Dashboard - Ready books:', readyBooks);
  console.log('📚 Publisher Dashboard - Ready books length:', readyBooks?.length);
  console.log('📚 Publisher Dashboard - Published books:', publishedBooks);
  console.log('📚 Publisher Dashboard - Published books length:', publishedBooks?.length);
  console.log('🔐 Publisher capabilities:', userCapabilities);
  console.log('⚠️ Loading state:', isLoading);
  console.log('❌ Error state:', error);

  // Log each book's status and permissions for debugging
  if (books && books.length > 0) {
    console.log('📋 Book statuses:', books.map(book => ({
      id: book.bookId,
      title: book.title,
      status: book.status,
      permissions: book.permissions
    })));
  } else {
    console.log('⚠️ No books received from API or books array is empty');
  }

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant='h4' component='h1' gutterBottom>
        Publisher Dashboard
      </Typography>

      {error && (
        <Alert severity='error' sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{
            border: readyBooks.length > 0 ? '2px solid #f59e0b' : '1px solid #e5e7eb',
            backgroundColor: readyBooks.length > 0 ? '#fffbeb' : 'white'
          }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant='h6' color='text.secondary'>
                    Ready to Publish
                  </Typography>
                  <Typography variant='h4' color={readyBooks.length > 0 ? '#f59e0b' : 'inherit'}>
                    {readyBooks.length}
                  </Typography>
                </Box>
                {readyBooks.length > 0 && (
                  <Box sx={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: '#f59e0b',
                    animation: 'pulse 2s infinite'
                  }} />
                )}
              </Box>
              {readyBooks.length > 0 && (
                <Typography variant='body2' color='#f59e0b' sx={{ mt: 1, fontWeight: 500 }}>
                  📢 New books approved by editors
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant='h6' color='text.secondary'>
                Published Books
              </Typography>
              <Typography variant='h4'>{publishedBooks.length}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant='h6' color='text.secondary'>
                Total Books
              </Typography>
              <Typography variant='h4'>{totalBooks}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card
            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
          >
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AnalyticsIcon color='primary' />
                <Typography variant='h6' color='text.secondary'>
                  Analytics
                </Typography>
              </Box>
              <Typography variant='body2' color='text.secondary'>
                View detailed metrics
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Ready for Publication Section */}
      <Paper sx={{ width: '100%', overflow: 'hidden', mb: 4 }}>
        <Typography
          variant='h6'
          sx={{ p: 2, bgcolor: 'primary.main', color: 'white' }}
        >
          Books Ready for Publication
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Approved Date</TableCell>
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
              ) : readyBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align='center'>
                    <Box sx={{ py: 4 }}>
                      <Typography variant='body2' color='text.secondary' gutterBottom>
                        No books ready for publication at this time.
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        📢 You'll be notified when editors approve books for publication.
                      </Typography>
                      {publishedBooks.length > 0 && (
                        <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                          Check your published books below to see your publication history.
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ) : (
                readyBooks.map(book => (
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
                          title='View Book'
                          color='primary'
                        >
                          <ViewIcon />
                        </IconButton>
                        {/* Show publish button based on backend permissions */}
                        {book.permissions?.canPublish && (
                          <>
                            <WorkflowActionButton
                              action="publish"
                              book={book}
                              onAction={handlePublishBook}
                              variant="icon"
                              size="small"
                            />
                            <WorkflowActionButton
                              action="publish"
                              book={book}
                              onAction={handlePublishBook}
                              variant="button"
                              size="small"
                            />
                          </>
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

      {/* Published Books Section */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography
          variant='h6'
          sx={{ p: 2, bgcolor: 'success.main', color: 'white' }}
        >
          Published Books
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Published Date</TableCell>
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
        <DialogTitle>Book Details: {selectedBook?.title}</DialogTitle>
        <DialogContent>
          {selectedBook && (
            <Box sx={{ mt: 2 }}>
              <Typography variant='h6' gutterBottom>
                Book Information
              </Typography>

              {/* Publication Status Alert */}
              {selectedBook.status === 'READY_FOR_PUBLICATION' && (
                <Alert severity='info' sx={{ mb: 2 }}>
                  📢 This book has been approved by an editor and is ready for publication.
                  You should have received a notification about this approval.
                </Alert>
              )}
              {selectedBook.status === 'PUBLISHED' && (
                <Alert severity='success' sx={{ mb: 2 }}>
                  ✅ This book is published and available to readers.
                  Readers were notified when it was published.
                </Alert>
              )}

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant='body2' color='text.secondary'>
                    Status:{' '}
                    <Chip
                      label={selectedBook.status}
                      color={
                        selectedBook.status === 'PUBLISHED' ? 'success' :
                          selectedBook.status === 'READY_FOR_PUBLICATION' ? 'warning' : 'info'
                      }
                      size='small'
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
                {selectedBook.publishedAt && (
                  <Grid item xs={12}>
                    <Typography variant='body2' color='text.secondary'>
                      Published:{' '}
                      {new Date(selectedBook.publishedAt).toLocaleString()}
                    </Typography>
                  </Grid>
                )}
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

              {/* Workflow History */}
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant='h6'>Publication Workflow</Typography>
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
          {selectedBook?.permissions?.canPublish && (
            <WorkflowActionButton
              action="publish"
              book={selectedBook}
              onAction={handlePublishBook}
              variant="button"
              size="medium"
            />
          )}
        </DialogActions>
      </Dialog>


    </Box>
  );
};

export default PublisherDashboard;
