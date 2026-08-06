/**
 * Sunday Arena inscription — Phantom wallet sign-in + field list + tennis seeding preview.
 * Shared by arena-1v1.html (format=solo) and arena-3v3.html (format=team).
 */
(function () {
  var FORMAT = (window.__ARENA_FORMAT__ || "solo") === "team" ? "team" : "solo";
  var MIDDLEWARE =
    (typeof window !== "undefined" && window.__CHAINLORDS_MIDDLEWARE_URL__) ||
    (location.hostname === "localhost" || location.hostname === "127.0.0.1"
      ? "http://127.0.0.1:3001"
      : "http://127.0.0.1:3001");
  MIDDLEWARE = MIDDLEWARE.replace(/\/$/, "");

  function $(id) {
    return document.getElementById(id);
  }

  function setStatus(text, kind) {
    var el = $("ar-status");
    if (!el) return;
    el.textContent = text || "";
    el.classList.remove("is-ok", "is-err");
    if (kind === "ok") el.classList.add("is-ok");
    if (kind === "err") el.classList.add("is-err");
  }

  function shortWallet(w) {
    if (!w || w.length < 10) return w || "—";
    return w.slice(0, 4) + "…" + w.slice(-4);
  }

  function getPhantom() {
    var sol = window.solana;
    return sol && sol.isPhantom ? sol : null;
  }

  function toBase64(bytes) {
    var binary = "";
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async function requestChallenge(wallet) {
    var res = await fetch(MIDDLEWARE + "/auth/challenge?wallet=" + encodeURIComponent(wallet));
    if (!res.ok) throw new Error("Challenge failed (HTTP " + res.status + "). Is middleware on :3001?");
    return res.json();
  }

  async function signChallenge(phantom, message) {
    var encoded = new TextEncoder().encode(message);
    if (typeof phantom.request === "function") {
      return phantom.request({ method: "signMessage", params: { message: encoded, display: "utf8" } });
    }
    return phantom.signMessage(encoded, "utf8");
  }

  async function connectAndAuth() {
    var phantom = getPhantom();
    if (!phantom) throw new Error("Install Phantom from phantom.app, then refresh.");

    var connected = await phantom.connect();
    var wallet = connected.publicKey.toBase58();
    var challengeBody = await requestChallenge(wallet);
    var signed = await signChallenge(phantom, challengeBody.message);
    var signedWallet =
      signed.publicKey && typeof signed.publicKey.toBase58 === "function"
        ? signed.publicKey.toBase58()
        : wallet;
    if (signedWallet !== wallet) {
      wallet = signedWallet;
      challengeBody = await requestChallenge(wallet);
      signed = await signChallenge(phantom, challengeBody.message);
    }
    var sig =
      signed.signature instanceof Uint8Array
        ? signed.signature
        : new Uint8Array(signed.signature);

    var verifyRes = await fetch(MIDDLEWARE + "/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        wallet: wallet,
        challenge: challengeBody.challenge,
        signature: toBase64(sig),
      }),
    });
    if (!verifyRes.ok) {
      var detail = "Signature verification failed";
      try {
        var eb = await verifyRes.json();
        if (eb && eb.error) detail = eb.error;
      } catch (_) {}
      throw new Error(detail);
    }
    var body = await verifyRes.json();
    return { wallet: body.wallet, token: body.token, expiresAt: body.expiresAt };
  }

  function renderMeta(data) {
    var t = data.tournament || {};
    var nameEl = $("ar-event-name");
    if (nameEl) nameEl.textContent = t.name || "Sunday Coliseum";
    var starts = $("ar-starts");
    if (starts) {
      starts.textContent = t.starts_at
        ? "Starts (UTC): " + new Date(t.starts_at).toUTCString().replace(/:00 GMT$/, " UTC")
        : "Starts: next Sunday";
    }
    var count = $("ar-count");
    if (count) {
      count.textContent =
        (data.entries ? data.entries.length : t.entry_count || 0) +
        " / " +
        (t.max_entries || (FORMAT === "team" ? 32 : 64)) +
        " entries";
    }
    var status = $("ar-open");
    if (status) status.textContent = (t.status || "registration").toUpperCase();
  }

  function renderTable(entries) {
    var tbody = $("ar-entries-body");
    var empty = $("ar-empty");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!entries || !entries.length) {
      if (empty) empty.style.display = "block";
      return;
    }
    if (empty) empty.style.display = "none";
    entries.forEach(function (e) {
      var tr = document.createElement("tr");
      var seedClass = e.seed <= 4 ? "ar-seed is-top4" : "ar-seed";
      var name = e.display_name || e.team_name || e.character_name || shortWallet(e.wallet);
      var members =
        FORMAT === "team" && (e.team_members || e.character_name)
          ? String(e.team_members || e.character_name)
          : "";
      tr.innerHTML =
        '<td class="' +
        seedClass +
        '">#' +
        e.seed +
        "</td>" +
        "<td><strong>" +
        escapeHtml(name) +
        "</strong>" +
        (members ? '<div class="hint" style="margin:2px 0 0">' + escapeHtml(members) + "</div>" : "") +
        "</td>" +
        '<td class="ar-wallet">' +
        escapeHtml(shortWallet(e.wallet)) +
        "</td>" +
        '<td class="ar-rating">' +
        Math.round(e.rating || 1200) +
        "</td>" +
        '<td class="ar-record">' +
        (e.wins || 0) +
        "–" +
        (e.losses || 0) +
        "</td>";
      tbody.appendChild(tr);
    });
  }

  function renderBracket(preview) {
    var root = $("ar-r1");
    if (!root) return;
    root.innerHTML = "";
    if (!preview || !preview.length) {
      root.innerHTML = '<p class="ar-empty">Bracket preview appears after the first inscriptions.</p>';
      return;
    }
    preview.forEach(function (m, i) {
      var div = document.createElement("div");
      div.className = "ar-match";
      var a = m.entryA ? labelForEntry(m.entryA, m.seedA) : '<span class="bye">BYE</span>';
      var b = m.entryB ? labelForEntry(m.entryB, m.seedB) : '<span class="bye">BYE</span>';
      div.innerHTML =
        '<div class="player"><span class="s">' +
        (m.seedA ? "#" + m.seedA : "—") +
        "</span><span>" +
        a +
        "</span></div>" +
        '<span class="vs">R1 · M' +
        (i + 1) +
        "</span>" +
        '<div class="player"><span class="s">' +
        (m.seedB ? "#" + m.seedB : "—") +
        "</span><span>" +
        b +
        "</span></div>";
      root.appendChild(div);
    });
  }

  var entryLabels = {};

  function labelForEntry(entry, seed) {
    if (entryLabels[entry]) return escapeHtml(entryLabels[entry]);
    return escapeHtml(shortWallet(entry));
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  async function loadWeek() {
    try {
      var res = await fetch(MIDDLEWARE + "/arena/week?format=" + encodeURIComponent(FORMAT));
      if (!res.ok) throw new Error("HTTP " + res.status);
      var data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to load");

      entryLabels = {};
      (data.entries || []).forEach(function (e) {
        var key = e.entry || e.team_name || e.wallet;
        entryLabels[key] = e.display_name || e.team_name || e.character_name || shortWallet(e.wallet);
      });

      renderMeta(data);
      renderTable(data.entries || []);
      renderBracket(data.bracket_preview || []);
      var note = $("ar-seed-note");
      if (note && data.seeding_note) note.textContent = data.seeding_note;
      return data;
    } catch (err) {
      setStatus(
        "Could not load field: " +
          (err.message || err) +
          " — start middleware on :3001 (memory mode works without Postgres).",
        "err"
      );
      return null;
    }
  }

  async function onRegister(ev) {
    if (ev) ev.preventDefault();
    var btn = $("ar-register-btn");
    if (btn) btn.disabled = true;
    setStatus("Connecting Phantom…", null);

    try {
      var session = await connectAndAuth();
      setStatus("Wallet sealed — submitting inscription…", null);

      var payload = {
        format: FORMAT,
        wallet: session.wallet,
        character_name: ($("ar-char") && $("ar-char").value.trim()) || "",
      };
      if (FORMAT === "team") {
        payload.team_name = ($("ar-team") && $("ar-team").value.trim()) || "";
        payload.members = [
          ($("ar-m2") && $("ar-m2").value.trim()) || "",
          ($("ar-m3") && $("ar-m3").value.trim()) || "",
        ].filter(Boolean);
        if (!payload.character_name) payload.character_name = "Captain";
      }

      var res = await fetch(MIDDLEWARE + "/arena/week/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Token": session.token,
        },
        body: JSON.stringify(payload),
      });
      var body = await res.json().catch(function () {
        return {};
      });
      if (!res.ok || !body.success) {
        throw new Error((body && body.error) || "Register failed HTTP " + res.status);
      }

      setStatus(
        "Inscribed as " +
          shortWallet(session.wallet) +
          " — seed updates with historical Elo (tennis draw).",
        "ok"
      );
      await loadWeek();
    } catch (err) {
      setStatus(err.message || String(err), "err");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function init() {
    var form = $("ar-form");
    if (form) form.addEventListener("submit", onRegister);
    var btn = $("ar-register-btn");
    if (btn) btn.addEventListener("click", onRegister);
    loadWeek();
    setInterval(loadWeek, 30 * 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
