/* Supabase client wrapper.
   Auth model: we use Supabase's anon key on the client. Row-Level Security
   policies key off the JWT claim 'tg_user_id'. To set that claim, you need
   a small server-side function (Supabase Edge Function) that verifies
   Telegram initData with your bot token and issues a custom JWT.

   For development convenience, this file ALSO supports a "trusted client"
   mode: it sends initDataRaw with every request as a custom header, and
   you verify it inside an RPC. Pick whichever you prefer; we provide both
   patterns in backend/edge-functions/.
*/

const SB_URL = window.NUJOOM_CONFIG?.SUPABASE_URL || "";
const SB_ANON = window.NUJOOM_CONFIG?.SUPABASE_ANON_KEY || "";

const sb = (SB_URL && SB_ANON)
  ? supabase.createClient(SB_URL, SB_ANON, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        // Attach Telegram initData to every request. The edge function
        // 'verify-tg' reads this, validates HMAC, and authorizes the request.
        headers: {
          "x-telegram-init-data":
            (window.Telegram?.WebApp?.initData) || "",
        },
      },
    })
  : null;

/* ─── Auth: exchange initData for a Supabase JWT ─────────────
   Calls an Edge Function 'tg-auth' that:
     1. verifies initData HMAC against bot token
     2. upserts the user row
     3. signs a JWT with claim tg_user_id and returns it
   We then call sb.auth.setSession to use it for subsequent calls.
*/
async function authenticateWithTelegram() {
  if (!sb) return false;
  const initData = window.Telegram?.WebApp?.initData;
  if (!initData) return false;

  try {
    const res = await fetch(`${SB_URL}/functions/v1/tg-auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SB_ANON}`,
      },
      body: JSON.stringify({ initData }),
    });
    if (!res.ok) throw new Error("auth failed");
    const { access_token, refresh_token } = await res.json();
    await sb.auth.setSession({ access_token, refresh_token });
    return true;
  } catch (e) {
    console.warn("Telegram auth failed:", e);
    return false;
  }
}

/* ─── Watchlist ──────────────────────────────────────────── */
const Watchlist = {
  async list() {
    if (!sb) return [];
    const { data, error } = await sb.from("watchlist")
      .select("*")
      .order("added_at", { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },
  async add(item) {
    if (!sb) return;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return;
    await sb.from("watchlist").upsert({
      telegram_user_id: u.id,
      tmdb_id: item.id,
      media_type: item.media_type,
      title: item.title || item.name,
      poster_path: item.poster_path,
    }, { onConflict: "telegram_user_id,tmdb_id,media_type" });
  },
  async remove(tmdbId, mediaType) {
    if (!sb) return;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return;
    await sb.from("watchlist").delete()
      .eq("telegram_user_id", u.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType);
  },
  async has(tmdbId, mediaType) {
    if (!sb) return false;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return false;
    const { data } = await sb.from("watchlist").select("id")
      .eq("telegram_user_id", u.id)
      .eq("tmdb_id", tmdbId)
      .eq("media_type", mediaType)
      .maybeSingle();
    return !!data;
  },
};

/* ─── Progress ───────────────────────────────────────────── */
const Progress = {
  async list(limit = 20) {
    if (!sb) return [];
    const { data } = await sb.from("progress")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(limit);
    return data || [];
  },
  async upsert({ tmdb_id, media_type, season = null, episode = null, position_seconds, duration_seconds, title, poster_path }) {
    if (!sb) return;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return;
    await sb.from("progress").upsert({
      telegram_user_id: u.id,
      tmdb_id, media_type, season, episode,
      position_seconds, duration_seconds,
      title, poster_path,
      updated_at: new Date().toISOString(),
    }, { onConflict: "telegram_user_id,tmdb_id,media_type,season,episode" });
  },
};

window.SB = sb;
window.Watchlist = Watchlist;
window.Progress = Progress;
window.authenticateWithTelegram = authenticateWithTelegram;
