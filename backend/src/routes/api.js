import { Router } from "express";
import { state } from "../state.js";

const router = Router();

// Get all paired devices
router.get("/devices", (req, res) => {
  const devices = Array.from(state.devices.values());
  res.json({ success: true, count: devices.length, devices });
});

// Get single device details
router.get("/devices/:id", (req, res) => {
  const device = state.devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }
  res.json({ success: true, device });
});

// Generate or check 6-digit pairing code
router.post("/pairing/generate", (req, res) => {
  const { deviceId, deviceName } = req.body;
  if (!deviceId) {
    return res.status(400).json({ success: false, message: "deviceId is required" });
  }

  // Generate 6-digit code
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  state.pairingCodes.set(code, {
    deviceId,
    deviceName: deviceName || "Android Child Device",
    createdAt: Date.now()
  });

  res.json({ success: true, code, expiresSeconds: 600 });
});

// Parent inputs pairing code
router.post("/pairing/verify", (req, res) => {
  const { code } = req.body;
  const pairing = state.pairingCodes.get(code);

  if (!pairing) {
    return res.status(400).json({ success: false, message: "Kode pairing tidak valid atau telah kedaluwarsa" });
  }

  // Create device entry if not exists
  if (!state.devices.has(pairing.deviceId)) {
    state.devices.set(pairing.deviceId, {
      id: pairing.deviceId,
      name: pairing.deviceName,
      model: "Android Companion",
      battery: 100,
      isCharging: false,
      isOnline: true,
      lastSeen: new Date().toISOString(),
      currentApp: "Home Launcher",
      isLocked: false,
      screenTimeTodayMinutes: 0,
      dailyLimitMinutes: 180,
      location: {
        latitude: -6.2088,
        longitude: 106.8456,
        accuracy: 10,
        speed: 0,
        timestamp: new Date().toISOString(),
        address: "Lokasi Perangkat Terdeteksi"
      },
      locationHistory: [],
      geofences: [],
      appLimits: [],
      alerts: []
    });
  }

  // Consume code
  state.pairingCodes.delete(code);

  res.json({
    success: true,
    message: "Perangkat berhasil dihubungkan!",
    device: state.devices.get(pairing.deviceId)
  });
});

// Update device daily limit or lock state
router.patch("/devices/:id/settings", (req, res) => {
  const device = state.devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }

  const { dailyLimitMinutes, isLocked, name } = req.body;
  if (dailyLimitMinutes !== undefined) device.dailyLimitMinutes = Number(dailyLimitMinutes);
  if (isLocked !== undefined) device.isLocked = Boolean(isLocked);
  if (name !== undefined) device.name = name;

  res.json({ success: true, device });
});

// Update App Rules (block / unblock / set limit)
router.patch("/devices/:id/apps/:packageName", (req, res) => {
  const device = state.devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }

  const { packageName } = req.params;
  const { isBlocked, limitMinutes } = req.body;

  const app = device.appLimits.find((a) => a.packageName === packageName);
  if (app) {
    if (isBlocked !== undefined) app.isBlocked = Boolean(isBlocked);
    if (limitMinutes !== undefined) app.limitMinutes = Number(limitMinutes);
  } else {
    // Add new app rule
    device.appLimits.push({
      packageName,
      name: req.body.name || packageName,
      usedMinutes: 0,
      limitMinutes: limitMinutes || 60,
      isBlocked: Boolean(isBlocked),
      category: req.body.category || "General",
      icon: "app-window"
    });
  }

  res.json({ success: true, appLimits: device.appLimits });
});

// Add or update Geofence zone
router.post("/devices/:id/geofences", (req, res) => {
  const device = state.devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }

  const { name, latitude, longitude, radiusMeters, type } = req.body;
  const newGeofence = {
    id: `geo-${Date.now()}`,
    name: name || "Zona Baru",
    latitude: Number(latitude),
    longitude: Number(longitude),
    radiusMeters: Number(radiusMeters) || 200,
    type: type || "safe"
  };

  device.geofences.push(newGeofence);
  res.json({ success: true, geofences: device.geofences, newGeofence });
});

// Delete Geofence zone
router.delete("/devices/:id/geofences/:geofenceId", (req, res) => {
  const device = state.devices.get(req.params.id);
  if (!device) {
    return res.status(404).json({ success: false, message: "Device not found" });
  }

  device.geofences = device.geofences.filter((g) => g.id !== req.params.geofenceId);
  res.json({ success: true, geofences: device.geofences });
});

export default router;
