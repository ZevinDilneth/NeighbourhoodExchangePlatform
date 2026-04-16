import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Avatar, Typography, Skeleton, Snackbar, Alert } from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import RichTextEditor from '../components/RichTextEditor';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { Post, Comment } from '../types';

/* ─── style tokens ─── */
const GRADIENT = 'linear-gradient(135deg, #4F46E5, #10B981)';
const ACCEPTED_GRADIENT = 'linear-gradient(135deg, #10B981, #059669)';
const AMBER_GRADIENT = 'linear-gradient(135deg, #F59E0B, #EF4444)';
const CARD_BORDER = '1px solid #E5E7EB';
const CARD_SHADOW = '0 1px 3px rgba(0,0,0,0.12)';
const TEXT_PRIMARY = '#1F2937';
const TEXT_SECONDARY = '#6B7280';
const BG = '#F9FAFB';
const HOVER = '#F3F4F6';
const NAV_BTN = {
  position: 'absolute' as const, top: '50%', transform: 'translateY(-50%)',
  width: 32, height: 32, borderRadius: '50%',
  background: 'rgba(0,0,0,0.45)', color: '#fff', border: 'none',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontSize: '0.75rem', transition: 'background 0.2s', zIndex: 2,
  '&:hover': { background: 'rgba(0,0,0,0.7)' },
};

/* ─── Vote buttons ─── */
const VoteButtons: React.FC<{
  count: number;
  userVote?: 'up' | 'down' | null;
  onUpvote: () => void;
  onDownvote: () => void;
}> = ({ count, userVote, onUpvote, onDownvote }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
    <Box component="button" onClick={onUpvote} sx={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.375rem', color: userVote === 'up' ? '#FF4500' : TEXT_SECONDARY, fontSize: '1rem', display: 'flex', alignItems: 'center', transition: 'all 0.2s', '&:hover': { background: HOVER, color: '#FF4500' } }}>
      <i className="fas fa-arrow-up" />
    </Box>
    <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: '1.125rem', color: TEXT_PRIMARY, minWidth: 36, textAlign: 'center' }}>
      {count}
    </Typography>
    <Box component="button" onClick={onDownvote} sx={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.5rem', borderRadius: '0.375rem', color: userVote === 'down' ? '#6366F1' : TEXT_SECONDARY, fontSize: '1rem', display: 'flex', alignItems: 'center', transition: 'all 0.2s', '&:hover': { background: HOVER, color: '#6366F1' } }}>
      <i className="fas fa-arrow-down" />
    </Box>
  </Box>
);

/* ─── Image Slider (with lightbox) ─── */
const ImageSlider: React.FC<{ images: string[] }> = ({ images }) => {
  const filtered = (images ?? []).filter(Boolean);
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [lbIdx, setLbIdx] = useState(0);

  if (filtered.length === 0) return null;

  const openLightbox = (i: number) => { setLbIdx(i); setLightbox(true); };

  // Single image — simple display
  if (filtered.length === 1) {
    return (
      <>
        <Box
          component="img"
          src={filtered[0]}
          alt="media"
          onClick={() => openLightbox(0)}
          sx={{ width: '100%', maxHeight: 380, objectFit: 'cover', borderRadius: '0.5rem', cursor: 'zoom-in', border: CARD_BORDER, mb: '1.5rem', display: 'block' }}
        />
        {lightbox && (
          <Box onClick={() => setLightbox(false)} sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box component="img" src={filtered[0]} sx={{ maxWidth: '95vw', maxHeight: '92vh', objectFit: 'contain', borderRadius: '0.5rem' }} onClick={(e) => e.stopPropagation()} />
            <Box component="button" onClick={() => setLightbox(false)} sx={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { background: 'rgba(255,255,255,0.3)' } }}>
              <i className="fas fa-times" />
            </Box>
          </Box>
        )}
      </>
    );
  }

  // Multiple images — slider
  const prev = (e?: React.MouseEvent) => { e?.stopPropagation(); setIdx((i) => (i - 1 + filtered.length) % filtered.length); };
  const next = (e?: React.MouseEvent) => { e?.stopPropagation(); setIdx((i) => (i + 1) % filtered.length); };
  const lbPrev = (e?: React.MouseEvent) => { e?.stopPropagation(); setLbIdx((i) => (i - 1 + filtered.length) % filtered.length); };
  const lbNext = (e?: React.MouseEvent) => { e?.stopPropagation(); setLbIdx((i) => (i + 1) % filtered.length); };

  return (
    <>
      <Box sx={{ mb: '1.5rem' }}>
        {/* Main image frame */}
        <Box sx={{ position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', border: CARD_BORDER, cursor: 'zoom-in' }} onClick={() => openLightbox(idx)}>
          <Box component="img" src={filtered[idx]} alt={`media-${idx}`} sx={{ width: '100%', maxHeight: 340, objectFit: 'cover', display: 'block', transition: 'opacity 0.2s' }} />
          {/* Prev */}
          <Box component="button" onClick={prev} sx={{ ...NAV_BTN, left: 8 }}><i className="fas fa-chevron-left" /></Box>
          {/* Next */}
          <Box component="button" onClick={next} sx={{ ...NAV_BTN, right: 8 }}><i className="fas fa-chevron-right" /></Box>
          {/* Counter badge */}
          <Box sx={{ position: 'absolute', bottom: 8, right: 8, background: 'rgba(0,0,0,0.5)', color: '#fff', px: '0.5rem', py: '0.125rem', borderRadius: '0.75rem', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif' }}>
            {idx + 1} / {filtered.length}
          </Box>
        </Box>
        {/* Dot indicators */}
        <Box sx={{ display: 'flex', justifyContent: 'center', gap: '0.375rem', mt: '0.5rem' }}>
          {filtered.map((_, i) => (
            <Box key={i} component="button" onClick={() => setIdx(i)} sx={{ width: i === idx ? 20 : 8, height: 8, borderRadius: '4px', background: i === idx ? '#4F46E5' : '#D1D5DB', border: 'none', cursor: 'pointer', p: 0, transition: 'all 0.25s' }} />
          ))}
        </Box>
        {/* Thumbnail strip */}
        {filtered.length <= 6 && (
          <Box sx={{ display: 'flex', gap: '0.375rem', mt: '0.5rem', overflowX: 'auto' }}>
            {filtered.map((src, i) => (
              <Box key={i} component="img" src={src} onClick={() => setIdx(i)} sx={{ width: 52, height: 52, objectFit: 'cover', borderRadius: '0.375rem', cursor: 'pointer', border: i === idx ? '2px solid #4F46E5' : '2px solid transparent', flexShrink: 0, opacity: i === idx ? 1 : 0.65, transition: 'all 0.2s', '&:hover': { opacity: 1 } }} />
            ))}
          </Box>
        )}
      </Box>

      {/* Lightbox */}
      {lightbox && (
        <Box onClick={() => setLightbox(false)} sx={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box component="img" src={filtered[lbIdx]} sx={{ maxWidth: '90vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: '0.5rem', userSelect: 'none' }} onClick={(e) => e.stopPropagation()} />
          {/* Close */}
          <Box component="button" onClick={() => setLightbox(false)} sx={{ position: 'absolute', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: '50%', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', '&:hover': { background: 'rgba(255,255,255,0.3)' } }}>
            <i className="fas fa-times" />
          </Box>
          {/* Prev */}
          <Box component="button" onClick={lbPrev} sx={{ ...NAV_BTN, left: 16, width: 44, height: 44 }}><i className="fas fa-chevron-left" /></Box>
          {/* Next */}
          <Box component="button" onClick={lbNext} sx={{ ...NAV_BTN, right: 16, width: 44, height: 44 }}><i className="fas fa-chevron-right" /></Box>
          {/* Counter */}
          <Box sx={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', background: 'rgba(255,255,255,0.15)', color: '#fff', px: '0.75rem', py: '0.25rem', borderRadius: '1rem', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif' }}>
            {lbIdx + 1} / {filtered.length}
          </Box>
        </Box>
      )}
    </>
  );
};

/* ─── Answer Card ─── */
const AnswerCard: React.FC<{
  comment: Comment;
  isAccepted: boolean;
  anyAccepted: boolean;
  isQuestionAuthor: boolean;
  onAccept: () => void;
  onVote: () => void;
  onReply: (args: { content: string; parentId: string; images: File[] }) => void;
  allComments: Comment[];
  navigate: ReturnType<typeof useNavigate>;
  onToast: (msg: string) => void;
}> = ({ comment, isAccepted, anyAccepted, isQuestionAuthor, onAccept, onVote, onReply, allComments, navigate, onToast }) => {
  const [countdown, setCountdown] = useState<number | null>(null);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replyImages, setReplyImages] = useState<File[]>([]);
  const [replyPreviews, setReplyPreviews] = useState<string[]>([]);
  const replyFileRef = useRef<HTMLInputElement>(null);

  const replies = allComments.filter((c) => c.parentId === comment._id);

  const handleReplyImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const combined = [...replyImages, ...files].slice(0, 4);
    setReplyImages(combined);
    setReplyPreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = '';
  };
  const removeReplyPreview = (idx: number) => {
    setReplyImages((p) => p.filter((_, i) => i !== idx));
    setReplyPreviews((p) => p.filter((_, i) => i !== idx));
  };
  const submitReply = () => {
    if (!replyText.trim()) return;
    onReply({ content: replyText, parentId: comment._id, images: replyImages });
    setReplyText(''); setReplyImages([]); setReplyPreviews([]); setReplyOpen(false);
  };

  const handleAcceptClick = () => setCountdown(15);
  const handleUndo = () => setCountdown(null);

  const onAcceptRef = useRef(onAccept);
  onAcceptRef.current = onAccept;

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) { onAcceptRef.current(); setCountdown(null); return; }
    const id = setTimeout(() => setCountdown((c) => (c !== null ? c - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [countdown]);

  const handleReport = () => onToast('Report submitted — our moderators will review it.');
  const handleAwardCEU = () => onToast('CEU Award feature coming soon!');

  return (
    <Box
      component="article"
      sx={{
        background: '#FFFFFF',
        borderRadius: '0.75rem',
        boxShadow: isAccepted ? '0 0 0 2px #10B981, 0 4px 12px rgba(16,185,129,0.15)' : CARD_SHADOW,
        border: isAccepted ? '2px solid #10B981' : CARD_BORDER,
        mb: '1.5rem',
        overflow: 'hidden',
        transition: 'all 0.3s ease',
      }}
    >
      {/* Header */}
      <Box sx={{ padding: '1rem 1.5rem', borderBottom: CARD_BORDER, background: BG, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Avatar src={comment.author.avatar} onClick={() => navigate(`/profile/${comment.author._id}`)} sx={{ width: 40, height: 40, cursor: 'pointer', background: GRADIENT, fontWeight: 600 }}>
            {comment.author.name[0]}
          </Avatar>
          <Box>
            <Typography onClick={() => navigate(`/profile/${comment.author._id}`)} sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.9375rem', color: TEXT_PRIMARY, cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
              {comment.author.name}
              {comment.author.isVerified && <Box component="span" sx={{ ml: '0.375rem', color: '#10B981', fontSize: '0.75rem' }}><i className="fas fa-check-circle" /></Box>}
            </Typography>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: TEXT_SECONDARY }}>
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isAccepted && (
            <Box component="span" sx={{ background: ACCEPTED_GRADIENT, color: 'white', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
              <i className="fas fa-check-circle" /> Accepted Answer
            </Box>
          )}

          {/* Undo countdown */}
          {isQuestionAuthor && !anyAccepted && countdown !== null && (
            <>
              <Box component="span" sx={{ background: '#FEF3C7', border: '1px solid #F59E0B', color: '#92400E', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
                <i className="fas fa-clock" /> Accepting in {countdown}s…
              </Box>
              <Box component="button" onClick={handleUndo} sx={{ background: 'none', border: '1px solid #EF4444', color: '#EF4444', padding: '0.25rem 0.625rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', '&:hover': { background: '#EF4444', color: 'white' } }}>
                <i className="fas fa-undo" /> Undo
              </Box>
            </>
          )}

          {/* Accept button — only show if no answer accepted yet */}
          {isQuestionAuthor && !anyAccepted && countdown === null && (
            <Box component="button" onClick={handleAcceptClick} sx={{ background: 'none', border: '1px solid #10B981', color: '#10B981', padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', '&:hover': { background: '#10B981', color: 'white' } }}>
              <i className="fas fa-check" /> Accept Answer
            </Box>
          )}
        </Box>
      </Box>

      {/* Images FIRST (slider) */}
      {(comment.images?.filter(Boolean).length ?? 0) > 0 && (
        <Box sx={{ padding: '1.25rem 1.5rem 0' }}>
          <ImageSlider images={comment.images!} />
        </Box>
      )}

      {/* Answer text */}
      <Box sx={{ padding: '1.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', color: TEXT_PRIMARY, lineHeight: 1.7 }}>
        {comment.content.split('\n').filter(Boolean).map((para, i) => (
          <Typography key={i} sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', color: TEXT_PRIMARY, lineHeight: 1.7, mb: '0.875rem', '&:last-child': { mb: 0 } }}>
            {para}
          </Typography>
        ))}
      </Box>

      {/* Footer actions */}
      <Box sx={{ padding: '0.75rem 1.5rem', borderTop: CARD_BORDER, background: BG, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.25rem' }}>
        <AnswerAction icon="fas fa-reply" label="Reply" onClick={() => setReplyOpen((v) => !v)} active={replyOpen} />
        <AnswerAction
          icon="fas fa-arrow-up"
          label={`${comment.upvotes ?? 0} Upvote${(comment.upvotes ?? 0) !== 1 ? 's' : ''}`}
          onClick={onVote}
          active={comment.userVoted}
          activeColor="#FF4500"
        />
        <AnswerAction icon="fas fa-flag" label="Report" onClick={handleReport} />
        <AnswerAction icon="fas fa-gift" label="Award CEU" onClick={handleAwardCEU} />
      </Box>

      {/* Inline reply form */}
      {replyOpen && (
        <Box sx={{ padding: '1rem 1.5rem', borderTop: CARD_BORDER, background: '#FAFAFA' }}>
          <input ref={replyFileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleReplyImagePick} />
          <Box component="textarea"
            value={replyText}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyText(e.target.value)}
            placeholder={`Reply to ${comment.author.name}…`}
            sx={{ width: '100%', minHeight: 80, p: '0.625rem 0.75rem', border: CARD_BORDER, borderRadius: '0.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: TEXT_PRIMARY, resize: 'vertical', outline: 'none', boxSizing: 'border-box', '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' } }}
          />
          {replyPreviews.length > 0 && (
            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.5rem' }}>
              {replyPreviews.map((src, i) => (
                <Box key={i} sx={{ position: 'relative' }}>
                  <Box component="img" src={src} sx={{ width: 64, height: 64, objectFit: 'cover', borderRadius: '0.375rem', border: CARD_BORDER }} />
                  <Box component="button" onClick={() => removeReplyPreview(i)} sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-times" />
                  </Box>
                </Box>
              ))}
            </Box>
          )}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: '0.625rem' }}>
            <Box component="button" onClick={() => replyFileRef.current?.click()} sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: CARD_BORDER, color: TEXT_SECONDARY, px: '0.625rem', py: '0.3rem', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', '&:hover': { background: HOVER } }}>
              <i className="fas fa-image" style={{ fontSize: '0.75rem' }} /> Image
            </Box>
            <Box sx={{ display: 'flex', gap: '0.5rem' }}>
              <Box component="button" onClick={() => { setReplyOpen(false); setReplyText(''); setReplyImages([]); setReplyPreviews([]); }} sx={{ background: BG, border: CARD_BORDER, color: TEXT_SECONDARY, px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter, sans-serif' }}>Cancel</Box>
              <Box component="button" onClick={submitReply} sx={{ background: GRADIENT, color: '#fff', border: 'none', px: '0.875rem', py: '0.375rem', borderRadius: '1rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', opacity: replyText.trim() ? 1 : 0.5 }}>Reply</Box>
            </Box>
          </Box>
        </Box>
      )}

      {/* Nested replies */}
      {replies.length > 0 && (
        <Box sx={{ borderTop: CARD_BORDER, background: '#FAFAFA' }}>
          {replies.map((reply) => (
            <Box key={reply._id} sx={{ display: 'flex', gap: '0.75rem', padding: '0.875rem 1.5rem', borderBottom: CARD_BORDER, '&:last-child': { borderBottom: 'none' } }}>
              <Avatar src={reply.author.avatar} onClick={() => navigate(`/profile/${reply.author._id}`)} sx={{ width: 30, height: 30, cursor: 'pointer', background: GRADIENT, fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                {reply.author.name[0]}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.25rem', flexWrap: 'wrap' }}>
                  <Typography onClick={() => navigate(`/profile/${reply.author._id}`)} sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: TEXT_PRIMARY, cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
                    {reply.author.name}
                    {reply.author.isVerified && <Box component="span" sx={{ ml: '0.25rem', color: '#10B981', fontSize: '0.625rem' }}><i className="fas fa-check-circle" /></Box>}
                  </Typography>
                  <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: TEXT_SECONDARY }}>
                    {formatDistanceToNow(new Date(reply.createdAt), { addSuffix: true })}
                  </Typography>
                </Box>
                {(reply.images?.filter(Boolean).length ?? 0) > 0 && (
                  <Box sx={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', mb: '0.5rem' }}>
                    {reply.images!.filter(Boolean).map((src, i) => (
                      <Box key={i} component="img" src={src} sx={{ width: 80, height: 60, objectFit: 'cover', borderRadius: '0.375rem', border: CARD_BORDER, cursor: 'zoom-in' }} />
                    ))}
                  </Box>
                )}
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: TEXT_PRIMARY, lineHeight: 1.6 }}>{reply.content}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

/* ─── Reusable action button ─── */
const AnswerAction: React.FC<{ icon: string; label: string; onClick?: () => void; active?: boolean; activeColor?: string }> = ({ icon, label, onClick, active, activeColor = '#4F46E5' }) => (
  <Box component="button" onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: active ? `${activeColor}15` : 'none', border: active ? `1px solid ${activeColor}30` : 'none', color: active ? activeColor : TEXT_SECONDARY, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', transition: 'all 0.2s', '&:hover': { background: HOVER, color: activeColor } }}>
    <i className={icon} />
    {label}
  </Box>
);

/* ─── Expert type ─── */
interface Expert {
  _id: string; name: string; avatar?: string;
  rating: number; trustScore: number; isVerified?: boolean;
  skills?: { name: string; proficiency: string }[];
}

/* ─── Right Sidebar ─── */
const RightSidebar: React.FC<{ post: Post }> = ({ post }) => {
  const navigate = useNavigate();
  const voteCount = (post.upvotes?.length ?? 0) - (post.downvotes?.length ?? 0);
  const timeActive = formatDistanceToNow(new Date(post.createdAt));
  const category = post.eventCategory || (post.tags[0] ? `#${post.tags[0]}` : 'General');

  const { data: experts = [] } = useQuery<Expert[]>({
    queryKey: ['experts', post.tags],
    queryFn: async () => {
      if (!post.tags.length) return [];
      const res = await api.get(`/users/experts?tags=${post.tags.join(',')}`);
      return res.data as Expert[];
    },
    enabled: post.tags.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const expertLabel = post.tags.length > 0
    ? `${post.tags[0].charAt(0).toUpperCase() + post.tags[0].slice(1)} Experts`
    : 'Experts';

  return (
    <>
      {/* Question Stats */}
      <Box sx={{ mb: '1.5rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem' }}>
          <i className="fas fa-chart-bar" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Question Stats</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { icon: 'fas fa-comments', label: 'Answers', value: String(post.commentCount ?? 0) },
            { icon: 'fas fa-arrow-up', label: 'Upvotes', value: String(voteCount) },
            { icon: 'fas fa-coins', label: 'Bounty', value: (post.bounty ?? 0) > 0 ? `${post.bounty} CEU` : 'None', highlight: (post.bounty ?? 0) > 0 },
            { icon: 'fas fa-clock', label: 'Time Active', value: timeActive },
            { icon: 'fas fa-tag', label: 'Category', value: category },
          ].map(({ icon, label, value, highlight }) => (
            <Box key={label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.625rem 0.75rem', background: BG, border: CARD_BORDER, borderRadius: '0.5rem', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', transform: 'translateX(2px)' } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <i className={icon} style={{ color: '#4F46E5', fontSize: '0.875rem', width: 16 }} />
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: TEXT_SECONDARY }}>{label}</Typography>
              </Box>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.875rem', color: highlight ? '#4F46E5' : TEXT_PRIMARY }}>{value}</Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* Tags */}
      {post.tags.length > 0 && (
        <Box sx={{ mb: '1.5rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem' }}>
            <i className="fas fa-tags" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Tags</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {post.tags.map((tag) => (
              <Box key={tag} component="span" sx={{ display: 'inline-flex', alignItems: 'center', padding: '0.375rem 0.75rem', background: '#FFFFFF', border: CARD_BORDER, borderRadius: '2rem', fontSize: '0.75rem', color: TEXT_SECONDARY, fontFamily: 'Inter, sans-serif', transition: 'all 0.2s', cursor: 'pointer', '&:hover': { background: HOVER, color: '#4F46E5', borderColor: '#4F46E5' } }}>
                #{tag}
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Experts */}
      {experts.length > 0 && (
        <Box sx={{ mb: '1.5rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem' }}>
            <i className="fas fa-user-graduate" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{expertLabel}</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {experts.map((expert) => {
              const matchedSkill = expert.skills?.find((s) => post.tags.some((t) => s.name.toLowerCase() === t.toLowerCase()));
              return (
                <Box key={expert._id} onClick={() => navigate(`/profile/${expert._id}`)} sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.75rem', background: BG, border: CARD_BORDER, borderRadius: '0.625rem', cursor: 'pointer', transition: 'all 0.2s', '&:hover': { borderColor: '#4F46E5', background: '#FFFFFF', transform: 'translateX(2px)' } }}>
                  <Avatar src={expert.avatar} sx={{ width: 36, height: 36, flexShrink: 0, background: GRADIENT, fontSize: '0.875rem', fontWeight: 600 }}>
                    {expert.name[0]}
                  </Avatar>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.8125rem', color: TEXT_PRIMARY, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{expert.name}</Typography>
                      {expert.isVerified && <i className="fas fa-check-circle" style={{ color: '#10B981', fontSize: '0.6875rem' }} />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {matchedSkill && <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: '#4F46E5', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{matchedSkill.name}</Typography>}
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.2rem', ml: 'auto', flexShrink: 0 }}>
                        <i className="fas fa-star" style={{ color: '#F59E0B', fontSize: '0.625rem' }} />
                        <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.6875rem', color: TEXT_SECONDARY, fontWeight: 600 }}>{(expert.rating || 0).toFixed(1)}</Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* Q&A Guidelines */}
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '0.75rem' }}>
          <i className="fas fa-book" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
          <Typography sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.75rem', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Q&A Guidelines</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {[
            { title: 'Be specific & detailed', sub: 'Include step-by-step instructions' },
            { title: 'Share your experience', sub: 'Mention qualifications & expertise' },
            { title: 'Offer in-person help', sub: 'Include location & availability' },
            { title: 'Verify your solutions', sub: 'Only suggest tested methods' },
          ].map(({ title, sub }) => (
            <Box key={title} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', padding: '0.5rem 0.75rem', background: BG, border: CARD_BORDER, borderRadius: '0.5rem', transition: 'all 0.2s', '&:hover': { background: HOVER, borderColor: '#4F46E5' } }}>
              <Box sx={{ width: 20, height: 20, borderRadius: '50%', background: GRADIENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', flexShrink: 0, mt: '0.125rem' }}>
                <i className="fas fa-check" />
              </Box>
              <Box>
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: TEXT_PRIMARY, fontWeight: 600 }}>{title}</Typography>
                <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.7rem', color: TEXT_SECONDARY }}>{sub}</Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </>
  );
};

/* ─── Main Component ─── */
const QuestionDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const [answerText, setAnswerText] = useState('');
  // Default to newest so latest answers appear on top
  const [sortBy, setSortBy] = useState<'newest' | 'top'>('newest');
  const [answerImages, setAnswerImages] = useState<File[]>([]);
  const [answerImagePreviews, setAnswerImagePreviews] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /* ── fetch question ── */
  const { data: post, isLoading: postLoading } = useQuery({
    queryKey: ['post', id],
    queryFn: async () => { const res = await api.get(`/posts/${id}`); return res.data as Post; },
  });

  /* ── fetch comments ── */
  const { data: comments = [], isLoading: commentsLoading } = useQuery({
    queryKey: ['comments', id],
    queryFn: async () => { const res = await api.get(`/posts/${id}/comments`); return res.data as Comment[]; },
    enabled: !!id,
  });

  /* ── vote ── */
  const voteMutation = useMutation({
    mutationFn: (vote: 'up' | 'down' | null) => api.put(`/posts/${id}/vote`, { vote }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['post', id] }),
  });

  /* ── post answer ── */
  const answerMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('content', answerText);
      answerImages.forEach((f) => formData.append('images', f));
      return api.post(`/posts/${id}/comments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      setAnswerText(''); setAnswerImages([]); setAnswerImagePreviews([]);
      qc.invalidateQueries({ queryKey: ['comments', id] });
      qc.invalidateQueries({ queryKey: ['post', id] });
      setToast('Your answer has been posted!');
    },
  });

  /* ── accept answer ── */
  const acceptMutation = useMutation({
    mutationFn: (commentId: string) => api.put(`/posts/${id}/accept-answer`, { commentId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['post', id] }); setToast('Answer accepted!'); },
  });

  const voteCommentMutation = useMutation({
    mutationFn: (commentId: string) => api.put(`/posts/${id}/comments/${commentId}/vote`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comments', id] }),
  });

  const replyMutation = useMutation({
    mutationFn: async ({ content, parentId, images }: { content: string; parentId: string; images: File[] }) => {
      const formData = new FormData();
      formData.append('content', content);
      formData.append('parentId', parentId);
      images.forEach((f) => formData.append('images', f));
      return api.post(`/posts/${id}/comments`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['comments', id] });
      setToast('Reply posted!');
    },
  });

  const handleAccept = useCallback(
    (commentId: string) => acceptMutation.mutate(commentId),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id],
  );

  /* ── image picker ── */
  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const combined = [...answerImages, ...files].slice(0, 5);
    setAnswerImages(combined);
    setAnswerImagePreviews(combined.map((f) => URL.createObjectURL(f)));
    e.target.value = '';
  };
  const removePreview = (idx: number) => {
    setAnswerImages((prev) => prev.filter((_, i) => i !== idx));
    setAnswerImagePreviews((prev) => prev.filter((_, i) => i !== idx));
  };

  /* ── share ── */
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => setToast('Link copied to clipboard!')).catch(() => setToast('Copy: ' + window.location.href));
  };

  /* ── loading ── */
  if (postLoading) return (
    <Layout>
      <Skeleton variant="rounded" height={60} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={300} sx={{ mb: 2 }} />
      <Skeleton variant="rounded" height={200} />
    </Layout>
  );
  if (!post) return null;

  const voteCount = (post.upvotes?.length ?? 0) - (post.downvotes?.length ?? 0);
  const isAuthor = user?._id === post.author._id;
  const firstTag = post.tags[0];

  // only top-level comments (not replies) are "answers"
  const rootComments = comments.filter((c) => !c.parentId);
  const sortedComments = [...rootComments].sort((a, b) => {
    if (sortBy === 'top') return (b.upvotes ?? 0) - (a.upvotes ?? 0);
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  // accepted answer always first
  const orderedComments = [...sortedComments].sort((a) => (a._id === post.acceptedAnswerId ? -1 : 0));

  return (
    <Layout rightPanel={<RightSidebar post={post} />}>
      {/* Toast */}
      <Snackbar open={!!toast} autoHideDuration={3000} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert severity="success" onClose={() => setToast(null)} sx={{ fontFamily: 'Inter, sans-serif' }}>{toast}</Alert>
      </Snackbar>

      {/* ── Breadcrumbs ── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem', mb: '1.5rem', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', color: TEXT_SECONDARY }}>
        <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Home</Box>
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" onClick={() => navigate('/feed')} sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>Q&amp;A Forum</Box>
        {firstTag && (<><Box component="span" sx={{ color: '#E5E7EB' }}>/</Box><Box component="span" sx={{ cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>{firstTag}</Box></>)}
        <Box component="span" sx={{ color: '#E5E7EB' }}>/</Box>
        <Box component="span" sx={{ color: TEXT_PRIMARY }}>Question</Box>
      </Box>

      {/* ── Question Card ── */}
      <Box component="article" sx={{ background: '#FFFFFF', border: CARD_BORDER, borderRadius: '0.75rem', boxShadow: CARD_SHADOW, overflow: 'hidden', mb: '2rem' }}>

        {/* Header */}
        <Box sx={{ padding: '1.5rem', borderBottom: CARD_BORDER, background: BG }}>
          {/* Tags + bounty */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', mb: '1rem' }}>
            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {post.tags.length > 0 ? post.tags.map((t) => (
                <Box key={t} component="span" sx={{ display: 'inline-flex', alignItems: 'center', background: GRADIENT, color: 'white', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>{t}</Box>
              )) : (
                <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', background: GRADIENT, color: 'white', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>
                  <i className="fas fa-question-circle" /> Question
                </Box>
              )}
            </Box>
            {(post.bounty ?? 0) > 0 && (
              <Box component="span" sx={{ background: AMBER_GRADIENT, color: 'white', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'Inter, sans-serif', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                <i className="fas fa-coins" /> {post.bounty} CEU Bounty
              </Box>
            )}
          </Box>

          {/* Author */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.75rem', mb: '1rem' }}>
            <Avatar src={post.author.avatar} onClick={() => navigate(`/profile/${post.author._id}`)} sx={{ width: 40, height: 40, cursor: 'pointer', background: GRADIENT, fontWeight: 600 }}>
              {post.author.name[0]}
            </Avatar>
            <Box>
              <Typography onClick={() => navigate(`/profile/${post.author._id}`)} sx={{ fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.875rem', color: TEXT_PRIMARY, cursor: 'pointer', '&:hover': { color: '#4F46E5' } }}>
                {post.author.name}
                {post.author.isVerified && <Box component="span" sx={{ ml: '0.375rem', color: '#10B981', fontSize: '0.75rem' }}><i className="fas fa-check-circle" /></Box>}
              </Typography>
              <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.75rem', color: TEXT_SECONDARY }}>
                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
              </Typography>
            </Box>
          </Box>

          {/* Category DIRECTLY above title */}
          {post.eventCategory && (
            <Box sx={{ mb: '0.5rem' }}>
              <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.375rem', background: HOVER, border: CARD_BORDER, borderRadius: '0.375rem', padding: '0.25rem 0.625rem', fontSize: '0.75rem', fontFamily: 'Inter, sans-serif', color: '#4F46E5', fontWeight: 500 }}>
                <i className="fas fa-folder" style={{ fontSize: '0.7rem' }} />
                {post.eventCategory}
              </Box>
            </Box>
          )}

          {/* Title */}
          <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: '1.5rem', color: TEXT_PRIMARY, lineHeight: 1.4 }}>
            {post.title}
          </Typography>
        </Box>

        {/* Question body: media ABOVE description */}
        <Box sx={{ padding: '1.5rem', background: '#FFFFFF', lineHeight: 1.7 }}>
          {/* Media slider ABOVE question text */}
          {(post.images?.filter(Boolean).length ?? 0) > 0 && (
            <ImageSlider images={post.images} />
          )}

          {post.content.split('\n').filter(Boolean).map((para, i) => (
            <Typography key={i} sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.9375rem', color: TEXT_PRIMARY, lineHeight: 1.7, mb: '1rem', '&:last-child': { mb: 0 } }}>
              {para}
            </Typography>
          ))}
        </Box>

        {/* Footer */}
        <Box sx={{ padding: '1rem 1.5rem', borderTop: CARD_BORDER, background: BG, display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          <VoteButtons
            count={voteCount}
            userVote={post.userVote}
            onUpvote={() => voteMutation.mutate(post.userVote === 'up' ? null : 'up')}
            onDownvote={() => voteMutation.mutate(post.userVote === 'down' ? null : 'down')}
          />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.25rem', ml: 'auto', flexWrap: 'wrap' }}>
            <QAction icon="fas fa-comment" label={`${post.commentCount ?? 0} Answers`} onClick={() => document.getElementById('answers-section')?.scrollIntoView({ behavior: 'smooth' })} />
            <QAction icon="fas fa-share" label="Share" onClick={handleShare} />
            <QAction icon={saved ? 'fas fa-bookmark' : 'far fa-bookmark'} label="Save" onClick={() => { setSaved((v) => !v); setToast(saved ? 'Removed from saved.' : 'Question saved!'); }} active={saved} />
            <QAction icon="fas fa-flag" label="Report" onClick={() => setToast('Report submitted — our moderators will review it.')} />
            {isAuthor && <QAction icon="fas fa-edit" label="Edit" onClick={() => navigate(`/edit-post/${id}`)} />}
          </Box>
        </Box>
      </Box>

      {/* ── Answers ── */}
      <Box component="section" id="answers-section" sx={{ mt: '2rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: '1.5rem', pb: '0.75rem', borderBottom: '2px solid #E5E7EB' }}>
          <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.25rem', color: TEXT_PRIMARY }}>Answers</Typography>
          <Box component="span" sx={{ background: BG, color: TEXT_SECONDARY, padding: '0.25rem 0.75rem', borderRadius: '1rem', fontFamily: 'Inter, sans-serif', fontSize: '0.875rem', fontWeight: 500, border: CARD_BORDER }}>
            {post.commentCount ?? 0} Answers
          </Box>
        </Box>

        {/* Sort */}
        <Box sx={{ display: 'flex', gap: '0.5rem', mb: '1.5rem', flexWrap: 'wrap' }}>
          {([{ label: 'Most Recent', value: 'newest' as const }, { label: 'Top Answers', value: 'top' as const }]).map(({ label, value }) => (
            <Box key={value} component="button" onClick={() => setSortBy(value)} sx={{ background: sortBy === value ? GRADIENT : BG, color: sortBy === value ? 'white' : TEXT_SECONDARY, border: sortBy === value ? 'none' : CARD_BORDER, padding: '0.5rem 1rem', borderRadius: '0.5rem', fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer', transition: 'all 0.2s', '&:hover': sortBy !== value ? { borderColor: '#4F46E5', color: '#4F46E5' } : {} }}>
              {label}
            </Box>
          ))}
        </Box>

        {/* Cards */}
        {commentsLoading ? (
          <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
        ) : orderedComments.length === 0 ? (
          <Box sx={{ background: '#FFFFFF', border: CARD_BORDER, borderRadius: '0.75rem', padding: '3rem', textAlign: 'center', mb: '2rem' }}>
            <i className="fas fa-comment-alt" style={{ fontSize: '2rem', color: '#E5E7EB', marginBottom: '1rem', display: 'block' }} />
            <Typography sx={{ fontFamily: 'Inter, sans-serif', color: TEXT_SECONDARY }}>No answers yet. Be the first to help!</Typography>
          </Box>
        ) : (
          orderedComments.map((comment) => (
            <AnswerCard
              key={comment._id}
              comment={comment}
              isAccepted={comment._id === post.acceptedAnswerId}
              anyAccepted={!!post.acceptedAnswerId}
              isQuestionAuthor={isAuthor}
              onAccept={() => handleAccept(comment._id)}
              onVote={() => voteCommentMutation.mutate(comment._id)}
              onReply={(args) => replyMutation.mutate(args)}
              allComments={comments}
              navigate={navigate}
              onToast={setToast}
            />
          ))
        )}
      </Box>

      {/* ── Answer Form ── */}
      <Box id="answer-form-section" component="section" sx={{ mt: '2rem', background: '#FFFFFF', border: CARD_BORDER, borderRadius: '0.75rem', boxShadow: CARD_SHADOW, overflow: 'hidden' }}>
        <Box sx={{ padding: '1.25rem 1.5rem', borderBottom: CARD_BORDER, background: BG }}>
          <Typography sx={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600, fontSize: '1.125rem', color: TEXT_PRIMARY }}>Post Your Answer</Typography>
        </Box>
        <Box sx={{ padding: '1.5rem' }}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImagePick} />
          <RichTextEditor
            value={answerText}
            onChange={setAnswerText}
            placeholder="Type your answer here… Be as detailed as possible to help others."
            minHeight={160}
            extraToolbar={
              <Box component="button" type="button" title="Attach Image" onMouseDown={(e: React.MouseEvent) => { e.preventDefault(); fileInputRef.current?.click(); }} sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem', px: '0.625rem', py: '0.3rem', borderRadius: '0.375rem', border: '1px solid #E5E7EB', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 500, background: '#fff', color: '#374151', '&:hover': { background: '#F3F4F6', borderColor: '#D1D5DB' } }}>
                <i className="fas fa-image" style={{ fontSize: '0.7rem' }} /> Image
              </Box>
            }
          />

          {/* Preview thumbnails */}
          {answerImagePreviews.length > 0 && (
            <Box sx={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', mt: '0.75rem' }}>
              {answerImagePreviews.map((src, i) => (
                <Box key={i} sx={{ position: 'relative', display: 'inline-block' }}>
                  <Box component="img" src={src} sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: '0.375rem', border: CARD_BORDER }} />
                  <Box component="button" onClick={() => removePreview(i)} sx={{ position: 'absolute', top: -6, right: -6, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.6rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="fas fa-times" />
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          {/* Submit row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', mt: '1rem' }}>
            <Typography sx={{ fontFamily: 'Inter, sans-serif', fontSize: '0.8125rem', color: TEXT_SECONDARY }}>
              By posting your answer, you agree to our community guidelines.
              {(post.bounty ?? 0) > 0 && (<> This question has a <Box component="strong" sx={{ color: TEXT_PRIMARY }}>{post.bounty} CEU bounty</Box> for the accepted answer.</>)}
            </Typography>
            <Box component="button" onClick={() => answerMutation.mutate()} disabled={!answerText.trim() || answerMutation.isLoading} sx={{ background: GRADIENT, color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '0.5rem', fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: '0.9375rem', cursor: answerText.trim() ? 'pointer' : 'not-allowed', opacity: answerText.trim() ? 1 : 0.6, display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s', '&:hover': answerText.trim() ? { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(79,70,229,0.3)' } : {} }}>
              <i className="fas fa-paper-plane" />
              {answerMutation.isLoading ? 'Posting…' : 'Post Answer'}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Mobile FABs */}
      <Box sx={{ position: 'fixed', bottom: '2rem', right: '2rem', display: { xs: 'flex', lg: 'none' }, flexDirection: 'column', gap: '0.75rem', zIndex: 90 }}>
        <Box component="button" onClick={() => navigate(-1 as never)} sx={{ width: 56, height: 56, background: '#FFFFFF', color: '#4F46E5', border: CARD_BORDER, borderRadius: '50%', fontSize: '1.25rem', cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', '&:hover': { transform: 'scale(1.1)' } }}>
          <i className="fas fa-arrow-left" />
        </Box>
        <Box component="button" onClick={() => document.getElementById('answer-form-section')?.scrollIntoView({ behavior: 'smooth' })} sx={{ width: 56, height: 56, background: GRADIENT, color: 'white', border: 'none', borderRadius: '50%', fontSize: '1.25rem', cursor: 'pointer', boxShadow: '0 8px 24px rgba(79,70,229,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s', '&:hover': { transform: 'scale(1.1)' } }}>
          <i className="fas fa-pen" />
        </Box>
      </Box>
    </Layout>
  );
};

/* ─── Question action button ─── */
const QAction: React.FC<{ icon: string; label: string; onClick?: () => void; active?: boolean }> = ({ icon, label, onClick, active }) => (
  <Box component="button" onClick={onClick} sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', background: active ? '#4F46E510' : 'none', border: 'none', color: active ? '#4F46E5' : TEXT_SECONDARY, fontSize: '0.875rem', fontFamily: 'Inter, sans-serif', cursor: 'pointer', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', transition: 'all 0.2s', '&:hover': { background: HOVER, color: '#4F46E5' } }}>
    <i className={icon} />
    {label}
  </Box>
);

export default QuestionDetail;
