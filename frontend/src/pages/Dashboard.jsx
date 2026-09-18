import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { projectApi } from '../api/client';
import NewProjectModal from '../components/NewProjectModal';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await projectApi.list();
      setProjects(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const totalHectares = projects.reduce((sum, p) => sum + (p.total_hectares || 0), 0);
  const totalSites = projects.reduce((sum, p) => sum + (p.site_count || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center text-white font-bold">
              D
            </div>
            <div>
              <div className="font-semibold text-slate-900">Darukaa.Earth</div>
              <div className="text-xs text-slate-500">
                {user?.full_name || user?.email}
              </div>
            </div>
          </div>
          <button
            onClick={logout}
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
            <p className="text-sm text-slate-500 mt-1">
              Manage carbon and biodiversity initiatives
            </p>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm font-medium"
          >
            + New Project
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          <StatCard label="Projects" value={projects.length} />
          <StatCard label="Sites" value={totalSites} accent="blue" />
          <StatCard
            label="Total area"
            value={totalHectares.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
            unit="ha"
            accent="amber"
          />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 mb-6">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-slate-500 text-sm">Loading projects…</div>
        ) : projects.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-slate-300 py-16 text-center">
            <p className="text-slate-500">
              No projects yet. Create your first one to get started.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((p) => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="block bg-white rounded-2xl border border-slate-200 p-5 hover:border-emerald-400 hover:shadow-md transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{p.name}</div>
                    <div className="text-xs uppercase tracking-wide text-slate-400 mt-1">
                      {p.project_type}
                    </div>
                  </div>
                  <div className="text-xs text-slate-400">
                    {p.site_count} site{p.site_count === 1 ? '' : 's'}
                  </div>
                </div>
                {p.description && (
                  <p className="text-sm text-slate-500 mt-3 line-clamp-2">
                    {p.description}
                  </p>
                )}
                <div className="mt-4 pt-3 border-t border-slate-100 text-sm">
                  <span className="text-slate-500">Area: </span>
                  <span className="font-medium text-slate-900">
                    {p.total_hectares.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    ha
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <NewProjectModal
          onClose={() => setShowModal(false)}
          onCreated={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
