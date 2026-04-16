import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getSettings,
  updateNotifications,
  updatePreferences,
  changePassword,
  requestEmailChange,
  verifyEmailChange,
  blockUser,
  unblockUser,
  getBlockedUsers,
  suspendAccount,
  cancelSuspension,
  deleteAccount,
} from '../controllers/settings.controller';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

router.get('/',                       getSettings);
router.put('/notifications',          updateNotifications);
router.put('/preferences',            updatePreferences);
router.put('/password',               changePassword);
router.post('/email/request',         requestEmailChange);
router.post('/email/verify',          verifyEmailChange);

router.get('/blocked',                getBlockedUsers);
router.post('/block/:userId',         blockUser);
router.delete('/block/:userId',       unblockUser);

router.post('/suspend',               suspendAccount);
router.delete('/suspend',             cancelSuspension);

router.delete('/account',             deleteAccount);

export default router;
