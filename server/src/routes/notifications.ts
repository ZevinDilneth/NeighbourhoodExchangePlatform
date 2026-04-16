import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNotifications,
  markRead,
  markAllRead,
  getInbox,
} from '../controllers/notifications.controller';

const router = Router();

router.use(authenticate);

router.get('/', getNotifications);
router.get('/inbox', getInbox);         // unified messages inbox
router.put('/read-all', markAllRead);   // must come before /:id/read
router.put('/:id/read', markRead);

export default router;
