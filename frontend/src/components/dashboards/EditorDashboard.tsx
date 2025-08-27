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
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'
import {
  Visibility as ViewIcon,
  Check as ApproveIcon,
  Close as RejectIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material'
import toast from 'react-hot-toast'

import { useBookStore } from '@/store/bookStore'

import { Book } from '@/types'

const EditorDashboard: React.FC = () => {
  const { 
    books, 
    workflow,
    isLoading, 
    error, 
    fetchBooks, 
    approveBook, 
    rejectBook,
    fetchBookWorkflow,
    setCurrentBook,
    clearError 
  } = useBookStore()

  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false)
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false)
  const [comments, setComments] = useState('')

  useEffect(() => {
    // Fetch books that are submitted for editing
    fetchBooks('SUBMITTED_FOR_EDITING')
  }, [fetchBooks])

  const handleViewBook = (book: Book) => {
    setSelectedBook(book)
    setCurrentBook(book)
    fetchBookWorkflow(book.bookId)
    setIsViewDialogOpen(true)
  }

  const handleApproveBook = async () => {
    if (!selectedBook) return

    try {
      clearError()
      await approveBook(selectedBook.bookId, comments)
      toast.success('Book approved successfully!')
      setIsApproveDialogOpen(false)
      setSelectedBook(null)
      setComments('')
      // Refresh the list
      fetchBooks('SUBMITTED_FOR_EDITING')
    } catch (error) {
      toast.error('Failed to approve book')
    }
  }

  const handleRejectBook = async () => {
    if (!selectedBook || !comments.trim()) {
      toast.error('Please provide comments for rejection')
      return
    }

    try {
      clearError()
      await rejectBook(selectedBook.bookId, comments)
      toast.success('Book rejected and returned to author')
      setIsRejectDialogOpen(false)
      setSelectedBook(null)
      setComments('')
      // Refresh the list
      fetchBooks('SUBMITTED_FOR_EDITING')
    } catch (error) {
      toast.error('Failed to reject book')
    }
  }

  const submittedBooks = books.filter(book => book.status === 'SUBMITTED_FOR_EDITING')
  const totalBooks = books.length

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Editor Dashboard
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Pending Reviews
              </Typography>
              <Typography variant="h4">
                {submittedBooks.length}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Total Submissions
              </Typography>
              <Typography variant="h4">
                {totalBooks}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" color="text.secondary">
                Review Queue
              </Typography>
              <Typography variant="h4" color={submittedBooks.length > 0 ? 'warning.main' : 'success.main'}>
                {submittedBooks.length > 0 ? 'Active' : 'Clear'}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Books Table */}
      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <Typography variant="h6" sx={{ p: 2 }}>
          Books Awaiting Review
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
                  <TableCell colSpan={6} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : submittedBooks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    <Typography variant="body2" color="text.secondary">
                      No books awaiting review. Great job keeping up with the queue!
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                submittedBooks.map((book) => (
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
                      {new Date(book.updatedAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewBook(book)}
                          title="View & Review"
                          color="primary"
                        >
                          <ViewIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedBook(book)
                            setIsApproveDialogOpen(true)
                          }}
                          title="Approve"
                          color="success"
                        >
                          <ApproveIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setSelectedBook(book)
                            setIsRejectDialogOpen(true)
                          }}
                          title="Reject"
                          color="error"
                        >
                          <RejectIcon />
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
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Review Book: {selectedBook?.title}</DialogTitle>
        <DialogContent>
          {selectedBook && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Book Details
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
              </Grid>

              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Typography variant="body1" paragraph>
                {selectedBook.description}
              </Typography>

              <Typography variant="h6" gutterBottom>
                Content Preview
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.50', maxHeight: 300, overflow: 'auto' }}>
                <Typography variant="body2" style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedBook.content.substring(0, 1000)}
                  {selectedBook.content.length > 1000 && '...'}
                </Typography>
              </Paper>

              {/* Workflow History */}
              <Accordion sx={{ mt: 3 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="h6">Workflow History</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {workflow.length > 0 ? (
                    <Box>
                      {workflow.map((entry, index) => (
                        <Box key={index} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                          <Typography variant="body2">
                            <strong>{entry.action}</strong> by {entry.actionBy}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {entry.fromState} → {entry.toState}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            {new Date(entry.timestamp).toLocaleString()}
                          </Typography>
                          {entry.comments && (
                            <Typography variant="body2" sx={{ mt: 1 }}>
                              Comments: {entry.comments}
                            </Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No workflow history available
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
              setIsApproveDialogOpen(true)
            }}
            variant="contained"
            color="success"
          >
            Approve
          </Button>
          <Button 
            onClick={() => {
              setIsViewDialogOpen(false)
              setIsRejectDialogOpen(true)
            }}
            variant="contained"
            color="error"
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approve Book Dialog */}
      <Dialog 
        open={isApproveDialogOpen} 
        onClose={() => setIsApproveDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Approve Book</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Are you sure you want to approve "{selectedBook?.title}"?
          </Typography>
          <TextField
            fullWidth
            label="Comments (optional)"
            multiline
            rows={3}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            margin="normal"
            placeholder="Add any feedback or notes for the author..."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsApproveDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleApproveBook}
            variant="contained"
            color="success"
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
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Book</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Please provide feedback for rejecting "{selectedBook?.title}":
          </Typography>
          <TextField
            fullWidth
            label="Rejection Comments *"
            multiline
            rows={4}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            margin="normal"
            required
            placeholder="Explain what needs to be improved..."
            error={!comments.trim()}
            helperText={!comments.trim() ? 'Comments are required for rejection' : ''}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIsRejectDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleRejectBook}
            variant="contained"
            color="error"
            disabled={isLoading || !comments.trim()}
          >
            {isLoading ? <CircularProgress size={20} /> : 'Reject'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default EditorDashboard