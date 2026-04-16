import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import { useAuth } from './context/AuthContext';

// Lazy-loaded pages
const PublicHomepage = lazy(() => import('./pages/PublicHomepage'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Feed = lazy(() => import('./pages/Feed'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const MyGroups = lazy(() => import('./pages/MyGroups'));
const CreateGroup = lazy(() => import('./pages/CreateGroup'));
const GroupDetail = lazy(() => import('./pages/GroupDetail'));
const GroupSettings = lazy(() => import('./pages/GroupSettings'));
const GroupChats = lazy(() => import('./pages/GroupChats'));
const MyExchanges = lazy(() => import('./pages/MyExchanges'));
const CreateExchange = lazy(() => import('./pages/CreateExchange'));
const ExchangeDetail = lazy(() => import('./pages/ExchangeDetail'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const PostDetail = lazy(() => import('./pages/PostDetail'));
const MyContent = lazy(() => import('./pages/MyContent'));
const SkillDetail = lazy(() => import('./pages/SkillDetail'));
const ToolDetail = lazy(() => import('./pages/ToolDetail'));
const EventDetail = lazy(() => import('./pages/EventDetail'));
const QuestionDetail = lazy(() => import('./pages/QuestionDetail'));
const GiftCreate = lazy(() => import('./pages/GiftCreate'));
const GiftDetail = lazy(() => import('./pages/GiftDetail'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const ChainDiscovery = lazy(() => import('./pages/ChainDiscovery'));
const SkillChainDetail = lazy(() => import('./pages/SkillChainDetail'));
const Settings = lazy(() => import('./pages/Settings'));
const OnboardingTags = lazy(() => import('./pages/OnboardingTags'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Admin = lazy(() => import('./pages/Admin'));

const PageLoader: React.FC = () => (
  <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
    <CircularProgress />
  </Box>
);

// Route guard for authenticated + verified routes
const PrivateRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;

  return <>{children}</>;
};

// Redirect logged-in users away from auth pages
const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return <PageLoader />;
  if (isAuthenticated) return <Navigate to="/feed" replace />;

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<GuestRoute><PublicHomepage /></GuestRoute>} />
          <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

          {/* Auth flow — accessible regardless of login state */}
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
          <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />

          {/* Semi-public — viewable by guests, interactive features require auth */}
          <Route path="/feed" element={<Feed />} />

          {/* Protected routes */}
          <Route path="/profile/edit" element={<PrivateRoute><EditProfile /></PrivateRoute>} />
          <Route path="/profile/:id" element={<PrivateRoute><MyProfile /></PrivateRoute>} />

          {/* Groups */}
          <Route path="/groups" element={<PrivateRoute><MyGroups /></PrivateRoute>} />
          <Route path="/groups/create" element={<PrivateRoute><CreateGroup /></PrivateRoute>} />
          <Route path="/groups/:id" element={<PrivateRoute><GroupDetail /></PrivateRoute>} />
          <Route path="/groups/:id/settings" element={<PrivateRoute><GroupSettings /></PrivateRoute>} />
          <Route path="/groups/:id/chat" element={<PrivateRoute><GroupChats /></PrivateRoute>} />

          {/* Exchanges */}
          <Route path="/my-exchanges" element={<PrivateRoute><MyExchanges /></PrivateRoute>} />
          <Route path="/exchanges/create" element={<PrivateRoute><CreateExchange /></PrivateRoute>} />
          <Route path="/exchanges/:id" element={<PrivateRoute><ExchangeDetail /></PrivateRoute>} />

          {/* Posts & Content */}
          <Route path="/create" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
          <Route path="/posts/create" element={<PrivateRoute><CreatePost /></PrivateRoute>} />
          <Route path="/my-content" element={<PrivateRoute><MyContent /></PrivateRoute>} />
          <Route path="/posts/:id" element={<PrivateRoute><PostDetail /></PrivateRoute>} />
          <Route path="/skills/:id" element={<PrivateRoute><SkillDetail /></PrivateRoute>} />
          <Route path="/tools/:id" element={<PrivateRoute><ToolDetail /></PrivateRoute>} />
          <Route path="/events/:id" element={<PrivateRoute><EventDetail /></PrivateRoute>} />
          <Route path="/questions/:id" element={<PrivateRoute><QuestionDetail /></PrivateRoute>} />
          <Route path="/gift/create" element={<PrivateRoute><GiftCreate /></PrivateRoute>} />
          <Route path="/gifts/:id" element={<PrivateRoute><GiftDetail /></PrivateRoute>} />

          {/* Skill Chains */}
          <Route path="/chains" element={<PrivateRoute><ChainDiscovery /></PrivateRoute>} />
          <Route path="/chains/:id" element={<PrivateRoute><SkillChainDetail /></PrivateRoute>} />

          {/* Settings */}
          <Route path="/settings" element={<PrivateRoute><Settings /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><Admin /></PrivateRoute>} />
          <Route path="/onboarding/tags" element={<PrivateRoute><OnboardingTags /></PrivateRoute>} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
};

export default App;
