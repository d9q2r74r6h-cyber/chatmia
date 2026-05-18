'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

type Report = {
  id: number;
  created_at: string;
  reporter_email: string;
  reason: string;
};

type BannedUser = {
  id: number;
  created_at: string;
  email: string;
  reason: string;
  banned_until: string | null;
};

type Event = {
  id: number;
  created_at: string;
  user_email: string;
  event_name: string;
  metadata: any;
};

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAdmin = async () => {
        const {
          data: { user },
        } = await supabase.auth.getUser();
      
        const allowedAdmins = [
          'TU_EMAIL_REAL'
        ];
      
        if (
          !user?.email ||
          !allowedAdmins.includes(user.email)
        ) {
          router.push('/');
          return;
        }
      
        loadData();
      };
      
      checkAdmin();

    
  }, []);

  const loadData = async () => {
    setLoading(true);

    const reportsResult = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    const bannedResult = await supabase
      .from('banned_users')
      .select('*')
      .order('created_at', { ascending: false });

    const eventsResult = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (reportsResult.data) {
      setReports(reportsResult.data);
    }

    if (bannedResult.data) {
      setBannedUsers(bannedResult.data);
    }

    if (eventsResult.data) {
      setEvents(eventsResult.data);
    }

    setLoading(false);
  };

  const banEmail = async (email: string, reason: string) => {
    if (!email) return;

    const confirmBan = confirm(`¿Banear a ${email}?`);

    if (!confirmBan) return;

    await supabase.from('banned_users').upsert({
      email,
      reason: reason || 'Reporte de usuario',
      banned_until: null,
    });

    alert('Usuario baneado.');
    loadData();
  };

  const unbanEmail = async (email: string) => {
    const confirmUnban = confirm(`¿Quitar ban a ${email}?`);

    if (!confirmUnban) return;

    await supabase
      .from('banned_users')
      .delete()
      .eq('email', email);

    alert('Usuario desbloqueado.');
    loadData();
  };

  const countEvent = (name: string) => {
    return events.filter((event) => event.event_name === name).length;
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-6xl mx-auto space-y-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            Panel de Moderación
          </h1>

          <button
            onClick={loadData}
            className="px-4 py-2 rounded-xl bg-white text-black font-medium"
          >
            Recargar
          </button>
        </div>

        {loading ? (
          <div className="text-white/60">
            Cargando datos...
          </div>
        ) : (
          <>
            <section>
              <h2 className="text-xl font-semibold mb-4">
                Métricas
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Reportes
                  </div>

                  <div className="text-3xl font-bold">
                    {reports.length}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Baneados
                  </div>

                  <div className="text-3xl font-bold">
                    {bannedUsers.length}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Mensajes
                  </div>

                  <div className="text-3xl font-bold">
                    {countEvent('message_sent')}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Skips
                  </div>

                  <div className="text-3xl font-bold">
                    {countEvent('next_clicked')}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Conexiones
                  </div>

                  <div className="text-3xl font-bold">
                    {countEvent('chat_connected')}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Usuarios reportados
                  </div>

                  <div className="text-3xl font-bold">
                    {countEvent('user_reported')}
                  </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-sm text-white/40">
                    Eventos totales
                  </div>

                  <div className="text-3xl font-bold">
                    {events.length}
                  </div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">
                Usuarios baneados
              </h2>

              {bannedUsers.length === 0 ? (
                <div className="text-white/50">
                  No hay usuarios baneados.
                </div>
              ) : (
                <div className="space-y-3">
                  {bannedUsers.map((user) => (
                    <div
                      key={user.id}
                      className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3"
                    >
                      <div>
                        <div className="font-semibold text-red-300">
                          {user.email}
                        </div>

                        <div className="text-sm text-white/50">
                          {user.reason}
                        </div>

                        <div className="text-xs text-white/30 mt-1">
                          {new Date(user.created_at).toLocaleString()}
                        </div>
                      </div>

                      <button
                        onClick={() => unbanEmail(user.email)}
                        className="px-4 py-2 rounded-xl bg-white text-black font-medium"
                      >
                        Quitar ban
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">
                Reportes
              </h2>

              {reports.length === 0 ? (
                <div className="text-white/50">
                  No hay reportes todavía.
                </div>
              ) : (
                <div className="space-y-4">
                  {reports.map((report) => (
                    <div
                      key={report.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-5"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <div className="font-semibold">
                            {report.reporter_email}
                          </div>

                          <div className="text-sm text-white/40">
                            {new Date(report.created_at).toLocaleString()}
                          </div>
                        </div>

                        <button
                          onClick={() =>
                            banEmail(
                              report.reporter_email,
                              report.reason
                            )
                          }
                          className="px-4 py-2 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 font-medium"
                        >
                          Banear email
                        </button>
                      </div>

                      <div className="mt-4 text-white/80">
                        {report.reason}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-4">
                Últimos eventos
              </h2>

              {events.length === 0 ? (
                <div className="text-white/50">
                  No hay eventos todavía.
                </div>
              ) : (
                <div className="space-y-3">
                  {events.slice(0, 30).map((event) => (
                    <div
                      key={event.id}
                      className="bg-white/5 border border-white/10 rounded-2xl p-4"
                    >
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {event.event_name}
                          </div>

                          <div className="text-sm text-white/40">
                            {event.user_email}
                          </div>
                        </div>

                        <div className="text-xs text-white/30">
                          {new Date(event.created_at).toLocaleString()}
                        </div>
                      </div>

                      {event.metadata && (
                        <pre className="mt-3 text-xs text-white/50 bg-black/40 rounded-xl p-3 overflow-x-auto">
                          {JSON.stringify(event.metadata, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}