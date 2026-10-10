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

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("joinRoom", ({ roomId, username }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = { users: [], code: "" };
    }

    const existingUser = rooms[roomId].users.find(
      (u) => u.socketId === socket.id,
    );
    if (!existingUser) {
      rooms[roomId].users.push({ socketId: socket.id, username });

      socket.to(roomId).emit("userJoined", username);
    }

    socket.emit("codeUpdate", rooms[roomId].code);
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

      socket.leave(roomId);
    }
  });

  socket.on("codeChange", ({ roomId, code }) => {
    if (rooms[roomId]) {
      rooms[roomId].code = code;
      socket.to(roomId).emit("codeUpdate", code);
    }
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
        break;
      }
    }
  });
});

const PORT = process.env.PORT || process.env.port || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
