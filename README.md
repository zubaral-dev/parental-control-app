# AirParental - Kontrol & Pemantauan Anak (AirDroid Parental Clone)

Aplikasi pemantauan keselamatan anak modern dengan fitur **Live Remote Camera (Kamera Depan & Belakang)**, **Pelacakan GPS & Geofencing**, **Screen Time & App Blocker**, dan **Screen Mirroring**.

Bisa langsung dicoba di smartphone asli Anda (**iPhone Safari** maupun **Android Chrome**) tanpa perlu kompilasi APK terlebih dahulu!

---

## 🚀 Cara Menjalankan & Langsung Tes di HP

### Langkah 1: Jalankan Server Backend
Buka terminal/PowerShell di komputer Anda:
```powershell
cd C:\Users\LENOVO\.gemini\antigravity\scratch\parental-control-app\backend
npm start
```
Server akan aktif di:
- 💻 **Dashboard Orang Tua:** [http://localhost:5000](http://localhost:5000)
- 📱 **Agen HP Anak (HTTPS):** `https://192.168.1.100:5001/child.html`

---

### Langkah 2: Buka Dashboard Orang Tua di Laptop/PC
Buka browser di laptop Anda:
👉 **[http://localhost:5000](http://localhost:5000)**

Anda akan langsung melihat tab **Live Remote Camera**, **Lokasi & Geofence (GPS)**, dan **Waktu Layar**.

---

### Langkah 3: Buka Link Kamera di iPhone atau Android Anda
Pastikan HP Anda terhubung ke jaringan **Wi-Fi yang sama** dengan laptop.

1. Buka browser di HP Anda:
   - **iPhone:** Buka browser **Safari**
   - **Android:** Buka browser **Google Chrome**
2. Ketik alamat berikut (atau scan QR Code dari tombol **"Coba di HP Anda"** di Dashboard):
   👉 **`https://192.168.1.100:5001/child.html`**
3. **Catatan Penting Sertifikat Lokal:**
   - Karena server berjalan di jaringan lokal (`https://192.168.1.100`), browser HP akan menampilkan peringatan keamanan standar.
   - Di iPhone Safari: Ketuk **"Show Details"** / **"Tampilkan Detail"** -> ketuk **"visit this website"** / **"kunjungi situs web ini"**.
   - Di Android Chrome: Ketuk **"Lanjutan / Advanced"** -> ketuk **"Lanjutkan ke 192.168.1.100 (tidak aman)"**.
   *(Protokol HTTPS ini diwajibkan oleh iOS & Android agar browser mengizinkan akses ke kamera dan GPS).*
4. Ketuk **"Izinkan Akses Kamera"** dan **"Izinkan Akses Lokasi"**.

---

## 📷 Fitur Live Remote Camera yang Bisa Anda Coba

1. **Ganti Lensa Kamera dari Dashboard:**
   - Di Dashboard Orang Tua, klik tombol **"Kamera Depan (Selfie)"** atau **"Kamera Belakang (Lingkungan)"**. HP Anda akan langsung berganti lensa secara *real-time*!
2. **Ambil Foto Seketika (Snapshot):**
   - Klik tombol **"Ambil Foto (Snapshot)"** di Dashboard untuk mengambil gambar resolusi tinggi dari kamera HP dan mengunduhnya ke laptop.
3. **Mode Layar Gelap (Stealth AirDroid):**
   - Di HP Anda, ketuk tombol **"Mode Layar Gelap (Stealth)"**. Layar HP akan menjadi hitam pekat menyerupai HP terkunci/mati, namun siaran kamera dan GPS tetap mengalir ke dashboard orang tua.
4. **Pelacakan GPS Nyata:**
   - Di tab **Lokasi & Geofence**, koordinat GPS dari sensor HP Anda akan langsung muncul di peta Jakarta dengan akurasi meter.

---

## 📱 Untuk Pengembang Native Android (Kotlin)
Jika nanti ingin mengemasnya menjadi file APK Android mandiri di Android Studio:
- Kode sumber native lengkap tersedia di folder [`android-agent/`](file:///C:/Users/LENOVO/.gemini/antigravity/scratch/parental-control-app/android-agent).
- Layanan kamera native tersedia di `android-agent/app/src/main/java/com/parental/agent/services/CameraStreamService.kt` menggunakan Android **Camera2 API** & **YUV420 ImageReader**.
