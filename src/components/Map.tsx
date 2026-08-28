import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Plus,
  Minus,
  Maximize2,
  Layers,
  Repeat,
} from 'lucide-react';

type MapStyle = 'maptiler_streets' | 'maptiler_outdoor' | 'maptiler_voyager' | 'osm' | 'osm_hot' | 'cyclosm' | 'esri_streets' | 'satellite';

const maptilerKey = import.meta.env.VITE_MAPTILER_API_KEY || 'BI0PUr7lAv88pkiFEFeu';

const MAP_STYLES: Record<
  MapStyle,
  {
    name: string;
    url: string;
    attribution: string;
    subdomains?: string;
    maxZoom?: number;
  }
> = {
  maptiler_streets: {
    name: 'MapTiler (100% Occidentale & POI)',
    url: `https://api.maptiler.com/maps/streets-v2/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 20,
  },
  maptiler_outdoor: {
    name: 'MapTiler Outdoor & Parchi (Occidentale)',
    url: `https://api.maptiler.com/maps/outdoor-v2/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 20,
  },
  maptiler_voyager: {
    name: 'MapTiler Voyager (Furkot Style)',
    url: `https://api.maptiler.com/maps/voyager/256/{z}/{x}/{y}.png?key=${maptilerKey}`,
    attribution:
      '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    maxZoom: 20,
  },
  osm: {
    name: 'OpenStreetMap (Dettagliata & POI)',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  },
  osm_hot: {
    name: 'OSM Turistica (Humanitarian)',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, Tiles style by Humanitarian OpenStreetMap Team',
    maxZoom: 19,
  },
  esri_streets: {
    name: 'Esri Occidentale (Strade)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, TomTom',
    maxZoom: 19,
  },
  cyclosm: {
    name: 'Outdoor & Punti di Interesse (CyclOSM)',
    url: 'https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, &copy; <a href="https://www.cyclosm.org">CyclOSM</a>',
    maxZoom: 20,
  },
  satellite: {
    name: 'Satellite (Esri)',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid',
    maxZoom: 19,
  },
};

interface PendingPoint {
  lat: number;
  lng: number;
  title: string;
  address?: string;
  category: WaypointCategory;
  stopDurationMin: number;
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
    stopDurationMin?: number;
  }) => void;
  onRenameWaypoint?: (id: string, newTitle: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onSelectSearchResult: (result: SearchResult) => void;
  onChangeCategory: (id: string, category: WaypointCategory) => void;
  onChangeStopDuration?: (id: string, durationMinutes: number) => void;
  selectedWaypointId?: string | null;
  isLoopClosed?: boolean;
  onToggleCloseLoop?: () => void;
  fitTrigger?: number;
  onFitRoute?: () => void;
}

// Map Invalidator & Resizer Component: ensures Leaflet container bounds are always synced with DOM
function MapResizer() {
  const map = useMap();

  useEffect(() => {
    map.invalidateSize();
    const timer1 = setTimeout(() => map.invalidateSize(), 100);
    const timer2 = setTimeout(() => map.invalidateSize(), 300);

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

// Auto Fit Bounds Component: ONLY fits the camera on initial mount or explicit fit trigger
function MapBoundsController({
  waypoints,
  routeCoordinates,
  fitTrigger,
}: {
  waypoints: Waypoint[];
  routeCoordinates?: [number, number][];
  fitTrigger?: number;
}) {
  const map = useMap();
  const isFirstMount = useRef(true);
  const lastTriggerRef = useRef<number | undefined>(fitTrigger);

  useEffect(() => {
    const shouldFit = isFirstMount.current || fitTrigger !== lastTriggerRef.current;
    if (!shouldFit) return;

    isFirstMount.current = false;
    lastTriggerRef.current = fitTrigger;

    if (routeCoordinates && routeCoordinates.length > 0) {
      const bounds = L.latLngBounds(routeCoordinates);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14, animate: true });
    } else if (waypoints.length > 0) {
      const bounds = L.latLngBounds(waypoints.map((w) => [w.lat, w.lng]));
      if (waypoints.length === 1) {
        map.setView([waypoints[0].lat, waypoints[0].lng], 10, { animate: true });
      } else {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13, animate: true });
      }
    }
  }, [fitTrigger, routeCoordinates, waypoints, map]);

  return null;
}

// Smooth pan controller when a waypoint is selected in the sidebar
function MapPanController({
  selectedWaypoint,
}: {
  selectedWaypoint?: Waypoint | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedWaypoint) {
      map.panTo([selectedWaypoint.lat, selectedWaypoint.lng], { animate: true, duration: 0.5 });
    }
  }, [selectedWaypoint, map]);

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

  if (category === 'food') {
    bgGradient = 'from-orange-500 to-amber-600 border-orange-200';
    badgeContent = '🍽️';
    ringColor = 'ring-orange-400/60 shadow-orange-500/50';
    pointerBg = 'bg-orange-600';
  } else if (category === 'poi') {
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

  const selectedCircleStyle = isSelected
    ? '!ring-4 !ring-white shadow-2xl scale-110'
    : '';

  const html = `
    <div class="custom-waypoint-pin cursor-pointer">
      <div class="relative flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-tr ${bgGradient} text-white font-bold text-xs shadow-xl border-2 ${ringColor} ring-4 transition-all duration-150 ${selectedCircleStyle}">
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
    category === 'food'
      ? '🍽️'
      : category === 'poi'
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
  onRenameWaypoint,
  onRemoveWaypoint,
  onSelectSearchResult,
  onChangeCategory,
  onChangeStopDuration,
  selectedWaypointId,
  isLoopClosed = false,
  onToggleCloseLoop,
  fitTrigger,
  onFitRoute,
}) => {
  const defaultCenter: [number, number] = [42.5, 12.5];
  const defaultZoom = 6;

  // Map Tile Style State (Default: MapTiler 100% Western/Latin with all POIs)
  const [mapStyle, setMapStyle] = useState<MapStyle>('maptiler_streets');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  // Pending point state for click confirmation
  const [pendingPoint, setPendingPoint] = useState<PendingPoint | null>(null);

  const selectedWaypoint = waypoints.find((w) => w.id === selectedWaypointId);

  // Proximity reference location for smart POI and place search
  const proximityLocation = useMemo(() => {
    if (selectedWaypoint) {
      return {
        lat: selectedWaypoint.lat,
        lng: selectedWaypoint.lng,
        label: selectedWaypoint.title,
      };
    }
    if (waypoints.length > 0) {
      const lastWp = waypoints[waypoints.length - 1];
      return {
        lat: lastWp.lat,
        lng: lastWp.lng,
        label: lastWp.title,
      };
    }
    return null;
  }, [selectedWaypoint, waypoints]);

  // Handle map click: initiate pending point with preview & confirmation popup
  const handleMapClick = useCallback(async (coords: { lat: number; lng: number }) => {
    setPendingPoint({
      lat: coords.lat,
      lng: coords.lng,
      title: 'Località selezionata...',
      category: 'standard',
      stopDurationMin: 15,
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
      stopDurationMin: pendingPoint.stopDurationMin,
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
      {/* Floating Top Search Bar (Mobile: top-3 left-3 right-3; Desktop: top-4 left-4 max-w-md) */}
      <div className="absolute top-3 left-3 right-3 sm:right-auto sm:left-4 sm:top-4 z-[400] max-w-none sm:max-w-md">
        <SearchBar
          onSelectPlace={onSelectSearchResult}
          proximityLocation={proximityLocation}
        />
      </div>

      {/* Floating Action Controls (Mobile: top-16 right-3 vertical stack; Desktop: top-4 right-4 horizontal) */}
      <div className="absolute top-16 right-3 sm:top-4 sm:right-4 z-[400] flex flex-col sm:flex-row items-end sm:items-center gap-2">
        {/* Layer Style Switcher */}
        <div className="relative">
          <button
            onClick={() => setShowLayerMenu((prev) => !prev)}
            className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 p-2 sm:px-2.5 sm:py-2 rounded-xl shadow-xl flex items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-all cursor-pointer backdrop-blur-md"
            title="Cambia stile mappa (Occidentale / Satellite / Dark)"
          >
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-semibold">{MAP_STYLES[mapStyle].name}</span>
          </button>

          {showLayerMenu && (
            <div className="absolute right-0 top-11 w-48 sm:w-52 bg-slate-900 border border-slate-700/90 rounded-xl p-1 shadow-2xl z-50 space-y-0.5">
              {(Object.keys(MAP_STYLES) as MapStyle[]).map((key) => (
                <button
                  key={key}
                  onClick={() => {
                    setMapStyle(key);
                    setShowLayerMenu(false);
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    mapStyle === key
                      ? 'bg-indigo-600 text-white font-semibold'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <span className="truncate">{MAP_STYLES[key].name}</span>
                  {mapStyle === key && <Check className="w-3 h-3 text-white shrink-0 ml-1" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {onFitRoute && waypoints.length > 0 && (
          <button
            onClick={onFitRoute}
            className="bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 p-2 sm:px-3 sm:py-2 rounded-xl shadow-xl flex items-center gap-1.5 text-xs text-slate-200 hover:text-white transition-all cursor-pointer backdrop-blur-md"
            title="Inquadra tutto l'itinerario sulla mappa"
          >
            <Maximize2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline font-semibold">Centra Itinerario</span>
          </button>
        )}

        <div className="bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-xl shadow-xl hidden md:flex items-center gap-2 text-xs text-slate-400">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Clicca un punto per aggiungere una tappa</span>
        </div>
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

        {/* Dynamic Tile Layer (Default: Western Voyager) */}
        <TileLayer
          key={mapStyle}
          attribution={MAP_STYLES[mapStyle].attribution}
          url={MAP_STYLES[mapStyle].url}
          subdomains={MAP_STYLES[mapStyle].subdomains || 'abc'}
          maxZoom={MAP_STYLES[mapStyle].maxZoom || 19}
        />

        {/* Map Click Handler */}
        <MapEvents onMapClick={handleMapClick} />

        {/* Camera auto fit controller (Only triggers on fitTrigger change or first mount) */}
        <MapBoundsController
          waypoints={waypoints}
          routeCoordinates={routeData?.coordinates}
          fitTrigger={fitTrigger}
        />

        {/* Smooth camera pan to selected waypoint */}
        <MapPanController selectedWaypoint={selectedWaypoint} />

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
              autoPan={false}
            >
              <div
                className="p-3.5 min-w-[260px] text-slate-100 space-y-2.5"
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

                {/* Place Name Input / Address */}
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center justify-between">
                    <span>Nome Tappa:</span>
                    {pendingPoint.isLoading && (
                      <span className="text-indigo-400 flex items-center gap-1 normal-case font-normal text-[10px]">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Rilevamento...
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    value={pendingPoint.title}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPendingPoint((p) => (p ? { ...p, title: val } : null));
                    }}
                    className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-2.5 py-1.5 text-xs text-white font-semibold focus:ring-1 focus:ring-emerald-400 focus:outline-none placeholder:text-slate-500"
                    placeholder="Nome tappa..."
                  />
                  {pendingPoint.address && (
                    <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                      {pendingPoint.address}
                    </p>
                  )}
                  <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                    <Navigation className="w-2.5 h-2.5 text-slate-500" />
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
                  <div className="grid grid-cols-5 gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'standard', stopDurationMin: 15 } : null));
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
                        setPendingPoint((p) => (p ? { ...p, category: 'food', stopDurationMin: 45 } : null));
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                        pendingPoint.category === 'food'
                          ? 'bg-orange-500/30 text-orange-300 border border-orange-500/50 font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      🍽️ Cibo
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setPendingPoint((p) => (p ? { ...p, category: 'poi', stopDurationMin: 60 } : null));
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
                        setPendingPoint((p) => (p ? { ...p, category: 'parking', stopDurationMin: 15 } : null));
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
                        setPendingPoint((p) => (p ? { ...p, category: 'stay', stopDurationMin: 480 } : null));
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

                {/* Duration Picker for Pending Point */}
                <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Clock className="w-3 h-3 text-orange-400" />
                    <span>Durata Sosta:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {[15, 30, 45, 60, 120].map((mins) => (
                      <button
                        key={mins}
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingPoint((p) => (p ? { ...p, stopDurationMin: mins } : null));
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
                          pendingPoint.stopDurationMin === mins
                            ? 'bg-orange-500 text-white font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Confirmation Actions */}
                <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
                  <button
                    onClick={handleConfirmPendingPoint}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-lg shadow-md flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Aggiungi Tappa</span>
                  </button>

                  <button
                    onClick={handleCancelPendingPoint}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="py-1.5 px-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg transition-colors cursor-pointer"
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
          const currentDuration = waypoint.stopDurationMin || 0;

          return (
            <Marker
              key={waypoint.id}
              position={[waypoint.lat, waypoint.lng]}
              icon={createWaypointIcon(waypoint, index, waypoints.length, isSelected)}
            >
              <Popup className="custom-popup" closeButton={false} autoPan={false}>
                <div
                  className="p-3.5 min-w-[240px] text-slate-100"
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

                  {/* Waypoint Title with Inline Rename */}
                  <div className="space-y-1 mb-1.5">
                    <label className="text-[10px] text-slate-400 font-medium">Nome Tappa:</label>
                    <input
                      type="text"
                      value={waypoint.title}
                      onChange={(e) => onRenameWaypoint?.(waypoint.id, e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-2 py-1 text-xs text-white font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      placeholder="Nome tappa..."
                    />
                  </div>
                  {waypoint.address && (
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {waypoint.address}
                    </p>
                  )}

                  <div className="text-[11px] text-slate-400 mt-1 font-mono flex items-center gap-1.5">
                    <Navigation className="w-3 h-3 text-slate-500" />
                    <span>
                      {waypoint.lat.toFixed(4)}°, {waypoint.lng.toFixed(4)}°
                    </span>
                  </div>

                  {/* Loop Closure Quick Button on Start Marker */}
                  {index === 0 && waypoints.length >= 2 && onToggleCloseLoop && (
                    <div className="mt-2.5 pt-2 border-t border-slate-800">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleCloseLoop();
                        }}
                        className={`w-full py-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md ${
                          isLoopClosed
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-rose-500/20 hover:text-rose-300'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                        }`}
                      >
                        <Repeat className="w-3.5 h-3.5" />
                        <span>{isLoopClosed ? 'Apri Anello (Rimuovi Ritorno)' : 'Chiudi Anello (Torna alla Partenza)'}</span>
                      </button>
                    </div>
                  )}

                  {/* Stop Duration Editor in Popup */}
                  {waypoint.category === 'stay' ? (
                    <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center gap-2 p-1.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-[11px] text-purple-200">
                      <span className="text-sm">🛏️</span>
                      <span className="font-medium text-[10px]">Pernottamento: conclude la giornata attiva</span>
                    </div>
                  ) : (
                    onChangeStopDuration && index > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800 flex items-center justify-between text-xs">
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-orange-400" />
                          <span>Sosta:</span>
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStopDuration(waypoint.id, Math.max(0, currentDuration - 15));
                            }}
                            className="p-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="font-mono font-bold text-orange-300 text-xs px-1">
                            {currentDuration}m
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangeStopDuration(waypoint.id, currentDuration + 15);
                            }}
                            className="p-0.5 rounded bg-slate-800 text-slate-300 hover:text-white"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {/* Quick Category Selector */}
                  <div className="mt-2.5 pt-2 border-t border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-semibold text-slate-400 block">
                      Tipologia Segnalino:
                    </span>
                    <div className="grid grid-cols-5 gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'standard');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
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
                          onChangeCategory(waypoint.id, 'food');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
                          waypoint.category === 'food'
                            ? 'bg-orange-500/20 text-orange-300 border border-orange-500/40 font-bold'
                            : 'bg-slate-800 text-slate-400 hover:text-white'
                        }`}
                        title="Ristoro / Cibo"
                      >
                        🍽️ Cibo
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onChangeCategory(waypoint.id, 'poi');
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
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
                        className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
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
                        className={`text-[10px] py-1 px-1 rounded text-center transition-colors ${
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
                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-end">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveWaypoint(waypoint.id);
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-xs text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1 rounded transition-colors cursor-pointer"
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
    </div>
  );
};
