'use client';

import { useEffect, useState } from 'react';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function DashboardPage() {
  const [stats, setStats] = useState({
    online: 0,
    reports: 0,
    flagged: 0,
    bans: 0,
    messages: 0,
  });

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(() => {
      loadDashboard();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  async function loadDashboard() {
    const [
      reportsRes,
      flaggedRes,
      bansRes,
      messagesRes,
    ] = await Promise.all([
      supabase
        .from('reports')
        .select('*', { count: 'exact', head: true }),

      supabase
        .from('chat_messages')
        .select('*', {
          count: 'exact',
          head: true,
        })
        .eq('is_flagged', true),

      supabase
        .from('banned_users')
        .select('*', {
          count: 'exact',
          head: true,
        }),

      supabase
        .from('chat_messages')
        .select('*', {
          count: 'exact',
          head: true,
        }),
    ]);

    setStats({
      online: 0,
      reports: reportsRes.count || 0,
      flagged: flaggedRes.count || 0,
      bans: bansRes.count || 0,
      messages: messagesRes.count || 0,
    });

    generateFakeChart();
  }

  function generateFakeChart() {
    const data = [];

    for (let i = 0; i < 12; i++) {
      data.push({
        hour: `${i * 2}:00`,
        users:
          Math.floor(Math.random() * 100) + 20,
      });
    }

    setChartData(data);
  }

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
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Admin Dashboard
      </h1>

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
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
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
    </div>
  );
}