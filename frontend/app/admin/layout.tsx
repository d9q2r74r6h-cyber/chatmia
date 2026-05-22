'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push('/auth');
      return;
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      router.push('/');
      return;
    }

    setLoading(false);
  }

  const links = [
    {
      href: '/admin/dashboard',
      label: 'Dashboard',
    },
    {
      href: '/admin/users',
      label: 'Users',
    },
    {
      href: '/admin/reports',
      label: 'Reports',
    },
    {
      href: '/admin/messages',
      label: 'Messages',
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        Verificando acceso...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex">
      <aside className="w-64 border-r border-white/10 bg-zinc-950 p-5 hidden md:block">
        <h1 className="text-2xl font-bold mb-8">
          ChatMia Admin
        </h1>

        <nav className="space-y-2">
          {links.map((link) => {
            const active =
              pathname === link.href;

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-4 py-3 rounded-xl transition ${
                  active
                    ? 'bg-pink-600 text-white'
                    : 'bg-white/5 hover:bg-white/10 text-white/70'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <main className="flex-1 min-w-0">
        {children}
      </main>
    </div>
  );
}