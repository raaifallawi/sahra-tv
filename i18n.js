/* Bilingual strings — keep keys stable; add new strings to BOTH languages. */
const I18N = {
  en: {
    brand:               "Sahra TV",
    lang_button:         "عربي",
    search_placeholder:  "Search movies, shows, people…",

    tab_discover:        "Home",
    tab_movies:          "Movies",
    tab_tv:              "Shows",
    tab_continue:        "Continue",
    tab_watchlist:       "Watchlist",
    tab_parties:         "Parties",

    section_featured:    "Featured",
    section_trending:    "Trending This Week",
    section_top10_movies:"Top 10 Movies",
    section_top10_tv:    "Top 10 TV Shows",
    section_popular_movies: "Popular Movies",
    section_popular_tv:     "Popular Shows",
    section_top_rated_movies:"Top Rated Movies",
    section_top_rated_tv:    "Top Rated Shows",
    section_recommended:    "Recommended For You",
    section_continue:       "Continue Watching",
    section_watchlist:      "Your Watchlist",
    section_parties:        "Watch Parties",
    section_episodes:    "Episodes",
    section_trailers:    "Trailers & Clips",
    section_cast:        "Cast & Crew",
    section_related:     "Related",
    section_about:       "About",

    btn_play:            "Play",
    btn_resume:          "Resume",
    btn_play_first:      "Play First Episode",
    btn_add_watchlist:   "My List",
    btn_remove_watchlist:"In My List",
    btn_start_party:     "Watch Party",
    btn_share:           "Share",
    btn_trailer:         "Trailer",

    label_seasons:       "Season",
    label_episode:       "Episode",
    label_overview:      "Overview",
    label_released:      "Released",
    label_runtime:       "Runtime",
    label_genres:        "Genres",
    label_status:        "Status",
    label_seasons_count: "Seasons",
    label_episodes_count:"Episodes",
    label_rating:        "Rating",
    label_language:      "Language",

    empty_watchlist:     "Your watchlist is empty.\nTap My List on any title to save it.",
    empty_continue:      "Nothing in progress yet.\nPlay something to see it here.",
    empty_parties:       "No active watch parties.\nStart one from any title.",
    empty_search:        "No results.",
    empty_results_title: "Nothing here yet",

    toast_added:         "Added to My List",
    toast_removed:       "Removed from My List",
    toast_party_started: "Watch party created — share the link!",
    toast_link_copied:   "Link copied",
    toast_error:         "Something went wrong. Try again.",

    party_indicator:     "Watching together",
  },
  ar: {
    brand:               "سهرة",
    lang_button:         "EN",
    search_placeholder:  "ابحث عن أفلام، مسلسلات، أشخاص…",

    tab_discover:        "الرئيسية",
    tab_movies:          "أفلام",
    tab_tv:              "مسلسلات",
    tab_continue:        "متابعة",
    tab_watchlist:       "قائمتي",
    tab_parties:         "الجلسات",

    section_featured:    "مميّز",
    section_trending:    "الأكثر رواجاً هذا الأسبوع",
    section_top10_movies:"أفضل 10 أفلام",
    section_top10_tv:    "أفضل 10 مسلسلات",
    section_popular_movies: "أفلام شائعة",
    section_popular_tv:     "مسلسلات شائعة",
    section_top_rated_movies:"الأعلى تقييماً (أفلام)",
    section_top_rated_tv:    "الأعلى تقييماً (مسلسلات)",
    section_recommended:    "مقترحات لك",
    section_continue:       "متابعة المشاهدة",
    section_watchlist:      "قائمتي",
    section_parties:        "جلسات المشاهدة",
    section_episodes:    "الحلقات",
    section_trailers:    "العروض والمقاطع",
    section_cast:        "الممثلون وفريق العمل",
    section_related:     "ذات صلة",
    section_about:       "حول",

    btn_play:            "تشغيل",
    btn_resume:          "متابعة",
    btn_play_first:      "تشغيل الحلقة الأولى",
    btn_add_watchlist:   "قائمتي",
    btn_remove_watchlist:"في قائمتي",
    btn_start_party:     "مشاهدة جماعية",
    btn_share:           "مشاركة",
    btn_trailer:         "العرض الترويجي",

    label_seasons:       "موسم",
    label_episode:       "حلقة",
    label_overview:      "النظرة العامة",
    label_released:      "تاريخ الإصدار",
    label_runtime:       "المدة",
    label_genres:        "التصنيفات",
    label_status:        "الحالة",
    label_seasons_count: "المواسم",
    label_episodes_count:"الحلقات",
    label_rating:        "التقييم",
    label_language:      "اللغة",

    empty_watchlist:     "قائمتك فارغة.\nأضف أي عنوان من زر «قائمتي».",
    empty_continue:      "لا يوجد ما تتابعه بعد.\nشغّل شيئاً ليظهر هنا.",
    empty_parties:       "لا توجد جلسات نشطة.\nابدأ واحدة من أي عنوان.",
    empty_search:        "لا توجد نتائج.",
    empty_results_title: "لا يوجد شيء بعد",

    toast_added:         "أُضيف إلى قائمتي",
    toast_removed:       "أُزيل من قائمتي",
    toast_party_started: "تم إنشاء الجلسة — شارك الرابط!",
    toast_link_copied:   "تم نسخ الرابط",
    toast_error:         "حدث خطأ. حاول مجدداً.",

    party_indicator:     "نشاهد معاً",
  },
};

const i18n = {
  lang: "en",
  t(key) { return (I18N[this.lang] && I18N[this.lang][key]) || key; },
  setLang(l) {
    if (!I18N[l]) return;
    this.lang = l;
    document.documentElement.lang = l;
    document.documentElement.dir = (l === "ar") ? "rtl" : "ltr";
    document.querySelectorAll("[data-i18n]").forEach(el => {
      el.textContent = this.t(el.dataset.i18n);
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
    try { localStorage.setItem("nujoom_lang", l); } catch {}
  },
  init() {
    let saved = "en";
    try { saved = localStorage.getItem("nujoom_lang") || "en"; } catch {}
    this.setLang(saved);
  },
};
