(() => {
'use strict';
const D = window.DECODE, $ = (s, r = document) => r.querySelector(s);
const SB = window.AMATU?.SB_URL || 'https://ieyqxmzztoxgpvwexbkj.supabase.co';
const KEY = window.AMATU?.SB_KEY || 'sb_publishable_o-PQxhkJJ8FG4mHYTUqEBw_uXv9n-eG';
const FN = window.FP_FN || `${SB}/functions/v1/amatu-fingerprint`;
const token = () => window.AMATU?.sess?.()?.t || '';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const enc = encodeURIComponent;
const safe = (u) => /^https?:\/\//i.test(u || '') ? esc(u) : '#';
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
const I = (p) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
const IC = { search: I('<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'), clock: I('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'), shield: I('<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6z"/>'), info: I('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>'), user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>'), email: I('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'), phone: I('<path d="M6 3h3l2 5-2.5 2a12 12 0 0 0 5.5 5.5L16 13l5 2v3a3 3 0 0 1-3 3A15 15 0 0 1 3 6a3 3 0 0 1 3-3z"/>'), name: I('<path d="M4 20V5h16v15M8 9h8M8 13h5"/>'), doc: I('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="2"/><path d="M5.5 16c.5-1.5 1.5-2 3-2s2.5.5 3 2M14 10h4M14 14h4"/>'), plate: I('<rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 10v4M9 10v4M13 10v4M18 10v4M15 10v4"/>'), domain: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'), device: I('<path d="M4 16v-3l2-5h12l2 5v3M4 16h16v3h-3v-2H7v2H4zM7 13h.01M17 13h.01"/>'), out: I('<path d="M8 16 17 7M9 7h8v8"/>'), x: I('<path d="m6 6 12 12M18 6 6 18"/>'), down: I('<path d="M12 4v11m-4-4 4 4 4-4M5 20h14"/>'), copy: I('<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>') };
const TYPES = {
  user: ['Username', 'nama_pengguna', '47 situs sekaligus: profil, bio, pengikut, tanggal gabung'],
  email: ['Email', 'nama@contoh.com', 'Profil Gravatar, server email, dan kebocoran data Anda'],
  phone: ['Nomor HP', '0812 3456 7890', 'Operator, wilayah, jenis nomor, laporan penipuan'],
  name: ['Nama', 'nama lengkap', 'Tokoh publik di Wikidata dan pintasan pencarian resmi'],
  doc: ['KTP, KK, SIM, NPWP', '16 angka NIK', 'Baca susunan nomor dan cek keabsahannya, di perangkat ini saja'],
  plate: ['Plat nomor', 'H 1234 AB', 'Samsat penerbit, jenis kendaraan, dan cek pajak resmi'],
  domain: ['Domain atau IP', 'contoh.id', 'Registrar, umur domain, DNS, dan lokasi server'],
  device: ['IMEI atau rangka', '15 angka IMEI / 17 huruf VIN', 'Keaslian IMEI, pabrik dan model kendaraan'],
};
const PRIVATE = ['doc', 'device']; // never written to history
const S = { type: '', auto: true, view: 'card', sort: 'kuat', filter: '', cat: '', only: '', run: 0, r: null, docKind: 'nik', plateKind: 'auto', own: false };

// ---------- storage (per device, synced by amatu.js inside the owner's own account)
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private window */ } };
let prefs = load('fingerprint.prefs', { hist: true, view: 'card' }); S.view = prefs.view || 'card';
let hist = load('fingerprint.hist', []);
function remember(type, q, n) {
  if (!prefs.hist || PRIVATE.includes(type)) return;
  hist = [{ type, q, n, t: Date.now() }, ...hist.filter((h) => !(h.type === type && h.q === q))].slice(0, 100); save('fingerprint.hist', hist);
}
const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200); };
const fmtDate = (s) => { if (!s) return ''; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); };
const num = (v) => typeof v === 'number' ? v.toLocaleString('id-ID') : v;

// ---------- server
async function post(body) {
  const r = await fetch(FN, { method: 'POST', headers: { apikey: KEY, 'x-amatu': token(), 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return r;
}
async function ask(body) {
  const r = await post(body), j = await r.json().catch(() => null);
  if (!j) throw new Error('Server tidak menjawab dengan benar. Coba lagi.');
  if (j.error) throw new Error(j.error);
  return j;
}
let W, P; const dataW = async () => W ||= await (await fetch('data/wilayah.json')).json(), dataP = async () => P ||= await (await fetch('data/plat.json')).json();
const jget = async (u) => { const r = await fetch(u, { referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(12000) }); if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); };

// ---------- pages
const NAV = { cari: ['Cari', 'search'], riwayat: ['Riwayat', 'clock'], privasi: ['Hapus diri', 'shield'], sumber: ['Sumber', 'info'] };
function route() {
  const p = location.hash.slice(1) in NAV ? location.hash.slice(1) : 'cari';
  $('#nav').innerHTML = Object.entries(NAV).map(([k, v]) => `<a href="#${k}" ${k === p ? 'aria-current="page"' : ''}>${IC[v[1]]}<span>${v[0]}</span></a>`).join('');
  ({ cari, riwayat, privasi, sumber })[p]();
}
let searchQ = '';
function cari() {
  $('#main').innerHTML = `<div class="in"><h1>Telusuri jejak publik</h1><p class="lead">Masukkan satu petunjuk. Jenisnya dikenali otomatis, atau pilih sendiri.</p>
  <div class="types" role="group" aria-label="Jenis pencarian">${Object.entries(TYPES).map(([k, t]) => `<button class="chip" data-type="${k}" aria-pressed="false">${IC[k]}<span>${t[0]}</span></button>`).join('')}</div>
  <form class="sform" autocomplete="off"><div class="box"><input id="q" aria-label="Yang dicari" spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="200" value="${esc(searchQ)}"></div><button class="btn">Cari</button></form>
  <div class="opts" id="opts"></div><div id="out" aria-live="polite"></div></div>`;
  const q = $('#q');
  q.oninput = () => { searchQ = q.value; if (S.auto) { const t = D.detect(q.value); if (t !== S.type) { S.type = t; mark(); } } };
  $('.types').onclick = (e) => { const b = e.target.closest('[data-type]'); if (!b) return; S.auto = false; S.type = b.dataset.type; mark(); q.focus(); };
  $('.sform').onsubmit = (e) => { e.preventDefault(); go(); };
  mark();
  if (S.r) paint(); else intro();
  if (matchMedia('(min-width:821px)').matches) q.focus();
}
function mark() {
  document.querySelectorAll('[data-type]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.type === S.type));
  const pb = document.querySelector('.types [aria-pressed=true]'), tb = $('.types'); if (pb && tb.scrollWidth > tb.clientWidth) tb.scrollLeft = pb.offsetLeft - 60;
  $('#q').placeholder = S.type ? TYPES[S.type][1] : 'Username, email, nomor HP, plat, domain…';
  const o = $('#opts'), seg = (id, cur, list) => `<span class="seg" data-seg="${id}">${list.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${v === cur}">${l}</button>`).join('')}</span>`;
  o.innerHTML = S.type === 'doc' ? seg('docKind', S.docKind, [['nik', 'KTP (NIK)'], ['kk', 'KK'], ['sim', 'SIM'], ['npwp', 'NPWP']]) + '<span>Nomor dibaca di perangkat ini, tidak dikirim dan tidak disimpan.</span>'
    : S.type === 'plate' ? seg('plateKind', S.plateKind, [['auto', 'Otomatis'], ['mobil', 'Mobil'], ['motor', 'Motor']])
    : S.type === 'email' ? `<label><input type="checkbox" id="own" ${S.own ? 'checked' : ''}> Ini email saya, cek juga kebocoran datanya</label>` : '';
  o.querySelectorAll('[data-seg]').forEach((g) => g.onclick = (e) => { const b = e.target.closest('[data-v]'); if (!b) return; S[g.dataset.seg] = b.dataset.v; mark(); if (S.r && S.r.type === S.type && $('#q').value.trim()) go(); });
  if ($('#own')) $('#own').onchange = (e) => { S.own = e.target.checked; };
}
function intro() {
  $('#out').innerHTML = `<div class="ex">${Object.entries(TYPES).map(([k, t]) => `<button data-ex="${k}">${IC[k]}<span><b>${t[0]}</b><small>${t[2]}</small></span></button>`).join('')}</div>`;
  $('.ex').onclick = (e) => { const b = e.target.closest('[data-ex]'); if (b) { S.auto = false; S.type = b.dataset.ex; mark(); $('#q').focus(); } };
}
function start(type, q) { S.auto = true; S.type = type; searchQ = q; S.r = null; if (location.hash !== '#cari') { location.hash = 'cari'; setTimeout(go, 40); } else { cari(); go(); } scrollTo(0, 0); }

async function go() {
  let q = $('#q').value.trim(); if (!q) return $('#q').focus();
  if (S.auto || !S.type) S.type = D.detect(q) || 'user';
  mark();
  const run = ++S.run, type = S.type; S.filter = S.cat = S.only = '';
  if (type === 'user') q = q.replace(/^@/, '');
  S.r = { type, q, at: new Date(), busy: true, src: [], by: {} }; paint();
  try { await RUN[type](q, S.r, () => run === S.run && paint(), () => run === S.run); } catch (e) { if (run === S.run) S.r.err = e.name === 'TypeError' ? 'Tidak bisa terhubung ke server. Periksa internet lalu coba lagi.' : e.message; }
  if (run !== S.run) return;
  S.r.busy = false; paint();
  if (!S.r.err && !S.r.optout) remember(type, q, S.r.count ?? null);
}

const RUN = {
  async user(q, r, up, alive) {

    const x = await post({ a: 'user', q });
    if (!/ndjson/.test(x.headers.get('content-type') || '')) { const j = await x.json().catch(() => ({})); if (j.optout) { r.optout = true; return; } throw new Error(j.error || 'Server tidak menjawab dengan benar.'); }
    const rd = x.body.getReader(), td = new TextDecoder(); let buf = '', last = 0, ended = false;
    for (;;) {
      const { done, value } = await rd.read(); if (done) break;
      if (!alive()) { rd.cancel(); return; }
      buf += td.decode(value, { stream: true }); const L = buf.split('\n'); buf = L.pop();
      for (const l of L) { if (!l) continue; const m = JSON.parse(l); if (m.t === 'list') { r.src = m.src; } else if (m.t === 'src') r.by[m.id] = m; else if (m.t === 'end') ended = true; }
      if (Date.now() - last > 160) { last = Date.now(); evaluate(r); up(); }
    }
    evaluate(r); r.cutoff = !ended;
  },
  async email(q, r, up) {
    const dom = q.split('@')[1];
    const dns = (t, n = dom) => jget(`https://dns.google/resolve?name=${enc(n)}&type=${t}`).then((j) => (j.Answer || []).map((a) => a.data)).catch(() => null);
    const [s, mx, txt, dm] = await Promise.all([ask({ a: 'email', q, own: S.own }), dns('MX'), dns('TXT'), dns('TXT', `_dmarc.${dom}`)]);
    if (s.optout) { r.optout = true; return; }
    Object.assign(r, s); r.dom = dom; r.mx = mx; r.spf = txt && txt.some((t) => /v=spf1/i.test(t)); r.dmarc = dm && dm.some((t) => /v=dmarc1/i.test(t)); r.count = s.gravatar ? 1 : 0;
  },
  async phone(q, r) {
    const L = window.libphonenumber; if (!L) throw new Error('Pustaka nomor telepon belum termuat. Muat ulang halaman.');
    let s = q.replace(/[^\d+]/g, ''); if (/^62\d{7,}/.test(s)) s = '+' + s;
    let p; try { p = L.parsePhoneNumber(s, 'ID'); } catch { throw new Error('Bukan nomor telepon yang bisa dibaca.'); }
    r.e164 = p.number; r.valid = p.isValid(); r.rows = [['Format internasional', p.formatInternational()], ['Format lokal', p.formatNational()], ['Negara', p.country ? new Intl.DisplayNames(['id'], { type: 'region' }).of(p.country) : `+${p.countryCallingCode}`], ['Sah menurut aturan nomor', r.valid ? 'Ya' : 'Tidak'], ['Jenis', { MOBILE: 'Seluler', FIXED_LINE: 'Telepon rumah/kantor', FIXED_LINE_OR_MOBILE: 'Seluler atau telepon rumah', TOLL_FREE: 'Bebas pulsa', PREMIUM_RATE: 'Premium', VOIP: 'Internet (VoIP)', UAN: 'Nomor perusahaan' }[p.getType()] || 'Tidak diketahui']];
    if (p.country === 'ID') { const i = D.idPhone('0' + p.nationalNumber); if (i.op) r.rows.push(['Operator pemberi nomor', i.op]); if (i.area) r.rows.push(['Wilayah', i.area]); }
  },
  async name(q, r) {
    const j = await jget(`https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${enc(q)}&language=id&uselang=id&type=item&limit=8&format=json&origin=*`);
    const ids = (j.search || []).map((x) => x.id); r.people = [];
    if (ids.length) {
      const e = await jget(`https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims|sitelinks&languages=id|en&format=json&origin=*`);
      const val = (x, p) => x.claims?.[p]?.[0]?.mainsnak?.datavalue?.value;
      for (const id of ids) {
        const x = e.entities?.[id]; if (!x || !(x.claims?.P31 || []).some((c) => c.mainsnak?.datavalue?.value?.id === 'Q5')) continue;
        const img = val(x, 'P18'), born = val(x, 'P569');
        r.people.push({ name: (x.labels.id || x.labels.en)?.value || id, desc: (x.descriptions.id || x.descriptions.en)?.value || '', img: img ? `https://commons.wikimedia.org/wiki/Special:FilePath/${enc(img)}?width=160` : '', born: born && born.precision >= 9 ? born.time.slice(1, 5) : '', url: x.sitelinks?.idwiki ? `https://id.wikipedia.org/wiki/${enc(x.sitelinks.idwiki.title)}` : x.sitelinks?.enwiki ? `https://en.wikipedia.org/wiki/${enc(x.sitelinks.enwiki.title)}` : `https://www.wikidata.org/wiki/${id}`, ids: [['X', val(x, 'P2002')], ['Instagram', val(x, 'P2003')], ['Situs', val(x, 'P856')]].filter((a) => typeof a[1] === 'string') });
      }
    }
    r.count = r.people.length;
  },
  async doc(q, r) { r.kind = S.docKind; r.dec = D[S.docKind](q, await dataW()); if (!r.dec.ok) throw new Error(r.dec.err); },
  async plate(q, r) { r.dec = D.plate(q, await dataP(), S.plateKind); if (!r.dec.ok) throw new Error(r.dec.err); },
  async domain(q, r) {
    let h = q.trim().toLowerCase(); try { if (/^https?:/.test(h)) h = new URL(h).hostname; } catch { /* keep */ }
    h = h.split('/')[0].replace(/^www\./, ''); r.host = h; r.ip = /^(\d{1,3}\.){3}\d{1,3}$/.test(h);
    const dns = (t) => jget(`https://dns.google/resolve?name=${enc(h)}&type=${t}`).then((j) => (j.Answer || []).map((a) => a.data)).catch(() => []);
    const [rd, a, mx, ns, txt] = await Promise.all([ask({ a: 'rdap', q: h }).catch((e) => ({ error: e.message })), r.ip ? [h] : dns('A'), r.ip ? [] : dns('MX'), r.ip ? [] : dns('NS'), r.ip ? [] : dns('TXT')]);
    const ip4 = a.find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x));
    Object.assign(r, { rd, a, mx, ns, txt }); r.geo = ip4 ? await jget(`https://ipwho.is/${ip4}`).catch(() => null) : null; r.count = a.length;
    if (rd.error && !a.length) throw new Error(`Domain tidak ditemukan (${rd.error}).`);
  },
  async device(q, r) {
    const c = q.replace(/[\s.-]/g, ''); r.kind = /^\d{15}$/.test(c) ? 'imei' : c.length === 17 ? 'vin' : 'imei';
    r.dec = D[r.kind](q); if (!r.dec.ok) throw new Error(r.dec.err);
    if (r.kind === 'vin') { const j = await jget(`https://vpic.nhtsa.dot.gov/api/vehicles/decodevinvalues/${enc(r.dec.s)}?format=json`).catch(() => null), x = j?.Results?.[0] || {}; for (const [k, l] of [['Make', 'Merek'], ['Model', 'Model'], ['ModelYear', 'Tahun'], ['VehicleType', 'Jenis'], ['BodyClass', 'Bodi'], ['Manufacturer', 'Pembuat'], ['PlantCountry', 'Negara pabrik'], ['EngineCylinders', 'Silinder'], ['DisplacementL', 'Isi silinder (L)'], ['FuelTypePrimary', 'Bahan bakar']]) if (x[k] && x[k] !== 'Not Applicable') r.dec.rows.push([l, x[k]]); }
  },
};

// ---------- evidence: accounts with the same name or linking to each other are grouped; a shared username alone is not evidence
const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]/gu, '');
function evaluate(r) {
  const acc = r.src.filter((s) => r.by[s.id]?.state === 'found').map((s) => ({ ...s, ...r.by[s.id].hit, page: r.by[s.id].hit.url || s.url, id: s.id, site: s.name, name: r.by[s.id].hit.name }));
  const u = norm(r.q), names = {};
  for (const a of acc) { a.key = norm(a.name); a.real = a.key && a.key !== u && a.key.length > 3; if (a.real && /\S\s+\S/.test(String(a.name).trim())) (names[a.key] ||= []).push(a); }
  for (const a of acc) {
    a.ev = [];
    const same = a.real ? (names[a.key] || []).filter((x) => x !== a) : [];
    if (same.length) a.ev.push(`Nama sama dengan ${same.slice(0, 3).map((x) => x.site).join(', ')}`);
    const links = (a.links || []).map((l) => l.toLowerCase());
    for (const b of acc) if (b !== a) {
      const bh = host(b.page); if (!bh) continue;
      if (links.some((l) => host(l) === bh && l.includes(r.q.toLowerCase()))) { a.ev.push(`Menautkan ${b.site}`); a.strong = true; }
      if ((b.links || []).some((l) => host(l) === host(a.page) && l.toLowerCase().includes(r.q.toLowerCase()))) { a.ev.push(`Ditautkan dari ${b.site}`); a.strong = true; }
      if (links.some((l) => (b.links || []).map((y) => y.toLowerCase().replace(/\/$/, '')).includes(l.replace(/\/$/, '')) && host(l).length > 3)) a.ev.push(`Tautan sama dengan ${b.site}`);
    }
    a.ev = [...new Set(a.ev)]; a.score = (a.strong ? 4 : 0) + a.ev.length * 2 + (a.real ? 1 : 0) + (a.avatar ? 1 : 0) + (a.bio ? 1 : 0);
  }
  r.acc = acc; r.count = acc.length;
  r.names = Object.values(names).map((l) => [l[0].name, l.length]).sort((a, b) => b[1] - a[1]);
  r.locs = [...new Set(acc.map((a) => a.loc).filter(Boolean))];
  r.joined = acc.filter((a) => a.joined).sort((a, b) => a.joined < b.joined ? -1 : 1)[0];
  r.seen = acc.filter((a) => a.seen).sort((a, b) => a.seen > b.seen ? -1 : 1)[0];
  r.links = [...new Set(acc.flatMap((a) => a.links || []))].slice(0, 12);
  const piv = new Set();
  const PV = /^(github\.com|gitlab\.com|x\.com|twitter\.com|instagram\.com|t\.me|tiktok\.com|youtube\.com|twitch\.tv|linktr\.ee|reddit\.com|keybase\.io|dev\.to|bsky\.app|soundcloud\.com|facebook\.com|threads\.(net|com))$/;
  for (const l of r.links) if (PV.test(host(l))) { const m = new URL(l).pathname.split('/').filter((x) => x && !['user', 'u', 'profile', 'in'].includes(x))[0]; const n = (m || '').replace(/^@/, ''); if (/^[\w.-]{3,40}$/.test(n) && !/\.php$/.test(n)) piv.add(n); }
  for (const a of acc) if (a.handle && !a.handle.includes('.bsky.social')) piv.add(a.handle);
  r.pivots = [...piv].filter((x) => x.toLowerCase() !== r.q.toLowerCase()).slice(0, 10);
}
function variants(u) {
  const b = u.replace(/[._-]/g, ''), o = new Set([b, u.replace(/[._-]/g, '_'), u.replace(/[._-]/g, '.'), u.replace(/\d+$/, ''), `${b}_`, `_${b}`, `${b}id`, `${b}official`, `real${b}`]);
  o.delete(u); return [...o].filter((x) => x.length > 2 && x.length < 31).slice(0, 8);
}

// ---------- painting
const links = (list) => `<ul class="go">${list.map(([t, u, d]) => `<li><a href="${safe(u)}" target="_blank" rel="noopener noreferrer"><b>${esc(t)}</b>${IC.out}<small>${esc(d)}</small></a></li>`).join('')}</ul>`;
const kv = (rows, big) => `<dl class="kv ${big ? 'big' : ''}">${rows.filter((x) => x[1] !== '' && x[1] != null).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl>`;
const parts = (p) => p ? `<div class="num">${p.map(([a, b]) => `<div><b>${esc(a)}</b><small>${esc(b)}</small></div>`).join('')}</div>` : '';
const warns = (w) => (w || []).map((x) => `<p class="note warn">${esc(x)}</p>`).join('');
const card = (t, b) => `<section class="card"><h2>${t}</h2>${b}</section>`;
const chips = (a) => `<div class="wrap">${a.map(([t, q, l]) => `<button class="chip mono" data-go="${t}" data-q="${esc(q)}"><span>${esc(l || q)}</span></button>`).join('')}</div>`;
const exp = (more = true) => `<div class="bar noprint">${more ? `<button class="btn s" data-ex="csv">${IC.down}CSV</button><button class="btn s" data-ex="json">${IC.down}JSON</button>` : ''}<button class="btn s" data-ex="txt">${IC.down}Teks</button><button class="btn s" data-ex="pdf">${IC.down}PDF</button></div>`;

function paint() {
  const o = $('#out'), r = S.r; if (!o || !r) return;
  const head = `<div class="print-head"><b>Amatu Fingerprint</b> · ${esc(TYPES[r.type][0])}: ${esc(r.q)} · ${r.at.toLocaleString('id-ID')}</div>`;
  if (r.optout) { o.innerHTML = '<p class="note">Pemilik identitas ini meminta agar tidak ditampilkan di Amatu Fingerprint.</p>'; return; }
  if (r.err) { o.innerHTML = `<p class="note err">${esc(r.err)}</p>` + (/Portal AMATU/.test(r.err) ? '<a class="btn s" href="/">Buka Portal AMATU</a>' : ''); return; }
  if (r.type === 'user') return paintUser(o, r, head);
  if (r.busy) { o.innerHTML = '<p class="empty">Memeriksa…</p>'; return; }
  o.innerHTML = head + VIEW[r.type](r); wire(o);
}
function wire(o) {
  o.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => start(b.dataset.go, b.dataset.q));
  o.querySelectorAll('[data-ex]').forEach((b) => b.onclick = () => exportAs(b.dataset.ex));
  o.querySelectorAll('[data-copy]').forEach((b) => b.onclick = () => navigator.clipboard.writeText(b.dataset.copy).then(() => toast('Disalin'), () => toast('Gagal menyalin')));
  o.querySelectorAll('.ava img').forEach((i) => i.onerror = () => { const b = i.parentNode; b.textContent = b.dataset.l; });
}
const ava = (a) => `<span class="ava" data-l="${esc((a.site || a.name || '?')[0])}" aria-hidden="true">${a.avatar ? `<img src="${safe(a.avatar)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : esc((a.site || a.name || '?')[0])}</span>`;

function shown(r) {
  const f = S.filter.toLowerCase();
  let l = (r.acc || []).filter((a) => (!S.cat || a.cat === S.cat) && (!S.only || (S.only === 'bukti' ? a.ev.length : S.only === 'foto' ? a.avatar : S.only === 'lokasi' ? a.loc : S.only === 'terverifikasi' ? a.verified : 1)) && (!f || JSON.stringify([a.site, a.name, a.handle, a.bio, a.loc, a.fields]).toLowerCase().includes(f)));
  const fol = (a) => +(a.fields?.Pengikut || 0);
  return l.sort({ kuat: (a, b) => b.score - a.score, nama: (a, b) => a.site.localeCompare(b.site), pengikut: (a, b) => fol(b) - fol(a), lama: (a, b) => (a.joined || '9') < (b.joined || '9') ? -1 : 1, aktif: (a, b) => (a.seen || '0') > (b.seen || '0') ? -1 : 1 }[S.sort]);
}
function paintUser(o, r, head) {
  const tot = r.src.length, done = Object.keys(r.by).length, blk = r.src.filter((s) => ['blocked', 'error'].includes(r.by[s.id]?.state));
  if (!tot) { o.innerHTML = '<p class="empty">Menghubungi server…</p>'; return; }
  const acc = r.acc || [], L = shown(r), cats = [...new Set(acc.map((a) => a.cat))].sort();
  const foc = document.activeElement?.id === 'flt' ? document.activeElement.selectionStart : -1, opened = [...o.querySelectorAll('details')].map((d) => d.open);
  const sum = [];
  if (r.names?.length) sum.push(['Nama tampilan', r.names.slice(0, 6).map(([n, c]) => `<span class="tag ${c > 1 ? 'ok' : ''}">${esc(n)}${c > 1 ? ` ×${c}` : ''}</span>`).join('')]);
  if (r.locs?.length) sum.push(['Lokasi yang ditulis di profil', r.locs.slice(0, 6).map((l) => `<span class="tag">${esc(l)}</span>`).join('')]);
  if (r.joined) sum.push(['Akun tertua', `<span class="tag">${esc(r.joined.site)}, ${fmtDate(r.joined.joined)}</span>`]);
  if (r.seen) sum.push(['Aktivitas terbaru', `<span class="tag">${esc(r.seen.site)}, ${fmtDate(r.seen.seen)}</span>`]);
  if (r.links?.length) sum.push(['Tautan di profil', r.links.slice(0, 6).map((l) => `<a class="tag" href="${safe(l)}" target="_blank" rel="noopener noreferrer">${esc(host(l) + (new URL(l).pathname.length > 1 ? new URL(l).pathname : ''))}</a>`).join('')]);
  const manual = [['Instagram', `https://www.instagram.com/${enc(r.q)}/`], ['Facebook', `https://www.facebook.com/${enc(r.q)}`], ['Threads', `https://www.threads.com/@${enc(r.q)}`], ['LinkedIn', `https://www.linkedin.com/in/${enc(r.q)}`], ['Reddit', `https://www.reddit.com/user/${enc(r.q)}`], ['Kaskus', `https://www.kaskus.co.id/@${enc(r.q)}`], ['Tokopedia', `https://www.tokopedia.com/${enc(r.q)}`], ['Shopee', `https://shopee.co.id/${enc(r.q)}`], ['Behance', `https://www.behance.net/${enc(r.q)}`], ['Letterboxd', `https://letterboxd.com/${enc(r.q)}/`], ['Replit', `https://replit.com/@${enc(r.q)}`], ['Google', `https://www.google.com/search?q=${enc(`"${r.q}"`)}`]];
  o.innerHTML = `${head}<div class="status"><b>${acc.length} profil</b><span>${done < tot && r.busy ? `${done} dari ${tot} situs diperiksa` : `${tot} situs diperiksa${blk.length ? `, ${blk.length} tidak bisa dibaca` : ''}`}</span></div>
  ${r.cutoff ? '<p class="note warn">Koneksi terputus sebelum semua situs selesai. Cari lagi untuk melengkapi.</p>' : ''}
  <div class="scan" role="img" aria-label="${done} dari ${tot} situs selesai">${r.src.map((s) => `<i class="${r.by[s.id]?.state || ''}" title="${esc(s.name)}"></i>`).join('')}</div>
  ${sum.length ? `<div class="sum">${sum.map(([t, b]) => `<div><h3>${t}</h3><div class="vals">${b}</div></div>`).join('')}</div>` : ''}
  ${r.pivots?.length ? `<div class="noprint" style="margin-bottom:16px"><h3>Username lain yang ditemukan</h3>${chips(r.pivots.map((p) => ['user', p]))}</div>` : ''}
  ${acc.length ? `<div class="bar noprint"><input class="txt" id="flt" placeholder="Saring hasil" value="${esc(S.filter)}" aria-label="Saring hasil"><select id="cat" aria-label="Kategori"><option value="">Semua kategori</option>${cats.map((c) => `<option ${c === S.cat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select><select id="only" aria-label="Syarat">${[['', 'Semua profil'], ['bukti', 'Saling cocok'], ['foto', 'Ada foto'], ['lokasi', 'Ada lokasi'], ['terverifikasi', 'Terverifikasi']].map(([v, l]) => `<option value="${v}" ${v === S.only ? 'selected' : ''}>${l}</option>`).join('')}</select><select id="sort" aria-label="Urutkan">${[['kuat', 'Petunjuk terkuat'], ['nama', 'Nama situs'], ['pengikut', 'Pengikut terbanyak'], ['lama', 'Akun tertua'], ['aktif', 'Terakhir aktif']].map(([v, l]) => `<option value="${v}" ${v === S.sort ? 'selected' : ''}>${l}</option>`).join('')}</select><span class="sp"></span><span class="seg"><button data-view="card" aria-pressed="${S.view === 'card'}">Kartu</button><button data-view="table" aria-pressed="${S.view === 'table'}">Tabel</button></span></div>${exp()}` : ''}
  ${L.length ? (S.view === 'table' ? `<div class="card tw"><table><thead><tr><th>Situs</th><th>Nama</th><th>Username</th><th>Lokasi</th><th>Bergabung</th><th>Pengikut</th><th>Petunjuk</th></tr></thead><tbody>${L.map((a) => `<tr><td><a href="${safe(a.page)}" target="_blank" rel="noopener noreferrer">${esc(a.site)}</a></td><td>${esc(a.name)}</td><td>${esc(a.handle)}</td><td>${esc(a.loc)}</td><td>${fmtDate(a.joined)}</td><td>${num(a.fields?.Pengikut ?? '')}</td><td>${esc(a.ev.join('; '))}</td></tr>`).join('')}</tbody></table></div>` : `<div class="grid">${L.map((a) => `<article class="card acc"><header>${ava(a)}<div class="who"><small>${esc(a.site)}</small><strong>${esc(a.name || a.handle)}</strong><em>@${esc(a.handle || r.q)}</em></div>${a.verified ? '<span class="tag ok">Terverifikasi</span>' : ''}${a.priv ? '<span class="tag">Privat</span>' : ''}</header>${a.bio ? `<p>${esc(a.bio)}</p>` : ''}${kv([['Lokasi', a.loc], ['Bergabung', fmtDate(a.joined)], ['Terakhir aktif', fmtDate(a.seen)], ...Object.entries(a.fields || {}).map(([k, v]) => [k, num(v)])])}<footer>${a.ev.slice(0, 2).map((e) => `<span class="tag ok">${esc(e)}</span>`).join('')}<a class="btn s noprint" style="margin-left:auto" href="${safe(a.page)}" target="_blank" rel="noopener noreferrer">Buka ${IC.out}</a></footer></article>`).join('')}</div>`) : `<p class="empty">${acc.length ? 'Tidak ada hasil yang cocok dengan saringan.' : r.busy ? 'Belum ada temuan.' : 'Tidak ada profil publik dengan username ini.'}</p>`}
  <details><summary>Periksa manual di situs lain (${manual.length + blk.length})</summary><p class="note">Situs ini menolak pemeriksaan otomatis, jadi dibuka langsung.</p><div class="wrap">${[...manual, ...blk.map((s) => [s.name, s.url])].map(([n, u]) => `<a class="chip" href="${safe(u)}" target="_blank" rel="noopener noreferrer"><span>${esc(n)}</span>${IC.out}</a>`).join('')}</div></details>
  <details><summary>Coba variasi username</summary>${chips(variants(r.q).map((v) => ['user', v]))}</details>
  <details><summary>Situs tanpa hasil (${r.src.filter((s) => r.by[s.id]?.state === 'none').length})</summary><div class="wrap">${r.src.filter((s) => r.by[s.id]?.state === 'none').map((s) => `<span class="tag">${esc(s.name)}</span>`).join('')}</div></details>`;
  o.querySelectorAll('details').forEach((d, i) => { d.open = !!opened[i]; });
  wire(o);
  const f = $('#flt'); if (f) { f.oninput = () => { S.filter = f.value; paint(); }; if (foc >= 0) { f.focus(); f.setSelectionRange(foc, foc); } $('#cat').onchange = (e) => { S.cat = e.target.value; paint(); }; $('#only').onchange = (e) => { S.only = e.target.value; paint(); }; $('#sort').onchange = (e) => { S.sort = e.target.value; paint(); }; }
  o.querySelectorAll('[data-view]').forEach((b) => b.onclick = () => { S.view = prefs.view = b.dataset.view; save('fingerprint.prefs', prefs); paint(); });
}

const SAMSAT = { 'Jawa Barat': ['Bapenda Jawa Barat', 'https://bapenda.jabarprov.go.id/infopkb/'], 'Jawa Timur': ['Bapenda Jawa Timur', 'https://bapenda.jatimprov.go.id/info/'], 'Jawa Tengah': ['Bapenda Jawa Tengah', 'https://bapenda.jatengprov.go.id'], Banten: ['Bapenda Banten', 'https://bapenda.bantenprov.go.id'], Bali: ['Bapenda Bali', 'https://bapenda.baliprov.go.id'], 'DI Yogyakarta': ['Samsat Sleman', 'https://samsatsleman.jogjaprov.go.id'] };
const VIEW = {
  email(r) {
    const [u] = r.q.split('@'), g = r.gravatar, b = r.breaches;
    return exp(false) + `<div class="two"><div class="stack">${card('Alamat', kv([['Email', r.q], ['Domain', r.dom], ['Bisa menerima email', r.mx === null ? 'Tidak bisa diperiksa' : r.mx.length ? 'Ya, server email ada' : 'Tidak, domain tanpa server email'], ['Server email', (r.mx || []).slice(0, 2).map((m) => m.replace(/^\d+ /, '').replace(/\.$/, '')).join(', ')], ['SPF', r.spf ? 'Ada' : 'Tidak ada'], ['DMARC', r.dmarc ? 'Ada' : 'Tidak ada']], 1))}
    ${g ? `<section class="card acc"><header>${ava({ ...g, site: 'Gravatar' })}<div class="who"><small>Gravatar</small><strong>${esc(g.name || g.handle)}</strong><em>@${esc(g.handle)}</em></div></header>${g.bio ? `<p>${esc(g.bio)}</p>` : ''}${kv([['Lokasi', g.loc], ...Object.entries(g.fields || {})])}<div class="wrap">${(g.links || []).map((l) => `<a class="chip" href="${safe(l)}" target="_blank" rel="noopener noreferrer"><span>${esc(host(l))}</span></a>`).join('')}</div></section>` : card('Profil publik', '<p class="empty" style="padding:0">Tidak ada profil Gravatar publik untuk email ini.</p>')}
    ${b ? card('Kebocoran data', b.error ? `<p class="note err">${esc(b.error)}</p>` : b.list.length ? `<p class="note warn">Email ini ada di ${b.list.length} kebocoran. Ganti kata sandi di layanan tersebut dan aktifkan verifikasi dua langkah.</p><div class="tw" style="padding:0"><table><thead><tr><th>Layanan</th><th>Tahun</th><th>Data yang bocor</th></tr></thead><tbody>${b.list.map((x) => `<tr><td><b>${esc(x.name)}</b></td><td>${esc(x.year)}</td><td>${esc(x.data.join(', '))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="note ok">Tidak ada di daftar kebocoran yang diketahui.</p>') : card('Kebocoran data', '<p class="empty" style="padding:0">Centang "Ini email saya" lalu cari lagi untuk memeriksa.</p>')}</div>
    <div class="stack noprint">${card('Lanjutkan', chips([['user', u.replace(/\+.*/, ''), `@${u.replace(/\+.*/, '')}`], ['domain', r.dom]]))}${card('Periksa di layanan lain', links([['Have I Been Pwned', 'https://haveibeenpwned.com', 'Pemeriksaan kebocoran kedua, isi email Anda sendiri'], ['Periksa Data', 'https://periksadata.com', 'Pemeriksaan kebocoran dari Indonesia'], ['Google', `https://www.google.com/search?q=${enc(`"${r.q}"`)}`, 'Halaman publik yang memuat email ini']]))}</div></div>`;
  },
  phone(r) {
    const n = r.e164.slice(1), local = r.e164.startsWith('+62') ? '0' + r.e164.slice(3) : r.e164;
    return exp(false) + `<div class="two"><div class="stack">${card('Nomor', `${r.valid ? '' : '<p class="note warn">Nomor ini tidak sah menurut aturan penomoran negaranya.</p>'}${kv(r.rows, 1)}<div class="wrap noprint" style="margin-top:12px"><button class="btn s" data-copy="${esc(r.e164)}">${IC.copy}Salin +62</button><button class="btn s" data-copy="${esc(local)}">${IC.copy}Salin ${esc(local.slice(0, 2))}…</button></div>`)}
    ${card('Nama pemilik', '<p style="margin:0">Nama pemilik nomor tidak ada di sumber publik. Data registrasi hanya dipegang operator dan Dukcapil. GetContact menampilkan label dari buku telepon penggunanya dan hanya bisa dibuka lewat akun Anda sendiri di sana.</p>')}</div>
    <div class="stack noprint">${card('Cek penipuan', links([['Aduan Nomor, Komdigi', 'https://aduannomor.id', 'Cek dan laporkan nomor penipu atau spam'], ['Cek Rekening, Komdigi', 'https://cekrekening.id', 'Riwayat laporan rekening, e-wallet, dan nomor'], ['Pusat Anti-Scam OJK', 'https://iasc.ojk.go.id', 'Lapor penipuan agar rekening cepat diblokir'], ['Kredibel', 'https://www.kredibel.com', 'Laporan pengguna tentang nomor dan rekening']]))}${card('Buka di aplikasi', links([['GetContact', 'https://getcontact.com', 'Masuk dengan akun Anda, lalu tempel nomor'], ['WhatsApp', `https://wa.me/${n}`, 'Profil yang dibuka pemilik untuk umum'], ['Telegram', `https://t.me/+${n}`, 'Bila pemilik mengizinkan ditemukan lewat nomor'], ['Google', `https://www.google.com/search?q=${enc(`"${local}" OR "${r.e164}"`)}`, 'Iklan, toko, atau halaman yang memuat nomor ini']]))}</div></div>`;
  },
  name(r) {
    const q = enc(`"${r.q}"`);
    return exp(false) + `<div class="two"><div class="stack">${r.people.length ? r.people.map((p) => `<section class="card acc"><header>${ava({ site: p.name, avatar: p.img })}<div class="who"><small>Wikidata</small><strong>${esc(p.name)}</strong><em>${esc(p.desc)}</em></div></header>${kv([['Lahir', p.born], ...p.ids])}<footer><a class="btn s noprint" href="${safe(p.url)}" target="_blank" rel="noopener noreferrer">Buka ${IC.out}</a></footer></section>`).join('') : card('Tokoh publik', '<p class="empty" style="padding:0">Tidak ada tokoh publik dengan nama ini di Wikidata.</p>')}</div>
    <div class="stack noprint">${card('Cari nama ini', links([['Google', `https://www.google.com/search?q=${q}`, 'Nama persis'], ['LinkedIn', `https://www.google.com/search?q=${q}+site:linkedin.com/in`, 'Profil pekerjaan'], ['Instagram', `https://www.google.com/search?q=${q}+site:instagram.com`, 'Profil yang terindeks'], ['Facebook', `https://www.google.com/search?q=${q}+site:facebook.com`, 'Profil yang terindeks'], ['Google Scholar', `https://scholar.google.com/citations?view_op=search_authors&mauthors=${enc(r.q)}`, 'Peneliti dan karya ilmiah'], ['ORCID', `https://orcid.org/orcid-search/search?searchQuery=${enc(r.q)}`, 'Identitas peneliti'], ['AHU Online', 'https://ahu.go.id', 'Pencarian badan usaha resmi']]))}${card('Kemungkinan username', chips([...new Set([r.q.toLowerCase().replace(/[^a-z\d]/g, ''), r.q.toLowerCase().trim().replace(/[^a-z\d]+/g, '.'), r.q.toLowerCase().trim().replace(/[^a-z\d]+/g, '_')])].filter((x) => x.length > 2).map((x) => ['user', x])))}</div></div>`;
  },
  doc(r) {
    const t = { nik: 'KTP (NIK)', kk: 'Kartu Keluarga', sim: 'SIM', npwp: 'NPWP' }[r.kind];
    return `<div class="two"><div class="stack">${card(`${t}: susunan sah`, `${parts(r.dec.parts)}${warns(r.dec.warn)}${kv(r.dec.rows, 1)}`)}<p class="note">Susunan yang sah tidak berarti nomornya terdaftar. Nama, alamat, dan foto hanya ada di data resmi dan tidak bisa dibuka dari sini.</p></div>
    <div class="stack noprint">${card('Verifikasi resmi', links(r.kind === 'sim' ? [['Digital Korlantas', 'https://digitalkorlantas.polri.go.id', 'SIM Anda sendiri, lewat aplikasi resmi Polri']] : r.kind === 'npwp' ? [['Coretax DJP', 'https://coretaxdjp.pajak.go.id', 'Layanan wajib pajak resmi']] : [['Dukcapil Kemendagri', 'https://dukcapil.kemendagri.go.id', 'Layanan data kependudukan dan aplikasi IKD']]))}${card('Untuk usaha', '<p style="margin:0">Bila perlu mencocokkan KTP pelanggan, pakai layanan e-KYC yang punya kerja sama resmi dengan Dukcapil dan minta persetujuan pemiliknya.</p>')}</div></div>`;
  },
  plate(r) {
    const d = r.dec, pv = d.provs || [];
    return exp(false) + `<div class="two"><div class="stack"><section class="card"><div class="tnkb">${esc(d.x.text)}</div>${warns(d.warn)}${kv(d.rows, 1)}</section><p class="note">Nama dan alamat pemilik tidak dibuka untuk umum. Pemilik kendaraan bisa dilacak resmi lewat Samsat atau laporan polisi.</p></div>
    <div class="stack noprint">${card('Cek pajak dan data kendaraan', links([...pv.filter((p) => SAMSAT[p]).map((p) => [SAMSAT[p][0], SAMSAT[p][1], 'Merek, tipe, tahun, dan pajak dari situs provinsi']), ['SIGNAL, Samsat Digital Nasional', 'https://samsatdigital.id', 'Aplikasi resmi untuk kendaraan atas nama Anda'], ['Situs Samsat provinsi lain', `https://www.google.com/search?q=${enc(`cek pajak kendaraan ${pv[0] || ''} site:go.id`)}`, 'Dibatasi ke situs pemerintah']]))}${card('Perlu pemiliknya?', '<p style="margin:0">Untuk kecelakaan atau tabrak lari, buat laporan di kantor polisi terdekat atau 110. Untuk jual beli, minta STNK dan BPKB asli, lalu cek fisik di Samsat.</p>')}</div></div>`;
  },
  domain(r) {
    const d = r.rd || {}, g = r.geo?.success ? r.geo : null, age = d.created ? Math.floor((Date.now() - new Date(d.created)) / 864e5) : null;
    return exp(false) + `<div class="two"><div class="stack">${card('Pendaftaran', `${age !== null && age < 180 && !r.ip ? `<p class="note warn">Domain baru berumur ${age} hari. Situs penipuan sering memakai domain baru.</p>` : ''}${d.error ? `<p class="note">${esc(d.error)}</p>` : d.none ? '<p class="note">Tidak terdaftar.</p>' : kv([['Nama', d.name || r.host], ['Pendaftar usaha', d.org], ['Registrar', d.registrar], ['Didaftarkan', fmtDate(d.created)], ['Umur', age !== null && !r.ip ? `${Math.floor(age / 365)} tahun ${age % 365} hari` : ''], ['Berakhir', fmtDate(d.expires)], ['Diubah', fmtDate(d.changed)], ['Rentang IP', d.range], ['Negara', d.country], ['Status', (d.status || []).join(', ')]], 1)}`)}${r.ip ? '' : card('DNS', kv([['Alamat IP', r.a.join(', ')], ['Server nama', r.ns.join(', ')], ['Server email', r.mx.join(', ')], ['SPF', r.txt.some((t) => /v=spf1/i.test(t)) ? 'Ada' : 'Tidak ada']], 1))}</div>
    <div class="stack">${g ? card('Server', kv([['IP', g.ip], ['Negara', g.country], ['Kota', g.city], ['Penyedia', g.connection?.isp || g.connection?.org], ['ASN', g.connection?.asn ? `AS${g.connection.asn}` : '']], 1)) : ''}<div class="noprint">${card('Periksa keamanan', links([['Google Safe Browsing', `https://transparencyreport.google.com/safe-browsing/search?url=${enc(r.host)}`, 'Status situs berbahaya'], ['VirusTotal', `https://www.virustotal.com/gui/${r.ip ? 'ip-address' : 'domain'}/${enc(r.host)}`, 'Hasil puluhan pemindai'], ['Wayback Machine', `https://web.archive.org/web/*/${enc(r.host)}`, 'Tampilan situs di masa lalu']]))}</div></div></div>`;
  },
  device(r) {
    return `<div class="two"><div class="stack">${card(r.kind === 'imei' ? 'IMEI' : 'Nomor rangka (VIN)', `${parts(r.dec.parts)}${warns(r.dec.warn)}${kv(r.dec.rows, 1)}`)}</div><div class="stack noprint">${card('Verifikasi resmi', links(r.kind === 'imei' ? [['Bea Cukai', 'https://www.beacukai.go.id', 'Status pendaftaran IMEI perangkat dari luar negeri'], ['IMEI.info', 'https://www.imei.info', 'Nama model dari kode TAC']] : [['SIGNAL, Samsat Digital Nasional', 'https://samsatdigital.id', 'Kendaraan atas nama Anda'], ['NHTSA', `https://www.nhtsa.gov/recalls?vin=${enc(r.dec.s)}`, 'Penarikan kendaraan pasar Amerika']]))}</div></div>`;
  },
};

// ---------- export
function rowsOf(r) {
  if (r.type === 'user') return shown(r).map((a) => ({ situs: a.site, nama: a.name || '', username: a.handle || '', tautan: a.page, lokasi: a.loc || '', bergabung: a.joined || '', terakhir_aktif: a.seen || '', bio: a.bio || '', petunjuk: a.ev.join('; '), rincian: Object.entries(a.fields || {}).map(([k, v]) => `${k}: ${v}`).join('; ') }));
  return [...document.querySelectorAll('#out dl.kv')].flatMap((dl) => [...dl.querySelectorAll('dt')].map((dt) => ({ bagian: dl.closest('section')?.querySelector('h2,small')?.textContent || '', data: dt.textContent, isi: dt.nextElementSibling.textContent })));
}
function exportAs(kind) {
  const r = S.r; if (kind === 'pdf') { const t = document.title; document.title = `fingerprint-${r.type}-${r.q}`.replace(/[^\w.-]/g, '_'); print(); document.title = t; return; }
  const rows = rowsOf(r), keys = Object.keys(rows[0] || { kosong: '' }), name = `fingerprint-${r.type}-${r.q}`.replace(/[^\w.-]/g, '_');
  const cell = (v) => { let s = String(v ?? ''); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  const body = kind === 'json' ? JSON.stringify({ jenis: TYPES[r.type][0], dicari: r.q, waktu: r.at.toISOString(), hasil: rows }, null, 2)
    : kind === 'csv' ? '﻿' + [keys.join(','), ...rows.map((x) => keys.map((k) => cell(x[k])).join(','))].join('\r\n')
    : `Amatu Fingerprint\n${TYPES[r.type][0]}: ${r.q}\n${r.at.toLocaleString('id-ID')}\n\n` + rows.map((x) => r.type === 'user' ? Object.entries(x).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n') + '\n' : `${x.data}: ${x.isi}`).join('\n');
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([body], { type: kind === 'json' ? 'application/json' : kind === 'csv' ? 'text/csv' : 'text/plain' })); a.download = `${name}.${kind}`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- other pages
function riwayat() {
  $('#main').innerHTML = `<div class="in"><h1>Riwayat</h1><p class="lead">Hanya untuk akun Anda. Nomor KTP, KK, SIM, NPWP, IMEI, dan rangka tidak pernah dicatat.</p><div class="bar"><label class="opts" style="margin:0"><input type="checkbox" id="hon" ${prefs.hist ? 'checked' : ''}> Catat riwayat</label><span class="sp"></span>${hist.length ? '<button class="btn s" id="hclr">Hapus semua</button>' : ''}</div><div class="card">${hist.length ? `<ul class="hist">${hist.map((h, i) => `<li><span class="tag">${esc(TYPES[h.type]?.[0] || h.type)}</span><button class="q" data-i="${i}">${esc(h.q)}</button><small>${h.n != null ? `${h.n} hasil, ` : ''}${fmtDate(h.t)}</small><button class="x" data-x="${i}" aria-label="Hapus ${esc(h.q)}">${IC.x}</button></li>`).join('')}</ul>` : '<p class="empty" style="padding:6px 0">Belum ada pencarian.</p>'}</div></div>`;
  $('#hon').onchange = (e) => { prefs.hist = e.target.checked; save('fingerprint.prefs', prefs); };
  if ($('#hclr')) $('#hclr').onclick = () => { hist = []; save('fingerprint.hist', hist); riwayat(); toast('Riwayat dihapus'); };
  document.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => start(hist[b.dataset.i].type, hist[b.dataset.i].q));
  document.querySelectorAll('[data-x]').forEach((b) => b.onclick = () => { hist.splice(+b.dataset.x, 1); save('fingerprint.hist', hist); riwayat(); });
}
function privasi() {
  $('#main').innerHTML = `<div class="in"><h1>Hapus diri dari hasil</h1><p class="lead">Masukkan username atau email Anda. Setelah itu pencariannya ditolak untuk semua pengguna. Yang disimpan hanya sidik SHA-256, bukan teks aslinya.</p><form class="sform" id="oo"><div class="box"><input id="oq" aria-label="Username atau email" placeholder="username atau email" maxlength="160" autocapitalize="off" spellcheck="false"></div><button class="btn">Hapus</button></form><div id="om" style="margin-top:14px;max-width:820px"></div></div>`;
  $('#oo').onsubmit = async (e) => {
    e.preventDefault(); const v = $('#oq').value.trim().replace(/^@/, '').toLowerCase(); if (!v) return;
    const kind = v.includes('@') ? 'email' : 'user'; $('#om').innerHTML = '';
    try {
      const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${kind}:${v}`)))].map((x) => x.toString(16).padStart(2, '0')).join('');
      const r = await fetch(`${SB}/rest/v1/rpc/fp_optout`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: token(), p_hash: h }) }), j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Gagal menyimpan.');
      $('#om').innerHTML = `<p class="note ok">${esc(v)} tidak akan ditampilkan lagi.</p>`; $('#oq').value = '';
    } catch (x) { $('#om').innerHTML = `<p class="note err">${esc(x.message)}</p>`; }
  };
}
function sumber() {
  $('#main').innerHTML = `<div class="in prose"><h1>Sumber dan batas</h1><p class="lead">Semua hasil berasal dari halaman publik, API resmi, atau pembacaan nomor di perangkat Anda.</p><div class="stack">
  ${card('Yang diperiksa', '<ul><li>Username: 47 situs yang profilnya dibuka untuk umum.</li><li>Email: Gravatar, catatan DNS, dan XposedOrNot untuk email Anda sendiri.</li><li>Nomor HP: libphonenumber dan alokasi awalan operator Indonesia.</li><li>NIK dan KK: kode wilayah Kepmendagri 300.2.2-2138 Tahun 2025 (cahyadsn/wilayah, MIT).</li><li>Plat: Wikipedia Indonesia, "Tanda Nomor Kendaraan Bermotor Indonesia" (CC BY-SA 4.0).</li><li>Domain dan IP: RDAP, Google Public DNS, ipwho.is. Nomor rangka: NHTSA vPIC. Nama: Wikidata.</li></ul>')}
  ${card('Yang tidak dibuka', '<ul><li>Data Dukcapil, foto KTP, data SIM, dan nama pemilik kendaraan.</li><li>Label GetContact dan data registrasi kartu SIM.</li><li>Isi basis data bocor, kata sandi, atau pemeriksaan lewat halaman lupa kata sandi.</li></ul><p>Membuka data pribadi orang lain tanpa dasar hukum dapat dipidana menurut UU 27/2022 tentang Pelindungan Data Pribadi.</p>')}
  ${card('Cara membaca hasil', '<p>Username yang sama di dua situs belum tentu satu orang. Tanda hijau muncul bila nama tampilan sama atau profil saling menautkan. Bandingkan foto, tautan, dan waktu sebelum menyimpulkan.</p>')}</div></div>`;
}
window.FP = { S, evaluate, variants };
addEventListener('hashchange', route); route();
})();
