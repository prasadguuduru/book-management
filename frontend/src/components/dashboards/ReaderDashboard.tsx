import React, { useEffect, useState } from 'react'
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
  Rating,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Divider,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  RateReview as ReviewIcon,
  Star as StarIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'

import { useBookStore } from '@/store/bookStore'
import { useReviewStore } from '@/store/reviewStore'
import { useAuthStore } from '@/store/authStore'
import { Book, CreateReviewRequest } from '@/types'

const reviewSchema = yup.object({
  rating: yup
    .number()
    .required('Rating is required')
    .min(1, 'Rating must be at least 1')
    .max(5, 'Rating must be at most 5'),
  comment: yup
    .string()
    .required('Comment is required')
    .min(10, 'Comment must be at least 10 characters')
    .max(1000, 'Comment must be less than 1000 characters'),
})

type ReviewFormData = yup.InferType<typeof reviewSchema>

const ReaderDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const { 
    books, 
    isLoading: booksLoading, 
    error: booksError, 
    fetchBooks, 
    setCurrentBook
  } = useBookStore()

  const {
    reviews,
    isLoading: reviewsLoading,
    error: reviewsError,
    fetchBookReviews,
    createReview,
    clearError: clearReviewsError
  } = useReviewStore()

  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState(false)
  const [genreFilter, setGenreFilter] = useState<string>('')
  const [ratingValue, setRatingValue] = useState<number>(5)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ReviewFormData>({
    resolver: yupResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      comment: ''
    }
  })

  useEffect(() => {
    // Fetch published books
    fetchBooks('PUBLISHED')
  }, [fetchBooks])

  const handleViewBook = (book: Book) => {
    setSelectedBook(book)
    setCurrentBook(book)
    fetchBookReviews(book.bookId)
    setIsViewDialogOpen(true)
  }

  const handleCreateReview = async (data: ReviewFormData) => {
    if (!selectedBook) return

    try {
      clearReviewsError()
      const reviewData: CreateReviewRequest = {
        bookId: selectedBook.bookId,
        rating: data.rating as 1 | 2 | 3 | 4 | 5,
        comment: data.comment
      }
      
      await createReview(reviewData)
      toast.success('Review submitted successfully!')
      setIsReviewDialogOpen(false)
      reset()
      setRatingValue(5)
      // Refresh reviews
      fetchBookReviews(selectedBook.bookId)
    } catch (error) {
      toast.error('Failed to submit review')
    }
  }

  const openReviewDialog = (book: Book) => {
    setSelectedBook(book)
    setRatingValue(5)
    setValue('rating', 5)
    setIsReviewDialogOpen(true)
  }

  const publishedBooks = books.filter(book => book.status === 'PUBLISHED')
  const filteredBooks = genreFilter 
    ? publishedBooks.filter(book => book.genre === genreFilter)
    : publishedBooks

  const genres = Array.from(new Set(publishedBooks.map(book => book.genre)))

  // Calculate average rating for a book
  const getAverageRating = (bookId: string) => {
    const bookReviews = reviews.filter(review => review.bookId === bookId)
    if (bookReviews.length === 0) return 0
    const sum = bookReviews.reduce((acc, review) => acc + review.rating, 0)
    return sum / bookReviews.length
  }

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Reader Dashboard
      </Typography>

      {(booksError || reviewsError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {booksError || reviewsError}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Available Books
              </Typography>
              <Typography variant="h4">
                {publishedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Genres
              </Typography>
              <Typography variant="h4">
                {genres.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                My Reviews
              </Typography>
              <Typography variant="h4">
                {reviews.filter(review => review.userId === user?.userId).length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Reading List
              </Typography>
              <Typography variant="h4">
                {filteredBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filter Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small">
              <InputLabel>Filter by Genre</InputLabel>
              <Select
                value={genreFilter}
                onChange={(e) => setGenreFilter(e.target.value)}
                label="Filter by Genre"
              >
                <MenuItem value="">All Genres</MenuItem>
                {genres.map((genre) => (
                  <MenuItem key={genre} value={genre}>
                    {genre.charAt(0).toUpperCase() + genre.slice(1).replace('-', ' ')}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <Typography variant="body2" color="text.secondary">
              Showing {filteredBooks.length} of {publishedBooks.length} books
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Books Library */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="h6" sx={{ p: 2 }}>
          Published Books Library
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Author</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Rating</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {booksLoading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : filteredBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography variant="body2" color="text.secondary">
                      {genreFilter 
                        ? `No books found in the ${genreFilter} genre.`
                        : 'No published books available yet.'
                      }
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredBooks.map((book) => {
                  const avgRating = getAverageRating(book.bookId)
                  const reviewCount = reviews.filter(r => r.bookId === book.bookId).length
                  
                  return (
                    <TableRow key={book.bookId}>
                      <TableCell>
                        <Typography variant="subtitle2">
                          {book.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          {book.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          Author ID: {book.authorId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={book.genre} size="small" />
                      </TableCell>
                      <TableCell>{book.wordCount.toLocaleString()}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Rating value={avgRating} readOnly size="small" />
                          <Typography variant="body2" color="text.secondary">
                            ({reviewCount})
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        {book.publishedAt ? new Date(book.publishedAt).toLocaleDateString() : 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton
                            size="small"
                            onClick={() => handleViewBook(book)}
                            title="Read Book"
                            color="primary"
                          >
                            <ViewIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => openReviewDialog(book)}
                            title="Write Review"
                            color="secondary"
                          >
                            <ReviewIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* View Book Dialog */}
      <Dialog 
        open={isViewDialogOpen} 
        onClose={() => setIsViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Reading: {selectedBook?.title}</DialogTitle>
        <DialogContent>
          {selectedBook && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Book Information
              </Typography>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Genre: <Chip label={selectedBook.genre} size="small" />
                  </Typography>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="body2" color="text.secondary">
                    Word Count: {selectedBook.wordCount.toLocaleString()}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Tags: {selectedBook.tags.join(', ')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    Published: {selectedBook.publishedAt ? new Date(selectedBook.publishedAt).toLocaleString() : 'N/A'}
                  </Typography>
                </Grid>
              </Grid>

              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedBook.description}
              </Typography>

              <Typography variant="h6" gutterBottom>
                Book Content
              </Typography>
              <Paper sx={{ p: 3, bgcolor: 'grey.50', maxHeight: 400, overflow: 'auto' }}>
                <Typography variant="body1" style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {selectedBook.content}
                </Typography>
              </Paper>

              {/* Reviews Section */}
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">
                    Reader Reviews ({reviews.filter(r => r.bookId === selectedBook.bookId).length})
                  </Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {reviews.filter(r => r.bookId === selectedBook.bookId).length > 0 ? (
                    <Box>
                      {reviews
                        .filter(r => r.bookId === selectedBook.bookId)
                        .map((review, index) => (
                          <Box key={review.reviewId}>
                            <Box sx={{ mb: 2 }}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                <Rating value={review.rating} readOnly size="small" />
                                <Typography variant="body2" color="text.secondary">
                                  by User {review.userId} • {new Date(review.createdAt).toLocaleDateString()}
                                </Typography>
                              </Box>
                              <Typography variant="body2">
                                {review.comment}
                              </Typography>
                              {review.helpful > 0 && (
                                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                                  {review.helpful} people found this helpful
                                </Typography>
                              )}
                            </Box>
                            {index < reviews.filter(r => r.bookId === selectedBook.bookId).length - 1 && (
                              <Divider sx={{ my: 2 }} />
                            )}
                          </Box>
                        ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No reviews yet. Be the first to review this book!
                    </Typography>
                  )}
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsViewDialogOpen(false)}>Close</Button>
          <Button 
            onClick={() => {
              setIsViewDialogOpen(false)
              openReviewDialog(selectedBook!)
            }}
            variant="contained"
            startIcon={<ReviewIcon />}
          >
            Write Review
          </Button>
        </DialogActions>
      </Dialog>

      {/* Write Review Dialog */}
      <Dialog 
        open={isReviewDialogOpen} 
        onClose={() => setIsReviewDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Write a Review for "{selectedBook?.title}"</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <Typography variant="body2" gutterBottom>
              Your Rating *
            </Typography>
            <Rating
              value={ratingValue}
              onChange={(_, newValue) => {
                if (newValue) {
                  setRatingValue(newValue)
                  setValue('rating', newValue)
                }
              }}
              size="large"
              sx={{ mb: 2 }}
            />
            
            <TextField
              {...register('comment')}
              fullWidth
              label="Your Review *"
              multiline
              rows={4}
              error={!!errors.comment}
              helperText={errors.comment?.message || 'Share your thoughts about this book'}
              margin="normal"
              placeholder="What did you think of this book? How was the story, characters, writing style?"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsReviewDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit(handleCreateReview)}
            variant="contained"
            disabled={reviewsLoading}
            startIcon={<StarIcon />}
          >
            {reviewsLoading ? <CircularProgress size={20} /> : 'Submit Review'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default ReaderDashboard