import { io } from "socket.io-client";

const SERVER_URL = process.env.SERVER_URL || "http://localhost:3000";
const DEVICE_ID = "child-phone-01";

console.log(`[Android Simulator] Connecting to backend: ${SERVER_URL}...`);

const socket = io(SERVER_URL, {
  reconnection: true,
  reconnectionDelay: 1000
});

// Device state
let state = {
  deviceId: DEVICE_ID,
  name: "Samsung Galaxy A54 (Budi)",
  model: "SM-A546E (Android 14)",
  battery: 84,
  isCharging: false,
  isLocked: false,
  currentApp: "YouTube Kids",
  screenTimeTodayMinutes: 145,
  dailyLimitMinutes: 180,
  // Waypoint simulation: cycling through points in Jakarta
  lat: -6.2088,
  lng: 106.8456,
  heading: 0,
  isMirroringActive: false
};

const WAYPOINTS = [
  { lat: -6.2088, lng: 106.8456, name: "Rumah" },
  { lat: -6.2070, lng: 106.8440, name: "Taman Lingkungan" },
  { lat: -6.2045, lng: 106.8425, name: "Minimarket" },
  { lat: -6.2020, lng: 106.8410, name: "Jalan Utama" },
  { lat: -6.2000, lng: 106.8400, name: "Sekolah (SD Harapan)" }
];

let waypointIndex = 0;

socket.on("connect", () => {
  console.log(`✅ [Android Simulator] Connected to server! Socket ID: ${socket.id}`);

  // Register device
  socket.emit("register:child", {
    deviceId: state.deviceId,
    name: state.name,
    model: state.model,
    battery: state.battery
  });

  // Initial stats
  sendAppStats();
});

// Remote Lock Command
socket.on("command:lock", (data) => {
  state.isLocked = Boolean(data.isLocked);
  console.log(`\n🔒 [COMMAND RECEIVED] Perangkat ${state.isLocked ? "DIKUNCI" : "DIBUKA KUNCI"} oleh Orang Tua!`);
  sendAppStats();
});

// Block App Command
socket.on("command:block_current_app", (data) => {
  console.log(`\n🚫 [BLOCKED APP] Aplikasi ${data.packageName} dicegah berjalan: ${data.reason}`);
  state.currentApp = "Home Launcher (Blocked Screen)";
  sendAppStats();
});

// WebRTC / Live Stream Request
socket.on("webrtc:request_stream", (data) => {
  console.log(`\n🎥 [LIVE STREAM REQUEST] Parent requested live screen mirroring.`);
  state.isMirroringActive = true;
});

// Loop 1: GPS movement simulation (updates every 3 seconds)
setInterval(() => {
  if (!socket.connected) return;

  const target = WAYPOINTS[waypointIndex];
  // Smoothly step towards target
  const dLat = (target.lat - state.lat) * 0.15;
  const dLng = (target.lng - state.lng) * 0.15;

  state.lat += dLat + (Math.random() - 0.5) * 0.0001;
  state.lng += dLng + (Math.random() - 0.5) * 0.0001;

  // If close to waypoint, switch to next
  const dist = Math.hypot(target.lat - state.lat, target.lng - state.lng);
  if (dist < 0.0005) {
    waypointIndex = (waypointIndex + 1) % WAYPOINTS.length;
    console.log(`📍 [GPS] Mencapai dekat waypoint: ${target.name}`);
  }

  socket.emit("child:location_update", {
    deviceId: state.deviceId,
    latitude: Number(state.lat.toFixed(6)),
    longitude: Number(state.lng.toFixed(6)),
    accuracy: 4.8,
    speed: state.isLocked ? 0 : 2.5,
    address: `Sekitar ${target.name}, Jakarta`
  });
}, 3000);

// Loop 2: Screen time & app usage simulation (updates every 10 seconds)
const APPS = ["YouTube Kids", "TikTok", "Roblox", "WhatsApp", "Buku Sekolah Digital"];
setInterval(() => {
  if (!socket.connected) return;

  if (!state.isLocked) {
    state.screenTimeTodayMinutes += 1;
    // Occasionally switch app (15% chance)
    if (Math.random() < 0.15) {
      state.currentApp = APPS[Math.floor(Math.random() * APPS.length)];
      console.log(`📱 [App Change] Anak membuka aplikasi: ${state.currentApp}`);
    }
  }

  // Battery slow drain
  if (Math.random() < 0.05 && state.battery > 5) {
    state.battery -= 1;
  }

  sendAppStats();
}, 10000);

// Loop 3: Screen frame generator (sends live mock phone screen frames for live mirror)
let frameCounter = 0;
setInterval(() => {
  if (!socket.connected) return;

  frameCounter++;
  const timeStr = new Date().toLocaleTimeString("id-ID");
  
  // Create an SVG-based simulated screen frame
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="360" height="740" viewBox="0 0 360 740">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${state.isLocked ? '#311010' : '#1e293b'}" />
          <stop offset="100%" stop-color="${state.isLocked ? '#180808' : '#0f172a'}" />
        </linearGradient>
      </defs>
      
      <!-- Phone Bezel & Screen -->
      <rect width="360" height="740" rx="36" fill="url(#bg)" stroke="#334155" stroke-width="4" />
      
      <!-- Status Bar -->
      <text x="24" y="32" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${timeStr.substring(0, 5)}</text>
      <!-- Camera Notch -->
      <circle cx="180" cy="24" r="7" fill="#000000" />
      <text x="280" y="32" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">🔋 ${state.battery}%</text>
      
      <!-- Main Content -->
      ${state.isLocked ? `
        <rect x="30" y="200" width="300" height="260" rx="20" fill="#7f1d1d" opacity="0.9" />
        <text x="180" y="270" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#f87171">🔒</text>
        <text x="180" y="330" font-family="Arial, sans-serif" font-size="18" font-weight="bold" text-anchor="middle" fill="#ffffff">PERANGKAT DIKUNCI</text>
        <text x="180" y="365" font-family="Arial, sans-serif" font-size="13" text-anchor="middle" fill="#fca5a5">Waktu istirahat oleh Orang Tua</text>
      ` : `
        <!-- Active App Card -->
        <rect x="24" y="70" width="312" height="110" rx="18" fill="#334155" />
        <text x="44" y="105" font-family="Arial, sans-serif" font-size="12" fill="#38bdf8">SEDANG DIBUKA</text>
        <text x="44" y="138" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${state.currentApp}</text>
        <text x="44" y="162" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Pemakaian hari ini: ${state.screenTimeTodayMinutes} menit</text>
        
        <!-- Live Visual Feed Indicator -->
        <circle cx="48" cy="225" r="5" fill="#ef4444">
          <animate attributeName="opacity" values="1;0.2;1" dur="1.5s" repeatCount="indefinite" />
        </circle>
        <text x="62" y="230" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ef4444">LIVE SCREEN MIRROR</text>
        
        <!-- Mock App UI Content -->
        <rect x="24" y="250" width="312" height="380" rx="16" fill="#1e1b4b" opacity="0.7" />
        <rect x="40" y="270" width="280" height="160" rx="12" fill="#4338ca" />
        <circle cx="180" cy="350" r="28" fill="#ffffff" opacity="0.9" />
        <polygon points="174,338 174,362 192,350" fill="#4338ca" />
        
        <!-- Activity bars -->
        <rect x="40" y="450" width="200" height="12" rx="6" fill="#6366f1" />
        <rect x="40" y="474" width="140" height="12" rx="6" fill="#475569" />
        
        <text x="180" y="540" font-family="Arial, sans-serif" font-size="13" text-anchor="middle" fill="#a5b4fc">Menampilkan aktivitas layar anak secara real-time</text>
        <text x="180" y="570" font-family="Arial, sans-serif" font-size="11" text-anchor="middle" fill="#64748b">Frame: #${frameCounter} • Latensi: ~85ms</text>
      `}
      
      <!-- Android Navigation Bar -->
      <circle cx="180" cy="710" r="8" fill="#64748b" />
      <rect x="90" y="706" width="16" height="8" rx="2" fill="#64748b" />
      <polygon points="265,705 255,710 265,715" fill="#64748b" />
    </svg>
  `;

  const base64Svg = "data:image/svg+xml;base64," + Buffer.from(svg).toString("base64");

  socket.emit("child:screen_frame", {
    deviceId: state.deviceId,
    frame: base64Svg
  });
}, 500); // 2 FPS SVG broadcast for low bandwidth, super smooth rendering

function sendAppStats() {
  socket.emit("child:app_stats", {
    deviceId: state.deviceId,
    currentApp: state.currentApp,
    screenTimeTodayMinutes: state.screenTimeTodayMinutes,
    battery: state.battery,
    isCharging: state.isCharging,
    isLocked: state.isLocked
  });
}

console.log(`[Android Simulator] Running! Simulating device: ${DEVICE_ID}`);
