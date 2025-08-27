import { Routes, Route, Navigate } from 'react-router-dom';
import { Container } from '@mui/material';

import { useAuthStore } from '@/store/authStore';
import Layout from '@/components/Layout';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ProtectedRoute from '@/components/ProtectedRoute';

function App() {
  const { isAuthenticated } = useAuthStore();

  // Use isAuthenticated for conditional rendering
  console.log('Authentication status:', isAuthenticated);

  return (
    <Layout>
      <Container maxWidth='xl' sx={{ mt: 2, mb: 4 }}>
        <Routes>
          <Route
            path='/'
            element={
              isAuthenticated ? (
                <Navigate to='/dashboard' replace />
              ) : (
                <HomePage />
              )
            }
          />
          <Route
            path='/login'
            element={
              isAuthenticated ? (
                <Navigate to='/dashboard' replace />
              ) : (
                <LoginPage />
              )
            }
          />
          <Route
            path='/register'
            element={
              isAuthenticated ? (
                <Navigate to='/dashboard' replace />
              ) : (
                <RegisterPage />
              )
            }
          />
          <Route
            path='/dashboard'
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          {/* Catch all route - redirect to home or dashboard */}
          <Route
            path='*'
            element={
              <Navigate to={isAuthenticated ? '/dashboard' : '/'} replace />
            }
          />
        </Routes>
      </Container>
    </Layout>
  );
}

export default App;
