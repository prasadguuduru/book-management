import React from 'react';
import { AppBar, Toolbar, Typography, Button, Box, Chip } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'AUTHOR':
        return 'primary';
      case 'EDITOR':
        return 'secondary';
      case 'PUBLISHER':
        return 'success';
      case 'READER':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position='static' elevation={1}>
        <Toolbar>
          <Typography variant='h6' component='div' sx={{ flexGrow: 1 }}>
            <Link
              to={isAuthenticated ? '/dashboard' : '/'}
              style={{ color: 'inherit', textDecoration: 'none' }}
            >
              📚 Ebook Publishing Platform
            </Link>
          </Typography>

          {isAuthenticated ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant='body2'>
                  {user?.firstName} {user?.lastName}
                </Typography>
                <Chip
                  label={user?.role}
                  color={getRoleColor(user?.role || '')}
                  size='small'
                  variant='outlined'
                  sx={{ color: 'white', borderColor: 'white' }}
                />
              </Box>
              <Button color='inherit' component={Link} to='/dashboard'>
                Dashboard
              </Button>
              <Button color='inherit' onClick={handleLogout}>
                Logout
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color='inherit' component={Link} to='/login'>
                Login
              </Button>
              <Button color='inherit' component={Link} to='/register'>
                Register
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <main style={{ minHeight: 'calc(100vh - 64px)' }}>{children}</main>
    </Box>
  );
};

export default Layout;
