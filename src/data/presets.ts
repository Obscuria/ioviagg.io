import type { TripPreset } from '../types/trip';

export const TRIP_PRESETS: TripPreset[] = [
  {
    id: 'tuscany-tour',
    name: 'Tour della Toscana & Chianti',
    region: 'Toscana, Italia',
    description: 'Da Firenze a Siena passando per le dolci colline di San Gimignano e Val d\'Orcia.',
    waypoints: [
      { lat: 43.7696, lng: 11.2558, title: 'Firenze (Piazza del Duomo)', address: 'Firenze, Toscana', category: 'standard' },
      { lat: 43.4674, lng: 11.0433, title: 'San Gimignano (Torri Medievali)', address: 'San Gimignano, Siena', category: 'poi' },
      { lat: 43.3188, lng: 11.3308, title: 'Parcheggio Il Campo (Siena)', address: 'Siena, Toscana', category: 'parking' },
      { lat: 43.0566, lng: 11.6095, title: 'Pienza Hotel & Resort (Val d\'Orcia)', address: 'Pienza, Siena', category: 'stay' },
    ],
  },
  {
    id: 'amalfi-coast',
    name: 'Costiera Amalfitana & Cilento',
    region: 'Campania, Italia',
    description: 'Curve spettacolari a picco sul mare tirreno da Napoli a Positano e Amalfi.',
    waypoints: [
      { lat: 40.8518, lng: 14.2681, title: 'Napoli (Partenza)', address: 'Napoli, Campania', category: 'standard' },
      { lat: 40.6281, lng: 14.3758, title: 'Sorrento Viewpoint', address: 'Sorrento, Napoli', category: 'poi' },
      { lat: 40.6280, lng: 14.4850, title: 'Parcheggio Positano Mandara', address: 'Positano, Salerno', category: 'parking' },
      { lat: 40.6340, lng: 14.6027, title: 'Hotel Marina Riviera (Amalfi)', address: 'Amalfi, Salerno', category: 'stay' },
    ],
  },
  {
    id: 'dolomiti-alps',
    name: 'Grande Strada delle Dolomiti',
    region: 'Trentino-Alto Adige / Veneto',
    description: 'I passi alpini più iconici d\'Europa: da Bolzano a Cortina d\'Ampezzo.',
    waypoints: [
      { lat: 46.4983, lng: 11.3548, title: 'Bolzano', address: 'Bolzano, Trentino-Alto Adige', category: 'standard' },
      { lat: 46.5405, lng: 11.8569, title: 'Passo Gardena (Vetta 2121m)', address: 'Selva di Val Gardena, Bolzano', category: 'poi' },
      { lat: 46.5375, lng: 12.1357, title: 'Parcheggio Funivia Cortina', address: 'Cortina d\'Ampezzo, Belluno', category: 'parking' },
      { lat: 46.5500, lng: 12.1400, title: 'Rifugio Alpino Dolomiti', address: 'Cortina, Belluno', category: 'stay' },
    ],
  },
];
