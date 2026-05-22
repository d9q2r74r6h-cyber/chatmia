'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

type UserProfile = {
  id: string;
  email: string;
  role?: string;
  shadow_banned?: boolean;
  created_at?: string;
};

export default function AdminUsersPage() {
  const [email, setEmail] = useState('');
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);

  async function searchUser() {
    setLoading(true);
    setUser(null);

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('email', `%${email}%`)
      .limit(1)
      .maybeSingle();

    if (error) {
      alert('Error buscando usuario');
      console.error(error);
    }

    setUser(data);
    setLoading(false);
  }

  async function shadowBan() {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ shadow_banned: true })
      .eq('id', user.id);

    alert('Usuario enviado a shadowban');
    searchUser();
  }

  async function removeShadowBan() {
    if (!user) return;

    await supabase
      .from('profiles')
      .update({ shadow_banned: false })
      .eq('id', user.id);

    alert('Shadowban removido');
    searchUser();
  }

  async function banUser() {
    if (!user) return;

    await supabase.from('banned_users').insert({
      user_id: user.id,
      email: user.email,
      reason: 'Admin ban',
      is_permanent: true,
    });

    alert('Usuario baneado');
  }

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Users Moderation
      </h1>

      <div className="flex gap-3 mb-8">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Buscar por email..."
          className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 outline-none w-full max-w-md"
        />

        <button
          onClick={searchUser}
          className="bg-pink-600 hover:bg-pink-700 px-5 py-3 rounded-xl font-semibold"
        >
          Buscar
        </button>
      </div>

      {loading && <p>Buscando...</p>}

      {user && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-2xl">
          <p className="text-zinc-400 text-sm">User ID</p>
          <p className="font-mono text-xs mb-4">{user.id}</p>

          <p className="text-zinc-400 text-sm">Email</p>
          <p className="mb-4">{user.email}</p>

          <p className="text-zinc-400 text-sm">Role</p>
          <p className="mb-4">{user.role || 'user'}</p>

          <p className="text-zinc-400 text-sm">Shadowban</p>
          <p className="mb-6">
            {user.shadow_banned ? 'Activo' : 'No activo'}
          </p>

          <div className="flex flex-wrap gap-3">
            <button
              onClick={banUser}
              className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl"
            >
              Ban permanente
            </button>

            <button
              onClick={shadowBan}
              className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-xl"
            >
              Shadowban
            </button>

            <button
              onClick={removeShadowBan}
              className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl"
            >
              Quitar shadowban
            </button>
          </div>
        </div>
      )}
    </main>
  );
}