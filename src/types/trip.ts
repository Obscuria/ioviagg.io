export type WaypointCategory = 'standard' | 'poi' | 'parking' | 'stay';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address?: string;
  category: WaypointCategory;
  stopDurationMin?: number;
}

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
  summary?: string;
}

export interface RouteData {
  coordinates: [number, number][]; // [lat, lng]
  distanceKm: number;
  durationMinutes: number;
  legs: RouteLeg[];
}

export interface TripPreset {
  id: string;
  name: string;
  region: string;
  description: string;
  waypoints: {
    lat: number;
    lng: number;
    title: string;
    address?: string;
    category?: WaypointCategory;
  }[];
}

export interface SearchResult {
  id: string;
  name: string;
  displayName: string;
  lat: number;
  lng: number;
  category: WaypointCategory;
  categoryLabel: string;
  rawType?: string;
}
