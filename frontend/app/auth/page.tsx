'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loading, setLoading] = useState(false);

  const submit = async () => {
    try {
      setLoading(true);

      if (isLogin) {
        const { data, error } =
          await supabase.auth.signInWithPassword({
            email,
            password,
          });

        if (error) {
          alert(error.message);
          return;
        }

        localStorage.setItem(
          'chatmia_user',
          JSON.stringify(data.user)
        );

        window.location.href = '/';
      } else {
        const { data, error } =
          await supabase.auth.signUp({
            email,
            password,
          }
        
        );

        if (error) {
          alert(error.message);
          return;
        }

        if (data?.user) {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email,
            username: email.split('@')[0],
            avatar_url: '',
            bio: '',
            interests: [],
            country: '',
          });
        }

        localStorage.setItem(
          'chatmia_user',
          JSON.stringify(data.user)
        );

        alert(
          'Cuenta creada correctamente'
        );

        window.location.href = '/';
      }
    } catch (error) {
      alert('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-black text-white flex items-center justify-center px-6 py-8 overflow-y-auto">
      <div className="w-full max-w-md bg-white/[0.03] border border-white/10 rounded-3xl p-8 backdrop-blur-xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold">
            ChatMia
          </h1>

          <p className="text-white/40 mt-3">
            {isLogin
              ? 'Inicia sesión para continuar'
              : 'Crea tu cuenta'}
          </p>
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder="Correo electrónico"
            value={email}
            onChange={(e) =>
              setEmail(e.target.value)
            }
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none focus:border-white/30 transition"
          />

          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
            className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 px-4 outline-none focus:border-white/30 transition"
          />

          <button
            onClick={submit}
            disabled={loading}
            className="w-full h-14 rounded-2xl bg-white text-black font-semibold hover:scale-[1.02] active:scale-[0.98] transition"
          >
            {loading
              ? 'Cargando...'
              : isLogin
              ? 'Ingresar'
              : 'Crear cuenta'}
          </button>
        </div>

        <div className="mt-6 text-center">
        <button
          onClick={() => setIsLogin(!isLogin)}
          className="text-base font-semibold text-pink-400 hover:text-pink-300 underline underline-offset-4 transition"
        >
          {isLogin
            ? 'Crear cuenta nueva'
            : 'Volver a iniciar sesión'}
        </button>
      </div>
        <button
  onClick={async () => {
    if (!email) {
      alert('Ingresa tu correo primero.');
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://chatmia.org/reset-password',
    });

    if (error) {
      alert(error.message);
      return;
    }

    alert('Te enviamos un correo para recuperar tu contraseña.');
  }}
  className="mt-4 text-sm text-white/40 hover:text-white transition w-full"
>
  Olvidé mi contraseña
</button>
      </div>
    </main>
  );
}
