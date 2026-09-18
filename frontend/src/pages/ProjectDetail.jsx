import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { projectApi, siteApi } from '../api/client';
import MapView from '../components/MapView';
import SiteCharts from '../components/SiteCharts';
import StatCard from '../components/StatCard';
import NameSiteModal from '../components/NameSiteModal';

export default function ProjectDetail() {
  const { id } = useParams();
  const projectId = Number(id);

  const [project, setProject] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [pendingGeometry, setPendingGeometry] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          projectApi.get(projectId),
          siteApi.listForProject(projectId),
        ]);
        setProject(p.data);
        setSites(s.data);
      } catch (err) {
        setError(err.response?.data?.detail || 'Failed to load project');
      }
    })();
  }, [projectId]);

  useEffect(() => {
    if (!selectedSiteId) {
      setAnalytics(null);
      return;
    }
    setLoadingAnalytics(true);
    siteApi
      .analytics(selectedSiteId)
      .then((r) => setAnalytics(r.data))
      .catch(() => setAnalytics(null))
      .finally(() => setLoadingAnalytics(false));
  }, [selectedSiteId]);

  const handlePolygonDrawn = (geometry) => {
    setPendingGeometry(geometry);
    setDrawing(false);
  };

  const handleSaveSite = async (name) => {
    try {
      const { data } = await siteApi.create(projectId, {
        name,
        geometry: pendingGeometry,
      });
      setSites((prev) => [...prev, data]);
      setPendingGeometry(null);
      setSelectedSiteId(data.id);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to create site');
      setPendingGeometry(null);
    }
  };

  return (
    <div className="h-screen bg-slate-50 flex flex-col overflow-hidden">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-slate-400 hover:text-slate-700">
              ←
            </Link>
            <div>
              <div className="font-semibold text-slate-900">
                {project?.name || 'Loading…'}
              </div>
              <div className="text-xs text-slate-500">
                {project?.project_type} project
              </div>
            </div>
          </div>
          <button
            onClick={() => setDrawing((d) => !d)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              drawing
                ? 'bg-amber-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white'
            }`}
          >
            {drawing ? 'Drawing… (click map)' : '+ Add Site'}
          </button>
        </div>
      </header>

      {error && (
        <div className="bg-red-50 border-b border-red-200 text-red-700 text-sm px-6 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 grid grid-cols-[1fr_440px] min-h-0">
        <div className="relative bg-slate-200">
          <MapView
            sites={sites}
            drawEnabled={drawing}
            onPolygonDrawn={handlePolygonDrawn}
            onSiteClick={setSelectedSiteId}
            selectedSiteId={selectedSiteId}
          />
        </div>

        <aside className="border-l border-slate-200 bg-slate-50 overflow-y-auto">
          {selectedSiteId && analytics ? (
            <div className="p-4 space-y-4">
              <div>
                <button
                  onClick={() => setSelectedSiteId(null)}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  ← All sites
                </button>
                <h2 className="text-lg font-semibold text-slate-900 mt-1">
                  {analytics.site_name}
                </h2>
                <p className="text-xs text-slate-500">
                  {analytics.area_hectares.toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}{' '}
                  hectares
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StatCard
                  label="Total carbon"
                  value={analytics.total_carbon_tco2e.toLocaleString(
                    undefined,
                    { maximumFractionDigits: 0 }
                  )}
                  unit="tCO2e"
                />
                <StatCard
                  label="Avg NDVI"
                  value={analytics.avg_ndvi.toFixed(3)}
                  accent="blue"
                />
                <StatCard
                  label="Species"
                  value={analytics.latest_species_count}
                  accent="purple"
                />
                <StatCard
                  label="Trend"
                  value={`${analytics.carbon_trend_pct > 0 ? '+' : ''}${analytics.carbon_trend_pct}%`}
                  accent={
                    analytics.carbon_trend_pct >= 0 ? 'emerald' : 'amber'
                  }
                />
              </div>

              <SiteCharts analytics={analytics} />
            </div>
          ) : loadingAnalytics ? (
            <div className="p-6 text-sm text-slate-500">
              Loading analytics…
            </div>
          ) : (
            <div className="p-4">
              <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">
                Sites ({sites.length})
              </h2>
              {sites.length === 0 ? (
                <p className="text-sm text-slate-500 mt-3">
                  No sites yet. Click <strong>+ Add Site</strong> and draw a
                  polygon on the map.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {sites.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setSelectedSiteId(s.id)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                          s.id === selectedSiteId
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <div className="font-medium text-sm text-slate-900">
                          {s.name}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {s.area_hectares?.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}{' '}
                          ha
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </aside>
      </div>

      {pendingGeometry && (
        <NameSiteModal
          onCancel={() => setPendingGeometry(null)}
          onSubmit={handleSaveSite}
        />
      )}
    </div>
  );
}
