import type { Coordinates, MapMarker } from '../types';

export function createLeafletMapHtml(center: Coordinates, markers: MapMarker[], showCurrentLocation: boolean) {
  const mapData = JSON.stringify({ center, markers, showCurrentLocation }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
      body { overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .price-marker { background: transparent; border: 0; }
      .price-pill {
        background: #18343A; border: 2px solid #fff; border-radius: 16px;
        color: #fff; font-size: 12px; font-weight: 700; padding: 6px 10px;
        white-space: nowrap; box-shadow: 0 2px 7px rgba(24,52,58,.22);
      }
      .user-dot {
        width: 16px; height: 16px; background: #178DA1; border: 3px solid white;
        border-radius: 50%; box-shadow: 0 0 0 8px rgba(101,197,216,.25);
      }
      .leaflet-popup-content-wrapper { border-radius: 12px; }
      .leaflet-popup-content { color: #18343A; font-size: 12px; margin: 10px 13px; }
      .leaflet-control-attribution { font-size: 9px !important; }
    </style>
  </head>
  <body>
    <div id="map" aria-label="Mapa de cuidadores"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const data = ${mapData};
      const map = L.map('map', { zoomControl: false, attributionControl: true })
        .setView([data.center.latitude, data.center.longitude], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      data.markers.forEach((marker) => {
        const icon = L.divIcon({
          className: 'price-marker',
          html: '<div class="price-pill">' + marker.rate + '</div>',
          iconSize: [74, 34],
          iconAnchor: [37, 17],
        });
        L.marker([marker.latitude, marker.longitude], { icon })
          .addTo(map)
          .bindPopup('<strong>' + marker.label + '</strong><br/>Solicitud de ejemplo · ' + marker.rate);
      });
      if (data.showCurrentLocation) {
        const userIcon = L.divIcon({
          className: 'price-marker',
          html: '<div class="user-dot"></div>',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        L.marker([data.center.latitude, data.center.longitude], { icon: userIcon })
          .addTo(map)
          .bindPopup('Tu ubicación actual');
      }
      setTimeout(() => map.invalidateSize(), 150);
    </script>
  </body>
</html>`;
}
