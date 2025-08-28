/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_APIGATEWAY_URL: string;
  readonly VITE_WS_URL: string;
  readonly VITE_ENVIRONMENT: string;
  readonly VITE_ENABLE_DEBUG: string;
  readonly VITE_ENABLE_REAL_TIME: string;
  readonly VITE_ENABLE_ANALYTICS: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_APP_VERSION: string;
  readonly VITE_SENTRY_DSN: string;
  readonly VITE_GOOGLE_ANALYTICS_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
