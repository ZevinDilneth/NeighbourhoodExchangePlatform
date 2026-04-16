import React from 'react';
import { Avatar, Box } from '@mui/material';
import type { AvatarProps } from '@mui/material';
import { useOnline } from '../context/OnlineContext';

interface OnlineAvatarProps extends AvatarProps {
  userId: string;
  isVerified?: boolean;
  /** @deprecated no longer used */
  dotSize?: number;
}

const OnlineAvatar: React.FC<OnlineAvatarProps> = ({ userId, isVerified, dotSize: _dotSize, sx, src, ...rest }) => {
  const onlineIds = useOnline();
  const isOnline = onlineIds.has(userId);
  const safeSrc = src && src.trim() !== '' ? src : undefined;

  const avatarWidth = (sx as Record<string, unknown>)?.width;
  const size = typeof avatarWidth === 'number' ? avatarWidth : 36;
  const tickSize = Math.max(10, Math.round(size * 0.38));

  return (
    <Box
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexShrink: 0,
        borderRadius: '50%',
        outline: isOnline ? '2.5px solid #22C55E' : '2.5px solid transparent',
        outlineOffset: '2px',
        transition: 'outline-color 0.25s ease',
      }}
    >
      <Avatar sx={sx} src={safeSrc} {...rest} />
      {isVerified && (
        <Box sx={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: tickSize,
          height: tickSize,
          borderRadius: '50%',
          background: '#10B981',
          border: '2px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${tickSize * 0.45}px`,
          color: '#fff',
          fontWeight: 700,
          lineHeight: 1,
        }}>✓</Box>
      )}
    </Box>
  );
};

export default OnlineAvatar;
