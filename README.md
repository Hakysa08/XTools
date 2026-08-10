<div align="center">

# 🛠️ XTools

### Semua alat PDF yang kamu butuhkan — gratis, langsung di peramban

Gabungkan, pisahkan, kompres, konversi, dan amankan file PDF hanya dengan beberapa klik.
Tanpa perlu daftar akun, tanpa biaya, dan tersedia dalam **Bahasa Indonesia & English**.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)

</div>

---

## ✨ Tentang XTools

**XTools** adalah aplikasi web berisi **30 alat pengolah PDF** yang bisa dipakai siapa saja secara
gratis. Semua proses berjalan langsung dari peramban — cukup unggah file, pilih opsinya, lalu unduh
hasilnya. Antarmukanya bersih, mendukung **mode terang & gelap**, dan bisa berganti bahasa antara
Indonesia dan Inggris dengan sekali klik.

Website ini terinspirasi dari layanan sejenis, namun dibangun ulang dari nol dengan tampilan dan
identitas tersendiri.

---

## 🚀 Daftar Fitur

<table>
<tr>
<td width="33%" valign="top">

### 📂 Atur PDF
- Gabung PDF
- Pisah PDF
- Hapus Halaman
- Ambil Halaman
- Susun Halaman
- Pindai ke PDF (kamera)

</td>
<td width="33%" valign="top">

### ⚡ Optimalkan
- Kompres PDF
- Perbaiki PDF
- OCR (teks bisa dicari)

### 🎨 Edit
- Edit PDF (teks, gambar, bentuk)
- Putar PDF
- Nomor Halaman
- Watermark
- Potong PDF
- Formulir PDF

</td>
<td width="33%" valign="top">

### 🔄 Konversi
- JPG / Word / PowerPoint / Excel / HTML **ke PDF**
- PDF **ke** Word / PowerPoint / Excel / JPG / PDF/A

### 🔒 Keamanan
- Proteksi PDF (kata sandi)
- Buka Kunci PDF
- Tanda Tangan PDF
- Sensor PDF
- Bandingkan PDF

</td>
</tr>
</table>

> 💡 Fitur berbasis kecerdasan buatan (Ringkas PDF, Terjemahkan PDF, PDF ke Markdown) sudah
> disiapkan tempatnya dan akan hadir pada pembaruan berikutnya.

---

## 🧰 Teknologi yang Digunakan

| Bidang | Teknologi |
|---|---|
| **Framework** | Next.js 16 (App Router) + React 19 |
| **Bahasa** | TypeScript |
| **Styling** | Tailwind CSS v4 |
| **Ikon** | Lucide React |
| **Validasi** | Zod |
| **Pemroses PDF** | pdf-lib, pdf.js |
| **Gambar** | sharp, @napi-rs/canvas |
| **OCR** | Tesseract.js |
| **Konversi & render** | Puppeteer, docx, ExcelJS, PptxGenJS, Mammoth |

---

## 📦 Cara Menjalankan

Pastikan **Node.js 20 atau lebih baru** sudah terpasang di komputermu.

```bash
# 1. Klon repositori
git clone https://github.com/Hakysa08/XTools.git
cd XTools

# 2. Pasang seluruh dependensi
npm install

# 3. Jalankan mode pengembangan
npm run dev
```

Buka **http://localhost:3000** di peramban.

### Perintah lainnya

```bash
npm run build      # membangun versi produksi
npm run start      # menjalankan hasil build
npm run typecheck  # memeriksa tipe TypeScript
```

---

## 📚 Dokumentasi yang Disarankan Dipelajari

Sebelum menggunakan, memodifikasi, atau ikut mengembangkan XTools, ada baiknya memahami
teknologi-teknologi berikut. Klik nama teknologinya untuk langsung membuka dokumentasi resminya:

**Dasar (wajib dipahami dulu)**
- 🔗 [**Node.js**](https://nodejs.org/en/learn) — lingkungan tempat aplikasi ini dijalankan
- 🔗 [**JavaScript (MDN)**](https://developer.mozilla.org/id/docs/Web/JavaScript) — bahasa dasar web
- 🔗 [**TypeScript**](https://www.typescriptlang.org/docs/) — JavaScript dengan tipe data
- 🔗 [**Git & GitHub**](https://docs.github.com/id/get-started) — alat kolaborasi & penyimpanan kode

**Framework & tampilan**
- 🔗 [**React**](https://react.dev/learn) — pustaka antarmuka pengguna
- 🔗 [**Next.js**](https://nextjs.org/docs) — framework utama XTools (App Router)
- 🔗 [**Tailwind CSS**](https://tailwindcss.com/docs) — sistem styling yang dipakai

**Pengolahan PDF & pendukung**
- 🔗 [**pdf-lib**](https://pdf-lib.js.org/) — membuat & memodifikasi PDF
- 🔗 [**pdf.js (Mozilla)**](https://mozilla.github.io/pdf.js/) — merender & membaca isi PDF
- 🔗 [**Tesseract.js**](https://github.com/naptha/tesseract.js#tesseractjs) — mesin OCR
- 🔗 [**Puppeteer**](https://pptr.dev/) — mesin konversi HTML/Office ke PDF
- 🔗 [**Zod**](https://zod.dev/) — validasi data
- 🔗 [**Sharp**](https://sharp.pixelplumbing.com/) — pemrosesan gambar

> 📝 **Saran urutan belajar:** mulai dari JavaScript → TypeScript → React → Next.js. Setelah paham
> keempatnya, kamu sudah bisa memahami dan mengembangkan hampir seluruh bagian XTools.

---

## 🗂️ Struktur Proyek

```
XTools/
├── app/            Halaman, route API, sitemap & robots
├── components/     Komponen UI: layout, beranda, workspace alat, editor visual
├── lib/
│   ├── tools/      Daftar alat, skema opsi, dan seluruh pemroses
│   ├── pdf/        Fungsi bantu pengolahan PDF
│   ├── i18n/       Kamus Bahasa Indonesia & Inggris
│   └── server/     Penyimpanan file, rate limit, dan helper API
└── scripts/        Skrip bantu pengembangan
```

Menambah alat baru cukup dengan **menambah satu entri** pada daftar alat dan **satu berkas pemroses** —
halaman, menu navigasi, metadata SEO, dan validasi akan menyesuaikan otomatis.

---

## 🔐 Privasi

File yang kamu unggah diproses di server lalu **dihapus otomatis paling lama 2 jam** setelahnya.
XTools tidak meminta data pribadi apa pun dan tidak menampilkan iklan pihak ketiga.

---

<div align="center">

Dibuat oleh [**Hakysa08**](https://github.com/Hakysa08)

</div>
