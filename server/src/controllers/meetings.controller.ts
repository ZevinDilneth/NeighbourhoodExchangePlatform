import { Response } from 'express';
import path from 'path';
import fs from 'fs';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import Meeting from '../models/Meeting';
import { User } from '../models/User';
import { Exchange } from '../models/Exchange';
import { createError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

// ── Env ───────────────────────────────────────────────────────────────────────
const DAILY_API_KEY        = process.env.DAILY_API_KEY         ?? '';
const DAILY_WEBHOOK_SECRET = process.env.DAILY_WEBHOOK_SECRET  ?? '';
const RECORDINGS_BASE_DIR  = process.env.RECORDINGS_BASE_DIR   ?? path.join(process.cwd(), 'recordings');
const DAILY_API_BASE       = 'https://api.daily.co/v1';

// ── Daily.co API helper ───────────────────────────────────────────────────────
const dailyFetch = async <T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  if (!DAILY_API_KEY) throw createError('DAILY_API_KEY is not configured', 500);

  const res = await fetch(`${DAILY_API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw createError(`Daily.co API error ${res.status}: ${body}`, 502);
  }
  return res.json() as Promise<T>;
};

// ── POST /api/meetings/create ─────────────────────────────────────────────────
// Idempotent: if a live room already exists for this exchange, reuse it.
// Each exchange gets exactly ONE persistent Daily.co room.
// Only exchange participants (requester / provider) may start or join.
// The FIRST user to click "Start Meeting" becomes the admin (owner) and can kick.
export const createMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const user = await User.findById(userId).select('name username email avatar');
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const { title, exchangeId } = req.body as { title?: string; exchangeId?: string };
    const tokenExpiry = Math.floor(new Date(Date.now() + 24 * 60 * 60 * 1000).getTime() / 1000);
    const userName = (user as any).name ?? (user as any).username ?? 'Host';

    // ── Gate: only exchange parties can start / join ────────────────────────
    if (exchangeId) {
      const exchange = await Exchange.findById(exchangeId);
      if (!exchange) { res.status(404).json({ error: 'Exchange not found' }); return; }

      const uid = userId.toString();
      const isRequester = exchange.requester.toString() === uid;
      const isProvider  = exchange.provider?.toString()  === uid;
      if (!isRequester && !isProvider) {
        res.status(403).json({ error: 'Only the requester or provider can start this meeting' });
        return;
      }
    }

    // ── Reuse existing room for this exchange ──────────────────────────────
    if (exchangeId) {
      const existing = await Meeting.findOne({
        exchangeId,
        status: { $in: ['pending', 'active'] },
      });

      if (existing) {
        // Room already exists — the original creator is the admin (owner)
        const isAdmin = existing.creatorId.toString() === userId.toString();
        const tokenRes = await dailyFetch<{ token: string }>('/meeting-tokens', {
          method: 'POST',
          body: JSON.stringify({
            properties: {
              room_name:             existing.roomId,
              is_owner:              isAdmin,          // only admin can kick / manage
              start_cloud_recording: isAdmin,
              enable_recording_ui:   false,
              user_id:               userId.toString(),
              user_name:             userName,
              exp:                   tokenExpiry,
              // is_owner already grants eject ability
            },
          }),
        });

        // Track participant
        const uid = (user as any)._id.toString();
        if (!existing.participants.some((p: any) => p.toString() === uid)) {
          existing.participants.push((user as any)._id as any);
          if (existing.status === 'pending') existing.status = 'active';
          await existing.save();
        }

        const room = await dailyFetch<{ url: string }>(`/rooms/${existing.roomId}`);
        const url = `${room.url}?t=${tokenRes.token}`;

        res.json({
          roomId:    existing.roomId,
          token:     tokenRes.token,
          url,
          meetingId: existing._id,
          reused:    true,
          isAdmin,
        });
        return;
      }
    }

    // ── First time — create a new Daily.co room ────────────────────────────
    // The user who clicks first becomes the meeting admin (owner).
    const roomName = `nex-${Math.random().toString(36).slice(2, 9)}`;

    const room = await dailyFetch<{ name: string; url: string }>('/rooms', {
      method: 'POST',
      body: JSON.stringify({
        name:    roomName,
        privacy: 'public',
        properties: {
          enable_chat:        true,
          enable_recording:   'cloud',
          enable_screenshare: true,
          max_participants:   20,
          enable_knocking:    true,
          enable_prejoin_ui:  true,
          eject_at_room_exp:  true,  // auto-eject when room expires
        },
      }),
    });

    // Owner token — admin can kick participants and auto-starts recording
    const tokenRes = await dailyFetch<{ token: string }>('/meeting-tokens', {
      method: 'POST',
      body: JSON.stringify({
        properties: {
          room_name:             roomName,
          is_owner:              true,
          start_cloud_recording: true,
          enable_recording_ui:   false,
          // is_owner already grants eject ability
          user_id:               userId.toString(),
          user_name:             userName,
          exp:                   tokenExpiry,
        },
      }),
    });

    const meeting = await Meeting.create({
      roomId:     roomName,
      exchangeId: exchangeId || undefined,
      creatorId:  (user as any)._id,
      title:      title ?? `Exchange meeting — ${new Date().toLocaleDateString()}`,
      status:     'pending',
    });

    const url = `${room.url}?t=${tokenRes.token}`;

    res.json({
      roomId:    roomName,
      token:     tokenRes.token,
      url,
      meetingId: meeting._id,
      reused:    false,
      isAdmin:   true,  // first user to start is always admin
    });
  } catch (err) {
    console.error('[meetings] createMeeting error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to create/join meeting' });
  }
};

// ── POST /api/meetings/join/:roomId ───────────────────────────────────────────
// Participant gets a Daily.co participant token for an existing room.
export const joinMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) throw createError('Unauthorized', 401);

  const user = await User.findById(userId).select('name username email avatar');
  if (!user) throw createError('User not found', 404);

  const { roomId } = req.params;

  const meeting = await Meeting.findOne({ roomId });
  if (!meeting) throw createError('Meeting room not found', 404);
  if (meeting.status === 'ended') throw createError('This meeting has ended', 410);

  // Track participant
  const uid = (user as any)._id.toString();
  if (!meeting.participants.some((p: any) => p.toString() === uid)) {
    meeting.participants.push((user as any)._id as any);
    if (meeting.status === 'pending') meeting.status = 'active';
    await meeting.save();
  }

  const tokenExpiry = Math.floor(new Date(Date.now() + 24 * 60 * 60 * 1000).getTime() / 1000);

  const tokenRes = await dailyFetch<{ token: string }>('/meeting-tokens', {
    method: 'POST',
    body: JSON.stringify({
      properties: {
        room_name: roomId,
        is_owner:  false,
        user_id:   uid,
        user_name: (user as any).name ?? (user as any).username ?? 'Participant',
        exp:       tokenExpiry,
      },
    }),
  });

  const room = await dailyFetch<{ url: string }>(`/rooms/${roomId}`);
  const url = `${room.url}?t=${tokenRes.token}`;
  res.json({ roomId, token: tokenRes.token, url });
};

// ── POST /api/meetings/recording/webhook ──────────────────────────────────────
// Called by Daily.co for lifecycle events. Configure this endpoint in Daily.co
// dashboard → Webhooks.  Handles:
//   • meeting.ended              — all participants left → mark meeting ended
//   • recording.ready-to-download — recording processed → download & store
export const recordingWebhook = async (req: AuthRequest, res: Response): Promise<void> => {
  const { action, recording, room_name } = req.body as {
    action: string;
    room_name?: string;
    recording?: {
      id:           string;
      room_name:    string;
      download_url: string;
      duration:     number;
      start_ts:     number;
    };
  };

  // ── meeting.ended — last participant left the room ───────────────────────
  if (action === 'meeting.ended') {
    const roomId = room_name ?? (req.body as any).name;
    if (roomId) {
      const meeting = await Meeting.findOne({ roomId, status: { $in: ['pending', 'active'] } });
      if (meeting) {
        meeting.status  = 'ended';
        meeting.endedAt = new Date();
        await meeting.save();
        console.log(`[meetings] Meeting ended (all left): ${roomId}`);
      }
    }
    res.json({ ok: true });
    return;
  }

  // ── recording.ready-to-download ──────────────────────────────────────────
  if (action !== 'recording.ready-to-download' || !recording) {
    res.json({ ok: true });
    return;
  }

  const { room_name: roomId, download_url: downloadUrl, duration, start_ts: startTs } = recording;

  // Ensure recordings folder exists
  const dir = path.join(RECORDINGS_BASE_DIR, roomId);
  fs.mkdirSync(dir, { recursive: true });

  // Download the recording file
  let recordingFile = '';
  try {
    const fileRes = await fetch(downloadUrl);
    if (fileRes.ok && fileRes.body) {
      recordingFile = path.join(dir, 'recording.mp4');
      await pipeline(
        Readable.fromWeb(fileRes.body as any),
        fs.createWriteStream(recordingFile),
      );
    }
  } catch (err) {
    console.error('[meetings] Recording download failed:', err);
  }

  // Write metadata JSON
  const metadata = {
    roomId,
    recordingId: recording.id,
    startedAt:   new Date(startTs * 1000).toISOString(),
    duration,
    recordingFile: recordingFile ? path.basename(recordingFile) : null,
    downloadedAt:  new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'metadata.json'), JSON.stringify(metadata, null, 2));

  // Update meeting record
  const meeting = await Meeting.findOne({ roomId });
  if (meeting) {
    meeting.status         = 'ended';
    meeting.endedAt        = new Date();
    meeting.recordingDir   = dir;
    meeting.recordingFiles = recordingFile ? ['recording.mp4'] : [];
    await meeting.save();

    // ── Auto-export exchange messages as chat.json ──────────────────────────
    if (meeting.exchangeId) {
      try {
        const exchange = await Exchange.findById(meeting.exchangeId)
          .populate('requester', 'name')
          .populate('provider',  'name');

        if (exchange && exchange.messages.length > 0) {
          const requesterName = (exchange.requester as any)?.name ?? 'Requester';
          const providerName  = (exchange.provider  as any)?.name ?? 'Provider';
          const requesterId   = (exchange.requester as any)?._id?.toString() ?? exchange.requester.toString();

          const chatData = exchange.messages.map((m: any) => ({
            from:      m.sender.toString() === requesterId ? requesterName : providerName,
            senderId:  m.sender.toString(),
            message:   m.content,
            time:      new Date(m.timestamp).toISOString(),
          }));

          const chatFile = path.join(dir, 'chat.json');
          fs.writeFileSync(chatFile, JSON.stringify(chatData, null, 2));
          meeting.chatExportPath = chatFile;
          await meeting.save();
          console.log(`[meetings] Exchange chat exported: ${chatFile}`);
        }
      } catch (chatErr) {
        console.error('[meetings] Chat export failed:', chatErr);
      }
    }
  }

  console.log(`[meetings] Recording saved: ${dir}`);
  res.json({ ok: true });
};

// ── POST /api/meetings/chat/export ────────────────────────────────────────────
// Called by the frontend when a meeting ends — sends captured chat messages.
export const exportChat = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) throw createError('Unauthorized', 401);

  const { roomId, messages } = req.body as {
    roomId: string;
    messages: Array<{ time: string; from: string; message: string }>;
  };

  if (!roomId || !Array.isArray(messages)) throw createError('roomId and messages are required', 400);

  const dir = path.join(RECORDINGS_BASE_DIR, roomId);
  fs.mkdirSync(dir, { recursive: true });

  const chatFile = path.join(dir, 'chat.json');
  fs.writeFileSync(chatFile, JSON.stringify(messages, null, 2));

  const meeting = await Meeting.findOne({ roomId });
  if (meeting) {
    meeting.chatExportPath = chatFile;
    await meeting.save();
  }

  res.json({ ok: true, chatFile });
};

// ── GET /api/meetings/:roomId ─────────────────────────────────────────────────
export const getMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) throw createError('Unauthorized', 401);

  const meeting = await Meeting.findOne({ roomId: req.params.roomId })
    .populate('creatorId', 'name username avatar')
    .populate('participants', 'name username avatar');

  if (!meeting) throw createError('Meeting not found', 404);

  const uid = userId.toString();
  const isCreator     = (meeting.creatorId as any)._id?.toString() === uid || meeting.creatorId.toString() === uid;
  const isParticipant = meeting.participants.some((p: any) => (p._id ?? p).toString() === uid);

  if (!isCreator && !isParticipant) throw createError('Access denied', 403);

  res.json({ meeting });
};

// ── GET /api/meetings/exchange/:exchangeId ────────────────────────────────────
// Returns the most recent meeting linked to an exchange, plus file availability.
// Wrapped in try/catch because Express 4 doesn't catch async throws.
export const getMeetingByExchange = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const { exchangeId } = req.params;

    const exchange = await Exchange.findById(exchangeId);
    if (!exchange) { res.json({ meeting: null }); return; }

    const uid = userId.toString();
    const isRequester = exchange.requester.toString() === uid;
    const isProvider  = exchange.provider?.toString()  === uid;

    // Non-parties just get null — no crash
    if (!isRequester && !isProvider) { res.json({ meeting: null }); return; }

    const meeting = await Meeting.findOne({ exchangeId }).sort({ createdAt: -1 });
    if (!meeting) { res.json({ meeting: null }); return; }

    // ── Live presence check — if meeting looks active, verify with Daily.co ─
    if (['pending', 'active'].includes(meeting.status) && DAILY_API_KEY) {
      try {
        const presence = await dailyFetch<{ total_count: number }>(
          `/rooms/${meeting.roomId}/presence`
        );
        // Nobody in the room → mark as ended
        if (presence.total_count === 0) {
          meeting.status  = 'ended';
          meeting.endedAt = new Date();
          await meeting.save();
          console.log(`[meetings] Room empty — auto-ended: ${meeting.roomId}`);
        }
      } catch {
        // Room may have been deleted or API error — mark ended
        meeting.status  = 'ended';
        meeting.endedAt = new Date();
        await meeting.save();
      }
    }

    const dir          = meeting.recordingDir ?? '';
    const hasRecording = dir ? fs.existsSync(path.join(dir, 'recording.mp4')) : false;
    const hasChat      = dir ? fs.existsSync(path.join(dir, 'chat.json'))     : false;

    res.json({
      meeting: {
        _id:       meeting._id,
        roomId:    meeting.roomId,
        status:    meeting.status,
        creatorId: meeting.creatorId,
        endedAt:   meeting.endedAt,
      },
      hasRecording,
      hasChat,
    });
  } catch (err) {
    console.error('[meetings] getMeetingByExchange error:', err);
    res.json({ meeting: null });
  }
};

// ── GET /api/meetings/:roomId/recording ───────────────────────────────────────
// Streams recording.mp4 to authenticated party member.
export const streamRecording = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }

    const uid         = userId.toString();
    const isCreator   = meeting.creatorId.toString() === uid;
    const isParticipant = meeting.participants.some((p: any) => p.toString() === uid);
    if (!isCreator && !isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    const filePath = path.join(meeting.recordingDir ?? '', 'recording.mp4');
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Recording not found' }); return; }

    const stat = fs.statSync(filePath);
    res.setHeader('Content-Type',        'video/mp4');
    res.setHeader('Content-Length',      stat.size);
    res.setHeader('Content-Disposition', 'attachment; filename="recording.mp4"');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[meetings] streamRecording error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

// ── GET /api/meetings/:roomId/chat ────────────────────────────────────────────
// Returns chat.json to authenticated party member.
export const streamChat = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }

    const uid         = userId.toString();
    const isCreator   = meeting.creatorId.toString() === uid;
    const isParticipant = meeting.participants.some((p: any) => p.toString() === uid);
    if (!isCreator && !isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    const filePath = path.join(meeting.recordingDir ?? '', 'chat.json');
    if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'Chat export not found' }); return; }

    res.setHeader('Content-Type',        'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="chat.json"');
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    console.error('[meetings] streamChat error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
  }
};

// ── POST /api/meetings/:roomId/end ────────────────────────────────────────────
// Admin or any party can manually end the meeting. Also stops cloud recording
// via Daily.co API so the webhook fires to download the file.
export const endMeeting = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const meeting = await Meeting.findOne({ roomId: req.params.roomId });
    if (!meeting) { res.status(404).json({ error: 'Meeting not found' }); return; }

    if (meeting.status === 'ended') { res.json({ ok: true, already: true }); return; }

    const uid       = userId.toString();
    const isCreator = meeting.creatorId.toString() === uid;
    const isParticipant = meeting.participants.some((p: any) => p.toString() === uid);
    if (!isCreator && !isParticipant) { res.status(403).json({ error: 'Access denied' }); return; }

    // Stop cloud recording via Daily.co (triggers recording.ready-to-download webhook)
    try {
      await dailyFetch(`/rooms/${meeting.roomId}/recordings`, { method: 'DELETE' });
    } catch { /* recording may not be active — ignore */ }

    meeting.status  = 'ended';
    meeting.endedAt = new Date();
    await meeting.save();

    console.log(`[meetings] Meeting manually ended by ${uid}: ${meeting.roomId}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('[meetings] endMeeting error:', err);
    if (!res.headersSent) res.status(500).json({ error: 'Failed to end meeting' });
  }
};

// ── GET /api/meetings ─────────────────────────────────────────────────────────
export const listMeetings = async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.userId;
  if (!userId) throw createError('Unauthorized', 401);

  const meetings = await Meeting.find({
    $or: [{ creatorId: userId }, { participants: userId }],
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate('creatorId', 'name username avatar')
    .populate('exchangeId', 'title');

  res.json({ meetings });
};
