'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

import { supabase } from '@/lib/supabase';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    reports: 0,
    flagged: 0,
    bans: 0,
    messages: 0,
  });

  const [realtime, setRealtime] = useState({
    online: 0,
    activeChats: 0,
    waitingNormal: 0,
    waitingShadow: 0,
  });

  const [analytics, setAnalytics] = useState({
    visits: 0,
    matches: 0,
    uniqueUsers: 0,
    countries: 0,
  });

  const [chartData, setChartData] = useState<any[]>([]);
  const [lastVisits, setLastVisits] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const socket = io(
      process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000',
      { transports: ['websocket'] }
    );

    socket.on('admin-stats', (data) => {
      setRealtime({
        online: data.online || 0,
        activeChats: data.activeChats || 0,
        waitingNormal: data.waitingNormal || 0,
        waitingShadow: data.waitingShadow || 0,
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  async function loadDashboard() {
    const [reportsRes, flaggedRes, bansRes, messagesRes, visitsRes] =
      await Promise.all([
        supabase
          .from('reports')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_flagged', true),

        supabase
          .from('banned_users')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true }),

        supabase
          .from('visits')
          .select('*')
          .order('connected_at', { ascending: false })
          .limit(50),
      ]);

    setStats({
      reports: reportsRes.count || 0,
      flagged: flaggedRes.count || 0,
      bans: bansRes.count || 0,
      messages: messagesRes.count || 0,
    });

    const visits = visitsRes.data || [];

    setAnalytics({
      visits: visits.length,
      matches: visits.filter((v) => v.matched).length,
      uniqueUsers: new Set(
        visits.map((v) => v.email || v.socket_id)
      ).size,
      countries: new Set(
        visits.map((v) => v.country).filter(Boolean)
      ).size,
    });

    setLastVisits(visits);

    await loadChartData();
  }

  async function loadChartData() {
    const { data } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(24);

    if (!data) return;

    setChartData(
      data.map((item) => ({
        hour: new Date(item.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
        users: item.online_users,
      }))
    );
  }

  const realtimeCards = [
    { title: 'Online Users', value: realtime.online },
    { title: 'Active Chats', value: realtime.activeChats },
    { title: 'Waiting Users', value: realtime.waitingNormal },
    { title: 'Shadow Queue', value: realtime.waitingShadow },
  ];

  const moderationCards = [
    { title: 'Reports', value: stats.reports },
    { title: 'Flagged Messages', value: stats.flagged },
    { title: 'Banned Users', value: stats.bans },
    { title: 'Messages', value: stats.messages },
  ];

  const analyticsCards = [
    { title: 'Visits Today', value: analytics.visits },
    { title: 'Matches Today', value: analytics.matches },
    { title: 'Unique Users', value: analytics.uniqueUsers },
    { title: 'Countries', value: analytics.countries },
  ];

  return (
    <div className="p-6 md:p-8">
      <h1 className="mb-8 text-4xl font-black">
        Admin Dashboard
      </h1>

      <CardGrid cards={realtimeCards} variant="pink" />
      <CardGrid cards={moderationCards} variant="zinc" />
      <CardGrid cards={analyticsCards} variant="blue" />

      <section className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-6 text-2xl font-semibold">
          Users Activity
        </h2>

        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="hour" />
              <YAxis />
              <Tooltip />

              <Line
                type="monotone"
                dataKey="users"
                stroke="#ec4899"
                strokeWidth={3}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-6 text-2xl font-semibold">
          Last Visits
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-zinc-400">
                <th className="pb-4">Time</th>
                <th className="pb-4">Country</th>
                <th className="pb-4">Gender</th>
                <th className="pb-4">Match</th>
                <th className="pb-4">Email</th>
              </tr>
            </thead>

            <tbody>
              {lastVisits.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="border-t border-zinc-800 py-6 text-center text-zinc-500"
                  >
                    No visits yet.
                  </td>
                </tr>
              )}

              {lastVisits.map((visit) => (
                <tr
                  key={visit.id}
                  className="border-t border-zinc-800"
                >
                  <td className="py-3">
                    {new Date(
                      visit.connected_at
                    ).toLocaleTimeString('es-CL', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>

                  <td>
                    {visit.flag || ''} {visit.country || '—'}
                  </td>

                  <td>{visit.gender || '—'}</td>

                  <td>{visit.matched ? '✅ Yes' : '❌ No'}</td>

                  <td>{visit.email || 'Anonymous'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CardGrid({
  cards,
  variant,
}: {
  cards: { title: string; value: number }[];
  variant: 'pink' | 'blue' | 'zinc';
}) {
  const styles = {
    pink: 'bg-pink-600/10 border-pink-500/20 text-pink-300',
    blue: 'bg-blue-600/10 border-blue-500/20 text-blue-300',
    zinc: 'bg-zinc-900 border-zinc-800 text-zinc-400',
  };

  return (
    <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.title}
          className={`rounded-2xl border p-6 ${styles[variant]}`}
        >
          <p className="mb-2 text-sm">{card.title}</p>

          <h2 className="text-3xl font-bold text-white">
            {card.value}
          </h2>
        </div>
      ))}
    </div>
  );
}