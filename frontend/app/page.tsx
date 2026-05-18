'use client';

import { useEffect, useState } from 'react';
import VideoChat from '@/components/VideoChat';
import { supabase } from '@/lib/supabase';

const countries = [
  { code: 'CL', name: 'Chile', flag: '🇨🇱' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'BR', name: 'Brasil', flag: '🇧🇷' },
  { code: 'MX', name: 'México', flag: '🇲🇽' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴' },
  { code: 'PE', name: 'Perú', flag: '🇵🇪' },
  { code: 'US', name: 'Estados Unidos', flag: '🇺🇸' },
  { code: 'ES', name: 'España', flag: '🇪🇸' },
];

export default function Page() {
  const [gender, setGender] = useState<string | null>(null);
  const [country, setCountry] = useState(countries[0]);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] =
    useState(true);

  useEffect(() => {
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_, session) => {
        setUser(session?.user ?? null);

        if (!session?.user) {
          window.location.href = '/auth';
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const checkUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const { data: bannedUser } = await supabase
      .from('banned_users')
      .select('*')
      .eq('email', user.email)
      .maybeSingle();

    if (bannedUser) {
      alert(
        'Tu cuenta ha sido suspendida de ChatMia.'
      );

      await supabase.auth.signOut();

      window.location.href = '/auth';

      return;
    }

    setUser(user);

    setCheckingAuth(false);
  };

  const logout = async () => {
    await supabase.auth.signOut();

    window.location.href = '/auth';
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

  if (gender) {
    return (
      <VideoChat
        gender={gender}
        country={country}
        onBack={() => setGender(null)}
      />
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
            {user?.email}
          </div>
        </div>

        <button
          onClick={() => {
            window.location.href = '/profile';
          }}
          className="h-11 px-5 rounded-2xl bg-white/10 border border-white/10 text-white font-semibold hover:bg-white/20 transition"
        >
          Perfil
        </button>

        <button
          onClick={logout}
          className="h-11 px-5 rounded-2xl bg-red-500/20 border border-red-500/30 text-red-300 font-semibold hover:bg-red-500/30 transition"
        >
          Salir
        </button>
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
            ChatMia
          </h1>

          <p className="text-white/40 mt-5 text-lg leading-relaxed">
            Conecta instantáneamente con personas de
            todo el mundo mediante videochat en vivo.
            Privado, rápido y diseñado para sentirse
            natural.
          </p>
        </div>

        <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-6 backdrop-blur-xl space-y-6">
          <div>
            <h2 className="text-lg font-medium">
              Elige con quién quieres hablar
            </h2>

            <p className="text-sm text-white/40 mt-1">
              Selecciona una preferencia para comenzar
            </p>
          </div>

          <div>
            <label className="text-sm text-white/60 block mb-2">
              País
            </label>

            <select
              value={country.code}
              onChange={(e) => {
                const selected = countries.find(
                  (item) =>
                    item.code === e.target.value
                );

                if (selected) {
                  setCountry(selected);
                }
              }}
              className="w-full h-14 rounded-2xl bg-white/10 border border-white/10 px-4 outline-none text-white"
            >
              {countries.map((item) => (
                <option
                  key={item.code}
                  value={item.code}
                  className="bg-black text-white"
                >
                  {item.flag} {item.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setGender('male')}
              className="h-14 rounded-2xl bg-white text-black font-medium hover:scale-[1.02] active:scale-[0.98] transition"
            >
              Hombre
            </button>

            <button
              onClick={() => setGender('female')}
              className="h-14 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 transition"
            >
              Mujer
            </button>

            <button
              onClick={() => setGender('couple')}
              className="h-14 rounded-2xl bg-white/10 border border-white/10 hover:bg-white/20 transition"
            >
              Pareja
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-white/30">
          Al continuar aceptas nuestras normas de
          comunidad.
        </div>
      </div>
    </main>
  );
}