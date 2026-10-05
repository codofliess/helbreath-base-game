const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const scriptDir = path.join(__dirname, '..', 'scripts', 'wiki');

function copyScripts(destLanding) {
  const scripts = path.join(destLanding, 'scripts', 'wiki');
  fs.mkdirSync(scripts, { recursive: true });
  for (const name of fs.readdirSync(scriptDir)) {
    if (name.endsWith('.mjs')) {
      fs.copyFileSync(path.join(scriptDir, name), path.join(scripts, name));
    }
  }
  fs.writeFileSync(
    path.join(destLanding, 'package.json'),
    `${JSON.stringify({ scripts: { build: 'node scripts/wiki/generate.mjs' } }, null, 2)}\n`,
  );
}

describe('wiki build from landing only', () => {
  it('uses the committed wiki when Config is not next to landing', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-landing-only-'));
    const landing = path.join(parent, 'landing');
    copyScripts(landing);
    const wiki = path.join(landing, 'wiki');
    fs.mkdirSync(wiki);
    const catalog = '{"items":[]}\n';
    const marker = path.join(wiki, 'items', '1.html');
    fs.mkdirSync(path.dirname(marker), { recursive: true });
    fs.writeFileSync(path.join(wiki, 'catalog.json'), catalog);
    fs.writeFileSync(marker, '<p>committed</p>\n');

    const result = spawnSync('npm', ['run', 'build'], {
      cwd: landing,
      encoding: 'utf8',
    });

    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
    assert.match(result.stdout, /server config is not reachable; using the committed wiki/);
    assert.equal(fs.readFileSync(path.join(wiki, 'catalog.json'), 'utf8'), catalog);
    assert.equal(fs.readFileSync(marker, 'utf8'), '<p>committed</p>\n');
    fs.rmSync(parent, { recursive: true, force: true });
  });

  it('fails when Config is missing and there is no committed wiki', () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-landing-empty-'));
    const landing = path.join(parent, 'landing');
    copyScripts(landing);

    const result = spawnSync('node', ['scripts/wiki/generate.mjs'], {
      cwd: landing,
      encoding: 'utf8',
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /no committed wiki/);
    fs.rmSync(parent, { recursive: true, force: true });
  });
});
