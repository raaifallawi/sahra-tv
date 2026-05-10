/* Watch parties — host broadcasts playback state, guests subscribe.

   Architecture:
   - Host creates a row in watch_parties; gets a short_code (6-char).
   - Host shares t.me/<bot>/<app>?startapp=party_<code> via Telegram share.
   - Guests open the deep link → Mini App reads startapp param → joins party.
   - Host's player posts updates (every ~2s while playing, plus on play/pause/seek)
     by updating the row. Realtime broadcasts to guests.
   - Guests adjust their player to match host within a small drift threshold.

   We use Supabase Realtime "postgres_changes" on the watch_parties table.
*/

const Party = {
  current: null,         // { id, short_code, isHost, channel }
  driftThresholdSec: 2,  // re-sync if more than this off

  async create({ tmdb_id, media_type, season, episode, title, poster_path }) {
    if (!window.SB) return null;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return null;

    const short_code = randomCode(6);
    const { data, error } = await window.SB.from("watch_parties")
      .insert({
        short_code,
        host_user_id: u.id,
        tmdb_id, media_type, season, episode, title, poster_path,
        is_playing: false, position_seconds: 0,
      })
      .select()
      .single();
    if (error) { console.error(error); return null; }

    // Add host as a member too
    await window.SB.from("watch_party_members").insert({
      party_id: data.id, telegram_user_id: u.id,
    });

    this.current = { id: data.id, short_code, isHost: true };
    return data;
  },

  async joinByCode(short_code) {
    if (!window.SB) return null;
    const u = window.Telegram?.WebApp?.initDataUnsafe?.user;
    if (!u) return null;

    const { data: party } = await window.SB.from("watch_parties")
      .select("*")
      .eq("short_code", short_code)
      .eq("status", "active")
      .maybeSingle();
    if (!party) return null;

    await window.SB.from("watch_party_members").upsert({
      party_id: party.id, telegram_user_id: u.id,
    });

    this.current = { id: party.id, short_code, isHost: party.host_user_id === u.id };
    return party;
  },

  /** Host: broadcast a playback update */
  async hostUpdate({ is_playing, position_seconds }) {
    if (!this.current?.isHost || !window.SB) return;
    await window.SB.from("watch_parties").update({
      is_playing, position_seconds,
      last_event_at: new Date().toISOString(),
    }).eq("id", this.current.id);
  },

  /** Guest: subscribe to host updates. onUpdate(party) is called on each change. */
  subscribe(onUpdate) {
    if (!this.current || !window.SB) return null;
    const channel = window.SB.channel(`party-${this.current.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "watch_parties",
        filter: `id=eq.${this.current.id}`,
      }, payload => onUpdate(payload.new))
      .subscribe();
    this.current.channel = channel;
    return channel;
  },

  async leave() {
    if (!this.current || !window.SB) return;
    if (this.current.channel) {
      await window.SB.removeChannel(this.current.channel);
    }
    this.current = null;
  },

  async end() {
    if (!this.current?.isHost || !window.SB) return;
    await window.SB.from("watch_parties").update({
      status: "ended", ended_at: new Date().toISOString(),
    }).eq("id", this.current.id);
    await this.leave();
  },

  shareLink() {
    if (!this.current) return "";
    const cfg = window.NUJOOM_CONFIG || {};
    return `https://t.me/${cfg.BOT_USERNAME}/${cfg.MINIAPP_SHORT_NAME}?startapp=party_${this.current.short_code}`;
  },
};

function randomCode(n) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

window.Party = Party;
