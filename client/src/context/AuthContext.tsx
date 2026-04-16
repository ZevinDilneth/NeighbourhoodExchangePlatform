import React, { createContext, useContext, useEffect, useReducer } from 'react';
import { User } from '../types';
import api from '../services/api';
import { disconnectSocket } from '../services/socket';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'LOGIN_SUCCESS'; payload: User }
  | { type: 'LOGOUT' }
  | { type: 'UPDATE_USER'; payload: Partial<User> };

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
};

const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'LOGIN_SUCCESS':
      return { ...state, user: action.payload, isAuthenticated: true, isLoading: false };
    case 'LOGOUT':
      return { ...initialState, isLoading: false };
    case 'UPDATE_USER':
      return {
        ...state,
        user: state.user ? { ...state.user, ...action.payload } : null,
      };
    default:
      return state;
  }
};

interface AuthContextValue extends AuthState {
  /** true when the authenticated user has verified their email address */
  isEmailVerified: boolean;
  /** true when the authenticated user has uploaded a Video Introduction */
  isVideoVerified: boolean;
  /** true when the authenticated user has verified their mobile phone number */
  isPhoneVerified: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  neighbourhood?: string;
  city?: string;
  postcode?: string;
  country?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore session on mount
  useEffect(() => {
    const restoreSession = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        dispatch({ type: 'SET_LOADING', payload: false });
        return;
      }

      try {
        const { data } = await api.get('/auth/me', { timeout: 8000 });
        dispatch({ type: 'LOGIN_SUCCESS', payload: data });
      } catch {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        dispatch({ type: 'SET_LOADING', payload: false });
      }
    };

    restoreSession();
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    const { data: me } = await api.get('/auth/me');
    dispatch({ type: 'LOGIN_SUCCESS', payload: me });
  };

  const register = async (formData: RegisterData) => {
    const { data } = await api.post('/auth/register', formData);

    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    const { data: me } = await api.get('/auth/me');
    dispatch({ type: 'LOGIN_SUCCESS', payload: me });
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // ignore
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    disconnectSocket();
    dispatch({ type: 'LOGOUT' });
  };

  const updateUser = (data: Partial<User>) => {
    dispatch({ type: 'UPDATE_USER', payload: data });
  };

  const isEmailVerified  = Boolean((state.user as unknown as { isVerified?: boolean })?.isVerified);
  const isVideoVerified  = Boolean(state.user?.videoIntro) || Boolean((state.user as unknown as { isVideoVerified?: boolean })?.isVideoVerified);
  const isPhoneVerified  = Boolean((state.user as unknown as { isPhoneVerified?: boolean })?.isPhoneVerified);

  return (
    <AuthContext.Provider value={{ ...state, isEmailVerified, isVideoVerified, isPhoneVerified, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
