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
  Alert,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Send as SendIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'

import { useBookStore } from '@/store/bookStore'
import { useAuthStore } from '@/store/authStore'
import { Book, CreateBookRequest, UpdateBookRequest } from '@/types'

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
    .oneOf(['fiction', 'non-fiction', 'science-fiction', 'mystery', 'romance', 'fantasy']),
  tags: yup
    .string()
    .default('')
})

type BookFormData = yup.InferType<typeof bookSchema>

const AuthorDashboard: React.FC = () => {
  const { user } = useAuthStore()
  const { 
    books, 
    isLoading, 
    error, 
    fetchBooks, 
    createBook, 
    updateBook, 
    deleteBook,
    submitBookForEditing,
    setCurrentBook,
    clearError 
  } = useBookStore()

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BookFormData>({
    resolver: yupResolver(bookSchema),
  })

  useEffect(() => {
    // Fetch all books for the author
    fetchBooks()
  }, [fetchBooks])

  const getStatusColor = (status: Book['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'default'
      case 'SUBMITTED_FOR_EDITING':
        return 'warning'
      case 'READY_FOR_PUBLICATION':
        return 'info'
      case 'PUBLISHED':
        return 'success'
      default:
        return 'default'
    }
  }

  const getStatusLabel = (status: Book['status']) => {
    switch (status) {
      case 'DRAFT':
        return 'Draft'
      case 'SUBMITTED_FOR_EDITING':
        return 'Under Review'
      case 'READY_FOR_PUBLICATION':
        return 'Ready to Publish'
      case 'PUBLISHED':
        return 'Published'
      default:
        return status
    }
  }

  const handleCreateBook = async (data: BookFormData) => {
    try {
      clearError()
      const bookData: CreateBookRequest = {
        title: data.title,
        description: data.description,
        content: data.content,
        genre: data.genre as Book['genre'],
        tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }
      
      await createBook(bookData)
      toast.success('Book created successfully!')
      setIsCreateDialogOpen(false)
      reset()
    } catch (error) {
      toast.error('Failed to create book')
    }
  }

  const handleUpdateBook = async (data: BookFormData) => {
    if (!selectedBook) return

    try {
      clearError()
      const bookData: UpdateBookRequest = {
        bookId: selectedBook.bookId,
        version: selectedBook.version,
        title: data.title,
        description: data.description,
        content: data.content,
        genre: data.genre as Book['genre'],
        tags: data.tags.split(',').map(tag => tag.trim()).filter(Boolean)
      }
      
      await updateBook(bookData)
      toast.success('Book updated successfully!')
      setIsEditDialogOpen(false)
      setSelectedBook(null)
      reset()
    } catch (error) {
      toast.error('Failed to update book')
    }
  }

  const handleDeleteBook = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to delete this book?')) return

    try {
      await deleteBook(bookId)
      toast.success('Book deleted successfully!')
    } catch (error) {
      toast.error('Failed to delete book')
    }
  }

  const handleSubmitForEditing = async (bookId: string) => {
    if (!window.confirm('Are you sure you want to submit this book for editing?')) return

    try {
      await submitBookForEditing(bookId)
      toast.success('Book submitted for editing!')
    } catch (error) {
      toast.error('Failed to submit book')
    }
  }

  const openEditDialog = (book: Book) => {
    setSelectedBook(book)
    setValue('title', book.title)
    setValue('description', book.description)
    setValue('content', book.content)
    setValue('genre', book.genre)
    setValue('tags', book.tags.join(', '))
    setIsEditDialogOpen(true)
  }

  const authorBooks = books.filter(book => book.authorId === user?.userId)
  const draftBooks = authorBooks.filter(book => book.status === 'DRAFT')
  const submittedBooks = authorBooks.filter(book => book.status === 'SUBMITTED_FOR_EDITING')
  const publishedBooks = authorBooks.filter(book => book.status === 'PUBLISHED')

  return (
    <Box sx={{ py: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Author Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setIsCreateDialogOpen(true)}
        >
          Create New Book
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Total Books
              </Typography>
              <Typography variant="h4">
                {authorBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Drafts
              </Typography>
              <Typography variant="h4">
                {draftBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Under Review
              </Typography>
              <Typography variant="h4">
                {submittedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Published
              </Typography>
              <Typography variant="h4">
                {publishedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Books Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="h6" sx={{ p: 2 }}>
          My Books
        </Typography>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Genre</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Word Count</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : authorBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No books found. Create your first book to get started!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                authorBooks.map((book) => (
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
                      <Chip label={book.genre} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={getStatusLabel(book.status)} 
                        color={getStatusColor(book.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{book.wordCount.toLocaleString()}</TableCell>
                    <TableCell>
                      {new Date(book.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => setCurrentBook(book)}
                          title="View"
                        >
                          <ViewIcon />
                        </IconButton>
                        {book.status === 'DRAFT' && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => openEditDialog(book)}
                              title="Edit"
                            >
                              <EditIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleDeleteBook(book.bookId)}
                              title="Delete"
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleSubmitForEditing(book.bookId)}
                              title="Submit for Editing"
                              color="primary"
                            >
                              <SendIcon />
                            </IconButton>
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

      {/* Create Book Dialog */}
      <Dialog 
        open={isCreateDialogOpen} 
        onClose={() => setIsCreateDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Book</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              {...register('title')}
              fullWidth
              label="Title"
              error={!!errors.title}
              helperText={errors.title?.message}
              margin="normal"
            />
            <TextField
              {...register('description')}
              fullWidth
              label="Description"
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
              margin="normal"
            />
            <FormControl fullWidth margin="normal" error={!!errors.genre}>
              <InputLabel>Genre</InputLabel>
              <Select {...register('genre')} label="Genre">
                <MenuItem value="fiction">Fiction</MenuItem>
                <MenuItem value="non-fiction">Non-Fiction</MenuItem>
                <MenuItem value="science-fiction">Science Fiction</MenuItem>
                <MenuItem value="mystery">Mystery</MenuItem>
                <MenuItem value="romance">Romance</MenuItem>
                <MenuItem value="fantasy">Fantasy</MenuItem>
              </Select>
            </FormControl>
            <TextField
              {...register('tags')}
              fullWidth
              label="Tags (comma-separated)"
              error={!!errors.tags}
              helperText={errors.tags?.message || 'Enter tags separated by commas'}
              margin="normal"
            />
            <TextField
              {...register('content')}
              fullWidth
              label="Content"
              multiline
              rows={10}
              error={!!errors.content}
              helperText={errors.content?.message}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsCreateDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit(handleCreateBook)}
            variant="contained"
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
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Edit Book</DialogTitle>
        <DialogContent>
          <Box component="form" sx={{ mt: 2 }}>
            <TextField
              {...register('title')}
              fullWidth
              label="Title"
              error={!!errors.title}
              helperText={errors.title?.message}
              margin="normal"
            />
            <TextField
              {...register('description')}
              fullWidth
              label="Description"
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description?.message}
              margin="normal"
            />
            <FormControl fullWidth margin="normal" error={!!errors.genre}>
              <InputLabel>Genre</InputLabel>
              <Select {...register('genre')} label="Genre">
                <MenuItem value="fiction">Fiction</MenuItem>
                <MenuItem value="non-fiction">Non-Fiction</MenuItem>
                <MenuItem value="science-fiction">Science Fiction</MenuItem>
                <MenuItem value="mystery">Mystery</MenuItem>
                <MenuItem value="romance">Romance</MenuItem>
                <MenuItem value="fantasy">Fantasy</MenuItem>
              </Select>
            </FormControl>
            <TextField
              {...register('tags')}
              fullWidth
              label="Tags (comma-separated)"
              error={!!errors.tags}
              helperText={errors.tags?.message || 'Enter tags separated by commas'}
              margin="normal"
            />
            <TextField
              {...register('content')}
              fullWidth
              label="Content"
              multiline
              rows={10}
              error={!!errors.content}
              helperText={errors.content?.message}
              margin="normal"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleSubmit(handleUpdateBook)}
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Update Book'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default AuthorDashboard