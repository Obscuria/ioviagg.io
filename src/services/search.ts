import type { SearchResult, WaypointCategory } from '../types/trip';
import { toWesternLatin } from './transliterate';

function mapOSMToCategory(item: {
  class?: string;
  type?: string;
  osm_key?: string;
  osm_value?: string;
  category?: string;
}): { category: WaypointCategory; categoryLabel: string } {
  const osmKey = (item.osm_key || item.class || '').toLowerCase();
  const osmValue = (item.osm_value || item.type || '').toLowerCase();

  // Food & Drink / Restaurant / Bar classification
  if (
    ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bistro', 'ice_cream', 'food_court', 'biergarten'].includes(
      osmValue
    ) ||
    (osmKey === 'amenity' && ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bistro', 'ice_cream'].includes(osmValue))
  ) {
    let label = 'Ristorante / Cibo';
    if (['cafe', 'bar', 'pub'].includes(osmValue)) label = 'Bar / Caffè';
    else if (osmValue === 'ice_cream') label = 'Gelateria';
    else if (osmValue === 'fast_food') label = 'Fast Food';
    return { category: 'food', categoryLabel: label };
  }

  // Parking classification
  if (
    osmValue === 'parking' ||
    osmKey === 'parking' ||
    (osmKey === 'amenity' && osmValue.includes('parking'))
  ) {
    return { category: 'parking', categoryLabel: 'Parcheggio' };
  }

  // Overnight stay classification
  if (
    ['hotel', 'motel', 'hostel', 'guest_house', 'camp_site', 'caravan_site', 'chalet', 'apartment', 'resort', 'alpine_hut'].includes(
      osmValue
    ) ||
    (osmKey === 'tourism' && ['hotel', 'hostel', 'camp_site', 'motel', 'chalet', 'alpine_hut'].includes(osmValue))
  ) {
    return { category: 'stay', categoryLabel: 'Pernottamento' };
  }

  // POI / Nature / Mountain / Attraction classification
  const poiKeys = ['natural', 'tourism', 'historic', 'leisure', 'heritage'];
  const poiValues = [
    'peak',
    'volcano',
    'cliff',
    'rock',
    'cave_entrance',
    'ridge',
    'hill',
    'viewpoint',
    'attraction',
    'museum',
    'theme_park',
    'monument',
    'castle',
    'archaeological_site',
    'ruins',
    'memorial',
    'park',
    'nature_reserve',
    'national_park',
    'waterfall',
    'lake',
    'beach',
  ];

  if (
    poiKeys.includes(osmKey) ||
    poiValues.includes(osmValue) ||
    osmValue.includes('park') ||
    osmValue.includes('peak') ||
    osmValue.includes('view') ||
    osmValue.includes('castle')
  ) {
    let specificLabel = 'Punto di Interesse';
    if (['peak', 'volcano', 'cliff', 'rock', 'ridge', 'hill'].includes(osmValue)) {
      specificLabel = 'Montagna / Vetta';
    } else if (['park', 'nature_reserve', 'national_park', 'wood'].includes(osmValue)) {
      specificLabel = 'Parco Naturale';
    } else if (['castle', 'monument', 'ruins', 'archaeological_site'].includes(osmValue)) {
      specificLabel = 'Monumento / Attrazione';
    }
    return { category: 'poi', categoryLabel: specificLabel };
  }

  return { category: 'standard', categoryLabel: 'Località' };
}

// Calculate Haversine distance in kilometers between two coordinates
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  }
  return `${Math.round(distanceKm)} km`;
}

export async function searchPlaces(
  query: string,
  proximity?: { lat: number; lng: number } | null
): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Use Photon API (Komoot OpenStreetMap search) with proximity biasing
  try {
    let photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      trimmed
    )}&limit=10&lang=it`;

    if (proximity) {
      photonUrl += `&lat=${proximity.lat}&lon=${proximity.lng}`;
    }

    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        const results: SearchResult[] = data.features.map(
          (
            f: {
              geometry: { coordinates: [number, number] };
              properties: {
                name?: string;
                city?: string;
                state?: string;
                country?: string;
                osm_key?: string;
                osm_value?: string;
                type?: string;
                osm_id?: number;
              };
            },
            index: number
          ) => {
            const props = f.properties;
            const [lng, lat] = f.geometry.coordinates;

            const rawName = props.name || props.city || trimmed;
            const name = toWesternLatin(rawName);
            const contextParts = [props.city, props.state, props.country]
              .filter(Boolean)
              .map((p) => toWesternLatin(p!));
            const displayName =
              contextParts.length > 0 ? `${name} (${contextParts.join(', ')})` : name;

            const { category, categoryLabel } = mapOSMToCategory({
              osm_key: props.osm_key,
              osm_value: props.osm_value,
              type: props.type,
            });

            const distanceKm = proximity
              ? calculateDistanceKm(proximity.lat, proximity.lng, lat, lng)
              : undefined;

            return {
              id: `search-${props.osm_id || index}-${Date.now()}`,
              name,
              displayName,
              lat,
              lng,
              category,
              categoryLabel,
              rawType: props.osm_value || props.type,
              distanceKm,
              distanceText: distanceKm !== undefined ? formatDistanceKm(distanceKm) : undefined,
            };
          }
        );

        if (proximity) {
          results.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
        }

        return results;
      }
    }
  } catch {
    // Fallback to Nominatim if Photon fails
  }

  // Fallback to Nominatim
  try {
    let nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=jsonv2&addressdetails=1&namedetails=1&extratags=1&accept-language=it,en,en-US&limit=10`;

    if (proximity) {
      const viewboxDelta = 1.0;
      const minLon = proximity.lng - viewboxDelta;
      const maxLon = proximity.lng + viewboxDelta;
      const minLat = proximity.lat - viewboxDelta;
      const maxLat = proximity.lat + viewboxDelta;
      nominatimUrl += `&viewbox=${minLon},${maxLat},${maxLon},${minLat}&bounded=0`;
    }

    const res = await fetch(nominatimUrl, {
      headers: { 'Accept-Language': 'it,en;q=0.9,en-US;q=0.8' },
    });
    if (!res.ok) return [];

    const items = await res.json();
    const results: SearchResult[] = items.map(
      (
        item: {
          place_id: number;
          name?: string;
          namedetails?: Record<string, string>;
          display_name: string;
          lat: string;
          lon: string;
          class?: string;
          type?: string;
        },
        index: number
      ) => {
        const namedetails = item.namedetails || {};
        const preferredName =
          namedetails['name:it'] ||
          namedetails['name:en'] ||
          namedetails['name:latin'] ||
          namedetails['name:romanized'] ||
          namedetails['int_name'] ||
          namedetails['name:zh-Latn'] ||
          namedetails['name:pinyin'] ||
          namedetails['name:ja-Latn'] ||
          namedetails['name:ko-Latn'] ||
          namedetails['name:ru-Latn'] ||
          item.name ||
          item.display_name.split(',')[0].trim();

        const name = toWesternLatin(preferredName);
        const displayName = toWesternLatin(item.display_name);

        const { category, categoryLabel } = mapOSMToCategory({
          class: item.class,
          type: item.type,
        });

        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        const distanceKm = proximity
          ? calculateDistanceKm(proximity.lat, proximity.lng, lat, lng)
          : undefined;

        return {
          id: `nom-${item.place_id || index}`,
          name,
          displayName,
          lat,
          lng,
          category,
          categoryLabel,
          rawType: item.type,
          distanceKm,
          distanceText: distanceKm !== undefined ? formatDistanceKm(distanceKm) : undefined,
        };
      }
    );

    if (proximity) {
      results.sort((a, b) => (a.distanceKm ?? 99999) - (b.distanceKm ?? 99999));
    }

    return results;
  } catch {
    return [];
  }
}
