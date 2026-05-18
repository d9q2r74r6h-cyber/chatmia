require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');

const app = express();

app.use(cors());
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

app.get('/', (req, res) => {
  res.send('ChatMia server running');
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

let waitingSocketId = null;

const partners = new Map();
const activeChats = new Map();
const users = new Map();

const messageRateLimit = new Map();
const nextRateLimit = new Map();

const bannedWords = [
  'puta',
  'puto',
  'mierda',
  'maricon',
  'maricón',
  'nazi',
  'kill',
  'suicide',
];

function emitOnlineCount() {
  io.emit('online-count', io.engine.clientsCount);
}

function containsBannedWord(text) {
  const normalized = text.toLowerCase();

  return bannedWords.some((word) =>
    normalized.includes(word)
  );
}

function removeWaiting(socketId) {
  if (waitingSocketId === socketId) {
    waitingSocketId = null;
  }
}

async function closeActiveChat(socketId) {
  const chatId = activeChats.get(socketId);

  if (!chatId) return;

  await supabase
    .from('active_chats')
    .update({
      active: false,
      ended_at: new Date().toISOString(),
    })
    .eq('chat_id', chatId);

  const partnerId = partners.get(socketId);

  activeChats.delete(socketId);

  if (partnerId) {
    activeChats.delete(partnerId);
  }
}

async function disconnectPair(socketId) {
  const partnerId = partners.get(socketId);

  if (!partnerId) return;

  await closeActiveChat(socketId);

  partners.delete(socketId);
  partners.delete(partnerId);

  io.to(partnerId).emit('partner-left');
}

io.on('connection', (socket) => {
  console.log('CONNECTED:', socket.id);

  emitOnlineCount();

  socket.on('find-partner', async ({ gender, country, email }) => {
    console.log('FIND:', socket.id, gender, country?.code);

    users.set(socket.id, {
      email: email || null,
      gender: gender || null,
      country: country?.name || country?.code || null,
    });

    removeWaiting(socket.id);
    await disconnectPair(socket.id);

    if (waitingSocketId && waitingSocketId !== socket.id) {
      const partnerId = waitingSocketId;
      waitingSocketId = null;

      partners.set(socket.id, partnerId);
      partners.set(partnerId, socket.id);

      const chatId = `${socket.id}-${partnerId}-${Date.now()}`;

      activeChats.set(socket.id, chatId);
      activeChats.set(partnerId, chatId);

      await supabase.from('active_chats').insert({
        chat_id: chatId,

        user1_socket: socket.id,
        user2_socket: partnerId,

        user1_email: users.get(socket.id)?.email || null,
        user2_email: users.get(partnerId)?.email || null,

        user1_country: users.get(socket.id)?.country || null,
        user2_country: users.get(partnerId)?.country || null,

        active: true,
      });

      console.log('MATCHED:', socket.id, partnerId);

      socket.emit('matched', {
        partnerId,
        initiator: true,
      });

      io.to(partnerId).emit('matched', {
        partnerId: socket.id,
        initiator: false,
      });

      return;
    }

    waitingSocketId = socket.id;

    console.log('WAITING:', socket.id);
  });

  socket.on('signal', ({ to, signal }) => {
    io.to(to).emit('signal', { signal });
  });

  socket.on('chat-message', async ({ message }) => {
    const now = Date.now();

    const lastMessage =
      messageRateLimit.get(socket.id) || 0;

    if (now - lastMessage < 1000) {
      return;
    }

    messageRateLimit.set(socket.id, now);

    const partnerId = partners.get(socket.id);

    if (!partnerId || !message) return;

    const cleanMessage = message.trim();

    if (!cleanMessage) return;

    if (cleanMessage.length > 300) return;

    if (containsBannedWord(cleanMessage)) {
      console.log(
        'BLOCKED MESSAGE:',
        socket.id,
        cleanMessage
      );

      socket.emit('message-blocked');

      return;
    }

    const chatId = activeChats.get(socket.id);

    if (chatId) {
      await supabase.rpc('increment_message_count', {
        chat_id_input: chatId,
      });
    }

    io.to(partnerId).emit('chat-message', {
      message: cleanMessage,
    });
  });

  socket.on('typing', () => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    io.to(partnerId).emit('typing');
  });

  socket.on('next', async () => {
    console.log('NEXT:', socket.id);

    const now = Date.now();

    const nextData =
      nextRateLimit.get(socket.id) || {
        count: 0,
        time: now,
      };

    if (now - nextData.time > 10000) {
      nextData.count = 0;
      nextData.time = now;
    }

    nextData.count++;

    nextRateLimit.set(socket.id, nextData);

    if (nextData.count > 5) {
      return;
    }

    await closeActiveChat(socket.id);

    removeWaiting(socket.id);
    await disconnectPair(socket.id);
  });

  socket.on('disconnect', async () => {
    console.log('DISCONNECTED:', socket.id);

    await closeActiveChat(socket.id);

    removeWaiting(socket.id);
    await disconnectPair(socket.id);

    users.delete(socket.id);
    messageRateLimit.delete(socket.id);
    nextRateLimit.delete(socket.id);

    emitOnlineCount();
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`ChatMia server running on port ${PORT}`);
});