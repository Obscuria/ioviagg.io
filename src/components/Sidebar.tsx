import React, { useState } from 'react';
import type {
  Waypoint,
  RouteData,
  TripPreset,
  WaypointCategory,
  RouteLeg,
} from '../types/trip';
import { TRIP_PRESETS } from '../data/presets';
import {
  MapPin,
  Clock,
  Compass,
  Trash2,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Car,
  Flag,
  Plus,
  Minus,
  Calendar,
  Layers,
  AlertTriangle,
  X,
  GripVertical,
  Pencil,
  Timer,
  Route,
} from 'lucide-react';

interface SidebarProps {
  waypoints: Waypoint[];
  routeData: RouteData | null;
  departureTime: string;
  totalDays: number;
  activeDayTab: number | null; // null = all days
  onActiveDayTabChange: (day: number | null) => void;
  onAddDay: () => void;
  onSetTotalDays: (count: number) => void;
  onRemoveDay: (day: number) => void;
  onSwapDays: (dayA: number, dayB: number) => void;
  onChangeWaypointDay: (waypointId: string, newDay: number) => void;
  onDepartureTimeChange: (time: string) => void;
  onRenameWaypoint?: (id: string, newTitle: string) => void;
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
    return `${minutes}m`;
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
  let lastDay = 1;
  const schedules: WaypointSchedule[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];
    const wpDay = wp.day || 1;

    // If day changed, reset time to morning departure
    if (wpDay !== lastDay) {
      currentMinutes = depH * 60 + depM;
      lastDay = wpDay;
    }

    if (i === 0 || wpDay !== (waypoints[i - 1]?.day || 1)) {
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
  totalDays,
  activeDayTab,
  onActiveDayTabChange,
  onAddDay,
  onSetTotalDays,
  onRemoveDay,
  onSwapDays,
  onChangeWaypointDay,
  onDepartureTimeChange,
  onRenameWaypoint,
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

  // Confirmation state for deleting a day with waypoints
  const [dayToDelete, setDayToDelete] = useState<number | null>(null);

  // Preset dropdown toggle state
  const [showPresetsMenu, setShowPresetsMenu] = useState<boolean>(false);

  // Drag and Drop state for Day tabs
  const [draggedDay, setDraggedDay] = useState<number | null>(null);
  const [dragOverDay, setDragOverDay] = useState<number | null>(null);

  const totalStopMinutes = waypoints.reduce((acc, w) => acc + (w.stopDurationMin || 0), 0);

  const eta = hasRoute
    ? computeETA(departureTime, routeData.durationMinutes, waypoints)
    : '--:--';

  const schedules = calculateWaypointSchedules(
    departureTime,
    waypoints,
    routeData?.legs
  );

  // Filter waypoints by active day tab (if null, show all)
  const displayedWaypoints =
    activeDayTab === null
      ? waypoints
      : waypoints.filter((w) => (w.day || 1) === activeDayTab);

  // Attempt removing a day with safety confirmation
  const handleRequestRemoveDay = (day: number) => {
    const waypointsInDay = waypoints.filter((w) => (w.day || 1) === day);
    if (waypointsInDay.length > 0) {
      setDayToDelete(day);
    } else {
      onRemoveDay(day);
    }
  };

  // Handle direct days input modification
  const handleDaysInputChange = (newVal: number) => {
    if (isNaN(newVal) || newVal < 1) return;
    if (newVal < totalDays) {
      const affectedWaypoints = waypoints.filter((w) => (w.day || 1) > newVal);
      if (affectedWaypoints.length > 0) {
        setDayToDelete(totalDays);
        return;
      }
    }
    onSetTotalDays(newVal);
  };

  return (
    <aside className="w-full md:w-[350px] lg:w-[375px] h-full flex flex-col bg-slate-950/95 border-r border-slate-800/90 text-slate-100 backdrop-blur-xl z-20 shrink-0 select-none text-xs">
      {/* Confirmation Modal for Day Deletion */}
      {dayToDelete !== null && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm">Rimuovere Giorno {dayToDelete}?</h3>
                <p className="text-[11px] text-slate-400">Verifica tappe programmate</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 space-y-2">
              <p>
                Il <strong className="text-white">Giorno {dayToDelete}</strong> contiene{' '}
                <strong className="text-amber-300">
                  {waypoints.filter((w) => (w.day || 1) === dayToDelete).length} tappe
                </strong>
                .
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-400 max-h-20 overflow-y-auto">
                {waypoints
                  .filter((w) => (w.day || 1) === dayToDelete)
                  .map((w) => (
                    <li key={w.id} className="truncate">
                      {w.title}
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setDayToDelete(null)}
                className="flex-1 py-1.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  onRemoveDay(dayToDelete);
                  setDayToDelete(null);
                }}
                className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Elimina</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slim Modern Header */}
      <div className="h-14 px-3.5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-sky-500 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Compass className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold bg-gradient-to-r from-white via-indigo-100 to-sky-200 bg-clip-text text-transparent leading-none tracking-tight">
              ioviagg.io
            </h1>
            <span className="text-[10px] text-slate-400 leading-none">Travel Planner</span>
          </div>
        </div>

        {/* Compact Action Controls */}
        <div className="flex items-center gap-1.5 relative">
          {/* Preset Demo Picker Button */}
          <button
            onClick={() => setShowPresetsMenu((prev) => !prev)}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-300 hover:text-white bg-slate-800/70 hover:bg-indigo-600/30 px-2 py-1 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
            title="Scegli itinerario consigliato"
          >
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Itinerari</span>
          </button>

          {/* Presets Popover Menu */}
          {showPresetsMenu && (
            <div className="absolute right-0 top-9 w-60 bg-slate-900 border border-slate-700/80 rounded-xl p-1.5 shadow-2xl z-50 space-y-1">
              <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                <span>Itinerari Demo</span>
                <button onClick={() => setShowPresetsMenu(false)} className="text-slate-400 hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              </div>
              {TRIP_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    onLoadPreset(preset);
                    setShowPresetsMenu(false);
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-indigo-600/20 hover:text-white text-slate-300 text-xs transition-colors flex items-center justify-between group cursor-pointer"
                >
                  <span className="truncate">{preset.name}</span>
                  <span className="text-[10px] text-indigo-400 font-mono shrink-0 ml-1">
                    {preset.days || 1}G
                  </span>
                </button>
              ))}
            </div>
          )}

          {waypoints.length > 0 && (
            <button
              onClick={onClearTrip}
              className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800/60 hover:bg-rose-500/10 rounded-lg border border-slate-700/50 transition-colors cursor-pointer"
              title="Azzera tutto l'itinerario"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Minimalist Stats & Schedule Strip */}
      <div className="p-2.5 px-3.5 border-b border-slate-800/80 bg-slate-950/60 space-y-2">
        {/* Compact Key Stats Grid */}
        <div className="grid grid-cols-4 gap-1 p-2 bg-slate-900/80 border border-slate-800/80 rounded-xl text-center">
          <div className="flex flex-col items-center justify-center">
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Route className="w-2.5 h-2.5 text-indigo-400" />
              <span>Distanza</span>
            </span>
            <span className="font-mono font-bold text-white text-xs mt-0.5">
              {hasRoute ? `${routeData.distanceKm} km` : '0 km'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-l border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Car className="w-2.5 h-2.5 text-sky-400" />
              <span>Guida</span>
            </span>
            <span className="font-mono font-bold text-sky-300 text-xs mt-0.5">
              {hasRoute ? formatDuration(routeData.durationMinutes) : '0m'}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-l border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Timer className="w-2.5 h-2.5 text-amber-400" />
              <span>Soste</span>
            </span>
            <span className="font-mono font-bold text-amber-300 text-xs mt-0.5">
              {formatDuration(totalStopMinutes)}
            </span>
          </div>

          <div className="flex flex-col items-center justify-center border-l border-slate-800">
            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
              <Flag className="w-2.5 h-2.5 text-emerald-400" />
              <span>Arrivo</span>
            </span>
            <span className="font-mono font-bold text-emerald-400 text-xs mt-0.5">
              {eta}
            </span>
          </div>
        </div>

        {/* Minimal Control Bar: Days & Departure Time */}
        <div className="pt-1.5 border-t border-slate-800/60 flex items-center justify-between text-xs">
          {/* Days Stepper */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Calendar className="w-3 h-3 text-indigo-400" />
              <span>Giorni:</span>
            </span>
            <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded-md p-0.5">
              <button
                onClick={() => handleRequestRemoveDay(totalDays)}
                disabled={totalDays <= 1}
                className="p-0.5 rounded hover:bg-slate-800 disabled:opacity-30 text-slate-300 cursor-pointer"
              >
                <Minus className="w-2.5 h-2.5" />
              </button>
              <input
                type="number"
                min="1"
                max="30"
                value={totalDays}
                onChange={(e) => handleDaysInputChange(parseInt(e.target.value, 10))}
                className="w-5 bg-transparent text-center font-bold text-xs text-indigo-300 font-mono focus:outline-none"
              />
              <button
                onClick={onAddDay}
                className="p-0.5 rounded hover:bg-slate-800 text-slate-300 cursor-pointer"
              >
                <Plus className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Daily Departure Time */}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400 text-[11px] flex items-center gap-1">
              <Clock className="w-3 h-3 text-sky-400" />
              <span>Partenza:</span>
            </span>
            <input
              type="time"
              value={departureTime}
              onChange={(e) => onDepartureTimeChange(e.target.value)}
              className="bg-slate-900 border border-slate-700/80 text-white text-[11px] rounded-md px-1.5 py-0.5 font-mono focus:outline-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Multi-Day Navigation Tabs (Compact Drag & Drop Strip) */}
      <div className="px-3 py-1.5 bg-slate-950/80 border-b border-slate-800/80 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {/* All Days Tab */}
        <button
          onClick={() => onActiveDayTabChange(null)}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center gap-1 whitespace-nowrap transition-all cursor-pointer ${
            activeDayTab === null
              ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40'
              : 'bg-slate-900 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-2.5 h-2.5" />
          <span>Tutti ({totalStops})</span>
        </button>

        {/* Individual Day Tabs */}
        {Array.from({ length: totalDays }, (_, i) => i + 1).map((dayNum) => {
          const countInDay = waypoints.filter((w) => (w.day || 1) === dayNum).length;
          const isActive = activeDayTab === dayNum;
          const isBeingDragged = draggedDay === dayNum;
          const isDragOver = dragOverDay === dayNum && draggedDay !== dayNum;

          return (
            <div
              key={dayNum}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', String(dayNum));
                e.dataTransfer.effectAllowed = 'move';
                setDraggedDay(dayNum);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverDay !== dayNum) setDragOverDay(dayNum);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  setDragOverDay(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceDay = parseInt(e.dataTransfer.getData('text/plain'), 10) || draggedDay;
                if (sourceDay && sourceDay !== dayNum) {
                  onSwapDays(sourceDay, dayNum);
                }
                setDraggedDay(null);
                setDragOverDay(null);
              }}
              onDragEnd={() => {
                setDraggedDay(null);
                setDragOverDay(null);
              }}
              className={`group relative flex items-center rounded-md transition-all cursor-grab active:cursor-grabbing select-none text-[11px] ${
                isBeingDragged
                  ? 'opacity-40 scale-95 border border-dashed border-indigo-400 bg-indigo-950/40'
                  : isDragOver
                  ? 'ring-2 ring-indigo-400 scale-105 bg-indigo-600/40'
                  : isActive
                  ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400/40'
                  : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
              title={`Trascina per scambiare Giorno ${dayNum}`}
            >
              <div className="pl-1 opacity-30 group-hover:opacity-100">
                <GripVertical className="w-2.5 h-2.5 text-slate-400" />
              </div>

              <button
                onClick={() => onActiveDayTabChange(dayNum)}
                className="px-1.5 py-1 font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer"
              >
                <span>G{dayNum}</span>
                <span className="text-[9px] px-1 rounded bg-black/30 font-mono opacity-80">
                  {countInDay}
                </span>
              </button>

              {/* Quick arrow and delete controls on hover */}
              <div className="flex items-center pr-0.5 opacity-30 group-hover:opacity-100 transition-opacity">
                {dayNum > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwapDays(dayNum, dayNum - 1);
                    }}
                    className="p-0.5 hover:bg-black/30 rounded text-slate-300"
                    title={`Sposta a sinistra`}
                  >
                    <ChevronLeft className="w-2.5 h-2.5" />
                  </button>
                )}
                {dayNum < totalDays && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwapDays(dayNum, dayNum + 1);
                    }}
                    className="p-0.5 hover:bg-black/30 rounded text-slate-300"
                    title={`Sposta a destra`}
                  >
                    <ChevronRight className="w-2.5 h-2.5" />
                  </button>
                )}
                {totalDays > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestRemoveDay(dayNum);
                    }}
                    className="p-0.5 hover:bg-rose-500/20 hover:text-rose-300 rounded text-slate-400 ml-0.5"
                    title={`Elimina Giorno ${dayNum}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Day Button */}
        <button
          onClick={onAddDay}
          className="p-1 rounded-md bg-slate-900 hover:bg-indigo-600/30 hover:text-indigo-300 text-slate-400 border border-slate-800 transition-colors cursor-pointer shrink-0"
          title="Aggiungi giorno"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>

      {/* Section Subtitle */}
      <div className="px-3.5 py-1.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-indigo-400" />
          <span className="font-bold uppercase tracking-wider text-slate-300 text-[10px]">
            Timeline
          </span>
          <span className="text-[10px] text-slate-500">
            ({displayedWaypoints.length} {displayedWaypoints.length === 1 ? 'tappa' : 'tappe'})
          </span>
        </div>

        {isLoading && (
          <div className="flex items-center gap-1.5 text-indigo-400 font-medium text-[10px]">
            <div className="w-2.5 h-2.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Calcolo...</span>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <div className="m-3 p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-start gap-2 text-xs">
          <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-[11px]">Errore di Routing OSRM</p>
            <p className="text-rose-200/80 text-[10px]">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!error && totalStops === 0 && (
        <div className="m-4 p-5 rounded-xl bg-slate-900/40 border border-dashed border-slate-800 text-center flex flex-col items-center justify-center">
          <div className="w-9 h-9 rounded-full bg-indigo-500/10 text-indigo-400 flex items-center justify-center mb-2">
            <MapPin className="w-4 h-4" />
          </div>
          <h3 className="font-semibold text-xs text-slate-200">Nessuna tappa</h3>
          <p className="text-[11px] text-slate-400 mt-0.5 max-w-[200px]">
            Cerca in alto o clicca sulla mappa per iniziare.
          </p>
        </div>
      )}

      {/* Waypoints List (Minimalist Clean Cards) */}
      <div className="flex-1 overflow-y-auto p-2.5 px-3 space-y-1.5">
        {displayedWaypoints.map((waypoint, index) => {
          const globalIndex = waypoints.findIndex((w) => w.id === waypoint.id);
          const isStart = globalIndex === 0;
          const isEnd = globalIndex === totalStops - 1 && totalStops > 1;
          const isSelected = waypoint.id === selectedWaypointId;
          const category = waypoint.category || 'standard';
          const schedule = schedules[globalIndex];
          const currentDuration = waypoint.stopDurationMin || 0;
          const currentDay = waypoint.day || 1;

          // Leg info to reach next waypoint
          const leg = hasRoute && routeData.legs && routeData.legs[globalIndex];

          // Check if this is the first waypoint of a day
          const isFirstOfDay =
            activeDayTab === null &&
            (index === 0 || (waypoints[globalIndex - 1]?.day || 1) !== currentDay);

          return (
            <div key={waypoint.id} className="space-y-1">
              {/* Day Divider Banner */}
              {isFirstOfDay && (
                <div className="pt-2 pb-0.5 flex items-center justify-between border-b border-slate-800 text-[11px] text-indigo-300 font-semibold">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-indigo-400" />
                    <span>Giorno {currentDay}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {waypoints.filter((w) => (w.day || 1) === currentDay).length} tappe
                  </span>
                </div>
              )}

              {/* Waypoint Item Card */}
              <div
                onClick={() => onSelectWaypoint(isSelected ? null : waypoint.id)}
                className={`group rounded-xl border p-2.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-950/40 border-indigo-500/70 shadow-md ring-1 ring-indigo-500/40'
                    : 'bg-slate-900/60 hover:bg-slate-800/80 border-slate-800/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Category Pin Icon (26px) */}
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white shadow-sm shrink-0 ${
                      category === 'food'
                        ? 'bg-orange-600 ring-1 ring-orange-400/50'
                        : category === 'poi'
                        ? 'bg-amber-600 ring-1 ring-amber-400/50'
                        : category === 'parking'
                        ? 'bg-blue-600 ring-1 ring-blue-400/50'
                        : category === 'stay'
                        ? 'bg-purple-600 ring-1 ring-purple-400/50'
                        : isStart
                        ? 'bg-emerald-600 ring-1 ring-emerald-400/50'
                        : isEnd
                        ? 'bg-rose-600 ring-1 ring-rose-400/50'
                        : 'bg-indigo-600 ring-1 ring-indigo-400/40'
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
                      <Flag className="w-2.5 h-2.5" />
                    ) : (
                      globalIndex + 1
                    )}
                  </div>

                  {/* Title & Schedule Summary */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <h4 className="font-semibold text-xs text-white truncate leading-tight">
                        {waypoint.title}
                      </h4>
                      <div className="flex items-center gap-1 shrink-0">
                        {currentDuration > 0 && !isStart && (
                          <span className="text-[10px] text-orange-300 bg-orange-500/15 px-1.5 py-0.2 rounded font-mono">
                            {currentDuration}m
                          </span>
                        )}
                        <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                          G{currentDay}
                        </span>
                      </div>
                    </div>

                    {/* Schedule Micro Line */}
                    <div className="flex items-center justify-between text-[10px] text-slate-400 mt-0.5 font-mono">
                      {isStart ? (
                        <span className="text-emerald-400">
                          Partenza: {schedule?.departureTime || departureTime}
                        </span>
                      ) : isEnd ? (
                        <span className="text-rose-400">
                          Arrivo: {schedule?.arrivalTime || '--:--'}
                        </span>
                      ) : (
                        <span className="text-slate-400 truncate">
                          Arr: {schedule?.arrivalTime || '--:--'} ➔ Rip: {schedule?.departureTime || '--:--'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Expanded Details & Controls (Visible when clicked / selected) */}
                {isSelected && (
                  <div
                    className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Rename Waypoint Title */}
                    {onRenameWaypoint && (
                      <div className="space-y-1">
                        <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                          <Pencil className="w-2.5 h-2.5 text-indigo-400" />
                          <span>Nome Tappa:</span>
                        </label>
                        <input
                          type="text"
                          value={waypoint.title}
                          onChange={(e) => onRenameWaypoint(waypoint.id, e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700/90 rounded-lg px-2 py-1 text-xs text-white font-medium focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                          placeholder="Inserisci nome tappa..."
                        />
                      </div>
                    )}

                    {/* Day selector & Reorder / Delete toolbar */}
                    <div className="flex items-center justify-between text-[11px]">
                      {/* Day Assignment */}
                      <div className="flex items-center bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5">
                        <span className="text-slate-400 text-[10px] mr-1">Giorno:</span>
                        <select
                          value={currentDay}
                          onChange={(e) => onChangeWaypointDay(waypoint.id, parseInt(e.target.value, 10))}
                          className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer text-[11px]"
                        >
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d} className="bg-slate-900 text-white">
                              Giorno {d}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Reorder & Delete Buttons */}
                      <div className="flex items-center gap-1">
                        {globalIndex > 0 && (
                          <button
                            onClick={() => onReorderWaypoint(globalIndex, 'up')}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                            title="Sposta in alto"
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        )}
                        {globalIndex < totalStops - 1 && (
                          <button
                            onClick={() => onReorderWaypoint(globalIndex, 'down')}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded cursor-pointer"
                            title="Sposta in basso"
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={() => onRemoveWaypoint(waypoint.id)}
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
                          title="Rimuovi tappa"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {/* Stop Duration Controls (Only for non-start points) */}
                    {!isStart && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-400 flex items-center gap-1">
                            <Clock className="w-2.5 h-2.5 text-orange-400" />
                            <span>Durata Sosta:</span>
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onChangeStopDuration(waypoint.id, Math.max(0, currentDuration - 15))}
                              className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            >
                              <Minus className="w-2.5 h-2.5" />
                            </button>
                            <span className="font-mono font-bold text-orange-300 px-1 text-[11px]">
                              {formatDuration(currentDuration)}
                            </span>
                            <button
                              onClick={() => onChangeStopDuration(waypoint.id, currentDuration + 15)}
                              className="p-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>

                        {/* Quick Duration Chips */}
                        <div className="grid grid-cols-6 gap-1 text-[9px]">
                          {[15, 30, 45, 60, 120, 480].map((mins) => (
                            <button
                              key={mins}
                              onClick={() => onChangeStopDuration(waypoint.id, mins)}
                              className={`py-0.5 rounded text-center transition-all cursor-pointer ${
                                currentDuration === mins
                                  ? 'bg-orange-500 text-white font-bold'
                                  : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
                              }`}
                            >
                              {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Category Selector Pills */}
                    <div className="grid grid-cols-5 gap-1 text-[9px] pt-1 border-t border-slate-800/60">
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'standard')}
                        className={`py-1 rounded text-center cursor-pointer ${
                          category === 'standard'
                            ? 'bg-emerald-500/25 text-emerald-300 font-bold border border-emerald-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        📍 Base
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'food')}
                        className={`py-1 rounded text-center cursor-pointer ${
                          category === 'food'
                            ? 'bg-orange-500/25 text-orange-300 font-bold border border-orange-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        🍽️ Cibo
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'poi')}
                        className={`py-1 rounded text-center cursor-pointer ${
                          category === 'poi'
                            ? 'bg-amber-500/25 text-amber-300 font-bold border border-amber-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        🏔️ POI
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'parking')}
                        className={`py-1 rounded text-center cursor-pointer ${
                          category === 'parking'
                            ? 'bg-blue-500/25 text-blue-300 font-bold border border-blue-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        🅿️ Park
                      </button>
                      <button
                        onClick={() => onChangeCategory(waypoint.id, 'stay')}
                        className={`py-1 rounded text-center cursor-pointer ${
                          category === 'stay'
                            ? 'bg-purple-500/25 text-purple-300 font-bold border border-purple-500/40'
                            : 'bg-slate-800/80 text-slate-400 hover:text-white'
                        }`}
                      >
                        🛏️ Notte
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Minimal Connecting Leg */}
              {leg && (
                <div className="ml-5 pl-3 border-l border-dashed border-indigo-500/30 py-0.5 flex items-center justify-between text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center gap-1">
                    <Car className="w-2.5 h-2.5 text-indigo-400" />
                    <span>{leg.distanceKm} km</span>
                    <span>•</span>
                    <span>{formatDuration(leg.durationMinutes)}</span>
                  </div>
                  {leg.summary && (
                    <span className="text-[9px] text-slate-400 truncate max-w-[110px]">
                      via {leg.summary}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Minimal Footer */}
      <div className="px-3.5 py-2 border-t border-slate-800/80 bg-slate-950/80 text-[10px] text-slate-400 flex items-center justify-between">
        <span>OSRM Router</span>
        <span className="font-mono text-slate-400">Furkot Planner</span>
      </div>
    </aside>
  );
};
