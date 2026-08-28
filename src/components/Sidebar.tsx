import React from 'react';
import type {
  Waypoint,
  RouteData,
  TripPreset,
  WaypointCategory,
  RouteLeg,
} from '../types/trip';
import { TRIP_PRESETS } from '../data/presets';
import { CategoryBadge } from './SearchBar';
import {
  MapPin,
  Clock,
  Compass,
  Trash2,
  ChevronUp,
  ChevronDown,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Car,
  Flag,
  ArrowRight,
  Info,
  SquareParking,
  Bed,
  Mountain,
  Utensils,
  Plus,
  Minus,
} from 'lucide-react';

interface SidebarProps {
  waypoints: Waypoint[];
  routeData: RouteData | null;
  departureTime: string;
  onDepartureTimeChange: (time: string) => void;
  onRemoveWaypoint: (id: string) => void;
  onReorderWaypoint: (index: number, direction: 'up' | 'down') => void;
  onChangeCategory: (id: string, category: WaypointCategory) => void;
  onChangeStopDuration: (id: string, durationMinutes: number) => void;
  onClearTrip: () => void;
  onLoadPreset: (preset: TripPreset) => void;
  isLoading: boolean;
  error: string | null;
  selectedWaypointId: string | null;
  onSelectWaypoint: (id: string | null) => void;
}

// Utility: format minutes to "Xh Ym" or "X min"
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
}

// Utility: format minutes from midnight into "HH:MM"
function formatTimeOfDay(totalMinutes: number): string {
  const normalized = ((Math.floor(totalMinutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

// Schedule info for each waypoint
interface WaypointSchedule {
  arrivalTime?: string;
  departureTime?: string;
}

function calculateWaypointSchedules(
  departureTime: string,
  waypoints: Waypoint[],
  legs: RouteLeg[] | undefined
): WaypointSchedule[] {
  const [depH, depM] = departureTime.split(':').map(Number);
  if (isNaN(depH) || isNaN(depM)) return waypoints.map(() => ({}));

  let currentMinutes = depH * 60 + depM;
  const schedules: WaypointSchedule[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    if (i === 0) {
      const depStr = formatTimeOfDay(currentMinutes);
      schedules.push({ departureTime: depStr });
    } else {
      const leg = legs && legs[i - 1];
      const legDuration = leg ? leg.durationMinutes : 0;
      currentMinutes += legDuration;
      const arrStr = formatTimeOfDay(currentMinutes);

      const stopMin = wp.stopDurationMin || 0;
      currentMinutes += stopMin;
      const depStr = i === waypoints.length - 1 ? undefined : formatTimeOfDay(currentMinutes);

      schedules.push({
        arrivalTime: arrStr,
        departureTime: depStr,
      });
    }
  }

  return schedules;
}

// Utility: compute overall ETA from departure time + driving duration + stop durations
function computeETA(departureTime: string, drivingMinutes: number, waypoints: Waypoint[]): string {
  const [depHours, depMins] = departureTime.split(':').map(Number);
  if (isNaN(depHours) || isNaN(depMins)) return '--:--';

  const totalStopMinutes = waypoints.reduce((acc, w) => acc + (w.stopDurationMin || 0), 0);
  const totalTripMinutes = drivingMinutes + totalStopMinutes;

  return formatTimeOfDay(depHours * 60 + depMins + totalTripMinutes);
}

export const Sidebar: React.FC<SidebarProps> = ({
  waypoints,
  routeData,
  departureTime,
  onDepartureTimeChange,
  onRemoveWaypoint,
  onReorderWaypoint,
  onChangeCategory,
  onChangeStopDuration,
  onClearTrip,
  onLoadPreset,
  isLoading,
  error,
  selectedWaypointId,
  onSelectWaypoint,
}) => {
  const totalStops = waypoints.length;
  const hasRoute = routeData !== null && waypoints.length >= 2;

  const totalStopMinutes = waypoints.reduce((acc, w) => acc + (w.stopDurationMin || 0), 0);

  const eta = hasRoute
    ? computeETA(departureTime, routeData.durationMinutes, waypoints)
    : '--:--';

  const schedules = calculateWaypointSchedules(
    departureTime,
    waypoints,
    routeData?.legs
  );

  // Category counts
  const foodCount = waypoints.filter((w) => w.category === 'food').length;
  const poiCount = waypoints.filter((w) => w.category === 'poi').length;
  const parkingCount = waypoints.filter((w) => w.category === 'parking').length;
  const stayCount = waypoints.filter((w) => w.category === 'stay').length;

  return (
    <aside className="w-full md:w-[430px] lg:w-[470px] h-full flex flex-col bg-slate-900/95 border-r border-slate-800 text-slate-100 backdrop-blur-xl z-20 shrink-0 select-none">
      {/* Header / Brand */}
      <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <Compass className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-indigo-100 to-sky-200 bg-clip-text text-transparent leading-tight py-0.5 tracking-tight">
              ioviagg.io
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">Pianificatore Viaggi</p>
          </div>
        </div>

        {waypoints.length > 0 && (
          <button
            onClick={onClearTrip}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition-colors"
            title="Azzera tutto l'itinerario"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        )}
      </div>

      {/* Trip Summary & Stats Card */}
      <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/40 space-y-4">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {/* Distance */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Distanza</span>
              <Car className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="mt-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {hasRoute ? routeData.distanceKm : '0'}
              </span>
              <span className="text-[11px] text-slate-400 ml-1 font-medium">km</span>
            </div>
          </div>

          {/* Driving Time */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Guida</span>
              <Clock className="w-3.5 h-3.5 text-sky-400" />
            </div>
            <div className="mt-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-white font-mono">
                {hasRoute ? formatDuration(routeData.durationMinutes) : '0m'}
              </span>
            </div>
          </div>

          {/* Stop / Rest Time */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-2.5 sm:p-3 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Soste Tot.</span>
              <Utensils className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div className="mt-1.5">
              <span className="text-xl sm:text-2xl font-bold tracking-tight text-orange-300 font-mono">
                {formatDuration(totalStopMinutes)}
              </span>
            </div>
          </div>
        </div>

        {/* Schedule & ETA Controls */}
        <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <label htmlFor="departure-time" className="text-xs text-slate-300 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-indigo-400" />
              <span>Partenza:</span>
            </label>
            <input
              id="departure-time"
              type="time"
              value={departureTime}
              onChange={(e) => onDepartureTimeChange(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2.5 py-1 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent cursor-pointer"
            />
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Arrivo Stimato:</span>
            <span className="font-bold text-emerald-400 font-mono text-sm">{eta}</span>
          </div>
        </div>

        {/* Category Breakdown Chips */}
        {waypoints.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[10px]">
            <span className="text-slate-400 font-medium">Filtro tappe:</span>
            <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-slate-300">
              {totalStops} tappe
            </span>
            {foodCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-orange-500/20 border border-orange-500/30 text-orange-300 font-medium flex items-center gap-1">
                <Utensils className="w-2.5 h-2.5" /> {foodCount} Ristoro
              </span>
            )}
            {poiCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/30 text-amber-300 font-medium flex items-center gap-1">
                <Mountain className="w-2.5 h-2.5" /> {poiCount} POI
              </span>
            )}
            {parkingCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-blue-500/20 border border-blue-500/30 text-blue-300 font-medium flex items-center gap-1">
                <SquareParking className="w-2.5 h-2.5" /> {parkingCount} Park
              </span>
            )}
            {stayCount > 0 && (
              <span className="px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/30 text-purple-300 font-medium flex items-center gap-1">
                <Bed className="w-2.5 h-2.5" /> {stayCount} Notte
              </span>
            )}
          </div>
        )}

        {/* Preset Selector Dropdown / Buttons */}
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Itinerari Demo Consigliati:</span>
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {TRIP_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => onLoadPreset(preset)}
                className="text-left px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-indigo-600/20 border border-slate-700/60 hover:border-indigo-500/40 text-[11px] text-slate-300 hover:text-white transition-all line-clamp-1"
                title={`${preset.name} - ${preset.description}`}
              >
                {preset.name.replace('Tour della ', '').replace('Costiera ', '').replace('Grande Strada delle ', '')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Waypoints Header */}
      <div className="px-4 py-3 bg-slate-900/60 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Timeline & Tappe Viaggio
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono">
            {totalStops}
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-indigo-400 font-medium">
            <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Calcolo percorso...</span>
          </div>
        )}
      </div>

      {/* Fallback / Alerts & Info Banners */}
      {error && (
        <div className="m-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2.5 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Errore di Routing OSRM</p>
            <p className="text-rose-200/80 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {!error && totalStops === 1 && (
        <div className="m-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-2.5 text-xs">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Aggiungi la destinazione</p>
            <p className="text-amber-200/80 mt-0.5">
              Hai impostato 1 solo punto. Cerca un ristorante, POI o città in alto, oppure clicca direttamente sulla mappa per aggiungere altre tappe.
            </p>
          </div>
        </div>
      )}

      {!error && totalStops === 0 && (
        <div className="m-4 p-6 rounded-2xl bg-slate-800/30 border border-dashed border-slate-700/80 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-3">
            <MapPin className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-sm text-slate-200">Nessuna tappa inserita</h3>
          <p className="text-xs text-slate-400 mt-1 max-w-[260px]">
            Cerca qualsiasi località, ristorante o attrazione nella barra in alto, oppure clicca su un punto della mappa.
          </p>
        </div>
      )}

      {/* Waypoints List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {waypoints.map((waypoint, index) => {
          const isStart = index === 0;
          const isEnd = index === totalStops - 1 && totalStops > 1;
          const isSelected = waypoint.id === selectedWaypointId;
          const category = waypoint.category || 'standard';
          const schedule = schedules[index];
          const currentDuration = waypoint.stopDurationMin || 0;

          // Leg info to reach next waypoint
          const leg = hasRoute && routeData.legs && routeData.legs[index];

          return (
            <div key={waypoint.id} className="space-y-2">
              <div
                onClick={() => onSelectWaypoint(isSelected ? null : waypoint.id)}
                className={`group relative rounded-xl border p-3 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-950/50'
                    : 'bg-slate-800/60 hover:bg-slate-800/90 border-slate-700/60 hover:border-slate-600'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Stop Badge / Icon Indicator */}
                  <div className="flex flex-col items-center pt-0.5">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-md transition-transform ${
                        category === 'food'
                          ? 'bg-orange-600 ring-2 ring-orange-400/50'
                          : category === 'poi'
                          ? 'bg-amber-600 ring-2 ring-amber-400/50'
                          : category === 'parking'
                          ? 'bg-blue-600 ring-2 ring-blue-400/50'
                          : category === 'stay'
                          ? 'bg-purple-600 ring-2 ring-purple-400/50'
                          : isStart
                          ? 'bg-emerald-600 ring-2 ring-emerald-400/40'
                          : isEnd
                          ? 'bg-rose-600 ring-2 ring-rose-400/40'
                          : 'bg-indigo-600 ring-2 ring-indigo-400/40'
                      }`}
                    >
                      {category === 'food' ? (
                        '🍽️'
                      ) : category === 'poi' ? (
                        '🏔️'
                      ) : category === 'parking' ? (
                        '🅿️'
                      ) : category === 'stay' ? (
                        '🛏️'
                      ) : isStart ? (
                        '1'
                      ) : isEnd ? (
                        <Flag className="w-3.5 h-3.5" />
                      ) : (
                        index + 1
                      )}
                    </div>
                  </div>

                  {/* Waypoint details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <CategoryBadge category={waypoint.category} />

                      {/* Controls (Reorder / Delete) */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {index > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderWaypoint(index, 'up');
                            }}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
                            title="Sposta in alto"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {index < totalStops - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderWaypoint(index, 'down');
                            }}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded"
                            title="Sposta in basso"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRemoveWaypoint(waypoint.id);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded"
                          title="Rimuovi tappa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <h4 className="font-semibold text-sm text-white truncate mt-1">
                      {waypoint.title}
                    </h4>

                    {waypoint.address && (
                      <p className="text-xs text-slate-400 truncate mt-0.5">
                        {waypoint.address}
                      </p>
                    )}

                    {/* Timeline & Schedule Pill (Furkot Style) */}
                    {hasRoute && (
                      <div className="mt-2 py-1 px-2 rounded-lg bg-slate-900/80 border border-slate-700/50 flex items-center justify-between text-[11px] font-mono">
                        {isStart ? (
                          <span className="text-emerald-400 font-semibold flex items-center gap-1">
                            <span>🚀 Partenza:</span>
                            <span>{schedule?.departureTime || departureTime}</span>
                          </span>
                        ) : isEnd ? (
                          <span className="text-rose-400 font-semibold flex items-center gap-1">
                            <span>🏁 Arrivo finale:</span>
                            <span>{schedule?.arrivalTime || '--:--'}</span>
                          </span>
                        ) : (
                          <div className="w-full flex items-center justify-between text-slate-300">
                            <span className="text-sky-300">Arr: {schedule?.arrivalTime || '--:--'}</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-orange-300">Sosta: {currentDuration}m</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-emerald-300">Rip: {schedule?.departureTime || '--:--'}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stop Duration Controls (Interactive Stepper & Presets) */}
                    {!isStart && (
                      <div
                        className="mt-2 pt-2 border-t border-slate-700/40 space-y-1.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-slate-400 font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3 text-orange-400" />
                            <span>Durata Sosta:</span>
                          </span>

                          {/* Stepper Buttons */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onChangeStopDuration(waypoint.id, Math.max(0, currentDuration - 15))}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="-15 minuti"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs text-orange-300 px-1.5 min-w-[52px] text-center">
                              {formatDuration(currentDuration)}
                            </span>
                            <button
                              onClick={() => onChangeStopDuration(waypoint.id, currentDuration + 15)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                              title="+15 minuti"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Quick Presets */}
                        <div className="grid grid-cols-6 gap-1 text-[10px]">
                          {[15, 30, 45, 60, 120, 480].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => onChangeStopDuration(waypoint.id, mins)}
                              className={`py-0.5 rounded text-center transition-all ${
                                currentDuration === mins
                                  ? 'bg-orange-500 text-white font-bold shadow-sm'
                                  : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                              }`}
                            >
                              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category Type Switcher Pills */}
                    <div
                      className="mt-2.5 pt-2 border-t border-slate-700/40 grid grid-cols-5 gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'standard')}
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all ${
                          category === 'standard'
                            ? 'bg-emerald-500/25 text-emerald-300 font-semibold border border-emerald-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                        title="Tappa Base"
                      >
                        📍 Base
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'food')}
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all ${
                          category === 'food'
                            ? 'bg-orange-500/25 text-orange-300 font-semibold border border-orange-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                        title="Ristoro / Cibo"
                      >
                        🍽️ Cibo
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'poi')}
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all ${
                          category === 'poi'
                            ? 'bg-amber-500/25 text-amber-300 font-semibold border border-amber-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                        title="Punto di Interesse"
                      >
                        🏔️ POI
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'parking')}
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all ${
                          category === 'parking'
                            ? 'bg-blue-500/25 text-blue-300 font-semibold border border-blue-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                        title="Parcheggio"
                      >
                        🅿️ Park
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'stay')}
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all ${
                          category === 'stay'
                            ? 'bg-purple-500/25 text-purple-300 font-semibold border border-purple-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                        title="Pernottamento"
                      >
                        🛏️ Notte
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connecting Leg Info Banner between waypoints */}
              {leg && (
                <div className="ml-6 pl-4 border-l-2 border-dashed border-indigo-500/30 py-1 flex items-center justify-between text-xs text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <Car className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{leg.distanceKm} km</span>
                    <span>•</span>
                    <span>{formatDuration(leg.durationMinutes)} guida</span>
                  </div>
                  {leg.summary && (
                    <span className="text-[11px] text-slate-500 truncate max-w-[140px] font-mono">
                      via {leg.summary}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/60 text-[11px] text-slate-400 flex items-center justify-between">
        <span>OSRM Routing Engine</span>
        <span className="font-mono text-slate-400">Overpass OSM POIs</span>
      </div>
    </aside>
  );
};

