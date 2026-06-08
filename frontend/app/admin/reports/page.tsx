'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type Report = {
  id: number;
  reporter_email: string | null;
  reported_email: string | null;
  reported_guest_id: string | null;
  reason: string;
  created_at: string;
};






export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  

  useEffect(() => {
    fetchReports();
  }, []);

  async function fetchReports() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      window.location.href = '/auth';
      return;
    }

    console.log('ADMIN EMAIL:', user?.email);

    const userEmail = user.email.trim().toLowerCase();

    const { data: adminUser, error: adminError } = await supabase
          .from('admin_users')
          .select('email')
          .eq('email', user.email.toLowerCase())
          .maybeSingle();

        if (adminError || !adminUser) {
          window.location.href = '/';
          return;
        }

    const adminEmails = [
      'admchatmia@outlook.com',
      'papiwonka@hotmail.com',
    ];
    
    if (!adminEmails.includes(user.email.toLowerCase())) {
      window.location.href = '/';
      return;
    }

    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
    }

    if (data) {
      setReports(data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-10 text-white">
        Cargando reportes...
      </div>
    );
  }

  
  

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <h1 className="text-4xl font-bold mb-8">
        Reportes de usuarios
      </h1>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6"
          >
            <p className="text-sm text-zinc-400">
              {new Date(report.created_at).toLocaleString()}
            </p>

            <div className="grid md:grid-cols-2 gap-4 my-4">
              <div>
                <p className="text-zinc-400 text-sm">Reportante</p>
                <p className="font-mono text-xs">
                  {report.reporter_email || 'guest'}
                </p>
              </div>

              <div>
                <p className="text-zinc-400 text-sm">Reportado</p>
                <p className="font-mono text-xs">
                  {report.reported_email ||
                    report.reported_guest_id ||
                    'desconocido'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-1">Motivo</p>
              <p className="font-semibold">{report.reason}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}