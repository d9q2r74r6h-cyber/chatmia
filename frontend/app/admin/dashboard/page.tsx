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

  const [chartData, setChartData] = useState<any[]>([]);

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
    const [reportsRes, flaggedRes, bansRes, messagesRes] =
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
      ]);

    setStats({
      reports: reportsRes.count || 0,
      flagged: flaggedRes.count || 0,
      bans: bansRes.count || 0,
      messages: messagesRes.count || 0,
    });

    await loadChartData();
  }

  async function loadChartData() {

    const { data } = await supabase
      .from('analytics_snapshots')
      .select('*')
      .order('created_at', {
        ascending: true,
      })
      .limit(24);
  
    if (!data) return;
  
    const formatted = data.map((item) => ({
      hour: new Date(
        item.created_at
      ).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
  
      users: item.online_users,
    }));
  
    setChartData(formatted);
  }

  const realtimeCards = [
    {
      title: 'Online Users',
      value: realtime.online,
    },
    {
      title: 'Active Chats',
      value: realtime.activeChats,
    },
    {
      title: 'Waiting Users',
      value: realtime.waitingNormal,
    },
    {
      title: 'Shadow Queue',
      value: realtime.waitingShadow,
    },
  ];

  const cards = [
    {
      title: 'Reports',
      value: stats.reports,
    },
    {
      title: 'Flagged Messages',
      value: stats.flagged,
    },
    {
      title: 'Banned Users',
      value: stats.bans,
    },
    {
      title: 'Messages',
      value: stats.messages,
    },
  ];

  return (
    <main className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Admin Dashboard
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {realtimeCards.map((card) => (
          <div
            key={card.title}
            className="bg-pink-600/10 border border-pink-500/20 rounded-2xl p-6"
          >
            <p className="text-pink-300 text-sm mb-2">
              {card.title}
            </p>

            <h2 className="text-3xl font-bold">
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.title}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
          >
            <p className="text-zinc-400 text-sm mb-2">
              {card.title}
            </p>

            <h2 className="text-3xl font-bold">
              {card.value}
            </h2>
          </div>
        ))}
      </div>

      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-2xl font-semibold mb-6">
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
      </div>
    </main>
  );
}