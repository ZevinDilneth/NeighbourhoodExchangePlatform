import { Server } from 'socket.io';

let _io: Server | null = null;

export const setIO = (io: Server): void => { _io = io; };
export const getIO = (): Server => {
  if (!_io) throw new Error('Socket.IO not initialised');
  return _io;
};
