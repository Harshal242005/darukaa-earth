import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function MapView({
  sites = [],
  drawEnabled = false,
  onPolygonDrawn,
  onSiteClick,
  selectedSiteId,
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const drawRef = useRef(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (mapRef.current) return;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [78.96, 20.59],
      zoom: 4,
    });
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    map.on('load', () => {
      map.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'sites-fill',
        type: 'fill',
        source: 'sites',
        paint: {
          'fill-color': [
            'case',
            ['boolean', ['feature-state', 'selected'], false],
            '#f59e0b',
            '#10b981',
          ],
          'fill-opacity': 0.35,
        },
      });

      map.addLayer({
        id: 'sites-outline',
        type: 'line',
        source: 'sites',
        paint: { 'line-color': '#065f46', 'line-width': 2 },
      });

      map.on('click', 'sites-fill', (e) => {
        const f = e.features[0];
        onSiteClick?.(Number(f.properties.id));
      });
      map.on('mouseenter', 'sites-fill', () => {
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'sites-fill', () => {
        map.getCanvas().style.cursor = '';
      });

      setMapReady(true);
    });

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    if (drawEnabled && !drawRef.current) {
      const draw = new MapboxDraw({
        displayControlsDefault: false,
        controls: { polygon: true, trash: true },
      });
      map.addControl(draw, 'top-left');
      drawRef.current = draw;

      map.on('draw.create', (e) => {
        const feature = e.features[0];
        onPolygonDrawn?.(feature.geometry);
        draw.deleteAll();
      });
    } else if (!drawEnabled && drawRef.current) {
      map.removeControl(drawRef.current);
      drawRef.current = null;
    }
  }, [drawEnabled, mapReady, onPolygonDrawn]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource('sites');
    if (!src) return;

    const features = sites
      .filter((s) => s.geometry && s.geometry.coordinates)
      .map((s) => ({
        type: 'Feature',
        id: s.id,
        geometry: s.geometry,
        properties: {
          id: s.id,
          name: s.name,
          area: s.area_hectares,
        },
      }));

    src.setData({ type: 'FeatureCollection', features });

    if (features.length) {
      const bounds = new mapboxgl.LngLatBounds();
      features.forEach((f) => f.geometry.coordinates[0].forEach((c) => bounds.extend(c)));
      const el = map.getContainer();
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        try {
          map.fitBounds(bounds, {
            padding: 60,
            maxZoom: 13,
            duration: 800,
          });
        } catch {
          // ignore transient fit errors
        }
      }
    }
  }, [sites, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    const src = map.getSource('sites');
    if (!src) return;

    sites.forEach((s) => {
      try {
        map.setFeatureState(
          { source: 'sites', id: s.id },
          { selected: s.id === selectedSiteId }
        );
      } catch {
        // feature may not be loaded yet
      }
    });
  }, [selectedSiteId, sites, mapReady]);

  return <div ref={containerRef} className="h-full w-full" />;
}
