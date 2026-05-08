import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  const PORT = Number(process.env.PORT) || 3000;

  // Track rooms and users
  const rooms = new Map<string, { members: Set<{peerId: string, nickname: string, socketId: string}>, leader: string | null }>();

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId: string, peerId: string, nickname: string) => {
      let room = rooms.get(roomId);
      
      if (!room) {
        room = { members: new Set(), leader: peerId };
        rooms.set(roomId, room);
      }

      if (room.members.size >= 5) {
        socket.emit("room-full");
        return;
      }

      room.members.add({ peerId, nickname, socketId: socket.id });
      socket.join(roomId);

      console.log(`Peer ${peerId} (${nickname}) joined room ${roomId}`);
      
      // Notify others in room
      socket.to(roomId).emit("user-joined-room", peerId, nickname, room.leader);
      
      // Tell the joined user who the leader is
      socket.emit("leader-update", room.leader);

      socket.on("disconnect", () => {
        const room = rooms.get(roomId);
        if (room) {
          let memberToRemove: any = null;
          for (const m of room.members) {
            if (m.peerId === peerId) {
              memberToRemove = m;
              break;
            }
          }
          if (memberToRemove) room.members.delete(memberToRemove);

          if (room.members.size === 0) {
            rooms.delete(roomId);
          } else if (room.leader === peerId) {
            // Pick new leader
            const nextMember = Array.from(room.members)[0];
            room.leader = nextMember.peerId;
            io.to(roomId).emit("leader-update", room.leader);
          }
        }
        socket.to(roomId).emit("user-left", peerId);
      });
    });

    // Leader actions
    socket.on("kick-user", (roomId: string, targetPeerId: string) => {
      const room = rooms.get(roomId);
      if (room) {
        // Find the socket ID of the target peer
        const targetMember = Array.from(room.members).find(m => m.peerId === targetPeerId);
        if (targetMember) {
           io.to(targetMember.socketId).emit("you-are-kicked");
        }
      }
    });

    socket.on("mute-user", (roomId: string, targetPeerId: string) => {
      const room = rooms.get(roomId);
      if (room) {
        const targetMember = Array.from(room.members).find(m => m.peerId === targetPeerId);
        if (targetMember) {
           io.to(targetMember.socketId).emit("you-are-muted-by-leader");
        }
      }
    });

    socket.on("leader-adjust-mic-gain", (roomId: string, targetPeerId: string, gain: number) => {
      const room = rooms.get(roomId);
      if (room) {
        const targetMember = Array.from(room.members).find(m => m.peerId === targetPeerId);
        if (targetMember) {
           io.to(targetMember.socketId).emit("adjust-your-mic-gain", gain);
        }
      }
    });

    // Signaling for WebRTC
    socket.on("signal", (data: { to: string; signal: any; from: string }) => {
      io.to(data.to).emit("signal", {
        signal: data.signal,
        from: socket.id,
        userId: data.from
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
