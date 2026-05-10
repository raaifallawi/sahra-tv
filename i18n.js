/* Bilingual strings — keep keys stable; add new strings to BOTH languages. */
const I18N = {
  en: {
    brand:              "Sahra TV",
    lang_button:        "عربي",
    search_placeholder: "Search movies and shows…",
    tab_discover:       "Discover",
    tab_continue:       "Continue",
    tab_watchlist:      "Watchlist",
    tab_parties:        "Parties",
    section_trending:   "Trending this week",
    section_popular_movies: "Popular movies",
    section_popular_tv:     "Popular shows",
    section_recommended:    "Recommended for you",
    section_continue:       "Continue watching",
    section_watchlist:      "Your watchlist",
    section_parties:        "Watch parties",
    btn_play:           "Play",
    btn_resume:         "Resume",
    btn_add_watchlist:  "Add to watchlist",
    btn_remove_watchlist:"Remove from watchlist",
    btn_start_party:    "Start watch party",
    btn_share:          "Share",
    label_seasons:      "Seasons",
    label_episodes:     "Episodes",
    empty_watchlist:    "Your watchlist is empty. Tap the bookmark on any movie to save it.",
    empty_continue:     "Nothing in progress yet. Start watching something!",
    empty_parties:      "No active parties. Start one from any movie or show.",
    empty_search:       "No results.",
    toast_added:        "Added to watchlist",
    toast_removed:      "Removed from watchlist",
    toast_party_started:"Watch party created — share the link!",
    toast_error:        "Something went wrong. Try again.",
    err_no_telegram:    "Open this app from Telegram to continue.",
  },
  ar: {
    brand:              "سهرة",
    lang_button:        "EN",
    search_placeholder: "ابحث عن أفلام ومسلسلات…",
    tab_discover:       "اكتشف",
    tab_continue:       "متابعة المشاهدة",
    tab_watchlist:      "قائمتي",
    tab_parties:        "المشاهدة المشتركة",
    section_trending:   "الأكثر رواجاً هذا الأسبوع",
    section_popular_movies: "أفلام شائعة",
    section_popular_tv:     "مسلسلات شائعة",
    section_recommended:    "مقترحات لك",
    section_continue:       "متابعة المشاهدة",
    section_watchlist:      "قائمتي",
    section_parties:        "جلسات المشاهدة",
    btn_play:           "تشغيل",
    btn_resume:         "متابعة",
    btn_add_watchlist:  "أضف إلى قائمتي",
    btn_remove_watchlist:"إزالة من قائمتي",
    btn_start_party:    "ابدأ مشاهدة جماعية",
    btn_share:          "مشاركة",
    label_seasons:      "المواسم",
    label_episodes:     "الحلقات",
    empty_watchlist:    "قائمتك فارغة. اضغط الإشارة المرجعية لحفظ أي فيلم.",
    empty_continue:     "لا يوجد ما تتابعه بعد. ابدأ بمشاهدة شيء!",
    empty_parties:      "لا توجد جلسات نشطة. ابدأ واحدة من أي فيلم أو مسلسل.",
    empty_search:       "لا توجد نتائج.",
    toast_added:        "تمت الإضافة إلى قائمتك",
    toast_removed:      "تمت الإزالة من قائمتك",
    toast_party_started:"تم إنشاء جلسة المشاهدة — شارك الرابط!",
    toast_error:        "حدث خطأ. حاول مجدداً.",
    err_no_telegram:    "افتح التطبيق من تيليجرام للمتابعة.",
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
