// amatu-fingerprint — checks PUBLIC profile pages and public APIs for the page amatu-id.github.io/fingerprint.
//   POST {a:'user', q}             → NDJSON stream, one line per source, public profile fields only
//   POST {a:'email', q, own:true}  → Gravatar profile + known breaches (breaches only for one's own address)
//   POST {a:'rdap', q}             → registration data of a domain or IP
// Header x-amatu = portal session token. fp_use() checks the session, the daily limit and the opt-out list.
// Not here on purpose: login / password-reset probing, leaked databases, civil registry or vehicle-owner data.
// Sources that answer with a bot check are reported as "blocked" and never worked around.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-amatu',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const SB = Deno.env.get('SUPABASE_URL') || '', ANON = Deno.env.get('SUPABASE_ANON_KEY') || '';
const OPEN = Deno.env.get('AMATU_FP_OPEN') === '1'; // local test copy only
const UA = 'Mozilla/5.0 (compatible; AmatuFingerprint/1.0)';
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const enc = encodeURIComponent;
// deno-lint-ignore no-explicit-any
type J = any;
type Hit = { name?: string; handle?: string; bio?: string; avatar?: string; url?: string; loc?: string; joined?: string; seen?: string; verified?: boolean; priv?: boolean; fields?: Record<string, string | number>; links?: string[] };
type Res = { state: 'found' | 'none' | 'blocked' | 'error'; hit?: Hit };
type Src = { id: string; name: string; cat: string; url: (u: string) => string; ok?: RegExp; run: (u: string) => Promise<Res> };

const NONE: Res = { state: 'none' };
const found = (hit: Hit): Res => ({ state: 'found', hit });
async function get(url: string, init: RequestInit = {}) {
  return await fetch(url, { ...init, headers: { 'User-Agent': UA, 'Accept-Language': 'id,en;q=0.8', ...(init.headers || {}) }, signal: AbortSignal.timeout(9000) });
}
// deno-lint-ignore no-explicit-any
async function api(url: string, map: (j: any) => Hit | null, init: RequestInit = {}, none: number[] = [404, 410]): Promise<Res> {
  const r = await get(url, init);
  if (none.includes(r.status)) { await r.body?.cancel(); return NONE; }
  if (!r.ok) { await r.body?.cancel(); return { state: [401, 403, 429, 503].includes(r.status) ? 'blocked' : 'error' }; }
  const j = await r.json().catch(() => null);
  if (j === null) return { state: 'blocked' };
  const h = map(j);
  return h ? found(h) : NONE;
}
const ent = (s: string) => s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const strip = (s: string) => ent(String(s || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
const cut = (s: string | undefined, n = 400) => { const t = strip(s || ''); return t.length > n ? t.slice(0, n - 1) + '…' : t; };
const day = (v: J) => { if (!v) return ''; const d = new Date(typeof v === 'number' ? (v < 1e12 ? v * 1000 : v) : v); return isNaN(+d) ? '' : d.toISOString().slice(0, 10); };
const og = (html: string, key: string) => {
  for (const [tag] of html.matchAll(/<meta\b(?:"[^"]*"|'[^']*'|[^>"'])*>/gi)) {
    const at = (n: string) => { const m = tag.match(new RegExp(`\\s${n}=(?:"([^"]*)"|'([^']*)')`, 'i')); return m ? m[1] ?? m[2] ?? '' : ''; };
    if ((at('property') || at('name')).toLowerCase() === key) return ent(at('content')).trim();
  }
  return '';
};
const CHALLENGE = /just a moment|checking your browser|client challenge|attention required|recaptcha\/challengepage|are you a robot/i;
// Public profile page: 404 = no account, 2xx that mentions the handle = account. Anything else = cannot tell.
async function page(url: string, map: (h: string) => Hit | null | 'blocked'): Promise<Res> {
  const r = await get(url);
  if (r.status === 404 || r.status === 410) { await r.body?.cancel(); return NONE; }
  const t = (await r.text()).slice(0, 2_500_000);
  if (!r.ok || CHALLENGE.test(t.slice(0, 4000))) return { state: 'blocked' };
  const h = map(t);
  return h === 'blocked' ? { state: 'blocked' } : h ? found(h) : NONE;
}
const simple = (u: string, trim?: RegExp) => (t: string): Hit | null => {
  const raw = og(t, 'og:title') || strip((t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  if (!raw || /not found|404|no such user/i.test(raw)) return null;
  return { name: cut(trim ? raw.replace(trim, '') : raw, 90), handle: u, bio: cut(og(t, 'og:description'), 300), avatar: og(t, 'og:image') };
};

const SOURCES: Src[] = [
  { id: 'github', name: 'GitHub', cat: 'Developer', url: (u) => `https://github.com/${u}`, ok: /^[a-z\d-]{1,39}$/i, run: (u) => api(`https://api.github.com/users/${enc(u)}`, (j) => ({ name: j.name || j.login, handle: j.login, bio: j.bio, avatar: j.avatar_url, loc: j.location, joined: day(j.created_at), seen: day(j.updated_at), links: [j.blog, j.twitter_username && `https://x.com/${j.twitter_username}`].filter(Boolean), fields: { Pengikut: j.followers, Mengikuti: j.following, Repositori: j.public_repos, Gist: j.public_gists, Perusahaan: j.company, Jenis: j.type } })) },
  { id: 'gitlab', name: 'GitLab', cat: 'Developer', url: (u) => `https://gitlab.com/${u}`, run: (u) => api(`https://gitlab.com/api/v4/users?username=${enc(u)}`, (j) => j[0] ? { name: j[0].name, handle: j[0].username, avatar: j[0].avatar_url, url: j[0].web_url, fields: { Status: j[0].state } } : null) },
  { id: 'codeberg', name: 'Codeberg', cat: 'Developer', url: (u) => `https://codeberg.org/${u}`, run: (u) => api(`https://codeberg.org/api/v1/users/${enc(u)}`, (j) => ({ name: j.full_name || j.login, handle: j.login, bio: cut(j.description), avatar: j.avatar_url, loc: j.location, joined: day(j.created), links: [j.website].filter(Boolean), fields: { Pengikut: j.followers_count, Mengikuti: j.following_count } })) },
  { id: 'bitbucket', name: 'Bitbucket', cat: 'Developer', url: (u) => `https://bitbucket.org/${u}/`, run: (u) => api(`https://api.bitbucket.org/2.0/workspaces/${enc(u)}`, (j) => ({ name: j.name, handle: j.slug, joined: day(j.created_on), avatar: j.links?.avatar?.href })) },
  { id: 'dockerhub', name: 'Docker Hub', cat: 'Developer', url: (u) => `https://hub.docker.com/u/${u}`, run: (u) => api(`https://hub.docker.com/v2/users/${enc(u)}/`, (j) => ({ name: j.full_name || j.username || j.orgname, handle: j.username || j.orgname, loc: j.location, joined: day(j.date_joined), avatar: j.gravatar_url, fields: { Perusahaan: j.company } })) },
  { id: 'npm', name: 'npm', cat: 'Developer', url: (u) => `https://www.npmjs.com/~${u}`, run: (u) => api(`https://registry.npmjs.org/-/v1/search?text=maintainer:${enc(u)}&size=5`, (j) => j.total ? { name: u, handle: u, fields: { Paket: j.total, Contoh: j.objects.map((o: J) => o.package.name).slice(0, 4).join(', ') } } : null) },
  { id: 'huggingface', name: 'Hugging Face', cat: 'Developer', url: (u) => `https://huggingface.co/${u}`, run: (u) => api(`https://huggingface.co/api/users/${enc(u)}/overview`, (j) => ({ name: j.fullname || j.user, handle: j.user, bio: cut(j.details), avatar: j.avatarUrl, joined: day(j.createdAt), fields: { Pengikut: j.numFollowers, Model: j.numModels, Dataset: j.numDatasets } })) },
  { id: 'devto', name: 'DEV Community', cat: 'Developer', url: (u) => `https://dev.to/${u}`, run: (u) => api(`https://dev.to/api/users/by_username?url=${enc(u)}`, (j) => ({ name: j.name, handle: j.username, bio: cut(j.summary), avatar: j.profile_image, loc: j.location, joined: day(j.joined_at), links: [j.website_url, j.github_username && `https://github.com/${j.github_username}`, j.twitter_username && `https://x.com/${j.twitter_username}`].filter(Boolean) })) },
  { id: 'codeforces', name: 'Codeforces', cat: 'Developer', url: (u) => `https://codeforces.com/profile/${u}`, run: (u) => api(`https://codeforces.com/api/user.info?handles=${enc(u)}`, (j) => { const x = j.result?.[0]; return x ? { name: [x.firstName, x.lastName].filter(Boolean).join(' ') || x.handle, handle: x.handle, avatar: x.titlePhoto, loc: [x.city, x.country].filter(Boolean).join(', '), joined: day(x.registrationTimeSeconds), seen: day(x.lastOnlineTimeSeconds), fields: { Peringkat: x.rank, Rating: x.rating, Organisasi: x.organization } } : null; }, {}, [400, 404]) },
  { id: 'hackerone', name: 'HackerOne', cat: 'Developer', url: (u) => `https://hackerone.com/${u}`, run: (u) => page(`https://hackerone.com/${enc(u)}`, simple(u, /\s*[|-]\s*HackerOne.*$/)) },
  { id: 'hackernews', name: 'Hacker News', cat: 'Forum', url: (u) => `https://news.ycombinator.com/user?id=${u}`, run: (u) => api(`https://hacker-news.firebaseio.com/v0/user/${enc(u)}.json`, (j) => j ? { name: j.id, handle: j.id, bio: cut(j.about), joined: day(j.created), fields: { Karma: j.karma, Kiriman: j.submitted?.length } } : null) .then((r) => r.state === 'blocked' ? NONE : r) },
  { id: 'keybase', name: 'Keybase', cat: 'Developer', url: (u) => `https://keybase.io/${u}`, run: (u) => api(`https://keybase.io/_/api/1.0/user/lookup.json?username=${enc(u)}`, (j) => { const x = j.them; return x ? { name: x.profile?.full_name || x.basics.username, handle: x.basics.username, bio: cut(x.profile?.bio), loc: x.profile?.location, avatar: x.pictures?.primary?.url, joined: day(x.basics.ctime), links: (x.proofs_summary?.all || []).map((p: J) => p.service_url).filter(Boolean).slice(0, 8) } : null; }) },
  { id: 'x', name: 'X (Twitter)', cat: 'Media sosial', url: (u) => `https://x.com/${u}`, ok: /^\w{1,15}$/, run: (u) => page(`https://x.com/${enc(u)}`, (t) => { const h = og(t, 'og:title'); const m = h.match(/^(.*) \(@(\w+)\)/); return m ? { name: m[1], handle: m[2], bio: cut(og(t, 'og:description')), avatar: og(t, 'og:image') } : 'blocked'; }) },
  { id: 'bluesky', name: 'Bluesky', cat: 'Media sosial', url: (u) => `https://bsky.app/profile/${u.includes('.') ? u : u + '.bsky.social'}`, run: (u) => { const h = u.includes('.') ? u : `${u}.bsky.social`; return api(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${enc(h)}`, (j) => ({ name: j.displayName || j.handle, handle: j.handle, bio: cut(j.description), avatar: j.avatar, joined: day(j.createdAt), fields: { Pengikut: j.followersCount, Mengikuti: j.followsCount, Kiriman: j.postsCount } }), {}, [400, 404]); } },
  { id: 'mastodon', name: 'Mastodon', cat: 'Media sosial', url: (u) => `https://mastodon.social/@${u}`, ok: /^\w{1,30}$/, run: (u) => api(`https://mastodon.social/api/v1/accounts/lookup?acct=${enc(u)}`, (j) => ({ name: j.display_name || j.username, handle: j.acct, bio: cut(j.note), avatar: j.avatar_static, joined: day(j.created_at), seen: day(j.last_status_at), priv: j.locked, links: (j.fields || []).map((f: J) => strip(f.value)).filter((v: string) => /^https?:/.test(v)), fields: { Pengikut: j.followers_count, Mengikuti: j.following_count, Kiriman: j.statuses_count } })) },
  { id: 'telegram', name: 'Telegram', cat: 'Media sosial', url: (u) => `https://t.me/${u}`, ok: /^[a-z]\w{3,31}$/i, run: (u) => page(`https://t.me/${enc(u)}`, (t) => { const m = t.match(/tgme_page_title[^>]*>([\s\S]*?)<\/div>/); if (!m) return null; const x = strip((t.match(/tgme_page_extra[^>]*>([\s\S]*?)<\/div>/) || [])[1]); return { name: strip(m[1]), handle: u, bio: cut((t.match(/tgme_page_description[^>]*>([\s\S]*?)<\/div>/) || [])[1]), avatar: og(t, 'og:image'), fields: { Keterangan: x.startsWith('@') ? '' : x } }; }) },
  { id: 'tiktok', name: 'TikTok', cat: 'Media sosial', url: (u) => `https://www.tiktok.com/@${u}`, ok: /^[\w.]{2,24}$/, run: (u) => api(`https://www.tiktok.com/oembed?url=${enc(`https://www.tiktok.com/@${u}`)}`, (j) => j.author_name || j.title ? { name: j.author_name || u, handle: u } : null, {}, [400, 404]) },
  { id: 'youtube', name: 'YouTube', cat: 'Video', url: (u) => `https://www.youtube.com/@${u}`, ok: /^[\w.-]{3,30}$/, run: (u) => page(`https://www.youtube.com/@${enc(u)}`, (t) => /consent\.youtube/.test(t.slice(0, 3000)) ? 'blocked' : simple(u, /\s*-\s*YouTube$/)(t)) },
  { id: 'twitch', name: 'Twitch', cat: 'Video', url: (u) => `https://www.twitch.tv/${u}`, ok: /^\w{3,25}$/, run: (u) => page(`https://www.twitch.tv/${enc(u)}`, (t) => { const h = og(t, 'og:title'); return h && h !== 'Twitch' ? { name: h.replace(/\s*-\s*Twitch$/, ''), handle: u, bio: cut(og(t, 'og:description')), avatar: og(t, 'og:image') } : null; }) },
  { id: 'vimeo', name: 'Vimeo', cat: 'Video', url: (u) => `https://vimeo.com/${u}`, run: (u) => api(`https://vimeo.com/api/v2/${enc(u)}/info.json`, (j) => j.display_name ? { name: j.display_name, handle: u, bio: cut(j.bio), avatar: j.portrait_medium, loc: j.location, joined: day(j.created_on), url: j.profile_url, fields: { Video: j.total_videos_uploaded, Suka: j.total_videos_liked } } : null) },
  { id: 'snapchat', name: 'Snapchat', cat: 'Media sosial', url: (u) => `https://www.snapchat.com/add/${u}`, ok: /^[a-z][\w.-]{2,14}$/i, run: (u) => page(`https://www.snapchat.com/add/${enc(u)}`, simple(u, /\s+(di|on) Snapchat.*$/)) },
  { id: 'pinterest', name: 'Pinterest', cat: 'Media sosial', url: (u) => `https://www.pinterest.com/${u}/`, ok: /^\w{3,30}$/, run: (u) => page(`https://www.pinterest.com/${enc(u)}/`, (t) => { const m = strip((t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]).match(/^(.*?) \(([^)]+)\)/); return m && m[2].toLowerCase() === u.toLowerCase() ? { name: m[1], handle: m[2], bio: cut(og(t, 'og:description')), avatar: og(t, 'og:image') } : null; }) },
  { id: 'medium', name: 'Medium', cat: 'Tulisan', url: (u) => `https://medium.com/@${u}`, run: (u) => page(`https://medium.com/feed/@${enc(u)}`, (t) => { const m = t.match(/<title><!\[CDATA\[Stories by (.*?) on Medium/); return m ? { name: m[1], handle: u, avatar: (t.match(/<image>\s*<url>([^<]+)/) || [])[1], seen: day((t.match(/<pubDate>([^<]+)/) || [])[1]), fields: { Tulisan: (t.match(/<item>/g) || []).length } } : null; }) },
  { id: 'wordpress', name: 'WordPress.com', cat: 'Tulisan', url: (u) => `https://${u}.wordpress.com`, ok: /^[a-z\d-]{3,50}$/i, run: (u) => api(`https://public-api.wordpress.com/rest/v1.1/sites/${enc(u)}.wordpress.com`, (j) => j.ID ? { name: ent(j.name || u), handle: u, bio: cut(j.description), url: j.URL, avatar: j.icon?.img, fields: { Tulisan: j.post_count, Pelanggan: j.subscribers_count } } : null, {}, [403, 404]) },
  { id: 'gravatar', name: 'Gravatar', cat: 'Profil', url: (u) => `https://gravatar.com/${u}`, run: (u) => api(`https://gravatar.com/${enc(u)}.json`, gravatar) },
  { id: 'linktree', name: 'Linktree', cat: 'Profil', url: (u) => `https://linktr.ee/${u}`, run: (u) => page(`https://linktr.ee/${enc(u)}`, simple(u, /\s*\|\s*(Instagram.*|Linktree).*$/)) },
  { id: 'aboutme', name: 'about.me', cat: 'Profil', url: (u) => `https://about.me/${u}`, run: (u) => page(`https://about.me/${enc(u)}`, simple(u, /\s+on about\.me$/)) },
  { id: 'saweria', name: 'Saweria', cat: 'Indonesia', url: (u) => `https://saweria.co/${u}`, run: (u) => page(`https://saweria.co/${enc(u)}`, (t) => { const m = t.match(/__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/); if (!m) return 'blocked'; let d: J; try { d = JSON.parse(m[1]).props?.pageProps?.data; } catch { return 'blocked'; } return d?.id ? { name: d.username || u, handle: d.username || u, bio: cut(d.description), avatar: d.profile_picture, verified: d.verified, links: Object.values(d.socials || {}).filter((v) => typeof v === 'string' && /^https?:/.test(v as string)) as string[] } : null; }) },
  { id: 'trakteer', name: 'Trakteer', cat: 'Indonesia', url: (u) => `https://trakteer.id/${u}`, run: (u) => page(`https://trakteer.id/${enc(u)}`, (t) => /^Trakteer\.id$/.test(og(t, 'og:title')) ? null : simple(u, /^Halaman Kreator\s+|\s*\(@.*$/g)(t)) },
  { id: 'wattpad', name: 'Wattpad', cat: 'Tulisan', url: (u) => `https://www.wattpad.com/user/${u}`, run: (u) => api(`https://www.wattpad.com/api/v3/users/${enc(u)}`, (j) => j.username ? { name: j.name || j.username, handle: j.username, bio: cut(j.description), avatar: j.avatar, loc: j.location, joined: day(j.createDate), verified: j.verified, fields: { Pengikut: j.numFollowers, Mengikuti: j.numFollowing, Cerita: j.numStoriesPublished } } : null, {}, [400, 404]) },
  { id: 'goodreads', name: 'Goodreads', cat: 'Tulisan', url: (u) => `https://www.goodreads.com/${u}`, run: (u) => page(`https://www.goodreads.com/${enc(u)}`, (t) => { const title = strip((t.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1]); return title.toLowerCase().includes(`(${u.toLowerCase()})`) ? simple(u)(t) : null; }) },
  { id: 'steam', name: 'Steam', cat: 'Game', url: (u) => `https://steamcommunity.com/id/${u}`, run: (u) => page(`https://steamcommunity.com/id/${enc(u)}?xml=1`, (t) => { const g = (k: string) => strip(((t.match(new RegExp(`<${k}>([\\s\\S]*?)</${k}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '')); return g('steamID64') ? { name: g('steamID') || u, handle: u, avatar: g('avatarFull'), loc: g('location'), joined: day(g('memberSince')), bio: cut(g('summary')), priv: g('privacyState') !== 'public', fields: { 'Steam ID': g('steamID64'), 'VAC ban': g('vacBanned') === '1' ? 'Ya' : 'Tidak' } } : null; }) },
  { id: 'roblox', name: 'Roblox', cat: 'Game', url: (u) => `https://www.roblox.com/search/users?keyword=${u}`, ok: /^\w{3,20}$/, run: async (u) => { const r = await get('https://users.roblox.com/v1/usernames/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usernames: [u], excludeBannedUsers: false }) }); if (!r.ok) { await r.body?.cancel(); return { state: 'blocked' }; } const d = (await r.json()).data?.[0]; if (!d) return NONE; return await api(`https://users.roblox.com/v1/users/${d.id}`, (j) => ({ name: j.displayName, handle: j.name, bio: cut(j.description), joined: day(j.created), verified: j.hasVerifiedBadge, url: `https://www.roblox.com/users/${j.id}/profile`, fields: { Status: j.isBanned ? 'Diblokir' : 'Aktif' } })); } },
  { id: 'chess', name: 'Chess.com', cat: 'Game', url: (u) => `https://www.chess.com/member/${u}`, run: (u) => api(`https://api.chess.com/pub/player/${enc(u.toLowerCase())}`, (j) => ({ name: j.name || j.username, handle: j.username, avatar: j.avatar, loc: j.location || (j.country || '').split('/').pop(), joined: day(j.joined), seen: day(j.last_online), verified: j.verified, fields: { Pengikut: j.followers, Status: j.status, Gelar: j.title } })) },
  { id: 'lichess', name: 'Lichess', cat: 'Game', url: (u) => `https://lichess.org/@/${u}`, run: (u) => api(`https://lichess.org/api/user/${enc(u)}`, (j) => j.disabled ? null : { name: j.profile?.realName || j.username, handle: j.username, bio: cut(j.profile?.bio), loc: j.profile?.location, joined: day(j.createdAt), seen: day(j.seenAt), fields: { Permainan: j.count?.all, Gelar: j.title } }) },
  { id: 'scratch', name: 'Scratch', cat: 'Game', url: (u) => `https://scratch.mit.edu/users/${u}/`, run: async (u) => { const r = await api(`https://api.scratch.mit.edu/users/${enc(u)}`, (j) => ({ name: j.username, handle: j.username, joined: day(j.history?.joined) })); return r; } },
  { id: 'itch', name: 'itch.io', cat: 'Game', url: (u) => `https://${u}.itch.io`, run: (u) => page(`https://itch.io/profile/${enc(u)}`, simple(u, /\s*-\s*itch\.io$/)) },
  { id: 'soundcloud', name: 'SoundCloud', cat: 'Musik', url: (u) => `https://soundcloud.com/${u}`, run: (u) => api(`https://soundcloud.com/oembed?format=json&url=${enc(`https://soundcloud.com/${u}`)}`, (j) => ({ name: j.author_name || j.title, handle: u, bio: cut(j.description), avatar: j.thumbnail_url })) },
  { id: 'mixcloud', name: 'Mixcloud', cat: 'Musik', url: (u) => `https://www.mixcloud.com/${u}/`, run: (u) => api(`https://api.mixcloud.com/${enc(u)}/`, (j) => j.username ? { name: j.name, handle: j.username, bio: cut(j.biog), avatar: j.pictures?.large, loc: [j.city, j.country].filter(Boolean).join(', '), joined: day(j.created_time), fields: { Pengikut: j.follower_count, Mengikuti: j.following_count, Unggahan: j.cloudcast_count } } : null) },
  { id: 'flickr', name: 'Flickr', cat: 'Foto & seni', url: (u) => `https://www.flickr.com/people/${u}/`, run: (u) => page(`https://www.flickr.com/people/${enc(u)}/`, simple(u, /^About\s+|\s*\|\s*Flickr$/g)) },
  { id: 'deviantart', name: 'DeviantArt', cat: 'Foto & seni', url: (u) => `https://www.deviantart.com/${u}`, run: (u) => page(`https://www.deviantart.com/${enc(u)}`, simple(u, /\s+on DeviantArt$/)) },
  { id: 'dribbble', name: 'Dribbble', cat: 'Foto & seni', url: (u) => `https://dribbble.com/${u}`, run: (u) => page(`https://dribbble.com/${enc(u)}`, simple(u, /\s*\|\s*Dribbble$/)) },
  { id: 'patreon', name: 'Patreon', cat: 'Foto & seni', url: (u) => `https://www.patreon.com/${u}`, run: (u) => page(`https://www.patreon.com/${enc(u)}`, simple(u, /\s*\|\s*(Patreon|creating).*$/)) },
  { id: 'osm', name: 'OpenStreetMap', cat: 'Lainnya', url: (u) => `https://www.openstreetmap.org/user/${u}`, run: (u) => page(`https://www.openstreetmap.org/user/${enc(u)}`, (t) => { const h = simple(u)(t); if (h) { h.bio = ''; h.joined = day((t.match(/<time[^>]*datetime="([^"]+)"/) || [])[1]); } return h; }) },
  { id: 'wikipedia', name: 'Wikipedia Indonesia', cat: 'Indonesia', url: (u) => `https://id.wikipedia.org/wiki/Pengguna:${u}`, run: (u) => api(`https://id.wikipedia.org/w/api.php?action=query&list=users&ususers=${enc(u)}&usprop=editcount|registration|groups&format=json`, (j) => { const x = j.query?.users?.[0]; return x && x.userid ? { name: x.name, handle: x.name, joined: day(x.registration), fields: { Suntingan: x.editcount } } : null; }) },
  { id: 'tradingview', name: 'TradingView', cat: 'Lainnya', url: (u) => `https://www.tradingview.com/u/${u}/`, run: (u) => page(`https://www.tradingview.com/u/${enc(u)}/`, (t) => { const h = simple(u, /\s+—.*$/)(t); if (h) { h.name = u; h.bio = ''; if (/logo-preview/.test(h.avatar || '')) h.avatar = ''; } return h; }) },
  { id: 'pastebin', name: 'Pastebin', cat: 'Developer', url: (u) => `https://pastebin.com/u/${u}`, run: (u) => page(`https://pastebin.com/u/${enc(u)}`, (t) => ({ name: u, handle: u, joined: '', fields: {} })) },
];

function gravatar(j: J): Hit | null {
  const e = j?.entry?.[0];
  return e ? { name: e.displayName || e.name?.formatted, handle: e.preferredUsername, bio: cut(e.aboutMe), avatar: e.thumbnailUrl, loc: e.currentLocation, url: e.profileUrl, links: [...(e.accounts || []).map((a: J) => a.url), ...(e.urls || []).map((a: J) => a.value)].filter(Boolean).slice(0, 12), fields: { Pekerjaan: e.job_title, Perusahaan: e.company } } : null;
}

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
const sha = async (s: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));

// session + daily limit + opt-out, all in one database call. The query itself is never stored.
async function use(tok: string, kind: string, q: string): Promise<{ ok?: boolean; error?: string; optout?: boolean; status?: number }> {
  if (OPEN) return { ok: true };
  if (!tok) return { error: 'Silakan masuk ke Portal AMATU dulu.', status: 401 };
  const r = await fetch(`${SB}/rest/v1/rpc/fp_use`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_token: tok, p_hash: await sha(`${kind}:${q.toLowerCase()}`) }) });
  const j = await r.json().catch(() => null);
  if (!r.ok || !j) return { error: 'Pemeriksaan akun gagal. Coba lagi.', status: 502 };
  return j;
}

const DULL_BIO = /streams live on Twitch|menggunakan Snapchat!|is on Snapchat|is an artist on DeviantArt|^Linktree\. Make your|Lihat apa yang ditemukan|discovered on Pinterest|^See what .* Pinterest|Dukung .* di Trakteer|has \d[\d,]* books? on Goodreads, and is currently reading 0/i;
const DULL_PIC = /default_group\.gif|default_open_graph|default_profile|missing\.png|no-title\.jpg|logo-preview|web-capture/i;
function clean(h: Hit): Hit {
  if (h.bio && DULL_BIO.test(h.bio)) h.bio = '';
  if (h.avatar && DULL_PIC.test(h.avatar)) h.avatar = '';
  const f: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(h.fields || {})) if (v !== null && v !== undefined && v !== '') f[k] = v;
  const url = (s?: string) => s && /^https?:\/\//i.test(s) ? s.replace(/^http:/i, 'https:') : undefined;
  return { ...h, bio: h.bio ? cut(h.bio) : undefined, avatar: url(h.avatar), links: (h.links || []).map((l) => /^https?:/i.test(l) ? l : 'https://' + l).filter((l) => /^https?:\/\/[^\s/]+\.[^\s/]+/i.test(l)), fields: f };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST saja.' }, 405);
  const b: J = await req.json().catch(() => ({}));
  const tok = req.headers.get('x-amatu') || '';
  const q = String(b.q || '').trim();

  if (b.a === 'user') {
    if (!/^[A-Za-z0-9_.-]{2,40}$/.test(q)) return json({ error: 'Username hanya boleh huruf, angka, titik, garis bawah, dan strip (2–40 karakter).' }, 400);
    const u = await use(tok, 'user', q);
    if (u.optout) return json({ optout: true });
    if (!u.ok) return json({ error: u.error }, u.status || 429);
    const te = new TextEncoder();
    const todo = [...SOURCES];
    const stream = new ReadableStream({
      async start(c) {
        let open = true;
        const say = (o: unknown) => { if (open) try { c.enqueue(te.encode(JSON.stringify(o) + '\n')); } catch { open = false; } };
        say({ t: 'list', src: SOURCES.map((s) => ({ id: s.id, name: s.name, cat: s.cat, url: s.url(q) })) });
        const worker = async () => {
          for (let s = todo.shift(); s && open; s = todo.shift()) {
            const t0 = Date.now();
            let r: Res = NONE;
            if (!s.ok || s.ok.test(q)) try { r = await s.run(q); } catch { r = { state: 'error' }; }
            say({ t: 'src', id: s.id, state: r.state, ms: Date.now() - t0, hit: r.hit ? clean(r.hit) : undefined });
          }
        };
        await Promise.all(Array.from({ length: 12 }, worker));
        say({ t: 'end' });
        if (open) c.close();
      },
    });
    return new Response(stream, { headers: { ...CORS, 'Content-Type': 'application/x-ndjson', 'Cache-Control': 'no-store' } });
  }

  if (b.a === 'email') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(q) || q.length > 160) return json({ error: 'Alamat email tidak valid.' }, 400);
    const u = await use(tok, 'email', q);
    if (u.optout) return json({ optout: true });
    if (!u.ok) return json({ error: u.error }, u.status || 429);
    const h = await sha(q.toLowerCase());
    const [g, br] = await Promise.all([
      api(`https://gravatar.com/${h}.json`, gravatar).catch(() => ({ state: 'error' } as Res)),
      b.own === true ? breaches(q) : Promise.resolve(null),
    ]);
    return json({ gravatar: g.state === 'found' ? clean(g.hit!) : null, gstate: g.state, breaches: br });
  }

  if (b.a === 'rdap') {
    const ip = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-f:]*:[0-9a-f:]+$/i.test(q);
    if (!ip && !/^([a-z\d-]+\.)+[a-z]{2,}$/i.test(q)) return json({ error: 'Domain atau IP tidak valid.' }, 400);
    const u = await use(tok, 'rdap', q);
    if (!u.ok) return json({ error: u.error || 'Tidak tersedia.' }, u.status || 429);
    try {
      const r = await get(`https://rdap.org/${ip ? 'ip' : 'domain'}/${enc(q)}`);
      if (r.status === 404) return json({ none: true });
      if (!r.ok) return json({ error: `RDAP ${r.status}` }, 502);
      const j = await r.json();
      const ev = (k: string) => day((j.events || []).find((e: J) => e.eventAction === k)?.eventDate);
      const ents: J[] = j.entities || [];
      const org = (role: string) => { const e = ents.find((x) => x.roles?.includes(role)); const v = e?.vcardArray?.[1] || []; return v.find((x: J) => x[0] === 'org')?.[3] || (role === 'registrar' ? v.find((x: J) => x[0] === 'fn')?.[3] : '') || ''; };
      return json({ name: j.ldhName || j.name, handle: j.handle, registrar: org('registrar'), org: org('registrant'), created: ev('registration'), changed: ev('last changed'), expires: ev('expiration'), status: j.status || [], ns: (j.nameservers || []).map((n: J) => n.ldhName).slice(0, 6), country: j.country, range: j.startAddress ? `${j.startAddress} – ${j.endAddress}` : '' });
    } catch (e) { return json({ error: (e as Error).message }, 502); }
  }
  return json({ error: 'Permintaan tidak dikenal.' }, 400);
});

// XposedOrNot public API: names of known breaches, no passwords or leaked records.
async function breaches(q: string) {
  try {
    const r = await get(`https://api.xposedornot.com/v1/breach-analytics?email=${enc(q)}`);
    if (r.status === 404) return { list: [] };
    if (!r.ok) return { error: `Layanan menjawab ${r.status}` };
    const j = await r.json();
    const d = j?.ExposedBreaches?.breaches_details || [];
    return { list: d.map((x: J) => ({ name: x.breach, year: x.xposed_date, domain: x.domain, data: String(x.xposed_data || '').split(';').filter(Boolean), records: x.xposed_records, about: cut(x.details, 260) })), risk: j?.BreachMetrics?.risk?.[0] || null };
  } catch (e) { return { error: (e as Error).message }; }
}
