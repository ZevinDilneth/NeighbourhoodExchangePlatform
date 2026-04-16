import { Router } from 'express';
import { authenticate, optionalAuthenticate } from '../middleware/auth';
import {
  getExchanges,
  createExchange,
  getExchange,
  respondToExchange,
  updateExchangeStatus,
  reviewExchange,
  sendExchangeMessage,
  deleteExchangeMessage,
  getMyExchanges,
  checkFairness,
  applyToExchange,
  reviewApplication,
  getExchangeChains,
  respondToChain,
  undoChainAccept,
} from '../controllers/exchanges.controller';
import { uploadMedia } from '../middleware/upload';

const router = Router();

router.get('/fairness-check', checkFairness);   // public — no auth needed
router.get('/', optionalAuthenticate, getExchanges);
router.post('/', authenticate, uploadMedia.fields([
  { name: 'images', maxCount: 10 },
  { name: 'seekingMedia', maxCount: 10 },
]), createExchange);
router.get('/me', authenticate, getMyExchanges);
router.get('/:id', authenticate, getExchange);
router.post('/:id/respond', authenticate, respondToExchange);
router.put('/:id/status', authenticate, updateExchangeStatus);
router.post('/:id/review', authenticate, reviewExchange);
router.post('/:id/messages', authenticate, sendExchangeMessage);
router.delete('/:id/messages/:messageId', authenticate, deleteExchangeMessage);
router.post('/:id/apply', authenticate, applyToExchange);
router.put('/:id/applications/:appId', authenticate, reviewApplication);
router.get('/:id/chains', authenticate, getExchangeChains);
router.post('/:id/chains/:chainId/respond', authenticate, respondToChain);
router.post('/:id/chains/:chainId/undo-accept', authenticate, undoChainAccept);

export default router;
