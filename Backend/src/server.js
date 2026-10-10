import { Server } from "socket.io";
import http from "http";
import express from "express";
import path from "path";
import os from "os";
import dotenv from "dotenv";
import cors from "cors";
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import "./cronJobs.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
const __dirname = path.resolve();

/* ponytail: local spawn + timeout instead of a sandbox service;
   upgrade path: containerized executor if this ever faces untrusted users */
const RUNTIMES = {
  javascript: { ext: "js", runner: (file) => ["node", [file]] },
  python: { ext: "py", runner: (file) => ["python3", [file]] },
  cpp: { ext: "cpp" },
  java: { ext: "java" },
};

const exec = (cmd, args, cwd) =>
  new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    const cap = (s) =>
      s.length > 65536 ? s.slice(0, 65536) + "\n…output truncated" : s;
    p.stdout?.on("data", (d) => (stdout = cap(stdout + d)));
    p.stderr?.on("data", (d) => (stderr = cap(stderr + d)));
    const timer = setTimeout(() => {
      p.kill("SIGKILL");
      resolve({
        stdout,
        stderr: cap(stderr + "\nTime limit exceeded (5s)"),
        code: 124,
        timedOut: true,
      });
    }, 5000);
    p.on("error", (e) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: cap(stderr + e.message), code: 127 });
    });
    p.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });

app.post("/api/run", async (req, res) => {
  const { language, code } = req.body ?? {};
  const rt = RUNTIMES[language];
  if (!rt || typeof code !== "string" || !code.trim()) {
    return res
      .status(400)
      .json({ error: "Unsupported language or empty code." });
  }

  const dir = await mkdtemp(path.join(os.tmpdir(), "rtc-run-"));
  try {
    const file = path.join(dir, `main.${rt.ext}`);
    let runCmd;
    let runArgs;

    if (language === "cpp") {
      await writeFile(file, code);
      const build = await exec(
        "g++",
        [file, "-o", path.join(dir, "prog")],
        dir,
      );
      if (build.code !== 0) return res.json(build);
      runCmd = path.join(dir, "prog");
      runArgs = [];
    } else if (language === "java") {
      const cls =
        code.match(
          /public\s+(?:(?:abstract|final)\s+)*class\s+([A-Za-z_$][\w$]*)/,
        )?.[1] || "Main";
      await writeFile(path.join(dir, `${cls}.java`), code);
      const build = await exec("javac", [`${cls}.java`], dir);
      if (build.code !== 0) return res.json(build);
      runCmd = "java";
      runArgs = ["-cp", dir, cls];
    } else {
      await writeFile(file, code);
      [runCmd, runArgs] = rt.runner(file);
    }

    res.json(await exec(runCmd, runArgs, dir));
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    rm(dir, { recursive: true, force: true });
  }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../Frontend/dist")));
  app.get("*", (_, res) => {
    res.sendFile(path.join(__dirname, "../Frontend", "dist", "index.html"));
  });
}

const server = http.createServer(app);
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

const PORT = process.env.port || 5001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
