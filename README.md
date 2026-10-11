# RealTime Collaboration — Code Together

A simple real-time code editor where multiple people can join one room and write, run, and discuss code together — like Google Docs, but for code.

Perfect for:
- Developers doing pair programming or quick team discussions
- Students explaining code to friends in one place

## What it does

- Create a room, share the Room ID, others join with their name
- Everyone sees the same code live — every keystroke syncs instantly
- Built-in VS Code-like editor with syntax highlighting
- Run JavaScript, Python, Java, and C++ inside the editor
- Voice chat, user list, and typing indicator so you know who is there

## How to use

1. Click **Create room**, enter your name and a room name
2. Share the **Room ID** with your friends
3. Friends enter the Room ID + their name and click **Join room**
4. Code together. Output is shared with everyone in the room.

Room closes automatically when last person leaves. Nothing is saved.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:5001`.

Build for production:

```bash
npm run build
npm start
```

## Tech stack

Next.js, React, Socket.io, Monaco Editor, Chakra UI.
