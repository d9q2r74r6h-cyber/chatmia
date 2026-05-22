'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Report {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;

  reporter_id: string;
  reported_user_id: string;
}

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReports(data);
    }

    setLoading(false);
  }

  async function banUser(userId: string) {
    const reason = 'Banned from admin panel';

    await supabase.from('banned_users').insert({
      user_id: userId,
      reason,
      is_permanent: true,
    });

    alert('User banned');
  }

  async function ignoreReport(reportId: string) {
    await supabase
      .from('reports')
      .update({
        status: 'ignored',
      })
      .eq('id', reportId);

    fetchReports();
  }

  async function markReviewed(reportId: string) {
    await supabase
      .from('reports')
      .update({
        status: 'reviewed',
      })
      .eq('id', reportId);

    fetchReports();
  }

  if (loading) {
    return (
      <div className="p-10 text-white">
        Loading reports...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Reports Moderation
      </h1>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-zinc-400">
                  Report ID
                </p>

                <p className="font-mono text-xs">
                  {report.id}
                </p>
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm">
                  {report.status}
                </span>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-zinc-400 text-sm">
                  Reporter
                </p>

                <p className="font-mono text-xs">
                  {report.reporter_id}
                </p>
              </div>

              <div>
                <p className="text-zinc-400 text-sm">
                  Reported User
                </p>

                <p className="font-mono text-xs">
                  {report.reported_user_id}
                </p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-zinc-400 text-sm mb-1">
                Reason
              </p>

              <p className="font-semibold">
                {report.reason}
              </p>
            </div>

            <div className="mb-6">
              <p className="text-zinc-400 text-sm mb-1">
                Details
              </p>

              <p className="text-zinc-300">
                {report.details || 'No details'}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() =>
                  banUser(report.reported_user_id)
                }
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl font-medium transition"
              >
                Ban User
              </button>

              <button
                onClick={() =>
                  markReviewed(report.id)
                }
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-xl font-medium transition"
              >
                Mark Reviewed
              </button>

              <button
                onClick={() =>
                  ignoreReport(report.id)
                }
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl font-medium transition"
              >
                Ignore
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}