// In-memory state store for devices, pairing codes, location history, app stats, and geofences

export const state = {
  // Map of deviceId -> Device object
  devices: new Map([
    [
      "child-phone-01",
      {
        id: "child-phone-01",
        name: "Samsung Galaxy A54 (Budi)",
        model: "SM-A546E (Android 14)",
        battery: 84,
        isCharging: false,
        isOnline: true,
        lastSeen: new Date().toISOString(),
        currentApp: "YouTube Kids",
        isLocked: false,
        screenTimeTodayMinutes: 145, // 2 hours 25 mins
        dailyLimitMinutes: 180, // 3 hours
        location: {
          latitude: -6.2088,
          longitude: 106.8456,
          accuracy: 5.2,
          speed: 0.0,
          timestamp: new Date().toISOString(),
          address: "Jl. Sudirman, Jakarta Pusat, DKI Jakarta"
        },
        locationHistory: [
          { latitude: -6.2000, longitude: 106.8400, timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), label: "Sekolah" },
          { latitude: -6.2050, longitude: 106.8420, timestamp: new Date(Date.now() - 3600000 * 1).toISOString(), label: "Jalan Pulang" },
          { latitude: -6.2088, longitude: 106.8456, timestamp: new Date().toISOString(), label: "Rumah" }
        ],
        geofences: [
          {
            id: "geo-home",
            name: "Zona Rumah",
            latitude: -6.2088,
            longitude: 106.8456,
            radiusMeters: 200,
            type: "safe" // safe or dangerous
          },
          {
            id: "geo-school",
            name: "Zona Sekolah (SD Harapan)",
            latitude: -6.2000,
            longitude: 106.8400,
            radiusMeters: 300,
            type: "safe"
          }
        ],
        appLimits: [
          { packageName: "com.google.android.youtube", name: "YouTube", usedMinutes: 65, limitMinutes: 60, isBlocked: false, category: "Entertainment", icon: "youtube" },
          { packageName: "com.zhiliaoapp.musically", name: "TikTok", usedMinutes: 45, limitMinutes: 30, isBlocked: true, category: "Social", icon: "video" },
          { packageName: "com.roblox.client", name: "Roblox", usedMinutes: 20, limitMinutes: 45, isBlocked: false, category: "Games", icon: "gamepad-2" },
          { packageName: "com.whatsapp", name: "WhatsApp", usedMinutes: 15, limitMinutes: 120, isBlocked: false, category: "Communication", icon: "message-circle" }
        ],
        alerts: [
          { id: "alt-1", type: "limit_exceeded", message: "TikTok telah melampaui batas harian (30 menit)", timestamp: new Date(Date.now() - 15 * 60000).toISOString() },
          { id: "alt-2", type: "geofence_enter", message: "Budi telah sampai di Zona Rumah", timestamp: new Date(Date.now() - 30 * 60000).toISOString() }
        ]
      }
    ]
  ]),

  // Active pairing codes (e.g. "849201" -> { deviceId, expiresAt })
  pairingCodes: new Map([
    ["849201", { deviceId: "child-phone-01", createdAt: Date.now() }]
  ])
};

// Helper: Calculate distance in meters between two lat/lon (Haversine formula)
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
