import { useState, useEffect, useCallback } from 'react';
import type { Waypoint, RouteData, TripPreset, SearchResult, WaypointCategory } from './types/trip';
import { fetchOSRMRoute, reverseGeocode } from './services/osrm';
import { Sidebar } from './components/Sidebar';
import { Map } from './components/Map';
import { TRIP_PRESETS } from './data/presets';

export function App() {
  // Initialize with the Tuscany tour by default for instant delight
  const [waypoints, setWaypoints] = useState<Waypoint[]>(() => {
    const initialPreset = TRIP_PRESETS[0];
    return initialPreset.waypoints.map((w, idx) => {
      const cat = w.category || (idx === 0 ? 'standard' : idx === 1 ? 'food' : idx === 2 ? 'poi' : idx === 3 ? 'parking' : 'stay');
      const defaultDuration = cat === 'stay' ? 480 : cat === 'food' ? 45 : cat === 'poi' ? 60 : 15;
      return {
        id: `initial-${idx}-${Date.now()}`,
        lat: w.lat,
        lng: w.lng,
        title: w.title,
        address: w.address,
        category: cat,
        stopDurationMin: defaultDuration,
      };
    });
  });

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [departureTime, setDepartureTime] = useState<string>('09:00');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  const handleFitRoute = useCallback(() => {
    setFitTrigger((prev) => prev + 1);
  }, []);

  // Recalculate route whenever waypoints change
  const calculateRoute = useCallback(async (currentWaypoints: Waypoint[]) => {
    if (currentWaypoints.length < 2) {
      setRouteData(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await fetchOSRMRoute(currentWaypoints);
      setRouteData(data);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Impossibile calcolare il percorso stradale.');
      }
      setRouteData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateRoute(waypoints);
  }, [waypoints, calculateRoute]);

  // Add waypoint from map confirmation, POI click, or search
  const handleAddWaypoint = useCallback(
    async ({
      lat,
      lng,
      title,
      address,
      category = 'standard',
      stopDurationMin,
    }: {
      lat: number;
      lng: number;
      title?: string;
      address?: string;
      category?: WaypointCategory;
      stopDurationMin?: number;
    }) => {
      const nextIndex = waypoints.length + 1;
      const defaultTitle = `Tappa ${nextIndex}`;
      const newId = `wp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

      const calculatedDuration =
        stopDurationMin !== undefined
          ? stopDurationMin
          : category === 'stay'
          ? 480
          : category === 'food'
          ? 45
          : category === 'poi'
          ? 60
          : 15;

      const newWaypoint: Waypoint = {
        id: newId,
        lat,
        lng,
        title: title || defaultTitle,
        address: address || undefined,
        category,
        stopDurationMin: calculatedDuration,
      };

      setWaypoints((prev) => [...prev, newWaypoint]);
      setSelectedWaypointId(newId);

      // Reverse geocode asynchronously in background to enrich the name if not provided
      if (!title || !address) {
        try {
          const resolvedAddress = await reverseGeocode(lat, lng);
          setWaypoints((prev) =>
            prev.map((w) =>
              w.id === newId
                ? {
                    ...w,
                    title: title || resolvedAddress || defaultTitle,
                    address: resolvedAddress,
                  }
                : w
            )
          );
        } catch {
          // Keep default title if geocoding fails
        }
      }
    },
    [waypoints.length]
  );

  // Add waypoint from textual SearchBar (with automatically detected category)
  const handleSelectSearchResult = useCallback((result: SearchResult) => {
    const newId = `search-wp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const defaultDuration =
      result.category === 'stay'
        ? 480
        : result.category === 'food'
        ? 45
        : result.category === 'poi'
        ? 60
        : 15;

    const newWaypoint: Waypoint = {
      id: newId,
      lat: result.lat,
      lng: result.lng,
      title: result.name,
      address: result.displayName,
      category: result.category,
      stopDurationMin: defaultDuration,
    };

    setWaypoints((prev) => [...prev, newWaypoint]);
    setSelectedWaypointId(newId);
  }, []);

  // Update waypoint category manually (from sidebar or map popup)
  const handleChangeCategory = useCallback((id: string, newCategory: WaypointCategory) => {
    const defaultDuration =
      newCategory === 'stay'
        ? 480
        : newCategory === 'food'
        ? 45
        : newCategory === 'poi'
        ? 60
        : 15;

    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id
          ? {
              ...w,
              category: newCategory,
              stopDurationMin: w.stopDurationMin ? w.stopDurationMin : defaultDuration,
            }
          : w
      )
    );
  }, []);

  // Update stop duration for a specific waypoint
  const handleChangeStopDuration = useCallback((id: string, durationMinutes: number) => {
    setWaypoints((prev) =>
      prev.map((w) =>
        w.id === id ? { ...w, stopDurationMin: Math.max(0, durationMinutes) } : w
      )
    );
  }, []);

  // Remove waypoint
  const handleRemoveWaypoint = useCallback((id: string) => {
    setWaypoints((prev) => prev.filter((w) => w.id !== id));
    setSelectedWaypointId((prev) => (prev === id ? null : prev));
  }, []);

  // Reorder waypoint
  const handleReorderWaypoint = useCallback((index: number, direction: 'up' | 'down') => {
    setWaypoints((prev) => {
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const newWaypoints = [...prev];
      const temp = newWaypoints[index];
      newWaypoints[index] = newWaypoints[targetIndex];
      newWaypoints[targetIndex] = temp;
      return newWaypoints;
    });
  }, []);

  // Clear trip
  const handleClearTrip = useCallback(() => {
    setWaypoints([]);
    setRouteData(null);
    setError(null);
    setSelectedWaypointId(null);
  }, []);

  // Load preset itinerary
  const handleLoadPreset = useCallback((preset: TripPreset) => {
    const loadedWaypoints: Waypoint[] = preset.waypoints.map((w, idx) => {
      const cat = w.category || 'standard';
      const defaultDuration = cat === 'stay' ? 480 : cat === 'food' ? 45 : cat === 'poi' ? 60 : 15;
      return {
        id: `preset-${idx}-${Date.now()}`,
        lat: w.lat,
        lng: w.lng,
        title: w.title,
        address: w.address,
        category: cat,
        stopDurationMin: defaultDuration,
      };
    });
    setWaypoints(loadedWaypoints);
    setSelectedWaypointId(null);
    setFitTrigger((prev) => prev + 1);
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-screen h-screen overflow-hidden bg-slate-950">
      {/* Sidebar on Left */}
      <Sidebar
        waypoints={waypoints}
        routeData={routeData}
        departureTime={departureTime}
        onDepartureTimeChange={setDepartureTime}
        onRemoveWaypoint={handleRemoveWaypoint}
        onReorderWaypoint={handleReorderWaypoint}
        onChangeCategory={handleChangeCategory}
        onChangeStopDuration={handleChangeStopDuration}
        onClearTrip={handleClearTrip}
        onLoadPreset={handleLoadPreset}
        isLoading={isLoading}
        error={error}
        selectedWaypointId={selectedWaypointId}
        onSelectWaypoint={setSelectedWaypointId}
      />

      {/* Interactive Map on Right with SearchBar */}
      <main className="flex-1 h-[50vh] md:h-full relative">
        <Map
          waypoints={waypoints}
          routeData={routeData}
          onAddWaypoint={handleAddWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          onSelectSearchResult={handleSelectSearchResult}
          onChangeCategory={handleChangeCategory}
          onChangeStopDuration={handleChangeStopDuration}
          selectedWaypointId={selectedWaypointId}
          fitTrigger={fitTrigger}
          onFitRoute={handleFitRoute}
        />
      </main>
    </div>
  );
}

export default App;
