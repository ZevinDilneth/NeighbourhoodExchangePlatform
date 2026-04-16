import cron from 'node-cron';
import { User } from '../models/User';

const CEU_LOW_THRESHOLD = 10;
const CEU_TOPUP_AMOUNT  = 100;
const TOPUP_DELAY_MS    = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Runs every 15 minutes:
 * 1. Mark users whose balance just dropped to ≤10 (set ceuLowSince = now)
 * 2. Top up users whose balance has been ≤10 for ≥24 h
 * 3. Reset the timer for users who recovered above 10 before the 24 h elapsed
 */
export function startCeuTopupCron(): void {
  cron.schedule('*/15 * * * *', async () => {
    try {
      const now    = new Date();
      const cutoff = new Date(now.getTime() - TOPUP_DELAY_MS);

      // Step 1 — mark newly low-balance users
      await User.updateMany(
        { ceuBalance: { $lte: CEU_LOW_THRESHOLD }, ceuLowSince: null, isActive: true },
        { $set: { ceuLowSince: now } }
      );

      // Step 2 — top up users who have been low for ≥24 h
      const dueUsers = await User.find({
        ceuBalance:  { $lte: CEU_LOW_THRESHOLD },
        ceuLowSince: { $ne: null, $lte: cutoff },
        isActive:    true,
      }).select('_id').lean();

      for (const u of dueUsers) {
        await User.findByIdAndUpdate(u._id, {
          $inc: { ceuBalance: CEU_TOPUP_AMOUNT },
          $set: { ceuLowSince: null },
        });
      }

      // Step 3 — reset timer for users who recovered above 10
      await User.updateMany(
        { ceuBalance: { $gt: CEU_LOW_THRESHOLD }, ceuLowSince: { $ne: null } },
        { $set: { ceuLowSince: null } }
      );
    } catch (err) {
      console.error('CEU top-up cron error:', err);
    }
  });
}
