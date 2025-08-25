import React from 'react'
import { Typography, Box, Button, Grid, Card, CardContent } from '@mui/material'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

const HomePage: React.FC = () => {
  const { isAuthenticated } = useAuthStore()

  return (
    <Box sx={{ py: 8 }}>
      <Box textAlign="center" mb={6}>
        <Typography variant="h2" component="h1" gutterBottom>
          Welcome to Ebook Platform
        </Typography>
        <Typography variant="h5" color="text.secondary" paragraph>
          A comprehensive publishing platform for authors, editors, publishers, and readers
        </Typography>
        
        {!isAuthenticated && (
          <Box sx={{ mt: 4 }}>
            <Button
              variant="contained"
              size="large"
              component={Link}
              to="/register"
              sx={{ mr: 2 }}
            >
              Get Started
            </Button>
            <Button
              variant="outlined"
              size="large"
              component={Link}
              to="/login"
            >
              Sign In
            </Button>
          </Box>
        )}
      </Box>

      <Grid container spacing={4}>
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Authors
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Create and manage your books through our comprehensive writing and publishing workflow.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Editors
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Review and provide feedback on submitted manuscripts with powerful editing tools.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Publishers
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Manage the final publication process and oversee the entire publishing pipeline.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={3}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Readers
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Discover, read, and review published books from our growing library.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default HomePage