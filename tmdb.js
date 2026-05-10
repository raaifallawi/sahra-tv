/* TMDB API client.
   The v3 read key is safe to ship to the browser. Configure stricter
   referrer rules in your TMDB account if you want extra protection. */

const TMDB_KEY  = window.NUJOOM_CONFIG?.TMDB_KEY || "REPLACE_WITH_TMDB_KEY";
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
  trending:        (window_ = "week")     => tmdb(`/trending/all/${window_}`),
  trendingMovies:  (window_ = "week")     => tmdb(`/trending/movie/${window_}`),
  trendingTv:      (window_ = "week")     => tmdb(`/trending/tv/${window_}`),
  popularMovies:   ()                     => tmdb("/movie/popular"),
  popularTv:       ()                     => tmdb("/tv/popular"),
  topRatedMovies:  ()                     => tmdb("/movie/top_rated"),
  topRatedTv:      ()                     => tmdb("/tv/top_rated"),
  upcomingMovies:  ()                     => tmdb("/movie/upcoming"),
  searchMulti:     (q)                    => tmdb("/search/multi", { query: q, include_adult: false }),
  movieDetails:    (id)                   => tmdb(`/movie/${id}`, { append_to_response: "videos,credits,recommendations,images,release_dates" }),
  tvDetails:       (id)                   => tmdb(`/tv/${id}`,    { append_to_response: "videos,credits,recommendations,images,content_ratings" }),
  tvSeason:        (id, season)           => tmdb(`/tv/${id}/season/${season}`),
  recommendations: (mediaType, id)        => tmdb(`/${mediaType}/${id}/recommendations`),
  IMG,
};
window.TMDB = TMDB;
