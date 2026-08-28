import { useState, useEffect, useCallback, useMemo } from 'react';
import type { Waypoint, RouteData, SearchResult, WaypointCategory } from './types/trip';
import { fetchOSRMRoute, reverseGeocode } from './services/osrm';
import { Sidebar } from './components/Sidebar';
import { Map } from './components/Map';
import { Compass, Route } from 'lucide-react';

const STORAGE_KEY = 'ioviaggio_trip_v1';

interface SavedTripData {
  waypoints: Waypoint[];
  totalDays: number;
  dayDepartureTimes: Record<number, string>;
  activeDayTab: number | null;
}

function getInitialTripData(): SavedTripData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.waypoints)) {
        return {
          waypoints: parsed.waypoints,
          totalDays: typeof parsed.totalDays === 'number' && parsed.totalDays >= 1 ? parsed.totalDays : 1,
          dayDepartureTimes: parsed.dayDepartureTimes || { 1: '09:00' },
          activeDayTab: typeof parsed.activeDayTab === 'number' || parsed.activeDayTab === null ? parsed.activeDayTab : null,
        };
      }
    }
  } catch {
    // localStorage might be unavailable or disabled
  }
  return {
    waypoints: [],
    totalDays: 1,
    dayDepartureTimes: { 1: '09:00' },
    activeDayTab: null,
  };
}

export function App() {
  const initialData = useMemo(() => getInitialTripData(), []);

  // Number of trip days & active day tab filter (loaded from localStorage if available)
  const [totalDays, setTotalDays] = useState<number>(initialData.totalDays);
  const [activeDayTab, setActiveDayTab] = useState<number | null>(initialData.activeDayTab);

  // Persistent waypoints
  const [waypoints, setWaypoints] = useState<Waypoint[]>(initialData.waypoints);

  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [dayDepartureTimes, setDayDepartureTimes] = useState<Record<number, string>>(
    initialData.dayDepartureTimes
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedWaypointId, setSelectedWaypointId] = useState<string | null>(null);
  const [fitTrigger, setFitTrigger] = useState<number>(0);

  // Mobile view mode toggle for small screens ('map' | 'sidebar')
  const [mobileView, setMobileView] = useState<'map' | 'sidebar'>('map');

  // Automatically persist trip data to localStorage on every change
  useEffect(() => {
    try {
      const dataToSave: SavedTripData = {
        waypoints,
        totalDays,
        dayDepartureTimes,
        activeDayTab,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    } catch (e) {
      console.warn('Unable to persist trip data to localStorage:', e);
    }
  }, [waypoints, totalDays, dayDepartureTimes, activeDayTab]);

  const handleSetDayDepartureTime = useCallback((day: number, time: string) => {
    setDayDepartureTimes((prev) => ({
      ...prev,
      [day]: time,
    }));
  }, []);

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
        setError('Impossibile calcolare il percorso. Verifica la connessione.');
      }
      setRouteData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    calculateRoute(waypoints);
  }, [waypoints, calculateRoute]);

  // Add a new day to the trip
  const handleAddDay = useCallback(() => {
    setTotalDays((prev) => {
      const nextDay = prev + 1;
      setDayDepartureTimes((times) => ({ ...times, [nextDay]: '09:00' }));
      return nextDay;
    });
  }, []);

  // Force set total days (used when user types or confirms changes)
  const handleSetTotalDays = useCallback((count: number) => {
    const validCount = Math.max(1, count);
    setTotalDays(validCount);
    // If activeDayTab is beyond new total, reset it
    setActiveDayTab((prev) => (prev && prev > validCount ? null : prev));
  }, []);

  // Remove a specific day and its waypoints
  const handleRemoveDayConfirmed = useCallback((dayToRemove: number) => {
    setWaypoints((prev) => {
      // Remove waypoints of the removed day, and shift subsequent days down by 1
      return prev
        .filter((w) => (w.day || 1) !== dayToRemove)
        .map((w) => {
          const currentDay = w.day || 1;
          if (currentDay > dayToRemove) {
            return { ...w, day: currentDay - 1 };
          }
          return w;
        });
    });

    setDayDepartureTimes((prev) => {
      const nextTimes: Record<number, string> = {};
      let nextDayIdx = 1;
      for (let d = 1; d <= totalDays; d++) {
        if (d === dayToRemove) continue;
        nextTimes[nextDayIdx] = prev[d] || '09:00';
        nextDayIdx++;
      }
      return nextTimes;
    });

    setTotalDays((prev) => {
      const nextCount = Math.max(1, prev - 1);
      setActiveDayTab((cur) => (cur && cur >= nextCount ? null : cur));
      return nextCount;
    });
  }, [totalDays]);

  // Swap two days (e.g. Day 1 with Day 3) and maintain focus on the swapped day
  const handleSwapDays = useCallback((dayA: number, dayB: number) => {
    if (dayA === dayB) return;
    setWaypoints((prev) =>
      prev.map((w) => {
        const currentDay = w.day || 1;
        if (currentDay === dayA) return { ...w, day: dayB };
        if (currentDay === dayB) return { ...w, day: dayA };
        return w;
      })
    );

    setDayDepartureTimes((prev) => {
      const timeA = prev[dayA] || '09:00';
      const timeB = prev[dayB] || '09:00';
      return {
        ...prev,
        [dayA]: timeB,
        [dayB]: timeA,
      };
    });

    // Follow the swapped day to its new index so the user remains on the day they just moved
    setActiveDayTab((currentTab) => {
      if (currentTab === dayA) return dayB;
      if (currentTab === dayB) return dayA;
      return currentTab;
    });
  }, []);

  // Change single waypoint's day
  const handleChangeWaypointDay = useCallback((waypointId: string, newDay: number) => {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === waypointId ? { ...w, day: Math.max(1, newDay) } : w))
    );
  }, []);

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

      const targetDay = activeDayTab !== null ? activeDayTab : 1;

      const newWaypoint: Waypoint = {
        id: newId,
        lat,
        lng,
        title: title || defaultTitle,
        address: address || undefined,
        category,
        stopDurationMin: calculatedDuration,
        day: targetDay,
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
    [waypoints.length, activeDayTab]
  );

  // Add waypoint from textual SearchBar (with automatically detected category)
  const handleSelectSearchResult = useCallback(
    (result: SearchResult) => {
      const newId = `search-wp-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const defaultDuration =
        result.category === 'stay'
          ? 480
          : result.category === 'food'
          ? 45
          : result.category === 'poi'
          ? 60
          : 15;

      const targetDay = activeDayTab !== null ? activeDayTab : 1;

      const newWaypoint: Waypoint = {
        id: newId,
        lat: result.lat,
        lng: result.lng,
        title: result.name,
        address: result.displayName,
        category: result.category,
        stopDurationMin: defaultDuration,
        day: targetDay,
      };

      setWaypoints((prev) => [...prev, newWaypoint]);
      setSelectedWaypointId(newId);
    },
    [activeDayTab]
  );

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
      prev.map((w) => (w.id === id ? { ...w, stopDurationMin: Math.max(0, durationMinutes) } : w))
    );
  }, []);

  // Rename waypoint title
  const handleRenameWaypoint = useCallback((id: string, newTitle: string) => {
    setWaypoints((prev) =>
      prev.map((w) => (w.id === id ? { ...w, title: newTitle } : w))
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
    setTotalDays(1);
    setDayDepartureTimes({ 1: '09:00' });
    setActiveDayTab(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      console.warn('Unable to clear localStorage:', e);
    }
  }, []);

  // Determine if trip is already a closed loop (start == end)
  const isLoopClosed = useMemo(() => {
    if (waypoints.length < 2) return false;
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    return (
      Math.abs(first.lat - last.lat) < 0.0001 &&
      Math.abs(first.lng - last.lng) < 0.0001
    );
  }, [waypoints]);

  // Toggle close/open loop itinerary (returns to starting point)
  const handleToggleCloseLoop = useCallback(() => {
    if (waypoints.length < 2) return;
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    const isClosed =
      Math.abs(first.lat - last.lat) < 0.0001 &&
      Math.abs(first.lng - last.lng) < 0.0001;

    if (isClosed) {
      // Remove return waypoint
      setWaypoints((prev) => prev.slice(0, -1));
    } else {
      // Add return waypoint
      const newId = `loop-return-${Date.now()}`;
      const returnWaypoint: Waypoint = {
        id: newId,
        lat: first.lat,
        lng: first.lng,
        title: `Ritorno a ${first.title}`,
        address: first.address,
        category: 'standard',
        stopDurationMin: 0,
        day: totalDays,
      };
      setWaypoints((prev) => [...prev, returnWaypoint]);
      setSelectedWaypointId(newId);
    }
  }, [waypoints, totalDays]);

  // Handle waypoint selection (if on mobile, switch view to map)
  const handleSelectWaypoint = useCallback((id: string | null) => {
    setSelectedWaypointId(id);
    if (id && typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobileView('map');
    }
  }, []);

  return (
    <div className="flex flex-col md:flex-row w-screen h-[100dvh] overflow-hidden bg-slate-950">
      {/* Sidebar on Left (Desktop: Always visible side column; Mobile: full screen if active) */}
      <div
        className={`w-full md:w-[350px] lg:w-[375px] h-[100dvh] shrink-0 z-20 ${
          mobileView === 'sidebar' ? 'flex flex-col' : 'hidden md:flex md:flex-col'
        }`}
      >
        <Sidebar
          waypoints={waypoints}
          routeData={routeData}
          dayDepartureTimes={dayDepartureTimes}
          onSetDayDepartureTime={handleSetDayDepartureTime}
          totalDays={totalDays}
          activeDayTab={activeDayTab}
          onActiveDayTabChange={setActiveDayTab}
          onAddDay={handleAddDay}
          onSetTotalDays={handleSetTotalDays}
          onRemoveDay={handleRemoveDayConfirmed}
          onSwapDays={handleSwapDays}
          onChangeWaypointDay={handleChangeWaypointDay}
          onRenameWaypoint={handleRenameWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          onReorderWaypoint={handleReorderWaypoint}
          onChangeCategory={handleChangeCategory}
          onChangeStopDuration={handleChangeStopDuration}
          onClearTrip={handleClearTrip}
          isLoopClosed={isLoopClosed}
          onToggleCloseLoop={handleToggleCloseLoop}
          isLoading={isLoading}
          error={error}
          selectedWaypointId={selectedWaypointId}
          onSelectWaypoint={handleSelectWaypoint}
        />
      </div>

      {/* Interactive Map on Right with SearchBar (Desktop: flex-1; Mobile: full screen if active) */}
      <main
        className={`flex-1 h-[100dvh] relative ${
          mobileView === 'map' ? 'block' : 'hidden md:block'
        }`}
      >
        <Map
          waypoints={waypoints}
          routeData={routeData}
          onAddWaypoint={handleAddWaypoint}
          onRenameWaypoint={handleRenameWaypoint}
          onRemoveWaypoint={handleRemoveWaypoint}
          onSelectSearchResult={handleSelectSearchResult}
          onChangeCategory={handleChangeCategory}
          onChangeStopDuration={handleChangeStopDuration}
          selectedWaypointId={selectedWaypointId}
          isLoopClosed={isLoopClosed}
          onToggleCloseLoop={handleToggleCloseLoop}
          fitTrigger={fitTrigger}
          onFitRoute={handleFitRoute}
        />
      </main>

      {/* Floating Mobile Mode Switcher (Visible only on mobile screens < md) */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] flex items-center bg-slate-900/95 backdrop-blur-2xl border border-slate-700/90 p-1 rounded-2xl shadow-2xl">
        <button
          onClick={() => setMobileView('map')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mobileView === 'map'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          <span>Mappa</span>
        </button>
        <button
          onClick={() => setMobileView('sidebar')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            mobileView === 'sidebar'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Route className="w-3.5 h-3.5" />
          <span>Itinerario {waypoints.length > 0 ? `(${waypoints.length})` : ''}</span>
        </button>
      </div>
    </div>
  );
}

export default App;
