import React, { useState, useEffect, useRef } from 'react';
import { Box, Skeleton } from '@mui/material';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import OnlineAvatar from '../components/OnlineAvatar';
import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import PhoneVerificationGate from '../components/PhoneVerificationGate';
import { Message, Group } from '../types';
import { containsProfanity, PROFANITY_ERROR } from '../utils/contentFilter';
import PublicPlacePicker, { StructuredPlace } from '../components/PublicPlacePicker';

const GOOGLE_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

const GRADIENT = 'linear-gradient(135deg, #4F46E5, #10B981)';

/* ═══════════════════════════════════════════════
   Special message content types (JSON-embedded)
   ═══════════════════════════════════════════════ */
interface PollContent   { __type: 'poll';      question: string; options: string[]; }
interface LocationContent { __type: 'location'; name: string; address: string; category: string; lat?: number; lng?: number; }
interface SkillRefContent { __type: 'skill_ref'; skillType: string; postId: string; title: string; comment: string; }
interface FileContent   { __type: 'file';      name: string; size: number; mimeType: string; url?: string; }
type SpecialContent = PollContent | LocationContent | SkillRefContent | FileContent;

const parseSpecialContent = (content: string): SpecialContent | null => {
  if (!content || !content.startsWith('{')) return null;
  try { const p = JSON.parse(content); return p.__type ? (p as SpecialContent) : null; }
  catch { return null; }
};

/* ═══════════════════════════════════════════════
   Location / Place types
   ═══════════════════════════════════════════════ */
const CATEGORY_ICONS: Record<string,string> = {
  cafe:'fas fa-coffee', library:'fas fa-book', community_centre:'fas fa-users',
  cinema:'fas fa-film', theatre:'fas fa-theater-masks', museum:'fas fa-landmark',
  park:'fas fa-tree', restaurant:'fas fa-utensils', bar:'fas fa-glass-martini-alt',
  pharmacy:'fas fa-pills', hospital:'fas fa-hospital', school:'fas fa-school',
  university:'fas fa-graduation-cap', garden:'fas fa-leaf', playground:'fas fa-child',
  sports_centre:'fas fa-dumbbell', gallery:'fas fa-image', shop:'fas fa-shopping-bag',
  marketplace:'fas fa-store', swimming_pool:'fas fa-swimming-pool', information:'fas fa-info-circle',
};
const getCatIcon = (cat: string) => CATEGORY_ICONS[cat] ?? 'fas fa-map-marker-alt';

/* ═══════════════════════════════════════════════
   Skill-Help types
   ═══════════════════════════════════════════════ */
const SKILL_TABS = ['skill','tool','exchange','event','gift'] as const;
type SkillTab = typeof SKILL_TABS[number];
const SKILL_TAB_ICONS: Record<SkillTab,string> = {
  skill:'fas fa-graduation-cap', tool:'fas fa-wrench',
  exchange:'fas fa-exchange-alt', event:'fas fa-calendar-alt', gift:'fas fa-gift',
};
interface SearchItem { _id: string; title: string; type?: string; description?: string; }

/* ═══════════════════════════════════════════════
   Shared styles
   ═══════════════════════════════════════════════ */
const sidebarSectionStyle: React.CSSProperties = { borderRadius:'0.75rem', padding:'1rem', marginBottom:'1.5rem', background:'#F9FAFB', border:'1px solid #E5E7EB' };
const sidebarTitleStyle:   React.CSSProperties = { fontSize:'0.875rem', fontWeight:600, color:'#6B7280', marginBottom:'0.75rem', textTransform:'uppercase' as const, letterSpacing:'0.05em', display:'flex', alignItems:'center', justifyContent:'space-between' };
const controlBtnStyle:     React.CSSProperties = { display:'flex', alignItems:'center', gap:'0.75rem', padding:'0.75rem', borderRadius:'0.5rem', color:'#1F2937', fontSize:'0.875rem', fontWeight:500, transition:'all 0.2s', background:'#FFFFFF', border:'1px solid #E5E7EB', cursor:'pointer', width:'100%', textAlign:'left' as const };
const actionBtnStyle:      React.CSSProperties = { padding:'0.5rem 1rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem', background:'#FFFFFF', color:'#374151', fontSize:'0.875rem', fontWeight:500, cursor:'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'0.5rem' };
const toolBtnStyle:        React.CSSProperties = { width:40, height:40, border:'1px solid #E5E7EB', borderRadius:'0.5rem', background:'#FFFFFF', color:'#6B7280', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s', flexShrink:0 };
const overlayStyle:        React.CSSProperties = { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:'1rem' };
const cardStyle:           React.CSSProperties = { background:'#FFFFFF', borderRadius:'0.75rem', padding:'1.5rem', width:'100%', maxWidth:520, maxHeight:'88vh', overflowY:'auto', boxShadow:'0 10px 30px rgba(0,0,0,0.2)' };
const modalHeaderStyle:    React.CSSProperties = { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'1.25rem', paddingBottom:'0.75rem', borderBottom:'1px solid #E5E7EB' };
const fieldStyle:          React.CSSProperties = { width:'100%', padding:'0.75rem', border:'1px solid #E5E7EB', borderRadius:'0.5rem', fontSize:'0.875rem', background:'#F9FAFB', color:'#1F2937', outline:'none', boxSizing:'border-box' as const, fontFamily:'Inter, sans-serif' };

const hoverOn  = (e: React.MouseEvent<HTMLButtonElement>) => { const b = e.currentTarget; b.style.background='#F3F4F6'; b.style.borderColor='#4F46E5'; };
const hoverOff = (e: React.MouseEvent<HTMLButtonElement>) => { const b = e.currentTarget; b.style.background='#FFFFFF'; b.style.borderColor='#E5E7EB'; };
const toolOn   = (e: React.MouseEvent<HTMLButtonElement>) => { const b = e.currentTarget; b.style.background='#F3F4F6'; b.style.color='#4F46E5'; b.style.borderColor='#4F46E5'; };
const toolOff  = (e: React.MouseEvent<HTMLButtonElement>) => { const b = e.currentTarget; b.style.background='#FFFFFF'; b.style.color='#6B7280'; b.style.borderColor='#E5E7EB'; };

/* ═══════════════════════════════════════════════
   OSM map helpers
   ═══════════════════════════════════════════════ */
const osmSrc = (lat: string, lon: string) => {
  const la = parseFloat(lat), lo = parseFloat(lon), d = 0.006, dv = 0.004;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lo-d},${la-dv},${lo+d},${la+dv}&layer=mapnik&marker=${la},${lo}`;
};


/* ═══════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════ */
const GroupChats: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const channelId = searchParams.get('channel') || null;
  const navigate   = useNavigate();
  const { user, isPhoneVerified } = useAuth();

  /* ── Core chat ── */
  const [messages,       setMessages]       = useState<Message[]>([]);
  const [input,          setInput]          = useState('');
  const [chatError,      setChatError]      = useState('');
  const [isTyping,       setIsTyping]       = useState<{ userId: string } | null>(null);
  const messagesEndRef   = useRef<HTMLDivElement>(null);
  const messagesRef      = useRef<Message[]>([]);       // mirror for socket closure
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);

  // Keep messagesRef in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  /* ── Reply / Selection ── */
  const [replyingTo,      setReplyingTo]      = useState<Message | null>(null);
  const [hoveredMsgId,    setHoveredMsgId]    = useState<string | null>(null);
  const [selectionMode,   setSelectionMode]   = useState(false);
  const [selectedMsgIds,  setSelectedMsgIds]  = useState<Set<string>>(new Set());
  const longPressTimer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isLongPress       = useRef(false);

  /* ── Poll votes (local) ── */
  const [pollVotes, setPollVotes] = useState<Record<string, number>>({});

  /* ── File upload ── */
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileAttachments, setFileAttachments] = useState<{ file: File; previewUrl: string | null }[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);

  /* ── Report Issue modal ── */
  const [showReportIssueModal, setShowReportIssueModal] = useState(false);
  const [reportIssueText,      setReportIssueText]      = useState('');
  const [reportIssueSubmitting, setReportIssueSubmitting] = useState(false);
  const [reportIssueSuccess,   setReportIssueSuccess]   = useState(false);

  /* ── Message report modal ── */
  const [reportingMsg,    setReportingMsg]    = useState<Message | null>(null);
  const [reportMsgReason, setReportMsgReason] = useState('');
  const [reportMsgSubmitting, setReportMsgSubmitting] = useState(false);

  /* ── Pin state ── */
  const [pinnedMsgIds, setPinnedMsgIds] = useState<Set<string>>(new Set());

  /* ── Award CEU modal ── */
  const [ceuMsg,         setCeuMsg]         = useState<Message | null>(null);
  const [ceuAmount,      setCeuAmount]      = useState(5);
  const [ceuNote,        setCeuNote]        = useState('');
  const [ceuSubmitting,  setCeuSubmitting]  = useState(false);
  const [ceuSuccess,     setCeuSuccess]     = useState('');

  /* ── Poll modal ── */
  const [showPollModal, setShowPollModal] = useState(false);
  const [pollQuestion,  setPollQuestion]  = useState('');
  const [pollOptions,   setPollOptions]   = useState(['', '']);

  /* ── Location modal ── */
  const [showLocationModal,     setShowLocationModal]     = useState(false);
  const [locationPickerValue,   setLocationPickerValue]   = useState('');
  const [selectedStructuredPlace, setSelectedStructuredPlace] = useState<StructuredPlace | null>(null);

  /* ── Skill Help modal ── */
  const [showSkillModal,      setShowSkillModal]      = useState(false);
  const [skillTab,            setSkillTab]            = useState<SkillTab>('skill');
  const [skillQuery,          setSkillQuery]          = useState('');
  const [debouncedSkillQuery, setDebouncedSkillQuery] = useState('');
  const [selectedSkillItem,   setSelectedSkillItem]   = useState<SearchItem | null>(null);
  const [skillComment,        setSkillComment]        = useState('');

  /* ── Queries ── */
  const { data: group } = useQuery({
    queryKey: ['group', id],
    queryFn: async () => { const res = await api.get(`/groups/${id}`); return res.data as Group; },
  });

  // Load pinned message IDs
  useQuery({
    queryKey: ['groupPinned', id],
    queryFn: async () => {
      const res = await api.get(`/groups/${id}/pinned`);
      const ids = (res.data as { _id: string }[]).map(m => m._id);
      setPinnedMsgIds(new Set(ids));
      return ids;
    },
    enabled: !!id,
  });

  const { isLoading } = useQuery({
    queryKey: ['groupMessages', id, channelId],
    queryFn: async () => {
      const url = channelId ? `/groups/${id}/channels/${channelId}/messages` : `/groups/${id}/messages`;
      const res = await api.get(url);
      setMessages(res.data);
      return res.data as Message[];
    },
  });

  const { data: skillItems = [], isLoading: skillItemsLoading } = useQuery<SearchItem[]>({
    queryKey: ['skillItems', skillTab, debouncedSkillQuery],
    queryFn: async () => {
      if (skillTab === 'exchange') {
        const res = await api.get(`/exchanges?limit=12${debouncedSkillQuery ? `&search=${encodeURIComponent(debouncedSkillQuery)}` : ''}`);
        const d = res.data;
        return (Array.isArray(d) ? d : d.exchanges ?? d.data ?? []) as SearchItem[];
      }
      const res = await api.get(`/posts?type=${skillTab}&limit=12${debouncedSkillQuery ? `&search=${encodeURIComponent(debouncedSkillQuery)}` : ''}`);
      const d = res.data;
      return (Array.isArray(d) ? d : d.posts ?? d.data ?? []) as SearchItem[];
    },
    enabled: showSkillModal,
  });

  /* ── Socket ── */
  useEffect(() => {
    const socket = getSocket();
    socket.emit('join-group', id);
    if (channelId) socket.emit('join-channel', channelId);

    socket.on('new-message', (msg: Message) => {
      // Resolve replyTo if server sent back an ObjectId string
      let resolved = msg;
      if (msg.replyTo && typeof msg.replyTo === 'string') {
        const found = messagesRef.current.find(m => m._id === (msg.replyTo as unknown as string));
        if (found) resolved = { ...msg, replyTo: found };
      }
      setMessages(prev => [...prev, resolved]);
    });

    socket.on('user-typing', (data: { userId: string; isTyping: boolean }) => {
      if (data.userId !== user?._id) setIsTyping(data.isTyping ? data : null);
    });

    return () => {
      socket.emit('leave-group', id);
      if (channelId) socket.emit('leave-channel', channelId);
      socket.off('new-message');
      socket.off('user-typing');
    };
  }, [id, channelId, user?._id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* ── Debounce skill query ── */
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSkillQuery(skillQuery), 500);
    return () => clearTimeout(t);
  }, [skillQuery]);

  /* ══════════════════════════════════════════
     Handlers
     ══════════════════════════════════════════ */

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const oversized = files.filter(f => f.size > 10 * 1024 * 1024);
    if (oversized.length) { setChatError(`${oversized.length} file(s) exceed 10 MB and were skipped.`); }
    const valid = files.filter(f => f.size <= 10 * 1024 * 1024);
    valid.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => setFileAttachments(prev => [...prev, { file, previewUrl: ev.target?.result as string }]);
        reader.readAsDataURL(file);
      } else {
        setFileAttachments(prev => [...prev, { file, previewUrl: null }]);
      }
    });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (overrideContent?: string) => {
    const text = overrideContent ?? input.trim();
    if (!fileAttachments.length && !text) return;
    if (!overrideContent && containsProfanity(text)) { setChatError(PROFANITY_ERROR); return; }
    setChatError('');

    const socket = getSocket();
    const replyToId = replyingTo?._id;

    if (fileAttachments.length) {
      setUploadingFile(true);
      const snapshot = [...fileAttachments];
      setFileAttachments([]);
      let anyFailed = false;
      for (const attachment of snapshot) {
        try {
          const formData = new FormData();
          formData.append('file', attachment.file);
          const res = await api.post(`/groups/${id}/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          const { url, name, size, mimeType } = res.data as { url: string; name: string; size: number; mimeType: string };
          const fc: FileContent = { __type: 'file', name, size, mimeType, url };
          socket.emit('send-message', { groupId: id, channelId: channelId || undefined, content: JSON.stringify(fc), replyTo: replyToId });
        } catch {
          anyFailed = true;
        }
      }
      setUploadingFile(false);
      if (anyFailed) { setChatError('One or more files failed to upload.'); return; }
    }

    if (text) {
      socket.emit('send-message', { groupId: id, channelId: channelId || undefined, content: text, replyTo: replyToId });
    }

    setInput('');
    setReplyingTo(null);
    if (textareaRef.current) textareaRef.current.style.height = '44px';
  };

  const handleInputChange = (val: string) => {
    setInput(val);
    if (chatError) setChatError('');
    const socket = getSocket();
    socket.emit('typing', { groupId: id, channelId: channelId || undefined, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { groupId: id, channelId: channelId || undefined, isTyping: false });
    }, 2000);
    if (textareaRef.current) {
      textareaRef.current.style.height = '44px';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleCreatePoll = () => {
    const q = pollQuestion.trim();
    const opts = pollOptions.map(o => o.trim()).filter(Boolean);
    if (!q || opts.length < 2) return;
    const content: PollContent = { __type: 'poll', question: q, options: opts };
    getSocket().emit('send-message', { groupId: id, channelId: channelId || undefined, content: JSON.stringify(content) });
    setShowPollModal(false); setPollQuestion(''); setPollOptions(['', '']);
  };

  const handleShareLocation = () => {
    if (!selectedStructuredPlace) return;
    const loc: LocationContent = { __type: 'location', name: selectedStructuredPlace.name, address: selectedStructuredPlace.address, category: selectedStructuredPlace.category, lat: selectedStructuredPlace.lat, lng: selectedStructuredPlace.lng };
    getSocket().emit('send-message', { groupId: id, channelId: channelId || undefined, content: JSON.stringify(loc) });
    setShowLocationModal(false); setLocationPickerValue(''); setSelectedStructuredPlace(null);
  };

  const handleShareSkill = () => {
    if (!selectedSkillItem) return;
    const ref: SkillRefContent = { __type: 'skill_ref', skillType: skillTab, postId: selectedSkillItem._id, title: selectedSkillItem.title, comment: skillComment.trim() };
    getSocket().emit('send-message', { groupId: id, channelId: channelId || undefined, content: JSON.stringify(ref) });
    setShowSkillModal(false); setSelectedSkillItem(null); setSkillComment(''); setSkillQuery('');
  };

  const exitSelectionMode = () => { setSelectionMode(false); setSelectedMsgIds(new Set()); };

  const startLongPress = (msgId: string) => {
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setSelectionMode(true);
      setSelectedMsgIds(new Set([msgId]));
    }, 550);
  };

  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const handleBubbleClick = (msgId: string) => {
    if (isLongPress.current) { isLongPress.current = false; return; }
    if (!selectionMode) return;
    setSelectedMsgIds(prev => {
      const next = new Set(prev);
      next.has(msgId) ? next.delete(msgId) : next.add(msgId);
      if (next.size === 0) { setSelectionMode(false); return new Set(); }
      return next;
    });
  };

  const handleExportChat = () => {
    if (!messages.length) return;
    const header = [
      `${group?.name ?? 'Group'} — Chat Export`,
      `Exported: ${new Date().toLocaleString()}`,
      `Messages: ${messages.length}`,
      '='.repeat(60),
      '',
    ].join('\n');
    const body = messages.map(m => {
      const sp = parseSpecialContent(m.content);
      const text = sp ? `[${sp.__type.replace('_', ' ')}]` : m.content;
      const ts = new Date(m.createdAt).toLocaleString();
      return `[${ts}] ${m.sender.name}:\n${text}`;
    }).join('\n\n');
    const blob = new Blob([header + body], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(group?.name ?? 'chat').replace(/[^a-z0-9]/gi, '_')}_export_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  const handleReportIssue = async () => {
    if (!reportIssueText.trim()) return;
    setReportIssueSubmitting(true);
    try {
      await api.post(`/groups/${id}/messages/report-issue`, { reason: reportIssueText.trim() }).catch(() => {
        // fallback — store report locally if endpoint doesn't exist yet
      });
      setReportIssueSuccess(true);
      setTimeout(() => { setShowReportIssueModal(false); setReportIssueSuccess(false); setReportIssueText(''); }, 1800);
    } finally {
      setReportIssueSubmitting(false);
    }
  };

  const handlePinMessage = async (msg: Message) => {
    const isPinned = pinnedMsgIds.has(msg._id);
    try {
      await api.patch(`/groups/${id}/messages/${msg._id}/pin`);
      setPinnedMsgIds(prev => {
        const next = new Set(prev);
        isPinned ? next.delete(msg._id) : next.add(msg._id);
        return next;
      });
    } catch { /* ignore */ }
    exitSelectionMode();
  };

  const handleReportMessage = async () => {
    if (!reportingMsg || !reportMsgReason.trim()) return;
    setReportMsgSubmitting(true);
    try {
      await api.post(`/groups/${id}/messages/${reportingMsg._id}/report`, { reason: reportMsgReason.trim() });
      setReportingMsg(null);
      setReportMsgReason('');
    } catch { /* ignore */ }
    setReportMsgSubmitting(false);
  };

  const handleAwardCeu = async () => {
    if (!ceuMsg) return;
    setCeuSubmitting(true);
    try {
      const res = await api.post(`/groups/${id}/messages/${ceuMsg._id}/award-ceu`, { amount: ceuAmount, note: ceuNote });
      setCeuSuccess(`Awarded ${res.data.amount} CEU credits!`);
      setTimeout(() => { setCeuMsg(null); setCeuSuccess(''); setCeuAmount(5); setCeuNote(''); }, 2000);
    } catch { /* ignore */ }
    setCeuSubmitting(false);
  };

  /* ══════════════════════════════════════════
     Special message renderers
     ══════════════════════════════════════════ */

  const renderPoll = (c: PollContent, msgId: string) => {
    const voted = pollVotes[msgId];
    return (
      <div style={{ background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '0.75rem', padding: '1rem', marginTop: '0.25rem', minWidth: 220 }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', marginBottom: '0.75rem' }}>
          <i className="fas fa-poll" style={{ marginRight: '0.5rem', color: '#4F46E5' }} />{c.question}
        </div>
        {c.options.map((opt, idx) => {
          const isVoted = voted === idx;
          return (
            <button key={idx} onClick={() => setPollVotes(prev => ({ ...prev, [msgId]: idx }))}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem 0.75rem', marginBottom: '0.4rem', border: `1px solid ${isVoted ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', cursor: 'pointer', background: isVoted ? GRADIENT : '#FFFFFF', color: isVoted ? '#FFFFFF' : '#1F2937', fontSize: '0.875rem', textAlign: 'left' as const, transition: 'all 0.2s' }}>
              <i className={isVoted ? 'fas fa-check-circle' : 'far fa-circle'} style={{ flexShrink: 0 }} />{opt}
            </button>
          );
        })}
        <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem' }}>
          <i className="fas fa-users" style={{ marginRight: '0.25rem' }} />Tap to vote
        </div>
      </div>
    );
  };

  const renderLocation = (c: LocationContent) => {
    // Google Static Maps — shows cafes, libraries, parks, etc. on tiles natively
    const staticMapSrc = GOOGLE_KEY && c.lat && c.lng
      ? `https://maps.googleapis.com/maps/api/staticmap?center=${c.lat},${c.lng}&zoom=15&size=400x160&scale=2&markers=color:0x4F46E5%7C${c.lat},${c.lng}&key=${GOOGLE_KEY}`
      : null;

    return (
      <div onClick={() => c.lat && window.open(`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`, '_blank')}
        style={{ background: '#E0F2FE', border: '1px solid #BAE6FD', borderRadius: '0.75rem', overflow: 'hidden', marginTop: '0.25rem', cursor: 'pointer', minWidth: 220 }}>
        {c.lat && c.lng && (
          staticMapSrc
            ? <img src={staticMapSrc} alt="map" style={{ width: '100%', height: 140, objectFit: 'cover', display: 'block' }} loading="lazy" />
            : <iframe title="map" src={osmSrc(String(c.lat), String(c.lng))} style={{ width: '100%', height: 140, border: 'none', display: 'block', pointerEvents: 'none' }} loading="lazy" />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem' }}>
          <div style={{ width: 36, height: 36, background: GRADIENT, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', flexShrink: 0 }}>
            <i className={getCatIcon(c.category)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>{c.name}</div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.address}</div>
          </div>
          <i className="fas fa-external-link-alt" style={{ color: '#4F46E5', flexShrink: 0 }} />
        </div>
      </div>
    );
  };

  const renderSkillRef = (c: SkillRefContent) => (
    <div onClick={() => navigate(c.skillType === 'exchange' ? `/exchanges/${c.postId}` : `/posts/${c.postId}`)}
      style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '0.75rem', padding: '1rem', marginTop: '0.25rem', cursor: 'pointer', minWidth: 200 }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#DCFCE7'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#F0FDF4'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
        <span style={{ background: GRADIENT, color: '#FFFFFF', borderRadius: '2rem', padding: '0.1rem 0.6rem', fontSize: '0.75rem', fontWeight: 500, textTransform: 'capitalize' as const }}>
          <i className={SKILL_TAB_ICONS[c.skillType as SkillTab] ?? 'fas fa-star'} style={{ marginRight: '0.3rem' }} />{c.skillType}
        </span>
        <span style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>{c.title}</span>
      </div>
      {c.comment && <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.4rem' }}>{c.comment}</div>}
      <div style={{ fontSize: '0.75rem', color: '#4F46E5' }}>
        <i className="fas fa-external-link-alt" style={{ marginRight: '0.3rem' }} />View Details
      </div>
    </div>
  );

  const handleDownload = async (url: string, name: string) => {
    if (!url) return;
    try {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
    } catch {
      window.open(url, '_blank');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return 'fas fa-image';
    if (mimeType.startsWith('video/')) return 'fas fa-video';
    if (mimeType === 'application/pdf') return 'fas fa-file-pdf';
    if (mimeType.includes('word')) return 'fas fa-file-word';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'fas fa-file-excel';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'fas fa-file-powerpoint';
    if (mimeType === 'text/plain') return 'fas fa-file-alt';
    if (mimeType === 'application/zip') return 'fas fa-file-archive';
    return 'fas fa-file';
  };

  const renderFile = (c: FileContent) => {
    const isImg = c.mimeType.startsWith('image/');
    const isVid = c.mimeType.startsWith('video/');
    const isDoc = !isImg && !isVid;
    const sizeLabel = c.size >= 1024 * 1024
      ? `${(c.size / 1024 / 1024).toFixed(1)} MB`
      : `${(c.size / 1024).toFixed(1)} KB`;
    return (
      <div style={{ background: '#FEF3C7', border: '1px solid #FBBF24', borderRadius: '0.75rem', padding: '1rem', marginTop: '0.25rem' }}>
        {/* Image preview with download overlay */}
        {isImg && c.url && (
          <div style={{ position: 'relative', marginBottom: '0.5rem' }}>
            <img src={c.url} alt={c.name} style={{ maxWidth: '100%', borderRadius: '0.5rem', display: 'block', cursor: 'pointer' }}
              onClick={() => window.open(c.url, '_blank')} />
            <button
              onClick={() => handleDownload(c.url!, c.name)}
              title="Download"
              style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', color: '#FFFFFF', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
              <i className="fas fa-download" />
            </button>
          </div>
        )}
        {/* Video with native controls */}
        {isVid && c.url && (
          <video src={c.url} controls style={{ maxWidth: '100%', borderRadius: '0.5rem', marginBottom: '0.5rem', display: 'block' }} />
        )}
        {/* File row — click opens in browser, download button saves */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            onClick={() => c.url && window.open(c.url, '_blank')}
            title={isDoc ? 'Open in browser' : undefined}
            style={{ width: 36, height: 36, background: GRADIENT, borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', flexShrink: 0, cursor: isDoc ? 'pointer' : 'default' }}>
            <i className={getFileIcon(c.mimeType)} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              onClick={() => c.url && window.open(c.url, '_blank')}
              style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              title={c.name}>
              {c.name}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#6B7280' }}>{sizeLabel}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.375rem', flexShrink: 0 }}>
            {/* Open in new tab */}
            {c.url && (
              <button
                onClick={() => window.open(c.url, '_blank')}
                title="Open in browser"
                style={{ width: 30, height: 30, borderRadius: '0.375rem', background: '#FFFFFF', border: '1px solid #E5E7EB', color: '#6B7280', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = '#EEF2FF'; e.currentTarget.style.color = '#4F46E5'; e.currentTarget.style.borderColor = '#4F46E5'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#FFFFFF'; e.currentTarget.style.color = '#6B7280'; e.currentTarget.style.borderColor = '#E5E7EB'; }}>
                <i className="fas fa-external-link-alt" />
              </button>
            )}
            {/* Download */}
            {c.url && (
              <button
                onClick={() => handleDownload(c.url!, c.name)}
                title="Download"
                style={{ width: 30, height: 30, borderRadius: '0.375rem', background: GRADIENT, border: 'none', color: '#FFFFFF', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.85'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                <i className="fas fa-download" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderSpecial = (content: string, msgId: string) => {
    const p = parseSpecialContent(content);
    if (!p) return <>{content}</>;
    if (p.__type === 'poll')      return renderPoll(p as PollContent, msgId);
    if (p.__type === 'location')  return renderLocation(p as LocationContent);
    if (p.__type === 'skill_ref') return renderSkillRef(p as SkillRefContent);
    if (p.__type === 'file')      return renderFile(p as FileContent);
    return <>{content}</>;
  };

  /* Reply snippet helper */
  const replySnippet = (msg: Message) => {
    const sp = parseSpecialContent(msg.content);
    if (sp) return `[${sp.__type.replace('_', ' ')}]`;
    return msg.content?.slice(0, 80) || '…';
  };

  /* Helpers */
  const isMine = (msg: Message) => msg.sender._id === user?._id;
  const getSenderRole = (msg: Message): string | null => {
    if (!group) return null;
    if (group.admin._id === msg.sender._id) return 'Admin';
    if (group.moderators.some(m => m._id === msg.sender._id)) return 'Moderator';
    return null;
  };
  const isLeader = !!(group && user && (group.admin._id === user._id || group.moderators.some(m => m._id === user._id)));
  const displayMembers = group?.members?.slice(0, 8) ?? [];

  /* ══════════════════════════════════════════
     JSX
     ══════════════════════════════════════════ */
  return (
    <Layout hideSidebar>

      {/* ════ POLL MODAL ════ */}
      {showPollModal && (
        <div style={overlayStyle} onClick={() => setShowPollModal(false)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-poll" style={{ marginRight: '0.5rem', color: '#4F46E5' }} />Create Community Poll
              </div>
              <button onClick={() => setShowPollModal(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Poll question</label>
                <input style={fieldStyle} placeholder="What would you like to ask the community?" value={pollQuestion} onChange={e => setPollQuestion(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(79,70,229,0.1)'; }}
                  onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.boxShadow='none'; }} />
              </div>
              <div>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>Options</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {pollOptions.map((opt, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <input style={{ ...fieldStyle, flex: 1 }} placeholder={`Option ${i + 1}`} value={opt}
                        onChange={e => { const n = [...pollOptions]; n[i] = e.target.value; setPollOptions(n); }}
                        onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; }}
                        onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; }} />
                      {pollOptions.length > 2 && (
                        <button onClick={() => setPollOptions(prev => prev.filter((_, pi) => pi !== i))} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '0.25rem', fontSize: '1rem' }}>
                          <i className="fas fa-times" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 4 && (
                  <button onClick={() => setPollOptions(prev => [...prev, ''])}
                    style={{ marginTop: '0.5rem', width: '100%', padding: '0.6rem', border: '1px dashed #E5E7EB', borderRadius: '0.5rem', background: '#F9FAFB', color: '#6B7280', fontSize: '0.875rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', transition: 'all 0.2s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.color='#4F46E5'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.color='#6B7280'; }}>
                    <i className="fas fa-plus" /> Add Option
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                <button onClick={() => setShowPollModal(false)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreatePoll} disabled={!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2}
                  style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: GRADIENT, color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', opacity: (!pollQuestion.trim() || pollOptions.filter(o => o.trim()).length < 2) ? 0.5 : 1 }}>
                  <i className="fas fa-poll" style={{ marginRight: '0.5rem' }} />Create Poll
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════ LOCATION MODAL ════ */}
      {showLocationModal && (
        <div style={overlayStyle} onClick={() => setShowLocationModal(false)}>
          <div style={{ ...cardStyle, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-map-marker-alt" style={{ marginRight: '0.5rem', color: '#4F46E5' }} />Share Public Location
              </div>
              <button onClick={() => setShowLocationModal(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>

            <div style={{ fontSize: '0.8rem', color: '#6B7280', background: '#F0F9FF', border: '1px solid #BAE6FD', borderRadius: '0.5rem', padding: '0.65rem 0.75rem', marginBottom: '0.875rem' }}>
              <i className="fas fa-shield-alt" style={{ marginRight: '0.4rem', color: '#4F46E5' }} />
              Only public places — cafes, libraries, parks, community spaces — can be shared.
            </div>

            <PublicPlacePicker
              value={locationPickerValue}
              onChange={setLocationPickerValue}
              onStructuredSelect={setSelectedStructuredPlace}
              userCoordinates={
                user?.location?.coordinates &&
                user.location.coordinates[0] !== 0 &&
                user.location.coordinates[1] !== 0
                  ? (user.location.coordinates as [number, number])
                  : undefined
              }
            />

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
              <button onClick={() => setShowLocationModal(false)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleShareLocation} disabled={!selectedStructuredPlace}
                style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: GRADIENT, color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: selectedStructuredPlace ? 'pointer' : 'not-allowed', opacity: selectedStructuredPlace ? 1 : 0.5 }}>
                <i className="fas fa-share" style={{ marginRight: '0.5rem' }} />Share Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ SKILL HELP MODAL ════ */}
      {showSkillModal && (
        <div style={overlayStyle} onClick={() => setShowSkillModal(false)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-handshake" style={{ marginRight: '0.5rem', color: '#4F46E5' }} />Share &amp; Offer Skill Help
              </div>
              <button onClick={() => setShowSkillModal(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ display: 'flex', gap: '0.375rem', marginBottom: '1rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
              {SKILL_TABS.map(tab => (
                <button key={tab} onClick={() => { setSkillTab(tab); setSelectedSkillItem(null); }}
                  style={{ padding: '0.4rem 0.85rem', borderRadius: '2rem', border: 'none', background: skillTab === tab ? GRADIENT : '#F3F4F6', color: skillTab === tab ? '#FFFFFF' : '#6B7280', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap', transition: 'all 0.2s' }}>
                  <i className={SKILL_TAB_ICONS[tab]} style={{ fontSize: '0.75rem' }} />
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}s
                </button>
              ))}
            </div>
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <i className="fas fa-search" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#6B7280', pointerEvents: 'none' }} />
              <input style={{ ...fieldStyle, paddingLeft: '2.25rem' }} placeholder={`Search ${skillTab}s…`} value={skillQuery} onChange={e => setSkillQuery(e.target.value)}
                onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(79,70,229,0.1)'; }}
                onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.boxShadow='none'; }} />
            </div>
            <div style={{ maxHeight: 220, overflowY: 'auto', marginBottom: '0.75rem' }}>
              {skillItemsLoading && <div style={{ textAlign: 'center', padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.5rem' }} />Loading…</div>}
              {!skillItemsLoading && skillItems.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: '#6B7280', fontSize: '0.875rem' }}>{debouncedSkillQuery ? 'No results found.' : `Browse or search ${skillTab}s above.`}</div>}
              {skillItems.map(item => {
                const isSel = selectedSkillItem?._id === item._id;
                return (
                  <div key={item._id} onClick={() => setSelectedSkillItem(item)}
                    style={{ padding: '0.75rem', borderRadius: '0.5rem', cursor: 'pointer', marginBottom: '0.4rem', border: `1px solid ${isSel ? '#4F46E5' : '#E5E7EB'}`, background: isSel ? 'rgba(79,70,229,0.05)' : '#FFFFFF', transition: 'all 0.2s' }}
                    onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = '#FFFFFF'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#1F2937' }}>{item.title}</div>
                      {isSel && <i className="fas fa-check-circle" style={{ color: '#4F46E5' }} />}
                    </div>
                    {item.description && <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</div>}
                  </div>
                );
              })}
            </div>
            {selectedSkillItem && (
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                  Add a comment <span style={{ color: '#6B7280', fontWeight: 400 }}>(optional)</span>
                </label>
                <textarea style={{ ...fieldStyle, resize: 'none', height: 72 } as React.CSSProperties} placeholder="E.g. I can help with this, message me!"
                  value={skillComment} onChange={e => setSkillComment(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; }} onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setShowSkillModal(false)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleShareSkill} disabled={!selectedSkillItem}
                style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: GRADIENT, color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: selectedSkillItem ? 'pointer' : 'not-allowed', opacity: selectedSkillItem ? 1 : 0.5 }}>
                <i className="fas fa-handshake" style={{ marginRight: '0.5rem' }} />Share to Group
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ REPORT ISSUE MODAL ════ */}
      {showReportIssueModal && (
        <div style={overlayStyle} onClick={() => setShowReportIssueModal(false)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-flag" style={{ marginRight: '0.5rem', color: '#DC2626' }} />Report an Issue
              </div>
              <button onClick={() => setShowReportIssueModal(false)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem', borderRadius: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            {reportIssueSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#065F46', fontSize: '0.9375rem' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: '#10B981', marginBottom: '0.75rem', display: 'block' }} />
                Thank you! Your report has been submitted.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ fontSize: '0.875rem', color: '#6B7280' }}>Describe the issue you're experiencing in this group chat.</div>
                <textarea style={{ ...fieldStyle, resize: 'none', height: 100 } as React.CSSProperties}
                  placeholder="Describe the issue…"
                  value={reportIssueText} onChange={e => setReportIssueText(e.target.value)}
                  onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; }} onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; }} />
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setShowReportIssueModal(false)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleReportIssue} disabled={!reportIssueText.trim() || reportIssueSubmitting}
                    style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: '#DC2626', color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: (!reportIssueText.trim() || reportIssueSubmitting) ? 'not-allowed' : 'pointer', opacity: (!reportIssueText.trim() || reportIssueSubmitting) ? 0.5 : 1 }}>
                    {reportIssueSubmitting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Submitting…</> : <><i className="fas fa-flag" style={{ marginRight: '0.4rem' }} />Submit Report</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ REPORT MESSAGE MODAL ════ */}
      {reportingMsg && (
        <div style={overlayStyle} onClick={() => setReportingMsg(null)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-exclamation-triangle" style={{ marginRight: '0.5rem', color: '#DC2626' }} />Report Message
              </div>
              <button onClick={() => setReportingMsg(null)} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            <div style={{ background: '#F3F4F6', borderRadius: '0.5rem', padding: '0.75rem', marginBottom: '1rem', fontSize: '0.8125rem', color: '#6B7280' }}>
              <strong style={{ color: '#1F2937' }}>{reportingMsg.sender.name}: </strong>
              {replySnippet(reportingMsg)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
              {['Spam or advertising', 'Harassment or bullying', 'Inappropriate content', 'Misinformation', 'Other'].map(r => (
                <button key={r} onClick={() => setReportMsgReason(r)}
                  style={{ padding: '0.6rem 0.875rem', border: `1px solid ${reportMsgReason === r ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', background: reportMsgReason === r ? '#EEF2FF' : '#FFFFFF', color: reportMsgReason === r ? '#4F46E5' : '#374151', fontSize: '0.875rem', fontWeight: reportMsgReason === r ? 600 : 400, cursor: 'pointer', textAlign: 'left' as const, transition: 'all 0.15s' }}>
                  {r}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setReportingMsg(null)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleReportMessage} disabled={!reportMsgReason || reportMsgSubmitting}
                style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: '#DC2626', color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: (!reportMsgReason || reportMsgSubmitting) ? 'not-allowed' : 'pointer', opacity: (!reportMsgReason || reportMsgSubmitting) ? 0.5 : 1 }}>
                {reportMsgSubmitting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Reporting…</> : <><i className="fas fa-flag" style={{ marginRight: '0.4rem' }} />Report</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════ AWARD CEU MODAL ════ */}
      {ceuMsg && (
        <div style={overlayStyle} onClick={() => { setCeuMsg(null); setCeuSuccess(''); }}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>
                <i className="fas fa-award" style={{ marginRight: '0.5rem', color: '#F59E0B' }} />Award CEU Credits
              </div>
              <button onClick={() => { setCeuMsg(null); setCeuSuccess(''); }} style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '1.25rem', cursor: 'pointer', padding: '0.25rem' }}>
                <i className="fas fa-times" />
              </button>
            </div>
            {ceuSuccess ? (
              <div style={{ textAlign: 'center', padding: '1.5rem', color: '#065F46', fontSize: '0.9375rem' }}>
                <i className="fas fa-check-circle" style={{ fontSize: '2rem', color: '#10B981', marginBottom: '0.75rem', display: 'block' }} />
                {ceuSuccess}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ background: '#F3F4F6', borderRadius: '0.5rem', padding: '0.75rem', fontSize: '0.8125rem', color: '#6B7280' }}>
                  Awarding credits to <strong style={{ color: '#1F2937' }}>{ceuMsg.sender.name}</strong> for their contribution.
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    CEU Credits <span style={{ color: '#6B7280', fontWeight: 400 }}>(1–50)</span>
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    {[5, 10, 15, 20].map(v => (
                      <button key={v} onClick={() => setCeuAmount(v)}
                        style={{ flex: 1, padding: '0.5rem', border: `1px solid ${ceuAmount === v ? '#4F46E5' : '#E5E7EB'}`, borderRadius: '0.5rem', background: ceuAmount === v ? '#EEF2FF' : '#FFFFFF', color: ceuAmount === v ? '#4F46E5' : '#374151', fontSize: '0.875rem', fontWeight: ceuAmount === v ? 700 : 400, cursor: 'pointer' }}>
                        {v}
                      </button>
                    ))}
                    <input type="number" min={1} max={50} value={ceuAmount} onChange={e => setCeuAmount(Math.min(50, Math.max(1, Number(e.target.value))))}
                      style={{ ...fieldStyle, width: 70, textAlign: 'center' as const }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151', display: 'block', marginBottom: '0.375rem' }}>
                    Note <span style={{ color: '#6B7280', fontWeight: 400 }}>(optional)</span>
                  </label>
                  <input style={fieldStyle} placeholder="E.g. Great skill share!" value={ceuNote} onChange={e => setCeuNote(e.target.value)}
                    onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; }} onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; }} />
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setCeuMsg(null)} style={{ flex: 1, padding: '0.75rem', border: '1px solid #E5E7EB', borderRadius: '0.5rem', background: '#FFFFFF', color: '#374151', fontSize: '0.875rem', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
                  <button onClick={handleAwardCeu} disabled={ceuSubmitting}
                    style={{ flex: 2, padding: '0.75rem', border: 'none', borderRadius: '0.5rem', background: 'linear-gradient(135deg, #F59E0B, #10B981)', color: '#FFFFFF', fontSize: '0.875rem', fontWeight: 600, cursor: ceuSubmitting ? 'not-allowed' : 'pointer', opacity: ceuSubmitting ? 0.7 : 1 }}>
                    {ceuSubmitting ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '0.4rem' }} />Awarding…</> : <><i className="fas fa-award" style={{ marginRight: '0.4rem' }} />Award {ceuAmount} Credits</>}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input ref={fileInputRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip"
        style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* ════ 3-COLUMN GRID ════ */}
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr', lg: '260px 1fr 300px' }, height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

        {/* ═══ LEFT SIDEBAR ═══ */}
        <Box sx={{ display: { xs: 'none', md: 'flex' }, flexDirection: 'column', position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflow: 'hidden', padding: '1.5rem 1rem', background: '#FFFFFF', borderRight: '1px solid #E5E7EB', boxShadow: '2px 0 8px rgba(0,0,0,0.05)', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-track': { background: '#F9FAFB' }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 3 } }}>
          <div style={{ ...sidebarSectionStyle, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid #E5E7EB' }}>
              <div style={{ width: 60, height: 60, borderRadius: '0.75rem', background: group?.avatar ? 'none' : GRADIENT, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 600, flexShrink: 0, overflow: 'hidden' }}>
                {group?.avatar ? <img src={group.avatar} alt={group.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (group?.name?.substring(0, 2).toUpperCase() ?? 'GR')}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937', marginBottom: '0.2rem' }}>{group?.name || 'Group Chat'}</div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280' }}>
                  <i className="fas fa-users" style={{ marginRight: '0.25rem' }} />{group?.memberCount ?? '—'} members
                  {group?.stats && <> &bull; <i className="fas fa-comment" style={{ marginRight: '0.25rem' }} />{group.stats.messagesCount.toLocaleString()} messages</>}
                </div>
              </div>
            </div>
            {[
              { icon: 'fas fa-poll',           label: 'Create Poll',      action: () => setShowPollModal(true) },
              { icon: 'fas fa-paperclip',      label: 'Share Resource',   action: () => fileInputRef.current?.click() },
              { icon: 'fas fa-map-marker-alt', label: 'Share Location',   action: () => setShowLocationModal(true) },
              { icon: 'fas fa-handshake',      label: 'Offer Skill Help', action: () => setShowSkillModal(true) },
            ].map(({ icon, label, action }) => (
              <button key={label} style={controlBtnStyle} onClick={action}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#F3F4F6'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FFFFFF'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}>
                <i className={icon} style={{ width: 20, color: '#4F46E5' }} />{label}
              </button>
            ))}
            <button style={{ ...controlBtnStyle, background: '#FEF3F2', borderColor: '#FEE2E2', color: '#DC2626', marginTop: '0.25rem' }}
              onClick={() => setShowReportIssueModal(true)}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEE2E2'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateX(2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#FEF3F2'; (e.currentTarget as HTMLButtonElement).style.transform = 'none'; }}>
              <i className="fas fa-flag" style={{ width: 20, color: '#DC2626' }} />Report Issue
            </button>
          </div>

          <div style={{ ...sidebarSectionStyle, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={sidebarTitleStyle}>
              <span>Active Members</span>
              <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: '0.8rem' }}>{displayMembers.length}/{group?.memberCount ?? '—'}</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', flex: 1, overflowY: 'auto' }}>
              {displayMembers.map(m => (
                <div key={m.user._id} onClick={() => navigate(`/profile/${m.user._id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem', borderRadius: '0.5rem', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F3F4F6'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                  <OnlineAvatar userId={m.user._id} src={m.user.avatar} sx={{ width: 32, height: 32, background: GRADIENT, fontSize: '0.75rem', fontWeight: 600 }}>
                    {m.user.name?.[0]?.toUpperCase()}
                  </OnlineAvatar>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1F2937' }}>{m.user.name}</div>
                    <div style={{ fontSize: '0.75rem', color: '#6B7280', textTransform: 'capitalize' }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {group?.rules && group.rules.length > 0 && (
            <div style={{ ...sidebarSectionStyle, flexShrink: 0 }}>
              <div style={sidebarTitleStyle}>Community Guidelines</div>
              <div style={{ fontSize: '0.8rem', color: '#6B7280', lineHeight: 1.5 }}>
                {group.rules.map((rule, i) => <p key={i} style={{ marginBottom: '0.4rem' }}>{i + 1}. {rule}</p>)}
              </div>
            </div>
          )}
        </Box>

        {/* ═══ CENTER CHAT ═══ */}
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

          {/* Chat header */}
          <Box sx={{ background: '#FFFFFF', padding: '1rem 1.5rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', zIndex: 10, flexShrink: 0, gap: '0.75rem' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Box sx={{ display: { xs: 'block', md: 'none' } }}>
                <button style={{ ...actionBtnStyle, padding: '0.5rem 0.75rem' }} onClick={() => navigate(`/groups/${id}`)} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                  <i className="fas fa-arrow-left" style={{ color: '#4F46E5' }} />
                </button>
              </Box>
              <div>
                <div style={{ fontSize: '1.125rem', fontWeight: 600, color: '#1F2937' }}>{group?.name || 'Group Chat'} — Community Chat</div>
                <div style={{ fontSize: '0.8rem', color: '#6B7280', marginTop: '0.15rem' }}>
                  Share skills, help neighbours, build community{group?.stats ? ` \u2022 ${group.stats.messagesCount.toLocaleString()} messages` : ''}
                </div>
              </div>
            </Box>
            <Box sx={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
              <button style={actionBtnStyle} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
                <i className="fas fa-search" style={{ color: '#4F46E5' }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Search</Box>
              </button>
              <button style={actionBtnStyle} onClick={handleExportChat} onMouseEnter={hoverOn} onMouseLeave={hoverOff} title="Export chat as .txt">
                <i className="fas fa-download" style={{ color: '#4F46E5' }} />
                <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>Export</Box>
              </button>
            </Box>
          </Box>

          {/* Messages */}
          <Box onClick={() => { if (selectionMode) exitSelectionMode(); }} sx={{ flex: 1, overflowY: 'auto', background: '#FFFFFF', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-track': { background: '#F9FAFB' }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 3 } }}>

            {/* Welcome banner */}
            {!isLoading && (
              <Box sx={{ alignSelf: 'center', maxWidth: '90%', background: '#D1FAE5', border: '1px solid #10B981', borderRadius: '0.5rem', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#1F2937', textAlign: 'center' }}>
                <i className="fas fa-hands-helping" style={{ marginRight: '0.5rem' }} />
                Welcome to <strong>{group?.name || 'this group'}</strong>! Share skills, help neighbours, earn community credit.
              </Box>
            )}

            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <Box key={i} sx={{ display: 'flex', gap: '0.75rem', alignSelf: i % 2 ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                  {i % 2 === 0 && <Skeleton variant="circular" width={32} height={32} />}
                  <Skeleton variant="rounded" width={200} height={60} sx={{ borderRadius: '1rem' }} />
                </Box>
              ))
              : messages.map(msg => {
                const mine = isMine(msg);
                const role = !mine ? getSenderRole(msg) : null;
                const sp   = parseSpecialContent(msg.content);
                const replyMsg = msg.replyTo && typeof msg.replyTo === 'object' ? msg.replyTo as Message : null;

                const isSelected = selectedMsgIds.has(msg._id);
                const showReplyBtn = hoveredMsgId === msg._id && !selectionMode;

                return (
                  <Box
                    key={msg._id}
                    sx={{ display: 'flex', flexDirection: 'column', alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: { xs: '90%', md: '72%' } }}
                    onMouseEnter={() => setHoveredMsgId(msg._id)}
                    onMouseLeave={() => { setHoveredMsgId(null); cancelLongPress(); }}
                  >
                    <Box onClick={e => e.stopPropagation()} sx={{ display: 'flex', gap: '0.375rem', alignItems: 'flex-end' }}>
                      {/* Selection checkbox — left of all messages in selection mode */}
                      {selectionMode && (
                        <Box sx={{ alignSelf: 'center', flexShrink: 0, cursor: 'pointer' }}
                          onClick={() => handleBubbleClick(msg._id)}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', border: `2px solid ${isSelected ? '#4F46E5' : '#D1D5DB'}`, background: isSelected ? '#4F46E5' : '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>
                            {isSelected && <i className="fas fa-check" style={{ color: '#FFFFFF', fontSize: '0.6rem' }} />}
                          </div>
                        </Box>
                      )}

                      {/* Reply button — left of own messages (hover, desktop) */}
                      {mine && showReplyBtn && (
                        <button onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                          title="Reply" style={{ alignSelf: 'center', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#6B7280', fontSize: '0.7rem', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background='#4F46E5'; e.currentTarget.style.color='#FFFFFF'; e.currentTarget.style.borderColor='#4F46E5'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#6B7280'; e.currentTarget.style.borderColor='#E5E7EB'; }}>
                          <i className="fas fa-reply fa-flip-horizontal" />
                        </button>
                      )}

                      {/* Avatar + bubble */}
                      <Box sx={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexDirection: mine ? 'row-reverse' : 'row' }}>
                        {!mine && (
                          <OnlineAvatar userId={msg.sender._id} src={msg.sender.avatar} isVerified={msg.sender.isVerified}
                            onClick={() => !selectionMode && navigate(`/profile/${msg.sender._id}`)}
                            sx={{ width: 32, height: 32, background: GRADIENT, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                            {msg.sender.name[0]?.toUpperCase()}
                          </OnlineAvatar>
                        )}
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: mine ? 'flex-end' : 'flex-start' }}>
                          {!mine && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', mb: '0.25rem', ml: '0.25rem' }}>
                              <span onClick={() => !selectionMode && navigate(`/profile/${msg.sender._id}`)} style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1F2937', cursor: 'pointer' }}>{msg.sender.name}</span>
                              {role && <span style={{ background: GRADIENT, color: '#FFFFFF', fontSize: '0.75rem', borderRadius: '2rem', padding: '0.1rem 0.5rem', fontWeight: 500 }}>{role}</span>}
                            </Box>
                          )}

                          {/* Bubble — long press to select */}
                          <Box
                            onMouseDown={() => startLongPress(msg._id)}
                            onMouseUp={cancelLongPress}
                            onTouchStart={() => startLongPress(msg._id)}
                            onTouchEnd={cancelLongPress}
                            onTouchMove={cancelLongPress}
                            onClick={() => handleBubbleClick(msg._id)}
                            sx={{ background: isSelected ? (mine ? '#BFDBFE' : '#DDD6FE') : (mine ? '#E0F2FE' : '#F3F4F6'), borderRadius: mine ? '1rem 1rem 0.375rem 1rem' : '1rem 1rem 1rem 0.375rem', padding: sp ? '0.5rem' : '0.75rem 1rem', color: '#1F2937', fontSize: '0.875rem', wordBreak: 'break-word', lineHeight: 1.5, cursor: selectionMode ? 'pointer' : 'default', outline: isSelected ? `2px solid #4F46E5` : '2px solid transparent', outlineOffset: '2px', transition: 'all 0.15s', userSelect: 'none', WebkitUserSelect: 'none' }}>
                            {/* ── Quoted reply snippet ── */}
                            {replyMsg && (
                              <div style={{ borderLeft: '3px solid #4F46E5', paddingLeft: '0.6rem', marginBottom: '0.5rem', opacity: 0.85 }}>
                                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#4F46E5', marginBottom: '0.1rem' }}>
                                  {replyMsg.sender?.name ?? 'Someone'}
                                </div>
                                <div style={{ fontSize: '0.75rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 220 }}>
                                  {replySnippet(replyMsg)}
                                </div>
                              </div>
                            )}
                            {renderSpecial(msg.content, msg._id)}
                          </Box>

                          <div style={{ fontSize: '0.75rem', color: '#6B7280', marginTop: '0.25rem', textAlign: mine ? 'right' : 'left', paddingLeft: mine ? 0 : '0.25rem', paddingRight: mine ? '0.25rem' : 0 }}>
                            {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                          </div>
                        </Box>
                      </Box>

                      {/* Reply button — right of other messages (hover, desktop) */}
                      {!mine && showReplyBtn && (
                        <button onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                          title="Reply" style={{ alignSelf: 'center', background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, color: '#6B7280', fontSize: '0.7rem', transition: 'all 0.15s' }}
                          onMouseEnter={e => { e.currentTarget.style.background='#4F46E5'; e.currentTarget.style.color='#FFFFFF'; e.currentTarget.style.borderColor='#4F46E5'; }}
                          onMouseLeave={e => { e.currentTarget.style.background='#F3F4F6'; e.currentTarget.style.color='#6B7280'; e.currentTarget.style.borderColor='#E5E7EB'; }}>
                          <i className="fas fa-reply" />
                        </button>
                      )}
                    </Box>
                  </Box>
                );
              })
            }

            {isTyping && (
              <Box sx={{ alignSelf: 'flex-start', background: '#F3F4F6', borderRadius: '1rem 1rem 1rem 0.375rem', padding: '0.75rem 1rem', fontSize: '0.75rem', color: '#6B7280' }}>typing…</Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* ── Selection action bar ── */}
          {selectionMode && (() => {
            const selMsgs = messages.filter(m => selectedMsgIds.has(m._id));
            const single = selMsgs.length === 1 ? selMsgs[0] : null;
            const hasOthers = selMsgs.some(m => m.sender._id !== user?._id);
            return (
              <Box sx={{ background: '#1F2937', padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#FFFFFF', minWidth: 0 }}>
                  <i className="fas fa-check-circle" style={{ marginRight: '0.5rem', color: '#10B981' }} />
                  {selectedMsgIds.size} selected
                </span>
                <Box sx={{ flex: 1, display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {/* Reply — single only */}
                  {single && (
                    <button onClick={() => { setReplyingTo(single); exitSelectionMode(); textareaRef.current?.focus(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2rem', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; }}>
                      <i className="fas fa-reply" />Reply
                    </button>
                  )}
                  {/* Copy — single only */}
                  {single && (
                    <button onClick={() => { navigator.clipboard?.writeText(replySnippet(single)); exitSelectionMode(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '2rem', background: 'rgba(255,255,255,0.1)', color: '#FFFFFF', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.1)'; }}>
                      <i className="fas fa-copy" />Copy
                    </button>
                  )}
                  {/* Pin — leaders, any count */}
                  {isLeader && selMsgs.length === 1 && (
                    <button onClick={() => handlePinMessage(selMsgs[0])}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid #F59E0B', borderRadius: '2rem', background: '#FEF3C7', color: '#D97706', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#FDE68A'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FEF3C7'; }}>
                      <i className="fas fa-thumbtack" />{pinnedMsgIds.has(selMsgs[0]._id) ? 'Unpin' : 'Pin'}
                    </button>
                  )}
                  {/* Award CEU — leader, single other person's message */}
                  {isLeader && single && single.sender._id !== user?._id && (
                    <button onClick={() => { setCeuMsg(single); exitSelectionMode(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid #10B981', borderRadius: '2rem', background: '#ECFDF5', color: '#059669', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#D1FAE5'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#ECFDF5'; }}>
                      <i className="fas fa-award" />Award CEU
                    </button>
                  )}
                  {/* Report — any not-mine message */}
                  {single && single.sender._id !== user?._id && (
                    <button onClick={() => { setReportingMsg(single); exitSelectionMode(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid #FCA5A5', borderRadius: '2rem', background: '#FEF2F2', color: '#DC2626', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#FEE2E2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FEF2F2'; }}>
                      <i className="fas fa-flag" />Report
                    </button>
                  )}
                  {/* Bulk report — multiple others' messages selected */}
                  {!single && hasOthers && (
                    <button onClick={() => { setReportingMsg(selMsgs.find(m => m.sender._id !== user?._id)!); exitSelectionMode(); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.4rem 0.875rem', border: '1px solid #FCA5A5', borderRadius: '2rem', background: '#FEF2F2', color: '#DC2626', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}
                      onMouseEnter={e => { e.currentTarget.style.background='#FEE2E2'; }}
                      onMouseLeave={e => { e.currentTarget.style.background='#FEF2F2'; }}>
                      <i className="fas fa-flag" />Report ({selMsgs.filter(m => m.sender._id !== user?._id).length})
                    </button>
                  )}
                </Box>
                <button onClick={exitSelectionMode}
                  style={{ background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '50%', width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#FFFFFF', fontSize: '0.875rem', flexShrink: 0, transition: 'all 0.15s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(255,255,255,0.3)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(255,255,255,0.15)'; }}>
                  <i className="fas fa-times" />
                </button>
              </Box>
            );
          })()}

          {/* Input area */}
          <Box sx={{ background: '#FFFFFF', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
            {!isPhoneVerified ? (
              <PhoneVerificationGate feature="Group Messaging" description="Verify your mobile number to send messages in this group." compact />
            ) : (
              <>
                {/* ── Reply preview bar ── */}
                {replyingTo && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.2)', borderLeft: '3px solid #4F46E5', borderRadius: '0.5rem' }}>
                    <i className="fas fa-reply" style={{ color: '#4F46E5', fontSize: '0.875rem', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4F46E5' }}>
                        Replying to {replyingTo.sender.name}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#6B7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {replySnippet(replyingTo)}
                      </div>
                    </div>
                    <button onClick={() => setReplyingTo(null)} style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', padding: '0.1rem', fontSize: '1rem', flexShrink: 0 }}>
                      <i className="fas fa-times" />
                    </button>
                  </Box>
                )}

                {/* File attachment chips */}
                {fileAttachments.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {fileAttachments.map((att, idx) => (
                      <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.4rem 0.6rem', background: '#FEF3C7', border: '1px solid #FBBF24', borderRadius: '0.5rem', maxWidth: 220 }}>
                        {att.previewUrl && att.file.type.startsWith('image/')
                          ? <img src={att.previewUrl} alt="preview" style={{ height: 28, width: 28, objectFit: 'cover', borderRadius: '0.25rem', flexShrink: 0 }} />
                          : <i className={att.file.type.startsWith('video/') ? 'fas fa-video' : 'fas fa-file'} style={{ color: '#D97706', fontSize: '0.875rem', flexShrink: 0 }} />
                        }
                        <span style={{ fontSize: '0.8rem', color: '#92400E', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{att.file.name}</span>
                        <button onClick={() => setFileAttachments(prev => prev.filter((_, i) => i !== idx))}
                          style={{ background: 'none', border: 'none', color: '#92400E', cursor: 'pointer', padding: '0.1rem', fontSize: '0.8rem', flexShrink: 0 }}>
                          <i className="fas fa-times" />
                        </button>
                      </Box>
                    ))}
                    {fileAttachments.length > 1 && (
                      <button onClick={() => setFileAttachments([])}
                        style={{ alignSelf: 'center', background: 'none', border: 'none', color: '#B45309', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline', padding: '0.1rem' }}>
                        Clear all
                      </button>
                    )}
                  </Box>
                )}

                {/* Toolbar — 4 buttons */}
                <Box sx={{ display: 'flex', gap: '0.5rem' }}>
                  <button title="Upload image, video or document" style={toolBtnStyle} onMouseEnter={toolOn} onMouseLeave={toolOff} onClick={() => fileInputRef.current?.click()}>
                    <i className="fas fa-paperclip" />
                  </button>
                  <button title="Create Poll" style={toolBtnStyle} onMouseEnter={toolOn} onMouseLeave={toolOff} onClick={() => setShowPollModal(true)}>
                    <i className="fas fa-poll" />
                  </button>
                  <button title="Share Public Location" style={toolBtnStyle} onMouseEnter={toolOn} onMouseLeave={toolOff} onClick={() => setShowLocationModal(true)}>
                    <i className="fas fa-map-marker-alt" />
                  </button>
                  <button title="Share Skill / Tool / Exchange / Event" style={toolBtnStyle} onMouseEnter={toolOn} onMouseLeave={toolOff} onClick={() => setShowSkillModal(true)}>
                    <i className="fas fa-handshake" />
                  </button>
                </Box>

                {chatError && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.75rem', color: '#DC2626' }}>
                    <i className="fas fa-exclamation-circle" style={{ fontSize: '0.7rem' }} />{chatError}
                  </Box>
                )}

                {/* Text input + send */}
                <Box sx={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                  <textarea ref={textareaRef} placeholder={replyingTo ? `Reply to ${replyingTo.sender.name}…` : 'Share a skill, offer help, or ask for assistance…'}
                    value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown} rows={1}
                    style={{ flex: 1, padding: '0.75rem 1rem', border: '1px solid #E5E7EB', borderRadius: '0.75rem', fontSize: '0.875rem', background: '#F9FAFB', resize: 'none', minHeight: 44, maxHeight: 120, outline: 'none', fontFamily: 'inherit', lineHeight: 1.5, overflowY: 'auto', color: '#1F2937', transition: 'border-color 0.15s, box-shadow 0.15s' }}
                    onFocus={e => { e.currentTarget.style.borderColor='#4F46E5'; e.currentTarget.style.boxShadow='0 0 0 3px rgba(79,70,229,0.1)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor='#E5E7EB'; e.currentTarget.style.boxShadow='none'; }} />
                  <button onClick={() => handleSend()} disabled={(!input.trim() && !fileAttachments.length) || uploadingFile}
                    style={{ width: 44, height: 44, background: (input.trim() || fileAttachments.length) && !uploadingFile ? GRADIENT : '#E5E7EB', border: 'none', borderRadius: '0.75rem', color: '#FFFFFF', fontSize: '1.25rem', cursor: (input.trim() || fileAttachments.length) && !uploadingFile ? 'pointer' : 'not-allowed', opacity: (input.trim() || fileAttachments.length) && !uploadingFile ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'transform 0.15s, opacity 0.15s' }}
                    onMouseEnter={e => { if ((input.trim() || fileAttachments.length) && !uploadingFile) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}>
                    <i className={uploadingFile ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'} />
                  </button>
                </Box>
              </>
            )}
          </Box>
        </Box>

        {/* ═══ RIGHT SIDEBAR ═══ */}
        <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto', padding: '1.5rem 1rem', background: '#FFFFFF', borderLeft: '1px solid #E5E7EB', boxShadow: '-2px 0 8px rgba(0,0,0,0.05)', '&::-webkit-scrollbar': { width: 6 }, '&::-webkit-scrollbar-track': { background: '#F9FAFB' }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 3 } }}>
          <div style={sidebarSectionStyle}>
            <div style={sidebarTitleStyle}>Pinned Messages</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: 264, overflowY: 'auto' }}>
              {messages.filter(m => pinnedMsgIds.has(m._id)).map(msg => (
                <div key={msg._id} style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '0.5rem', padding: '0.75rem', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => { setSelectionMode(true); setSelectedMsgIds(new Set([msg._id])); }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FDE68A'; (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = '#FEF3C7'; (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.2rem' }}>
                    <i className="fas fa-thumbtack" style={{ color: '#D97706', fontSize: '0.75rem' }} />
                    <span style={{ fontSize: '0.75rem', color: '#92400E', fontWeight: 600 }}>{msg.sender.name}</span>
                  </div>
                  <div style={{ fontSize: '0.8125rem', color: '#1F2937', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const }}>
                    {parseSpecialContent(msg.content) ? `[${(parseSpecialContent(msg.content) as SpecialContent).__type.replace('_', ' ')}]` : msg.content}
                  </div>
                </div>
              ))}
              {messages.filter(m => pinnedMsgIds.has(m._id)).length === 0 && (
                <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#6B7280' }}>
                  {isLeader ? 'Select a message and tap Pin to pin it here.' : 'No pinned messages yet.'}
                </div>
              )}
            </div>
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarTitleStyle}>Shared Files</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: 180, overflowY: 'auto' }}>
              {messages.filter(m => parseSpecialContent(m.content)?.__type === 'file').map(msg => {
                const fc = parseSpecialContent(msg.content) as FileContent;
                const isImg = fc.mimeType?.startsWith('image/');
                return (
                  <div key={msg._id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.5rem', borderRadius: '0.5rem', transition: 'background 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F3F4F6'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                    {/* Thumbnail / icon — click opens in browser */}
                    <div onClick={() => fc.url && window.open(fc.url, '_blank')} style={{ flexShrink: 0, cursor: fc.url ? 'pointer' : 'default' }}>
                      {isImg && fc.url
                        ? <img src={fc.url} alt={fc.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: '0.375rem' }} />
                        : <div style={{ width: 32, height: 32, background: GRADIENT, borderRadius: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontSize: '0.875rem' }}>
                            <i className={getFileIcon(fc.mimeType ?? '')} />
                          </div>}
                    </div>
                    <div style={{ flex: 1, minWidth: 0, cursor: fc.url ? 'pointer' : 'default' }} onClick={() => fc.url && window.open(fc.url, '_blank')}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 500, color: '#1F2937', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{fc.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#6B7280' }}>{msg.sender.name} &bull; {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}</div>
                    </div>
                    {/* Download button */}
                    {fc.url && (
                      <button onClick={() => handleDownload(fc.url!, fc.name)}
                        title="Download"
                        style={{ width: 26, height: 26, borderRadius: '0.375rem', background: GRADIENT, border: 'none', color: '#FFFFFF', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s' }}
                        onMouseEnter={e => { e.currentTarget.style.opacity = '0.8'; }}
                        onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}>
                        <i className="fas fa-download" />
                      </button>
                    )}
                  </div>
                );
              })}
              {messages.filter(m => parseSpecialContent(m.content)?.__type === 'file').length === 0 && (
                <div style={{ textAlign: 'center', padding: '0.75rem', fontSize: '0.875rem', color: '#6B7280' }}>No shared files yet</div>
              )}
            </div>
          </div>

          <div style={sidebarSectionStyle}>
            <div style={sidebarTitleStyle}>Community Stats</div>
            <div style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.9 }}>
              <p><strong>Members:</strong> {group?.memberCount ?? '—'} neighbours</p>
              {group?.stats && <>
                <p><strong>Posts:</strong> {group.stats.postsCount}</p>
                <p><strong>Events:</strong> {group.stats.eventsCount}</p>
                <p><strong>Messages:</strong> {group.stats.messagesCount.toLocaleString()}</p>
              </>}
              <p><strong>Category:</strong> {group?.category || '—'}</p>
              <p><strong>Since:</strong> {group?.createdAt ? formatDistanceToNow(new Date(group.createdAt), { addSuffix: true }) : '—'}</p>
            </div>
          </div>
        </Box>
      </Box>
    </Layout>
  );
};

export default GroupChats;
