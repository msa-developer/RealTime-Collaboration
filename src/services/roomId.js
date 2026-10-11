/* Room IDs for the home form's "Create room" button.
   crypto.randomUUID exists only in a secure context (HTTPS or localhost), so it
   is undefined when a phone opens the dev server over plain HTTP on the LAN IP.
   Calling it there threw a TypeError inside the click handler, which made the
   button look missing on mobile. crypto.getRandomValues works everywhere, so
   build the v4-shaped ID from it as the fallback. */
export const newRoomId = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variant 10
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return hex.replace(
    /(.{8})(.{4})(.{4})(.{4})(.{12})/,
    "$1-$2-$3-$4-$5",
  );
};
