import type { Coordinates, MapMarker } from '../types';
import { colors } from '../theme';

export function parseMapMarkerMessage(data: string): string | null {
  try {
    const parsed = JSON.parse(data) as { type?: unknown; id?: unknown };
    return parsed.type === 'openCaregiver' && typeof parsed.id === 'string' ? parsed.id : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    if (char === '"') return '&quot;';
    return '&#39;';
  });
}

export function createLeafletMapHtml(
  center: Coordinates,
  markers: MapMarker[],
  showCurrentLocation: boolean,
  selectedMarkerId?: string,
) {
  const safeMarkers = markers.map((marker) => ({
    id: marker.id,
    label: escapeHtml(marker.label),
    rate: escapeHtml(marker.rate),
    title: escapeHtml(marker.title ?? ''),
    location: escapeHtml(marker.location ?? ''),
    latitude: marker.latitude,
    longitude: marker.longitude,
  }));
  const mapData = JSON.stringify({ center, markers: safeMarkers, showCurrentLocation, selectedMarkerId }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { width: 100%; height: 100%; margin: 0; padding: 0; }
      body { overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
      .leaflet-container { background: ${colors.map}; }
      .leaflet-tile { filter: grayscale(1) saturate(.25) contrast(.94) brightness(1.04); }
      .price-marker { border: 0; }
      .marker-wrap {
        align-items: center; display: flex; height: 42px; justify-content: center;
        position: relative; width: 96px;
      }
      .price-pill {
        background: ${colors.tealDark}; border: 2px solid ${colors.white}; border-radius: 16px;
        color: ${colors.white}; cursor: pointer; font: inherit; font-size: 11px; font-weight: 700;
        padding: 7px 10px; position: relative; white-space: nowrap;
        z-index: 1;
      }
      .user-dot {
        width: 16px; height: 16px; background: ${colors.tealDark}; border: 3px solid ${colors.white};
        border-radius: 50%;
      }
      .leaflet-popup-content-wrapper { border-radius: 12px; }
      .leaflet-popup-content { color: ${colors.ink}; font-size: 12px; margin: 10px 13px; }
      .leaflet-control-attribution { font-size: 9px !important; }
      .popup-line { color: ${colors.muted}; font-size: 11px; margin-top: 3px; }
      .popup-rate { color: ${colors.tealDark}; font-size: 12px; font-weight: 800; margin-top: 7px; }
      .profile-button {
        background: ${colors.tealDark}; border: 0; border-radius: 9px; color: ${colors.white};
        cursor: pointer; font: inherit; font-size: 11px; font-weight: 700;
        margin-top: 9px; padding: 7px 11px; width: 100%;
      }
    </style>
  </head>
  <body>
    <div id="map" aria-label="Mapa de cuidadores"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const data = ${mapData};
      function openProfile(id) {
        const message = JSON.stringify({ type: 'openCaregiver', id: id });
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === 'function') {
          window.ReactNativeWebView.postMessage(message);
        } else if (window.parent && window.parent !== window) {
          window.parent.postMessage(message, '*');
        }
      }
      const map = L.map('map', { zoomControl: false, attributionControl: true })
        .setView([data.center.latitude, data.center.longitude], 14);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(map);
      if (data.showCurrentLocation && data.selectedMarkerId) {
        const selected = data.markers.find(function (marker) { return marker.id === data.selectedMarkerId; });
        if (selected) {
          L.polyline(
            [[data.center.latitude, data.center.longitude], [selected.latitude, selected.longitude]],
            { color: '${colors.tealDark}', dashArray: '4, 8', lineCap: 'round', weight: 4 }
          ).addTo(map);
        }
      }
      data.markers.forEach(function (marker) {
        const icon = L.divIcon({
          className: 'price-marker',
          html: '<div class="marker-wrap"><button type="button" class="price-pill">' + marker.rate + '</button></div>',
          iconSize: [96, 42],
          iconAnchor: [48, 21],
        });
        const popup = '<div class="popup-card"><strong>' + marker.label + '</strong>' +
          (marker.title ? '<div class="popup-line">' + marker.title + '</div>' : '') +
          (marker.location ? '<div class="popup-line">' + marker.location + '</div>' : '') +
          '<div class="popup-rate">' + marker.rate + '</div>' +
          '<button type="button" class="profile-button">Ver perfil completo</button></div>';
        const pin = L.marker([marker.latitude, marker.longitude], { icon: icon })
          .addTo(map)
          .bindPopup(popup);
        pin.on('click', function () { openProfile(marker.id); });
        pin.on('popupopen', function () {
          const button = pin.getPopup().getElement().querySelector('.profile-button');
          if (button) button.onclick = function () { openProfile(marker.id); };
        });
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
      if (data.markers.length) {
        const bounds = L.latLngBounds(data.markers.map(function (marker) {
          return [marker.latitude, marker.longitude];
        }));
        if (data.showCurrentLocation) bounds.extend([data.center.latitude, data.center.longitude]);
        map.fitBounds(bounds, { padding: [48, 48], maxZoom: 14 });
      }
      setTimeout(() => map.invalidateSize(), 150);
    </script>
  </body>
</html>`;
}
