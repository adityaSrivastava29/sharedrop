import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';

const app = express();
const server = createServer(app);

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:4173',
      'https://adityasrivastava29.github.io',
    ],
    methods: ['GET', 'POST'],
  },
});

// Room management: roomId -> Set<socketId>
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`Connected: ${socket.id}`);

  socket.on('room:create', ({ roomId }) => {
    if (rooms.has(roomId)) {
      socket.emit('error', { message: 'Room already exists.' });
      return;
    }
    rooms.set(roomId, new Set([socket.id]));
    socket.join(roomId);
    socket.data.roomId = roomId;
    console.log(`Room created: ${roomId} by ${socket.id}`);
  });

  socket.on('room:join', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Room not found. The sender may have disconnected.' });
      return;
    }
    if (room.size >= 2) {
      socket.emit('error', { message: 'Room is full. Only one receiver allowed.' });
      return;
    }
    room.add(socket.id);
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.to(roomId).emit('peer:joined', { roomId });
    console.log(`Peer joined room: ${roomId} (${socket.id})`);
  });

  socket.on('signal:offer', ({ roomId, offer }) => {
    socket.to(roomId).emit('signal:offer', { offer });
  });

  socket.on('signal:answer', ({ roomId, answer }) => {
    socket.to(roomId).emit('signal:answer', { answer });
  });

  socket.on('signal:ice-candidate', ({ roomId, candidate }) => {
    socket.to(roomId).emit('signal:ice-candidate', { candidate });
  });

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId;
    if (roomId) {
      const room = rooms.get(roomId);
      if (room) {
        room.delete(socket.id);
        if (room.size === 0) {
          rooms.delete(roomId);
        } else {
          socket.to(roomId).emit('peer:left', { roomId });
        }
      }
    }
    console.log(`Disconnected: ${socket.id}`);
  });
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Signaling server running on port ${PORT}`);
});
