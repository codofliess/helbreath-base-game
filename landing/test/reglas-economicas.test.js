const { describe, it, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseReglasEconomicas, renderReglasEconomicas, injectReglasIntoHtml } = require('../reglas-economicas');
const { server, withReglasEconomicas } = require('../server');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const markdownPath = path.join(root, 'content', 'reglas-economicas.md');
const ignorePath = path.join(root, '.railwayignore');

const PONS_CA = '0xb603D6b2e5472beb338CE079a63FEb8663171529';
const CURVE = '0xd3335A347ccB25F377247A8a4bc9855f7E12d91f';
const SOLANA_MINT = '4Sk2HzsvES8eSRinSc2gjDSDJ8qyji3iddoZvWN12Qjq';

function contentLines(markdown) {
  return markdown
    .replace(/^\uFEFF/, '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith('<!--'))
    .map((line) => {
      if (line.startsWith('## ')) return line.slice(3).trim();
      if (line.startsWith('# ')) return line.slice(2).trim();
      if (line.startsWith('_') && line.endsWith('_')) return line.slice(1, -1);
      return line;
    });
}

function renderedLines(html) {
  const out = [];
  const re = /<(h2|h3|p|span)\b[^>]*>([^<]*)<\/\1>/g;
  let match;
  while ((match = re.exec(html))) out.push(match[2]);
  return out;
}

function sectionSlice(html) {
  const start = html.indexOf('id="reglas-economicas"');
  const end = html.indexOf('id="contact"', start);
  assert.ok(start > 0 && end > start);
  return html.slice(start, end);
}

describe('reglas económicas del juego', () => {
  const markdown = fs.readFileSync(markdownPath, 'utf8');
  const index = fs.readFileSync(indexPath, 'utf8');
  const rendered = renderReglasEconomicas(markdown);
  const page = withReglasEconomicas(index);
  const section = sectionSlice(page);
  const lines = contentLines(markdown);

  it('renders the draft section from the markdown file', () => {
    const parsed = parseReglasEconomicas(markdown);
    assert.equal(parsed.title, 'Reglas económicas del juego');
    assert.equal(parsed.draft, 'Borrador: estas reglas pueden cambiar.');
    assert.equal(parsed.sections.length, 7);
    assert.match(rendered, /id="reglas-economicas-title"/);
    assert.match(rendered, /<h2[^>]*>Reglas económicas del juego<\/h2>/);
    assert.match(rendered, /class="reglas-draft-badge">Borrador</);
    assert.match(rendered, /<p class="reglas-draft-note">Borrador: estas reglas pueden cambiar\.<\/p>/);
    assert.match(rendered, /lang="es"/);
    assert.equal(rendered.includes('<h1'), false);
    assert.equal(rendered.includes('<h4'), false);
    assert.ok(rendered.indexOf('<h2') < rendered.indexOf('<h3'));
    assert.deepEqual(renderedLines(rendered), [lines[0], 'Borrador'].concat(lines.slice(1)));
    assert.deepEqual(renderedLines(section), [lines[0], 'Borrador'].concat(lines.slice(1)));
  });

  it('keeps the published amounts and does not add ticker or mint', () => {
    assert.match(section, /50 EKs o más/);
    assert.match(section, /tarifa fija de 5 dólares/);
    assert.match(section, /5 dólares por pieza/);
    assert.match(section, /50\.000 tokens en staking/);
    assert.match(section, /suben 1 nivel/);
    assert.equal(section.includes('50,000'), false);
    assert.equal(section.includes('50000'), false);

    const banned = [
      /\$[A-Za-z]/,
      /\bmint\b/i,
      /0x[a-fA-F0-9]{40}/,
      new RegExp(PONS_CA),
      new RegExp(CURVE),
      new RegExp(SOLANA_MINT),
      /ponsfamily/i,
      /dexscreener/i,
      /blockscout/i,
      /helbreath/i,
      /\$HELL/,
      /\$hell/,
      /reparto/i,
      /\bsupply\b/i,
      /data-i18n/,
      /data-mint/,
      /<a\b/i,
      /https?:\/\//i,
      /GO de Martín/,
      /<!--/,
    ];
    for (const pattern of banned) {
      assert.equal(pattern.test(section), false, String(pattern));
    }
    assert.equal(markdown.includes('<!--'), false);
    assert.equal(markdown.includes('$helbreath'), false);
    assert.equal(markdown.includes('$HELL'), false);
  });

  it('anchors the section and links it from the footer', () => {
    assert.match(index, /id="reglas-economicas"/);
    assert.match(index, /href="#reglas-economicas"/);
    const hell = page.slice(page.indexOf('id="hell"'), page.indexOf('id="cl-tv"'));
    assert.equal(hell.includes('id="reglas-economicas"'), false);
    assert.equal(hell.includes('50.000 tokens'), false);
    const injected = injectReglasIntoHtml(index, markdown);
    assert.match(injected, /data-rendered="1"/);
    assert.match(injected, /id="reglas-economicas-mount"/);
  });

  it('ships the markdown in the Railway image ignore rules', () => {
    const ignore = fs.readFileSync(ignorePath, 'utf8');
    const rules = ignore
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));
    assert.equal(rules.includes('*.md'), false);
    assert.equal(rules.includes('content/reglas-economicas.md'), false);
  });
});

describe('reglas económicas HTTP', () => {
  let listening = false;

  after(async () => {
    if (!listening) return;
    await new Promise((resolve) => server.close(resolve));
  });

  it('serves the rendered section on /', async () => {
    await new Promise((resolve, reject) => {
      server.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve()));
    });
    listening = true;
    const port = server.address().port;
    const res = await fetch(`http://127.0.0.1:${port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    const section = sectionSlice(html);
    assert.match(section, /Reglas económicas del juego/);
    assert.match(section, /Borrador: estas reglas pueden cambiar\./);
    assert.match(section, /class="reglas-draft-badge">Borrador</);
    assert.match(section, /50\.000 tokens/);
    assert.equal(/\$[A-Za-z]/.test(section), false);
    assert.equal(/\bmint\b/i.test(section), false);
    assert.equal(section.includes(PONS_CA), false);
    assert.equal(section.includes(SOLANA_MINT), false);

    const market = await fetch(`http://127.0.0.1:${port}/market.html`);
    const marketHtml = await market.text();
    assert.equal(marketHtml.includes('id="reglas-economicas-title"'), false);
    assert.equal(marketHtml.includes('50.000 tokens en staking'), false);
  });
});
