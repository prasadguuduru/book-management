import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import { CircularProgress, Box } from '@mui/material';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'AUTHOR' | 'EDITOR' | 'PUBLISHER' | 'READER';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, user, isLoading } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <Box
        display='flex'
        justifyContent='center'
        alignItems='center'
        minHeight='50vh'
      >
        <CircularProgress />
      </Box>
    );
  }

  if (!isAuthenticated) {
    // Redirect to login page with return url
    return <Navigate to='/login' state={{ from: location }} replace />;
  }

  if (requiredRole && user?.role !== requiredRole) {
    // User doesn't have required role
    return <Navigate to='/dashboard' replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
