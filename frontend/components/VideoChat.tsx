'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import io from 'socket.io-client';
import Peer from 'simple-peer';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

type Country = {
  code: string;
  name: string;
  flag: string;
};

type Props = {
  gender: string;
  country: Country;
  cameraMode: 'user' | 'environment';
  onBack?: () => void;
};

type Message = {
  text: string;
  mine: boolean;
};

export default function VideoChat({
  gender,
  country,
  cameraMode,
  onBack,
}: Props) {
  const hasTrackedConnection = useRef(false);

  const localVideoMobile = useRef<HTMLVideoElement>(null);
  const localVideoDesktop = useRef<HTMLVideoElement>(null);
  const remoteVideoMobile = useRef<HTMLVideoElement>(null);
  const remoteVideoDesktop = useRef<HTMLVideoElement>(null);

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

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  

  const [partnerInfo, setPartnerInfo] = useState<any>(null);

  useEffect(() => {
    const checkBan = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) return false;

      const { data } = await supabase
        .from('banned_users')
        .select('*')
        .eq('email', user.email)
        .maybeSingle();

      if (data) {
        alert('Tu cuenta ha sido suspendida de ChatMia.');
        window.location.href = '/auth';
        return true;
      }

      return false;
    };

    const attachLocalStream = (stream: MediaStream) => {
      [localVideoMobile.current, localVideoDesktop.current].forEach((video) => {
        if (video) {
          video.srcObject = stream;
          video.play().catch(console.error);
        }
      });
    };

    const attachRemoteStream = (stream: MediaStream) => {
      [remoteVideoMobile.current, remoteVideoDesktop.current].forEach((video) => {
        if (video) {
          video.srcObject = stream;
          video.play().catch(console.error);
        }
      });
    };

    (async () => {
      const banned = await checkBan();
      if (banned) return;

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
          video: {
            facingMode: cameraMode,
          },
          audio: true,
        })
        .then((stream) => {
          streamRef.current = stream;
          attachLocalStream(stream);

          socket.emit('find-partner', {
            gender,
            country,
          });

          socket.on('matched', ({ partnerId, initiator, partner }) => {
            setPartnerInfo(partner || null);
            setConnecting(false);
            peerRef.current?.destroy();

            const peer = new Peer({
              initiator,
              trickle: false,
              stream,
              config: {
                iceServers: [
                  {
                    urls: 'stun:global.stun.twilio.com:3478',
                  },
                  {
                    urls: 'turn:global.relay.metered.ca:80',
                    username: 'admchatmia@outlook.com',
                    credential: 'Osorno69#',
                  },
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
              if (!hasTrackedConnection.current) {
                hasTrackedConnection.current = true;

                trackEvent('chat_connected', {
                  country: country.name,
                });
              }

              matchSound.current?.play().catch(() => {});
              setConnecting(false);
              setConnected(true);
            });

            peer.on('stream', (remoteStream) => {
              attachRemoteStream(remoteStream);
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
            hasTrackedConnection.current = false;
            setPartnerInfo(null);
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
    })();

    return () => {
      cleanupAll();
      clearTimeout(typingTimeout.current);
      socketRef.current?.disconnect();
    };
  }, [gender, country, cameraMode]);

  const cleanupRemote = () => {
    peerRef.current?.destroy();
    peerRef.current = null;

    [remoteVideoMobile.current, remoteVideoDesktop.current].forEach((video) => {
      if (video) {
        video.srcObject = null;
      }
    });
  };

  const cleanupAll = () => {
    cleanupRemote();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  };

  const next = () => {
    hasTrackedConnection.current = false;
    setPartnerInfo(null);

    trackEvent('next_clicked');

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

  const toggleMic = () => {
    const audioTrack = streamRef.current?.getAudioTracks()[0];

    if (!audioTrack) return;

    const enabled = !audioTrack.enabled;
    audioTrack.enabled = enabled;
    setMicEnabled(enabled);
  };

  const toggleCamera = () => {
    const videoTrack = streamRef.current?.getVideoTracks()[0];

    if (!videoTrack) return;

    const enabled = !videoTrack.enabled;
    videoTrack.enabled = enabled;
    setCameraEnabled(enabled);
  };

  const switchCamera = async () => {
    try {
      const currentTrack =
        streamRef.current?.getVideoTracks()[0];
  
      const currentFacingMode =
        currentTrack?.getSettings()?.facingMode;
  
      const newMode =
        currentFacingMode === 'environment'
          ? 'user'
          : 'environment';
  
      const newStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: newMode,
          },
          audio: true,
        });
  
      const newVideoTrack =
        newStream.getVideoTracks()[0];
  
      const oldVideoTrack =
        streamRef.current?.getVideoTracks()[0];
  
      if (
        peerRef.current &&
        oldVideoTrack &&
        newVideoTrack
      ) {
        peerRef.current.replaceTrack(
          oldVideoTrack,
          newVideoTrack,
          streamRef.current as MediaStream
        );
      }
  
      oldVideoTrack?.stop();
  
      if (streamRef.current) {
        streamRef.current.removeTrack(oldVideoTrack!);
        streamRef.current.addTrack(newVideoTrack);
      }
  
      [
        localVideoMobile.current,
        localVideoDesktop.current,
      ].forEach((video) => {
        if (video) {
          video.srcObject = streamRef.current;
        }
      });
    } catch (err) {
      console.error(err);
    }
  };

  const reportUser = async () => {
    const reason = prompt('¿Por qué deseas reportar este usuario?');

    if (!reason) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase.from('reports').insert({
      reporter_email: user?.email || 'unknown',
      reason,
    });

    trackEvent('user_reported', {
      reason,
    });

    alert('Reporte enviado. Gracias por ayudar a mantener ChatMia seguro.');
  };

  const containsBannedWord = (text: string) => {
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

    const normalized = text.toLowerCase();

    return bannedWords.some((word) => normalized.includes(word));
  };

  const getGenderIcon = (gender?: string) => {
    switch (gender) {
      case 'male':
        return '👨';
      case 'female':
        return '👩';
      case 'couple':
        return '👩‍❤️‍👨';
      default:
        return '🧑';
    }
  };

  const sendMessage = () => {
    const cleanMessage = message.trim();

    if (!cleanMessage) return;

    if (cleanMessage.length > 300) {
      alert('El mensaje es demasiado largo.');
      return;
    }

    if (containsBannedWord(cleanMessage)) {
      alert('Este mensaje no cumple las normas de ChatMia.');
      setMessage('');
      return;
    }

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

    trackEvent('message_sent');

    setMessage('');
  };

  const partnerLabel = (
    <>
      {partnerInfo?.flag || '🌎'}{' '}
      {getGenderIcon(partnerInfo?.gender)}{' '}
      {partnerInfo?.country || 'Sin país'}
    </>
  );

  return (
    <main className="relative h-[100dvh] bg-black text-white flex flex-col overflow-hidden">
      <AnimatePresence>
        {connecting && (
          <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center">
            <div className="text-center">
              <div className="text-xl font-semibold animate-pulse">
                Buscando a alguien...
              </div>

              <div className="text-sm text-white/40 mt-2">
                Conectando alrededor del mundo
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <header className="h-14 shrink-0 border-b border-white/10 bg-black flex items-center justify-between px-4">
        <div className="font-semibold text-sm md:text-base">
          ChatMia
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span>{country.flag}</span>

          <span className="text-white/60">
            {online} online
          </span>

          <span
            className={`px-2 py-1 rounded-full border ${
              connected
                ? 'bg-green-500/10 text-green-400 border-green-500/20'
                : 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20'
            }`}
          >
            {connected ? 'Conectado' : 'Buscando'}
          </span>
        </div>
      </header>

      <section className="flex-1 min-h-0 overflow-hidden">
        <div className="flex lg:hidden flex-col h-full">
          <div className="relative flex-1 min-h-0 border-b border-white/10 bg-black">
          <video
  ref={remoteVideoDesktop}
  autoPlay
  playsInline
  muted={false}
  controls={false}
  disablePictureInPicture
  controlsList="nodownload nofullscreen noremoteplayback"
  className="w-full h-full object-cover"
/>

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs backdrop-blur-md">
              {partnerLabel}
            </div>

            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={next}
                className="px-5 py-2 rounded-full bg-white text-black text-sm font-semibold"
              >
                Siguiente
              </button>

              <button
                onClick={reportUser}
                className="px-5 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-300 text-sm font-semibold backdrop-blur-md"
              >
                Reportar
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0 bg-black">
            <video
              ref={localVideoMobile}
              autoPlay
              muted
              playsInline
              controls={false}
              className="w-full h-full object-cover"
            />

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs backdrop-blur-md">
              Tú
            </div>

            <div className="absolute top-3 right-3 flex gap-2">
              <button
                onClick={toggleMic}
                className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-lg"
              >
                {micEnabled ? '🎤' : '🔇'}
              </button>

              <button
                onClick={toggleCamera}
                className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-lg"
              >
                {cameraEnabled ? '📷' : '🚫'}
              </button>
              <button
  onClick={switchCamera}
  className="w-11 h-11 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-lg"
>
  🔄
</button>
            </div>

            <div className="absolute bottom-3 left-3 right-3 space-y-2">
              <div className="max-h-24 overflow-y-auto space-y-1">
                {messages.slice(-3).map((msg, index) => (
                  <div
                    key={`${msg.text}-${index}`}
                    className={`text-xs px-3 py-2 rounded-2xl max-w-[80%] ${
                      msg.mine
                        ? 'ml-auto bg-white text-black'
                        : 'bg-black/60 text-white'
                    }`}
                  >
                    {msg.text}
                  </div>
                ))}

                {typing && (
                  <div className="text-xs text-white/60 px-2">
                    Escribiendo...
                  </div>
                )}
              </div>

              <div className="flex gap-2">
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
                  placeholder="Mensaje..."
                  className="flex-1 h-10 rounded-2xl bg-black/60 border border-white/10 px-4 outline-none text-sm"
                />

                <button
                  onClick={sendMessage}
                  className="px-4 rounded-2xl bg-white text-black text-sm font-medium"
                >
                  Enviar
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:grid h-full min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_320px] gap-2 p-2">
          <div className="relative min-w-0 h-full rounded-3xl overflow-hidden border border-white/10 bg-black">
            <video
              ref={localVideoDesktop}
              autoPlay
              muted
              playsInline
              controls={false}
              className="w-full h-full object-cover"
            />

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs">
              Tú
            </div>
          </div>

          <div className="relative min-w-0 h-full rounded-3xl overflow-hidden border border-white/10 bg-black">
          <video
  ref={remoteVideoDesktop}
  autoPlay
  playsInline
  muted={false}
  controls={false}
  disablePictureInPicture
  controlsList="nodownload nofullscreen noremoteplayback"
  className="w-full h-full object-cover"
/>

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs">
              {partnerLabel}
            </div>
          </div>

          <div className="bg-white/[0.03] border border-white/10 rounded-3xl flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {messages.map((msg, index) => (
                <div
                  key={`${msg.text}-${index}`}
                  className={`text-sm px-3 py-2 rounded-2xl max-w-[85%] ${
                    msg.mine
                      ? 'ml-auto bg-white text-black'
                      : 'bg-white/10 text-white'
                  }`}
                >
                  {msg.text}
                </div>
              ))}

              {typing && (
                <div className="text-xs text-white/50">
                  Escribiendo...
                </div>
              )}
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
                placeholder="Mensaje..."
                className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none"
              />

              <button
                onClick={sendMessage}
                className="px-5 rounded-2xl bg-white text-black"
              >
                Enviar
              </button>
            </div>

            <div className="p-3 border-t border-white/10 flex gap-2 flex-wrap">
              <button
                onClick={toggleMic}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/10"
              >
                {micEnabled ? 'Silenciar' : 'Activar mic'}
              </button>

              <button
                onClick={toggleCamera}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/10"
              >
                {cameraEnabled ? 'Apagar cámara' : 'Encender cámara'}
              </button>

              <button
                onClick={next}
                className="px-4 py-2 rounded-full bg-white text-black font-semibold"
              >
                Siguiente
              </button>

              <button
                onClick={reportUser}
                className="px-4 py-2 rounded-full bg-red-500/20 border border-red-500/30 text-red-300"
              >
                Reportar
              </button>

              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 rounded-full bg-white/10 border border-white/10"
                >
                  Volver
                </button>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}