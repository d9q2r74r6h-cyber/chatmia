require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { createClient } = require('@supabase/supabase-js');



const app = express();

const allowedOrigin = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',').map((origin) => origin.trim())
  : [
      'https://chatmia.org',
      'https://www.chatmia.org',
      'http://localhost:3000',
    ];

app.use(cors({ origin: allowedOrigin }));
app.use(express.json());

let supabase = null;

if (
  process.env.SUPABASE_URL &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
) {
  supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

app.get('/', (req, res) => {
  res.send('ChatMia server running');
});

app.get('/ice-servers', (req, res) => {
  const servers = [
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];

  if (
    process.env.TURN_URLS &&
    process.env.TURN_USERNAME &&
    process.env.TURN_CREDENTIAL
  ) {
    servers.push({
      urls: process.env.TURN_URLS.split(',').map((url) => url.trim()),
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    });
  }

  res.json({ iceServers: servers });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST'],
  },
});

let waitingNormal = null;
let waitingShadow = null;

const partners = new Map();
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

function emitAdminStats() {

  io.emit('admin-stats', {
    online: io.engine.clientsCount,
    waitingNormal:
      waitingNormal ? 1 : 0,
    waitingShadow:
      waitingShadow ? 1 : 0,
    activeChats:
      partners.size / 2,
  });

}

async function saveVisit(socket, data = {}) {
  console.log('SAVE VISIT:', socket.id, data);

  if (!supabase) {
    console.log('NO SUPABASE');
    return;
  }

  const now = new Date();

  const { error } = await supabase
    .from('visits')
    .insert({
      guest_id: data.guestId || null,
      is_guest: data.isGuest === undefined ? !data.email : data.isGuest,
      socket_id: socket.id,
      email: data.email || null,
      gender: data.gender || null,
      country: data.country || null,
      flag: data.flag || '',
      region: data.region || null,
      city: data.city || null,
      visit_date: now.toISOString().slice(0, 10),
      visit_time: now.toISOString().slice(11, 19),
      last_seen_at: now.toISOString(),
      user_agent: socket.handshake.headers['user-agent'] || null,
    });

  if (error) {
    console.log('SAVE VISIT ERROR:', error.message);
  } else {
    console.log('VISIT SAVED');
  }
} 


async function markVisitMatched(socketId) {
  if (!supabase) return;

  await supabase.auth.getUser();

  await supabase.from('visits')
    .update({ matched: true })
    .eq('socket_id', socketId)
    .is('disconnected_at', null);
}

async function incrementarMatchCount(socketId) {
  if (!supabase) return;

  const { data, error: selectError } = await supabase
    .from('visits')
    .select('match_count')
    .eq('socket_id', socketId)
    .is('disconnected_at', null)
    .maybeSingle();

  if (selectError) {
    console.log('ERROR AL LEER MATCH COUNT:', selectError.message);
    return;
  }

  const nuevoTotal = (data?.match_count || 0) + 1;


  console.log(
    'NEXT COUNT:',
    socketId,
    nuevoTotal
  );


  const { error } = await supabase
    .from('visits')
    .update({
      match_count: nuevoTotal,
    })
    .eq('socket_id', socketId)
    .is('disconnected_at', null);

  if (error) {
    console.log('ERROR AL ACTUALIZAR MATCH COUNT:', error.message);
  }
}

async function incrementarNextCount(socketId) {
  console.log('INCREMENTANDO NEXT:', socketId);
  if (!supabase) return;

  const { data } = await supabase
    .from('visits')
    .select('next_count')
    .eq('socket_id', socketId)
    .is('disconnected_at', null)
    .maybeSingle();

  const nuevoTotal = (data?.next_count || 0) + 1;

  await supabase
    .from('visits')
    .update({ next_count: nuevoTotal })
    .eq('socket_id', socketId)
    .is('disconnected_at', null);
}

async function incrementarMessagesSent(socketId) {
  if (!supabase) return;

  const { data, error: selectError } = await supabase
    .from('visits')
    .select('messages_sent')
    .eq('socket_id', socketId)
    .is('disconnected_at', null)
    .maybeSingle();

  if (selectError) {
    console.log(
      'ERROR AL LEER MESSAGES SENT:',
      selectError.message
    );
    return;
  }

  const nuevoTotal =
    (data?.messages_sent || 0) + 1;

  const { error } = await supabase
    .from('visits')
    .update({
      messages_sent: nuevoTotal,
    })
    .eq('socket_id', socketId)
    .is('disconnected_at', null);

  if (error) {
    console.log(
      'ERROR AL ACTUALIZAR MESSAGES SENT:',
      error.message
    );
  }
}

async function markVisitDisconnected(socketId) {
  if (!supabase) return;

  const disconnectedAt = new Date();

  const { data, error: selectError } = await supabase
    .from('visits')
    .select('connected_at')
    .eq('socket_id', socketId)
    .is('disconnected_at', null)
    .maybeSingle();

  if (selectError) {
    console.log(
      'ERROR AL LEER DURACION:',
      selectError.message
    );
    return;
  }

  const connectedAt = data?.connected_at
    ? new Date(data.connected_at)
    : disconnectedAt;

  const durationMinutes =
    Math.max(
      0,
      Math.round(
        ((disconnectedAt.getTime() - connectedAt.getTime()) / 60000) * 100
      ) / 100
    );

  const { error } = await supabase
    .from('visits')
    .update({
      disconnected_at: disconnectedAt.toISOString(),
      duration_minutes: durationMinutes,
    })
    .eq('socket_id', socketId)
    .is('disconnected_at', null);

  if (error) {
    console.log(
      'ERROR AL GUARDAR DURACION:',
      error.message
    );
  }
}
async function saveAnalyticsSnapshot() {
  if (!supabase) return;

  await supabase.from('analytics_snapshots').insert({
    online_users: io.engine.clientsCount,
    active_chats: partners.size / 2,
    waiting_users: waitingNormal ? 1 : 0,
    shadow_queue: waitingShadow ? 1 : 0,
  });
}

function removeWaiting(socketId) {

  if (waitingNormal === socketId) {
    waitingNormal = null;
  }

  if (waitingShadow === socketId) {
    waitingShadow = null;
  }

}

function disconnectPair(socketId) {
  const partnerId = partners.get(socketId);

  if (!partnerId) return;

  partners.delete(socketId);
  partners.delete(partnerId);

  io.to(partnerId).emit('partner-left');
}

async function authenticateSocket(socket) {
  const accessToken = socket.handshake.auth?.accessToken;

  if (!supabase || !accessToken) {
    socket.user = null;
    return;
  }

  const { data, error } = await supabase.auth.getUser(accessToken);
  socket.user = error ? null : data?.user || null;
}

async function isEmailBanned(email) {
  if (!supabase || !email) return false;

  const { data } = await supabase
    .from('banned_users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  return Boolean(data);
}

io.on('connection', async (socket) => {
  console.log('CONNECTED:', socket.id);
  await authenticateSocket(socket);

  emitOnlineCount();  
  emitAdminStats();

  socket.on('find-partner', async ({
    gender,
    country,
    guestId,
    isGuest,
    region,
    city,

  }) => {

    console.log('LOCATION RECEIVED:', {
      country,
      region,
      city,
    });
    

    const authenticatedEmail = socket.user?.email || null;
    const guestMode = !authenticatedEmail;

    if (await isEmailBanned(authenticatedEmail)) {
      socket.emit('banned');
      socket.disconnect(true);
      return;
    }

    if (!socket.visitSaved) { 
      saveVisit(socket, {
        email: authenticatedEmail,
        guestId: guestMode ? guestId : null,
        isGuest: guestMode,
        gender,
        country: country?.name || null,
        flag: country?.flag || '',
        region: region || null,
        city: city || null,
      }).catch(console.error);
      
      socket.visitSaved = true;

  socket.visitSaved = true;
  console.log(
    'VISITA INICIAL GUARDADA:',
    socket.id
  );


}
      socket.isGuest = guestMode;
      socket.guestId = guestMode ? guestId || null : null;

      users.set(socket.id, {
        email: authenticatedEmail,
        guestId: guestMode ? guestId || null : null,
        isGuest: guestMode,
        gender: gender || null,
        country: country?.name || null,
        flag: country?.flag || '🌎',
        region: region || null,
        city: city || null,
      });



  
      removeWaiting(socket.id);
      disconnectPair(socket.id);
  
      let shadowBanned = false;
  
      if (supabase && authenticatedEmail) {
  
        const { data: profile } =
          await supabase
            .from('profiles')
            .select('shadow_banned')
            .eq('email', authenticatedEmail)
            .single();

  
        shadowBanned =
          profile?.shadow_banned || false;
      }
  
      socket.shadowBanned = shadowBanned;
  
      const queueType = socket.shadowBanned
        ? 'shadow'
        : 'normal';
  
      let waitingQueue =
        queueType === 'shadow'
          ? waitingShadow
          : waitingNormal;
  
      if (
        waitingQueue &&
        waitingQueue !== socket.id
      ) {
  
        const partnerId = waitingQueue;
  
        if (queueType === 'shadow') {
          waitingShadow = null;
        } else {
          waitingNormal = null;
        }
  
        partners.set(socket.id, partnerId);
  
        partners.set(partnerId, socket.id);
  
        await markVisitMatched(socket.id);
await markVisitMatched(partnerId);

await incrementarMatchCount(socket.id);
await incrementarMatchCount(partnerId);
        

        console.log(
          'MATCHED:',
          socket.id,
          partnerId
        );

        emitAdminStats();
  
        socket.emit('matched', {
          partnerId,
          initiator: true,
          partner:
            users.get(partnerId) || null,
        });
  
        io.to(partnerId).emit('matched', {
          partnerId: socket.id,
          initiator: false,
          partner:
            users.get(socket.id) || null,
        });
  
        return;
      }
  
      if (queueType === 'shadow') {
        waitingShadow = socket.id;
      } else {
        waitingNormal = socket.id;
      }
  
      console.log(
        'WAITING:',
        socket.id,
        queueType
      );
    }
  );
  socket.on('signal', ({ to, signal }) => {
    if (partners.get(socket.id) !== to) return;
    io.to(to).emit('signal', { signal });
  });



  
  socket.on('chat-message', async ({ message }) => {

    if (!partners.has(socket.id)) return;
    if (typeof message !== 'string') return;
    if (message.length > 500) return;

    const now = Date.now();

const msgData =
  messageRateLimit.get(socket.id) || {
    count: 0,
    time: now,
  };

if (now - msgData.time > 5000) {
  msgData.count = 0;
  msgData.time = now;
}

msgData.count++;

messageRateLimit.set(socket.id, msgData);

if (msgData.count > 8) {
  socket.emit('rate-limited', {
    reason: 'Too many messages',
  });

  return;
}
    const partnerSocketId = partners.get(socket.id);
  
    const lower = message.toLowerCase();
  
    const matchedWord = bannedWords.find(word =>
      lower.includes(word)
    );
  
    const flagged = !!matchedWord;
  
    // enviar mensaje al otro usuario
    io.to(partnerSocketId).emit('chat-message', {
      message,
      from: socket.id,
    });
  
    // guardar en Supabase
    if (supabase) {
      await supabase
        .from('chat_messages')
        .insert({
          sender_id: users.get(socket.id)?.email || null,
          receiver_id: users.get(partnerSocketId)?.email || null,
          message: message,
          is_flagged: flagged,
          flag_reason: matchedWord || null,
        });
    }

    await incrementarMessagesSent(socket.id);
  
  });

  socket.on('reaction', ({ emoji }) => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    io.to(partnerId).emit('reaction', {
      emoji,
    });
  });

  socket.on('typing', () => {
    const partnerId = partners.get(socket.id);

    if (!partnerId) return;

    io.to(partnerId).emit('typing');
  });





  //////////////////////////////////////
  socket.on('next', async () => {
    await incrementarNextCount(socket.id);

    console.log('NEXT:', socket.id);
  
    const now = Date.now();
  
    const nextData =
      nextRateLimit.get(socket.id) || {
        count: 0,
        time: now,
        cooldownUntil: 0,
      };
  
    // usuario en cooldown
    if (now < nextData.cooldownUntil) {
  
      const secondsLeft = Math.ceil(
        (nextData.cooldownUntil - now) / 1000
      );
  
      socket.emit('next-blocked', {
        reason: `Cooldown active (${secondsLeft}s)`,
      });
  
      return;
    }
  
    // reset ventana
    if (now - nextData.time > 10000) {
      nextData.count = 0;
      nextData.time = now;
    }
  
    nextData.count++;
  
    // demasiado spam
    if (nextData.count > 5) {
  
      nextData.cooldownUntil =
        now + 30000;
  
      socket.emit('next-blocked', {
        reason:
          'Too many next requests. Cooldown 30s.',
      });
  
      nextRateLimit.set(
        socket.id,
        nextData
      );
  
      return;
    }
  
    nextRateLimit.set(
      socket.id,
      nextData
    );
  
    removeWaiting(socket.id);
  
    disconnectPair(socket.id);
  
  });

  socket.on('disconnect', async () => {
    console.log('DISCONNECTED:', socket.id);

    await markVisitDisconnected(socket.id);

    removeWaiting(socket.id);
    disconnectPair(socket.id);

    users.delete(socket.id);
    messageRateLimit.delete(socket.id);
    nextRateLimit.delete(socket.id);

    emitOnlineCount();
    emitAdminStats();
  });
});

const PORT = process.env.PORT || 4000;

setInterval(() => {
  saveAnalyticsSnapshot();
}, 60000);

server.listen(PORT, () => {
  console.log(`ChatMia server running on port ${PORT}`);
});
