import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Avatar,
  Skeleton,
  Menu,
  MenuItem as MuiMenuItem,
  CircularProgress,
} from '@mui/material';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import Layout from '../components/layout/Layout';
import api from '../services/api';
import { Post, Exchange } from '../types';
import { useAuth } from '../context/AuthContext';
import OnlineAvatar from '../components/OnlineAvatar';

// ── Helpers ─────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  skill: 'Skill Offering',
  tool: 'Tool Available',
  event: 'Event',
  question: 'Question',
  general: 'General Post',
};
const TYPE_ICONS: Record<string, string> = {
  skill: 'fas fa-chalkboard-teacher',
  tool: 'fas fa-tools',
  event: 'fas fa-calendar-alt',
  question: 'fas fa-question-circle',
  general: 'fas fa-bullhorn',
};
const TYPE_COLORS: Record<string, { bg: string; color: string; border: string; gradient: string }> = {
  skill:    { gradient: 'linear-gradient(135deg, #4F46E5, #10B981)', bg: '#EDE9FE', color: '#7C3AED', border: '#DDD6FE' },
  tool:     { gradient: 'linear-gradient(135deg, #10B981, #3B82F6)', bg: '#FEF3C7', color: '#D97706', border: '#FDE68A' },
  event:    { gradient: 'linear-gradient(135deg, #4F46E5, #10B981)', bg: '#D1FAE5', color: '#059669', border: '#A7F3D0' },
  question: { gradient: 'linear-gradient(135deg, #06B6D4, #6366F1)', bg: '#DBEAFE', color: '#2563EB', border: '#BFDBFE' },
  general:  { gradient: 'linear-gradient(135deg, #6B7280, #374151)', bg: '#F3F4F6', color: '#6B7280', border: '#E5E7EB' },
};

// ── Shared styled button ─────────────────────────────────────────────────────
const HtmlBtn = (props: React.ButtonHTMLAttributes<HTMLButtonElement> & { sx?: object }) => {
  const { sx, ...rest } = props;
  return <Box component="button" sx={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', ...sx }} {...rest as any} />;
};

// Route to the correct detail page based on post type
const postDetailUrl = (post: Post) => {
  if (post.type === 'skill') return `/skills/${post._id}`;
  if (post.type === 'tool') return `/tools/${post._id}`;
  if (post.type === 'event') return `/events/${post._id}`;
  if (post.type === 'question') return `/questions/${post._id}`;
  return `/posts/${post._id}`;
};

// Parse tags that may arrive as a JSON-stringified array inside a single element
const parseTags = (tags: string[]): string[] => {
  if (!tags || tags.length === 0) return [];
  if (tags.length === 1 && tags[0].trim().startsWith('[')) {
    try { return JSON.parse(tags[0]) as string[]; } catch { /* fall through */ }
  }
  return tags;
};

const PROFICIENCY_LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const PROFICIENCY_COLORS: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: '#D1FAE5', color: '#065F46' },
  intermediate: { bg: '#DBEAFE', color: '#1E40AF' },
  advanced:     { bg: '#EDE9FE', color: '#5B21B6' },
  expert:       { bg: '#FEF3C7', color: '#92400E' },
};

const parseHours = (start: string, end: string): number => {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  return Math.max(0.25, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
};
const PROF_MULT: Record<string, number> = { beginner: 0.8, intermediate: 1.0, expert: 1.5 };
const fmt12 = (t: string): string => {
  const [h, m] = t.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr}${ap}` : `${hr}:${String(m).padStart(2, '0')}${ap}`;
};
const CEU_GRAD = 'linear-gradient(135deg,#4F46E5,#10B981)';

// ── Helpers ──────────────────────────────────────────────────────────────────
const getMediaType = (url: string | null | undefined): 'video' | 'gif' | 'image' => {
  if (!url) return 'image';
  const clean = url.split('?')[0].toLowerCase();
  if (/\.(mp4|mov|webm|ogg|avi|mkv)$/.test(clean)) return 'video';
  if (/\.gif$/.test(clean)) return 'gif';
  return 'image'; // handles png, jpg, jpeg, webp, svg, bmp, etc.
};

// ── Media Slider ──────────────────────────────────────────────────────────────
const MediaSlider: React.FC<{ media: string[]; onNavigate: () => void }> = ({ media, onNavigate }) => {
  const [idx, setIdx] = useState(0);
  const [errored, setErrored] = useState<Record<number, boolean>>({});

  const valid = media.filter((src, i) => Boolean(src) && !errored[i]);
  if (valid.length === 0) return null;
  const count = valid.length;
  const safeIdx = idx % count;

  const prev = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i - 1 + count) % count); };
  const next = (e: React.MouseEvent) => { e.stopPropagation(); setIdx(i => (i + 1) % count); };

  return (
    <Box sx={{ position: 'relative', borderRadius: '0.75rem', overflow: 'hidden', background: '#0D0D0D', mb: '0.875rem', mx: '1.25rem' }}>
      {/* Slides */}
      <Box sx={{ display: 'flex', transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)', transform: `translateX(-${safeIdx * 100}%)` }}>
        {valid.map((src, i) => {
          const type = getMediaType(src);
          return (
            <Box key={i} sx={{ minWidth: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#0D0D0D' }}>
              {type === 'video' ? (
                <Box
                  component="video"
                  src={src}
                  controls
                  onClick={(e: React.MouseEvent) => e.stopPropagation()}
                  sx={{ maxWidth: '100%', maxHeight: 480, display: 'block', outline: 'none' }}
                />
              ) : (
                <Box
                  component="img"
                  src={src}
                  alt=""
                  onClick={onNavigate}
                  onError={() => setErrored(e => ({ ...e, [i]: true }))}
                  sx={{
                    maxWidth: '100%', maxHeight: 480, width: 'auto', height: 'auto',
                    display: 'block', cursor: 'pointer', objectFit: 'contain',
                  }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Arrows */}
      {count > 1 && (
        <>
          <Box component="button" onClick={prev} sx={{
            position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '0.75rem', backdropFilter: 'blur(4px)',
            transition: 'background 0.2s', '&:hover': { background: 'rgba(0,0,0,0.8)' },
          }}>
            <i className="fas fa-chevron-left" />
          </Box>
          <Box component="button" onClick={next} sx={{
            position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
            width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(0,0,0,0.55)', color: '#fff', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: '0.75rem', backdropFilter: 'blur(4px)',
            transition: 'background 0.2s', '&:hover': { background: 'rgba(0,0,0,0.8)' },
          }}>
            <i className="fas fa-chevron-right" />
          </Box>

          {/* Dot indicators */}
          <Box sx={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
            {valid.map((_, i) => (
              <Box key={i} component="button" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setIdx(i); }} sx={{
                width: safeIdx === i ? 18 : 6, height: 6, borderRadius: '3px',
                border: 'none', cursor: 'pointer', p: 0,
                background: safeIdx === i ? '#fff' : 'rgba(255,255,255,0.45)',
                transition: 'all 0.25s', boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
              }} />
            ))}
          </Box>

          {/* Counter + type badge */}
          <Box sx={{
            position: 'absolute', top: 10, right: 10, display: 'flex', gap: '0.4rem', alignItems: 'center',
          }}>
            {getMediaType(valid[safeIdx]) === 'video' && (
              <Box sx={{ background: 'rgba(239,68,68,0.85)', color: '#fff', fontSize: '0.65rem', fontWeight: 700, px: '0.45rem', py: '0.2rem', borderRadius: '0.4rem', letterSpacing: '0.05em' }}>
                VIDEO
              </Box>
            )}
            <Box sx={{
              background: 'rgba(0,0,0,0.55)', color: '#fff',
              fontSize: '0.72rem', fontWeight: 600, px: '0.5rem', py: '0.2rem',
              borderRadius: '1rem', backdropFilter: 'blur(4px)',
            }}>
              {safeIdx + 1} / {count}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

// ── Post Card ────────────────────────────────────────────────────────────────
interface PostCardProps {
  post: Post;
  onVote: (postId: string, vote: 'up' | 'down' | null) => void;
}

const PostCard: React.FC<PostCardProps> = ({ post, onVote }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) { navigate('/login'); return; }
    action();
  };

  // Save (localStorage)
  const SAVE_KEY = 'savedPosts';
  const getSaved = (): string[] => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch { return []; } };
  const [saved, setSaved] = useState(() => getSaved().includes(post._id));
  const toggleSave = () => {
    requireAuth(() => {
      const list = getSaved();
      const next = saved ? list.filter(id => id !== post._id) : [...list, post._id];
      localStorage.setItem(SAVE_KEY, JSON.stringify(next));
      setSaved(!saved);
    });
  };

  // Share
  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}${postDetailUrl(post)}`;
    if (navigator.share) {
      await navigator.share({ title: post.title, url }).catch(() => {});
    } else {
      await navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  const score = post.upvotes.length - post.downvotes.length;
  const userVote = post.userVote;
  const typeLabel = TYPE_LABELS[post.type] || post.type;
  const typeIcon = TYPE_ICONS[post.type] || 'fas fa-file-alt';
  const typeColor = TYPE_COLORS[post.type] || TYPE_COLORS.general;
  const tags = parseTags(post.tags);
  const hasImages = post.images && post.images.length > 0;
  const proficiencyTag = tags.find((t) => PROFICIENCY_LEVELS.includes(t.toLowerCase()))?.toLowerCase();
  const proficiencyColor = proficiencyTag ? PROFICIENCY_COLORS[proficiencyTag] : null;
  const displayTags = tags.filter(t => !PROFICIENCY_LEVELS.includes(t.toLowerCase()) && t !== post.type);
  const ctaIcon = post.type === 'question' ? 'fas fa-lightbulb' : post.type === 'tool' ? 'fas fa-handshake' : 'fas fa-exchange-alt';
  const ctaLabel = post.type === 'question' ? 'Answer' : post.type === 'tool' ? 'Request Borrow' : 'Request Exchange';

  return (
    <Box
      onClick={() => navigate(postDetailUrl(post))}
      sx={{
        background: '#FFFFFF',
        borderRadius: '1rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        border: '1px solid #E5E7EB',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { borderColor: typeColor.border, boxShadow: '0 6px 20px rgba(0,0,0,0.09)' },
      }}
    >
      {/* Top section — slightly shaded background */}
      <Box sx={{ p: '1rem 1.25rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>

        {/* 1 — Meta row: avatar + author + time + badge + menu */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '0' }}>
          <OnlineAvatar
            userId={post.author._id}
            src={post.author.avatar || undefined}
            isVerified={post.author.isVerified}
            sx={{ width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700, flexShrink: 0,
              background: 'linear-gradient(135deg,#4F46E5,#10B981)',
              cursor: 'pointer', border: '2px solid #E5E7EB' }}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${post.author._id}`); }}
          >
            {post.author.name?.[0]?.toUpperCase()}
          </OnlineAvatar>
          <Box sx={{ minWidth: 0 }}>
            <Box
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${post.author._id}`); }}
              sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.2, cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}
            >
              {post.author.name}
            </Box>
            <Box sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
            </Box>
          </Box>
          <Box component="span" sx={{
            ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            px: '0.7rem', py: '0.3rem', borderRadius: '2rem',
            background: typeColor.gradient, color: '#fff',
            fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}>
            <i className={typeIcon} style={{ fontSize: '0.65rem' }} />
            {typeLabel}
          </Box>
          <HtmlBtn
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget as HTMLButtonElement); }}
            sx={{ p: '0.3rem 0.4rem', borderRadius: '0.5rem', color: '#9CA3AF', flexShrink: 0,
              '&:hover': { background: '#F3F4F6', color: '#374151' } }}
          >
            <i className="fas fa-ellipsis-h" style={{ fontSize: '0.875rem' }} />
          </HtmlBtn>
        </Box>

      </Box>

      {/* 2 — Title + proficiency badge */}
      <Box sx={{ px: '1.25rem', pt: '0.875rem', pb: '0.875rem' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
          <Typography
            onClick={() => navigate(postDetailUrl(post))}
            sx={{
              fontSize: '1.05rem', fontWeight: 700, color: '#111827', lineHeight: 1.45,
              cursor: 'pointer', flex: 1, textTransform: 'capitalize', '&:hover': { color: typeColor.color },
            }}
          >
            {post.title}
          </Typography>
          {proficiencyTag && proficiencyColor && (
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0,
              mt: '0.1rem', px: '0.55rem', py: '0.2rem', borderRadius: '2rem',
              background: proficiencyColor.bg, color: proficiencyColor.color,
              fontSize: '0.68rem', fontWeight: 600, whiteSpace: 'nowrap',
            }}>
              <i className="fas fa-signal" style={{ fontSize: '0.6rem' }} />
              {proficiencyTag.charAt(0).toUpperCase() + proficiencyTag.slice(1)}
            </Box>
          )}
        </Box>
      </Box>

      {/* 3 — Media slider */}
      {hasImages && (
        <MediaSlider media={post.images} onNavigate={() => navigate(postDetailUrl(post))} />
      )}

      {/* 4 — Description + tags */}
      <Box sx={{ px: '1.25rem', pb: 0 }}>
        {/* Description — 3-line clamp with inline "... (more)" */}
        {post.content && (() => {
          const paras = post.content.split(/\n\n+/);
          const rawFirst = paras[0].replace(/\n/g, ' ').trim();
          // Strip auto-appended bullet metadata (e.g. "• Desired Proficiency: ...")
          const firstPara = rawFirst.split(/\s•\s/)[0].trim();
          const hasMore = paras.length > 1 || rawFirst.includes(' • ');
          return (
            <Typography component="p" sx={{
              fontSize: '0.875rem', color: '#4B5563', lineHeight: 1.65,
              mb: displayTags.length > 0 ? '0.75rem' : '0.875rem',
            }}>
              {firstPara}
              {hasMore && (
                <>
                  {'... '}
                  <Box
                    component="span"
                    onClick={() => navigate(postDetailUrl(post))}
                    sx={{ color: '#4F46E5', fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}
                  >
                    (more)
                  </Box>
                </>
              )}
            </Typography>
          );
        })()}

        {/* Tags (excluding proficiency + type auto-tags) */}
        {displayTags.length > 0 && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', mb: '0.875rem' }}>
            {displayTags.slice(0, 5).map((tag) => (
              <Box key={tag} component="span" sx={{
                px: '0.55rem', py: '0.2rem',
                background: '#F9FAFB', border: '1px solid #E5E7EB',
                borderRadius: '2rem', fontSize: '0.7rem', color: '#6B7280', fontWeight: 500,
              }}>
                #{tag}
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Action bar */}
      <Box sx={{
        px: '1.25rem', py: '0.75rem',
        borderTop: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: '0.25rem',
      }}>
        {/* Vote */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: '0',
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          borderRadius: '2rem', overflow: 'hidden', mr: '0.25rem',
        }}>
          <HtmlBtn
            onClick={(e) => { e.stopPropagation(); requireAuth(() => onVote(post._id, userVote === 'up' ? null : 'up')); }}
            sx={{ px: '0.75rem', py: '0.45rem', color: userVote === 'up' ? '#EF4444' : '#6B7280',
              fontSize: '0.8rem', '&:hover': { background: '#FEE2E2', color: '#EF4444' } }}
          >
            <i className="fas fa-arrow-up" />
          </HtmlBtn>
          <Box sx={{ px: '0.5rem', fontSize: '0.8125rem', fontWeight: 700,
            color: userVote === 'up' ? '#EF4444' : userVote === 'down' ? '#6366F1' : '#374151',
            borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', py: '0.45rem' }}>
            {score}
          </Box>
          <HtmlBtn
            onClick={(e) => { e.stopPropagation(); requireAuth(() => onVote(post._id, userVote === 'down' ? null : 'down')); }}
            sx={{ px: '0.75rem', py: '0.45rem', color: userVote === 'down' ? '#6366F1' : '#6B7280',
              fontSize: '0.8rem', '&:hover': { background: '#EEF2FF', color: '#6366F1' } }}
          >
            <i className="fas fa-arrow-down" />
          </HtmlBtn>
        </Box>

        {/* Comments */}
        <HtmlBtn
          onClick={() => navigate(postDetailUrl(post))}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', color: '#6B7280', fontSize: '0.8rem', fontWeight: 500,
            '&:hover': { background: '#F3F4F6', color: '#374151' } }}
        >
          <i className="fas fa-comment-alt" />
          <span>{post.commentCount}</span>
        </HtmlBtn>

        {/* Share */}
        <HtmlBtn
          onClick={handleShare}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', color: '#6B7280', fontSize: '0.8rem',
            '&:hover': { background: '#F3F4F6', color: '#374151' } }}
        >
          <i className="fas fa-share" />
        </HtmlBtn>

        {/* Save */}
        <HtmlBtn
          onClick={(e) => { e.stopPropagation(); toggleSave(); }}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', fontSize: '0.8rem', transition: 'all 0.2s',
            color: saved ? '#4F46E5' : '#6B7280',
            '&:hover': { background: saved ? '#EEF2FF' : '#F3F4F6', color: saved ? '#4F46E5' : '#374151' } }}
        >
          <i className={saved ? 'fas fa-bookmark' : 'far fa-bookmark'} />
        </HtmlBtn>

        {/* CTA */}
        <HtmlBtn
          onClick={(e) => { e.stopPropagation(); navigate(postDetailUrl(post)); }}
          sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem',
            px: '0.875rem', py: '0.45rem', borderRadius: '2rem',
            background: typeColor.bg, color: typeColor.color,
            border: `1px solid ${typeColor.border}`,
            fontSize: '0.78rem', fontWeight: 600,
            '&:hover': { filter: 'brightness(0.95)' } }}
        >
          <i className={ctaIcon} style={{ fontSize: '0.75rem' }} />
          {ctaLabel}
        </HtmlBtn>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {post.author._id === user?._id && (
          <MuiMenuItem onClick={() => { setAnchorEl(null); navigate(`/create?edit=${post._id}`); }}>
            <i className="fas fa-edit" style={{ marginRight: 8, fontSize: '0.875rem', color: '#4F46E5' }} /> Edit post
          </MuiMenuItem>
        )}
        {post.author._id === user?._id && (
          <MuiMenuItem onClick={() => setAnchorEl(null)}>Delete post</MuiMenuItem>
        )}
        <MuiMenuItem onClick={() => setAnchorEl(null)}>Report</MuiMenuItem>
        <MuiMenuItem onClick={() => setAnchorEl(null)}>Copy link</MuiMenuItem>
      </Menu>
    </Box>
  );
};

// ── Feed Skeleton ────────────────────────────────────────────────────────────
const FeedSkeleton: React.FC = () => (
  <>
    {[1, 2, 3].map((i) => (
      <Box key={i} sx={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: '1rem', overflow: 'hidden' }}>
        {i === 2 && <Skeleton variant="rectangular" height={200} sx={{ display: 'block' }} />}
        <Box sx={{ p: '1.125rem 1.25rem' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', mb: '0.875rem' }}>
            <Skeleton variant="circular" width={34} height={34} />
            <Box sx={{ flex: 1 }}>
              <Skeleton width="30%" height={16} />
              <Skeleton width="20%" height={12} sx={{ mt: 0.5 }} />
            </Box>
            <Skeleton width={90} height={24} sx={{ borderRadius: '2rem' }} />
          </Box>
          <Skeleton width="75%" height={22} sx={{ mb: 1 }} />
          <Skeleton width="100%" height={14} />
          <Skeleton width="90%" height={14} sx={{ mt: 0.5 }} />
          <Skeleton width="60%" height={14} sx={{ mt: 0.5, mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton width={50} height={20} sx={{ borderRadius: '2rem' }} />
            <Skeleton width={60} height={20} sx={{ borderRadius: '2rem' }} />
          </Box>
        </Box>
        <Box sx={{ px: '1.25rem', py: '0.75rem', borderTop: '1px solid #F3F4F6', display: 'flex', gap: 1 }}>
          <Skeleton width={80} height={32} sx={{ borderRadius: '2rem' }} />
          <Skeleton width={60} height={32} sx={{ borderRadius: '2rem' }} />
          <Skeleton width={120} height={32} sx={{ borderRadius: '2rem', ml: 'auto' }} />
        </Box>
      </Box>
    ))}
  </>
);

// ── Right Panel ──────────────────────────────────────────────────────────────
const RightSidebarSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <Box sx={{ borderRadius: '0.75rem', p: '1rem', mb: '1.5rem', background: '#F9FAFB', border: '1px solid #E5E7EB' }}>
    <Typography
      sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#6B7280', mb: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

// Shared empty state for right panel sections
const PanelEmpty: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <Box sx={{ textAlign: 'center', py: '1.25rem' }}>
    <Typography sx={{ fontSize: '1.5rem', mb: '0.5rem' }}>{icon}</Typography>
    <Typography sx={{ fontSize: '0.8125rem', color: '#9CA3AF', lineHeight: 1.5 }}>{text}</Typography>
  </Box>
);

const RightPanel: React.FC = () => {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery<{
    postsToday: number; exchangesToday: number;
    questionsToday: number; eventsToday: number;
  }>({
    queryKey: ['feed-stats'],
    queryFn: () => api.get('/posts/stats').then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: trending = [] } = useQuery<Post[]>({
    queryKey: ['feed-trending'],
    queryFn: () => api.get('/posts/trending').then((r) => r.data),
    staleTime: 30_000,
  });

  const { data: activity = [] } = useQuery<{
    id: string; kind: string; postType?: string; title?: string; preview?: string;
    author: { name: string; avatar?: string }; timestamp: string; url?: string; postId?: string;
  }[]>({
    queryKey: ['feed-activity'],
    queryFn: () => api.get('/posts/activity').then((r) => r.data),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const { data: onlineNow = [] } = useQuery<{ _id: string; name: string; avatar?: string; isVerified?: boolean }[]>({
    queryKey: ['feed-online'],
    queryFn: () => api.get('/users/online').then((r) => r.data),
    refetchInterval: 30_000,
  });

  const STAT_ITEMS = [
    { key: 'postsToday',     label: 'Posts Today',        icon: 'fa-file-alt',          value: stats?.postsToday },
    { key: 'exchangesToday', label: 'Exchanges Today',    icon: 'fa-exchange-alt',      value: stats?.exchangesToday },
    { key: 'questionsToday', label: 'Questions Today',    icon: 'fa-question-circle',   value: stats?.questionsToday },
    { key: 'eventsToday',    label: 'Events Today',       icon: 'fa-calendar-alt',      value: stats?.eventsToday },
  ];

  const TYPE_ICONS: Record<string, string> = {
    skill: 'fa-chalkboard-teacher', tool: 'fa-tools',
    event: 'fa-calendar-alt', question: 'fa-question-circle', general: 'fa-bullhorn',
  };
  const TYPE_COLORS: Record<string, string> = {
    skill: '#7C3AED', tool: '#D97706', event: '#059669', question: '#2563EB', general: '#6B7280',
  };

  return (
    <>
      {/* Recent Activity */}
      <RightSidebarSection title="Recent Activity">
        {activity.length === 0 ? (
          <PanelEmpty icon="📭" text="No activity yet — be the first to post!" />
        ) : (
          <Box sx={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.625rem',
            '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
            {activity.map((item) => (
              <Box
                key={item.id}
                onClick={() => item.url ? navigate(item.url) : item.postId ? navigate(`/posts/${item.postId}`) : undefined}
                sx={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', cursor: 'pointer',
                  p: '0.5rem', borderRadius: '0.5rem', transition: 'background 0.15s',
                  '&:hover': { background: '#F3F4F6' } }}
              >
                <Avatar src={item.author?.avatar} sx={{ width: 28, height: 28, fontSize: '0.7rem', flexShrink: 0 }}>
                  {item.author?.name?.[0]?.toUpperCase()}
                </Avatar>
                <Box sx={{ minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.375rem', mb: '0.125rem' }}>
                    {item.kind === 'post' && item.postType && (
                      <i className={`fas ${TYPE_ICONS[item.postType] ?? 'fa-file'}`}
                        style={{ fontSize: '0.6rem', color: TYPE_COLORS[item.postType] ?? '#6B7280' }} />
                    )}
                    {item.kind === 'comment' && (
                      <i className="fas fa-comment" style={{ fontSize: '0.6rem', color: '#4F46E5' }} />
                    )}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 600, color: '#1F2937' }} noWrap>
                      {item.author?.name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '0.72rem', color: '#6B7280', lineHeight: 1.3 }} noWrap>
                    {item.kind === 'post' ? item.title : item.preview}
                  </Typography>
                  <Typography sx={{ fontSize: '0.65rem', color: '#9CA3AF', mt: '0.125rem' }}>
                    {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </RightSidebarSection>

      {/* Online Now */}
      <RightSidebarSection title={`Online Now${onlineNow.length > 0 ? ` (${onlineNow.length})` : ''}`}>
        {onlineNow.length === 0 ? (
          <PanelEmpty icon="👤" text="No members online right now." />
        ) : (
          <Box sx={{ maxHeight: 116, overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {onlineNow.map((u) => (
                <Box key={u._id} title={u.name} sx={{ position: 'relative', cursor: 'pointer' }}
                  onClick={() => navigate(`/profile/${u._id}`)}>
                  <Avatar src={u.avatar} sx={{ width: 32, height: 32, fontSize: '0.75rem' }}>
                    {u.name?.[0]?.toUpperCase()}
                  </Avatar>
                  <Box sx={{
                    position: 'absolute', bottom: 0, right: 0, width: 9, height: 9,
                    borderRadius: '50%', background: '#22C55E', border: '1.5px solid #fff',
                  }} />
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </RightSidebarSection>

      {/* Community Stats */}
      <RightSidebarSection title="Community Stats">
        {statsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}>
            <CircularProgress size={20} sx={{ color: '#4F46E5' }} />
          </Box>
        ) : (
          <Box sx={{ maxHeight: 210, overflowY: 'auto',
            '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.625rem' }}>
            {STAT_ITEMS.map(({ key, label, icon, value }) => (
              <Box key={key} sx={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                p: '0.875rem 0.5rem',
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                borderRadius: '0.5rem', textAlign: 'center', color: 'white',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}>
                <i className={`fas ${icon}`} style={{ fontSize: '0.8rem', opacity: 0.85, marginBottom: 4 }} />
                <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1 }}>
                  {value?.toLocaleString() ?? '—'}
                </Typography>
                <Typography sx={{ fontSize: '0.65rem', opacity: 0.9, mt: '0.25rem', lineHeight: 1.2 }}>{label}</Typography>
              </Box>
            ))}
          </Box>
          </Box>
        )}
      </RightSidebarSection>

      {/* Trending Now */}
      <RightSidebarSection title="Trending Now">
        {trending.length === 0 ? (
          <PanelEmpty icon="📈" text="Nothing trending yet — start a conversation!" />
        ) : (
          <Box sx={{ maxHeight: 312, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem',
            '&::-webkit-scrollbar': { width: 4 }, '&::-webkit-scrollbar-thumb': { background: '#E5E7EB', borderRadius: 4 } }}>
            {trending.map((post, idx) => (
              <Box key={post._id} onClick={() => navigate(postDetailUrl(post))}
                sx={{ display: 'flex', gap: '0.625rem', alignItems: 'flex-start', cursor: 'pointer',
                  p: '0.5rem', borderRadius: '0.5rem', transition: 'background 0.15s',
                  '&:hover': { background: '#F3F4F6' } }}>
                <Box sx={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: idx === 0 ? 'linear-gradient(135deg,#4F46E5,#10B981)' : '#F3F4F6',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.65rem', fontWeight: 700,
                  color: idx === 0 ? '#fff' : '#6B7280',
                }}>
                  {idx + 1}
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontSize: '0.78rem', fontWeight: 600, color: '#1F2937', lineHeight: 1.3 }} noWrap>
                    {post.title}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: '0.5rem', mt: '0.25rem' }}>
                    <Typography sx={{ fontSize: '0.65rem', color: '#EF4444' }}>
                      <i className="fas fa-arrow-up" style={{ marginRight: 3 }} />
                      {(post as any).upvoteCount ?? post.upvotes?.length ?? 0}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#6B7280' }}>
                      <i className="fas fa-eye" style={{ marginRight: 3 }} />
                      {(post as any).viewCount ?? 0}
                    </Typography>
                    <Typography sx={{ fontSize: '0.65rem', color: '#6B7280' }}>
                      <i className="fas fa-comment" style={{ marginRight: 3 }} />
                      {post.commentCount}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </RightSidebarSection>
    </>
  );
};

// ── Exchange Feed Card ────────────────────────────────────────────────────────
const EXCHANGE_TYPE_ICONS: Record<string, string> = {
  skill:   'fas fa-chalkboard-teacher',
  tool:    'fas fa-tools',
  service: 'fas fa-handshake',
};
const EXCHANGE_TYPE_LABELS: Record<string, string> = {
  skill:   'Skill Exchange',
  tool:    'Tool Exchange',
  service: 'Hybrid Exchange',
};

// ── Mini image slider for exchange offering/seeking panels ──────────────────
const MiniSlider: React.FC<{ images: string[] }> = ({ images }) => {
  const [errored, setErrored] = useState<Record<number, boolean>>({});
  const [idx, setIdx] = useState(0);

  // Rebuild valid list excluding broken images (by original index)
  const valid = images
    .map((url, origIdx) => ({ url, origIdx }))
    .filter(({ url, origIdx }) => Boolean(url) && !errored[origIdx]);

  const count = valid.length;
  const safeIdx = count > 0 ? Math.min(idx, count - 1) : 0;

  if (!count) return null;

  const go = (e: React.MouseEvent, dir: 1 | -1) => {
    e.stopPropagation();
    e.preventDefault();
    setIdx(i => (i + dir + count) % count);
  };

  const currentSrc = valid[safeIdx].url;
  const currentOrigIdx = valid[safeIdx].origIdx;
  const currentType = getMediaType(currentSrc);

  return (
    <Box
      onClick={e => e.stopPropagation()}
      sx={{ position: 'relative', borderRadius: '0.5rem', overflow: 'hidden', mb: '0.5rem',
        background: '#000', userSelect: 'none', height: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      {/* key forces a fresh DOM node on every slide so stale display:none never carries over */}
      {currentType === 'video' ? (
        <Box
          key={currentSrc}
          component="video"
          src={currentSrc}
          controls
          preload="metadata"
          sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
        />
      ) : (
        <Box
          key={currentSrc}
          component="img"
          src={currentSrc}
          alt=""
          sx={{ width: '100%', height: '100%', display: 'block', objectFit: 'contain' }}
          onError={() => setErrored(prev => ({ ...prev, [currentOrigIdx]: true }))}
        />
      )}
      {count > 1 && (
        <>
          <Box
            component="button" type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => go(e, -1)}
            sx={{ position: 'absolute', left: 6, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.65rem', border: 'none', p: 0, '&:hover': { background: 'rgba(0,0,0,0.75)' } }}
          >
            <i className="fas fa-chevron-left" />
          </Box>
          <Box
            component="button" type="button"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => go(e, 1)}
            sx={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', zIndex: 3, width: 26, height: 26, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.65rem', border: 'none', p: 0, '&:hover': { background: 'rgba(0,0,0,0.75)' } }}
          >
            <i className="fas fa-chevron-right" />
          </Box>
          <Box sx={{ position: 'absolute', bottom: 6, left: 0, right: 0, zIndex: 2, display: 'flex', justifyContent: 'center', gap: '3px', pointerEvents: 'none' }}>
            {valid.map((_, i) => (
              <Box key={i} sx={{ width: i === safeIdx ? 14 : 5, height: 5, borderRadius: 3, background: i === safeIdx ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'width 0.2s' }} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
};

const ExchangeFeedCard: React.FC<{ exchange: Exchange }> = ({ exchange }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const requester = exchange.requester as unknown as { _id?: string; name?: string; avatar?: string; isVerified?: boolean } | undefined;
  // Offering — from the Request Skill Swap form (requester's data)
  const titleParts    = exchange.title.split(' ↔ ');
  const offeringTitle = titleParts[0]?.trim() ?? '';
  const dashIdx       = exchange.offering.indexOf(' — ');
  const embeddedDesc  = dashIdx > -1 ? exchange.offering.slice(dashIdx + 3).trim() : '';
  // Prefer the dedicated field (no length limit); fall back to the embedded offering string
  const offeringDesc  = (exchange as any).offeringDescription || embeddedDesc;

  // Seeking — prefer seekingDescription, then first wantedSkill description
  const seekingTitle = titleParts[1]?.trim() ?? exchange.seeking;
  const firstWantedDesc = Array.isArray((exchange as any).wantedSkills) && (exchange as any).wantedSkills.length > 0
    ? ((exchange as any).wantedSkills[0]?.description as string | undefined) ?? ''
    : '';
  const seekingDesc  = exchange.seekingDescription || firstWantedDesc || '';
  const seekingImgs  = (exchange.seekingImages?.length ? exchange.seekingImages : []) as string[];
  const statusColors: Record<string, { bg: string; color: string }> = {
    open:      { bg: '#D1FAE5', color: '#065F46' },
    pending:   { bg: '#FEF3C7', color: '#92400E' },
    completed: { bg: '#DBEAFE', color: '#1E40AF' },
    cancelled: { bg: '#FEE2E2', color: '#991B1B' },
  };
  const sc = statusColors[exchange.status] ?? statusColors.open;

  return (
    <Box
      onClick={() => navigate(`/exchanges/${exchange._id}`)}
      sx={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '1rem',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        '&:hover': { borderColor: '#A5B4FC', boxShadow: '0 6px 20px rgba(0,0,0,0.09)' },
      }}
    >

      {/* Top section — shaded background (matches PostCard) */}
      <Box sx={{ p: '1rem 1.25rem', background: '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <OnlineAvatar userId={requester?._id ?? ''} src={requester?.avatar} isVerified={requester?.isVerified}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${requester?._id}`); }}
            sx={{ width: 36, height: 36, fontSize: '0.85rem', fontWeight: 700,
              flexShrink: 0, background: 'linear-gradient(135deg,#4F46E5,#10B981)',
              cursor: 'pointer', border: '2px solid #E5E7EB' }}>
            {requester?.name?.[0]?.toUpperCase() ?? '?'}
          </OnlineAvatar>
          <Box sx={{ minWidth: 0 }}>
            <Box
              onClick={(e: React.MouseEvent) => { e.stopPropagation(); navigate(`/profile/${requester?._id}`); }}
              sx={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827', lineHeight: 1.2, cursor: 'pointer', '&:hover': { color: '#4F46E5', textDecoration: 'underline' } }}>
              {requester?.name ?? 'Community Member'}
            </Box>
            <Box sx={{ fontSize: '0.75rem', color: '#9CA3AF' }}>
              {formatDistanceToNow(new Date(exchange.createdAt), { addSuffix: true })}
            </Box>
          </Box>
          <Box component="span" sx={{
            ml: 'auto', display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
            px: '0.7rem', py: '0.3rem', borderRadius: '2rem',
            background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: '#fff',
            fontSize: '0.72rem', fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}>
            <i className={EXCHANGE_TYPE_ICONS[exchange.type] ?? 'fas fa-exchange-alt'} style={{ fontSize: '0.65rem' }} />
            {EXCHANGE_TYPE_LABELS[exchange.type] ?? 'Exchange'}
          </Box>
          <HtmlBtn
            onClick={(e) => { e.stopPropagation(); setAnchorEl(e.currentTarget as HTMLButtonElement); }}
            sx={{ p: '0.3rem 0.4rem', borderRadius: '0.5rem', color: '#9CA3AF', flexShrink: 0,
              '&:hover': { background: '#F3F4F6', color: '#374151' } }}>
            <i className="fas fa-ellipsis-h" style={{ fontSize: '0.875rem' }} />
          </HtmlBtn>
        </Box>
      </Box>

      {/* Body */}
      <Box sx={{ p: '1rem 1.25rem 0' }}>

        {/* Title */}
        <Box sx={{ fontSize: '1.05rem', fontWeight: 700, color: '#111827', mb: '0.75rem', lineHeight: 1.4, textTransform: 'capitalize' }}>
          {exchange.title}
        </Box>

        {/* Offering ⇄ Seeking — title + media + description */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 28px 1fr' }, alignItems: 'stretch', gap: '0.5rem', mb: '1rem' }}>
          {/* Offering */}
          <Box sx={{ p: '0.625rem 0.75rem', borderRadius: '0.625rem',
            background: 'rgba(79,70,229,0.05)', border: '1px solid rgba(79,70,229,0.14)',
            display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#6366F1', textTransform: 'uppercase',
              letterSpacing: '0.06em', mb: '0.3rem' }}>Offering</Box>
            {/* title — skill swap only (CEU exchanges show it in the breakdown) */}
            {!/^\d+\s*CEU$/i.test(exchange.offering ?? '') && offeringTitle && (
              <Box sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', mb: '0.35rem',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {offeringTitle}
              </Box>
            )}
            {/* images — skill swap only */}
            {!/^\d+\s*CEU$/i.test(exchange.offering ?? '') && (exchange.images?.length > 0) && (
              <Box sx={{ flex: '0 0 auto' }}><MiniSlider images={exchange.images} /></Box>
            )}
            {/* description — skill swap only */}
            {!/^\d+\s*CEU$/i.test(exchange.offering ?? '') && offeringDesc && (
              <Box sx={{ pt: '0.35rem', fontSize: '0.75rem', color: '#4B5563', lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {offeringDesc}
              </Box>
            )}
            {/* CEU Breakdown — CEU exchanges only */}
            {/^\d+\s*CEU$/i.test(exchange.offering ?? '') && (() => {
              const hrs      = exchange.timeStart && exchange.timeEnd ? parseHours(exchange.timeStart, exchange.timeEnd) : 1;
              const sess     = Math.max(1, exchange.sessions ?? 1);
              const profTag  = exchange.tags?.find((t: string) => t in PROF_MULT) ?? 'intermediate';
              const profMult = PROF_MULT[profTag] ?? 1.0;
              const profLabel= profTag.charAt(0).toUpperCase() + profTag.slice(1);
              const perSess  = Math.max(1, Math.round(hrs * profMult));
              const calcCeu  = perSess * sess;
              const offered  = exchange.ceuValue ?? 0;
              const awarded  = offered > 0 ? offered : calcCeu;
              const ratio    = calcCeu > 0 ? awarded / calcCeu : 1;
              const isFair   = ratio >= 1.0;
              const isLow    = ratio >= 0.8 && ratio < 1.0;
              const isUnfair = ratio < 0.8;
              const fColor   = isUnfair ? '#DC2626' : isLow ? '#D97706' : '#059669';
              const fBg      = isUnfair ? 'rgba(220,38,38,0.07)' : isLow ? 'rgba(217,119,6,0.07)' : 'rgba(5,150,105,0.07)';
              const fBorder  = isUnfair ? 'rgba(220,38,38,0.2)'  : isLow ? 'rgba(217,119,6,0.2)'  : 'rgba(5,150,105,0.2)';
              const fIcon    = isUnfair ? 'fa-times-circle' : isLow ? 'fa-exclamation-triangle' : 'fa-check-circle';
              const fLabel   = isUnfair ? 'Unfair' : isLow ? 'Slightly Low' : 'Fair';

              const rows = [
                exchange.timeStart && exchange.timeEnd
                  ? { icon: 'fa-clock',       label: 'Session length', value: `${hrs.toFixed(1).replace(/\.0$/, '')}h`, note: `${fmt12(exchange.timeStart)} – ${fmt12(exchange.timeEnd)}` }
                  : { icon: 'fa-clock',       label: 'Session length', value: '1h',                                     note: 'Default (no schedule set)' },
                { icon: 'fa-user-graduate', label: 'Proficiency',      value: `×${profMult.toFixed(1)}`,                note: profLabel },
                { icon: 'fa-layer-group',   label: 'Sessions',         value: `×${sess}`,                               note: `${sess} session${sess !== 1 ? 's' : ''}` },
                { icon: 'fa-coins',         label: 'CEU per session',  value: `${perSess} CEU`,                         note: `${hrs.toFixed(1).replace(/\.0$/, '')}h × ×${profMult.toFixed(1)} = ${perSess}` },
              ];

              return (
                <Box sx={{ mt: '0.625rem', border: '1px solid rgba(79,70,229,0.18)', borderRadius: '0.5rem', overflow: 'hidden' }}>
                  {/* header */}
                  <Box sx={{ px: '0.625rem', py: '0.35rem', background: 'rgba(79,70,229,0.06)', borderBottom: '1px solid rgba(79,70,229,0.12)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <i className="fas fa-calculator" style={{ color: '#4F46E5', fontSize: '0.6rem' }} />
                    <Box sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Inter,sans-serif', flex: 1 }}>
                      CEU Breakdown
                    </Box>
                    <Box sx={{ fontSize: '0.55rem', color: '#6B7280', fontFamily: 'Inter,sans-serif' }}>
                      how this offer was calculated
                    </Box>
                  </Box>

                  {/* formula rows */}
                  <Box sx={{ px: '0.625rem', pt: '0.4rem', pb: '0.35rem', background: '#FAFAFA' }}>
                    {rows.map((row, i) => (
                      <Box key={row.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: '0.2rem', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <i className={`fas ${row.icon}`} style={{ color: '#9CA3AF', fontSize: '0.5rem', width: 10 }} />
                          <Box>
                            <Box sx={{ fontSize: '0.62rem', color: '#374151', fontFamily: 'Inter,sans-serif', fontWeight: 500 }}>{row.label}</Box>
                            <Box sx={{ fontSize: '0.52rem', color: '#9CA3AF', fontFamily: 'Inter,sans-serif' }}>{row.note}</Box>
                          </Box>
                        </Box>
                        <Box sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#4F46E5', fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap' }}>{row.value}</Box>
                      </Box>
                    ))}

                    {/* calculated total */}
                    <Box sx={{ mt: '0.25rem', pt: '0.25rem', borderTop: '1.5px solid rgba(79,70,229,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Calculated fair value</Box>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', px: '0.45rem', py: '0.15rem', borderRadius: '2rem', background: CEU_GRAD, color: '#FFF', fontSize: '0.62rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>
                        <i className="fas fa-coins" style={{ fontSize: '0.5rem' }} /> {calcCeu} CEU
                      </Box>
                    </Box>
                  </Box>

                  {/* awarded highlight */}
                  <Box sx={{ px: '0.625rem', py: '0.4rem', borderTop: '1.5px solid rgba(79,70,229,0.18)', background: 'linear-gradient(135deg, rgba(79,70,229,0.05), rgba(16,185,129,0.05))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className="fas fa-award" style={{ color: '#4F46E5', fontSize: '0.65rem' }} />
                      <Box sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#1F2937', fontFamily: 'Inter,sans-serif' }}>Awarded</Box>
                    </Box>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: '0.2rem', px: '0.55rem', py: '0.2rem', borderRadius: '2rem', background: CEU_GRAD, color: '#FFF', fontSize: '0.7rem', fontWeight: 800, fontFamily: 'Poppins,sans-serif', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' }}>
                      <i className="fas fa-coins" style={{ fontSize: '0.55rem' }} /> {awarded} CEU
                    </Box>
                  </Box>

                  {/* fairness warning — when below fair value */}
                  {!isFair && (
                    <Box sx={{ px: '0.625rem', py: '0.35rem', borderTop: `1px solid ${fBorder}`, background: fBg, display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <i className={`fas ${fIcon}`} style={{ color: fColor, fontSize: '0.6rem' }} />
                      <Box>
                        <Box sx={{ fontSize: '0.62rem', fontWeight: 700, color: fColor, fontFamily: 'Inter,sans-serif' }}>{fLabel}</Box>
                        <Box sx={{ fontSize: '0.52rem', color: fColor, opacity: 0.85, fontFamily: 'Inter,sans-serif' }}>
                          Offered {awarded} CEU — fair value is {calcCeu} CEU
                        </Box>
                      </Box>
                    </Box>
                  )}
                </Box>
              );
            })()}
          </Box>

          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', alignSelf: 'center', color: '#D1D5DB', fontSize: '1.1rem', fontWeight: 300 }}>⇄</Box>

          {/* Seeking */}
          <Box sx={{ p: '0.625rem 0.75rem', borderRadius: '0.625rem',
            background: 'rgba(16,185,129,0.05)', border: '1px solid rgba(16,185,129,0.14)',
            display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ fontSize: '0.6rem', fontWeight: 700, color: '#10B981', textTransform: 'uppercase',
              letterSpacing: '0.06em', mb: '0.3rem' }}>Seeking</Box>
            {seekingTitle && (
              <Box sx={{ fontSize: '0.8rem', fontWeight: 700, color: '#111827', mb: '0.35rem',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {seekingTitle}
              </Box>
            )}
            {seekingImgs.length > 0 && (
              <Box sx={{ flex: '0 0 auto' }}><MiniSlider images={seekingImgs} /></Box>
            )}
            <Box sx={{ flex: 1 }} />
            {seekingDesc && (
              <Box sx={{ pt: '0.35rem', fontSize: '0.75rem', color: '#4B5563', lineHeight: 1.45,
                display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {seekingDesc}
              </Box>
            )}
          </Box>
        </Box>
      </Box>


      {/* Footer */}
      <Box sx={{ px: '1rem', py: '0.625rem', borderTop: '1px solid #F3F4F6',
        display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {/* Vote */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: '0',
          background: '#F9FAFB', border: '1px solid #E5E7EB',
          borderRadius: '2rem', overflow: 'hidden', mr: '0.25rem',
        }}>
          <HtmlBtn onClick={(e) => e.stopPropagation()}
            sx={{ px: '0.75rem', py: '0.45rem', color: '#6B7280', fontSize: '0.8rem',
              '&:hover': { background: '#FEE2E2', color: '#EF4444' } }}>
            <i className="fas fa-arrow-up" />
          </HtmlBtn>
          <Box sx={{ px: '0.5rem', fontSize: '0.8125rem', fontWeight: 700, color: '#374151',
            borderLeft: '1px solid #E5E7EB', borderRight: '1px solid #E5E7EB', py: '0.45rem' }}>
            0
          </Box>
          <HtmlBtn onClick={(e) => e.stopPropagation()}
            sx={{ px: '0.75rem', py: '0.45rem', color: '#6B7280', fontSize: '0.8rem',
              '&:hover': { background: '#EEF2FF', color: '#6366F1' } }}>
            <i className="fas fa-arrow-down" />
          </HtmlBtn>
        </Box>

        {/* Comments */}
        <HtmlBtn onClick={(e) => { e.stopPropagation(); navigate(`/exchanges/${exchange._id}`); }}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', color: '#6B7280', fontSize: '0.8rem', fontWeight: 500,
            '&:hover': { background: '#F3F4F6', color: '#374151' } }}>
          <i className="fas fa-comment-alt" />
          <span>{exchange.messages?.length ?? 0}</span>
        </HtmlBtn>

        {/* Share */}
        <HtmlBtn onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(`${window.location.origin}/exchanges/${exchange._id}`); }}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', color: '#6B7280', fontSize: '0.8rem',
            '&:hover': { background: '#F3F4F6', color: '#374151' } }}>
          <i className="fas fa-share" />
        </HtmlBtn>

        {/* Save */}
        <HtmlBtn onClick={(e) => e.stopPropagation()}
          sx={{ display: 'flex', alignItems: 'center', gap: '0.35rem', px: '0.75rem', py: '0.45rem',
            borderRadius: '2rem', fontSize: '0.8rem', color: '#6B7280',
            '&:hover': { background: '#F3F4F6', color: '#374151' } }}>
          <i className="far fa-bookmark" />
        </HtmlBtn>

        {/* CTA */}
        <HtmlBtn onClick={(e) => { e.stopPropagation(); navigate(`/exchanges/${exchange._id}`); }}
          sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem',
            px: '0.875rem', py: '0.45rem', borderRadius: '2rem',
            background: '#EEF2FF', color: '#4F46E5', border: '1px solid #C7D2FE',
            fontSize: '0.78rem', fontWeight: 600,
            '&:hover': { filter: 'brightness(0.95)' } }}>
          <i className="fas fa-exchange-alt" style={{ fontSize: '0.75rem' }} />
          Request Exchange
        </HtmlBtn>
      </Box>

      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {requester?._id === user?._id && (
          <MuiMenuItem onClick={() => { setAnchorEl(null); navigate(`/exchanges/${exchange._id}`); }}>
            <i className="fas fa-edit" style={{ marginRight: 8, fontSize: '0.875rem', color: '#4F46E5' }} /> Edit exchange
          </MuiMenuItem>
        )}
        <MuiMenuItem onClick={() => setAnchorEl(null)}>Report</MuiMenuItem>
        <MuiMenuItem onClick={() => { setAnchorEl(null); navigator.clipboard?.writeText(`${window.location.origin}/exchanges/${exchange._id}`); }}>Copy link</MuiMenuItem>
      </Menu>
    </Box>
  );
};

// ── Feed Page ────────────────────────────────────────────────────────────────
const POST_TYPES = [
  { value: '', label: 'All Posts' },
  { value: 'skill', label: 'Skills' },
  { value: 'tool', label: 'Tools' },
  { value: 'event', label: 'Events' },
  { value: 'question', label: 'Questions' },
  { value: 'exchanges', label: 'Exchanges' },
  { value: 'gift', label: 'Gifts' },
];

const Feed: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuth();

  // Derive state from URL params
  const urlType = searchParams.get('type') || '';
  const urlSort = searchParams.get('sort') || 'new';
  const urlFilter = searchParams.get('filter') || '';
  const urlSearch = searchParams.get('q') || '';

  const [activeType, setActiveType] = useState(urlType);
  const [sortBy, setSortBy] = useState(urlSort);
  const [nearbyCoords, setNearbyCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [quickQ, setQuickQ] = useState('');

  const quickPost = useMutation({
    mutationFn: (title: string) =>
      api.post('/posts', { type: 'question', title, content: title, tags: ['question'], bounty: 1 }),
    onSuccess: () => {
      setQuickQ('');
      queryClient.invalidateQueries({ queryKey: ['feed'] });
    },
  });

  const handleQuickSubmit = () => {
    const trimmed = quickQ.trim();
    if (!trimmed || quickPost.isLoading) return;
    quickPost.mutate(trimmed);
  };

  // Sync state when URL params change (e.g. sidebar nav clicks)
  useEffect(() => {
    setActiveType(urlType);
    setSortBy(urlSort);
  }, [urlType, urlSort]);

  // Request geolocation when nearby filter is active
  useEffect(() => {
    if (urlFilter === 'nearby') {
      setNearbyLoading(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            setNearbyCoords({ lng: pos.coords.longitude, lat: pos.coords.latitude });
            setNearbyLoading(false);
          },
          () => {
            setNearbyCoords(null);
            setNearbyLoading(false);
          },
        );
      } else {
        setNearbyLoading(false);
      }
    } else {
      setNearbyCoords(null);
    }
  }, [urlFilter]);

  // Helper: update URL params without full navigation
  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([k, v]) => {
      if (v) next.set(k, v); else next.delete(k);
    });
    setSearchParams(next, { replace: true });
  };

  const isExchangeTab = activeType === 'exchanges';
  const isAllTab = activeType === '' && urlFilter !== 'nearby';
  const isGiftTab = activeType === 'gift';

  // Posts query — runs when NOT on the exchanges-only tab
  const { data: postsData, isLoading: postsLoading } = useQuery({
    queryKey: ['feed', activeType, sortBy, urlFilter, nearbyCoords, urlSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isGiftTab) {
        params.set('type', 'tool');
        params.set('toolIsGift', 'true');
      } else if (activeType) {
        params.set('type', activeType);
      }
      params.set('limit', '30');
      params.set('sort', sortBy);
      if (urlFilter === 'nearby' && nearbyCoords) {
        params.set('lng', String(nearbyCoords.lng));
        params.set('lat', String(nearbyCoords.lat));
        params.set('radius', '10');
      }
      if (urlSearch) params.set('q', urlSearch);
      const res = await api.get(`/posts?${params}`);
      return res.data as { posts: Post[]; total: number };
    },
    enabled: !isExchangeTab && (urlFilter !== 'nearby' || !!nearbyCoords),
  });

  // Exchanges query — runs on exchanges tab (open only) AND all posts tab (all statuses)
  const { data: exchangesData, isLoading: exchangesLoading } = useQuery({
    queryKey: ['feedExchanges', isExchangeTab ? 'open' : 'all', sortBy, urlSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set('limit', '30');
      if (isExchangeTab) params.set('status', 'open');
      if (urlSearch) params.set('q', urlSearch);
      const res = await api.get(`/exchanges?${params}`);
      return res.data as { exchanges: Exchange[]; total: number };
    },
    enabled: !!(isExchangeTab || isAllTab),
  });

  const data = isExchangeTab ? undefined : postsData;
  const isLoading = nearbyLoading || (isExchangeTab ? exchangesLoading : (postsLoading || (isAllTab && exchangesLoading)));

  // Merge posts + exchanges for All Posts tab, sorted newest first
  const allPostsMerged = isAllTab
    ? [
        ...(postsData?.posts ?? []).map((p) => ({ type: 'post' as const, item: p, date: new Date(p.createdAt) })),
        ...(exchangesData?.exchanges ?? []).map((e) => ({ type: 'exchange' as const, item: e, date: new Date(e.createdAt) })),
      ].sort((a, b) => b.date.getTime() - a.date.getTime())
    : [];

  const voteMutation = useMutation({
    mutationFn: ({ postId, vote }: { postId: string; vote: 'up' | 'down' | null }) =>
      api.put(`/posts/${postId}/vote`, { vote }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['feed-trending'] });
    },
  });

  const handleVote = (postId: string, vote: 'up' | 'down' | null) => {
    voteMutation.mutate({ postId, vote });
  };

  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <Layout rightPanel={<RightPanel />}>
      {/* Create Post Widget (authenticated) / Guest join banner */}
      {isAuthenticated ? (
        <Box
          sx={{
            background: '#FFFFFF',
            border: '1px solid #E5E7EB',
            borderRadius: '0.75rem',
            p: '1.5rem',
            mb: '1.5rem',
            boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
          }}
        >
          {/* Avatar + input row */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '1rem', mb: '1rem' }}>
            <OnlineAvatar
              userId={user?._id ?? ''}
              src={user?.avatar}
              dotSize={11}
              sx={{
                width: 46,
                height: 46,
                background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                fontSize: '1rem',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              {initials}
            </OnlineAvatar>
            <Box
              component="input"
              placeholder="Ask a quick question..."
              value={quickQ}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQuickQ(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleQuickSubmit(); }}
              sx={{
                flex: 1,
                p: '0.75rem 1rem',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                background: '#F9FAFB',
                fontSize: '0.875rem',
                fontFamily: 'Inter,sans-serif',
                outline: 'none',
                transition: 'all 0.2s',
                '&:hover': { borderColor: '#4F46E5' },
                '&:focus': { borderColor: '#4F46E5', boxShadow: '0 0 0 3px rgba(79,70,229,0.1)' },
              }}
            />
            {quickQ.trim() && (
              <Box
                component="button"
                onClick={handleQuickSubmit}
                disabled={quickPost.isLoading}
                sx={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none',
                  background: 'linear-gradient(135deg,#4F46E5,#10B981)', color: 'white',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                  flexShrink: 0, transition: 'all 0.2s', opacity: quickPost.isLoading ? 0.6 : 1,
                  '&:hover': { transform: 'scale(1.05)' },
                }}
              >
                <i className={quickPost.isLoading ? 'fas fa-spinner fa-spin' : 'fas fa-paper-plane'} style={{ fontSize: '0.875rem' }} />
              </Box>
            )}
          </Box>
          {quickQ.trim() && (
            <Typography sx={{ fontSize: '0.75rem', color: '#6B7280', mb: 0.5, fontFamily: 'Inter,sans-serif' }}>
              <i className="fas fa-question-circle" style={{ marginRight: 4, color: '#4F46E5' }} />
              Posts as a question with 1 CEU bounty. Press Enter or click send.
            </Typography>
          )}
          {quickPost.isError && (
            <Typography sx={{ fontSize: '0.75rem', color: '#EF4444', mb: -0.5, fontFamily: 'Inter,sans-serif' }}>
              Failed to post — check your connection and try again.
            </Typography>
          )}

          {/* Post type buttons */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' }, gap: '0.625rem' }}>
            {[
              { icon: 'fas fa-question-circle', label: 'Ask Question', type: 'question' },
              { icon: 'fas fa-chalkboard-teacher', label: 'Share Skill', type: 'skill' },
              { icon: 'fas fa-tools', label: 'List Tool', type: 'tool' },
              { icon: 'fas fa-calendar-alt', label: 'Create Event', type: 'event' },
            ].map((btn) => (
              <HtmlBtn
                key={btn.type}
                onClick={() => navigate(`/create?type=${btn.type}`)}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  p: '0.875rem 0.5rem',
                  border: '1px solid #E5E7EB',
                  borderRadius: '0.5rem',
                  color: '#1F2937',
                  fontSize: '0.8125rem',
                  fontWeight: 500,
                  minHeight: 80,
                  transition: 'all 0.2s',
                  '&:hover': { borderColor: '#4F46E5', background: '#F3F4F6', transform: 'translateY(-2px)' },
                  '& i': { color: '#4F46E5', fontSize: '1.25rem' },
                }}
              >
                <i className={btn.icon} />
                {btn.label}
              </HtmlBtn>
            ))}
          </Box>
        </Box>
      ) : (
        /* Guest join banner */
        <Box
          sx={{
            background: 'linear-gradient(135deg, #4F46E5, #10B981)',
            borderRadius: '0.75rem',
            p: '1.75rem 2rem',
            mb: '1.5rem',
            boxShadow: '0 4px 6px -1px rgba(79,70,229,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700, color: '#fff', mb: '0.375rem', fontFamily: 'Poppins, Inter, sans-serif' }}>
              🤝 Join the Neighbourhood Exchange
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              Share skills, borrow tools, ask questions and connect with your community.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: '0.75rem', flexShrink: 0 }}>
            <HtmlBtn
              onClick={() => navigate('/login')}
              sx={{
                px: '1.25rem',
                py: '0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#4F46E5',
                background: '#fff',
                '&:hover': { opacity: 0.9, transform: 'translateY(-1px)' },
                transition: 'all 0.2s',
              }}
            >
              Sign In
            </HtmlBtn>
            <HtmlBtn
              onClick={() => navigate('/register')}
              sx={{
                px: '1.25rem',
                py: '0.65rem',
                borderRadius: '0.5rem',
                fontSize: '0.9375rem',
                fontWeight: 600,
                color: '#fff',
                background: 'rgba(255,255,255,0.2)',
                border: '1px solid rgba(255,255,255,0.4)',
                '&:hover': { background: 'rgba(255,255,255,0.3)', transform: 'translateY(-1px)' },
                transition: 'all 0.2s',
              }}
            >
              Join Free
            </HtmlBtn>
          </Box>
        </Box>
      )}

      {/* Filter tabs */}
      <Box
        sx={{
          background: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '0.75rem',
          mb: '1.5rem',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: '1rem',
            borderBottom: '1px solid #E5E7EB',
          }}
        >
          <Box sx={{ display: 'flex', overflowX: 'auto' }}>
            {POST_TYPES.map((t) => (
              <HtmlBtn
                key={t.value}
                onClick={() => updateParams({ type: t.value, filter: '' })}
                sx={{
                  px: '1rem',
                  py: '0.875rem',
                  fontSize: '0.875rem',
                  fontWeight: activeType === t.value ? 600 : 400,
                  color: activeType === t.value ? '#4F46E5' : '#6B7280',
                  borderBottom: activeType === t.value ? '2px solid #4F46E5' : '2px solid transparent',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.2s',
                  '&:hover': { color: '#4F46E5' },
                }}
              >
                {t.label}
              </HtmlBtn>
            ))}
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {['new', 'hot', 'top'].map((s) => (
              <HtmlBtn
                key={s}
                onClick={() => updateParams({ sort: s })}
                sx={{
                  px: '0.625rem',
                  py: '0.375rem',
                  borderRadius: '0.375rem',
                  fontSize: '0.8125rem',
                  fontWeight: sortBy === s ? 600 : 400,
                  color: sortBy === s ? '#4F46E5' : '#6B7280',
                  background: sortBy === s ? '#EEF2FF' : 'transparent',
                  textTransform: 'capitalize',
                  '&:hover': { background: '#F3F4F6', color: '#4F46E5' },
                }}
              >
                <i
                  className={s === 'new' ? 'fas fa-clock' : s === 'hot' ? 'fas fa-fire' : 'fas fa-chart-line'}
                  style={{ marginRight: '0.375rem', fontSize: '0.75rem' }}
                />
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </HtmlBtn>
            ))}
          </Box>
        </Box>
      </Box>

      {/* Search result banner */}
      {urlSearch && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '0.625rem', px: '1rem', py: '0.625rem', background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.15)', borderRadius: '0.75rem', mb: 1 }}>
          <i className="fas fa-search" style={{ color: '#4F46E5', fontSize: '0.875rem' }} />
          <Typography sx={{ fontSize: '0.875rem', color: '#1F2937', fontFamily: 'Inter,sans-serif', flex: 1 }}>
            Results for <strong>"{urlSearch}"</strong>
          </Typography>
          <Box
            component="button"
            onClick={() => updateParams({ q: '' })}
            sx={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', '&:hover': { color: '#4F46E5' } }}
          >
            <i className="fas fa-times" /> Clear
          </Box>
        </Box>
      )}

      {/* Posts / Exchanges */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {isLoading ? (
          <FeedSkeleton />
        ) : isExchangeTab ? (
          /* ── Exchange tab ── */
          exchangesData?.exchanges?.length === 0 ? (
            <Box sx={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.75rem', p: '4rem 2rem', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.12)' }}>
              <Typography sx={{ fontSize: '2.5rem', mb: '0.75rem' }}>🤝</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '1.125rem', mb: '0.5rem', color: '#1F2937' }}>No open exchanges yet</Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '0.875rem', mb: '1.5rem' }}>
                {isAuthenticated ? 'Be the first to post a skill or tool exchange!' : 'Join to start exchanging skills with your community!'}
              </Typography>
              <HtmlBtn
                onClick={() => navigate(isAuthenticated ? '/exchanges/create' : '/register')}
                sx={{ px: '1.5rem', py: '0.75rem', background: 'linear-gradient(135deg, #4F46E5, #10B981)', color: 'white', borderRadius: '0.5rem', fontWeight: 600, fontSize: '0.9375rem', '&:hover': { opacity: 0.9 } }}
              >
                {isAuthenticated ? 'Post an Exchange' : 'Join the Community'}
              </HtmlBtn>
            </Box>
          ) : (
            exchangesData?.exchanges?.map((ex) => (
              <ExchangeFeedCard key={ex._id} exchange={ex} />
            ))
          )
        ) : (
          /* ── Posts tab (+ exchanges on All Posts) ── */
          (data?.posts?.length === 0 && (!isAllTab || !exchangesData?.exchanges?.length)) ? (
            <Box
              sx={{
                background: '#FFFFFF',
                border: '1px solid #E5E7EB',
                borderRadius: '0.75rem',
                p: '4rem 2rem',
                textAlign: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
              }}
            >
              <Typography sx={{ fontSize: '2.5rem', mb: '0.75rem' }}>🌱</Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '1.125rem', mb: '0.5rem', color: '#1F2937' }}>
                No posts yet
              </Typography>
              <Typography sx={{ color: '#6B7280', fontSize: '0.875rem', mb: '1.5rem' }}>
                {isAuthenticated ? 'Be the first to share something with your community!' : 'Join to be the first to share something with your community!'}
              </Typography>
              <HtmlBtn
                onClick={() => navigate(isAuthenticated ? '/create' : '/register')}
                sx={{
                  px: '1.5rem',
                  py: '0.75rem',
                  background: 'linear-gradient(135deg, #4F46E5, #10B981)',
                  color: 'white',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  '&:hover': { opacity: 0.9 },
                }}
              >
                {isAuthenticated ? 'Create a Post' : 'Join the Community'}
              </HtmlBtn>
            </Box>
          ) : (
            <>
              {isAllTab
                ? allPostsMerged.map(({ type, item }) =>
                    type === 'post'
                      ? <PostCard key={item._id} post={item as Post} onVote={handleVote} />
                      : <ExchangeFeedCard key={item._id} exchange={item as Exchange} />
                  )
                : data?.posts?.map((post) => (
                    <PostCard key={post._id} post={post} onVote={handleVote} />
                  ))
              }
            </>
          )
        )}
      </Box>
    </Layout>
  );
};

export default Feed;
