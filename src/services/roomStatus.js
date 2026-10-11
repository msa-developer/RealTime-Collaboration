/* Decide the home-form action from the server's answer about a room ID.
   serverRoom: null while unknown/checking, else { exists, name } from "checkRoom".
   Returns "idle" | "create" | "join" | "nameMismatch". */
export const classifyRoom = ({ roomId, roomName, serverRoom }) => {
  const id = (roomId || "").trim();
  const name = (roomName || "").trim();
  if (!id || !name) return "idle";
  /* No ack yet (still checking, or a flaky mobile link never answered): assume
     the common case — a brand-new room — so the button isn't stuck on a
     disabled "Join room". A confirmed nameMismatch is the only thing that
     blocks, and it can only appear once the ack actually arrives. */
  if (!serverRoom) return "create";
  if (!serverRoom.exists) return "create";
  const stored = (serverRoom.name || "").trim();
  if (stored && stored !== name) return "nameMismatch";
  return name ? "join" : "idle";
};
