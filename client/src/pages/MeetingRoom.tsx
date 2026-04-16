import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Box } from '@mui/material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const GRAD        = 'linear-gradient(135deg, #4F46E5, #10B981)';
const DAILY_DOMAIN = import.meta.env.VITE_DAILY_DOMAIN ?? 'neighbourhood-app.daily.co';

interface ChatMsg { id: string; fromId: string; fromName: string; text: string; time: string; }

export default function MeetingRoom() {
  const { roomId }      = useParams<{ roomId: string }>();
  const [searchParams]  = useSearchParams();
  const navigate        = useNavigate();
  const { user }        = useAuth();

  const chatEndRef  = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [token,        setToken]        = useState(searchParams.get('token') ?? searchParams.get('t') ?? '');
  const [loading,      setLoading]      = useState(!token);
  const [error,        setError]        = useState('');
  const [messages,     setMessages]     = useState<ChatMsg[]>([]);
  const [input,        setInput]        = useState('');

  // ── Fetch a participant token if none in URL ──────────────────────────────
  useEffect(() => {
    if (token || !roomId) return;
    setLoading(true);
    api.post<{ token: string }>(`/meetings/join/${roomId}`)
      .then(r => { setToken(r.data.token); setLoading(false); })
      .catch(e => {
        setError(e?.response?.data?.message ?? 'Could not join this meeting.');
        setLoading(false);
      });
  }, [roomId, token]);

  // ── Export chat when user leaves ──────────────────────────────────────────
  const exportChat = useCallback(async (msgs: ChatMsg[]) => {
    if (!roomId || msgs.length === 0) return;
    try {
      await api.post('/meetings/chat/export', {
        roomId,
        messages: msgs.map(m => ({ time: m.time, from: m.fromName, message: m.text })),
      });
    } catch { /* silent */ }
  }, [roomId]);

  // ── Listen for postMessage events from the Daily.co iframe ───────────────
  const messagesRef = useRef<ChatMsg[]>([]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      const { action, data } = e.data as { action?: string; data?: any };

      if (action === 'left-meeting' || action === 'meeting-left') {
        exportChat(messagesRef.current).then(() => navigate(-1));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [exportChat, navigate]);

  const scrollChat = () => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);

  const sendMsg = () => {
    const text = input.trim();
    if (!text) return;
    const msg: ChatMsg = {
      id: `${Date.now()}`, fromId: user?._id ?? 'me',
      fromName: user?.name ?? 'You', text, time: new Date().toISOString(),
    };
    setMessages(prev => [...prev, msg]);
    messagesRef.current = [...messagesRef.current, msg];
    setInput('');
    if (textareaRef.current) textareaRef.current.style.height = '44px';
    scrollChat();
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  // ── Loading screen ────────────────────────────────────────────────────────
  if (loading) return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', gap: 2 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontSize: 24 }}>
        <i className="fas fa-video" />
      </Box>
      <div style={{ fontFamily: '"Poppins",sans-serif', fontWeight: 600, fontSize: 18, color: '#1F2937' }}>Joining meeting…</div>
      <div style={{ fontFamily: '"Inter",sans-serif', fontSize: 14, color: '#6B7280' }}>Verifying your platform account</div>
    </Box>
  );

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#F9FAFB', gap: 2 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: '50%', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444', fontSize: 24 }}>
        <i className="fas fa-lock" />
      </Box>
      <div style={{ fontFamily: '"Poppins",sans-serif', fontWeight: 600, fontSize: 18, color: '#1F2937' }}>Access Denied</div>
      <div style={{ fontFamily: '"Inter",sans-serif', fontSize: 14, color: '#6B7280', maxWidth: 320, textAlign: 'center' }}>{error}</div>
      <button onClick={() => navigate('/')} style={{ marginTop: 8, padding: '0.625rem 1.5rem', background: GRAD, border: 'none', borderRadius: '0.75rem', color: '#FFF', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
        Back to platform
      </button>
    </Box>
  );

  // ── Meeting room ──────────────────────────────────────────────────────────
  const iframeSrc = `https://${DAILY_DOMAIN}/${roomId}?t=${encodeURIComponent(token)}`;

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: '"Inter","Helvetica","Arial",sans-serif' }}>

      {/* ── Video (Daily.co iframe) ────────────────────────── */}
      <Box sx={{ flex: 1, position: 'relative', minWidth: 0, background: '#111827' }}>
        <iframe
          src={iframeSrc}
          allow="camera *; microphone *; fullscreen *; speaker *; display-capture *; autoplay *"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          title="Meeting"
        />
      </Box>

      {/* ── Chat panel ────────────────────────────────────── */}
      <Box sx={{ width: 320, display: 'flex', flexDirection: 'column', background: '#FFFFFF', borderLeft: '1px solid #E5E7EB' }}>

        {/* Header */}
        <Box sx={{ background: '#FFFFFF', borderBottom: '1px solid #E5E7EB', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Box sx={{ width: 40, height: 40, borderRadius: '0.75rem', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', flexShrink: 0 }}>
              <i className="fas fa-video" style={{ fontSize: 16 }} />
            </Box>
            <Box>
              <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.25, fontFamily: '"Poppins",sans-serif' }}>Meeting Chat</div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: 2 }}>Notes saved when you leave</div>
            </Box>
          </Box>
          <span style={{ fontSize: 10, fontWeight: 700, color: '#4F46E5', background: 'rgba(79,70,229,0.08)', borderRadius: 6, padding: '3px 8px', letterSpacing: '0.06em', textTransform: 'uppercase', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {roomId}
          </span>
        </Box>

        {/* Leave button */}
        <Box sx={{ px: '1.25rem', pt: '0.875rem' }}>
          <button
            onClick={async () => { await exportChat(messagesRef.current); navigate(-1); }}
            style={{ width: '100%', padding: '0.5rem', background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: '0.625rem', color: '#EF4444', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: '"Inter",sans-serif' }}
          >
            <i className="fas fa-phone-slash" />
            Leave & save chat
          </button>
        </Box>

        {/* Messages */}
        <Box sx={{ flex: 1, overflowY: 'auto', background: '#FFFFFF', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.875rem', mt: '0.5rem' }}>
          {messages.length === 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4, gap: 1 }}>
              <Box sx={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(79,70,229,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="fas fa-comments" style={{ fontSize: 20, color: '#4F46E5' }} />
              </Box>
              <div style={{ fontSize: 13, color: '#6B7280', textAlign: 'center' }}>
                Private notes<br />
                <span style={{ color: '#9CA3AF', fontSize: 11 }}>Only you can see these — saved when you leave</span>
              </div>
            </Box>
          )}

          {messages.map(m => {
            const isMe = m.fromId === (user?._id ?? 'me');
            return (
              <Box key={m.id} sx={{ display: 'flex', flexDirection: 'column', alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
                <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexDirection: isMe ? 'row-reverse' : 'row' }}>
                  {!isMe && (
                    <Box sx={{ width: 28, height: 28, borderRadius: '50%', background: GRAD, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF', fontWeight: 600, fontSize: '0.7rem', flexShrink: 0 }}>
                      {m.fromName[0]?.toUpperCase()}
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {!isMe && <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1F2937', marginBottom: 3, marginLeft: 4 }}>{m.fromName}</div>}
                    <Box sx={{ background: isMe ? '#E0F2FE' : '#F3F4F6', borderRadius: isMe ? '1rem 1rem 0.375rem 1rem' : '1rem 1rem 1rem 0.375rem', padding: '0.625rem 0.875rem', color: '#1F2937', fontSize: '0.875rem', wordBreak: 'break-word', lineHeight: 1.5 }}>
                      {m.text}
                    </Box>
                    <div style={{ fontSize: '0.7rem', color: '#9CA3AF', marginTop: 3, textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : 4, paddingRight: isMe ? 4 : 0 }}>
                      {new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </Box>
                </Box>
              </Box>
            );
          })}
          <div ref={chatEndRef} />
        </Box>

        {/* Input */}
        <Box sx={{ background: '#FFFFFF', borderTop: '1px solid #E5E7EB', padding: '0.875rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', flexShrink: 0 }}>
          <Box sx={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              placeholder="Take notes during the meeting…"
              value={input}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKey}
              rows={1}
              style={{ flex: 1, padding: '0.625rem 0.875rem', border: '1px solid #E5E7EB', borderRadius: '0.75rem', fontSize: '0.875rem', background: '#F9FAFB', resize: 'none', minHeight: 44, maxHeight: 120, outline: 'none', fontFamily: '"Inter","Helvetica","Arial",sans-serif', lineHeight: 1.5, overflowY: 'auto', color: '#1F2937', transition: 'border-color 0.15s, box-shadow 0.15s' }}
              onFocus={e => { e.currentTarget.style.borderColor = '#4F46E5'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(79,70,229,0.1)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <button
              onClick={sendMsg}
              disabled={!input.trim()}
              style={{ width: 44, height: 44, background: input.trim() ? GRAD : '#E5E7EB', border: 'none', borderRadius: '0.75rem', color: '#FFF', fontSize: '1rem', cursor: input.trim() ? 'pointer' : 'not-allowed', opacity: input.trim() ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.15s, opacity 0.15s' }}
              onMouseEnter={e => { if (input.trim()) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
            >
              <i className="fas fa-paper-plane" />
            </button>
          </Box>
          <div style={{ fontSize: '0.7rem', color: '#9CA3AF', textAlign: 'center' }}>Notes saved automatically when you leave</div>
        </Box>
      </Box>
    </Box>
  );
}
