/* A room keeps no storage once its last user leaves: drop it from the store so
   the roomId, room name, and code are gone. Mutates `rooms` in place and returns
   it for convenience. Callers empty `users` first; this only decides deletion. */
export const wipeEmptyRoom = (rooms, roomId) => {
  if (rooms[roomId]?.users.length === 0) delete rooms[roomId];
  return rooms;
};
