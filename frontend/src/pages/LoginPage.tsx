import React from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link as MuiLink,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Grid,
} from '@mui/material'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'

import { useAuthStore, User } from '@/store/authStore'
import { mockApiService } from '@/services/mockApi'

const schema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
})

type LoginFormData = yup.InferType<typeof schema>

const LoginPage: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()


  const from = location.state?.from?.pathname || '/dashboard'

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError()
      await login(data.email, data.password)
      toast.success('Login successful!')
      navigate(from, { replace: true })
    } catch (error) {
      toast.error('Login failed. Please check your credentials.')
    }
  }

  // Mock login function for development
  const handleMockLogin = (user: User) => {
    try {
      clearError()
      
      // Simulate login by setting user data directly
      const mockAuthData = {
        user,
        accessToken: `mock-token-${user.userId}`,
        refreshToken: `mock-refresh-${user.userId}`
      }
      
      // Update auth store directly for mock login
      useAuthStore.setState({
        user: mockAuthData.user,
        token: mockAuthData.accessToken,
        refreshToken: mockAuthData.refreshToken,
        isAuthenticated: true,
        isLoading: false,
        error: null
      })
      
      toast.success(`Logged in as ${user.firstName} (${user.role})`)
      navigate(from, { replace: true })
    } catch (error) {
      toast.error('Mock login failed')
    }
  }

  const mockUsers = mockApiService.getMockUsers()

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom textAlign="center">
        Sign In to Ebook Platform
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4} sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Mock Login for Development */}
        <Grid item xs={12} md={8}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Quick Login (Development Mode)
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              Select a role to quickly test the application with mock data:
            </Typography>
            
            <Grid container spacing={2}>
              {mockUsers.map((user) => (
                <Grid item xs={12} sm={6} key={user.userId}>
                  <Card 
                    sx={{ 
                      cursor: 'pointer',
                      '&:hover': { bgcolor: 'action.hover' }
                    }}
                    onClick={() => handleMockLogin(user)}
                  >
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        {user.firstName} {user.lastName}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Role: {user.role}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Email: {user.email}
                      </Typography>
                      <Button 
                        variant="outlined" 
                        size="small" 
                        sx={{ mt: 1 }}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleMockLogin(user)
                        }}
                      >
                        Login as {user.role}
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>

        {/* Traditional Login Form */}
        <Grid item xs={12} md={4}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Traditional Login
            </Typography>

            <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
              <TextField
                {...register('email')}
                fullWidth
                label="Email"
                type="email"
                error={!!errors.email}
                helperText={errors.email?.message}
                margin="normal"
                autoComplete="email"
              />

              <TextField
                {...register('password')}
                fullWidth
                label="Password"
                type="password"
                error={!!errors.password}
                helperText={errors.password?.message}
                margin="normal"
                autoComplete="current-password"
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Box textAlign="center">
                <Typography variant="body2">
                  Don't have an account?{' '}
                  <MuiLink component={Link} to="/register">
                    Sign up
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

export default LoginPage