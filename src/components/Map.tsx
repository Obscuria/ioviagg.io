import React, { useEffect, useState, useCallback } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import L from 'leaflet';
import type { Waypoint, RouteData, SearchResult, WaypointCategory } from '../types/trip';
import { SearchBar, CategoryBadge } from './SearchBar';
import { reverseGeocode } from '../services/osrm';
import {
  Trash2,
  Clock,
  Navigation,
  X,
  Sparkles,
  Loader2,
  Check,
} from 'lucide-react';

interface PendingPoint {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  category: WaypointCategory;
  isLoading: boolean;
}

interface MapProps {
  waypoints: Waypoint[];
  routeData: RouteData | null;
  onAddWaypoint: (data: {
    lat: number;
    lng: number;
    title?: string;
    address?: string;
    category?: WaypointCategory;
  }) => void;
  onRemoveWaypoint: (id: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onChangeCategory: (id: string, category: WaypointCategory) => void;
  selectedWaypointId?: string | null;
}

// Map Invalidator & Resizer Component: ensures Leaflet container bounds are always synced with DOM
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    // Invalidate size immediately and after layout settling
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);
    const timer3 = setTimeout(() => map.invalidateSize(), 600);

    const container = map.getContainer();
    let resizeObserver: ResizeObserver | null = null;
    if (container && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        map.invalidateSize();
      });
      resizeObserver.observe(container);
    }

    const handleWindowResize = () => {
      map.invalidateSize();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [map]);

  return null;
}

// Map Click Listener Component: opens confirmation popup at clicked point
function MapEvents({
  onMapClick,
}: {
  onMapClick: (coords: { lat: number; lng: number }) => void;
}) {
  const map = useMap();

  useMapEvents({
    click(e) {
      // Sync map container size just in case before handling click
      map.invalidateSize({ debounceMoveend: true });

      // Avoid firing map click if the click originated inside a popup, control, or button
      const target = e.originalEvent?.target as HTMLElement | null;
      if (
        target &&
        (target.closest('.leaflet-popup') ||
          target.closest('.leaflet-control') ||
          target.closest('button') ||
          target.closest('input'))
      ) {
        return;
      }
      onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// Auto Fit Bounds Component
function MapBoundsController({
  waypoints,
  routeCoordinates,
}: {
  waypoints: Waypoint[];
  routeCoordinates?: [number, number][];
}) {
  const map = useMap();

  useEffect(() => {
    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: false });
    } else if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
      if (waypoints.length === 1) {
        map.setView([waypoints[0].lat, waypoints[0].lng], 10, { animate: false });
      } else {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: false });
      }
    }
  }, [waypoints, routeCoordinates, map]);

  return null;
}

// Custom DivIcon Generator for categorized / styled Waypoints
function createWaypointIcon(
  waypoint: Waypoint,
  index: number,
  total: number,
  isSelected: boolean
) {
  const isStart = index === 0;
  const isEnd = index === total - 1 && total > 1;
  const category = waypoint.category || 'standard';

  let bgGradient = 'from-indigo-600 to-blue-600 border-indigo-300';
  let badgeContent = `${index + 1}`;
  let ringColor = 'ring-indigo-400/40';
  let pointerBg = 'bg-blue-600';

  if (category === 'poi') {
    bgGradient = 'from-amber-500 to-yellow-600 border-amber-200';
    badgeContent = '🏔️';
    ringColor = 'ring-amber-400/60 shadow-amber-500/50';
    pointerBg = 'bg-yellow-600';
  } else if (category === 'parking') {
    bgGradient = 'from-blue-600 to-cyan-700 border-blue-200';
    badgeContent = '🅿️';
    ringColor = 'ring-blue-400/60 shadow-blue-500/50';
    pointerBg = 'bg-cyan-700';
  } else if (category === 'stay') {
    bgGradient = 'from-purple-600 to-indigo-700 border-purple-200';
    badgeContent = '🛏️';
    ringColor = 'ring-purple-400/60 shadow-purple-500/50';
    pointerBg = 'bg-indigo-700';
  } else {
    // Standard waypoint
    if (isStart) {
      bgGradient = 'from-emerald-500 to-teal-600 border-emerald-200';
      badgeContent = '1';
      ringColor = 'ring-emerald-400/50';
      pointerBg = 'bg-teal-600';
    } else if (isEnd) {
      bgGradient = 'from-rose-500 to-red-600 border-rose-200';
      badgeContent = '🏁';
      ringColor = 'ring-rose-400/50';
      pointerBg = 'bg-red-600';
    }
  }

  const selectedClass = isSelected ? 'scale-110 ring-4 ring-white shadow-2xl' : '';

  const html = `
    <div class="custom-waypoint-pin cursor-pointer ${selectedClass}">
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr ${bgGradient} text-white font-bold text-xs shadow-xl border-2 ${ringColor} ring-4 transition-all duration-150">
        <span class="leading-none select-none">${badgeContent}</span>
      </div>
      <div class="-mt-1 w-2.5 h-2.5 ${pointerBg} rotate-45 border-r border-b border-white/60"></div>
    </div>
  `;

  return L.divIcon({
    className: 'custom-leaflet-marker bg-transparent border-0',
    html,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
  });
}

// Clean static icon for pending preview marker
function createPendingPreviewIcon(category: WaypointCategory) {
  const iconEmoji =
    category === 'poi'
      ? '🏔️'
      : category === 'parking'
      ? '🅿️'
      : category === 'stay'
      ? '🛏️'
      : '➕';

  const html = `
    <div class="custom-waypoint-pin cursor-pointer">
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 text-white font-bold text-xs shadow-2xl border-2 border-white ring-4 ring-emerald-400/50">
        <span class="leading-none select-none">${iconEmoji}</span>
      </div>
      <div class="-mt-1 w-2.5 h-2.5 bg-teal-500 rotate-45 border-r border-b border-white"></div>
    </div>
  `;

  return L.divIcon({
    className: 'pending-leaflet-marker bg-transparent border-0',
    html,
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -42],
  });
}

export const Map: React.FC<MapProps> = ({
  waypoints,
  routeData,
  onAddWaypoint,
  onRemoveWaypoint,
  onSelectSearchResult,
  onChangeCategory,
  selectedWaypointId,
}) => {
  const defaultCenter: [number, number] = [42.5, 12.5];
  const defaultZoom = 6;

  // Pending point state for click confirmation
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);

  // Handle map click: initiate pending point with preview & confirmation popup
  const handleMapClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setPendingPoint({
      lat: coords.lat,
      lng: coords.lng,
      title: 'Località selezionata...',
      category: 'standard',
      isLoading: true,
    });

    try {
      const address = await reverseGeocode(coords.lat, coords.lng);
      setPendingPoint((prev) => {
        if (!prev || prev.lat !== coords.lat || prev.lng !== coords.lng) return prev;
        return {
          ...prev,
          title: address,
          address,
          isLoading: false,
        };
      });
    } catch {
      setPendingPoint((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          title: `${coords.lat.toFixed(4)}°, ${coords.lng.toFixed(4)}°`,
          isLoading: false,
        };
      });
    }
  }, []);

  // Confirm pending point addition
  const handleConfirmPendingPoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!pendingPoint) return;
    onAddWaypoint({
      lat: pendingPoint.lat,
      lng: pendingPoint.lng,
      title: pendingPoint.title,
      address: pendingPoint.address,
      category: pendingPoint.category,
    });
    setPendingPoint(null);
  };

  // Cancel pending point
  const handleCancelPendingPoint = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPendingPoint(null);
  };

  return (
    <div className="relative w-full h-full bg-slate-950 overflow-hidden select-none">
      {/* Floating Top Search Bar */}
      <div className="absolute top-4 left-4 z-[400] max-w-sm sm:max-w-md w-full">
        <SearchBar onSelectPlace={onSelectSearchResult} />
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        className="w-full h-full z-0"
        zoomControl={false}
      >
        {/* Dynamic Resize & Container Bounds Synchronizer */}
        <MapResizer />

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors | OSRM'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Map Click Handler */}
        <MapEvents onMapClick={handleMapClick} />

        {/* Camera auto fit controller */}
        <MapBoundsController
          waypoints={waypoints}
          routeCoordinates={routeData?.coordinates}
        />

        {/* Polyline Route */}
        {routeData && routeData.coordinates.length > 0 && (
          <>
            {/* Outer Glow / Casing */}
            <Polyline
              positions={routeData.coordinates}
              pathOptions={{
                color: '#38bdf8',
                weight: 8,
                opacity: 0.35,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
            {/* Core Route Line */}
            <Polyline
              positions={routeData.coordinates}
              pathOptions={{
                color: '#6366f1',
                weight: 5,
                opacity: 0.95,
                lineCap: 'round',
                lineJoin: 'round',
              }}
            />
          </>
        )}

        {/* Pending Point Preview Marker with Confirmation Popup */}
        {pendingPoint && (
          <Marker
            position={[pendingPoint.lat, pendingPoint.lng]}
            icon={createPendingPreviewIcon(pendingPoint.category)}
          >
            <Popup
              className="custom-popup"
              closeButton={false}
              autoPan={true}
            >
              <div
                className="p-3.5 min-w-[240px] text-slate-100 space-y-2.5"
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    <span>Conferma Nuova Tappa</span>
                  </span>
                  <button
                    onClick={handleCancelPendingPoint}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
                    title="Chiudi / Annulla"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Place Name / Address */}
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-1.5 line-clamp-1">
                    {pendingPoint.isLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Rilevamento località...</span>
                      </>
                    ) : (
                      pendingPoint.title
                    )}
                  </h4>
                  {pendingPoint.address && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {pendingPoint.address}
                    </p>
                  )}
                  <div className="text-[11px] text-slate-500 mt-1 font-mono flex items-center gap-1">
                    <Navigation className="w-3 h-3 text-slate-500" />
                    <span>
                      {pendingPoint.lat.toFixed(4)}°, {pendingPoint.lng.toFixed(4)}°
                    </span>
                  </div>
                </div>

                {/* Category Selection Pills */}
                <div className="space-y-1 pt-1 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Seleziona Tipologia:
                  </span>
                  <div className="grid grid-cols-4 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'standard' } : null));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                        pendingPoint.category === 'standard'
                          ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/50 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      📍 Base
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'poi' } : null));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                        pendingPoint.category === 'poi'
                          ? 'bg-amber-500/30 text-amber-300 border border-amber-500/50 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🏔️ POI
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'parking' } : null));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                        pendingPoint.category === 'parking'
                          ? 'bg-blue-500/30 text-blue-300 border border-blue-500/50 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🅿️ Park
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'stay' } : null));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                        pendingPoint.category === 'stay'
                          ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🛏️ Notte
                    </button>
                  </div>
                </div>

                {/* Confirmation Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={handleConfirmPendingPoint}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aggiungi Tappa</span>
                  </button>

                  <button
                    onClick={handleCancelPendingPoint}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors"
                  >
                    Annulla
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Existing Waypoint Markers */}
        {waypoints.map((waypoint, index) => {
          const isSelected = waypoint.id === selectedWaypointId;

          return (
            <Marker
              key={waypoint.id}
              position={[waypoint.lat, waypoint.lng]}
              icon={createWaypointIcon(waypoint, index, waypoints.length, isSelected)}
            >
              <Popup className="custom-popup" closeButton={false}>
                <div
                  className="p-3.5 min-w-[220px] text-slate-100"
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Tappa #{index + 1}
                    </span>
                    <CategoryBadge category={waypoint.category} />
                  </div>

                  <h4 className="font-semibold text-sm text-white line-clamp-1">
                    {waypoint.title}
                  </h4>
                  {waypoint.address && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {waypoint.address}
                    </p>
                  )}

                  <div className="text-[11px] text-slate-400 mt-2 font-mono flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-slate-500" />
                    <span>
                      {waypoint.lat.toFixed(4)}°, {waypoint.lng.toFixed(4)}°
                    </span>
                  </div>

                  {/* Quick Category Selector */}
                  <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Tipologia Segnalino:
                    </span>
                    <div className="grid grid-cols-4 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'standard');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1.5 rounded text-center transition-colors ${
                          waypoint.category === 'standard'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Tappa Standard"
                      >
                        📍 Base
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'poi');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1.5 rounded text-center transition-colors ${
                          waypoint.category === 'poi'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Punto di Interesse / Natura / Montagna"
                      >
                        🏔️ POI
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'parking');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1.5 rounded text-center transition-colors ${
                          waypoint.category === 'parking'
                            ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Parcheggio"
                      >
                        🅿️ Park
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'stay');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1.5 rounded text-center transition-colors ${
                          waypoint.category === 'stay'
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Pernottamento / Hotel"
                      >
                        🛏️ Notte
                      </button>
                    </div>
                  </div>

                  {/* Bottom Actions */}
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {waypoint.stopDurationMin || 0}m sosta
                    </span>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWaypoint(waypoint.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition-colors"
                      title="Rimuovi tappa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Rimuovi</span>
                    </button>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Floating Map Helper Badge */}
      <div className="absolute top-4 right-4 z-[400] pointer-events-none hidden sm:block">
        <div className="bg-slate-900/90 border border-slate-800 px-3.5 py-2 rounded-xl shadow-lg flex items-center gap-2.5 text-xs text-slate-300">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Clicca sulla mappa per visualizzare l'anteprima e confermare la tappa</span>
        </div>
      </div>
    </div>
  );
};
