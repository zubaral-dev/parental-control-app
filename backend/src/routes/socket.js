import { state, getDistanceMeters } from "../state.js";

export function setupSocketHandlers(io) {
  // Map socketId -> { role: 'parent' | 'child', deviceId: string }
  const socketMeta = new Map();

  io.on("connection", (socket) => {
    console.log(`[Socket] New connection: ${socket.id}`);

    // Registration from Parent Dashboard
    socket.on("register:parent", (data) => {
      socketMeta.set(socket.id, { role: "parent", deviceId: data?.deviceId });
      socket.join("parents");
      if (data?.deviceId) {
        socket.join(`device:${data.deviceId}`);
      }
      console.log(`[Socket] Parent registered for device: ${data?.deviceId || 'all'}`);
    });

    // Registration from Child Device (Phone Web Client or Simulator or Native APK)
    socket.on("register:child", (data) => {
      const deviceId = data?.deviceId || "child-phone-01";
      socketMeta.set(socket.id, { role: "child", deviceId });
      socket.join(`device:${deviceId}`);
      socket.join("children");

      // Auto-detect or upsert device in state
      let device = state.devices.get(deviceId);
      if (!device) {
        device = {
          id: deviceId,
          name: data.name || (data.isIOS ? "Apple iPhone" : "Android Smartphone"),
          model: data.model || "Mobile Browser Companion",
          battery: data.battery || 100,
          isCharging: false,
          isOnline: true,
          lastSeen: new Date().toISOString(),
          currentApp: "Camera & Safety Agent",
          isLocked: false,
          screenTimeTodayMinutes: 0,
          dailyLimitMinutes: 180,
          location: {
            latitude: -6.2088,
            longitude: 106.8456,
            accuracy: 10,
            speed: 0,
            timestamp: new Date().toISOString(),
            address: "Menunggu sinyal GPS..."
          },
          locationHistory: [],
          geofences: [
            {
              id: "geo-home",
              name: "Zona Rumah",
              latitude: -6.2088,
              longitude: 106.8456,
              radiusMeters: 200,
              type: "safe"
            }
          ],
          appLimits: [],
          alerts: []
        };
        state.devices.set(deviceId, device);
      } else {
        device.isOnline = true;
        device.lastSeen = new Date().toISOString();
        if (data.name) device.name = data.name;
        if (data.model) device.model = data.model;
        if (data.battery !== undefined) device.battery = data.battery;
      }

      // Notify parents
      io.to(`device:${deviceId}`).emit("device:status", {
        deviceId,
        isOnline: true,
        battery: device.battery,
        name: device.name,
        model: device.model
      });

      console.log(`[Socket] Child device connected: ${deviceId} (${device.name})`);
    });

    // Child sends real-time GPS location update
    socket.on("child:location_update", (data) => {
      const meta = socketMeta.get(socket.id);
      const deviceId = meta?.deviceId || data.deviceId;
      if (!deviceId) return;

      const device = state.devices.get(deviceId);
      if (!device) return;

      const { latitude, longitude, accuracy = 5, speed = 0, address } = data;
      const prevLocation = { ...device.location };

      device.location = {
        latitude,
        longitude,
        accuracy,
        speed,
        timestamp: new Date().toISOString(),
        address: address || device.location.address
      };

      device.locationHistory.push({
        latitude,
        longitude,
        timestamp: new Date().toISOString()
      });
      if (device.locationHistory.length > 50) {
        device.locationHistory.shift();
      }

      // Check geofences
      device.geofences.forEach((geo) => {
        const dist = getDistanceMeters(latitude, longitude, geo.latitude, geo.longitude);
        const isInside = dist <= geo.radiusMeters;
        const prevDist = getDistanceMeters(prevLocation.latitude, prevLocation.longitude, geo.latitude, geo.longitude);
        const wasInside = prevDist <= geo.radiusMeters;

        if (!wasInside && isInside) {
          const alert = {
            id: `alt-${Date.now()}`,
            type: "geofence_enter",
            message: `${device.name} memasuki "${geo.name}"`,
            timestamp: new Date().toISOString()
          };
          device.alerts.unshift(alert);
          io.to(`device:${deviceId}`).emit("device:alert", alert);
        } else if (wasInside && !isInside) {
          const alert = {
            id: `alt-${Date.now()}`,
            type: "geofence_exit",
            message: `${device.name} telah meninggalkan "${geo.name}"`,
            timestamp: new Date().toISOString()
          };
          device.alerts.unshift(alert);
          io.to(`device:${deviceId}`).emit("device:alert", alert);
        }
      });

      io.to(`device:${deviceId}`).emit("device:location", {
        deviceId,
        location: device.location
      });
    });

    // Child reports screen time & active foreground app
    socket.on("child:app_stats", (data) => {
      const meta = socketMeta.get(socket.id);
      const deviceId = meta?.deviceId || data.deviceId;
      if (!deviceId) return;

      const device = state.devices.get(deviceId);
      if (!device) return;

      if (data.currentApp) device.currentApp = data.currentApp;
      if (data.screenTimeTodayMinutes !== undefined) device.screenTimeTodayMinutes = data.screenTimeTodayMinutes;
      if (data.battery !== undefined) device.battery = data.battery;
      if (data.isCharging !== undefined) device.isCharging = data.isCharging;
      if (data.appLimits && Array.isArray(data.appLimits)) {
        device.appLimits = data.appLimits;
      }

      io.to(`device:${deviceId}`).emit("device:stats", {
        deviceId,
        currentApp: device.currentApp,
        screenTimeTodayMinutes: device.screenTimeTodayMinutes,
        dailyLimitMinutes: device.dailyLimitMinutes,
        battery: device.battery,
        isCharging: device.isCharging,
        appLimits: device.appLimits,
        isLocked: device.isLocked
      });
    });

    // Parent sends lock / unlock command
    socket.on("parent:lock_device", (data) => {
      const { deviceId, isLocked } = data;
      const device = state.devices.get(deviceId);
      if (device) {
        device.isLocked = Boolean(isLocked);
        io.to(`device:${deviceId}`).emit("command:lock", { isLocked: device.isLocked });
        io.to(`device:${deviceId}`).emit("device:status", { deviceId, isLocked: device.isLocked });
      }
    });

    // ==========================================
    // 📷 LIVE REMOTE CAMERA (FRONT & REAR)
    // ==========================================
    
    // Parent switches camera lens: 'user' (front) or 'environment' (back)
    socket.on("camera:switch_lens", (data) => {
      const { deviceId, facingMode } = data;
      console.log(`[Camera] Switch lens for ${deviceId} to ${facingMode}`);
      io.to(`device:${deviceId}`).emit("command:camera_switch_lens", { facingMode });
    });

    // Parent toggles camera streaming on/off
    socket.on("camera:toggle", (data) => {
      const { deviceId, enabled, facingMode } = data;
      console.log(`[Camera] Toggle camera for ${deviceId}: ${enabled} (${facingMode})`);
      io.to(`device:${deviceId}`).emit("command:camera_toggle", { enabled, facingMode: facingMode || "user" });
    });

    // Child streams live camera frame (JPEG/base64 from canvas or video capture)
    socket.on("child:camera_frame", (data) => {
      const { deviceId, frame, facingMode } = data;
      // Broadcast live camera frame to parents watching this device
      socket.to(`device:${deviceId}`).emit("device:camera_frame", {
        deviceId,
        frame,
        facingMode,
        timestamp: Date.now()
      });
    });

    // Parent requests snapshot photo
    socket.on("camera:request_snapshot", (data) => {
      const { deviceId } = data;
      io.to(`device:${deviceId}`).emit("command:take_snapshot");
    });

    // Child returns snapshot photo
    socket.on("child:snapshot_taken", (data) => {
      const { deviceId, photoUrl } = data;
      io.to(`device:${deviceId}`).emit("device:snapshot_result", { deviceId, photoUrl });
    });

    // ==========================================
    // 🖥️ WebRTC Screen Mirroring & Audio Signaling
    // ==========================================
    socket.on("webrtc:request_stream", (data) => {
      const { deviceId } = data;
      io.to(`device:${deviceId}`).emit("webrtc:request_stream", { from: socket.id });
    });

    socket.on("webrtc:offer", (data) => {
      const { target, sdp, deviceId } = data;
      if (target) {
        io.to(target).emit("webrtc:offer", { sdp, from: socket.id, deviceId });
      } else {
        io.to(`device:${deviceId}`).emit("webrtc:offer", { sdp, from: socket.id, deviceId });
      }
    });

    socket.on("webrtc:answer", (data) => {
      const { target, sdp, deviceId } = data;
      if (target) {
        io.to(target).emit("webrtc:answer", { sdp, from: socket.id, deviceId });
      } else {
        io.to(`device:${deviceId}`).emit("webrtc:answer", { sdp, from: socket.id, deviceId });
      }
    });

    socket.on("webrtc:ice_candidate", (data) => {
      const { target, candidate, deviceId } = data;
      if (target) {
        io.to(target).emit("webrtc:ice_candidate", { candidate, from: socket.id, deviceId });
      } else {
        io.to(`device:${deviceId}`).emit("webrtc:ice_candidate", { candidate, from: socket.id, deviceId });
      }
    });

    socket.on("child:screen_frame", (data) => {
      const { deviceId, frame } = data;
      socket.to(`device:${deviceId}`).emit("device:screen_frame", { frame, deviceId });
    });

    socket.on("disconnect", () => {
      const meta = socketMeta.get(socket.id);
      if (meta?.role === "child") {
        const device = state.devices.get(meta.deviceId);
        if (device) {
          device.isOnline = false;
          device.lastSeen = new Date().toISOString();
          io.to(`device:${meta.deviceId}`).emit("device:status", {
            deviceId: meta.deviceId,
            isOnline: false,
            lastSeen: device.lastSeen
          });
        }
        console.log(`[Socket] Child device disconnected: ${meta.deviceId}`);
      }
      socketMeta.delete(socket.id);
    });
  });
}
