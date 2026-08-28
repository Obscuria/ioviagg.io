import React, { useState } from 'react';
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
  ChevronLeft,
  ChevronRight,
  Sparkles,
  RotateCcw,
  AlertCircle,
  Car,
  Flag,
  SquareParking,
  Bed,
  Mountain,
  Utensils,
  Plus,
  Minus,
  Calendar,
  Layers,
  AlertTriangle,
  X,
  GripVertical,
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

  // Category counts
  const foodCount = waypoints.filter((w) => w.category === 'food').length;
  const poiCount = waypoints.filter((w) => w.category === 'poi').length;
  const parkingCount = waypoints.filter((w) => w.category === 'parking').length;
  const stayCount = waypoints.filter((w) => w.category === 'stay').length;

  // Filter waypoints by active day tab (if null, show all)
  const displayedWaypoints = activeDayTab === null
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
      // Check if any days to be removed have waypoints
      const affectedWaypoints = waypoints.filter((w) => (w.day || 1) > newVal);
      if (affectedWaypoints.length > 0) {
        setDayToDelete(totalDays);
        return;
      }
    }
    onSetTotalDays(newVal);
  };

  return (
    <aside className="w-full md:w-[440px] lg:w-[480px] h-full flex flex-col bg-slate-900/95 border-r border-slate-800 text-slate-100 backdrop-blur-xl z-20 shrink-0 select-none">
      {/* Confirmation Modal for Day Deletion */}
      {dayToDelete !== null && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Rimuovere Giorno {dayToDelete}?</h3>
                <p className="text-xs text-slate-400">Verifica tappe programmate</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-xs text-slate-300 space-y-2">
              <p>
                Il <strong className="text-white">Giorno {dayToDelete}</strong> contiene{' '}
                <strong className="text-amber-300">
                  {waypoints.filter((w) => (w.day || 1) === dayToDelete).length} tappe
                </strong>
                . Eliminando il giorno, verranno rimosse anche tutte le sue tappe.
              </p>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-400 max-h-24 overflow-y-auto">
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
                className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                Annulla
              </button>
              <button
                onClick={() => {
                  onRemoveDay(dayToDelete);
                  setDayToDelete(null);
                }}
                className="flex-1 py-2 px-3 bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-rose-600/30 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Elimina Giorno</span>
              </button>
            </div>
          </div>
        </div>
      )}

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
            <p className="text-xs text-slate-400 mt-0.5">Pianificatore Viaggi Multi-Giorno</p>
          </div>
        </div>

        {waypoints.length > 0 && (
          <button
            onClick={onClearTrip}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-rose-400 bg-slate-800/80 hover:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-slate-700/60 transition-colors cursor-pointer"
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

        {/* Schedule, ETA & Days Duration Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Days Stepper Control */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-2.5 flex items-center justify-between">
            <span className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>Durata Viaggio:</span>
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => handleRequestRemoveDay(totalDays)}
                disabled={totalDays <= 1}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Riduci giorni"
              >
                <Minus className="w-3 h-3" />
              </button>

              <div className="flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5">
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={totalDays}
                  onChange={(e) => handleDaysInputChange(parseInt(e.target.value, 10))}
                  className="w-7 bg-transparent text-center font-bold text-xs text-indigo-300 font-mono focus:outline-none"
                />
                <span className="text-[11px] text-slate-400 ml-0.5 font-medium">
                  {totalDays === 1 ? 'giorno' : 'giorni'}
                </span>
              </div>

              <button
                onClick={onAddDay}
                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Aggiungi giorno"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Departure Time & ETA */}
          <div className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-2.5 flex items-center justify-between">
            <label htmlFor="departure-time" className="text-xs text-slate-300 font-medium flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-sky-400" />
              <span>Partenza:</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                id="departure-time"
                type="time"
                value={departureTime}
                onChange={(e) => onDepartureTimeChange(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-white text-xs rounded-lg px-2 py-0.5 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              />
              {hasRoute && (
                <span className="text-[11px] text-emerald-400 font-mono font-semibold" title="Arrivo finale stimato">
                  ETA: {eta}
                </span>
              )}
            </div>
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
                className="text-left px-2 py-1.5 rounded-lg bg-slate-800/70 hover:bg-indigo-600/20 border border-slate-700/60 hover:border-indigo-500/40 text-[11px] text-slate-300 hover:text-white transition-all line-clamp-1 cursor-pointer"
                title={`${preset.name} - ${preset.days || 1} Giorni - ${preset.description}`}
              >
                {preset.name.replace('Tour della ', '').replace('Costiera ', '').replace('Grande Strada delle ', '')} ({preset.days || 1}G)
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Multi-Day Navigation Tabs (Furkot Style) */}
      <div className="px-4 py-2 bg-slate-950/60 border-b border-slate-800 flex items-center gap-1.5 overflow-x-auto">
        {/* All Days Tab */}
        <button
          onClick={() => onActiveDayTabChange(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer ${
            activeDayTab === null
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/50'
              : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers className="w-3 h-3" />
          <span>Tutti i Giorni</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 font-mono">
            {totalStops}
          </span>
        </button>

        {/* Individual Day Tabs with Drag & Drop */}
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
                if (dragOverDay !== dayNum) {
                  setDragOverDay(dayNum);
                }
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
              className={`group relative flex items-center rounded-lg transition-all cursor-grab active:cursor-grabbing select-none ${
                isBeingDragged
                  ? 'opacity-40 scale-95 border-2 border-dashed border-indigo-400 bg-indigo-950/40'
                  : isDragOver
                  ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-105 bg-indigo-600/40 border-indigo-400'
                  : isActive
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400/50'
                  : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
              }`}
              title={`Trascina per scambiare Giorno ${dayNum}`}
            >
              {/* Drag Handle Icon */}
              <div className="pl-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-3 h-3 text-slate-400" />
              </div>

              <button
                onClick={() => onActiveDayTabChange(dayNum)}
                className="px-2 py-1.5 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <span>Giorno {dayNum}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? 'bg-indigo-900/60 text-indigo-100' : 'bg-slate-900/60 text-slate-400'
                  }`}
                >
                  {countInDay}
                </span>
              </button>

              {/* Day Swap / Move buttons on hover for quick keyboard/click */}
              <div className="flex items-center pr-1 opacity-40 group-hover:opacity-100 transition-opacity">
                {dayNum > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwapDays(dayNum, dayNum - 1);
                    }}
                    className="p-0.5 hover:bg-black/30 rounded text-slate-300 hover:text-white"
                    title={`Scambia Giorno ${dayNum} con Giorno ${dayNum - 1}`}
                  >
                    <ChevronLeft className="w-3 h-3" />
                  </button>
                )}
                {dayNum < totalDays && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSwapDays(dayNum, dayNum + 1);
                    }}
                    className="p-0.5 hover:bg-black/30 rounded text-slate-300 hover:text-white"
                    title={`Scambia Giorno ${dayNum} con Giorno ${dayNum + 1}`}
                  >
                    <ChevronRight className="w-3 h-3" />
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
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Add Day Button in tab bar */}
        <button
          onClick={onAddDay}
          className="p-1.5 rounded-lg bg-slate-800/60 hover:bg-indigo-600/20 hover:text-indigo-300 text-slate-400 border border-slate-700/50 transition-colors cursor-pointer shrink-0"
          title="Aggiungi nuovo giorno al viaggio"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Timeline Section Header (Renamed per user request) */}
      <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Timeline
          </span>
          {activeDayTab !== null ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-medium">
              Giorno {activeDayTab} ({displayedWaypoints.length} tappe)
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
              {totalStops} tappe totali
            </span>
          )}
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
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
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

          // Check if this is the first waypoint of a day to show a clean day separator banner
          const isFirstOfDay = activeDayTab === null && (index === 0 || (waypoints[globalIndex - 1]?.day || 1) !== currentDay);

          return (
            <div key={waypoint.id} className="space-y-2">
              {/* Day Header Divider when viewing All Days */}
              {isFirstOfDay && (
                <div className="pt-2 pb-1 flex items-center justify-between border-b border-slate-700/60 text-xs text-indigo-300 font-bold">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Giorno {currentDay}</span>
                  </div>
                  <span className="text-[11px] text-slate-400 font-normal">
                    {waypoints.filter((w) => (w.day || 1) === currentDay).length} tappe
                  </span>
                </div>
              )}

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
                        globalIndex + 1
                      )}
                    </div>
                  </div>

                  {/* Waypoint details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge category={waypoint.category} />

                        {/* Day Selector Pill / Dropdown */}
                        <div
                          className="flex items-center bg-slate-900 border border-slate-700/80 rounded-md px-1.5 py-0.5 text-[10px]"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-slate-400 mr-1">Giorno:</span>
                          <select
                            value={currentDay}
                            onChange={(e) => onChangeWaypointDay(waypoint.id, parseInt(e.target.value, 10))}
                            className="bg-transparent text-indigo-300 font-bold focus:outline-none cursor-pointer"
                          >
                            {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => (
                              <option key={d} value={d} className="bg-slate-900 text-white">
                                {d}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Controls (Reorder / Delete) */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        {globalIndex > 0 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderWaypoint(globalIndex, 'up');
                            }}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded cursor-pointer"
                            title="Sposta in alto"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {globalIndex < totalStops - 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onReorderWaypoint(globalIndex, 'down');
                            }}
                            className="p-1 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded cursor-pointer"
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
                          className="p-1 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded cursor-pointer"
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
                            <span>🚀 Partenza G{currentDay}:</span>
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
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                              title="-15 minuti"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="font-mono font-bold text-xs text-orange-300 px-1.5 min-w-[52px] text-center">
                              {formatDuration(currentDuration)}
                            </span>
                            <button
                              onClick={() => onChangeStopDuration(waypoint.id, currentDuration + 15)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
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
                              className={`py-0.5 rounded text-center transition-all cursor-pointer ${
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
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all cursor-pointer ${
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
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all cursor-pointer ${
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
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all cursor-pointer ${
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
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all cursor-pointer ${
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
                        className={`text-[10px] py-1 px-1 rounded-md text-center transition-all cursor-pointer ${
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
        <span className="font-mono text-slate-400">Furkot Timeline Multi-Giorno</span>
      </div>
    </aside>
  );
};
