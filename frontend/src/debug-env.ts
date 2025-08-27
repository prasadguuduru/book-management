// Debug environment variables
console.log('🔍 Environment Debug Info:');
console.log('VITE_APIGATEWAY_URL:', import.meta.env.VITE_APIGATEWAY_URL);
console.log('VITE_ENVIRONMENT:', import.meta.env.VITE_ENVIRONMENT);
console.log('All env vars:', import.meta.env);

export const debugEnv = () => {
  console.log(
    '🔗 Current API URL will be:',
    import.meta.env.VITE_APIGATEWAY_URL || 'undefined (will use relative paths)'
  );
};
