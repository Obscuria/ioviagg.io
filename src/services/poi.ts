import type { WaypointCategory } from '../types/trip';

export interface MapPOI {
  id: string;
  osmId?: number | string;
  name: string;
  lat: number;
  lng: number;
  category: WaypointCategory;
  categoryLabel: string;
  type: string;
  icon: string;
}

// Bounding box interface: [south, west, north, east]
export interface MapBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

const poiCache = new Map<string, MapPOI[]>();

// Classify raw OSM type / class / amenity / tourism tags into clean categories
export function classifyPOIType(rawType: string = '', rawClass: string = ''): {
  category: WaypointCategory;
  categoryLabel: string;
  icon: string;
} {
  const t = rawType.toLowerCase();
  const c = rawClass.toLowerCase();

  // Food & Dining
  if (
    ['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bistro', 'ice_cream', 'food_court', 'biergarten', 'bakery', 'pizzeria', 'trattoria', 'osteria'].includes(t) ||
    c === 'amenity' && ['restaurant', 'cafe', 'bar', 'fast_food', 'pub'].includes(t)
  ) {
    if (['cafe', 'bar', 'pub'].includes(t)) return { category: 'food', categoryLabel: 'Bar / Caffetteria', icon: '☕' };
    if (t === 'ice_cream') return { category: 'food', categoryLabel: 'Gelateria', icon: '🍦' };
    if (t === 'fast_food') return { category: 'food', categoryLabel: 'Fast Food', icon: '🍔' };
    return { category: 'food', categoryLabel: 'Ristorante / Ristoro', icon: '🍽️' };
  }

  // Parking
  if (t.includes('parking') || c.includes('parking')) {
    return { category: 'parking', categoryLabel: 'Parcheggio', icon: '🅿️' };
  }

  // Overnight stay
  if (
    ['hotel', 'guest_house', 'hostel', 'motel', 'camp_site', 'caravan_site', 'chalet', 'apartment', 'resort', 'alpine_hut', 'bed_and_breakfast'].includes(t) ||
    c === 'tourism' && ['hotel', 'guest_house', 'hostel', 'motel', 'camp_site', 'chalet', 'alpine_hut'].includes(t)
  ) {
    if (['camp_site', 'caravan_site'].includes(t)) return { category: 'stay', categoryLabel: 'Campeggio', icon: '⛺' };
    if (t === 'alpine_hut') return { category: 'stay', categoryLabel: 'Rifugio Alpino', icon: '🏡' };
    return { category: 'stay', categoryLabel: 'Pernottamento / Hotel', icon: '🛏️' };
  }

  // Historic / Monument / Tower / Castle
  if (
    ['monument', 'memorial', 'tower', 'castle', 'ruins', 'archaeological_site', 'fort', 'city_gate', 'historic'].includes(t) ||
    c === 'historic'
  ) {
    if (t === 'tower' || t.includes('tower')) return { category: 'poi', categoryLabel: 'Torre / Monumento', icon: '🗼' };
    if (t === 'castle' || t.includes('castle')) return { category: 'poi', categoryLabel: 'Castello / Fortezza', icon: '🏰' };
    if (t === 'museum') return { category: 'poi', categoryLabel: 'Museo', icon: '🏛️' };
    return { category: 'poi', categoryLabel: 'Monumento Storico', icon: '🏛️' };
  }

  // Nature / Viewpoint / Peaks
  if (['viewpoint', 'peak', 'volcano', 'cliff', 'rock', 'waterfall', 'beach', 'cave_entrance'].includes(t) || c === 'natural') {
    if (t === 'viewpoint') return { category: 'poi', categoryLabel: 'Punto Panoramico', icon: '🔭' };
    if (t === 'peak') return { category: 'poi', categoryLabel: 'Vetta / Cima', icon: '🏔️' };
    if (t === 'waterfall') return { category: 'poi', categoryLabel: 'Cascata', icon: '🌊' };
    if (t === 'beach') return { category: 'poi', categoryLabel: 'Spiaggia', icon: '🏖️' };
    return { category: 'poi', categoryLabel: 'Punto Panoramico / Natura', icon: '🏔️' };
  }

  // Tourism & Attractions
  if (['attraction', 'museum', 'theme_park', 'artwork', 'gallery', 'park', 'nature_reserve'].includes(t) || c === 'tourism' || c === 'leisure') {
    if (t === 'museum') return { category: 'poi', categoryLabel: 'Museo', icon: '🏛️' };
    if (t.includes('park')) return { category: 'poi', categoryLabel: 'Parco / Giardino', icon: '🌲' };
    return { category: 'poi', categoryLabel: 'Attrazione Turistica', icon: '📸' };
  }

  return { category: 'standard', categoryLabel: 'Punto di Interesse', icon: '📍' };
}

// Fetch POIs in map bounds using fast Nominatim multi-category query
export async function fetchPOIsInBounds(bounds: MapBounds, maxResults: number = 40): Promise<MapPOI[]> {
  // Quantize bounds to avoid re-fetching on minor drags
  const cacheKey = `${bounds.south.toFixed(3)},${bounds.west.toFixed(3)},${bounds.north.toFixed(3)},${bounds.east.toFixed(3)}`;
  if (poiCache.has(cacheKey)) {
    return poiCache.get(cacheKey)!;
  }

  // Prevent enormous bounding box queries
  const latDiff = Math.abs(bounds.north - bounds.south);
  const lngDiff = Math.abs(bounds.east - bounds.west);
  if (latDiff > 0.6 || lngDiff > 0.6) {
    return [];
  }

  // Queries to cover all key categories (Attractions, Monuments, Towers, Food, Parkings, Hotels)
  const targetTerms = [
    'attrazione',
    'monumento',
    'torre',
    'museo',
    'chiesa',
    'ristorante',
    'trattoria',
    'pasticceria',
    'bar',
    'parcheggio',
    'hotel',
  ];

  const viewboxParam = `${bounds.west.toFixed(5)},${bounds.north.toFixed(5)},${bounds.east.toFixed(5)},${bounds.south.toFixed(5)}`;

  try {
    const fetchPromises = targetTerms.map(async (term) => {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
        term
      )}&format=jsonv2&viewbox=${viewboxParam}&bounded=1&limit=8`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      try {
        const res = await fetch(url, {
          headers: { 'User-Agent': 'IoViaggioTravelPlanner/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!res.ok) return [];
        return await res.json();
      } catch {
        clearTimeout(timeoutId);
        return [];
      }
    });

    const results = await Promise.all(fetchPromises);
    const flat = results.flat();

    const seenKeys = new Set<string>();
    const pois: MapPOI[] = [];

    for (const item of flat) {
      if (!item.lat || !item.lon) continue;
      const rawName = item.name || (item.display_name && item.display_name.split(',')[0].trim());
      if (!rawName || rawName.length < 2) continue;

      const lat = parseFloat(item.lat);
      const lng = parseFloat(item.lon);

      // Verify coordinate is actually inside current bounding box
      if (lat < bounds.south || lat > bounds.north || lng < bounds.west || lng > bounds.east) {
        continue;
      }

      // Deduplicate nearby items with same name
      const key = `${rawName.toLowerCase()}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);

      const { category, categoryLabel, icon } = classifyPOIType(item.type, item.class);

      pois.push({
        id: `poi-nom-${item.place_id || Math.random().toString(36).substr(2, 6)}`,
        osmId: item.osm_id || item.place_id,
        name: rawName,
        lat,
        lng,
        category,
        categoryLabel,
        type: item.type || item.class || 'point',
        icon,
      });

      if (pois.length >= maxResults) break;
    }

    poiCache.set(cacheKey, pois);
    return pois;
  } catch {
    return [];
  }
}
