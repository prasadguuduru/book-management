import React from 'react'
import { Typography, Box, Grid, Card, CardContent, Button } from '@mui/material'
import { useAuthStore } from '@/store/authStore'

const DashboardPage: React.FC = () => {
  const { user } = useAuthStore()

  const getRoleSpecificContent = () => {
    switch (user?.role) {
      case 'AUTHOR':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    My Books
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Manage your books and track their progress through the publishing workflow.
                  </Typography>
                  <Button variant="contained" size="small">
                    View Books
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Create New Book
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Start writing your next masterpiece.
                  </Typography>
                  <Button variant="outlined" size="small">
                    New Book
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      
      case 'EDITOR':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Pending Reviews
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Books waiting for your editorial review.
                  </Typography>
                  <Button variant="contained" size="small">
                    Review Queue
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    My Assignments
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Books currently assigned to you for editing.
                  </Typography>
                  <Button variant="outlined" size="small">
                    View Assignments
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      
      case 'PUBLISHER':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Ready for Publication
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Books approved by editors and ready for publication.
                  </Typography>
                  <Button variant="contained" size="small">
                    Publication Queue
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Analytics
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    View publishing metrics and performance data.
                  </Typography>
                  <Button variant="outlined" size="small">
                    View Analytics
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      
      case 'READER':
        return (
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Browse Books
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Discover new books in our library.
                  </Typography>
                  <Button variant="contained" size="small">
                    Browse Library
                  </Button>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    My Reviews
                  </Typography>
                  <Typography variant="body2" color="text.secondary" paragraph>
                    Manage your book reviews and ratings.
                  </Typography>
                  <Button variant="outlined" size="small">
                    My Reviews
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )
      
      default:
        return (
          <Typography variant="body1">
            Welcome to your dashboard!
          </Typography>
        )
    }
  }

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Welcome back, {user?.firstName}!
      </Typography>
      
      <Typography variant="h6" color="text.secondary" gutterBottom>
        Role: {user?.role}
      </Typography>

      <Box sx={{ mt: 4 }}>
        {getRoleSpecificContent()}
      </Box>
    </Box>
  )
}

export default DashboardPage