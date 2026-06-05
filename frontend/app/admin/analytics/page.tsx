import { supabase } from '@/lib/supabase';

export default async function AdminAnalyticsPage() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const { data: visits } = await supabase
    .from('visits')
    .select('*')
    .gte('connected_at', hoy.toISOString())
    .order('connected_at', { ascending: false })
    .limit(100);

  const visitasHoy = visits?.length || 0;
  const matchesHoy =
    visits?.filter((v) => v.matched).length || 0;

  const usuariosUnicos = new Set(
    visits?.map((v) => v.email || v.socket_id)
  ).size;

  const paises = new Set(
    visits?.map((v) => v.country).filter(Boolean)
  ).size;

  return (
    <main className="min-h-screen bg-black p-6 text-white">
      <h1 className="text-4xl font-black">
        Analytics ChatMia
      </h1>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card titulo="Visitas hoy" valor={visitasHoy} />
        <Card titulo="Matches hoy" valor={matchesHoy} />
        <Card titulo="Usuarios únicos" valor={usuariosUnicos} />
        <Card titulo="Países" valor={paises} />
      </div>

      <section className="mt-10 rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-2xl font-black">
          Últimas visitas
        </h2>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-white/50">
              <tr>
                <th className="py-3">Hora</th>
                <th>País</th>
                <th>Género</th>
                <th>Match</th>
                <th>Email</th>
              </tr>
            </thead>

            <tbody>
              {visits?.map((v) => (
                <tr
                  key={v.id}
                  className="border-t border-white/10"
                >
                  <td className="py-3">
                    {new Date(v.connected_at).toLocaleTimeString(
                      'es-CL',
                      {
                        hour: '2-digit',
                        minute: '2-digit',
                      }
                    )}
                  </td>

                  <td>
                    {v.flag} {v.country || '—'}
                  </td>

                  <td>{v.gender || '—'}</td>

                  <td>
                    {v.matched ? '✅ Sí' : '❌ No'}
                  </td>

                  <td>{v.email || 'Sin login'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

function Card({
  titulo,
  valor,
}: {
  titulo: string;
  valor: number;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <p className="text-sm font-bold uppercase tracking-widest text-white/50">
        {titulo}
      </p>
      <p className="mt-3 text-4xl font-black">{valor}</p>
    </div>
  );
}