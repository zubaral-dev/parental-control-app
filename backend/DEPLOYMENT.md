# Panduan Deployment Cloud (Agar Bisa Dipakai Beda Jaringan / Di Mana Saja)

Agar aplikasi dapat memantau anak **di mana saja lewat kuota seluler (4G/5G) maupun Wi-Fi yang berbeda**, server backend tidak bisa hanya berjalan di laptop/komputer lokal. Server harus di-hosting di **Cloud VPS / PaaS** yang aktif 24/7 dan memiliki alamat domain publik HTTPS.

---

## 🌐 Opsi 1: Deploy Gratis ke Render.com (Direkomendasikan - Paling Mudah)

Render menyediakan hosting gratis dengan HTTPS bawaan:

1. Buka [https://render.com](https://render.com) dan buat akun gratis.
2. Klik tombol **New +** ➔ pilih **Web Service**.
3. Hubungkan repository GitHub Anda (atau upload folder `backend`).
4. Konfigurasikan:
   - **Name:** `airparental-backend`
   - **Environment:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `node src/index.js`
   - **Instance Type:** `Free`
5. Klik **Create Web Service**.
6. Anda akan mendapatkan URL publik permanen, contoh:
   👉 `https://airparental-backend.onrender.com`

---

## 🌐 Opsi 2: Deploy ke Railway.app

1. Buka [https://railway.app](https://railway.app) dan login dengan GitHub.
2. Klik **New Project** ➔ **Deploy from GitHub Repo**.
3. Pilih repository Anda. Railway akan otomatis mendeteksi `Dockerfile` yang telah disediakan dan melakukan deployment.
4. Di tab **Settings** ➔ **Networking**, klik **Generate Domain**.
5. Anda akan mendapatkan URL publik HTTPS permanen.

---

## 🌐 Opsi 3: Menggunakan VPS Ubuntu (DigitalOcean, Linode, AWS, dsb.)

Jika Anda memiliki VPS Linux:
```bash
# 1. Masuk ke VPS
ssh root@ip-vps-anda

# 2. Install Node.js & PM2
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2

# 3. Clone atau Upload folder backend
git clone <repo-url> /var/www/parental-backend
cd /var/www/parental-backend/backend
npm install

# 4. Jalankan 24/7 dengan PM2
pm2 start src/index.js --name parental-control
pm2 save
pm2 startup
```

---

## 📱 Mengapa Browser Web Tidak Bisa Jalan di Latar Belakang (Layar Mati)?

Saat menguji melalui browser (Safari di iPhone / Chrome di Android):
- **Sistem Operasi HP (iOS & Android) sengaja mematikan kamera dan proses JavaScript** segera setelah tab browser di-minimize atau layar HP dikunci. Ini adalah mekanisme keamanan resmi (*OS Privacy Sandbox*) untuk mencegah situs web memata-matai pengguna secara diam-diam.

### Solusi Agar Berjalan di Latar Belakang:
Untuk berjalan terus di latar belakang meskipun aplikasi ditutup:
1. **Untuk Android:** Harus dikompilasi menjadi **file APK Native** (menggunakan kode Kotlin yang telah disediakan di folder `android-agent/`). Aplikasi Android menggunakan **Foreground Service** dengan `START_STICKY` dan pengecualian hemat baterai (*Ignore Battery Optimizations*).
2. **Untuk iPhone (iOS):** Kebijakan keamanan Apple melarang keras kamera diakses saat aplikasi berada di latar belakang (*background camera*). Apple hanya mengizinkan pemantauan **Lokasi Latar Belakang (GPS)** dan **Screen Time API / MDM** resmi.
