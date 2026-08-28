import type { WaypointCategory } from '../types/trip';

export interface MapPOI {
  id: string;
  osmId: number;
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

// Classify OSM tags into our WaypointCategory
export function classifyOsmTags(tags: Record<string, string>): {
  category: WaypointCategory;
  categoryLabel: string;
  icon: string;
  type: string;
} {
  const amenity = (tags.amenity || '').toLowerCase();
  const tourism = (tags.tourism || '').toLowerCase();
  const historic = (tags.historic || '').toLowerCase();
  const natural = (tags.natural || '').toLowerCase();
  const leisure = (tags.leisure || '').toLowerCase();

  // Food & Dining
  if (['restaurant', 'cafe', 'bar', 'pub', 'fast_food', 'bistro', 'ice_cream', 'food_court', 'biergarten'].includes(amenity)) {
    let label = 'Ristorante / Cibo';
    let icon = '🍽️';
    if (['cafe', 'bar', 'pub'].includes(amenity)) {
      label = 'Bar / Caffetteria';
      icon = '☕';
    } else if (amenity === 'ice_cream') {
      label = 'Gelateria';
      icon = '🍦';
    } else if (amenity === 'fast_food') {
      label = 'Fast Food';
      icon = '🍔';
    }
    return { category: 'food', categoryLabel: label, icon, type: amenity };
  }

  // Parking
  if (amenity === 'parking' || tags.parking) {
    return { category: 'parking', categoryLabel: 'Parcheggio', icon: '🅿️', type: 'parking' };
  }

  // Overnight stay
  if (['hotel', 'guest_house', 'hostel', 'motel', 'camp_site', 'caravan_site', 'chalet', 'apartment', 'resort', 'alpine_hut'].includes(tourism)) {
    let label = 'Pernottamento / Hotel';
    let icon = '🛏️';
    if (['camp_site', 'caravan_site'].includes(tourism)) {
      label = 'Campeggio / Sosta Camper';
      icon = '⛺';
    } else if (tourism === 'alpine_hut') {
      label = 'Rifugio Alpino';
      icon = '🏡';
    }
    return { category: 'stay', categoryLabel: label, icon, type: tourism };
  }

  // Historic / Cultural POI
  if (historic) {
    let label = 'Sito Storico';
    let icon = '🏛️';
    if (historic === 'castle') {
      label = 'Castello / Rocca';
      icon = '🏰';
    } else if (historic === 'monument' || historic === 'memorial') {
      label = 'Monumento';
      icon = '🗿';
    } else if (historic === 'ruins' || historic === 'archaeological_site') {
      label = 'Rovine / Sito Archeologico';
      icon = '🏺';
    }
    return { category: 'poi', categoryLabel: label, icon, type: historic };
  }

  // Nature / Peaks / Viewpoints
  if (['peak', 'volcano', 'cliff', 'rock', 'waterfall', 'beach', 'cave_entrance'].includes(natural)) {
    let label = 'Punto Panoramico / Natura';
    let icon = '🏔️';
    if (natural === 'peak') label = 'Vetta / Cima';
    else if (natural === 'waterfall') {
      label = 'Cascata';
      icon = '🌊';
    } else if (natural === 'beach') {
      label = 'Spiaggia';
      icon = '🏖️';
    }
    return { category: 'poi', categoryLabel: label, icon, type: natural };
  }

  // Tourism & Attractions
  if (['attraction', 'viewpoint', 'museum', 'theme_park', 'gallery', 'artwork'].includes(tourism)) {
    let label = 'Punto di Interesse';
    let icon = '📸';
    if (tourism === 'viewpoint') {
      label = 'Belvedere / Vista Panoramica';
      icon = '🔭';
    } else if (tourism === 'museum') {
      label = 'Museo';
      icon = '🏛️';
    }
    return { category: 'poi', categoryLabel: label, icon, type: tourism };
  }

  // Leisure / Parks
  if (['park', 'nature_reserve'].includes(leisure)) {
    return { category: 'poi', categoryLabel: 'Parco Naturale', icon: '🌲', type: leisure };
  }

  return { category: 'standard', categoryLabel: 'Punto d\'Interesse', icon: '📍', type: 'point' };
}

// Fetch POIs in map bounds via Overpass API
export async function fetchPOIsInBounds(bounds: MapBounds, maxResults: number = 40): Promise<MapPOI[]> {
  // Round coordinates to ~100m grid for caching
  const cacheKey = `${bounds.south.toFixed(3)},${bounds.west.toFixed(3)},${bounds.north.toFixed(3)},${bounds.east.toFixed(3)}`;
  if (poiCache.has(cacheKey)) {
    return poiCache.get(cacheKey)!;
  }

  // Keep bounding box reasonably sized
  const latDiff = Math.abs(bounds.north - bounds.south);
  const lngDiff = Math.abs(bounds.east - bounds.west);
  if (latDiff > 0.4 || lngDiff > 0.4) {
    // Area too large to query individual POIs, return empty
    return [];
  }

  const query = `
    [out:json][timeout:6];
    (
      node["amenity"~"restaurant|cafe|bar|pub|fast_food|parking"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      node["tourism"~"attraction|viewpoint|museum|hotel|guest_house|hostel|camp_site|chalet|alpine_hut"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      node["historic"~"castle|monument|ruins|archaeological_site|memorial"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
      node["natural"~"peak|waterfall|beach|viewpoint"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});
    );
    out body ${maxResults};
  `;

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ];

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) continue;

      const data = await res.json();
      if (!data.elements || !Array.isArray(data.elements)) continue;

      const pois: MapPOI[] = [];
      const seenNames = new Set<string>();

      for (const el of data.elements) {
        if (!el.lat || !el.lon || !el.tags) continue;
        const name = el.tags.name || el.tags['name:it'] || el.tags['name:en'];
        if (!name || name.trim().length === 0) continue;

        // Avoid exact duplicate names overlapping at same position
        const key = `${name.toLowerCase()}-${el.lat.toFixed(3)}-${el.lon.toFixed(3)}`;
        if (seenNames.has(key)) continue;
        seenNames.add(key);

        const { category, categoryLabel, icon, type } = classifyOsmTags(el.tags);

        pois.push({
          id: `poi-osm-${el.id}`,
          osmId: el.id,
          name: name.trim(),
          lat: el.lat,
          lng: el.lon,
          category,
          categoryLabel,
          type,
          icon,
        });

        if (pois.length >= maxResults) break;
      }

      poiCache.set(cacheKey, pois);
      return pois;
    } catch {
      // Try next endpoint on failure
      continue;
    }
  }

  return [];
}
