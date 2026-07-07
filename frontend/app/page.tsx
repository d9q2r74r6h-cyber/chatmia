'use client';

import { useEffect, useRef, useState } from 'react';
import VideoChat from '@/components/VideoChat';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';

const countries = [
  { code: 'WW', name: 'Worldwide', flag: '🌎' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
];

type Profile = {
  username?: string | null;
  role?: string | null;
};

type LocationInfo = {
  countryCode?: string;
  region?: string;
  city?: string;
  source: 'browser' | 'ip';
};

type LocationStatus = 'detecting' | 'browser' | 'ip' | 'manual' | 'fallback';

const fetchJsonWithTimeout = async (
  url: string,
  timeoutMs: number
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      throw new Error(`Location request failed: ${response.status}`);
    }

    return response.json();
  } finally {
    window.clearTimeout(timeout);
  }
};

const readBrowserCoordinates = (): Promise<GeolocationCoordinates | null> => {
  if (!navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      () => resolve(null),
      {
        enableHighAccuracy: false,
        maximumAge: 10 * 60 * 1000,
        timeout: 5000,
      }
    );
  });
};

const detectBrowserLocation = async (): Promise<LocationInfo | null> => {
  const coords = await readBrowserCoordinates();

  if (!coords) return null;

  const params = new URLSearchParams({
    format: 'jsonv2',
    lat: String(coords.latitude),
    lon: String(coords.longitude),
    'accept-language': 'es',
  });

  const data = (await fetchJsonWithTimeout(
    `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
    5000
  )) as {
    address?: {
      country_code?: string;
      state?: string;
      region?: string;
      city?: string;
      town?: string;
      village?: string;
      municipality?: string;
      county?: string;
    };
  };

  const address = data.address;

  if (!address) return null;

  return {
    countryCode: address.country_code?.toUpperCase(),
    region: address.state || address.region || '',
    city:
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      '',
    source: 'browser',
  };
};

const detectIpLocation = async (): Promise<LocationInfo | null> => {
  const data = (await fetchJsonWithTimeout(
    'https://ipapi.co/json/',
    3500
  )) as {
    country_code?: string;
    region?: string;
    city?: string;
  };

  return {
    countryCode: data.country_code,
    region: data.region || '',
    city: data.city || '',
    source: 'ip',
  };
};

export default function Page() {
  const [gender, setGender] = useState<string | null>(null);
  const [cameraMode, setCameraMode] =
    useState<'user' | 'environment'>('user');

    const [country, setCountry] = useState({
      code: 'WW',
      name: 'Worldwide',
      flag: '🌎',
    });
    
    const [location, setLocation] = useState({
      region: '',
      city: '',
    });

    const [locationStatus, setLocationStatus] =
      useState<LocationStatus>('detecting');

    const ubicacionLista = !!country.name;    
      
    
  

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [entering, setEntering] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const loadLocation = async () => {
      const applyDetectedLocation = (detectedLocation: LocationInfo) => {
        console.log('LOCATION', {
          source: detectedLocation.source,
          city: detectedLocation.city,
          region: detectedLocation.region,
          countryCode: detectedLocation.countryCode,
        });

        setLocation({
          region: detectedLocation.region || '',
          city: detectedLocation.city || '',
        });
        setLocationStatus(detectedLocation.source);

        const detected = countries.find(
          (item) => item.code === detectedLocation.countryCode
        );

        if (detected) {
          setCountry(detected);
        }
      };

      try {
        const browserLocation = await detectBrowserLocation();

        if (browserLocation) {
          applyDetectedLocation(browserLocation);
          return;
        }
      } catch (err) {
        console.error('Browser location failed', err);
      }

      try {
        const ipLocation = await detectIpLocation();

        if (ipLocation) {
          applyDetectedLocation(ipLocation);
        }
      } catch (err) {
        console.error('IP location failed', err);
        setLocationStatus('fallback');
      }
    };
  
    loadLocation();
  }, []);

  useEffect(() => {
    
    if (checkingAuth || gender) return;

    const startPreview = async () => {
      try {
        previewStreamRef.current
          ?.getTracks()
          .forEach((track) => track.stop());

        const stream =
          await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: cameraMode,
            },
            audio: true,
          });

        previewStreamRef.current = stream;

        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(console.error);
        }
      } catch (error) {
        console.error(error);
      }
    };

      



    startPreview();

    return () => {
      previewStreamRef.current
        ?.getTracks()
        .forEach((track) => track.stop());
    };
  }, [cameraMode, checkingAuth, gender]);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCheckingAuth(false);
      return;
    }

    const { data: bannedUser } = await supabase
      .from('banned_users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (bannedUser) {
      alert('Tu cuenta ha sido suspendida de ChatMia.');
      await supabase.auth.signOut();
      window.location.href = '/auth';
      return;
    }

    setUser(user);

    await supabase
      .from('profiles')
      .update({
        last_visit_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (profileData) {
      setProfile(profileData);
    }
    setCheckingAuth(false);
  };

  useEffect(() => {
    const timer = window.setTimeout(checkUser, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth';
  };

  function getGuestId() {
    let guestId = localStorage.getItem('chatmia_guest_id');
  
    if (!guestId) {
      guestId = crypto.randomUUID();
      localStorage.setItem('chatmia_guest_id', guestId);
    }
  
    return guestId;
  }

  const updateCountry = (countryCode: string) => {
    const selectedCountry =
      countries.find((item) => item.code === countryCode) || countries[0];

    setCountry(selectedCountry);
    setLocationStatus('manual');
  };

  const updateLocation = (field: 'region' | 'city', value: string) => {
    setLocation((currentLocation) => ({
      ...currentLocation,
      [field]: value,
    }));
    setLocationStatus('manual');
  };

  
  const enterChat = (selectedGender: string) => {
    console.log('ENTRANDO AL CHAT CON:', {
      country,
      region: location.region,
      city: location.city,
    });
  
    setEntering(true);
  
    previewStreamRef.current
      ?.getTracks()
      .forEach((track) => track.stop());
  
    setTimeout(() => {
      setGender(selectedGender);
      setEntering(false);
    }, 350);
  };

  if (checkingAuth) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-pulse text-white/60">
          Cargando ChatMia...
        </div>
      </main>
    );
  }

  console.log('DATOS ANTES DE VIDEOCHAT', {
    country,
    region: location.region,
    city: location.city,
  });

  if (gender) {
    return (
      <VideoChat
        gender={gender}
        country={country}
        region={location.region}
        city={location.city}
        cameraMode={cameraMode}
        email={user?.email || null}
        guestId={!user ? getGuestId() : null}
        isGuest={!user}
        onBack={() => setGender(null)}
        
      />
    );
  }

  if (entering) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center overflow-hidden">
        <div className="relative w-full h-full">
          <video
            ref={previewVideoRef}
            autoPlay
            muted
            playsInline
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-md opacity-40"
          />

          <div className="absolute inset-0 bg-black/70 backdrop-blur-xl" />

          <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
            <div className="w-20 h-20 rounded-full border-4 border-white/20 border-t-white animate-spin mb-6" />

            <div className="text-white text-2xl font-semibold">
              Entrando a ChatMia
            </div>

            <div className="text-white/50 text-sm mt-2">
              Preparando conexion segura...
            </div>
          </div>
        </div>
      </main>
    );
  }




  return (
    <main className="min-h-screen bg-[#070709] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="fixed top-4 right-4 z-50 flex items-center gap-3">
        <div className="hidden md:block bg-white/5 border border-white/10 rounded-2xl px-4 py-2 backdrop-blur-xl max-w-xs overflow-hidden">
          <div className="text-xs text-white/40">
            Conectado como
          </div>

          <div className="text-sm font-medium truncate">
          {profile?.username || user?.email || 'Invitado'}
          </div>
        </div>

        {user && (
              <button   
                onClick={() => {
                  window.location.href = '/profile';
                  
                }}
                className="h-11 px-5 rounded-2xl bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/20 transition"
              >
                Perfil
              </button>
            )}
      
        {profile?.role === 'admin' && (
  <Link
    href="/admin/dashboard"
    className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-semibold transition"
  >
    Admin
  </Link>
)}
        {user && (
  <button
    onClick={logout}
    className="h-11 px-5 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 font-semibold hover:bg-red-500/30 transition"
  >
    Salir
  </button>
)}
          
      </div>

      <div className="w-full max-w-xl">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/10 bg-white/5 mb-6">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm text-white/70">
              Videochat aleatorio en vivo
            </span>
          </div>

          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            ChatMia.org
          </h1>

          <p className="text-white/40 mt-5 text-lg leading-relaxed">
            Entra como invitado y conecta al instante con personas de todo el mundo.
            Crear cuenta es opcional.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-6">
          <div>
            <h2 className="text-lg font-medium">
              Entra como invitado
            </h2>

            <p className="text-sm text-white/40 mt-1">
              No necesitas cuenta para comenzar. Selecciona una preferencia y empieza.
            </p>
          </div>

          <div className="relative rounded-3xl overflow-hidden border border-white/10 bg-black aspect-video">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              controls={false}
              className="w-full h-full object-cover"
            />

            <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />

            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs">
              Vista previa
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-white/60">
              Camara
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setCameraMode('user')}
                className={`h-12 rounded-2xl border ${
                  cameraMode === 'user'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white border-white/10'
                }`}
              >
                🤳 Frontal
              </button>

              <button
                onClick={() => setCameraMode('environment')}
                className={`h-12 rounded-2xl border ${
                  cameraMode === 'environment'
                    ? 'bg-white text-black border-white'
                    : 'bg-white/5 text-white border-white/10'
                }`}
              >
                📷 Trasera
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-white/60">
                Ubicacion
              </div>

              <div className="text-xs text-white/35">
                {locationStatus === 'detecting'
                  ? 'Detectando...'
                  : locationStatus === 'browser'
                  ? 'Detectada por navegador'
                  : locationStatus === 'ip'
                  ? 'Detectada por IP'
                  : locationStatus === 'manual'
                  ? 'Editada manualmente'
                  : 'Modo global'}
              </div>
            </div>

            <select
              value={country.code}
              onChange={(event) => updateCountry(event.target.value)}
              className="w-full h-12 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none text-white"
            >
              {countries.map((item) => (
                <option key={item.code} value={item.code} className="bg-black">
                  {item.flag} {item.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                value={location.region}
                onChange={(event) =>
                  updateLocation('region', event.target.value)
                }
                placeholder="Region opcional"
                className="h-12 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none text-sm"
              />

              <input
                value={location.city}
                onChange={(event) =>
                  updateLocation('city', event.target.value)
                }
                placeholder="Ciudad opcional"
                className="h-12 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              disabled={!ubicacionLista}
              onClick={() => enterChat('male')}
              className={`h-14 rounded-2xl font-medium transition ${
                ubicacionLista
                  ? 'bg-white text-black hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-white/20 text-white/40 cursor-not-allowed'
              }`}
            >
              👨 Hombre
            </button>

            <button
              disabled={!ubicacionLista}
              onClick={() => enterChat('female')}
              className={`h-14 rounded-2xl border transition ${
                ubicacionLista
                  ? 'bg-white/10 border-white/10 hover:bg-white/20'
                  : 'bg-white/5 border-white/5 text-white/40 cursor-not-allowed'
              }`}
            >
              👩 Mujer
            </button>

            <button
              disabled={!ubicacionLista}
              onClick={() => enterChat('couple')}
              className={`h-14 rounded-2xl border transition ${
                ubicacionLista
                  ? 'bg-white/10 border-white/10 hover:bg-white/20'
                  : 'bg-white/5 border-white/5 text-white/40 cursor-not-allowed'
              }`}
            >
              👩‍❤️‍👨 Pareja
            </button>
                      

            {(!location.region || !location.city) && (
              <div className="text-center text-xs text-white/40 pt-2">
                🌎 Puedes entrar ahora. Puedes completar ciudad o region si quieres afinar tu perfil.
              </div>
            )}
          </div>

          <div className="text-center border-t border-white/10 pt-4">
            <span className="text-xs text-white/35">
              Opcional:
            </span>{' '}
            <a
              href="/auth"
              className="text-sm text-white/55 hover:text-pink-300 underline underline-offset-4"
            >
              crear cuenta / iniciar sesion
            </a>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/30">
          Al continuar aceptas nuestras normas de comunidad.
        </div>
      </div>
    </main>
  );
}
