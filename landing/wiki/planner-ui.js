(function () {
  const planner = window.WikiPlanner;
  const configNode = document.getElementById('planner-config');
  const alertEl = document.getElementById('planner-error');
  const resultEl = document.getElementById('planner-result');
  if (!alertEl || !resultEl) {
    return;
  }

  function fail(message) {
    alertEl.hidden = false;
    alertEl.textContent = message;
    resultEl.hidden = true;
  }

  if (!planner || typeof planner.evaluate !== 'function' || !configNode) {
    fail('Planner failed to load. No stats were calculated.');
    return;
  }

  let config;
  try {
    config = JSON.parse(configNode.textContent || '');
  } catch (error) {
    fail('Planner config could not be read. No stats were calculated.');
    return;
  }

  const statKeys = planner.STAT_KEYS;

  function readInteger(id) {
    const el = document.getElementById(id);
    if (!el) {
      return { ok: false };
    }
    const raw = el.value.trim();
    if (!/^-?\d+$/.test(raw)) {
      return { ok: false };
    }
    return { ok: true, value: Number(raw) };
  }

  function currentInput() {
    const level = readInteger('level');
    const rebirth = readInteger('rebirth');
    if (!level.ok || !rebirth.ok) {
      return null;
    }
    const input = { level: level.value, rebirth: rebirth.value };
    for (const key of statKeys) {
      const stat = readInteger('stat-' + key);
      if (!stat.ok) {
        return null;
      }
      input[key] = stat.value;
    }
    return input;
  }

  function show(outcome) {
    if (!outcome.ok) {
      fail(outcome.error || 'This build is not allowed.');
      return;
    }
    alertEl.hidden = true;
    alertEl.textContent = '';
    resultEl.hidden = false;
    document.getElementById('out-points').textContent = String(outcome.points);
    document.getElementById('out-hp').textContent = String(outcome.hp);
    document.getElementById('out-mp').textContent = String(outcome.mp);
    document.getElementById('out-sp').textContent = String(outcome.sp);
  }

  function render() {
    const input = currentInput();
    if (!input) {
      fail('Enter a whole number for every stat.');
      return;
    }
    show(planner.evaluate(config, input));
  }

  document.querySelectorAll('[data-bump]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.getAttribute('data-stat');
      const dir = Number(button.getAttribute('data-dir'));
      const el = document.getElementById('stat-' + key);
      const current = readInteger('stat-' + key);
      if (!el || !current.ok || !Number.isInteger(dir) || (dir !== 1 && dir !== -1)) {
        return;
      }
      const next = current.value + dir;
      if (next < planner.BASE_STAT || next > planner.MAX_STAT) {
        return;
      }
      const trial = currentInput();
      if (!trial) {
        el.value = String(next);
        render();
        return;
      }
      trial[key] = next;
      const outcome = planner.evaluate(config, trial);
      if (!outcome.ok && outcome.error === 'Not enough level-up points.') {
        return;
      }
      el.value = String(next);
      show(outcome);
    });
  });

  document.querySelectorAll('#planner-form input').forEach((input) => {
    input.addEventListener('input', render);
  });

  render();
})();
