import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default', p: 2, flexDirection: 'column', textAlign: 'center' }}>
      <Typography fontSize="5rem" mb={2}>🏘️</Typography>
      <Typography fontFamily="Poppins, sans-serif" fontWeight={700} fontSize="2rem" mb={1}>Page Not Found</Typography>
      <Typography color="text.secondary" mb={3}>This page doesn't exist in the neighborhood.</Typography>
      <Button variant="contained" onClick={() => navigate(isAuthenticated ? '/feed' : '/')}>
        Go Home
      </Button>
    </Box>
  );
};

export default NotFound;
