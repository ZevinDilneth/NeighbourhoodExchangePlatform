import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { theme } from './theme';
import { AuthProvider } from './context/AuthContext';
import { OnlineProvider } from './context/OnlineContext';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      retry: 2,
      // Wait 3 s before the first retry and 6 s before the second.
      // This gives the dev server time to finish booting (NSFW model load, DB
      // connection) before React Query gives up on the initial requests.
      retryDelay: (attempt) => (attempt + 1) * 3000,
      refetchOnWindowFocus: false,
    },
  },
});

// Expose QueryClient for TanStack Query DevTools browser extension
declare global {
  interface Window {
    __TANSTACK_QUERY_CLIENT__: import('@tanstack/query-core').QueryClient;
  }
}
window.__TANSTACK_QUERY_CLIENT__ = queryClient;

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <OnlineProvider>
            <App />
          </OnlineProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
