import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createMeeting,
  joinMeeting,
  endMeeting,
  recordingWebhook,
  exportChat,
  getMeeting,
  getMeetingByExchange,
  streamRecording,
  streamChat,
  listMeetings,
} from '../controllers/meetings.controller';

const router = Router();

router.post('/create',                        authenticate, createMeeting);
router.post('/join/:roomId',                  authenticate, joinMeeting);
router.post('/:roomId/end',                   authenticate, endMeeting);
router.post('/chat/export',                   authenticate, exportChat);
router.get('/exchange/:exchangeId',           authenticate, getMeetingByExchange);
router.get('/:roomId/recording',              authenticate, streamRecording);
router.get('/:roomId/chat',                   authenticate, streamChat);
router.get('/',                               authenticate, listMeetings);
router.get('/:roomId',                        authenticate, getMeeting);

// Called by Daily.co webhook — no user auth, Daily.co posts directly
router.post('/recording/webhook',             recordingWebhook);

export default router;
