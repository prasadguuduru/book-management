import React from 'react';
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
} from '@mui/material';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import toast from 'react-hot-toast';

import { useAuthStore } from '@/store/authStore';
import { User } from '@/types';
import { mockApiService } from '@/services/mockApi';

const schema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

type LoginFormData = yup.InferType<typeof schema>;

const LoginPage: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(schema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      clearError();

      // Clear any existing auth state to force fresh login
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });

      await login(data.email, data.password);
      toast.success('Login successful with real JWT token!');
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Login error:', error);
      toast.error('Login failed. Please check your credentials.');
    }
  };

  // Quick login function for development - uses real authentication
  const handleQuickLogin = async (user: User) => {
    try {
      clearError();

      // Clear any existing auth state to force fresh login
      useAuthStore.setState({
        user: null,
        token: null,
        refreshToken: null,
        isAuthenticated: false,
        error: null,
      });

      // Use real login with predefined credentials
      // One user per role type for clean testing
      const credentials = {
        // Primary accounts (one per role)
        'author1@example.com': 'password123',  // Has 3 books (DRAFT, SUBMITTED, PUBLISHED)
        'editor1@example.com': 'password123',  // Can review submitted books
        'publisher1@example.com': 'password123', // Can publish approved books
        'reader1@example.com': 'password123',   // Can read and review published books
        // Fallback accounts
        'author@example.com': 'password123',
        'editor@example.com': 'password123',
        'publisher@example.com': 'password123',
        'reader@example.com': 'password123',
      };

      const password = credentials[user.email as keyof typeof credentials];

      if (!password) {
        toast.error('No credentials found for this user');
        return;
      }

      // Use the real login function from auth store
      await login(user.email, password);
      toast.success(`Logged in as ${user.firstName} (${user.role}) with real JWT token`);
      navigate(from, { replace: true });
    } catch (error) {
      console.error('Quick login error:', error);
      toast.error('Quick login failed. Please check your credentials.');
    }
  };

  const mockUsers = mockApiService.getMockUsers();
  const showQuickLogin =
    import.meta.env.VITE_ENVIRONMENT === 'local' ||
    import.meta.env.VITE_ENVIRONMENT === 'qa';

  // Debug logging
  console.log('Environment:', import.meta.env.VITE_ENVIRONMENT);
  console.log('Show Quick Login:', showQuickLogin);
  console.log('Mock Users:', mockUsers);
  console.log('Mock Users Length:', mockUsers.length);

  return (
    <Box sx={{ py: 4 }}>
      <Typography variant='h4' component='h1' gutterBottom textAlign='center'>
        Sign In to Ebook Platform
      </Typography>

      {error && (
        <Alert severity='error' sx={{ mb: 2, maxWidth: 600, mx: 'auto' }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={4} sx={{ maxWidth: 1200, mx: 'auto' }}>
        {/* Mock Login for Development */}
        {showQuickLogin && (
          <Grid item xs={12} md={8}>
            <Paper elevation={3} sx={{ p: 3 }}>
              <Typography variant='h5' gutterBottom>
                Quick Login (Development Mode)
              </Typography>
              <Typography variant='body2' color='text.secondary' paragraph>
                Select a role to quickly login with real authentication:
              </Typography>

              <Grid container spacing={2}>
                {mockUsers.map(user => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={user.userId}>
                    <Card
                      sx={{
                        cursor: 'pointer',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        '&:hover': {
                          bgcolor: 'action.hover',
                          transform: 'translateY(-2px)',
                          boxShadow: 3,
                        },
                        transition: 'all 0.2s ease-in-out',
                      }}
                      onClick={() => handleQuickLogin(user)}
                    >
                      <CardContent sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        minHeight: 180,
                      }}>
                        <Box>
                          <Typography variant='h6' gutterBottom sx={{ fontSize: '1.1rem' }}>
                            {user.firstName} {user.lastName}
                          </Typography>
                          <Typography variant='body2' color='text.secondary' gutterBottom>
                            Role: {user.role}
                          </Typography>
                          <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                            {user.email}
                          </Typography>

                          {/* Fixed height container for description */}
                          <Box sx={{ minHeight: 40, mb: 2 }}>
                            {user.email === 'author1@example.com' && (
                              <Typography variant='caption' color='primary' display='block'>
                                📚 Has 3 books (Draft, Submitted, Published)
                              </Typography>
                            )}
                            {user.email === 'author2@example.com' && (
                              <Typography variant='caption' color='primary' display='block'>
                                📚 Has 2 books (Draft, Ready to Publish)
                              </Typography>
                            )}
                            {user.email === 'editor1@example.com' && (
                              <Typography variant='caption' color='secondary' display='block'>
                                📝 Can review submitted books
                              </Typography>
                            )}
                            {user.email === 'publisher1@example.com' && (
                              <Typography variant='caption' color='secondary' display='block'>
                                🚀 Can publish approved books
                              </Typography>
                            )}
                          </Box>
                        </Box>

                        <Button
                          variant='outlined'
                          size='small'
                          fullWidth
                          disabled={isLoading}
                          onClick={e => {
                            e.stopPropagation();
                            handleQuickLogin(user);
                          }}
                          sx={{
                            mt: 'auto',
                            textTransform: 'none',
                            fontWeight: 500,
                          }}
                        >
                          {isLoading ? <CircularProgress size={16} /> : `Login as ${user.role}`}
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Traditional Login Form */}
        <Grid item xs={12} md={showQuickLogin ? 4 : 6} sx={{ mx: 'auto' }}>
          <Paper elevation={3} sx={{ p: 3 }}>
            <Typography variant='h5' gutterBottom>
              Traditional Login
            </Typography>

            <Box
              component='form'
              onSubmit={handleSubmit(onSubmit)}
              sx={{ mt: 2 }}
            >
              <TextField
                {...register('email')}
                fullWidth
                label='Email'
                type='email'
                error={!!errors.email}
                helperText={errors.email?.message}
                margin='normal'
                autoComplete='email'
              />

              <TextField
                {...register('password')}
                fullWidth
                label='Password'
                type='password'
                error={!!errors.password}
                helperText={errors.password?.message}
                margin='normal'
                autoComplete='current-password'
              />

              <Button
                type='submit'
                fullWidth
                variant='contained'
                sx={{ mt: 3, mb: 2 }}
                disabled={isLoading}
              >
                {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
              </Button>

              <Divider sx={{ my: 2 }} />

              <Box textAlign='center'>
                <Typography variant='body2'>
                  Don't have an account?{' '}
                  <MuiLink component={Link} to='/register'>
                    Sign up
                  </MuiLink>
                </Typography>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default LoginPage;
