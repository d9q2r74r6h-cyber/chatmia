'use client';

import {
  signIn,
  signOut,
  useSession,
} from 'next-auth/react';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b border-zinc-800 bg-black text-white">
      <div className="
        max-w-6xl
        mx-auto
        px-6
        h-16
        flex
        items-center
        justify-between
      ">
        <h1 className="font-bold text-xl">
          Mi App
        </h1>

        {session ? (
          <button
            onClick={() => signOut()}
            className="
              bg-red-500
              px-4
              py-2
              rounded-lg
              hover:opacity-80
              transition
            "
          >
            Logout
          </button>
        ) : (
          <button
            onClick={() => signIn('github')}
            className="
              bg-white
              text-black
              px-4
              py-2
              rounded-lg
              hover:opacity-80
              transition
            "
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}