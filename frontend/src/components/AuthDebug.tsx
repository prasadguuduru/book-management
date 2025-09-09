import React from 'react';
import { useAuthStore } from '@/store/authStore';

export const AuthDebug: React.FC = () => {
  const { user, token, isAuthenticated, error } = useAuthStore();

  const checkLocalStorage = () => {
    const authStorage = localStorage.getItem('auth-storage');
    console.log('=== AUTH DEBUG ===');
    console.log('Raw localStorage:', authStorage);
    
    if (authStorage) {
      try {
        const parsed = JSON.parse(authStorage);
        console.log('Parsed storage:', parsed);
        console.log('Token in storage:', parsed.state?.token ? 'YES' : 'NO');
        console.log('User in storage:', parsed.state?.user ? 'YES' : 'NO');
      } catch (e) {
        console.error('Parse error:', e);
      }
    }
    
    console.log('Store state:');
    console.log('- User:', user);
    console.log('- Token exists:', !!token);
    console.log('- Is authenticated:', isAuthenticated);
    console.log('- Error:', error);
    console.log('=== END DEBUG ===');
  };

  const testLogin = async () => {
    try {
      const { login } = useAuthStore.getState();
      await login('author@example.com', 'password123');
      console.log('✅ Login successful');
      checkLocalStorage();
    } catch (error) {
      console.error('❌ Login failed:', error);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', 
      top: 10, 
      right: 10, 
      background: 'white', 
      border: '1px solid #ccc', 
      padding: '10px',
      zIndex: 9999,
      fontSize: '12px'
    }}>
      <h4>Auth Debug</h4>
      <p>Authenticated: {isAuthenticated ? '✅' : '❌'}</p>
      <p>User: {user?.email || 'None'}</p>
      <p>Token: {token ? '✅' : '❌'}</p>
      {error && <p style={{color: 'red'}}>Error: {error}</p>}
      
      <button onClick={checkLocalStorage} style={{marginRight: '5px'}}>
        Check Storage
      </button>
      <button onClick={testLogin}>
        Test Login
      </button>
    </div>
  );
};

export default AuthDebug;