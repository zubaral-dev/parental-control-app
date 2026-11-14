import express from "express";
import http from "http";
import https from "https";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { Server } from "socket.io";
import cors from "cors";
import selfsigned from "selfsigned";
import localtunnel from "localtunnel";
import apiRouter from "./routes/api.js";
import { setupSocketHandlers } from "./routes/socket.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "15mb" }));
app.use(express.static(path.join(__dirname, "../public")));

let publicTunnelUrl = null;

// REST API routes
app.use("/api", apiRouter);

// Health check & Server info
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "parental-control-backend",
    time: new Date(),
    localIps: getLocalIpAddresses(),
    tunnelUrl: publicTunnelUrl
  });
});

app.get("/api/server-info", (req, res) => {
  res.json({
    localIps: getLocalIpAddresses(),
    httpPort: 3000,
    httpsPort: 3001,
    tunnelUrl: publicTunnelUrl
  });
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../public/index.html"));
});

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal && !iface.address.startsWith("169.254")) {
        addresses.push(iface.address);
      }
    }
  }
  return addresses;
}

const HTTP_PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3001;

async function startServer() {
  const ips = getLocalIpAddresses();
  const primaryIp = ips[0] || "192.168.1.100";

  // 1. Create HTTP Server
  const httpServer = http.createServer(app);

  // 2. Create Apple iOS Compliant Self-Signed HTTPS Certificate
  let httpsServer = null;
  try {
    const attrs = [{ name: "commonName", value: primaryIp }];
    const options = {
      days: 365,
      keySize: 2048,
      algorithm: "sha256",
      extensions: [
        { name: "basicConstraints", cA: true },
        {
          name: "subjectAltName",
          altNames: [
            { type: 2, value: "localhost" },
            { type: 7, ip: primaryIp },
            { type: 7, ip: "127.0.0.1" }
          ]
        }
      ]
    };
    
    // Await async certificate generation!
    const pems = await selfsigned.generate(attrs, options);
    httpsServer = https.createServer({ key: pems.private, cert: pems.cert }, app);
  } catch (err) {
    console.warn("⚠️ Gagal membuat sertifikat lokal HTTPS:", err.message);
  }

  // Socket.io attached to HTTP and HTTPS
  const io = new Server({
    cors: { origin: "*", methods: ["GET", "POST"] },
    maxHttpBufferSize: 2e7
  });

  io.attach(httpServer);
  if (httpsServer) {
    io.attach(httpsServer);
  }

  setupSocketHandlers(io);

  // Start HTTP
  httpServer.listen(HTTP_PORT, "0.0.0.0", async () => {
    console.log(`================================================================`);
    console.log(`🚀 Parental Control Server Aktif!`);
    console.log(`💻 [Dashboard Orang Tua]: http://localhost:${HTTP_PORT}`);
    console.log(``);

    // Try starting HTTPS server
    if (httpsServer) {
      httpsServer.listen(HTTPS_PORT, "0.0.0.0", () => {
        console.log(`🏠 [Link Wi-Fi Lokal]: https://${primaryIp}:${HTTPS_PORT}/child.html`);
      });
    }

    // Try creating Public HTTPS Tunnel with localtunnel for 100% iOS/Android compatibility
    try {
      console.log(`⏳ Menghubungkan Cloud Tunnel HTTPS untuk iPhone/Android...`);
      const tunnel = await localtunnel({ port: HTTP_PORT });
      publicTunnelUrl = tunnel.url;
      console.log(`✨ [LINK RESMI HTTPS UNTUK HP IPHONE & ANDROID]:`);
      console.log(`👉 ${publicTunnelUrl}/child.html`);
      console.log(`(Buka link di atas di Safari iPhone atau Chrome Android - Langsung Terbuka!)`);
      console.log(`================================================================`);

      tunnel.on("close", () => {
        console.log("Tunnel closed");
        publicTunnelUrl = null;
      });
    } catch (tunnelErr) {
      console.log(`⚠️ Tunnel info: Gunakan link Wi-Fi lokal https://${primaryIp}:${HTTPS_PORT}/child.html`);
      console.log(`================================================================`);
    }
  });
}

startServer();
