import type { SearchResult, WaypointCategory } from '../types/trip';

function mapOSMToCategory(item: {
  class?: string;
  type?: string;
  osm_key?: string;
  osm_value?: string;
  category?: string;
}): { category: WaypointCategory; categoryLabel: string } {
  const osmKey = (item.osm_key || item.class || '').toLowerCase();
  const osmValue = (item.osm_value || item.type || '').toLowerCase();

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
    ['hotel', 'motel', 'hostel', 'guest_house', 'camp_site', 'caravan_site', 'chalet', 'apartment', 'resort'].includes(
      osmValue
    ) ||
    (osmKey === 'tourism' && ['hotel', 'hostel', 'camp_site', 'motel', 'chalet'].includes(osmValue))
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

export async function searchPlaces(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Use Photon API (Komoot OpenStreetMap search) for ultra-fast POI & natural features search
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
      trimmed
    )}&limit=7&lang=it`;

    const res = await fetch(photonUrl);
    if (res.ok) {
      const data = await res.json();
      if (data.features && data.features.length > 0) {
        return data.features.map(
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

            const name = props.name || props.city || trimmed;
            const contextParts = [props.city, props.state, props.country].filter(Boolean);
            const displayName =
              contextParts.length > 0 ? `${name} (${contextParts.join(', ')})` : name;

            const { category, categoryLabel } = mapOSMToCategory({
              osm_key: props.osm_key,
              osm_value: props.osm_value,
              type: props.type,
            });

            return {
              id: `search-${props.osm_id || index}-${Date.now()}`,
              name,
              displayName,
              lat,
              lng,
              category,
              categoryLabel,
              rawType: props.osm_value || props.type,
            };
          }
        );
      }
    }
  } catch {
    // Fallback to Nominatim if Photon fails
  }

  // Fallback to Nominatim
  try {
    const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
      trimmed
    )}&format=jsonv2&addressdetails=1&extratags=1&limit=7`;

    const res = await fetch(nominatimUrl, {
      headers: { 'Accept-Language': 'it,en' },
    });
    if (!res.ok) return [];

    const items = await res.json();
    return items.map(
      (
        item: {
          place_id: number;
          name?: string;
          display_name: string;
          lat: string;
          lon: string;
          class?: string;
          type?: string;
        },
        index: number
      ) => {
        const name = item.name || item.display_name.split(',')[0].trim();
        const { category, categoryLabel } = mapOSMToCategory({
          class: item.class,
          type: item.type,
        });

        return {
          id: `nom-${item.place_id || index}`,
          name,
          displayName: item.display_name,
          lat: parseFloat(item.lat),
          lng: parseFloat(item.lon),
          category,
          categoryLabel,
          rawType: item.type,
        };
      }
    );
  } catch {
    return [];
  }
}
