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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { Link, useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { yupResolver } from '@hookform/resolvers/yup'
import * as yup from 'yup'
import toast from 'react-hot-toast'

import { useAuthStore } from '@/store/authStore'

const schema = yup.object({
  firstName: yup
    .string()
    .required('First name is required')
    .min(2, 'First name must be at least 2 characters'),
  lastName: yup
    .string()
    .required('Last name is required')
    .min(2, 'Last name must be at least 2 characters'),
  email: yup
    .string()
    .email('Please enter a valid email')
    .required('Email is required'),
  password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    )
    .required('Password is required'),
  confirmPassword: yup
    .string()
    .oneOf([yup.ref('password')], 'Passwords must match')
    .required('Please confirm your password'),
  role: yup
    .string()
    .oneOf(['AUTHOR', 'EDITOR', 'PUBLISHER', 'READER'])
    .required('Please select a role'),
})

type RegisterFormData = yup.InferType<typeof schema>

const RegisterPage: React.FC = () => {
  const { register: registerUser, isLoading, error, clearError } = useAuthStore()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: yupResolver(schema),
  })

  const onSubmit = async (data: RegisterFormData) => {
    try {
      clearError()
      await registerUser({
        email: data.email,
        password: data.password,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role as 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER',
      })
      toast.success('Registration successful!')
      navigate('/dashboard')
    } catch (error) {
      toast.error('Registration failed. Please try again.')
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '80vh',
        py: 4,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%' }}>
        <Typography variant="h4" component="h1" gutterBottom textAlign="center">
          Create Account
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ mt: 2 }}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              {...register('firstName')}
              fullWidth
              label="First Name"
              error={!!errors.firstName}
              helperText={errors.firstName?.message}
              margin="normal"
              autoComplete="given-name"
            />

            <TextField
              {...register('lastName')}
              fullWidth
              label="Last Name"
              error={!!errors.lastName}
              helperText={errors.lastName?.message}
              margin="normal"
              autoComplete="family-name"
            />
          </Box>

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

          <Controller
            name="role"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <FormControl fullWidth margin="normal" error={!!errors.role}>
                <InputLabel>Role</InputLabel>
                <Select {...field} label="Role">
                  <MenuItem value="AUTHOR">Author</MenuItem>
                  <MenuItem value="EDITOR">Editor</MenuItem>
                  <MenuItem value="PUBLISHER">Publisher</MenuItem>
                  <MenuItem value="READER">Reader</MenuItem>
                </Select>
                {errors.role && (
                  <Typography variant="caption" color="error" sx={{ mt: 1, ml: 2 }}>
                    {errors.role.message}
                  </Typography>
                )}
              </FormControl>
            )}
          />

          <TextField
            {...register('password')}
            fullWidth
            label="Password"
            type="password"
            error={!!errors.password}
            helperText={errors.password?.message}
            margin="normal"
            autoComplete="new-password"
          />

          <TextField
            {...register('confirmPassword')}
            fullWidth
            label="Confirm Password"
            type="password"
            error={!!errors.confirmPassword}
            helperText={errors.confirmPassword?.message}
            margin="normal"
            autoComplete="new-password"
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            sx={{ mt: 3, mb: 2 }}
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : 'Create Account'}
          </Button>

          <Box textAlign="center">
            <Typography variant="body2">
              Already have an account?{' '}
              <MuiLink component={Link} to="/login">
                Sign in
              </MuiLink>
            </Typography>
          </Box>
        </Box>
      </Paper>
    </Box>
  )
}

export default RegisterPage