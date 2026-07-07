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

  email?: string | null;
  guestId?: string | null;
  isGuest?: boolean;
  region?: string;
  city?: string;

  onBack?: () => void;
};

type Message = {
  text: string;
  mine: boolean;
};

type PartnerInfo = {
  email?: string | null;
  guestId?: string | null;
  gender?: string | null;
  country?: string | null;
  flag?: string | null;
  region?: string | null;
  city?: string | null;
};

export default function VideoChat({
  gender,
  country,

  region,
  city,

  cameraMode,
  email,
  guestId,
  isGuest,
  onBack,
}: Props) {

  const hasTrackedConnection = useRef(false);
  const isManualNext = useRef(false);
const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const localVideoMobile = useRef<HTMLVideoElement>(null);
  const localVideoDesktop = useRef<HTMLVideoElement>(null);
  const remoteVideoMobile = useRef<HTMLVideoElement>(null);
  const remoteVideoDesktop = useRef<HTMLVideoElement>(null);

  const socketRef = useRef<ReturnType<typeof io> | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const matchSound = useRef<HTMLAudioElement | null>(null);
  const messageSound = useRef<HTMLAudioElement | null>(null);

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteStreamTimeout = useRef<ReturnType<typeof setInterval> | null>(null);
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastRemoteTrackTime = useRef(0);

  const [online, setOnline] = useState(0);
  const [connecting, setConnecting] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const [connected, setConnected] = useState(false);
  const [remoteReady, setRemoteReady] = useState(false);

  const [connectionQuality, setConnectionQuality] =
    useState<'excellent' | 'medium' | 'bad'>('excellent');

  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [typing, setTyping] = useState(false);
  const [reaction, setReaction] = useState('');

  const [micEnabled, setMicEnabled] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);

  const [partnerInfo, setPartnerInfo] = useState<PartnerInfo | null>(null);

  async function loadIceServers(socketUrl: string): Promise<RTCIceServer[]> {
    try {
      const response = await fetch(`${socketUrl.replace(/\/$/, '')}/ice-servers`);

      if (!response.ok) throw new Error('ICE configuration unavailable');

      const data = (await response.json()) as { iceServers?: RTCIceServer[] };
      return data.iceServers?.length
        ? data.iceServers
        : [{ urls: 'stun:global.stun.twilio.com:3478' }];
    } catch {
      return [{ urls: 'stun:global.stun.twilio.com:3478' }];
    }
  }

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
      [localVideoMobile.current, localVideoDesktop.current].forEach(
        (video) => {
          if (video) {
            video.srcObject = stream;
            video.play().catch(console.error);
          }
        }
      );
    };

    const attachRemoteStream = (stream: MediaStream) => {
      [remoteVideoMobile.current, remoteVideoDesktop.current].forEach(
        (video) => {
          if (video) {
            video.srcObject = stream;
            video.play().catch(console.error);
          }
        }
      );
    };

    const start = async () => {
      const banned = await checkBan();
      if (banned) return;

      matchSound.current = new Audio('/sounds/match.mp3');
      messageSound.current = new Audio('/sounds/message.mp3');

      const socketUrl =
        process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const socket = io(socketUrl, {
        transports: ['websocket'],
        auth: {
          accessToken: session?.access_token || null,
        },
      });

      socketRef.current = socket;

      socket.on('online-count', (count: number) => {
        setOnline(count);
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

      socket.on('reaction', ({ emoji }) => {
        setReaction(emoji);

        setTimeout(() => {
          setReaction('');
        }, 1800);
      });

      socket.on('typing', () => {
        setTyping(true);
      
        if (typingTimeout.current) clearTimeout(typingTimeout.current);
      
        typingTimeout.current = setTimeout(() => {
          setTyping(false);
        }, 1500);
      });
      
      socket.on('rate-limited', (data) => {
        alert(data.reason);
      });
      
      socket.on('next-blocked', (data) => {
        alert(data.reason);
      });

      socket.on('banned', () => {
        alert('Tu cuenta ha sido suspendida de ChatMia.');
        window.location.href = '/auth';
      });

      socket.on('partner-left', async () => {
        hasTrackedConnection.current = false;
        setPartnerInfo(null);
        setRemoteReady(false);

        cleanupRemote();

        setTyping(false);
        setMessages([]);
        setConnected(false);
        setConnecting(true);

        socket.emit('find-partner', {
        gender,
        country,
        guestId,
        isGuest,
        region,
        city,
      });
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: cameraMode,
        },
        audio: true,
      });

      streamRef.current = stream;
      attachLocalStream(stream);

      socket.emit('find-partner', {
        gender,
        country,
        region,
        city,
        guestId,
        isGuest,
      });

      

      socket.on('matched', async ({ partnerId, initiator, partner }) => {
        setPartnerInfo(partner || null);
        setRemoteReady(false);
        setConnecting(false);

        peerRef.current?.destroy();

        const iceServers = await loadIceServers(socketUrl);

        const peer = new Peer({
          initiator,
          trickle: true,
          stream,
          config: {
            iceServers,
          },
        });

        peer.on('signal', (signal) => {
          socket.emit('signal', {
            to: partnerId,
            signal,
          });
        });

        peer.on('iceStateChange', (state) => {
          console.log('ICE STATE:', state);
        });
        
        peer.on('connect', () => {
          console.log('PEER CONNECTED');
        });
        
        peer.on('error', (error) => {
          console.log('PEER ERROR:', error);
        });
        
        peer.on('close', () => {
          console.log('PEER CLOSED');
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

          if (statsInterval.current) clearInterval(statsInterval.current);

          statsInterval.current = setInterval(async () => {
            try {
              const pc = (peer as unknown as { _pc?: RTCPeerConnection })._pc;
              if (!pc) return;

              const stats = await pc.getStats();
              let rtt = 0;

              stats.forEach((report) => {
                if (
                  report.type === 'candidate-pair' &&
                  report.state === 'succeeded'
                ) {
                  rtt = report.currentRoundTripTime || 0;
                }
              });

              if (rtt < 0.15) {
                setConnectionQuality('excellent');
              } else if (rtt < 0.35) {
                setConnectionQuality('medium');
              } else {
                setConnectionQuality('bad');
              }
            } catch (error) {
              console.error(error);
            }
          }, 5000);
        });

        peer.on('stream', (remoteStream) => {
          setRemoteReady(true);
          attachRemoteStream(remoteStream);

          lastRemoteTrackTime.current = Date.now();

          remoteStream.getTracks().forEach((track) => {
            track.onunmute = () => {
              lastRemoteTrackTime.current = Date.now();
            };
          });

          setConnecting(false);
          setConnected(true);
        });

        peer.on('error', (error) => {
          console.log('PEER ERROR:', error);
          setConnected(false);
        });
        
        peer.on('close', () => {
          console.log('PEER CLOSED');
          setConnected(false);
        });
        

        if (remoteStreamTimeout.current) clearInterval(remoteStreamTimeout.current);

       /* remoteStreamTimeout.current = setInterval(() => {
          const secondsWithoutMedia =
            (Date.now() - lastRemoteTrackTime.current) / 1000;

          if (secondsWithoutMedia > 15) {
            clearInterval(remoteStreamTimeout.current);
            next();
          }
        }, 5000);*/

        peerRef.current = peer;
      });
    };

    start().catch(() => {
      alert('Debes permitir cámara y micrófono para usar ChatMia.');
      setConnecting(false);
      setConnected(false);
    });

    return () => {
      if (statsInterval.current) clearInterval(statsInterval.current);
      if (remoteStreamTimeout.current) clearInterval(remoteStreamTimeout.current);
      if (typingTimeout.current) clearTimeout(typingTimeout.current);
      cleanupAll();
      socketRef.current?.disconnect();
    };
  }, []);

  function cleanupRemote() {
    peerRef.current?.destroy();
    peerRef.current = null;

    [remoteVideoMobile.current, remoteVideoDesktop.current].forEach(
      (video) => {
        if (video) {
          video.srcObject = null;
        }
      }
    );

    if (statsInterval.current) clearInterval(statsInterval.current);
    if (remoteStreamTimeout.current) clearInterval(remoteStreamTimeout.current);
  }

  function cleanupAll() {
    cleanupRemote();

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;
  }

  const next = async () => {
    isManualNext.current = true;
    if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
    setRemoteReady(false);
    hasTrackedConnection.current = false;
    setPartnerInfo(null);
    setTransitioning(true);

    trackEvent('next_clicked');

    cleanupRemote();

    setTyping(false);
    setMessages([]);
    setConnected(false);

    setTimeout(() => {
      setConnecting(true);

      socketRef.current?.emit('next');

      setTimeout(() => {
        socketRef.current?.emit('find-partner', {
          gender,
          country,
          region,
          city, 
          guestId,
          isGuest,
        });

        setTransitioning(false);
      }, 400);
    }, 250);
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
      const currentTrack = streamRef.current?.getVideoTracks()[0];

      const currentFacingMode = currentTrack?.getSettings()?.facingMode;

      const newMode =
        currentFacingMode === 'environment' ? 'user' : 'environment';

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: newMode,
        },
        audio: true,
      });

      const newVideoTrack = newStream.getVideoTracks()[0];
      const oldVideoTrack = streamRef.current?.getVideoTracks()[0];

      if (peerRef.current && oldVideoTrack && newVideoTrack) {
        peerRef.current.replaceTrack(
          oldVideoTrack,
          newVideoTrack,
          streamRef.current as MediaStream
        );
      }

      oldVideoTrack?.stop();

      if (streamRef.current && oldVideoTrack) {
        streamRef.current.removeTrack(oldVideoTrack);
        streamRef.current.addTrack(newVideoTrack);
      }

      [localVideoMobile.current, localVideoDesktop.current].forEach(
        (video) => {
          if (video) {
            video.srcObject = streamRef.current;
            video.play().catch(console.error);
          }
        }
      );
    } catch (error) {
      console.error(error);
    }
  };

  const reportUser = async () => {
    const reason = prompt('¿Por qué deseas reportar este usuario?');

    if (!reason) return;

    const { data: { user },
    } = await supabase.auth.getUser();

    
    await supabase.from('reports').insert({
      reporter_email: user?.email || email || 'guest',
      reported_email: partnerInfo?.email || null,
      reported_guest_id: partnerInfo?.guestId || null,
      reason,
      status: 'pending',
    });



    trackEvent('user_reported', {
      reason,
    });

    setTimeout(() => {
      next();
    }, 300);
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

  const getGenderIcon = (value?: string) => {
    switch (value) {
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

  const sendReaction = (emoji: string) => {
    setReaction(emoji);

    socketRef.current?.emit('reaction', {
      emoji,
    });

    setTimeout(() => {
      setReaction('');
    }, 1800);
  };

  const partnerLabel = (
    <>
      {partnerInfo?.flag || '🌎'}{' '}
      {getGenderIcon(partnerInfo?.gender || undefined)}{' '}
      {partnerInfo?.country || 'Sin país'}
      {partnerInfo?.region ? ` · ${partnerInfo.region}` : ''}
      {partnerInfo?.city ? ` · ${partnerInfo.city}` : ''}
    </>
  );

  const reactionOverlay = reaction ? (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
      <div className="text-7xl animate-bounce drop-shadow-2xl">
        {reaction}
      </div>
    </div>
  ) : null;

  const remoteLoading = !remoteReady ? (
    <div className="absolute inset-0 flex items-center justify-center bg-black/70 z-10">
      <div className="text-sm text-white/60 animate-pulse">
        Conectando video...
      </div>
    </div>
  ) : null;

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

        {transitioning && (
          <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full border-4 border-white/20 border-t-white animate-spin mx-auto" />

              <div className="text-white/70 text-sm tracking-wide">
                Conectando siguiente persona...
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      <header className="h-14 shrink-0 border-b border-white/10 bg-black flex items-center justify-between px-4">
        <div className="font-semibold text-sm md:text-base">ChatMia</div>

        <div className="flex items-center gap-2 text-xs">
          <span>{country.flag}</span>

          <span className="text-white/60">{online} online</span>

          <span
            className={`px-2 py-1 rounded-full text-[10px] ${
              connectionQuality === 'excellent'
                ? 'bg-green-500/20 text-green-300'
                : connectionQuality === 'medium'
                ? 'bg-yellow-500/20 text-yellow-300'
                : 'bg-red-500/20 text-red-300'
            }`}
          >
            {connectionQuality === 'excellent'
              ? '🟢 Excelente'
              : connectionQuality === 'medium'
              ? '🟡 Media'
              : '🔴 Mala'}
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
            {remoteLoading}
            {reactionOverlay}

            <video
              ref={remoteVideoMobile}
              autoPlay
              playsInline
              muted={false}
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full h-full object-cover transition-opacity duration-300"
            />
            <div className="absolute top-3 right-3 flex gap-2 z-30">
            <button
              onClick={reportUser}
              className="w-10 h-10 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center"
            >
              🚩
            </button>

            
          </div>

            <div className="absolute bottom-3 left-3 bg-black/60 px-3 py-1 rounded-full text-xs backdrop-blur-md">
              {partnerLabel}
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

            <div className="absolute top-3 right-3 flex gap-2 z-30">
                <button
                  onClick={toggleMic}
                  className="w-10 h-10 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-sm"
                >
                  {micEnabled ? '🎤' : '🔇'}
                </button>

                <button
                  onClick={toggleCamera}
                  className="w-10 h-10 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-sm"
                >
                  {cameraEnabled ? '📷' : '🚫'}
                </button>

                <button
                  onClick={switchCamera}
                  className="w-10 h-10 rounded-full bg-black/60 border border-white/10 backdrop-blur-md flex items-center justify-center text-sm"
                >
                  🔄
                </button>
                <button
              onClick={next}
              className="w-12 h-12 rounded-full bg-white text-black font-bold backdrop-blur-md flex items-center justify-center"
            >
              ▶
            </button>
              </div>

            <div className="absolute bottom-3 left-3 right-3 space-y-2">
              <div className="max-h-24 overflow-y-auto space-y-1">
              {messages.slice(-3).map((msg, index) => (
                  <div
                    key={`${msg.text}-${index}`}
                    className={`text-xs px-3 py-2 rounded-2xl max-w-[65%] backdrop-blur-md border ${
                      msg.mine
                        ? 'ml-auto bg-pink-500/25 border-pink-300/20 text-white'
                        : 'bg-black/35 border-white/10 text-white'
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
            {remoteLoading}
            {reactionOverlay}

            <video
              ref={remoteVideoDesktop}
              autoPlay
              playsInline
              muted={false}
              controls={false}
              disablePictureInPicture
              controlsList="nodownload nofullscreen noremoteplayback"
              className="w-full h-full object-cover transition-opacity duration-300"
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
                <div className="text-xs text-white/50">Escribiendo...</div>
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

            <div className="flex gap-2 px-3 pb-3">
              {['❤️', '🔥', '😂', '👋', '😍'].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => sendReaction(emoji)}
                  className="w-10 h-10 rounded-full bg-white/10 border border-white/10 text-lg"
                >
                  {emoji}
                </button>
              ))}
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
                onClick={switchCamera}
                className="px-4 py-2 rounded-full bg-white/10 border border-white/10"
              >
                Girar cámara
              </button>

              <button
                onClick={next}
                className="px-4 py-2 rounded-full bg-white text-black font-semibold"
              >
                Siguiente
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
