import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSocket } from '../services/socket';
import { useAuth } from './AuthContext';

const OnlineContext = createContext<Set<string>>(new Set());

export const OnlineProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!isAuthenticated) {
      setOnlineIds(new Set());
      return;
    }

    const socket = getSocket();

    const handler = (ids: string[]) => {
      setOnlineIds(new Set(ids));
    };

    socket.on('users:online', handler);

    return () => {
      socket.off('users:online', handler);
    };
  }, [isAuthenticated]);

  return (
    <OnlineContext.Provider value={onlineIds}>
      {children}
    </OnlineContext.Provider>
  );
};

export const useOnline = (): Set<string> => useContext(OnlineContext);
