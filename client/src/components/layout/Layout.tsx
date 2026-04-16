import React, { useState } from 'react';
import { Box, Drawer } from '@mui/material';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

interface LayoutProps {
  children: React.ReactNode;
  rightPanel?: React.ReactNode;
  hideSidebar?: boolean;
}

const NAVBAR_H = 56;
const SIDEBAR_W = 280;

const Layout: React.FC<LayoutProps> = ({ children, rightPanel, hideSidebar }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#F9FAFB' }}>
      {/* Fixed Navbar */}
      <Navbar onMenuClick={() => setDrawerOpen(true)} />

      {/* Page body below navbar */}
      <Box
        sx={{
          pt: `${NAVBAR_H}px`,
          display: 'grid',
          gridTemplateColumns: hideSidebar
            ? '1fr'
            : rightPanel
            ? { xs: '1fr', md: `${SIDEBAR_W}px 1fr`, lg: `${SIDEBAR_W}px 1fr 360px` }
            : { xs: '1fr', md: `${SIDEBAR_W}px 1fr` },
          minHeight: `calc(100vh - ${NAVBAR_H}px)`,
        }}
      >
        {/* Sidebar — desktop only */}
        {!hideSidebar && (
          <Box sx={{ display: { xs: 'none', md: 'block' } }}>
            <Sidebar />
          </Box>
        )}

        {/* Main Content */}
        <Box
          component="main"
          sx={{
            minWidth: 0,
            p: { xs: 1.5, sm: 2, md: 2.5 },
            overflowX: 'hidden',
          }}
        >
          {children}
        </Box>

        {/* Right Panel — large screens only */}
        {rightPanel && (
          <Box
            sx={{
              display: { xs: 'none', lg: 'block' },
              position: 'sticky',
              top: NAVBAR_H,
              height: `calc(100vh - ${NAVBAR_H}px)`,
              overflowY: 'auto',
              background: '#FFFFFF',
              borderLeft: '1px solid #E5E7EB',
              boxShadow: '-2px 0 8px rgba(0,0,0,0.05)',
              p: '1.5rem 1rem',
              '&::-webkit-scrollbar': { width: 6 },
              '&::-webkit-scrollbar-track': { background: '#F9FAFB', borderRadius: 4 },
              '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 },
            }}
          >
            {rightPanel}
          </Box>
        )}
      </Box>

      {/* Mobile Sidebar Drawer */}
      {!hideSidebar && (
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': {
              width: Math.min(SIDEBAR_W, 300),
              boxSizing: 'border-box',
              pt: `${NAVBAR_H}px`,
            },
          }}
        >
          <Sidebar onClose={() => setDrawerOpen(false)} />
        </Drawer>
      )}
    </Box>
  );
};

export default Layout;
