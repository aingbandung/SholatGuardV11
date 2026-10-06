# SholatGuard – proyek APK (Capacitor + GitHub Actions)

## Cara build APK
1. Buat repository baru di GitHub, lalu upload **seluruh isi** folder ini (termasuk folder `.github`).
2. Buka tab **Actions** → workflow **Build APK** (otomatis jalan saat push, atau klik *Run workflow*).
3. Tunggu ±5–8 menit, lalu unduh artifact **SholatGuard-debug-apk** (berisi `app-debug.apk`).
4. Pindahkan ke HP, izinkan "install dari sumber tidak dikenal", lalu install.

## Struktur
- `www/index.html` – aplikasi (mode gelap: menu Profile → Theme, atau tombol bulan di header)
- `www/manifest.webmanifest`, `www/icon-*.png` – ikon & manifest web
- `resources/` – ikon sumber (1024px) untuk ikon launcher Android (adaptive icon)
- `scripts/fetch-vendor.sh` – unduh MediaPipe + model supaya APK bisa offline
- `.github/workflows/main.yml` – workflow build

## Mengganti ikon
Ganti `resources/icon-only.png`, `icon-foreground.png`, `icon-background.png` (1024×1024) lalu push ulang.
Mengganti nama/ID aplikasi: edit `capacitor.config.json`.

## Perubahan v10
- Kepala ikut digambar di kerangka; deteksi salam memakai arah hadap kepala (hidung terhadap telinga/mata).
- Pilihan "Voice qunut (Arab)" di Profile, untuk memilih suara Arab pria bila ada.
- Duduk antara dua sujud lebih toleran: bila labelnya tidak stabil tetapi badan tegak setelah sujud pertama, dianggap duduk
  (sebelumnya sujud kedua ikut tidak terhitung). Debug menampilkan `tegak ya/tidak`.
- Suara & perintah suara di APK tetap lewat jembatan plugin di `www/sg-native.js` (WebView Android tidak punya
  speechSynthesis / SpeechRecognition sendiri). Cek versi terpasang di bagian bawah halaman: "build v10".

## Perubahan v11
- **Model pose Full** dipakai default (lebih akurat saat duduk/sujud; HP di lantai sering membuat model Lite salah menaruh pinggul).
  Pilihan "Model pose" ada di Profile (Full/Lite). Bila Full gagal dimuat, otomatis memakai Lite. Berlaku setelah aplikasi dibuka ulang.
- **Fitur kepala** ditambahkan ke deteksi tampak depan: turunnya hidung dan perubahan ukuran kepala (jarak mata), relatif terhadap
  posisi berdiri saat takbir. Kepala hampir selalu terbaca walau pinggul/kaki tertutup, jadi duduk antara dua sujud tetap
  dikenali walau titik badan kacau. Satu fitur yang kacau tidak lagi mengalahkan fitur lain.
- **Kalibrasi berulang tidak menimpa**: tiap kalibrasi disimpan sebagai data baru dalam profil yang sama (maks. 8). Aplikasi menilai
  tiap kalibrasi (keterpisahan antar-posisi, kestabilan, kecocokan dengan kalibrasi lain) dan memakai gabungan yang terbaik (maks. 3).
  Di Profile bisa melihat skor, menghapus satu kalibrasi, atau memilih "Hanya #n". Profil lama otomatis dibaca sebagai kalibrasi "lama".
- Skrip `fetch-vendor.sh` kini mengunduh model Full dan Lite (APK bertambah sekitar 9 MB).
