/* =============================================================
   Sahra TV — Apple TV-inspired app logic
   ============================================================= */

const tg = window.Telegram?.WebApp;

const $main           = document.getElementById("main");
const $detail         = document.getElementById("detailOverlay");
const $detailContent  = document.getElementById("detailContent");
const $player         = document.getElementById("playerOverlay");
const $playerFrame    = document.getElementById("playerFrame");
const $partyBanner    = document.getElementById("partyBanner");
const $toast          = document.getElementById("toast");
const $searchOverlay  = document.getElementById("searchOverlay");
const $searchInput    = document.getElementById("searchInput");
const $searchResults  = document.getElementById("searchResults");

let currentView = "discover";
let searchTimer = null;

/* ─── Init ───────────────────────────────────────────────── */
async function init() {
  i18n.init();

  if (tg) {
    tg.ready();
    tg.expand();
    try { tg.setHeaderColor("#000000"); } catch {}
    try { tg.setBackgroundColor("#000000"); } catch {}
    tg.MainButton.hide();
    tg.BackButton.onClick(handleBack);
    const userLang = tg.initDataUnsafe?.user?.language_code;
    if (!localStorage.getItem("nujoom_lang") && userLang === "ar") {
      i18n.setLang("ar");
    }
  }

  if (window.authenticateWithTelegram) {
    await window.authenticateWithTelegram().catch(() => {});
  }
  await ensureUserRow().catch(e => console.warn("user upsert failed", e));

  bindUi();

  // Deep links
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

  renderCurrent();
}

function bindUi() {
  document.getElementById("langToggle").addEventListener("click", () => {
    i18n.setLang(i18n.lang === "ar" ? "en" : "ar");
    renderCurrent();
  });
  document.getElementById("brandLink").addEventListener("click", e => {
    e.preventDefault();
    setView("discover");
  });
  document.querySelectorAll(".nav-link").forEach(t => {
    t.addEventListener("click", () => setView(t.dataset.view));
  });
  document.getElementById("searchBtn").addEventListener("click", openSearch);
  document.getElementById("searchClose").addEventListener("click", closeSearch);
  $searchInput.addEventListener("input", e => {
    clearTimeout(searchTimer);
    const q = e.target.value.trim();
    searchTimer = setTimeout(() => {
      if (q.length >= 2) renderSearch(q);
      else $searchResults.innerHTML = "";
    }, 280);
  });

  // Close overlays with Esc
  document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (!$player.hidden) return closePlayer();
    if (!$detail.hidden) return closeDetail();
    if (!$searchOverlay.hidden) return closeSearch();
  });
}

function setView(v) {
  currentView = v;
  document.querySelectorAll(".nav-link").forEach(x =>
    x.classList.toggle("active", x.dataset.view === v));
  renderCurrent();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderCurrent() {
  switch (currentView) {
    case "discover":  return renderDiscover();
    case "movies":    return renderMovies();
    case "tv":        return renderTv();
    case "continue":  return renderContinue();
    case "watchlist": return renderWatchlist();
    case "parties":   return renderParties();
    default:          return renderDiscover();
  }
}

/* ─── Discover (Apple-TV home) ───────────────────────────── */
async function renderDiscover() {
  showLoading();
  try {
    const [trending, popMovies, popTv, topMovies, topTv] = await Promise.all([
      TMDB.trending(),
      TMDB.popularMovies(),
      TMDB.popularTv(),
      TMDB.topRatedMovies(),
      TMDB.topRatedTv(),
    ]);
    const recs = await getRecommended();

    $main.innerHTML = "";
    // Hero billboard from top trending item with a backdrop
    const heroPick = (trending.results || []).find(x => x.backdrop_path) || trending.results?.[0];
    if (heroPick) $main.appendChild(heroBillboard(heroPick));

    $main.appendChild(top10Section("section_trending", trending.results));
    if (recs.length) $main.appendChild(rowSection("section_recommended", recs));
    $main.appendChild(top10Section("section_top10_movies",
      (topMovies.results || []).map(m => ({ ...m, media_type: "movie" }))));
    $main.appendChild(top10Section("section_top10_tv",
      (topTv.results || []).map(t => ({ ...t, media_type: "tv" }))));
    $main.appendChild(rowSection("section_popular_movies",
      (popMovies.results || []).map(m => ({ ...m, media_type: "movie" }))));
    $main.appendChild(rowSection("section_popular_tv",
      (popTv.results || []).map(t => ({ ...t, media_type: "tv" }))));
  } catch (e) {
    console.error(e);
    showError();
  }
}

async function renderMovies() {
  showLoading();
  try {
    const [pop, top, up, trend] = await Promise.all([
      TMDB.popularMovies(), TMDB.topRatedMovies(), TMDB.upcomingMovies(), TMDB.trendingMovies(),
    ]);
    const tag = (arr) => (arr || []).map(m => ({ ...m, media_type: "movie" }));
    const trendArr = tag(trend.results);
    const heroPick = trendArr.find(x => x.backdrop_path) || trendArr[0];

    $main.innerHTML = "";
    if (heroPick) $main.appendChild(heroBillboard(heroPick));
    $main.appendChild(top10Section("section_top10_movies", tag(top.results)));
    $main.appendChild(rowSection("section_popular_movies", tag(pop.results)));
    $main.appendChild(rowSection("section_trending", trendArr));
  } catch (e) { console.error(e); showError(); }
}

async function renderTv() {
  showLoading();
  try {
    const [pop, top, trend] = await Promise.all([
      TMDB.popularTv(), TMDB.topRatedTv(), TMDB.trendingTv(),
    ]);
    const tag = (arr) => (arr || []).map(t => ({ ...t, media_type: "tv" }));
    const trendArr = tag(trend.results);
    const heroPick = trendArr.find(x => x.backdrop_path) || trendArr[0];

    $main.innerHTML = "";
    if (heroPick) $main.appendChild(heroBillboard(heroPick));
    $main.appendChild(top10Section("section_top10_tv", tag(top.results)));
    $main.appendChild(rowSection("section_popular_tv", tag(pop.results)));
    $main.appendChild(rowSection("section_trending", trendArr));
  } catch (e) { console.error(e); showError(); }
}

async function renderSearch(q) {
  $searchResults.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  try {
    const data = await TMDB.searchMulti(q);
    const items = (data.results || []).filter(r => r.media_type === "movie" || r.media_type === "tv");
    if (!items.length) {
      $searchResults.innerHTML = `<div class="empty"><h3>${i18n.t("empty_results_title")}</h3>${i18n.t("empty_search")}</div>`;
      return;
    }
    $searchResults.innerHTML = "";
    $searchResults.appendChild(grid(items));
  } catch (e) {
    console.error(e);
    $searchResults.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
  }
}

async function renderContinue() {
  showLoading();
  const items = await Progress.list(60);
  if (!items.length) {
    $main.innerHTML = emptyState("empty_continue");
    return;
  }
  $main.innerHTML = "";
  const wrap = document.createElement("div"); wrap.className = "section";
  wrap.appendChild(sectionHead("section_continue"));
  wrap.appendChild(grid(items.map(p => ({
    id: p.tmdb_id, media_type: p.media_type,
    title: p.title, name: p.title,
    poster_path: p.poster_path,
    progress: p.duration_seconds ? p.position_seconds / p.duration_seconds : 0,
  }))));
  $main.appendChild(wrap);
}

async function renderWatchlist() {
  showLoading();
  const items = await Watchlist.list();
  if (!items.length) {
    $main.innerHTML = emptyState("empty_watchlist");
    return;
  }
  $main.innerHTML = "";
  const wrap = document.createElement("div"); wrap.className = "section";
  wrap.appendChild(sectionHead("section_watchlist"));
  wrap.appendChild(grid(items.map(w => ({
    id: w.tmdb_id, media_type: w.media_type,
    title: w.title, name: w.title,
    poster_path: w.poster_path,
  }))));
  $main.appendChild(wrap);
}

async function renderParties() {
  $main.innerHTML = emptyState("empty_parties");
}

/* ─── Recommendations ────────────────────────────────────── */
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
function sectionHead(titleKey) {
  const h = document.createElement("div");
  h.className = "section-head";
  h.innerHTML = `<h2 class="section-title">${i18n.t(titleKey)} <span class="chev">›</span></h2>`;
  return h;
}

function rowSection(titleKey, items) {
  const wrap = document.createElement("section");
  wrap.className = "section";
  wrap.appendChild(sectionHead(titleKey));
  const row = document.createElement("div");
  row.className = "row";
  (items || []).slice(0, 20).forEach(it => row.appendChild(card(it)));
  wrap.appendChild(row);
  return wrap;
}

function top10Section(titleKey, items) {
  const wrap = document.createElement("section");
  wrap.className = "section";
  wrap.appendChild(sectionHead(titleKey));
  const row = document.createElement("div");
  row.className = "row top10";
  (items || []).slice(0, 10).forEach((it, i) => row.appendChild(rankedCard(it, i + 1)));
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
      ${poster ? `<img src="${poster}" alt="${escapeHtml(title)}" loading="lazy"/>` : ""}
      ${item.progress ? `<div class="card-progress"><div class="card-progress-bar" style="width:${Math.min(100, item.progress * 100)}%"></div></div>` : ""}
    </div>
    <div class="card-title">${escapeHtml(title)}</div>
    <div class="card-meta">${year || (item.media_type === "tv" ? "TV" : "Movie")}</div>
  `;
  el.addEventListener("click", () => openDetail(item.media_type || "movie", item.id));
  return el;
}

function rankedCard(item, rank) {
  const el = document.createElement("div");
  el.className = "card";
  const title = item.title || item.name || "";
  const poster = TMDB.IMG(item.poster_path, "w342");
  el.innerHTML = `
    <div class="rank">${rank}</div>
    <div>
      <div class="card-poster">
        ${poster ? `<img src="${poster}" alt="${escapeHtml(title)}" loading="lazy"/>` : ""}
      </div>
      <div class="card-title">${escapeHtml(title)}</div>
    </div>
  `;
  el.addEventListener("click", () => openDetail(item.media_type || "movie", item.id));
  return el;
}

function heroBillboard(item) {
  const el = document.createElement("section");
  el.className = "hero";
  const title = item.title || item.name || "";
  const year  = (item.release_date || item.first_air_date || "").slice(0, 4);
  const mediaType = item.media_type || (item.first_air_date ? "tv" : "movie");
  const backdrop = TMDB.IMG(item.backdrop_path, "original");
  const overview = item.overview || "";
  const rating = item.vote_average ? `★ ${item.vote_average.toFixed(1)}` : "";

  el.innerHTML = `
    <div class="hero-img" style="background-image:url('${backdrop}')"></div>
    <div class="hero-content">
      <div class="hero-eyebrow">${i18n.t("section_featured")}</div>
      <h1 class="hero-title">${escapeHtml(title)}</h1>
      <div class="hero-meta">
        ${year ? `<span>${year}</span><span class="dot">·</span>` : ""}
        <span>${mediaType === "tv" ? i18n.t("tab_tv") : i18n.t("tab_movies")}</span>
        ${rating ? `<span class="dot">·</span><span>${rating}</span>` : ""}
      </div>
      <p class="hero-overview">${escapeHtml(overview)}</p>
      <div class="hero-actions">
        <button class="btn btn-lg" id="heroPlay">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>
          ${i18n.t("btn_play")}
        </button>
        <button class="btn btn-secondary btn-lg" id="heroMore">${i18n.t("label_overview")}</button>
      </div>
    </div>
  `;
  el.querySelector("#heroPlay").addEventListener("click", e => {
    e.stopPropagation();
    quickPlay(mediaType, item.id);
  });
  el.querySelector("#heroMore").addEventListener("click", e => {
    e.stopPropagation();
    openDetail(mediaType, item.id);
  });
  return el;
}

function emptyState(key) {
  return `<div class="empty"><h3>${i18n.t("empty_results_title")}</h3>${i18n.t(key).replace(/\n/g, "<br/>")}</div>`;
}
function showError() {
  $main.innerHTML = `<div class="empty"><h3>${i18n.t("empty_results_title")}</h3>${i18n.t("toast_error")}</div>`;
}
function showLoading() {
  $main.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
}

/* ─── Search overlay ─────────────────────────────────────── */
function openSearch() {
  $searchOverlay.hidden = false;
  setTimeout(() => $searchInput.focus(), 30);
  if (tg) tg.BackButton.show();
}
function closeSearch() {
  $searchOverlay.hidden = true;
  $searchInput.value = "";
  $searchResults.innerHTML = "";
  if (tg && $detail.hidden && $player.hidden) tg.BackButton.hide();
}

/* ─── Detail view ───────────────────────────────────────── */
async function openDetail(mediaType, id) {
  $detail.hidden = false;
  $detail.scrollTop = 0;
  $detailContent.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
  if (tg) tg.BackButton.show();

  try {
    const d = mediaType === "tv" ? await TMDB.tvDetails(id) : await TMDB.movieDetails(id);
    const inWatchlist = await Watchlist.has(id, mediaType);

    const title    = d.title || d.name;
    const year     = (d.release_date || d.first_air_date || "").slice(0, 4);
    const runtime  = d.runtime || (d.episode_run_time?.[0]) || null;
    const rating   = d.vote_average ? d.vote_average.toFixed(1) : null;
    const certif   = pickCertification(d);
    const backdrop = TMDB.IMG(d.backdrop_path || d.poster_path, "original");
    const trailers = pickTrailers(d.videos?.results || []);
    const cast     = (d.credits?.cast || []).slice(0, 12);
    const related  = (d.recommendations?.results || []).slice(0, 16)
                       .map(r => ({ ...r, media_type: r.media_type || mediaType }));

    $detailContent.innerHTML = `
      <button class="detail-close" id="detailClose" aria-label="Close">×</button>

      <section class="detail-hero">
        <div class="detail-backdrop" style="background-image:url('${backdrop}')"></div>
        <div class="detail-hero-content">
          <h1 class="detail-title">${escapeHtml(title)}</h1>
          <div class="detail-meta">
            ${year ? `<span>${year}</span>` : ""}
            ${runtime ? `<span>${formatRuntime(runtime)}</span>` : ""}
            ${rating ? `<span>★ ${rating}</span>` : ""}
            ${certif ? `<span class="pill">${certif}</span>` : ""}
            ${(d.genres || []).slice(0,3).map(g => `<span>${escapeHtml(g.name)}</span>`).join("")}
          </div>
          <p class="detail-overview">${escapeHtml(d.overview || "")}</p>
          <div class="detail-actions">
            <button class="btn btn-lg" id="playBtn">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4l14 8-14 8V4z"/></svg>
              ${mediaType === "tv" ? i18n.t("btn_play_first") : i18n.t("btn_play")}
            </button>
            <button class="btn btn-secondary btn-lg" id="watchlistBtn">
              ${inWatchlist ? "✓ " + i18n.t("btn_remove_watchlist") : "+ " + i18n.t("btn_add_watchlist")}
            </button>
            <button class="btn btn-secondary btn-lg" id="partyBtn">
              👥 ${i18n.t("btn_start_party")}
            </button>
            <button class="btn btn-ghost btn-lg" id="shareBtn">
              ↗ ${i18n.t("btn_share")}
            </button>
          </div>
        </div>
      </section>

      <div class="detail-body">
        ${mediaType === "tv" ? renderSeasonPicker(d) : ""}
        ${trailers.length ? renderTrailers(trailers) : ""}
        ${cast.length ? renderCast(cast) : ""}
        ${related.length ? renderRelated(related) : ""}
        ${renderAbout(d, mediaType)}
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
      openDetail(mediaType, id);
    });
    document.getElementById("partyBtn").addEventListener("click", () => startParty(d, mediaType));
    document.getElementById("shareBtn").addEventListener("click", () => shareItem(d, mediaType));

    bindTrailerClicks();
    bindRelatedClicks();
    if (mediaType === "tv") bindSeasonPicker(d);
  } catch (e) {
    console.error(e);
    $detailContent.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
  }
}

function pickCertification(d) {
  // Movies → release_dates; TV → content_ratings
  try {
    if (d.release_dates) {
      const us = d.release_dates.results.find(r => r.iso_3166_1 === "US");
      const cert = us?.release_dates?.find(x => x.certification)?.certification;
      if (cert) return cert;
      const any = d.release_dates.results.flatMap(r => r.release_dates).find(x => x.certification);
      return any?.certification || "";
    }
    if (d.content_ratings) {
      const us = d.content_ratings.results.find(r => r.iso_3166_1 === "US");
      return us?.rating || d.content_ratings.results[0]?.rating || "";
    }
  } catch {}
  return "";
}

function pickTrailers(videos) {
  const yt = videos.filter(v => v.site === "YouTube");
  const trailers = yt.filter(v => /Trailer|Teaser|Clip/i.test(v.type));
  return (trailers.length ? trailers : yt).slice(0, 6);
}

function renderTrailers(videos) {
  return `
    <h3 class="subhead">${i18n.t("section_trailers")}</h3>
    <div class="trailer-row">
      ${videos.map(v => `
        <button class="trailer" data-yt="${v.key}" data-name="${escapeHtml(v.name || "")}">
          <div class="trailer-thumb" style="background-image:url('https://i.ytimg.com/vi/${v.key}/hqdefault.jpg')">
            <div class="trailer-play"><span>▶</span></div>
          </div>
          <div class="trailer-name">${escapeHtml(v.name || "")}</div>
        </button>
      `).join("")}
    </div>
  `;
}

function bindTrailerClicks() {
  document.querySelectorAll(".trailer").forEach(b => {
    b.addEventListener("click", () => {
      const key = b.dataset.yt;
      openPlayer(`https://www.youtube.com/embed/${key}?autoplay=1&rel=0&modestbranding=1`, null);
    });
  });
}

function renderCast(cast) {
  return `
    <h3 class="subhead">${i18n.t("section_cast")}</h3>
    <div class="cast-row">
      ${cast.map(p => `
        <div class="cast">
          <div class="cast-avatar" style="background-image:url('${p.profile_path ? TMDB.IMG(p.profile_path, "w185") : ""}')"></div>
          <div class="cast-name">${escapeHtml(p.name || "")}</div>
          <div class="cast-role">${escapeHtml(p.character || "")}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRelated(items) {
  return `
    <h3 class="subhead">${i18n.t("section_related")}</h3>
    <div class="row" style="padding-left:0;padding-right:0">
      ${items.map(it => {
        const t = it.title || it.name || "";
        const y = (it.release_date || it.first_air_date || "").slice(0,4);
        return `
          <div class="card" data-related='${JSON.stringify({id: it.id, mt: it.media_type}).replace(/'/g,"&#39;")}'>
            <div class="card-poster">
              ${it.poster_path ? `<img src="${TMDB.IMG(it.poster_path, "w342")}" alt="${escapeHtml(t)}" loading="lazy"/>` : ""}
            </div>
            <div class="card-title">${escapeHtml(t)}</div>
            <div class="card-meta">${y || (it.media_type === "tv" ? "TV" : "Movie")}</div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function bindRelatedClicks() {
  document.querySelectorAll("[data-related]").forEach(el => {
    el.addEventListener("click", () => {
      try {
        const { id, mt } = JSON.parse(el.dataset.related);
        openDetail(mt || "movie", id);
        $detail.scrollTop = 0;
      } catch {}
    });
  });
}

function renderAbout(d, mediaType) {
  const items = [];
  if (d.release_date || d.first_air_date) items.push([i18n.t("label_released"), d.release_date || d.first_air_date]);
  const rt = d.runtime || d.episode_run_time?.[0];
  if (rt) items.push([i18n.t("label_runtime"), formatRuntime(rt)]);
  if (d.genres?.length) items.push([i18n.t("label_genres"), d.genres.map(g => g.name).join(", ")]);
  if (d.status) items.push([i18n.t("label_status"), d.status]);
  if (mediaType === "tv" && d.number_of_seasons) items.push([i18n.t("label_seasons_count"), String(d.number_of_seasons)]);
  if (mediaType === "tv" && d.number_of_episodes) items.push([i18n.t("label_episodes_count"), String(d.number_of_episodes)]);
  if (d.vote_average) items.push([i18n.t("label_rating"), `★ ${d.vote_average.toFixed(1)} (${d.vote_count || 0})`]);
  if (d.original_language) items.push([i18n.t("label_language"), d.original_language.toUpperCase()]);

  if (!items.length) return "";
  return `
    <h3 class="subhead">${i18n.t("section_about")}</h3>
    <dl class="about">
      ${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(String(v))}</dd></div>`).join("")}
    </dl>
  `;
}

function formatRuntime(min) {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/* ─── TV: Season picker / episodes ───────────────────────── */
function renderSeasonPicker(tv) {
  const seasons = (tv.seasons || []).filter(s => s.season_number > 0);
  if (!seasons.length) return "";
  return `
    <h3 class="subhead">${i18n.t("section_episodes")}</h3>
    <div class="season-bar">
      <select class="season-select" id="seasonSelect">
        ${seasons.map(s => `<option value="${s.season_number}">${i18n.t("label_seasons")} ${s.season_number}${s.episode_count ? ` · ${s.episode_count} ${i18n.t("label_episodes_count")}` : ""}</option>`).join("")}
      </select>
    </div>
    <div id="episodeList"></div>
  `;
}

async function bindSeasonPicker(tv) {
  const sel = document.getElementById("seasonSelect");
  if (!sel) return;
  const load = async () => {
    const list = document.getElementById("episodeList");
    list.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
    try {
      const data = await TMDB.tvSeason(tv.id, sel.value);
      list.innerHTML = "";
      const grid = document.createElement("div");
      grid.className = "episode-row";
      (data.episodes || []).forEach(ep => {
        const el = document.createElement("button");
        el.className = "episode";
        const still = ep.still_path ? TMDB.IMG(ep.still_path, "w500") : (tv.backdrop_path ? TMDB.IMG(tv.backdrop_path, "w780") : "");
        el.innerHTML = `
          <div class="episode-still" style="background-image:url('${still}')">
            <div class="play-badge">▶ ${ep.runtime ? formatRuntime(ep.runtime) : i18n.t("btn_play")}</div>
          </div>
          <div class="episode-num">${i18n.t("label_episode")} ${ep.episode_number}</div>
          <div class="episode-title">${escapeHtml(ep.name || "")}</div>
          <div class="episode-overview">${escapeHtml(ep.overview || "")}</div>
        `;
        el.addEventListener("click", () => playEpisode(tv, parseInt(sel.value, 10), ep.episode_number));
        grid.appendChild(el);
      });
      list.appendChild(grid);
    } catch (e) {
      console.error(e);
      list.innerHTML = `<div class="empty">${i18n.t("toast_error")}</div>`;
    }
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
  if (tg && $player.hidden && $searchOverlay.hidden) tg.BackButton.hide();
}

/* ─── Quick play (from hero) ─────────────────────────────── */
async function quickPlay(mediaType, id) {
  try {
    if (mediaType === "tv") {
      const tv = await TMDB.tvDetails(id);
      const season = tv.seasons?.find(s => s.season_number > 0)?.season_number || 1;
      const data = await TMDB.tvSeason(id, season);
      const ep = data.episodes?.[0];
      if (ep) playEpisode(tv, season, ep.episode_number);
    } else {
      const m = await TMDB.movieDetails(id);
      playMovie(m);
    }
  } catch (e) {
    console.error(e);
    toast(i18n.t("toast_error"));
  }
}

/* ─── Player ─────────────────────────────────────────────── */
function playMovie(d) {
  const url = `https://www.vidking.net/embed/movie/${d.id}?autoPlay=true&primaryColor=ff3b30`;
  openPlayer(url, {
    tmdb_id: d.id, media_type: "movie",
    title: d.title || d.name, poster_path: d.poster_path,
  });
}
function playEpisode(tv, season, episode) {
  const url = `https://www.vidking.net/embed/tv/${tv.id}/${season}/${episode}?autoPlay=true&primaryColor=ff3b30`;
  openPlayer(url, {
    tmdb_id: tv.id, media_type: "tv", season, episode,
    title: tv.name || tv.title, poster_path: tv.poster_path,
  });
}

let progressMeta = null;
function openPlayer(url, meta) {
  progressMeta = meta;
  // Force iframe to be visible & sized; some loaders previously rendered audio-only
  // because the iframe element had zero height before src was set.
  $playerFrame.removeAttribute("hidden");
  $playerFrame.style.display = "block";
  $playerFrame.src = url;
  $player.hidden = false;
  if (Party.current) {
    $partyBanner.hidden = false;
    document.getElementById("partyBannerText").textContent =
      `${i18n.t("party_indicator")} · ${Party.current.short_code}`;
  } else {
    $partyBanner.hidden = true;
  }
  if (tg) tg.BackButton.show();
  window.addEventListener("message", onPlayerMessage);

  if (!$player.querySelector(".detail-close")) {
    const close = document.createElement("button");
    close.className = "detail-close";
    close.setAttribute("aria-label", "Close");
    close.textContent = "×";
    close.addEventListener("click", closePlayer);
    $player.appendChild(close);
  }
}
function closePlayer() {
  $playerFrame.src = "";
  $player.hidden = true;
  $partyBanner.hidden = true;
  window.removeEventListener("message", onPlayerMessage);
  if (tg && $detail.hidden && $searchOverlay.hidden) tg.BackButton.hide();
  if (Party.current?.isHost) Party.end().catch(() => {});
  else Party.leave().catch(() => {});
}
function onPlayerMessage(e) {
  if (!e.data || typeof e.data !== "object") return;
  const { type, currentTime, duration, event } = e.data;
  if (type !== "PLAYER_EVENT" && !event) return;
  if (!progressMeta || !currentTime) return;

  Progress.upsert({
    ...progressMeta,
    position_seconds: Math.floor(currentTime),
    duration_seconds: Math.floor(duration || 0),
  });

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
  if (tg) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}`);
  } else {
    try { await navigator.clipboard.writeText(link); toast(i18n.t("toast_link_copied")); } catch {}
  }
  toast(i18n.t("toast_party_started"));
  if (mediaType === "movie") playMovie(d);
  else loadEpisodesAndPlay(d.id, 1);
}

async function joinPartyByCode(code) {
  const party = await Party.joinByCode(code);
  if (!party) return toast(i18n.t("toast_error"));

  Party.subscribe(p => {
    if (!progressMeta || progressMeta.tmdb_id !== p.tmdb_id) return;
    try {
      const cur = $playerFrame.contentWindow;
      cur.postMessage({ action: p.is_playing ? "play" : "pause" }, "*");
      cur.postMessage({ action: "seek", value: p.position_seconds }, "*");
    } catch {}
  });

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
  if (tg) {
    tg.openTelegramLink(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(d.title || d.name)}`);
  } else {
    navigator.clipboard?.writeText(`${d.title || d.name}\n${link}`);
    toast(i18n.t("toast_link_copied"));
  }
}

/* ─── Misc ───────────────────────────────────────────────── */
function handleBack() {
  if (!$player.hidden) return closePlayer();
  if (!$detail.hidden) return closeDetail();
  if (!$searchOverlay.hidden) return closeSearch();
}
function toast(msg) {
  $toast.textContent = msg;
  $toast.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { $toast.hidden = true; }, 2200);
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

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
