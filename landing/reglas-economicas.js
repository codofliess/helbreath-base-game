/**
 * Renders landing/content/reglas-economicas.md into the public rules section.
 * Copy stays in that file. This module only escapes and wraps it.
 * No ticker, mint, supply, or buy links are added here.
 */
(function (factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (typeof document !== "undefined") {
    var boot = function () {
      api.mount(document);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})(function () {
  var MOUNT_RE = /<div\b[^>]*\bid=["']reglas-economicas-mount["'][^>]*>\s*<\/div>/i;

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function parseReglasEconomicas(markdown) {
    var lines = String(markdown || "")
      .replace(/^\uFEFF/, "")
      .replace(/\r\n/g, "\n")
      .split("\n");
    var title = "";
    var draft = "";
    var sections = [];
    var current = null;

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      if (line.indexOf("<!--") === 0) continue;
      if (line.indexOf("## ") === 0) {
        current = { title: line.slice(3).trim(), paragraphs: [] };
        sections.push(current);
        continue;
      }
      if (line.indexOf("# ") === 0) {
        title = line.slice(2).trim();
        current = null;
        continue;
      }
      if (!current && line.charAt(0) === "_" && line.charAt(line.length - 1) === "_" && line.length > 2) {
        draft = line.slice(1, -1);
        continue;
      }
      if (!current) continue;
      current.paragraphs.push(line);
    }

    return { title: title, draft: draft, sections: sections };
  }

  function renderReglasEconomicas(markdown) {
    var doc = parseReglasEconomicas(markdown);
    var apartados = doc.sections
      .map(function (section, index) {
        var hid = "reglas-economicas-" + (index + 1);
        var paras = section.paragraphs
          .map(function (paragraph) {
            return "<p>" + escapeHtml(paragraph) + "</p>";
          })
          .join("\n");
        return (
          '<section class="reglas-apartado" aria-labelledby="' +
          hid +
          '">' +
          '<h3 id="' +
          hid +
          '">' +
          escapeHtml(section.title) +
          "</h3>\n" +
          paras +
          "</section>"
        );
      })
      .join("\n");

    var draft = doc.draft
      ? '<p class="reglas-draft-note">' + escapeHtml(doc.draft) + "</p>\n"
      : "";

    return (
      '<section class="post reglas-economicas" lang="es" aria-labelledby="reglas-economicas-title">' +
      '<div class="postheadborder">' +
      '<div class="postheader reglas-economicas-header">' +
      '<h2 id="reglas-economicas-title" class="reglas-economicas-title">' +
      escapeHtml(doc.title) +
      "</h2>" +
      '<span class="reglas-draft-badge">Borrador</span>' +
      "</div></div>" +
      '<div class="postcontent reglas-economicas-body">' +
      draft +
      apartados +
      "</div>" +
      '<div class="postfooter"></div>' +
      "</section>"
    );
  }

  function injectReglasIntoHtml(html, markdown) {
    var rendered = renderReglasEconomicas(markdown);
    if (!MOUNT_RE.test(html)) return html;
    return html.replace(
      MOUNT_RE,
      '<div id="reglas-economicas-mount" data-src="./content/reglas-economicas.md" data-rendered="1">\n' +
        rendered +
        "\n</div>"
    );
  }

  function mount(doc) {
    var host = doc.getElementById("reglas-economicas-mount");
    if (!host || host.getAttribute("data-rendered") === "1") return;
    if (host.querySelector(".reglas-economicas")) return;
    var src = host.getAttribute("data-src") || "./content/reglas-economicas.md";
    fetch(src, { credentials: "omit", cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("reglas");
        return res.text();
      })
      .then(function (markdown) {
        host.innerHTML = renderReglasEconomicas(markdown);
        host.setAttribute("data-rendered", "1");
      })
      .catch(function () {});
  }

  return {
    parseReglasEconomicas: parseReglasEconomicas,
    renderReglasEconomicas: renderReglasEconomicas,
    injectReglasIntoHtml: injectReglasIntoHtml,
    mount: mount,
  };
});
