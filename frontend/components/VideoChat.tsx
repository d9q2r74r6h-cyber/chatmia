'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import io from 'socket.io-client';
import Peer from 'simple-peer';

type Country = {
  code: string;
  name: string;
  flag: string;
};

type Props = {
  gender: string;
  country: Country;
  onBack?: () => void;
};

type Message = {
  text: string;
  mine: boolean;
};

export default function VideoChat({
  gender,
  country,
  onBack,
}: Props) {
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<any>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const matchSound = useRef<HTMLAudioElement | null>(null);
  const messageSound = useRef<HTMLAudioElement | null>(null);
  const typingTimeout = useRef<any>(null);

  const [online, setOnline] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [connected, setConnected] = useState(false);

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    matchSound.current = new Audio('/sounds/match.mp3');
    messageSound.current = new Audio('/sounds/message.mp3');

    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000',
      {
        transports: ['websocket'],
      }
    );

    socketRef.current = socket;

    socket.on('online-count', (count: number) => {
      setOnline(count);
    });

    navigator.mediaDevices
      .getUserMedia({
        video: true,
        audio: true,
      })
      .then((stream) => {
        streamRef.current = stream;

        if (localVideo.current) {
          localVideo.current.srcObject = stream;
          localVideo.current.play().catch(console.error);
        }

        socket.emit('find-partner', {
          gender,
          country,
        });

        socket.on('matched', ({ partnerId, initiator }) => {
          setConnecting(false);

          peerRef.current?.destroy();

          const peer = new Peer({
            initiator,
            trickle: false,
            stream,
            config: {
              iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' },
              ],
            },
          });

          peer.on('signal', (signal) => {
            socket.emit('signal', {
              to: partnerId,
              signal,
            });
          });

          peer.on('connect', () => {
            matchSound.current?.play().catch(() => {});
            setConnecting(false);
            setConnected(true);
          });

          peer.on('stream', (remoteStream) => {
            if (remoteVideo.current) {
              remoteVideo.current.srcObject = remoteStream;
              remoteVideo.current.play().catch(console.error);
            }

            setConnecting(false);
            setConnected(true);
          });

          peer.on('error', () => {
            setConnecting(false);
            setConnected(false);
          });

          peer.on('close', () => {
            setConnected(false);
          });

          peerRef.current = peer;
        });

        socket.on('signal', ({ signal }) => {
          peerRef.current?.signal(signal);
        });

        socket.on('chat-message', ({ message }) => {
          messageSound.current?.play().catch(() => {});
          setTyping(false);

          setMessages((prev) => [
            ...prev,
            {
              text: message,
              mine: false,
            },
          ]);
        });

        socket.on('typing', () => {
          setTyping(true);

          clearTimeout(typingTimeout.current);

          typingTimeout.current = setTimeout(() => {
            setTyping(false);
          }, 1500);
        });

        socket.on('partner-left', () => {
          cleanupRemote();

          setTyping(false);
          setMessages([]);
          setConnected(false);
          setConnecting(true);

          socket.emit('find-partner', {
            gender,
            country,
          });
        });
      })
      .catch(() => {
        alert('Debes permitir cámara y micrófono para usar ChatMia.');
        setConnecting(false);
        setConnected(false);
      });

    return () => {
      cleanupAll();
      clearTimeout(typingTimeout.current);
      socket.disconnect();
    };
  }, [gender]);

  const cleanupRemote = () => {
    peerRef.current?.destroy();
    peerRef.current = null;

    if (remoteVideo.current) {
      remoteVideo.current.srcObject = null;
    }
  };

  const cleanupAll = () => {
    cleanupRemote();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  };

  const next = () => {
    cleanupRemote();

    setTyping(false);
    setMessages([]);
    setConnected(false);
    setConnecting(true);

    socketRef.current?.emit('next');

    setTimeout(() => {
      socketRef.current?.emit('find-partner', {
        gender,
        country,
      });
    }, 300);
  };

  const sendMessage = () => {
    const cleanMessage = message.trim();

    if (!cleanMessage) return;

    socketRef.current?.emit('chat-message', {
      message: cleanMessage,
    });

    setMessages((prev) => [
      ...prev,
      {
        text: cleanMessage,
        mine: true,
      },
    ]);

    setMessage('');
  };

  return (
    <main className="relative h-screen bg-black text-white flex flex-col overflow-hidden">
      <AnimatePresence>
        {connecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="text-center"
            >
              <div className="text-xl font-semibold animate-pulse">
                Buscando a alguien...
              </div>

              <div className="text-sm text-white/40 mt-2">
                Conectando alrededor del mundo
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="h-16 border-b border-white/10 bg-black/70 backdrop-blur-xl flex items-center justify-between px-4 md:px-6">
        <div className="flex flex-col md:flex-row md:items-center md:gap-4">
        <div className="flex items-center gap-3">
  <h1 className="font-semibold tracking-wide text-lg">
    ChatMia
  </h1>

  <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs">
    <span className="text-base">
      {country.flag}
    </span>

    <span className="text-white/70">
      {country.name}
    </span>
  </div>
</div>

          {onBack && (
            <button
              onClick={onBack}
              className="text-[11px] md:text-xs text-white/50 hover:text-white transition text-left"
            >
              Cambiar preferencia
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden sm:block text-sm text-white/60">
            {online} online
          </div>

          <div
            className={`text-[11px] md:text-xs px-3 py-1 rounded-full border ${
              connected
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
            }`}
          >
            {connected ? 'Conectado' : 'Buscando'}
          </div>
        </div>
      </header>

      <section className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-2 p-2 md:p-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="relative rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl"
          >
            <video
              ref={localVideo}
              autoPlay
              muted
              playsInline
              controls={false}
              className="w-full h-full object-cover bg-black"
            />

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs border border-white/10">
              Tú
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.08 }}
            className="relative rounded-3xl overflow-hidden bg-neutral-900 border border-white/10 shadow-2xl"
          >
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              muted={false}
              controls={false}
              className="w-full h-full object-cover bg-black"
            />

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs border border-white/10">
              Desconocido
            </div>
          </motion.div>
        </div>

        <motion.aside
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.12 }}
          className="bg-white/[0.03] border border-white/10 rounded-3xl backdrop-blur-xl flex flex-col overflow-hidden"
        >
          <div className="p-4 border-b border-white/10">
            <h2 className="font-medium">
              Chat en vivo
            </h2>

            <AnimatePresence>
              {typing && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="text-xs text-white/40 mt-1"
                >
                  Escribiendo...
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <AnimatePresence initial={false}>
              {messages.map((msg, index) => (
                <motion.div
                  key={`${msg.text}-${index}`}
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.18 }}
                  className={`max-w-[85%] px-4 py-2 rounded-2xl text-sm ${
                    msg.mine
                      ? 'ml-auto bg-white text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {msg.text}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <div className="p-3 border-t border-white/10 flex gap-2">
            <input
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                socketRef.current?.emit('typing');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  sendMessage();
                }
              }}
              placeholder="Escribe un mensaje..."
              className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none focus:border-white/30 transition"
            />

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={sendMessage}
              className="px-5 rounded-2xl bg-white text-black font-medium"
            >
              Enviar
            </motion.button>
          </div>
        </motion.aside>
      </section>

      <footer className="h-20 border-t border-white/10 bg-black/70 backdrop-blur-xl flex items-center justify-center">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          onClick={next}
          className="px-10 py-3 rounded-full bg-white text-black font-semibold shadow-xl"
        >
          Siguiente
        </motion.button>
      </footer>
    </main>
  );
}