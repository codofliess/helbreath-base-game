/**
 * Chain Lords landing:
 * - Play Now → Phantom wallet auth → redirect to client character list
 * - Live realm stats (World buckets)
 * - EK gallery
 */

(function () {
  var MOBILE_NAV_WIDTH = 900;

  var EK_API_BASE =
    (typeof window !== "undefined" && window.__CHAINLORDS_EK_API__) ||
    (location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://localhost:3001"
      : "");

  var PLAY_URL =
    (typeof window !== "undefined" && window.__CHAINLORDS_PLAY_URL__) ||
    (location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:8081"
      : "https://play.chainlords.net");

  // Hard-correct prod host so a stale cached index.html cannot keep the old VPS IP.
  if (/\.chainlords\.net$/i.test(location.hostname) || location.hostname === "chainlords.net") {
    PLAY_URL = "https://play.chainlords.net";
  }

  var MIDDLEWARE_URL =
    (typeof window !== "undefined" && window.__CHAINLORDS_MIDDLEWARE_URL__) ||
    "http://127.0.0.1:3001";

  // Live counts: game host first (play.chainlords.net → :1337 /api/realm-stats).
  // Railway landing-api is fallback only when game host fails (and only if fresher/non-stale).
  var STATS_BASE =
    (typeof window !== "undefined" && window.__CHAINLORDS_STATS_API__) ||
    (location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:1337"
      : "https://play.chainlords.net");

  function isMobileNav() {
    return window.innerWidth <= MOBILE_NAV_WIDTH;
  }

  function resetDesktopNav() {
    if (isMobileNav()) return;
    document.querySelectorAll(".menu-toggle, .menu-panel, .has-sub").forEach(function (el) {
      el.classList.remove("is-open");
    });
    document.querySelectorAll(".menu-toggle, .submenu-toggle").forEach(function (el) {
      el.setAttribute("aria-expanded", "false");
    });
  }

  function setupMobileNav() {
    document.querySelectorAll(".menu-toggle").forEach(function (toggle) {
      toggle.addEventListener("click", function () {
        if (!isMobileNav()) return;
        var panel = toggle.nextElementSibling;
        var open = !toggle.classList.contains("is-open");

        document.querySelectorAll(".menu-toggle").forEach(function (other) {
          if (other === toggle) return;
          other.classList.remove("is-open");
          other.setAttribute("aria-expanded", "false");
          var otherPanel = other.nextElementSibling;
          if (otherPanel) otherPanel.classList.remove("is-open");
        });

        toggle.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        if (panel) panel.classList.toggle("is-open", open);
      });

      toggle.addEventListener("keydown", function (event) {
        if (!isMobileNav()) return;
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggle.click();
      });
    });

    document.querySelectorAll(".submenu-toggle").forEach(function (toggle) {
      toggle.addEventListener("click", function (event) {
        if (!isMobileNav()) return;
        event.preventDefault();
        var item = toggle.parentElement;
        if (!item || !item.classList.contains("has-sub")) return;
        var open = !item.classList.contains("is-open");

        item.parentElement.querySelectorAll(".has-sub").forEach(function (sib) {
          if (sib === item) return;
          sib.classList.remove("is-open");
          var sibToggle = sib.querySelector(".submenu-toggle");
          if (sibToggle) sibToggle.setAttribute("aria-expanded", "false");
        });

        item.classList.toggle("is-open", open);
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });

    window.addEventListener("resize", resetDesktopNav);
    resetDesktopNav();
  }

  function preload(imagesCsv) {
    if (!document.images) return;
    imagesCsv.split(",").forEach(function (src) {
      var img = new Image();
      img.src = src.trim();
    });
  }

  /* ---------- Phantom wallet → middleware → client character list ---------- */

  function getPhantom() {
    var sol = window.solana;
    if (sol && sol.isPhantom) return sol;
    return null;
  }

  function toBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function setPlayStatus(text, kind) {
    var el = document.getElementById("play-now-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("is-error", "is-ok");
    if (kind === "error") el.classList.add("is-error");
    if (kind === "ok") el.classList.add("is-ok");
  }

  function setPlayBusy(busy) {
    ["play-now-world", "play-now-world-secondary"].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) btn.disabled = !!busy;
    });
  }

  async function requestChallenge(middlewareUrl, wallet) {
    var res = await fetch(
      middlewareUrl.replace(/\/$/, "") + "/auth/challenge?wallet=" + encodeURIComponent(wallet),
      { credentials: "omit" }
    );
    if (!res.ok) {
      throw new Error("Failed to request login challenge (HTTP " + res.status + ")");
    }
    return res.json();
  }

  async function signChallenge(phantom, message) {
    var encoded = new TextEncoder().encode(message);
    if (typeof phantom.request === "function") {
      return phantom.request({
        method: "signMessage",
        params: { message: encoded, display: "utf8" },
      });
    }
    return phantom.signMessage(encoded, "utf8");
  }

  async function connectWalletAndAuthenticate() {
    var phantom = getPhantom();
    if (!phantom) {
      throw new Error("Phantom wallet not found. Install it from phantom.app");
    }

    var middlewareUrl = MIDDLEWARE_URL.replace(/\/$/, "");
    var connected = await phantom.connect();
    var wallet = connected.publicKey.toBase58();

    var challengeBody = await requestChallenge(middlewareUrl, wallet);
    var signed = await signChallenge(phantom, challengeBody.message);
    var signedWallet =
      signed.publicKey && typeof signed.publicKey.toBase58 === "function"
        ? signed.publicKey.toBase58()
        : wallet;

    if (signedWallet !== wallet) {
      wallet = signedWallet;
      challengeBody = await requestChallenge(middlewareUrl, wallet);
      signed = await signChallenge(phantom, challengeBody.message);
    }

    var signatureBytes =
      signed.signature instanceof Uint8Array
        ? signed.signature
        : new Uint8Array(signed.signature);

    var verifyRes = await fetch(middlewareUrl + "/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        wallet: wallet,
        challenge: challengeBody.challenge,
        signature: toBase64(signatureBytes),
      }),
    });

    if (!verifyRes.ok) {
      var detail = "Wallet signature verification failed";
      try {
        var errBody = await verifyRes.json();
        if (errBody && errBody.error) detail = errBody.error;
      } catch (_) {
        /* ignore */
      }
      throw new Error(detail);
    }

    var verifyBody = await verifyRes.json();
    return {
      wallet: verifyBody.wallet,
      token: verifyBody.token,
      expiresAt: verifyBody.expiresAt,
    };
  }

  function buildPlayRedirectUrl(session) {
    var base = PLAY_URL.replace(/\/$/, "");
    var url = new URL(base.indexOf("http") === 0 ? base : "http://" + base);
    url.searchParams.set("wallet", session.wallet);
    url.searchParams.set("token", session.token);
    url.searchParams.set("mode", "world");
    if (session.expiresAt) {
      url.searchParams.set("exp", String(session.expiresAt));
    }
    return url.toString();
  }

  function clientAutologinUrl() {
    var clientOnly = PLAY_URL.replace(/\/$/, "");
    var u = new URL(clientOnly.indexOf("http") === 0 ? clientOnly : "http://" + clientOnly);
    u.searchParams.set("mode", "world");
    u.searchParams.set("autologin", "1");
    return u.toString();
  }

  function isLocalPlayUrl(url) {
    return /127\.0\.0\.1|localhost/i.test(String(url || ""));
  }

  /** Best-effort: is the traveler client reachable? (local dev only) */
  async function probePlayClient() {
    // Production: never block on probe. HTTPS→HTTP mixed content + no-cors are flaky;
    // the live play host is expected to be up (Hetzner). Localhost still probes.
    if (!isLocalPlayUrl(PLAY_URL)) return true;
    try {
      var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
      var t = ctrl ? setTimeout(function () { ctrl.abort(); }, 2500) : null;
      await fetch(PLAY_URL.replace(/\/$/, "") + "/", {
        method: "GET",
        mode: "no-cors",
        signal: ctrl ? ctrl.signal : undefined,
        cache: "no-store",
      });
      if (t) clearTimeout(t);
      // no-cors → opaque is still "reachable"
      return true;
    } catch (_) {
      return false;
    }
  }

  async function handlePlayNow() {
    setPlayBusy(true);
    setPlayStatus("Opening game client…", null);
    try {
      // Local dev only: warn if traveler isn't up. Never hard-block production.
      if (isLocalPlayUrl(PLAY_URL)) {
        var clientUp = await probePlayClient();
        if (!clientUp) {
          setPlayStatus(
            "Game client not running. Start traveler on " + PLAY_URL + " (port 8081), then try again.",
            "error"
          );
          setPlayBusy(false);
          return;
        }
      }

      // Production / remote play: open the live client immediately.
      // Wallet auth can complete on the client (autologin) — more reliable than
      // cross-origin token handoff from the marketing site.
      if (!isLocalPlayUrl(PLAY_URL)) {
        setPlayStatus("Opening https://play.chainlords.net …", "ok");
        window.location.assign(clientAutologinUrl());
        return;
      }

      // HTTPS landing cannot call http:// middleware (mixed content).
      var pageIsHttps = location.protocol === "https:";
      var mwIsHttp = /^http:\/\//i.test(MIDDLEWARE_URL);
      if (pageIsHttps && mwIsHttp) {
        setPlayStatus("Opening game client…", "ok");
        window.location.assign(clientAutologinUrl());
        return;
      }

      setPlayStatus("Connecting Phantom…", null);
      var session = await connectWalletAndAuthenticate();
      setPlayStatus(
        "Wallet sealed: " +
          session.wallet.slice(0, 4) +
          "…" +
          session.wallet.slice(-4) +
          " — opening character list…",
        "ok"
      );
      var target = buildPlayRedirectUrl(session);
      window.setTimeout(function () {
        window.location.assign(target);
      }, 120);
    } catch (err) {
      var message = err && err.message ? err.message : "Wallet login failed";
      // Fallback: open client and let it prompt Phantom (middleware may be down).
      setPlayStatus(message + " — opening client…", "error");
      window.setTimeout(function () {
        window.location.assign(clientAutologinUrl());
      }, 500);
    }
  }

  function setupPlayNow() {
    var primary = document.getElementById("play-now-world");
    var secondary = document.getElementById("play-now-world-secondary");
    if (primary) {
      primary.addEventListener("click", function () {
        void handlePlayNow();
      });
    }
    if (secondary) {
      secondary.addEventListener("click", function () {
        void handlePlayNow();
      });
    }
  }

  /* ---------- Realm stats (4h rolling — cheap poll) ---------- */

  function setupRealmStats() {
    var on4hEl = document.getElementById("stat-online-4h");
    var eks4hEl = document.getElementById("stat-eks-4h");
    if (!on4hEl) return;

    // 4h aggregates change slowly; 2 min is plenty (not a load concern).
    var REFRESH_MS = 2 * 60 * 1000;
    var FALLBACK_STATS_BASE = "https://chainlords-stats-production.up.railway.app";
    var FALLBACK_MAX_AGE_MS = 10 * 60 * 1000;
    var lastGood = null;

    function setNums(data) {
      if (!data || typeof data !== "object") return;
      lastGood = data;
      var on4h =
        data.playersOnLast4h != null
          ? data.playersOnLast4h
          : data.online != null
            ? data.online
            : 0;
      var ek4h = data.eksLast4h != null ? data.eksLast4h : 0;
      on4hEl.textContent = String(on4h);
      if (eks4hEl) eks4hEl.textContent = String(ek4h);
    }

    function isFresh(data) {
      if (!data || !data.updatedAtUtc) return false;
      var t = Date.parse(data.updatedAtUtc);
      if (!Number.isFinite(t)) return false;
      return Date.now() - t <= FALLBACK_MAX_AGE_MS;
    }

    function fetchStats(base) {
      return fetch(base.replace(/\/$/, "") + "/api/realm-stats", {
        credentials: "omit",
        cache: "no-store",
        mode: "cors",
      }).then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      });
    }

    function poll() {
      if (!STATS_BASE) {
        setNums({ playersOnLast4h: 0, eksLast4h: 0 });
        return;
      }
      fetchStats(STATS_BASE)
        .then(setNums)
        .catch(function () {
          if (FALLBACK_STATS_BASE && FALLBACK_STATS_BASE !== STATS_BASE) {
            return fetchStats(FALLBACK_STATS_BASE)
              .then(function (data) {
                if (isFresh(data)) setNums(data);
                else if (lastGood) setNums(lastGood);
              })
              .catch(function () {
                if (lastGood) setNums(lastGood);
              });
          }
        });
    }

    poll();
    setTimeout(poll, 3000);
    setInterval(poll, REFRESH_MS);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") poll();
    });
  }

  /* ---------- EK gallery ---------- */

  function setupEkGallery() {
    var grid = document.getElementById("ek-gallery-grid");
    var status = document.getElementById("ek-gallery-status");
    var filters = document.querySelectorAll(".ek-filter");
    if (!grid || !status) return;

    var activeRarity = "all";
    var cache = null;

    function setStatus(text) {
      status.textContent = text;
    }

    function render(items) {
      grid.innerHTML = "";
      if (!items || !items.length) {
        var empty = document.createElement("div");
        empty.className = "ek-card-empty";
        empty.textContent =
          "No Enemy Kill screenshots yet. Eligible kills will appear here once the public realm is live.";
        grid.appendChild(empty);
        setStatus(EK_API_BASE ? "Gallery empty" : "Gallery empty · API not configured");
        return;
      }

      items.forEach(function (item) {
        var card = document.createElement("article");
        card.className = "ek-card";
        card.dataset.rarity = item.rarity || "unspecified";

        var img = document.createElement("img");
        img.alt = (item.killerName || "?") + " vs " + (item.victimName || "?");
        img.loading = "lazy";
        img.src = item.imageUrl
          ? EK_API_BASE + item.imageUrl
          : "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

        var meta = document.createElement("div");
        meta.className = "ek-card-meta";
        var killer = document.createElement("strong");
        killer.textContent = item.killerName || "Unknown killer";
        meta.appendChild(killer);
        meta.appendChild(
          document.createTextNode(
            "→ " + (item.victimName || "?") + (item.mapName ? " · " + item.mapName : "")
          )
        );

        card.appendChild(img);
        card.appendChild(meta);
        grid.appendChild(card);
      });

      setStatus(items.length + " screenshot" + (items.length === 1 ? "" : "s"));
    }

    function applyFilter() {
      if (!cache) return;
      if (activeRarity === "all") {
        render(cache);
        return;
      }
      render(
        cache.filter(function (item) {
          return item.rarity === activeRarity;
        })
      );
    }

    filters.forEach(function (btn) {
      btn.addEventListener("click", function () {
        filters.forEach(function (b) {
          b.classList.toggle("is-active", b === btn);
        });
        activeRarity = btn.getAttribute("data-rarity") || "all";
        applyFilter();
      });
    });

    if (!EK_API_BASE) {
      setStatus("Gallery online with public beta");
      var empty = document.createElement("div");
      empty.className = "ek-card-empty";
      empty.textContent =
        "EK hall of fame unlocks when the public realm is live. Join Discord for beta.";
      grid.appendChild(empty);
      return;
    }

    setStatus("Loading gallery…");
    fetch(EK_API_BASE + "/ek-screenshots?limit=48")
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        cache = (data && data.items) || [];
        applyFilter();
      })
      .catch(function () {
        cache = [];
        var note = document.createElement("div");
        note.className = "ek-card-empty";
        note.textContent = "Gallery temporarily unavailable. Check back soon or join Discord.";
        grid.appendChild(note);
        setStatus("Offline");
      });
  }

  /* ---------- Site language (EN / ES / PT) ---------- */
  var SITE_I18N = {
    en: {
      sealNote: "Two nations. One realm. Your seal on the chain.",
      worldKicker: "Under the goddess",
      worldTitle: "World",
      playNow: "Play Now",
      playTitle: "Play Helbreath World — connect Phantom wallet",
      playAria: "Play now — Helbreath World",
      statPlayers4h: "Players ON in last 4hs",
      statEks4h: "EKs in last 4hs",
    },
    es: {
      sealNote: "Dos naciones. Un reino. Tu sello en la cadena.",
      worldKicker: "Bajo la diosa",
      worldTitle: "Mundo",
      playNow: "Jugar ahora",
      playTitle: "Jugar Helbreath World — conectá Phantom",
      playAria: "Jugar ahora — Helbreath World",
      statPlayers4h: "Jugadores ON últimas 4h",
      statEks4h: "EKs últimas 4h",
    },
    pt: {
      sealNote: "Duas nações. Um reino. Seu selo na cadeia.",
      worldKicker: "Sob a deusa",
      worldTitle: "Mundo",
      playNow: "Jogar agora",
      playTitle: "Jogar Helbreath World — conecte Phantom",
      playAria: "Jogar agora — Helbreath World",
      statPlayers4h: "Jogadores ON nas últimas 4h",
      statEks4h: "EKs nas últimas 4h",
    },
  };

  function detectSiteLang() {
    try {
      var saved = localStorage.getItem("cl_site_lang");
      if (saved && SITE_I18N[saved]) return saved;
    } catch (e) {}
    var loc = (navigator.language || "en").toLowerCase();
    if (loc.startsWith("es")) return "es";
    if (loc.startsWith("pt")) return "pt";
    return "en";
  }

  function applySiteLang(lang) {
    var pack = SITE_I18N[lang] || SITE_I18N.en;
    document.documentElement.lang = lang === "pt" ? "pt" : lang === "es" ? "es" : "en";
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      var key = el.getAttribute("data-i18n");
      if (key && pack[key] != null) el.textContent = pack[key];
    });
    document.querySelectorAll("[data-i18n-title]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-title");
      if (key && pack[key] != null) el.setAttribute("title", pack[key]);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (el) {
      var key = el.getAttribute("data-i18n-aria");
      if (key && pack[key] != null) el.setAttribute("aria-label", pack[key]);
    });
    try {
      localStorage.setItem("cl_site_lang", lang);
    } catch (e) {}
  }

  function setupSiteLang() {
    var sel = document.getElementById("site-lang");
    var lang = detectSiteLang();
    if (sel) {
      sel.value = lang;
      sel.addEventListener("change", function () {
        applySiteLang(sel.value);
      });
    }
    applySiteLang(lang);
  }

  /* ---------- CHAIN LORDS TV (weekly guide from game /api/streams) ---------- */

  function setupClTv() {
    var liveList = document.getElementById("cl-tv-live-list");
    var scheduledEl = document.getElementById("cl-tv-scheduled");
    var weekEl = document.getElementById("cl-tv-week");
    var statusEl = document.getElementById("cl-tv-status");
    var refreshBtn = document.getElementById("cl-tv-refresh");
    var watchLink = document.getElementById("cl-tv-watch-link");
    if (!liveList || !scheduledEl || !weekEl) return;

    var STREAMS_BASE =
      (typeof window !== "undefined" && window.__CHAINLORDS_STREAMS_API__) ||
      (location.hostname === "localhost" || location.hostname === "127.0.0.1"
        ? "http://127.0.0.1:1337"
        : "https://play.chainlords.net");

    if (/\.chainlords\.net$/i.test(location.hostname) || location.hostname === "chainlords.net") {
      STREAMS_BASE = "https://play.chainlords.net";
    }

    var PLAY =
      (typeof window !== "undefined" && window.__CHAINLORDS_PLAY_URL__) ||
      "https://play.chainlords.net";
    if (/\.chainlords\.net$/i.test(location.hostname) || location.hostname === "chainlords.net") {
      PLAY = "https://play.chainlords.net";
    }
    if (watchLink) {
      watchLink.href = PLAY.replace(/\/$/, "") + "/?watch=streams";
    }

    function dayKey(d) {
      return (
        d.getFullYear() +
        "-" +
        String(d.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(d.getDate()).padStart(2, "0")
      );
    }

    function startOfDay(d) {
      var x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    }

    function fmtTime(ms) {
      return new Date(ms).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }

    function fmtDayHead(d, now) {
      var t0 = startOfDay(now).getTime();
      var t = startOfDay(d).getTime();
      var wd = d.toLocaleDateString(undefined, { weekday: "short" });
      var md = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      if (t === t0) return "Today · " + wd + " " + md;
      if (t === t0 + 86400000) return "Tomorrow · " + wd + " " + md;
      return wd + " " + md;
    }

    function fightersLine(d) {
      var fs = (d.fighters || [])
        .map(function (f) {
          return f.name || f.Name || "";
        })
        .filter(Boolean);
      return fs.length ? fs.join(" vs ") : d.hostName || d.host_name || "TBD";
    }

    function isLiveStatus(st) {
      return (
        st === "live" ||
        st === "countdown" ||
        st === "tech_sample" ||
        st === "tech_agree" ||
        st === "ready_window"
      );
    }

    function makeRow(opts) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cl-tv-row" + (opts.live ? " is-live" : opts.soon ? " is-soon" : "");
      btn.innerHTML =
        '<span class="cl-tv-time">' +
        (opts.live ? "NOW" : opts.time) +
        "</span>" +
        '<span class="cl-tv-badge cl-tv-badge--' +
        opts.kind +
        '">' +
        opts.badge +
        "</span>" +
        '<span><div class="cl-tv-row-title"></div><div class="cl-tv-row-sub"></div></span>' +
        '<span class="cl-tv-cta">' +
        (opts.live ? "▶ WATCH" : "INFO") +
        "</span>";
      btn.querySelector(".cl-tv-row-title").textContent = opts.title;
      btn.querySelector(".cl-tv-row-sub").textContent = opts.sub;
      btn.addEventListener("click", function () {
        var url = opts.href || PLAY.replace(/\/$/, "") + "/?watch=streams";
        window.open(url, "_blank", "noopener,noreferrer");
      });
      return btn;
    }

    function setStatus(t) {
      if (statusEl) statusEl.textContent = t || "";
    }

    function render(data) {
      var now = new Date();
      var nowMs = now.getTime();
      var pvpLive = (data.stages && data.stages.pvp && data.stages.pvp.live) || [];
      var pvpUp = (data.stages && data.stages.pvp && data.stages.pvp.upcoming) || [];
      var worldLive = (data.stages && data.stages.world && data.stages.world.live) || [];
      var tourLive =
        (data.stages && data.stages.tournament && data.stages.tournament.live) || [];

      var liveItems = [];
      pvpLive.forEach(function (d) {
        liveItems.push({
          live: true,
          kind: "pvp",
          badge: "PVP",
          title: d.title || "PVP · " + (d.hostName || ""),
          sub: fightersLine(d) + " · " + (d.mapId || ""),
          href:
            (d.watchUrl || PLAY.replace(/\/$/, "") + "/?watch=" + encodeURIComponent(d.matchId || "")),
          startMs: Number(d.opensAtMs) || nowMs,
        });
      });
      worldLive.forEach(function (w) {
        liveItems.push({
          live: true,
          kind: "world",
          badge: "WORLD",
          title: w.title || "World · " + (w.characterName || ""),
          sub: (w.characterName || "") + (w.worldId ? " · " + w.worldId : ""),
          href: w.streamUrl || PLAY.replace(/\/$/, "") + "/?watch=streams",
          startMs: Number(w.startedAtMs) || nowMs,
        });
      });
      tourLive.forEach(function (t) {
        liveItems.push({
          live: true,
          kind: "tournament",
          badge: "TOURNEY",
          title: t.title || "Tournament",
          sub: t.characterName || "",
          href: t.streamUrl || PLAY.replace(/\/$/, "") + "/?watch=streams",
          startMs: Number(t.startedAtMs) || nowMs,
        });
      });

      liveList.innerHTML = "";
      if (!liveItems.length) {
        liveList.innerHTML =
          '<p class="cl-tv-empty">Stage ready — no LIVE yet. Public duels &amp; World Go Live appear here.</p>';
      } else {
        liveItems.forEach(function (it) {
          liveList.appendChild(
            makeRow({
              live: true,
              kind: it.kind,
              badge: it.badge,
              title: it.title,
              sub: it.sub,
              href: it.href,
            })
          );
        });
      }

      var scheduled = pvpUp
        .map(function (d) {
          var start = Number(d.opensAtMs) || 0;
          return {
            live: isLiveStatus(d.status),
            soon: start - nowMs < 30 * 60 * 1000 && start >= nowMs,
            kind: "pvp",
            badge: "PVP",
            title: d.title || "PVP · " + (d.hostName || ""),
            sub: fightersLine(d) + " · " + (d.mapId || "") + " · " + (start ? new Date(start).toLocaleString() : ""),
            time: start ? fmtTime(start) : "—",
            href:
              d.watchUrl ||
              PLAY.replace(/\/$/, "") + "/?watch=" + encodeURIComponent(d.matchId || ""),
            startMs: start,
          };
        })
        .sort(function (a, b) {
          return a.startMs - b.startMs;
        });

      scheduledEl.innerHTML = "";
      if (!scheduled.length) {
        scheduledEl.innerHTML =
          '<p class="cl-tv-empty">No public duels scheduled this week. Create one in-game with Publish to cartelera.</p>';
      } else {
        scheduled.forEach(function (it) {
          scheduledEl.appendChild(makeRow(it));
        });
      }

      // Weekly grid 7 days
      weekEl.innerHTML = "";
      var byDay = {};
      for (var i = 0; i < 7; i++) {
        var day = new Date(startOfDay(now).getTime() + i * 86400000);
        byDay[dayKey(day)] = { date: day, events: [] };
      }
      scheduled.forEach(function (ev) {
        if (!ev.startMs) return;
        var k = dayKey(startOfDay(new Date(ev.startMs)));
        if (byDay[k]) byDay[k].events.push(ev);
      });
      liveItems.forEach(function (ev) {
        var k = dayKey(startOfDay(now));
        if (byDay[k]) byDay[k].events.push(ev);
      });

      Object.keys(byDay)
        .sort()
        .forEach(function (k) {
          var bucket = byDay[k];
          var dayBox = document.createElement("div");
          dayBox.className = "cl-tv-day";
          var head = document.createElement("div");
          head.className = "cl-tv-day-head";
          head.textContent =
            fmtDayHead(bucket.date, now) +
            (bucket.events.length
              ? " · " + bucket.events.length + " event" + (bucket.events.length === 1 ? "" : "s")
              : " · open slot");
          var body = document.createElement("div");
          body.className = "cl-tv-day-body";
          if (!bucket.events.length) {
            body.innerHTML = '<div class="cl-tv-day-empty">— no programming —</div>';
          } else {
            bucket.events.forEach(function (ev) {
              body.appendChild(makeRow(ev));
            });
          }
          dayBox.appendChild(head);
          dayBox.appendChild(body);
          weekEl.appendChild(dayBox);
        });

      var total =
        liveItems.length + scheduled.length + worldLive.length + tourLive.length;
      setStatus(
        "Updated " +
          new Date().toLocaleTimeString() +
          " · " +
          total +
          " listing(s) · source " +
          (data.source || "game-server")
      );
    }

    function load() {
      setStatus("Loading schedule…");
      var url = STREAMS_BASE.replace(/\/$/, "") + "/api/streams";
      fetch(url, { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(render)
        .catch(function (err) {
          setStatus("Schedule offline (" + (err && err.message ? err.message : "error") + "). Stage shell still ready.");
          liveList.innerHTML =
            '<p class="cl-tv-empty">Could not reach cartelera API. Multi-cam still opens on play.chainlords.net.</p>';
        });
    }

    if (refreshBtn) refreshBtn.addEventListener("click", load);
    load();
    setInterval(load, 20000);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") load();
    });
  }

  preload("./img/playover.png,./img/down.png,./img/playnow.png");
  setupMobileNav();
  setupSiteLang();
  setupPlayNow();
  setupEkGallery();
  setupRealmStats();
  setupClTv();
})();
