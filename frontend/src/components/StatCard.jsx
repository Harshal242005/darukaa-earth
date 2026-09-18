export default function StatCard({ label, value, unit, accent = 'emerald' }) {
  const accents = {
    emerald: 'text-emerald-600',
    blue: 'text-blue-600',
    amber: 'text-amber-600',
    purple: 'text-purple-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accents[accent]}`}>
        {value}
        {unit && <span className="text-sm ml-1 text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}
