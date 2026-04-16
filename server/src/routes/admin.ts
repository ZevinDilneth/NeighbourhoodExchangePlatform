import { Router, Response } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { AuthRequest } from '../types';
import { User } from '../models/User';

const router = Router();

// All admin routes require auth + admin role
router.use(authenticate, requireRole('admin'));

// GET /api/admin/users?q=...  — search users by name or email
router.get('/users', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const q = (req.query.q as string ?? '').trim();
    const filter = q
      ? { $or: [
          { name:  { $regex: q, $options: 'i' } },
          { email: { $regex: q, $options: 'i' } },
        ] }
      : {};

    const users = await User.find(filter)
      .select('name email avatar videoIntro isVideoVerified isVerified role isActive createdAt')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PATCH /api/admin/users/:id/video-verified  — set or clear video verification
router.patch('/users/:id/video-verified', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { verified } = req.body as { verified: boolean };
    if (typeof verified !== 'boolean') {
      res.status(400).json({ message: '`verified` must be a boolean' });
      return;
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isVideoVerified: verified },
      { new: true, select: 'name email isVideoVerified videoIntro' },
    ).lean();

    if (!user) {
      res.status(404).json({ message: 'User not found' });
      return;
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;
