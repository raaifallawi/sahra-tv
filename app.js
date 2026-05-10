/* =============================================================
   Nujoom Mini App — main app logic
   ============================================================= */

const tg = window.Telegram?.WebApp;
const $main = document.getElementById("main");
const $loading = document.getElementById("loading");
const $detail = document.getElementById("detailOverlay");
const $detailContent = document.getElementById("detailContent");
const $player = document.getElementById("playerOverlay");
const $playerFrame = document.getElementById("playerFrame");
const $toast = document.getElementById("toast");
const $search = document.getElementById("searchInput");

let currentView = "discover";
let searchTimer = null;

/* ─── Init ───────────────────────────────────────────────── */
async function init() {
  // i18n first
  i18n.init();

  // Telegram setup
  if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor("secondary_bg_color");
    tg.MainButton.hide();
    tg.BackButton.onClick(handleBack);
    // Adapt language to user preference if first run
    const userLang = tg.initDataUnsafe?.user?.language_code;
    if (!localStorage.getItem("nujoom_lang") && userLang === "ar") {
      i18n.setLang("ar");
    }
  }

  // Auth (only works once Edge Function is deployed; otherwise local-only)
  if (window.authenticateWithTelegram) {
    await window.authenticateWithTelegram().catch(() => {});
  }

  // Ensure a users row exists (required for FK on watchlist/progress/parties).
  // MVP mode: relies on relaxed RLS (see backend/relax-rls.sql).
  await ensureUserRow().catch(e => console.warn("user upsert failed", e));

  bindUi();

  // Handle deep link
  const startParam = tg?.initDataUnsafe?.start_param || "";
  if (startParam.startsWith("movie_")) {
    const id = startParam.replace("movie_", "");
    return openDetail("movie", id);
  }
  if (startParam.startsWith("tv_")) {
    const id = startParam.replace("tv_", "").split("_")[0];
    return openDetail("tv", id);
  }
  if (startParam.startsWith("party_")) {
    const code = startParam.replace("party_", "");
    return joinPartyByCode(code);
  }

  renderDiscover();
}

function bindUi() {
  document.getElementById("langToggle").addEventListener("click", () => {
    i18n.setLang(i18n.lang === "ar" ? "en" : "ar");
    rerenderCurrent();
  });

  document.querySelectorAll(".tab").forEach(t => {
    t.addEventListener("click", () => {
      document.querySelectorAll(".tab").forEach(x => x.classList.remove("active"));
      t.classList.add("active");
      currentView = t.dataset.view;
      rerenderCurrent();
    });
  });

  $search.addEventListener("input", e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => {
      if (q.length >= 2) renderSearch(q);
      else rerenderCurrent();
    }, 300);
  });
}

function rerenderCurrent() {
  if (currentView === "discover")  return renderDiscover();
  if (currentView === "continue")  return renderContinue();
  if (currentView === "watchlist") return renderWatchlist();
  if (currentView === "parties")   return renderParties();
}

/* ─── Views ──────────────────────────────────────────────── */
async function renderDiscover() {
  showLoading();
  try {
    const [trending, movies, tv] = await Promise.all([
      TMDB.trending(),
      TMDB.popularMovies(),
      TMDB.popularTv(),
    ]);
    const recs = await getRecommended();

    $main.innerHTML = "";
    $main.appendChild(rowSection("section_trending", trending.results));
    if (recs.length) $main.appendChild(rowSection("section_recommended", recs));
    $main.appendChild(rowSection("section_popular_movies",
      movies.results.map(m => ({ ...m, media_type: "movie" }))));
    $main.appendChild(rowSection("section_popular_tv",
      tv.results.map(t => ({ ...t, media_type: "tv" }))));
  } catch (e) {
    console.error(e);
    $main.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
  }
}

async function renderSearch(q) {
  showLoading();
  try {
    const data = await TMDB.searchMulti(q);
    const items = (data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
    if (!items.length) {
      $main.innerHTML = `<div class="empty">${i18n.t("empty_search")}</div>`;
      return;
    }
    $main.innerHTML = "";
    $main.appendChild(grid(items));
  } catch (e) {
    console.error(e);
    $main.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
  }
}

async function renderContinue() {
  showLoading();
  const items = await Progress.list(50);
  if (!items.length) {
    $main.innerHTML = `<div class="empty">${i18n.t("empty_continue")}</div>`;
    return;
  }
  $main.innerHTML = "";
  $main.appendChild(grid(items.map(p => ({
    id: p.tmdb_id,
    media_type: p.media_type,
    title: p.title, name: p.title,
    poster_path: p.poster_path,
    progress: p.duration_seconds ? p.position_seconds / p.duration_seconds : 0,
  }))));
}

async function renderWatchlist() {
  showLoading();
  const items = await Watchlist.list();
  if (!items.length) {
    $main.innerHTML = `<div class="empty">${i18n.t("empty_watchlist")}</div>`;
    return;
  }
  $main.innerHTML = "";
  $main.appendChild(grid(items.map(w => ({
    id: w.tmdb_id, media_type: w.media_type,
    title: w.title, name: w.title,
    poster_path: w.poster_path,
  }))));
}

async function renderParties() {
  $main.innerHTML = `<div class="empty">${i18n.t("empty_parties")}</div>`;
  // TODO: list parties the user has joined recently (extension idea)
}

/* ─── Recommendations: simple version ──────────────────────
   Pull recommendations from the most-recent progress/watchlist item.
   Falls back to popular if user has no history. */
async function getRecommended() {
  try {
    const recent = await Progress.list(1);
    const seed = recent[0] || (await Watchlist.list())[0];
    if (!seed) return [];
    const data = await TMDB.recommendations(seed.media_type, seed.tmdb_id);
    return (data.results || []).map(x => ({ ...x, media_type: seed.media_type }));
  } catch { return []; }
}

/* ─── Building blocks ───────────────────────────────────── */
function rowSection(titleKey, items) {
  const wrap = document.createElement("section");
  wrap.innerHTML = `<h2 class="section-title">${i18n.t(titleKey)}</h2>`;
  const row = document.createElement("div");
  row.className = "row";
  items.slice(0, 20).forEach(it => row.appendChild(card(it)));
  wrap.appendChild(row);
  return wrap;
}

function grid(items) {
  const g = document.createElement("div");
  g.className = "grid";
  items.forEach(it => g.appendChild(card(it)));
  return g;
}

function card(item) {
  const el = document.createElement("div");
  el.className = "card";
  const title = item.title || item.name || "";
  const year = (item.release_date || item.first_air_date || "").slice(0, 4);
  const poster = TMDB.IMG(item.poster_path, "w342");
  el.innerHTML = `
    <div class="card-poster">
      ${poster ? `<img src="${poster}" alt="" loading="lazy"/>` : ""}
      ${item.progress ? `<div class="card-progress"><div class="card-progress-bar" style="width:${Math.min(100, item.progress * 100)}%"></div></div>` : ""}
    </div>
    <div class="card-title">${escapeHtml(title)}</div>
    <div class="card-meta">${year || (item.media_type === "tv" ? "TV" : "Movie")}</div>
  `;
  el.addEventListener("click", () => openDetail(item.media_type || "movie", item.id));
  return el;
}

/* ─── Detail view ───────────────────────────────────────── */
async function openDetail(mediaType, id) {
  $detail.hidden = false;
  $detailContent.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  if (tg) tg.BackButton.show();

  try {
    const d = mediaType === "tv" ? await TMDB.tvDetails(id) : await TMDB.movieDetails(id);
    const inWatchlist = await Watchlist.has(id, mediaType);

    const title = d.title || d.name;
    const year = (d.release_date || d.first_air_date || "").slice(0, 4);
    const runtime = d.runtime || (d.episode_run_time?.[0]) || null;
    const rating = d.vote_average ? d.vote_average.toFixed(1) : null;
    const backdrop = TMDB.IMG(d.backdrop_path || d.poster_path, "w780");

    $detailContent.innerHTML = `
      <div class="detail-backdrop" style="background-image:url('${backdrop}')">
        <button class="detail-close" id="detailClose">×</button>
      </div>
      <div class="detail-body">
        <h1 class="detail-title">${escapeHtml(title)}</h1>
        <div class="detail-meta">
          ${year ? year + " · " : ""}
          ${runtime ? runtime + " min · " : ""}
          ${rating ? "★ " + rating : ""}
        </div>
        <p class="detail-overview">${escapeHtml(d.overview || "")}</p>
        <div class="btn-row">
          <button class="btn" id="playBtn">▶ ${i18n.t("btn_play")}</button>
          <button class="btn btn-secondary" id="watchlistBtn">
            ${inWatchlist ? "✓ " + i18n.t("btn_remove_watchlist") : "+ " + i18n.t("btn_add_watchlist")}
          </button>
        </div>
        <div class="btn-row">
          <button class="btn btn-ghost" id="partyBtn">👥 ${i18n.t("btn_start_party")}</button>
          <button class="btn btn-ghost" id="shareBtn">↗ ${i18n.t("btn_share")}</button>
        </div>
        ${mediaType === "tv" ? renderSeasonPicker(d) : ""}
      </div>
    `;

    document.getElementById("detailClose").addEventListener("click", closeDetail);
    document.getElementById("playBtn").addEventListener("click", () => {
      if (mediaType === "tv") {
        const season = d.seasons?.find(s => s.season_number > 0)?.season_number || 1;
        loadEpisodesAndPlay(d.id, season);
      } else {
        playMovie(d);
      }
    });
    document.getElementById("watchlistBtn").addEventListener("click", async () => {
      if (inWatchlist) {
        await Watchlist.remove(id, mediaType);
        toast(i18n.t("toast_removed"));
      } else {
        await Watchlist.add({ id: d.id, media_type: mediaType, title, poster_path: d.poster_path });
        toast(i18n.t("toast_added"));
      }
      openDetail(mediaType, id); // rerender
    });
    document.getElementById("partyBtn").addEventListener("click", () => startParty(d, mediaType));
    document.getElementById("shareBtn").addEventListener("click", () => shareItem(d, mediaType));

    if (mediaType === "tv") {
      bindSeasonPicker(d);
    }
  } catch (e) {
    console.error(e);
    $detailContent.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
  }
}

function renderSeasonPicker(tv) {
  const seasons = (tv.seasons || []).filter(s => s.season_number > 0);
  if (!seasons.length) return "";
  return `
    <h3 class="section-title">${i18n.t("label_episodes")}</h3>
    <select class="season-select" id="seasonSelect">
      ${seasons.map(s => `<option value="${s.season_number}">${i18n.t("label_seasons")} ${s.season_number}</option>`).join("")}
    </select>
    <div id="episodeList"></div>
  `;
}

async function bindSeasonPicker(tv) {
  const sel = document.getElementById("seasonSelect");
  if (!sel) return;
  const load = async () => {
    const list = document.getElementById("episodeList");
    list.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    const data = await TMDB.tvSeason(tv.id, sel.value);
    list.innerHTML = "";
    (data.episodes || []).forEach(ep => {
      const el = document.createElement("div");
      el.className = "episode";
      el.innerHTML = `
        <div class="episode-num">${ep.episode_number}</div>
        <div class="episode-title">${escapeHtml(ep.name || "")}</div>
      `;
      el.addEventListener("click", () => playEpisode(tv, parseInt(sel.value, 10), ep.episode_number));
      list.appendChild(el);
    });
  };
  sel.addEventListener("change", load);
  load();
}

async function loadEpisodesAndPlay(tvId, season) {
  const data = await TMDB.tvSeason(tvId, season);
  const ep = data.episodes?.[0];
  if (ep) {
    const tv = await TMDB.tvDetails(tvId);
    playEpisode(tv, season, ep.episode_number);
  }
}

function closeDetail() {
  $detail.hidden = true;
  if (tg) tg.BackButton.hide();
}

/* ─── Player ─────────────────────────────────────────────── */
function playMovie(d) {
  const url = `https://www.vidking.net/embed/movie/${d.id}?autoPlay=true&primaryColor=C3110C`;
  openPlayer(url, {
    tmdb_id: d.id, media_type: "movie",
    title: d.title, poster_path: d.poster_path,
  });
}
function playEpisode(tv, season, episode) {
  const url = `https://www.vidking.net/embed/tv/${tv.id}/${season}/${episode}?autoPlay=true&primaryColor=C3110C`;
  openPlayer(url, {
    tmdb_id: tv.id, media_type: "tv", season, episode,
    title: tv.name, poster_path: tv.poster_path,
  });
}

let progressMeta = null;
function openPlayer(url, meta) {
  progressMeta = meta;
  $playerFrame.src = url;
  $player.hidden = false;
  if (tg) tg.BackButton.show();
  // VidKing posts player events via window.postMessage. Listen for them.
  window.addEventListener("message", onPlayerMessage);

  // Insert close button on first open
  if (!$player.querySelector(".detail-close")) {
    const close = document.createElement("button");
    close.className = "detail-close";
    close.textContent = "×";
    close.addEventListener("click", closePlayer);
    $player.appendChild(close);
  }
}
function closePlayer() {
  $playerFrame.src = "";
  $player.hidden = true;
  window.removeEventListener("message", onPlayerMessage);
  if (tg) tg.BackButton.hide();
}
function onPlayerMessage(e) {
  // Filter to VidKing messages
  if (!e.data || typeof e.data !== "object") return;
  const { type, currentTime, duration, event } = e.data;
  if (type !== "PLAYER_EVENT" && !event) return;
  if (!progressMeta || !currentTime) return;

  Progress.upsert({
    ...progressMeta,
    position_seconds: Math.floor(currentTime),
    duration_seconds: Math.floor(duration || 0),
  });

  // If hosting a watch party, broadcast
  if (Party.current?.isHost) {
    Party.hostUpdate({
      is_playing: event === "play" || event === "timeupdate",
      position_seconds: Math.floor(currentTime),
    });
  }
}

/* ─── Watch parties ──────────────────────────────────────── */
async function startParty(d, mediaType) {
  const party = await Party.create({
    tmdb_id: d.id, media_type: mediaType,
    season: null, episode: null,
    title: d.title || d.name,
    poster_path: d.poster_path,
  });
  if (!party) return toast(i18n.t("toast_error"));

  const link = Party.shareLink();
  // Use Telegram's native share sheet
  if (tg) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
  }
  toast(i18n.t("toast_party_started"));
  if (mediaType === "movie") playMovie(d);
}

async function joinPartyByCode(code) {
  const party = await Party.joinByCode(code);
  if (!party) return toast(i18n.t("toast_error"));

  // Subscribe to host updates
  Party.subscribe(p => {
    if (!progressMeta || progressMeta.tmdb_id !== p.tmdb_id) return;
    try {
      const cur = $playerFrame.contentWindow;
      // VidKing accepts postMessage commands like { action: 'seek', value: <sec> }
      cur.postMessage({ action: p.is_playing ? "play" : "pause" }, "*");
      cur.postMessage({ action: "seek", value: p.position_seconds }, "*");
    } catch {}
  });

  // Open the content the party is watching
  if (party.media_type === "movie") {
    const d = await TMDB.movieDetails(party.tmdb_id);
    playMovie(d);
  } else {
    const tv = await TMDB.tvDetails(party.tmdb_id);
    playEpisode(tv, party.season || 1, party.episode || 1);
  }
}

/* ─── Sharing ────────────────────────────────────────────── */
function shareItem(d, mediaType) {
  const cfg = window.NUJOOM_CONFIG || {};
  const link = `https://t.me/${cfg.BOT_USERNAME}/${cfg.MINIAPP_SHORT_NAME}?startapp=${mediaType}_${d.id}`;
  const text = `${d.title || d.name}\n${link}`;
  if (tg) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(d.title || d.name)}`);
  } else {
    navigator.clipboard?.writeText(text);
    toast("Copied");
  }
}

/* ─── Misc ───────────────────────────────────────────────── */
function handleBack() {
  if (!$player.hidden) return closePlayer();
  if (!$detail.hidden) return closeDetail();
}
function showLoading() {
  $main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
}
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { $toast.hidden = true; }, 2200);
}
function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ─── Ensure a row exists in the users table for this Telegram user ─── */
async function ensureUserRow() {
  if (!window.SB) return;
  const u = tg?.initDataUnsafe?.user;
  if (!u) return;
  await window.SB.from("users").upsert({
    telegram_user_id: u.id,
    username: u.username || null,
    first_name: u.first_name || null,
    last_name: u.last_name || null,
    language_code: u.language_code || "en",
    last_seen_at: new Date().toISOString(),
  }, { onConflict: "telegram_user_id" });
}

document.addEventListener("DOMContentLoaded", init);
