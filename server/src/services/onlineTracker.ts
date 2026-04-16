/** Shared in-memory store: userId → number of active socket connections */
export const onlineUsers = new Map<string, number>();
