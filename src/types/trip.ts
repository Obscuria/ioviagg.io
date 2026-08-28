export type WaypointCategory = 'standard' | 'poi' | 'parking' | 'stay' | 'food';

export interface Waypoint {
  id: string;
  lat: number;
  lng: number;
  title: string;
  address?: string;
  category: WaypointCategory;
  stopDurationMin?: number;
  day?: number;
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
  days?: number;
  waypoints: {
    lat: number;
    lng: number;
    title: string;
    address?: string;
    category?: WaypointCategory;
    day?: number;
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
  distanceKm?: number;
  distanceText?: string;
}
