// Pure decoders. Everything here runs in the browser; nothing is sent or stored.
(function (root) {
  'use strict';
  const digits = (s) => String(s || '').replace(/\D/g, '');
  const MONTH = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const tgl = (d) => `${d.getDate()} ${MONTH[d.getMonth()]} ${d.getFullYear()}`;
  const validDate = (y, m, d) => { const x = new Date(y, m - 1, d); return x.getFullYear() === y && x.getMonth() === m - 1 && x.getDate() === d ? x : null; };
  const century = (yy, now) => { const c = now.getFullYear() % 100; return yy > c ? 1900 + yy : 2000 + yy; };
  const luhn = (s) => { let t = 0; [...s].reverse().forEach((c, i) => { let n = +c; if (i % 2) { n *= 2; if (n > 9) n -= 9; } t += n; }); return t % 10 === 0; };

  function wilayah(code6, W) {
    const p = W[code6.slice(0, 2)], k = W[code6.slice(0, 4)], c = W[code6];
    return { prov: p || '', kab: k || '', kec: c || '' };
  }
  function nik(raw, W, now = new Date()) {
    const s = digits(raw);
    if (s.length !== 16) return { ok: false, err: `NIK harus 16 angka, ini ${s.length} angka.` };
    let d = +s.slice(6, 8); const m = +s.slice(8, 10), yy = +s.slice(10, 12);
    const female = d > 40; if (female) d -= 40;
    let y = century(yy, now), born = validDate(y, m, d);
    if (born && born > now) { y -= 100; born = validDate(y, m, d); }
    const w = wilayah(s.slice(0, 6), W), warn = [];
    if (!w.prov) return { ok: false, err: 'Kode provinsi tidak ada dalam daftar Kemendagri. Susunan NIK tidak sah.' };
    if (!born) return { ok: false, err: 'Bagian tanggal lahir tidak sah (angka ke-7 sampai 12).' };
    if (s.slice(12) === '0000') return { ok: false, err: 'Nomor urut 0000 tidak dipakai.' };
    if (!w.kab) warn.push('Kode kabupaten/kota tidak ada dalam daftar sekarang. Bisa kode lama sebelum pemekaran.');
    else if (!w.kec) warn.push('Kode kecamatan tidak ada dalam daftar sekarang. Bisa kode lama sebelum pemekaran.');
    let age = now.getFullYear() - y; if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
    if (age < 17) warn.push('Pemilik berusia di bawah 17 tahun, belum wajib KTP.');
    return { ok: true, warn, parts: [[s.slice(0, 2), 'Provinsi'], [s.slice(2, 4), 'Kab/Kota'], [s.slice(4, 6), 'Kecamatan'], [s.slice(6, 12), 'Tgl lahir'], [s.slice(12), 'No urut']], rows: [['Provinsi penerbit', w.prov], ['Kabupaten/Kota penerbit', w.kab || '–'], ['Kecamatan penerbit', w.kec || '–'], ['Tanggal lahir', tgl(born)], ['Usia', `${age} tahun`], ['Jenis kelamin', female ? 'Perempuan' : 'Laki-laki'], ['Nomor urut', s.slice(12)]] };
  }
  function kk(raw, W, now = new Date()) {
    const s = digits(raw);
    if (s.length !== 16) return { ok: false, err: `Nomor KK harus 16 angka, ini ${s.length} angka.` };
    const w = wilayah(s.slice(0, 6), W), d = +s.slice(6, 8), m = +s.slice(8, 10), y = 2000 + +s.slice(10, 12), x = validDate(y, m, d), warn = [];
    if (!w.prov) return { ok: false, err: 'Kode provinsi tidak ada dalam daftar Kemendagri.' };
    if (!x) return { ok: false, err: 'Bagian tanggal terbit tidak sah. Bila ini NIK perempuan, pilih jenis KTP.' };
    if (x > now) warn.push('Tanggal terbit ada di masa depan.');
    if (!w.kec) warn.push('Kode kecamatan tidak ada dalam daftar sekarang. Bisa kode lama.');
    return { ok: true, warn, parts: [[s.slice(0, 6), 'Wilayah'], [s.slice(6, 12), 'Tgl terbit'], [s.slice(12), 'No urut']], rows: [['Provinsi', w.prov], ['Kabupaten/Kota', w.kab || '–'], ['Kecamatan', w.kec || '–'], ['Tanggal terbit', tgl(x)], ['Nomor urut', s.slice(12)]] };
  }
  function sim(raw, W, now = new Date()) {
    const s = digits(raw), note = 'Polri tidak menerbitkan rumus resmi nomor SIM. Pembacaan ini mengikuti susunan yang umum dipakai, jadi anggap sebagai perkiraan.';
    if (s.length === 16) { const r = nik(s, W, now); if (r.ok) { r.warn.unshift('SIM 16 angka memakai NIK sebagai nomornya.'); return r; } }
    if (![12, 14, 16].includes(s.length)) return { ok: false, err: `Nomor SIM umumnya 12, 14, atau 16 angka, ini ${s.length} angka.` };
    if (s.length === 16) return { ok: false, err: 'Nomor 16 angka ini tidak cocok dengan susunan NIK.' };
    const L = s.length === 12 ? { y: 0, sat: [4, 8], seq: 8 } : { y: 4, sat: [0, 4], seq: 8 };
    const yy = +s.slice(L.y, L.y + 2), mm = +s.slice(L.y + 2, L.y + 4);
    if (mm < 1 || mm > 12) return { ok: false, err: 'Bagian bulan tidak sah, periksa lagi nomornya.' };
    const parts = s.length === 12 ? [[s.slice(0, 4), 'Thn+bln lahir'], [s.slice(4, 8), 'Kode Satpas'], [s.slice(8), 'No urut']] : [[s.slice(0, 4), 'Kode Satpas'], [s.slice(4, 8), 'Thn+bln'], [s.slice(8), 'No urut']];
    return { ok: true, warn: [note], parts, rows: [['Format', s.length === 12 ? 'SIM lama (12 angka)' : 'Smart SIM (14 angka)'], [s.length === 12 ? 'Lahir (perkiraan)' : 'Tahun dan bulan (perkiraan)', `${MONTH[mm - 1]} ${century(yy, now)}`], ['Kode Satpas (perkiraan)', s.slice(...L.sat)], ['Nomor urut', s.slice(L.seq)]] };
  }
  function npwp(raw, W, now = new Date()) {
    let s = digits(raw);
    if (s.length === 16 && s[0] !== '0') { const r = nik(s, W, now); if (r.ok) r.warn.unshift('NPWP 16 angka orang pribadi memakai NIK.'); return r; }
    if (s.length === 16) s = s.slice(1);
    if (s.length !== 15) return { ok: false, err: `NPWP harus 15 atau 16 angka, ini ${digits(raw).length} angka.` };
    const t = { '01': 'Badan', '02': 'Badan', '03': 'Badan', '21': 'Badan', '31': 'Badan', '00': 'Bendahara pemerintah', '20': 'Bendahara pemerintah', '30': 'Bendahara pemerintah', '04': 'Pengusaha', '06': 'Pengusaha', '05': 'Karyawan', '07': 'Orang pribadi', '08': 'Orang pribadi', '09': 'Orang pribadi', '24': 'Orang pribadi', '25': 'Orang pribadi', '26': 'Orang pribadi', '34': 'Orang pribadi', '35': 'Orang pribadi', '36': 'Orang pribadi', '47': 'Orang pribadi', '48': 'Orang pribadi', '49': 'Orang pribadi', '57': 'Orang pribadi', '58': 'Orang pribadi', '59': 'Orang pribadi' };
    const good = luhn(s.slice(0, 9));
    return { ok: true, warn: good ? [] : ['Angka pemeriksa (ke-9) tidak cocok. Kemungkinan ada salah ketik.'], parts: [[s.slice(0, 2), 'Jenis'], [s.slice(2, 8), 'No register'], [s[8], 'Pemeriksa'], [s.slice(9, 12), 'KPP'], [s.slice(12), 'Cabang']], rows: [['Angka pemeriksa', good ? 'Cocok' : 'Tidak cocok'], ['Jenis wajib pajak', t[s.slice(0, 2)] || `Kode ${s.slice(0, 2)}`], ['Nomor registrasi', s.slice(2, 8)], ['Kode KPP', s.slice(9, 12)], ['Status', s.slice(12) === '000' ? 'Pusat' : `Cabang ${s.slice(12)}`]] };
  }

  // ---------- plate
  const span = (a, b) => { const o = []; for (let c = a.charCodeAt(0); c <= b.charCodeAt(0); c++) o.push(String.fromCharCode(c)); return o.join(''); };
  function pat(p, suf) {
    p = p.trim();
    if (!p || p === '-*' || p === '-') return 0;
    const r = p.match(/^([A-Z]+)\s*[–-]\s*([A-Z]+)$/);
    if (r) { // AAG–FAG: every position runs from the first letter to the second
      if (r[1].length !== r[2].length || suf.length !== r[1].length) return 0;
      return [...suf].every((c, i) => r[1][i] <= r[2][i] ? span(r[1][i], r[2][i]).includes(c) : false) ? 50 : 0;
    }
    if (!/^[A-Z*]+$/.test(p)) return 0;
    const lit = p.replace(/\*/g, '').length, stars = p.length - lit;
    if (!new RegExp('^' + p.replace(/\*+/g, (x) => `[A-Z]{0,${x.length}}`) + '$').test(suf)) return 0;
    return lit * 10 + (stars ? 5 - Math.abs(stars - (suf.length - lit)) : 9);
  }
  function parsePlate(raw) {
    const m = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').match(/^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$/);
    return m ? { code: m[1], num: +m[2], suf: m[3], text: [m[1], m[2], m[3]].filter(Boolean).join(' ') } : null;
  }
  function plate(raw, P, kind = 'auto') {
    const x = parsePlate(raw);
    if (!x) return { ok: false, err: 'Format plat: 1–2 huruf wilayah, 1–4 angka, 0–3 huruf. Contoh: H 1234 AB.' };
    if (x.code === 'RI') return { ok: true, x, special: true, rows: [['Jenis', 'Kendaraan dinas pejabat negara (RI)'], ['Nomor', String(x.num)]], warn: ['Plat RI melekat pada jabatan, bukan orang.'], regions: [] };
    if (['CC', 'CD'].includes(x.code)) return { ok: true, x, special: true, rows: [['Jenis', x.code === 'CD' ? 'Korps diplomatik' : 'Korps konsuler']], warn: [], regions: [] };
    const all = P.r4.filter((e) => e[0] === x.code);
    if (!all.length) return { ok: false, err: `Kode wilayah "${x.code}" tidak ada dalam daftar.` };
    const jak = x.code === 'B', n = x.num, byNum = n >= (jak ? 3000 : 2000) && n <= 6999 ? 'motor' : n >= 1000 ? (n <= 1999 || (jak && n <= 2999) || n >= 7000 ? 'mobil' : '') : '';
    const use = kind === 'auto' ? byNum : kind;
    let jenis = '–';
    if (byNum === 'motor') jenis = 'Sepeda motor (roda dua/tiga)';
    else if (n >= 1000 && n <= (jak ? 2999 : 1999)) jenis = 'Mobil penumpang (sedan, SUV, minibus)';
    else if (n >= 7000 && n <= 7999) jenis = 'Bus';
    else if (n >= 8000 && n <= 8999) jenis = jak ? 'Mobil penumpang (seri tambahan Jadetabek)' : 'Mobil barang (pikap, truk)';
    else if (n >= 9000) jenis = jak ? 'Mobil barang (pikap, truk)' : 'Mobil barang atau kendaraan khusus';
    else jenis = 'Nomor pilihan (1–3 angka), jenis tidak terbaca dari nomor';
    const list = use === 'motor' ? P.r2 : use === 'mobil' ? P.r4 : [...P.r4, ...P.r2];
    let best = 0, regions = [];
    if (x.suf) for (const e of list) {
      if (e[0] !== x.code) continue;
      const sc = Math.max(0, ...e[3].split('/').map((p) => pat(p, x.suf)));
      if (!sc) continue;
      if (sc > best) { best = sc; regions = []; }
      if (sc === best && !regions.some((r) => r[2] === e[2])) regions.push(e);
    }
    const provs = [...new Set(all.map((e) => e[1]))];
    const warn = [];
    if (x.suf && !regions.length) warn.push('Seri huruf belakang belum ada dalam daftar, jadi kota penerbit tidak bisa dipastikan.');
    if (/^(RF|Q[A-Z]|Z[A-Z])/.test(x.suf) && x.suf.length === 3) warn.push('Seri ini juga dipakai sebagai seri khusus/rahasia instansi.');
    if (kind !== 'auto' && byNum && kind !== byNum) warn.push('Jenis yang dipilih tidak cocok dengan rentang nomornya.');
    return { ok: true, x, regions, warn, provs: regions.length ? [...new Set(regions.map((r) => r[1]))] : provs, rows: [['Kode wilayah', x.code], ['Provinsi', (regions.length ? [...new Set(regions.map((r) => r[1]))] : provs).join(', ')], ['Samsat penerbit', regions.length ? regions.map((r) => r[2]).join(' / ') : [...new Set(all.map((e) => e[2]))].slice(0, 8).join(', ')], ['Perkiraan jenis', jenis], ['Nomor registrasi', String(x.num)], ['Seri huruf', x.suf || '–']] };
  }

  // ---------- phone
  const OPS = { Telkomsel: '0811 0812 0813 0821 0822 0823 0852 0853', 'Telkomsel (by.U / Halo)': '0851', 'Indosat Ooredoo': '0814 0815 0816 0855 0856 0857 0858', XL: '0817 0818 0819 0859 0877 0878 0879', AXIS: '0831 0832 0833 0838', 'Tri (3)': '0895 0896 0897 0898 0899', Smartfren: '0881 0882 0883 0884 0885 0886 0887 0888 0889' };
  const AREA = { '021': 'Jakarta, Depok, Tangerang, Bekasi', '022': 'Bandung', '024': 'Semarang', '031': 'Surabaya', '061': 'Medan', '0231': 'Cirebon', '0251': 'Bogor', '0254': 'Serang, Cilegon', '0271': 'Surakarta', '0274': 'Yogyakarta', '0281': 'Purwokerto', '0283': 'Tegal', '0285': 'Pekalongan', '0291': 'Kudus, Demak', '0293': 'Magelang', '0298': 'Salatiga', '0341': 'Malang', '0351': 'Madiun', '0354': 'Kediri', '0361': 'Denpasar', '0370': 'Mataram', '0380': 'Kupang', '0411': 'Makassar', '0431': 'Manado', '0451': 'Palu', '0511': 'Banjarmasin', '0541': 'Samarinda', '0542': 'Balikpapan', '0561': 'Pontianak', '0651': 'Banda Aceh', '0711': 'Palembang', '0717': 'Pangkalpinang', '0721': 'Bandar Lampung', '0736': 'Bengkulu', '0741': 'Jambi', '0751': 'Padang', '0761': 'Pekanbaru', '0778': 'Batam', '0911': 'Ambon', '0967': 'Jayapura' };
  function idPhone(national) { // "0822..." → operator / area
    for (const k in OPS) if (OPS[k].split(' ').includes(national.slice(0, 4))) return { op: k };
    for (const l of [4, 3]) if (AREA[national.slice(0, l)]) return { area: AREA[national.slice(0, l)] };
    return {};
  }

  // ---------- device and vehicle numbers
  function imei(raw) {
    const s = digits(raw);
    if (s.length !== 15) return { ok: false, err: `IMEI harus 15 angka, ini ${s.length} angka.` };
    const good = luhn(s);
    return { ok: true, warn: good ? [] : ['Angka pemeriksa tidak cocok. IMEI salah ketik atau tidak asli.'], parts: [[s.slice(0, 8), 'TAC (model)'], [s.slice(8, 14), 'No seri'], [s[14], 'Pemeriksa']], rows: [['Angka pemeriksa', good ? 'Cocok' : 'Tidak cocok'], ['Kode model (TAC)', s.slice(0, 8)], ['Nomor seri', s.slice(8, 14)]] };
  }
  function vin(raw) {
    const s = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(s)) return { ok: false, err: 'Nomor rangka (VIN) harus 17 huruf/angka tanpa I, O, dan Q.' };
    const C = { A: 'Afrika', B: 'Afrika', C: 'Afrika', J: 'Jepang', K: 'Korea Selatan', L: 'Tiongkok', M: 'Asia', S: 'Eropa', T: 'Eropa', V: 'Eropa', W: 'Jerman', Y: 'Eropa', Z: 'Italia', 1: 'Amerika Serikat', 4: 'Amerika Serikat', 5: 'Amerika Serikat', 2: 'Kanada', 3: 'Meksiko', 6: 'Australia', 9: 'Amerika Selatan' };
    let c = C[s[0]] || '–';
    if (s[0] === 'M') c = s[1] >= 'A' && s[1] <= 'E' ? 'India' : s[1] >= 'F' && s[1] <= 'K' ? 'Indonesia' : s[1] >= 'L' && s[1] <= 'R' ? 'Thailand' : 'Asia';
    if (s[0] === 'P') c = s[1] >= 'A' && s[1] <= 'E' ? 'Filipina' : s[1] >= 'L' && s[1] <= 'R' ? 'Malaysia' : 'Asia';
    return { ok: true, warn: [], s, parts: [[s.slice(0, 3), 'Pabrik (WMI)'], [s.slice(3, 9), 'Tipe'], [s[9], 'Kode tahun'], [s[10], 'Pabrik'], [s.slice(11), 'No seri']], rows: [['Asal pabrik', c], ['Kode pabrik (WMI)', s.slice(0, 3)], ['Nomor seri', s.slice(11)]] };
  }

  function detect(raw) {
    const s = String(raw || '').trim(), d = digits(s), compact = s.replace(/[\s.\-()]/g, '');
    if (!s) return '';
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) return 'email';
    if (/^https?:\/\//i.test(s)) return 'domain';
    if (/^(\d{1,3}\.){3}\d{1,3}$/.test(s)) return 'domain';
    if (/^\+\d{7,15}$/.test(compact) || /^(62|0)\d{8,13}$/.test(compact) && d.length <= 14) return 'phone';
    if (/^\d{16}$/.test(compact)) return 'doc';
    if (/^\d{15}$/.test(compact)) return 'device';
    if (/^\d{12}$|^\d{14}$/.test(compact)) return 'doc';
    if (/^[A-HJ-NPR-Z0-9]{17}$/i.test(compact) && /\d/.test(compact) && /[a-z]/i.test(compact)) return 'device';
    if (parsePlate(s) && /\d/.test(s) && (s === s.toUpperCase() || /\s/.test(s))) return 'plate';
    if (/^@?[a-z\d][a-z\d-]*(\.[a-z\d-]+)*\.(com|id|net|org|co|io|info|biz|xyz|me|dev|app|site|online|shop|store|web|go|ac|sch|my|to|tv|ai)$/i.test(s) && !s.startsWith('@')) return 'domain';
    if (/\s/.test(s)) return 'name';
    return 'user';
  }
  const api = { nik, kk, sim, npwp, plate, parsePlate, idPhone, imei, vin, detect, luhn, digits };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.DECODE = api;
})(typeof window !== 'undefined' ? window : globalThis);
