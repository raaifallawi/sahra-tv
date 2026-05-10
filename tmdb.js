/* TMDB API client — keep the API key in one place.
   NOTE: this is a public/read-only TMDB v3 key, safe for client use,
   but you should still set a strict CORS/referrer in TMDB account
   settings if available. */

const TMDB_KEY = window.NUJOOM_CONFIG?.TMDB_KEY || "REPLACE_WITH_TMDB_KEY";
const TMDB_BASE = "https://api.themoviedb.org/3";
const IMG = (path, size = "w500") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : "";

async function tmdb(endpoint, params = {}) {
  const url = new URL(TMDB_BASE + endpoint);
  url.searchParams.set("api_key", TMDB_KEY);
  url.searchParams.set("language", i18n.lang === "ar" ? "ar-SA" : "en-US");
  for (const [k, v] of Object.entries(params)) {
    if (v != null) url.searchParams.set(k, v);
  }
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TMDB ${res.status}`);
  return res.json();
}

const TMDB = {
  trending:       () => tmdb("/trending/all/week"),
  popularMovies:  () => tmdb("/movie/popular"),
  popularTv:      () => tmdb("/tv/popular"),
  searchMulti:    (q) => tmdb("/search/multi", { query: q, include_adult: false }),
  movieDetails:   (id) => tmdb(`/movie/${id}`, { append_to_response: "videos,credits,recommendations" }),
  tvDetails:      (id) => tmdb(`/tv/${id}`, { append_to_response: "videos,credits,recommendations" }),
  tvSeason:       (id, season) => tmdb(`/tv/${id}/season/${season}`),
  recommendations:(mediaType, id) => tmdb(`/${mediaType}/${id}/recommendations`),
  IMG,
};
