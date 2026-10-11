/* Decide the home-form action from the server's answer about a room ID.
   serverRoom: null while unknown/checking, else { exists, name } from "checkRoom".
   Returns "idle" | "create" | "join" | "nameMismatch". */
export const classifyRoom = ({ roomId, roomName, serverRoom }) => {
  const id = (roomId || "").trim();
  const name = (roomName || "").trim();
  if (!id || !serverRoom) return "idle";
  if (!serverRoom.exists) return name ? "create" : "idle";
  const stored = (serverRoom.name || "").trim();
  if (stored && stored !== name) return "nameMismatch";
  return name ? "join" : "idle";
};
