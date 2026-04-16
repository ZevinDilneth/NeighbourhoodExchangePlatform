import React from 'react';
import { Box, Typography } from '@mui/material';

const FONT    = 'Inter, sans-serif';
const HEADING = 'Poppins, sans-serif';
const GRAD    = 'linear-gradient(135deg, #4F46E5, #10B981)';

/* ── Inline formatter: **bold**, *italic*, _italic_ ──────────────────── */
const parseInline = (text: string): React.ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_)/g);
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i} style={{ fontWeight: 700, color: '#1F2937' }}>{p.slice(2, -2)}</strong>;
    }
    if (
      (p.startsWith('*') && p.endsWith('*') && !p.startsWith('**')) ||
      (p.startsWith('_') && p.endsWith('_'))
    ) {
      return <em key={i} style={{ fontStyle: 'italic', color: '#374151' }}>{p.slice(1, -1)}</em>;
    }
    return p;
  });
};

const RichContent: React.FC<{ text: string }> = ({ text }) => {
  if (!text?.trim()) return null;

  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const elements: React.ReactNode[] = [];
  let bulletBuffer:   string[] = [];
  let numberedBuffer: { num: string; body: string }[] = [];
  let key = 0;

  const flushBullets = () => {
    if (!bulletBuffer.length) return;
    elements.push(
      <Box key={key++} component="ul" sx={{ m: 0, pl: '1.375rem', mb: '0.75rem', listStyleType: 'none' }}>
        {bulletBuffer.map((item, bi) => (
          <Box key={bi} component="li" sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem', mb: '0.3rem' }}>
            <Box component="span" sx={{ mt: '0.45rem', width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: GRAD }} />
            <Typography sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.7, fontFamily: FONT }}>
              {parseInline(item)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
    bulletBuffer = [];
  };

  const flushNumbered = () => {
    if (!numberedBuffer.length) return;
    elements.push(
      <Box key={key++} sx={{ mb: '0.75rem', pl: '0.25rem' }}>
        {numberedBuffer.map(({ num, body }, ni) => (
          <Box key={ni} sx={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', mb: '0.3rem' }}>
            <Typography sx={{ fontWeight: 700, color: '#4F46E5', fontSize: '0.85rem', lineHeight: 1.7, fontFamily: FONT, flexShrink: 0, minWidth: '1.1rem' }}>
              {num}.
            </Typography>
            <Typography sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.7, fontFamily: FONT }}>
              {parseInline(body)}
            </Typography>
          </Box>
        ))}
      </Box>
    );
    numberedBuffer = [];
  };

  const flushAll = () => { flushBullets(); flushNumbered(); };

  for (const raw of lines) {
    const line = raw.trimEnd();

    // H1: # Title
    if (/^#{1}\s+/.test(line) && !/^#{2,}/.test(line)) {
      flushAll();
      elements.push(
        <Typography key={key++} sx={{ fontFamily: HEADING, fontWeight: 700, fontSize: '1.125rem', color: '#1F2937', mt: '1.25rem', mb: '0.5rem', lineHeight: 1.3, '&:first-of-type': { mt: 0 } }}>
          {parseInline(line.replace(/^#+\s+/, ''))}
        </Typography>
      );
      continue;
    }

    // H2: ## Subtitle
    if (/^#{2}\s+/.test(line)) {
      flushAll();
      elements.push(
        <Typography key={key++} sx={{ fontFamily: FONT, fontWeight: 700, fontSize: '0.9375rem', color: '#4F46E5', mt: '1rem', mb: '0.375rem', lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
          <Box component="span" sx={{ display: 'inline-block', width: 3, height: '1em', borderRadius: 1, background: GRAD, flexShrink: 0 }} />
          {parseInline(line.replace(/^#{2,}\s+/, ''))}
        </Typography>
      );
      continue;
    }

    // Numbered list: 1. item
    const numMatch = line.match(/^(\d+)\.\s+(.+)/);
    if (numMatch) { flushBullets(); numberedBuffer.push({ num: numMatch[1], body: numMatch[2] }); continue; }

    // Bullet: - item  •  item  * item (not **bold**)
    const bulletMatch = line.match(/^(\s*[-•]\s+|\s*\*\s+)(.+)/);
    if (bulletMatch) { flushNumbered(); bulletBuffer.push(bulletMatch[2]); continue; }

    // Blank line
    if (!line.trim()) {
      flushAll();
      if (elements.length) elements.push(<Box key={key++} sx={{ height: '0.35rem' }} />);
      continue;
    }

    // Regular paragraph
    flushAll();
    elements.push(
      <Typography key={key++} sx={{ fontSize: '0.9rem', color: '#374151', lineHeight: 1.75, fontFamily: FONT, mb: '0.25rem' }}>
        {parseInline(line)}
      </Typography>
    );
  }

  flushAll();
  return <>{elements}</>;
};

export default RichContent;
