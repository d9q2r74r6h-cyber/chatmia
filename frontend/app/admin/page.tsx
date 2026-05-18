'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Report = {
  id: number;
  created_at: string;
  reporter_email: string;
  reason: string;
};

export default function AdminPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setReports(data);
    }

    setLoading(false);
  };

  return (
    <main className="min-h-screen bg-black text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">
            Panel de Moderación
          </h1>

          <button
            onClick={loadReports}
            className="px-4 py-2 rounded-xl bg-white text-black font-medium"
          >
            Recargar
          </button>
        </div>

        {loading ? (
          <div className="text-white/60">
            Cargando reportes...
          </div>
        ) : reports.length === 0 ? (
          <div className="text-white/60">
            No hay reportes todavía.
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white/5 border border-white/10 rounded-2xl p-5"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="font-semibold">
                      {report.reporter_email}
                    </div>

                    <div className="text-sm text-white/40">
                      {new Date(
                        report.created_at
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div className="text-red-300 font-medium">
                    Reporte
                  </div>
                </div>

                <div className="mt-4 text-white/80">
                  {report.reason}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}