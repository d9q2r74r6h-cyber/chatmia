'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [interests, setInterests] = useState('');

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/auth';
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    if (data) {
      setUsername(data.username || '');
      setBio(data.bio || '');
      setCountry(data.country || '');
      setInterests(
        data.interests?.join(', ') || ''
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    const timer = window.setTimeout(loadProfile, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const saveProfile = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email,
        username,
        bio,
        country,
        interests: interests
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean),
      })
      .select();

    console.log('PROFILE SAVE RESULT:', {
      data,
      error,
    });

    if (error) {
      console.error(error);
      alert(error.message);
      return;
    }

    alert('Perfil actualizado.');
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-black text-white flex items-center justify-center">
        Cargando perfil...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-2xl mx-auto bg-white/5 border border-white/10 rounded-3xl p-8">
        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="mb-6 px-4 py-2 rounded-xl bg-white/10 border border-white/10 hover:bg-white/20 transition"
        >
          ← Volver
        </button>

        <h1 className="text-3xl font-bold mb-2">
          Tu perfil
        </h1>

        <p className="text-white/50 mb-8">
          Personaliza tu experiencia en ChatMia.
        </p>

        <div className="space-y-5">
          <div>
            <label className="block text-sm text-white/50 mb-2">
              Username
            </label>

            <input
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
              className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 px-4 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Bio
            </label>

            <textarea
              value={bio}
              onChange={(e) =>
                setBio(e.target.value)
              }
              rows={4}
              className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3 outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-2">
              País
            </label>

            <input
              value={country}
              onChange={(e) =>
                setCountry(e.target.value)
              }
              className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 px-4 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-2">
              Intereses
            </label>

            <input
              value={interests}
              onChange={(e) =>
                setInterests(e.target.value)
              }
              placeholder="música, gaming, anime..."
              className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 px-4 outline-none"
            />
          </div>

          <button
            onClick={saveProfile}
            className="w-full h-12 rounded-2xl bg-white text-black font-semibold"
          >
            Guardar perfil
          </button>
        </div>
      </div>
    </main>
  );
}
