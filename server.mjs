import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import cron from "node-cron";

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();

/* Keep-alive ping (was Backend/src/cronJobs.js) */
cron.schedule("*/15 * * * *", async () => {
  try {
    await fetch("https://collaboration-gwsu.onrender.com/");
  } catch (error) {
    console.log(error.message);
  }
});

await app.prepare();

const server = createServer((req, res) => handle(req, res));
const io = new Server(server, {
  cors: { origin: "*" },
});

const rooms = {};
/* roomId -> Set of socket ids currently in voice (independent of `rooms`, so a
   voice-join that races joinRoom is still recorded). */
const voice = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("checkRoom", ({ roomId } = {}, ack) => {
    const id = typeof roomId === "string" ? roomId.trim() : "";
    const room = id ? rooms[id] : undefined;
    if (typeof ack === "function") {
      ack({ exists: Boolean(room), name: room?.name || "" });
    }
  });

  socket.on("joinRoom", ({ roomId, username, roomName }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], code: "", name: "" };
    }

    const name = typeof roomName === "string" ? roomName.trim() : "";
    if (name && !rooms[roomId].name) {
      rooms[roomId].name = name;
    }

    const existingUser = rooms[roomId].users.find(
      (u) => u.socketId === socket.id,
    );
    if (!existingUser) {
      rooms[roomId].users.push({
        socketId: socket.id,
        username,
        muted: true,
      });
      socket.to(roomId).emit("userJoined", username);
    } else if (existingUser.username !== username) {
      existingUser.username = username;
    }

    socket.emit("codeUpdate", rooms[roomId].code);
    socket.emit("roomUpdate", { name: rooms[roomId].name });
    io.to(roomId).emit("userListUpdate", rooms[roomId].users);
  });

  socket.on("leaveRoom", ({ roomId, username }) => {
    const user = rooms[roomId]?.users.find((u) => u.socketId === socket.id);
    if (user) {
      rooms[roomId].users = rooms[roomId].users.filter(
        (u) => u.socketId !== socket.id,
      );

      socket.to(roomId).emit("userLeft", username);
      io.to(roomId).emit("userListUpdate", rooms[roomId].users);
      leaveVoice(socket, roomId);

      socket.leave(roomId);
    }
  });

  /* Voice chat: the server owns the per-room voice roster. Only the newcomer
     offers, so N users joining at once can never glare with each other —
     each pair settles on exactly one offer/answer. Relaying is still needed
     for SDP/ICE between two specific sockets. */
  socket.on("voice-join", ({ roomId }) => {
    if (!voice[roomId]) voice[roomId] = new Set();
    const existing = [...voice[roomId]];
    voice[roomId].add(socket.id);
    /* Tracked separately from `rooms` so it works even if this arrives
       before "joinRoom" has created the room. */
    socket.emit("voice-peers", existing);
  });

  socket.on("voice-signal", ({ roomId, to, data }) => {
    if (typeof to === "string" && data) {
      io.to(to).emit("voice-signal", { from: socket.id, data });
    }
  });

  const leaveVoice = (socket, roomId) => {
    const roster = voice[roomId];
    if (roster?.delete(socket.id) && !roster.size) delete voice[roomId];
  };

  socket.on("voiceMute", ({ roomId, muted }) => {
    const room = rooms[roomId];
    const user = room?.users.find((u) => u.socketId === socket.id);
    if (user) {
      user.muted = !!muted;
      io.to(roomId).emit("userListUpdate", room.users);
    }
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
  });

  /* Run output belongs to the room, not the clicker: relay to everyone. */
  socket.on("runUpdate", ({ roomId, running, output }) => {
    const room = rooms[roomId];
    if (!room) return;
    const user = room.users.find((u) => u.socketId === socket.id);
    io.to(roomId).emit("runUpdate", {
      running,
      output,
      by: user?.username || "",
    });
  });

  socket.on("userTyping", ({ roomId, username }) => {
    socket.to(roomId).emit("userTyping", username);
  });

  socket.on("userStoppedTyping", ({ roomId, username }) => {
    socket.to(roomId).emit("userStoppedTyping", username);
  });

  socket.on("disconnect", () => {
    for (let roomId in rooms) {
      const user = rooms[roomId].users.find((u) => u.socketId === socket.id);
      if (user) {
        rooms[roomId].users = rooms[roomId].users.filter(
          (u) => u.socketId !== socket.id,
        );

        socket.to(roomId).emit("userLeft", user.username);
        io.to(roomId).emit("userListUpdate", rooms[roomId].users);
        leaveVoice(socket, roomId);
        break;
      }
    }
  });
});

const PORT = process.env.PORT || process.env.port || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
