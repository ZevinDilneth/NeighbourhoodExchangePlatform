import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  discoverChainsForUser,
  getMyChains,
  getChain,
  respondToChain,
  undoChainAcceptance,
  completeChainEdge,
  getChainStats,
  adminRunDiscovery,
} from '../controllers/chains.controller';

const router = Router();

// All chain endpoints require authentication
router.use(authenticate);

router.get('/discover',           discoverChainsForUser);
router.get('/me',                 getMyChains);
router.get('/stats',              getChainStats);         // admin
router.post('/admin/run-discovery', adminRunDiscovery);   // admin

router.get('/:id',                getChain);
router.post('/:id/respond',       respondToChain);
router.post('/:id/undo-accept',   undoChainAcceptance);
router.put('/:id/complete-edge',  completeChainEdge);

export default router;
