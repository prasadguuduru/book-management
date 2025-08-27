// Environment configuration utility
// Fetches environment variables from multiple sources

interface AppConfig {
  apiUrl: string;
  environment: string;
  appName: string;
  debugMode: boolean;
  enableAnalytics: boolean;
  enableRealTime: boolean;
}

// Function to fetch environment variable from runtime
const getEnvVar = (key: string, fallback?: string): string => {
  // Try to get from runtime environment (if available)
  if (typeof window !== 'undefined' && (window as any).ENV) {
    const value = (window as any).ENV[key];
    if (value) {
      return value;
    }
  }

  // Try to get from import.meta.env (build time)
  const viteValue = import.meta.env[key];
  if (viteValue) {
    return viteValue;
  }

  // Return fallback
  return fallback || '';
};

// Get configuration
export const getAppConfig = (): AppConfig => {
  const config = {
    apiUrl: getEnvVar('VITE_APIGATEWAY_URL', '/api'),
    environment: getEnvVar('VITE_ENVIRONMENT', 'development'),
    appName: getEnvVar('VITE_APP_NAME', 'Ebook Platform'),
    debugMode: getEnvVar('VITE_DEBUG_MODE', 'false') === 'true',
    enableAnalytics: getEnvVar('VITE_ENABLE_ANALYTICS', 'false') === 'true',
    enableRealTime: getEnvVar('VITE_ENABLE_REAL_TIME', 'true') === 'true',
  };

  console.log('📋 App Configuration:', config);
  return config;
};

// Set runtime environment variables (call this from your deployment script)
export const setRuntimeEnv = (envVars: Record<string, string>) => {
  if (typeof window !== 'undefined') {
    (window as any).ENV = { ...(window as any).ENV, ...envVars };
    console.log('✅ Runtime environment variables set:', envVars);
  }
};

// Export individual getters for convenience
export const getApiUrl = () => getEnvVar('VITE_APIGATEWAY_URL', '/api');
export const getEnvironment = () =>
  getEnvVar('VITE_ENVIRONMENT', 'development');
export const isDebugMode = () =>
  getEnvVar('VITE_DEBUG_MODE', 'false') === 'true';
