import Highcharts from 'highcharts';
import HighchartsReactModule from 'highcharts-react-official';

const HighchartsReact = HighchartsReactModule.default || HighchartsReactModule;

const base = {
  credits: { enabled: false },
  chart: { backgroundColor: 'transparent', height: 220 },
  xAxis: { type: 'datetime' },
  legend: { enabled: false },
  title: { style: { fontSize: '13px', fontWeight: '600' } },
};

export default function SiteCharts({ analytics }) {
  const ts = (key) =>
    analytics.series.map((p) => [Date.parse(p.recorded_at), p[key]]);

  const carbon = {
    ...base,
    chart: { ...base.chart, type: 'area' },
    title: { ...base.title, text: 'Carbon sequestered (tCO2e)' },
    yAxis: { title: { text: null } },
    plotOptions: {
      area: { fillColor: 'rgba(16,185,129,0.15)', lineWidth: 2 },
    },
    series: [
      {
        name: 'Carbon',
        data: ts('carbon_tco2e'),
        color: '#10b981',
      },
    ],
  };

  const ndvi = {
    ...base,
    title: { ...base.title, text: 'NDVI (vegetation health)' },
    yAxis: { title: { text: null }, min: 0, max: 1 },
    series: [
      {
        name: 'NDVI',
        data: ts('ndvi'),
        color: '#3b82f6',
        lineWidth: 2,
      },
    ],
  };

  const species = {
    ...base,
    chart: { ...base.chart, type: 'column' },
    title: { ...base.title, text: 'Species richness' },
    yAxis: { title: { text: null } },
    plotOptions: { column: { borderRadius: 2 } },
    series: [
      {
        name: 'Species',
        data: ts('species_count'),
        color: '#8b5cf6',
      },
    ],
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <HighchartsReact highcharts={Highcharts} options={carbon} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <HighchartsReact highcharts={Highcharts} options={ndvi} />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-3">
        <HighchartsReact highcharts={Highcharts} options={species} />
      </div>
    </div>
  );
}
