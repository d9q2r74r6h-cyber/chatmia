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
  status: string | null;
  created_at: string;
};

export default function ReportsPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      window.location.href = '/auth';
      return false;
    }

    const userEmail = user.email.trim().toLowerCase();

    const { data: adminUser, error } = await supabase
      .from('admin_users')
      .select('email')
      .eq('email', userEmail)
      .maybeSingle();

    if (error || !adminUser) {
      window.location.href = '/';
      return false;
    }

    return true;
  }

  async function fetchReports() {
    const isAdmin = await checkAdmin();

    if (!isAdmin) return;

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

  async function banUser(report: Report) {
    if (!report.reported_email) {
      alert('Este reporte no tiene email del usuario reportado.');
      return;
    }
  
    const { error: banError } = await supabase
      .from('banned_users')
      .insert({
        email: report.reported_email,
        reason: report.reason,
        shadow_ban: false,
      });
  
    if (banError) {
      alert(`Error al banear: ${banError.message}`);
      return;
    }
  
    const { error: reportError } = await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', report.id);
  
    if (reportError) {
      alert(`Ban guardado, pero error al actualizar reporte: ${reportError.message}`);
      return;
    }
  
    alert('Usuario baneado correctamente.');
    fetchReports();
  }

  async function shadowBanUser(report: Report) {
    if (!report.reported_email) {
      alert('Este reporte no tiene email del usuario reportado.');
      return;
    }
  
    const { error: banError } = await supabase
      .from('banned_users')
      .insert({
        email: report.reported_email,
        reason: report.reason,
        shadow_ban: true,
      });
  
    if (banError) {
      alert(`Error al aplicar shadow ban: ${banError.message}`);
      return;
    }
  
    const { error: reportError } = await supabase
      .from('reports')
      .update({ status: 'reviewed' })
      .eq('id', report.id);
  
    if (reportError) {
      alert(`Shadow ban guardado, pero error al actualizar reporte: ${reportError.message}`);
      return;
    }
  
    alert('Shadow ban aplicado correctamente.');
    fetchReports();
  }

  async function ignoreReport(reportId: number) {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'ignored' })
      .eq('id', reportId);
  
    if (error) {
      alert(`Error al ignorar reporte: ${error.message}`);
      return;
    }
  
    alert('Reporte ignorado.');
    fetchReports();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black p-10 text-white">
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
            <div className="flex items-start justify-between gap-4">
              <p className="text-sm text-zinc-400">
                {new Date(report.created_at).toLocaleString()}
              </p>

              <span className="px-3 py-1 rounded-full bg-yellow-500/10 text-yellow-300 text-xs">
                {report.status || 'pending'}
              </span>
            </div>

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
                <p className="text-red-400 text-xs">
                  EMAIL: {report.reported_email || 'NULL'}
                </p>
              </div>
            </div>

            <div>
              <p className="text-zinc-400 text-sm mb-1">Motivo</p>
              <p className="font-semibold">{report.reason}</p>
            </div>

            <div className="flex flex-wrap gap-3 mt-6">
              <button
                onClick={() => banUser(report)}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-xl font-medium transition"
              >
                Ban
              </button>

              <button
                onClick={() => shadowBanUser(report)}
                className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-xl font-medium transition"
              >
                Shadow Ban
              </button>

              <button
                onClick={() => ignoreReport(report.id)}
                className="bg-zinc-700 hover:bg-zinc-600 px-4 py-2 rounded-xl font-medium transition"
              >
                Ignorar
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}