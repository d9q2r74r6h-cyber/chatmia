'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    if (password.length < 6) {
      alert('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.updateUser({
      password,
    });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert('Contraseña actualizada correctamente.');

    window.location.href = '/auth';
  };

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white/5 border border-white/10 rounded-3xl p-8">
        <h1 className="text-3xl font-bold mb-2">
          Nueva contraseña
        </h1>

        <p className="text-white/50 mb-6">
          Ingresa una nueva contraseña para tu cuenta.
        </p>

        <input
          type="password"
          placeholder="Nueva contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full h-12 rounded-2xl bg-black/40 border border-white/10 px-4 outline-none mb-4"
        />

        <button
          onClick={updatePassword}
          disabled={loading}
          className="w-full h-12 rounded-2xl bg-white text-black font-semibold"
        >
          {loading
            ? 'Actualizando...'
            : 'Actualizar contraseña'}
        </button>
      </div>
    </main>
  );
}