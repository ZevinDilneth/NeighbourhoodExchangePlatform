import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  CircularProgress,
} from '@mui/material';
import api from '../services/api';
import { scanMedia } from '../utils/scanMedia';

// ─── Build personalised phases for a given user ──────────────────────────────
export const buildPhases = (
  userName: string,
  skills: { name: string }[],
  interests: { name: string }[],
) => {
  const skillList = skills.slice(0, 3).map((s) => s.name).join(', ') || 'my skills';
  const wantList  = interests.slice(0, 2).map((i) => i.name).join(' and ') || 'learning new skills';
  return [
    {
      duration: 4,
      instruction: 'Look directly at the camera',
      subtext: 'Hold still — make sure your face is well-lit and clearly visible.',
      icon: 'fa-eye',
    },
    {
      duration: 7,
      instruction: 'Introduce yourself',
      subtext: '',
      icon: 'fa-user',
      quote: true,
      quoteText: `"Hi, my name is ${userName}. I'm a real person and I'm here to share and learn with my neighbours."`,
    },
    {
      duration: 6,
      instruction: 'Describe what you offer',
      subtext: '',
      icon: 'fa-hands-helping',
      quote: true,
      quoteText: `"I can offer ${skillList}."`,
    },
    {
      duration: 5,
      instruction: 'Share what you want to learn',
      subtext: '',
      icon: 'fa-graduation-cap',
      quote: true,
      quoteText: `"I'm looking to learn ${wantList}."`,
    },
    {
      duration: 3,
      instruction: 'Slowly turn your head to the LEFT',
      subtext: 'Keep your face visible — this confirms you are physically present.',
      icon: 'fa-arrow-left',
    },
    {
      duration: 3,
      instruction: 'Slowly turn your head to the RIGHT',
      subtext: 'Return back through center.',
      icon: 'fa-arrow-right',
    },
    {
      duration: 3,
      instruction: 'Face forward and smile',
      subtext: 'Almost done — thank you for verifying!',
      icon: 'fa-smile',
    },
  ];
};

// ─── VideoIntroModal ─────────────────────────────────────────────────────────
interface VideoIntroModalProps {
  open: boolean;
  onClose: () => void;
  userName: string;
  userEmail?: string;
  userSkills: { name: string }[];
  userInterests: { name: string }[];
  onSaved: (url: string) => void;
}

const ADMIN_EMAIL = 'zevindilneth@gmail.com';

const VideoIntroModal: React.FC<VideoIntroModalProps> = ({
  open, onClose, userName, userEmail, userSkills, userInterests, onSaved,
}) => {
  const isAdmin = userEmail?.toLowerCase() === ADMIN_EMAIL;
  const PHASES = buildPhases(userName, userSkills, userInterests);
  const videoRef    = useRef<HTMLVideoElement>(null);
  const previewRef  = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  const [stage, setStage]         = useState<'ready' | 'recording' | 'review' | 'uploading'>('ready');
  const [phase, setPhase]         = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [blob, setBlob]           = useState<Blob | null>(null);
  const [isFileUpload, setIsFileUpload] = useState(false);
  const [isNsfwScanning, setIsNsfwScanning] = useState(false);
  const [camError, setCamError]   = useState('');
  const [uploadError, setUploadError] = useState('');

  const totalDuration   = PHASES.reduce((s, p) => s + p.duration, 0);
  const elapsedDuration = PHASES.slice(0, phase).reduce((s, p) => s + p.duration, 0);
  const overallProgress = Math.round(
    ((elapsedDuration + (PHASES[phase]?.duration ?? 0) - countdown) / totalDuration) * 100,
  );

  // Start camera when modal opens
  useEffect(() => {
    if (!open) return;
    setStage('ready');
    setPhase(0);
    setCountdown(0);
    setBlob(null);
    setIsFileUpload(false);
    setCamError('');
    setUploadError('');

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      })
      .catch(() =>
        setCamError('Camera access denied. Please allow camera and microphone access in your browser settings.'),
      );

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [open]);

  // Stop stream on close
  const handleClose = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    onClose();
  }, [onClose]);

  // Advance through phases automatically
  const startPhase = useCallback((idx: number) => {
    if (idx >= PHASES.length) {
      recorderRef.current?.stop();
      setStage('review');
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    setPhase(idx);
    setCountdown(PHASES[idx].duration);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          startPhase(idx + 1);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];

    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
      ? 'video/webm;codecs=vp9'
      : MediaRecorder.isTypeSupported('video/webm')
      ? 'video/webm'
      : 'video/mp4';

    const recorder = new MediaRecorder(streamRef.current, { mimeType });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const recorded = new Blob(chunksRef.current, { type: mimeType });
      setBlob(recorded);
      const url = URL.createObjectURL(recorded);
      setTimeout(() => {
        if (previewRef.current) {
          previewRef.current.src = url;
          previewRef.current.load();
        }
      }, 100);
    };

    recorder.start(100);
    setStage('recording');
    startPhase(0);
  }, [startPhase]);

  // Capture a single JPEG frame from the preview video for server-side NSFW scanning
  const captureFrame = (videoEl: HTMLVideoElement): Promise<Blob | null> =>
    new Promise((resolve) => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = videoEl.videoWidth  || 640;
        canvas.height = videoEl.videoHeight || 360;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.85);
      } catch {
        resolve(null);
      }
    });

  const handlePCFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    const MAX_BYTES = 100 * 1024 * 1024; // 100 MB
    if (file.size > MAX_BYTES) {
      setUploadError(`File is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). Maximum size is 100 MB.`);
      e.target.value = '';
      return;
    }
    e.target.value = '';

    // ── NSFW scan before advancing to review ──────────────────────────────────
    setUploadError('');
    setIsNsfwScanning(true);
    const scan = await scanMedia(file);
    setIsNsfwScanning(false);
    if (!scan.safe) {
      setUploadError(`"${file.name}" contains NSFW material and cannot be uploaded (${scan.reason ?? 'explicit content'}).`);
      return;
    }

    setIsFileUpload(true);
    setBlob(file);
    const url = URL.createObjectURL(file);
    setTimeout(() => {
      if (previewRef.current) {
        previewRef.current.src = url;
        previewRef.current.load();
      }
    }, 100);
    setStage('review');
  }, []);

  const handleUpload = useCallback(async () => {
    if (!blob) return;
    setStage('uploading');
    setUploadError('');
    try {
      const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const form = new FormData();
      form.append('video', blob, `video-intro.${ext}`);
      if (isFileUpload) form.append('source', 'upload');

      // Capture a frame for server-side ML NSFW scan
      if (previewRef.current) {
        const frame = await captureFrame(previewRef.current);
        if (frame) form.append('thumbnail', frame, 'thumbnail.jpg');
      }

      const res = await api.put('/users/me/video-intro', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 5 * 60 * 1000, // 5 minutes for large video files
      });
      onSaved(res.data.videoIntro);
      handleClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setUploadError(msg ?? 'Upload failed. Please try again.');
      setStage('review');
    }
  }, [blob, isFileUpload, onSaved, handleClose, previewRef]);

  const currentPhase = PHASES[phase];

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: '0.75rem', overflow: 'hidden', background: '#111827' } }}
    >
      {/* Header */}
      <DialogTitle sx={{
        background: 'linear-gradient(135deg, #4F46E5, #10B981)',
        color: '#fff',
        py: '1rem',
        px: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <i className="fas fa-video" style={{ fontSize: '1.125rem' }} />
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Poppins, sans-serif' }}>
              Identity Verification Video
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', opacity: 0.85 }}>
              Follow the on-screen instructions to verify your identity
            </Typography>
          </Box>
        </Box>
        <IconButton onClick={handleClose} sx={{ color: '#fff', '&:hover': { background: 'rgba(255,255,255,0.15)' } }}>
          <i className="fas fa-times" style={{ fontSize: '1rem' }} />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 320px' }, minHeight: 400 }}>

          {/* ── Left: camera / preview ── */}
          <Box sx={{ position: 'relative', background: '#000', minHeight: 360 }}>
            {camError ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', p: 3, gap: 2 }}>
                <i className="fas fa-camera-slash" style={{ fontSize: '3rem', color: '#EF4444' }} />
                <Typography sx={{ color: '#F9FAFB', textAlign: 'center', fontSize: '0.9375rem' }}>{camError}</Typography>
              </Box>
            ) : (
              <>
                {/* Live camera */}
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    display: stage === 'review' || stage === 'uploading' ? 'none' : 'block',
                  }}
                />
                {/* Recorded preview */}
                <video
                  ref={previewRef}
                  controls
                  playsInline
                  style={{
                    width: '100%', height: '100%', objectFit: 'cover', background: '#000',
                    display: stage === 'review' || stage === 'uploading' ? 'block' : 'none',
                  }}
                />

                {/* Phase overlay — shown while recording */}
                {stage === 'recording' && currentPhase && (
                  <Box sx={{
                    position: 'absolute', bottom: 0, left: 0, right: 0,
                    background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
                    p: '1.5rem 1.25rem 1.25rem',
                  }}>
                    <LinearProgress
                      variant="determinate"
                      value={overallProgress}
                      sx={{
                        mb: '1rem', height: 3, borderRadius: 2,
                        background: 'rgba(255,255,255,0.2)',
                        '& .MuiLinearProgress-bar': { background: 'linear-gradient(135deg, #4F46E5, #10B981)' },
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
                      <Box sx={{
                        width: 44, height: 44, borderRadius: '50%',
                        background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <i className={`fas ${currentPhase.icon}`} style={{ color: '#fff', fontSize: '1.125rem' }} />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1rem', mb: '0.25rem', fontFamily: 'Poppins, sans-serif' }}>
                          {currentPhase.instruction}
                        </Typography>
                        {currentPhase.quote ? (
                          <Typography sx={{
                            color: '#10B981', fontWeight: 600, fontSize: '0.9375rem', fontStyle: 'italic',
                            background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                            borderRadius: '0.375rem', px: '0.75rem', py: '0.375rem',
                            display: 'block', mt: '0.375rem', lineHeight: 1.6,
                          }}>
                            {(currentPhase as { quoteText?: string }).quoteText}
                          </Typography>
                        ) : (
                          <Typography sx={{ color: '#D1D5DB', fontSize: '0.8125rem' }}>{currentPhase.subtext}</Typography>
                        )}
                      </Box>
                      {/* Countdown bubble */}
                      <Box sx={{
                        width: 48, height: 48, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.4)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Typography sx={{ color: '#fff', fontWeight: 700, fontSize: '1.25rem', fontFamily: 'Poppins, sans-serif' }}>
                          {countdown}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Recording indicator */}
                {stage === 'recording' && (
                  <Box sx={{
                    position: 'absolute', top: '0.875rem', left: '0.875rem',
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    background: 'rgba(239,68,68,0.9)', px: '0.75rem', py: '0.375rem', borderRadius: '2rem',
                  }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', animation: 'pulse 1s infinite' }} />
                    <Typography sx={{ color: '#fff', fontSize: '0.75rem', fontWeight: 600 }}>REC</Typography>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* ── Right: steps panel ── */}
          <Box sx={{ background: '#1F2937', p: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <Typography sx={{ color: '#F9FAFB', fontWeight: 600, fontSize: '0.9375rem', fontFamily: 'Poppins, sans-serif', mb: '0.25rem' }}>
              Verification Steps
            </Typography>

            {PHASES.map((p, idx) => {
              const isDone    = stage === 'recording' && idx < phase;
              const isActive  = stage === 'recording' && idx === phase;
              const isPending = stage === 'recording' && idx > phase;
              return (
                <Box key={idx} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', opacity: isPending ? 0.4 : 1, transition: 'opacity 0.3s' }}>
                  <Box sx={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8125rem',
                    background: isDone ? '#10B981' : isActive ? 'linear-gradient(135deg, #4F46E5, #10B981)' : 'rgba(255,255,255,0.1)',
                    border: isDone || isActive ? 'none' : '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }}>
                    {isDone ? (
                      <i className="fas fa-check" style={{ color: '#fff' }} />
                    ) : (
                      <i className={`fas ${p.icon}`} style={{ color: isActive ? '#fff' : '#9CA3AF' }} />
                    )}
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{
                      color: isDone ? '#10B981' : isActive ? '#fff' : '#9CA3AF',
                      fontSize: '0.8125rem', fontWeight: isActive ? 600 : 400, lineHeight: 1.4,
                    }}>
                      {p.instruction}
                    </Typography>
                    <Typography sx={{ color: '#6B7280', fontSize: '0.75rem' }}>{p.duration}s</Typography>
                  </Box>
                </Box>
              );
            })}

            {/* Action buttons */}
            <Box sx={{ mt: 'auto', pt: '1rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {/* PC upload — admin only */}
              {isAdmin && stage === 'ready' && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/*"
                    style={{ display: 'none' }}
                    onChange={handlePCFileSelect}
                  />
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isNsfwScanning}
                    sx={{ background: 'rgba(79,70,229,0.15)', color: '#818CF8', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', py: '0.75rem', border: '1px solid rgba(79,70,229,0.4)', '&:hover': { background: 'rgba(79,70,229,0.25)' } }}
                  >
                    {isNsfwScanning
                      ? <><CircularProgress size={14} sx={{ mr: '0.5rem', color: '#818CF8' }} /> Scanning…</>
                      : <><i className="fas fa-folder-open" style={{ marginRight: '0.5rem' }} /> Upload from PC</>
                    }
                  </Button>
                </>
              )}

              {(stage === 'ready' || stage === 'recording') && !camError && (
                <Button
                  onClick={startRecording}
                  disabled={stage === 'recording'}
                  sx={{
                    background: stage === 'recording' ? 'rgba(239,68,68,0.2)' : 'linear-gradient(135deg, #4F46E5, #10B981)',
                    color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', py: '0.75rem',
                    '&:hover': { opacity: 0.9 },
                    '&:disabled': { color: '#EF4444', border: '1px solid #EF4444' },
                  }}
                >
                  {stage === 'recording' ? (
                    <><i className="fas fa-circle" style={{ marginRight: '0.5rem', color: '#EF4444', animation: 'pulse 1s infinite' }} /> Recording… follow instructions</>
                  ) : (
                    <><i className="fas fa-play" style={{ marginRight: '0.5rem' }} /> Start Recording</>
                  )}
                </Button>
              )}

              {stage === 'review' && (
                <>
                  {uploadError && (
                    <Typography sx={{ color: '#EF4444', fontSize: '0.8125rem', textAlign: 'center' }}>{uploadError}</Typography>
                  )}
                  <Button
                    onClick={handleUpload}
                    sx={{ background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: '#fff', fontWeight: 600, textTransform: 'none', borderRadius: '0.5rem', py: '0.75rem', '&:hover': { opacity: 0.9 } }}
                  >
                    <i className="fas fa-cloud-upload-alt" style={{ marginRight: '0.5rem' }} /> Save Verification Video
                  </Button>
                  {isAdmin && (
                    <>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="video/mp4,video/webm,video/ogg,video/*"
                        style={{ display: 'none' }}
                        onChange={handlePCFileSelect}
                      />
                      <Button
                        onClick={() => { setUploadError(''); fileInputRef.current?.click(); }}
                        sx={{ color: '#9CA3AF', fontWeight: 500, textTransform: 'none', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', py: '0.625rem', '&:hover': { borderColor: '#9CA3AF', background: 'rgba(255,255,255,0.05)' } }}
                      >
                        <i className="fas fa-folder-open" style={{ marginRight: '0.5rem' }} /> Choose Different File
                      </Button>
                    </>
                  )}
                  <Button
                    onClick={() => { setStage('ready'); setBlob(null); setIsFileUpload(false); }}
                    sx={{ color: '#9CA3AF', fontWeight: 500, textTransform: 'none', borderRadius: '0.5rem', border: '1px solid rgba(255,255,255,0.15)', py: '0.625rem', '&:hover': { borderColor: '#9CA3AF', background: 'rgba(255,255,255,0.05)' } }}
                  >
                    <i className="fas fa-redo" style={{ marginRight: '0.5rem' }} /> Record Again
                  </Button>
                </>
              )}

              {isNsfwScanning && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', py: '0.5rem' }}>
                  <CircularProgress size={32} sx={{ color: '#4F46E5' }} />
                  <Typography sx={{ color: '#9CA3AF', fontSize: '0.875rem' }}>Scanning for NSFW content…</Typography>
                </Box>
              )}

              {stage === 'uploading' && !isNsfwScanning && (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', py: '0.5rem' }}>
                  <CircularProgress size={32} sx={{ color: '#10B981' }} />
                  <Typography sx={{ color: '#9CA3AF', fontSize: '0.875rem' }}>Uploading verification video…</Typography>
                </Box>
              )}

              <Typography sx={{ color: '#6B7280', fontSize: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
                Total recording time: ~{totalDuration}s. Your video is stored securely and used only for identity verification.
              </Typography>
            </Box>
          </Box>
        </Box>
      </DialogContent>

      <style>{`@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }`}</style>
    </Dialog>
  );
};

export default VideoIntroModal;
