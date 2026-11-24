# Amatu Fingerprint

Penelusur jejak publik: username (47 situs), email, nomor HP, nama tokoh publik, plat nomor, domain/IP, IMEI dan nomor rangka, serta pembaca susunan NIK, KK, SIM, dan NPWP di perangkat.

Hanya memakai halaman publik, API resmi, dan pembacaan nomor di browser. Tidak memuat data Dukcapil, pemilik kendaraan, label GetContact, atau basis data bocor.

- `index.html`, `style.css`, `js/app.js`: antarmuka
- `js/decode.js`: pembaca nomor, tanpa jaringan
- `supabase/functions/amatu-fingerprint`: pemeriksa sumber publik (perlu masuk Portal AMATU)
- `fingerprint.sql`: batas harian dan daftar permintaan hapus

Data: kode wilayah dari cahyadsn/wilayah (MIT); kode plat dari Wikipedia Indonesia (CC BY-SA 4.0); libphonenumber-js (MIT).
