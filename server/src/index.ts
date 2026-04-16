import 'dotenv/config';
import dns from 'dns';
// Force IPv4-only public DNS — fixes SRV lookup ECONNREFUSED on some routers
dns.setDefaultResultOrder('ipv4first');
dns.setServers(['8.8.8.8', '1.1.1.1', '8.8.4.4']);
import http from 'http';
import readline from 'readline';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';

import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import Bull from 'bull';

import { connectDB } from './config/db';
import { startCeuTopupCron } from './services/ceuTopup';
import { connectRedis } from './config/redis';
import { errorHandler, notFound } from './middleware/errorHandler';
import { setupSocket } from './socket';
import { setIO } from './socket/ioInstance';

import authRoutes from './routes/auth';
import userRoutes from './routes/users';
import postRoutes from './routes/posts';
import exchangeRoutes from './routes/exchanges';
import groupRoutes from './routes/groups';
import settingsRoutes from './routes/settings';
import phoneRoutes from './routes/phone';
import mediaRoutes from './routes/media';
import meetingRoutes from './routes/meetings';
import chainRoutes        from './routes/chains';
import rankingRoutes      from './routes/rankings';
import notificationRoutes from './routes/notifications';
import adminRoutes        from './routes/admin';

const app = express();
const httpServer = http.createServer(app);

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.TUNNEL_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
].filter(Boolean) as string[];

// Socket.IO server
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 120000,
  },
});

// Middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return cb(null, true);
    if (allowedOrigins.some((o) => origin.startsWith(o))) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting — disabled in development, enforced in production
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 200 : 0, // 0 = unlimited
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV !== 'production',
});
app.use('/api', limiter);

// Bull Board queue dashboard
const redisOpts = { redis: process.env.REDIS_URL };
const emailQueue        = new Bull('email', redisOpts);
const notifQueue        = new Bull('notifications', redisOpts);
const moderationQueue   = new Bull('moderation', redisOpts);
const exchangeQueue     = new Bull('exchanges', redisOpts);

const bullBoardAdapter = new ExpressAdapter();
bullBoardAdapter.setBasePath('/admin/queues');
createBullBoard({
  queues: [
    new BullAdapter(emailQueue),
    new BullAdapter(notifQueue),
    new BullAdapter(moderationQueue),
    new BullAdapter(exchangeQueue),
  ],
  serverAdapter: bullBoardAdapter,
});
app.use('/admin/queues', bullBoardAdapter.getRouter());

// Seed queues with demo jobs in development (for dashboard screenshot)
if (process.env.NODE_ENV !== 'production') {
  setTimeout(async () => {
    try {
      await emailQueue.add({ to: 'user@example.com', subject: 'Verify your email', type: 'verification' });
      await emailQueue.add({ to: 'alice@example.com', subject: 'Password reset', type: 'reset' });
      await emailQueue.add({ to: 'bob@example.com', subject: 'Exchange accepted', type: 'notification' });
      await notifQueue.add({ userId: 'u1', message: 'Your exchange was accepted', type: 'exchange' });
      await notifQueue.add({ userId: 'u2', message: 'New message from Alice', type: 'message' });
      await notifQueue.add({ userId: 'u3', message: 'Tool borrow request received', type: 'tool' });
      await moderationQueue.add({ postId: 'p1', imageUrl: 'https://example.com/img1.jpg', status: 'pending' });
      await moderationQueue.add({ postId: 'p2', imageUrl: 'https://example.com/img2.jpg', status: 'flagged' });
      await exchangeQueue.add({ exchangeId: 'e1', action: 'proposal_created', userId: 'u1' });
      await exchangeQueue.add({ exchangeId: 'e2', action: 'proposal_accepted', userId: 'u2' });
      await exchangeQueue.add({ exchangeId: 'e3', action: 'exchange_completed', userId: 'u3' });
      // Mark some as completed and one as failed for a realistic dashboard
      const emailJobs = await emailQueue.getJobs(['waiting']);
      if (emailJobs[0]) await emailJobs[0].moveToCompleted('done', true);
      if (emailJobs[1]) await emailJobs[1].moveToCompleted('done', true);
      const modJobs = await moderationQueue.getJobs(['waiting']);
      if (modJobs[0]) await modJobs[0].moveToCompleted('clean', true);
      if (modJobs[1]) await modJobs[1].moveToFailed({ message: 'NSFW content detected' }, true);
      console.log('📊 Bull Board: demo jobs seeded → http://localhost:5000/admin/queues');
    } catch (e) { /* Redis may not be ready yet — silent fail */ }
  }, 5000);
}

// Health check (both paths for Railway + generic monitors)
let dbReady = false;
const healthHandler = (_req: express.Request, res: express.Response) =>
  res.json({ status: 'ok', db: dbReady, timestamp: new Date().toISOString() });
app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/exchanges', exchangeRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/phone', phoneRoutes);
app.use('/api/media',    mediaRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/chains',        chainRoutes);
app.use('/api/rankings',      rankingRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin',        adminRoutes);

// Socket.IO setup
setIO(io);
setupSocket(io);

// Error handling
app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ─── Admin CLI ────────────────────────────────────────────────────────────────
// Interactive terminal commands while the server is running.
// Only active when stdin is a TTY (interactive terminal, not CI/Railway).
function startAdminCli() {
  if (!process.stdin.isTTY) return;

  const PROMPT = chalk.bgBlue.white.bold(' ADMIN ') + chalk.gray(' > ');

  const rl = readline.createInterface({
    input:  process.stdin,
    output: process.stdout,
    terminal: false,
  });

  const printHelp = () => {
    console.log('');
    console.log(chalk.cyan.bold('  Admin CLI Commands'));
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log(`  ${chalk.white('verify <email> <true|false>')}  — set email verification status`);
    console.log(`  ${chalk.white('help')}                         — show this help`);
    console.log(chalk.gray('  ─────────────────────────────────────────────'));
    console.log('');
    process.stdout.write(PROMPT);
  };

  console.log('');
  console.log(chalk.bgBlue.white.bold('  Neighbourhood Exchange — Admin CLI  '));
  console.log(chalk.gray("  Type 'help' for available commands."));
  console.log('');
  process.stdout.write(PROMPT);

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) { process.stdout.write(PROMPT); return; }

    const [cmd, ...args] = trimmed.split(/\s+/);

    switch (cmd.toLowerCase()) {

      case 'verify': {
        const [email, statusArg] = args;
        if (!email || !['true', 'false'].includes(statusArg)) {
          console.log(chalk.yellow('  Usage: verify <email> <true|false>'));
          break;
        }
        const isVerified = statusArg === 'true';
        try {
          const { User: UserModel } = await import('./models/User');
          const user = await UserModel.findOne({ email }).lean();
          if (!user) {
            console.log(chalk.red(`  ✗ No user found with email: ${email}`));
            break;
          }
          await UserModel.findByIdAndUpdate((user as { _id: unknown })._id, { $set: { isVerified } });
          const u = user as { name: string; email: string };
          console.log(
            chalk.green('  ✓') +
            ` ${chalk.white.bold(u.name)} <${chalk.cyan(u.email)}>` +
            `  →  isVerified = ${isVerified ? chalk.green('true') : chalk.red('false')}`
          );
        } catch (err) {
          console.log(chalk.red('  ✗ Error:'), (err as Error).message);
        }
        break;
      }

      case 'help':
        printHelp();
        return;

      default:
        console.log(chalk.yellow(`  Unknown command: "${cmd}". Type 'help' for available commands.`));
    }

    process.stdout.write(PROMPT);
  });

  rl.on('close', () => {
    console.log(chalk.gray('\n  Admin CLI closed.'));
  });
}

// Start listening FIRST so Railway healthcheck passes, then connect to DB/Redis
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || 'development'})`);
  startAdminCli();
});

(async () => {
  try {
    await connectDB();
    dbReady = true;
    startCeuTopupCron();

    // Re-scan existing open exchanges for skill chains on startup (fire-and-forget)
    void (async () => {
      try {
        const { Exchange } = await import('./models/Exchange');
        const { detectAndCreateChains } = await import('./services/skillChainEngine');
        const openExchanges = await Exchange.find({ status: 'open', postId: { $exists: false } })
          .select('_id requester').lean() as Array<{ _id: { toString(): string }; requester: { toString(): string } }>;
        for (const ex of openExchanges) {
          detectAndCreateChains(ex._id.toString(), ex.requester.toString());
          await new Promise(r => setTimeout(r, 150));
        }
      } catch (e) { console.warn('⚠️  Skill chain rescan failed:', e); }
    })();

  } catch (err) {
    console.error('❌ MongoDB connection failed:', err);
    // Don't exit — let Railway see the process is alive; it will retry on next deploy
  }
  try {
    await connectRedis();
  } catch (err) {
    console.warn('⚠️  Redis not available, continuing without cache');
  }
})();
