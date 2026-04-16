import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getLeaderboard,
  getMyRanking,
  getUserRanking,
  recalculateMyRanking,
  recalculateAll,
  getRankingStats,
} from '../controllers/rankings.controller';

const router = Router();

// Public-facing leaderboard (still requires auth to see neighbour data)
router.use(authenticate);

router.get('/leaderboard',        getLeaderboard);
router.get('/stats',              getRankingStats);       // admin
router.get('/me',                 getMyRanking);
router.get('/user/:id',           getUserRanking);
router.post('/recalculate',       recalculateMyRanking);
router.post('/recalculate-all',   recalculateAll);        // admin

export default router;
