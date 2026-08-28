import React, { useState, useEffect, useRef } from 'react';
import type { SearchResult, WaypointCategory } from '../types/trip';
import { searchPlaces } from '../services/search';
import {
  Search,
  Loader2,
  X,
  MapPin,
  Mountain,
  SquareParking,
  Bed,
  Sparkles,
  Plus,
  Utensils,
  Navigation,
} from 'lucide-react';

interface SearchBarProps {
  onSelectPlace: (result: SearchResult) => void;
  proximityLocation?: { lat: number; lng: number; label?: string } | null;
}

// Utility to render the corresponding icon for a category
export function CategoryIcon({
  category,
  className = 'w-4 h-4',
}: {
  category: WaypointCategory;
  className?: string;
}) {
  switch (category) {
    case 'food':
      return <Utensils className={`${className} text-orange-400`} />;
    case 'poi':
      return <Mountain className={`${className} text-amber-400`} />;
    case 'parking':
      return <SquareParking className={`${className} text-blue-400`} />;
    case 'stay':
      return <Bed className={`${className} text-purple-400`} />;
    default:
      return <MapPin className={`${className} text-emerald-400`} />;
  }
}

export function CategoryBadge({
  category,
  label,
}: {
  category: WaypointCategory;
  label?: string;
}) {
  switch (category) {
    case 'food':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/30">
          <Utensils className="w-3 h-3 text-orange-400" />
          <span>{label || 'Ristoro / Cibo'}</span>
        </span>
      );
    case 'poi':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>{label || 'Punto di Interesse'}</span>
        </span>
      );
    case 'parking':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
          <SquareParking className="w-3 h-3 text-blue-400" />
          <span>{label || 'Parcheggio'}</span>
        </span>
      );
    case 'stay':
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
          <Bed className="w-3 h-3 text-purple-400" />
          <span>{label || 'Pernottamento'}</span>
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
          <MapPin className="w-3 h-3 text-emerald-400" />
          <span>{label || 'Tappa'}</span>
        </span>
      );
  }
}

export const SearchBar: React.FC<SearchBarProps> = ({
  onSelectPlace,
  proximityLocation,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search with proximity biasing
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const timer = setTimeout(async () => {
      const places = await searchPlaces(query, proximityLocation);
      setResults(places);
      setIsLoading(false);
      setIsOpen(true);
      setSelectedIndex(-1);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, proximityLocation]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (place: SearchResult) => {
    onSelectPlace(place);
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      {/* Search Input Box */}
      <div className="relative flex items-center bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 hover:border-slate-600 focus-within:border-indigo-500 rounded-2xl shadow-2xl transition-all duration-200">
        <div className="pl-3.5 pr-2 flex items-center justify-center text-slate-400 pointer-events-none">
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
          ) : (
            <Search className="w-4 h-4 text-slate-400" />
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={
            proximityLocation
              ? `Cerca vicino a ${proximityLocation.label || 'tappa precedente'}...`
              : 'Cerca qualsiasi POI, monte, parco, ristorante o città...'
          }
          className="w-full bg-transparent py-2.5 pr-8 text-base sm:text-xs text-white placeholder-slate-400 focus:outline-none"
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setIsOpen(false);
            }}
            className="absolute right-2.5 p-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown */}
      {isOpen && (results.length > 0 || isLoading) && (
        <div className="absolute top-full mt-2 left-0 right-0 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden z-[500] max-h-[360px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-1.5 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                {proximityLocation ? (
                  <span className="flex items-center gap-1 text-emerald-400 truncate max-w-[240px]">
                    <Navigation className="w-3 h-3 shrink-0" />
                    <span className="truncate">
                      Ordinati da: <strong className="text-white normal-case">{proximityLocation.label}</strong>
                    </span>
                  </span>
                ) : (
                  <span>Risultati ({results.length})</span>
                )}
                <span className="text-slate-500 shrink-0">Click per aggiungere</span>
              </div>

              {results.map((place, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <button
                    key={place.id}
                    onClick={() => handleSelect(place)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full text-left p-2.5 rounded-xl transition-all flex items-start gap-2.5 group cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600/20 border border-indigo-500/40 text-white shadow-sm'
                        : 'hover:bg-slate-800/70 border border-transparent text-slate-200'
                    }`}
                  >
                    {/* Category Icon */}
                    <div className="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700/80 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                      <CategoryIcon category={place.category} className="w-4 h-4" />
                    </div>

                    {/* Information */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1.5">
                        <h4 className="text-xs font-semibold truncate text-white">
                          {place.name}
                        </h4>
                        <div className="flex items-center gap-1 shrink-0">
                          {place.distanceText && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-full">
                              <Navigation className="w-2.5 h-2.5 text-emerald-400" />
                              <span>{place.distanceText}</span>
                            </span>
                          )}
                          <CategoryBadge category={place.category} label={place.categoryLabel} />
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-400 truncate mt-0.5">
                        {place.displayName}
                      </p>
                    </div>

                    {/* Add action indicator */}
                    <div className="opacity-0 group-hover:opacity-100 self-center text-indigo-400 p-1 shrink-0">
                      <Plus className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            isLoading && (
              <div className="p-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                <span>Ricerca in corso su OpenStreetMap...</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
};
