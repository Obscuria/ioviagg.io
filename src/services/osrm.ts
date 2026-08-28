import type { RouteData, Waypoint } from '../types/trip';

export async function fetchOSRMRoute(waypoints: Waypoint[]): Promise<RouteData | null> {
  if (waypoints.length < 2) {
    return null;
  }

  // OSRM expects coordinates in "lon,lat;lon,lat" format
  const coordString = waypoints.map((w) => `${w.lng.toFixed(6)},${w.lat.toFixed(6)}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Errore HTTP OSRM: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'Nessun percorso stradale trovato per questi punti.');
    }

    const route = data.routes[0];

    // Convert GeoJSON [lon, lat] coordinates to Leaflet [lat, lng]
    const coordinates: [number, number][] = route.geometry.coordinates.map(
      (pt: [number, number]) => [pt[1], pt[0]]
    );

    const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
    const durationMinutes = Math.round(route.duration / 60);

    const legs = (route.legs || []).map((leg: { distance: number; duration: number; summary?: string }) => ({
      distanceKm: Math.round((leg.distance / 1000) * 10) / 10,
      durationMinutes: Math.round(leg.duration / 60),
      summary: leg.summary || undefined,
    }));

    return {
      coordinates,
      distanceKm,
      durationMinutes,
      legs,
    };
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        throw new Error('Timeout durante la richiesta al server OSRM. Riprova tra poco.');
      }
      throw err;
    }
    throw new Error('Errore sconosciuto nel calcolo del percorso.');
  }
}

// Simple reverse geocode helper with cache
const geocodeCache = new Map<string, string>();

export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept-Language': 'it,en',
        },
      }
    );
    if (!res.ok) throw new Error('Nominatim error');
    const data = await res.json();
    
    const city = data.address?.city || data.address?.town || data.address?.village || data.address?.municipality || data.address?.county;
    const state = data.address?.state || data.address?.country;
    
    let result = '';
    if (city && state) {
      result = `${city}, ${state}`;
    } else if (city) {
      result = city;
    } else if (data.display_name) {
      result = data.display_name.split(',').slice(0, 2).join(',').trim();
    } else {
      result = `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
    }

    geocodeCache.set(cacheKey, result);
    return result;
  } catch {
    return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
  }
}
