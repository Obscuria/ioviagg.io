# 🚗 ioviagg.io — Modern Roadtrip & Itinerary Planner

<div align="center">

[![Live Demo](https://img.shields.io/badge/🌐_Demo_Online-GitHub_Pages-4f46e5?style=for-the-badge&logo=githubpages&logoColor=white)](https://obscuria.github.io/ioviagg.io/)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61dafb?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38bdf8?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

<br />

👉 **[PROVA SUBITO L'APPLICAZIONE ONLINE](https://obscuria.github.io/ioviagg.io/)** 👈

</div>

---

## 🌟 Cos'è ioviagg.io?

**ioviagg.io** è un'applicazione web moderna, fluida e reattiva progettata per pianificare **itinerari di viaggio, roadtrip e vacanze a tappe su più giorni**.

Ispirata ai migliori strumenti di viaggio (come Furkot), permette di tracciare percorsi stradali precisi, calcolare tempi di guida e di sosta, organizzare le tappe giorno per giorno e scoprire punti di interesse (POI) in tutto il mondo con caratteri occidentali e localizzazione immediata.

---

## ✨ Funzionalità Principali

### 🗺️ 1. Mappe Dettagliate & 100% Caratteri Occidentali
- **MapTiler & OpenMapTiles**: Mappe ad altissima definizione con **tutti i nomi di città, strade e monumenti in caratteri occidentali/latini** (anche in Cina, Giappone, Russia, Grecia, Paesi Arabi).
- **Layer Multipli Selezionabili**:
  - `MapTiler Occidentale & POI` *(Predefinita)*
  - `MapTiler Outdoor & Parchi`
  - `MapTiler Voyager (Furkot Style)`
  - `OpenStreetMap Standard (Dettagliata & POI)`
  - `OSM Turistica (Humanitarian)`
  - `Outdoor & Punti di Interesse (CyclOSM)`
  - `Topografica & Rilievi (OpenTopo)`
  - `Esri World Street & Satellite HD`

### 📅 2. Timeline Multi-Giorno con Drag & Drop
- Suddivisione automatica delle tappe per giorni di viaggio.
- **Drag & Drop Nativo dei Giorni**: Scambia l'ordine dei giorni (es. *Giorno 1* con *Giorno 3*) trascinando le schede con il cursore.
- **Protezione Rimozione**: Finestra di sicurezza per evitare di eliminare giorni con tappe salvate per errore.

### ⏰ 3. Orari di Partenza Indipendenti per Giorno
- Ogni giorno del viaggio può avere un orario di partenza personalizzato (es. Giorno 1 alle `08:00`, Giorno 2 alle `10:30`).
- Ricalcolo dinamico e real-time degli orari di arrivo (ETA) e ripartenza per ciascuna tappa.

### 🔍 4. Ricerca Intelligente con Ordinamento per Vicinanza (Proximity Search)
- Autocomplete in tempo reale con geocoding Photon & Nominatim.
- **Ordinamento Spaziale**: I risultati vengono ordinati automaticamente in base alla vicinanza alla tua tappa precedente.
- **Badge Distanza**: Visualizzazione dei chilometri/metri esatti di distanza da ogni punto di interesse (es. `🧭 350 m`, `🧭 1.4 km`).

### 🔄 5. Chiusura Itinerario ad Anello (1-Click Round-Trip)
- Pulsante rapido sul marker di partenza, nella sidebar e nel pannello superiore per trasformare qualsiasi viaggio in un **itinerario ad anello** che ritorna al punto di partenza.

### 🛏️ 6. Gestione Soste & Pernottamenti Intelligente
- Categorie tappe differenziate con segnalini a colori:
  - 📍 **Base / Tappa Standard**
  - 🍽️ **Cibo / Ristorazione**
  - 🏔️ **Punto di Interesse / Natura / Monumenti**
  - 🅿️ **Parcheggio**
  - 🛏️ **Pernottamento (Fine Giornata)**
- I pernottamenti concludono la giornata attiva senza conteggiare le ore notturne di sonno tra le soste di guida diurne.

---

## 🛠️ Tecnologie Utilizzate

- **Frontend**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Vite](https://vitejs.dev/)
- **Stili & UI**: [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React Icons](https://lucide.dev/)
- **Mappe & Routing**: [Leaflet](https://leafletjs.com/), [React Leaflet](https://react-leaflet.js.org/), [OSRM Routing API](http://project-osrm.org/)
- **Geocoding & Dati Cartografici**: [MapTiler Cloud](https://www.maptiler.com/), [OpenStreetMap](https://www.openstreetmap.org/), [Komoot Photon](https://photon.komoot.io/)
- **Deployment**: [GitHub Pages](https://pages.github.com/) con [GitHub Actions](https://github.com/features/actions)

---

## 🚀 Avvio Rapido in Locale

Per eseguire il progetto sulla tua macchina locale:

### 1. Clona il repository
```bash
git clone https://github.com/Obscuria/ioviagg.io.git
cd ioviagg.io
```

### 2. Installa le dipendenze
```bash
npm install
```

### 3. (Opzionale) Configura le API Key
Copia il file di esempio `.env.example` in `.env`:
```bash
cp .env.example .env
```
*(Puoi inserire la tua chiave gratuita MapTiler se desideri personalizzarla)*.

### 4. Avvia il server di sviluppo
```bash
npm run dev
```
L'applicazione sarà attiva su `http://localhost:5173/`.

### 5. Compila per la produzione
```bash
npm run build
```

---

## 📄 Licenza

Questo progetto è distribuito sotto licenza **Apache 2.0**. Consulta il file [LICENSE](LICENSE) per ulteriori dettagli.

---

<div align="center">
Sviluppato con ❤️ da <strong>Obscuria</strong>
</div>
