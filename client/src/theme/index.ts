import { createTheme } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    emerald: Palette['primary'];
  }
  interface PaletteOptions {
    emerald?: PaletteOptions['primary'];
  }
}

export const theme = createTheme({
  palette: {
    primary: {
      main: '#4F46E5',       // Indigo
      light: '#818CF8',
      dark: '#3730A3',
      contrastText: '#FFFFFF',
    },
    secondary: {
      main: '#10B981',       // Emerald
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    emerald: {
      main: '#10B981',
      light: '#34D399',
      dark: '#059669',
      contrastText: '#FFFFFF',
    },
    background: {
      default: '#F9FAFB',
      paper: '#FFFFFF',
    },
    text: {
      primary: '#1F2937',
      secondary: '#6B7280',
    },
    divider: '#E5E7EB',
    error: { main: '#EF4444' },
    warning: { main: '#F59E0B' },
    info: { main: '#3B82F6' },
    success: { main: '#10B981' },
  },
  typography: {
    fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    h1: { fontFamily: '"Poppins", sans-serif', fontWeight: 700, textTransform: 'capitalize', fontSize: 'clamp(1.5rem, 4vw, 2.25rem)' },
    h2: { fontFamily: '"Poppins", sans-serif', fontWeight: 700, textTransform: 'capitalize', fontSize: 'clamp(1.25rem, 3.5vw, 1.875rem)' },
    h3: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, textTransform: 'capitalize', fontSize: 'clamp(1.125rem, 3vw, 1.5rem)' },
    h4: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, textTransform: 'capitalize', fontSize: 'clamp(1rem, 2.5vw, 1.25rem)' },
    h5: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, textTransform: 'capitalize', fontSize: 'clamp(0.9375rem, 2vw, 1.125rem)' },
    h6: { fontFamily: '"Poppins", sans-serif', fontWeight: 600, textTransform: 'capitalize', fontSize: 'clamp(0.875rem, 1.8vw, 1rem)' },
    body1: { fontSize: 'clamp(0.875rem, 1.5vw, 1rem)' },
    body2: { fontSize: 'clamp(0.8125rem, 1.3vw, 0.875rem)' },
    button: { textTransform: 'none', fontWeight: 500 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: '0.5rem',
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
        containedPrimary: {
          background: 'linear-gradient(135deg, #4F46E5, #10B981)',
          '&:hover': {
            background: 'linear-gradient(135deg, #3730A3, #059669)',
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          borderRadius: '0.75rem',
          border: '1px solid #E5E7EB',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: '0.375rem',
          fontWeight: 500,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'small',
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          margin: '12px',
          width: 'calc(100% - 24px)',
          maxHeight: 'calc(100% - 24px)',
        },
      },
    },
    MuiDialogContent: {
      styleOverrides: {
        root: {
          padding: '16px',
        },
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          padding: '16px',
          fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: '#FFFFFF',
          color: '#1F2937',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          borderBottom: '1px solid #E5E7EB',
        },
      },
    },
  },
});
