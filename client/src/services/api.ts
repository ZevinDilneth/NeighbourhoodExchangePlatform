import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// In dev the Vite proxy rewrites /api → localhost:5000
// In production VITE_API_URL must be set to the Railway server URL
const BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

export const api = axios.create({
  baseURL: BASE,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach access token to all requests
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto-refresh token on 401
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;

      // Only attempt a token refresh when we actually have a refresh token.
      // If there is no refresh token the user is simply unauthenticated (e.g.
      // wrong password on the login page) — reject immediately so the calling
      // component can display the error message.
      const storedRefresh = localStorage.getItem('refreshToken');
      if (!storedRefresh) {
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE}/auth/refresh`, { refreshToken: storedRefresh });

        localStorage.setItem('accessToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);

        original.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(original);
      } catch {
        // Refresh failed — clear stale tokens so the app continues as guest.
        // AuthContext and PrivateRoute handle the redirect to /login when needed.
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
