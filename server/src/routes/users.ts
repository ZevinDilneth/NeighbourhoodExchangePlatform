import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { upload, uploadVideoWithThumbnail } from '../middleware/upload';
import {
  getUserProfile,
  updateProfile,
  updateAvatar,
  updateVideoIntro,
  removeVideoIntro,
  savePreferredTags,
  getNearbyUsers,
  getUserPosts,
  getUserExchanges,
  getExpertsByTags,
  getOnlineUsers,
  getInbox,
} from '../controllers/users.controller';

const router = Router();

router.get('/nearby', authenticate, getNearbyUsers);
router.get('/experts', authenticate, getExpertsByTags);
router.get('/online', getOnlineUsers);
// /me routes must come before /:id so "me" is not treated as a MongoDB ID
router.get('/me/inbox', authenticate, getInbox);
router.put('/me', authenticate, updateProfile);
router.put('/me/tags', authenticate, savePreferredTags);
router.put('/me/avatar', authenticate, upload.single('avatar'), updateAvatar);
router.put('/me/video-intro', authenticate, uploadVideoWithThumbnail.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), updateVideoIntro);
router.delete('/me/video-intro', authenticate, removeVideoIntro);
router.get('/:id', authenticate, getUserProfile);
router.get('/:id/posts', authenticate, getUserPosts);
router.get('/:id/exchanges', authenticate, getUserExchanges);

export default router;
