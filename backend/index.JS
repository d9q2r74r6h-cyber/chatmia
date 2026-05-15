require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');


const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'chatmia_secret_dev';

const users = [];

app.get('/', (req, res) => {
  res.send('ChatMia server running');
});

app.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email y contraseña requeridos',
      });
    }

    const existingUser = users.find(
      (user) => user.email === email
    );

    if (existingUser) {
      return res.status(400).json({
        error: 'El usuario ya existe',
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = {
      id: Date.now().toString(),
      email,
      password: hashedPassword,
    };

    users.push(user);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error interno',
    });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = users.find(
      (user) => user.email === email
    );

    if (!user) {
      return res.status(401).json({
        error: 'Usuario no encontrado',
      });
    }

    const validPassword = await bcrypt.compare(
      password,
      user.password
    );

    if (!validPassword) {
      return res.status(401).json({
        error: 'Contraseña incorrecta',
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      JWT_SECRET,
      {
        expiresIn: '7d',
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({
      error: 'Error interno',
    });
  }
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

function emitOnlineCount() {
  io.emit('online-count', io.engine.clientsCount);
}

function removeWaiting(socketId) {
  if (waitingSocketId === socketId) {
    waitingSocketId = null;
  }
}

function disconnectPair(socketId) {
  const partnerId = partners.get(socketId);

  if (!partnerId) return;

  partners.delete(socketId);
  partners.delete(partnerId);

  io.to(partnerId).emit('partner-left');
}

io.on('connection', (socket) => {
  console.log('CONNECTED:', socket.id);

  emitOnlineCount();

  socket.on('find-partner', ({ gender, country }) => {
    console.log('FIND:', socket.id, gender, country?.code);

    removeWaiting(socket.id);
    disconnectPair(socket.id);

    if (waitingSocketId && waitingSocketId !== socket.id) {
      const partnerId = waitingSocketId;
      waitingSocketId = null;

      partners.set(socket.id, partnerId);
      partners.set(partnerId, socket.id);

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

  socket.on('chat-message', ({ message }) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId || !message) return;

    io.to(partnerId).emit('chat-message', {
      message,
    });
  });

  socket.on('typing', () => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    io.to(partnerId).emit('typing');
  });

  socket.on('next', () => {
    console.log('NEXT:', socket.id);

    removeWaiting(socket.id);
    disconnectPair(socket.id);
  });

  socket.on('disconnect', () => {
    console.log('DISCONNECTED:', socket.id);

    removeWaiting(socket.id);
    disconnectPair(socket.id);
    emitOnlineCount();
  });
});

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`ChatMia server running on http://localhost:${PORT}`);
});