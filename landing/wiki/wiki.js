(function () {
  const list = document.getElementById('wiki-list');
  const status = document.getElementById('wiki-status');
  const empty = document.getElementById('wiki-empty');
  const input = document.getElementById('wiki-q');
  if (!list || !status) {
    return;
  }

  const rows = Array.from(list.querySelectorAll('[data-row]'));

  function showError() {
    status.dataset.state = 'error';
    status.textContent = "Couldn't confirm this list is current. It may be out of date.";
  }

  function applyFilter() {
    const query = (input && input.value ? input.value : '').trim().toLowerCase();
    let shown = 0;
    for (const row of rows) {
      const hay = (row.getAttribute('data-search') || '').toLowerCase();
      const match = query === '' || hay.includes(query);
      row.hidden = !match;
      if (match) {
        shown += 1;
      }
    }
    if (empty) {
      empty.hidden = shown !== 0;
    }
    if (status.dataset.state === 'ready') {
      status.textContent = query === ''
        ? rows.length + ' in the catalog.'
        : shown + ' shown of ' + rows.length + '.';
    }
    return shown;
  }

  function catalogUrl() {
    const params = new URLSearchParams(location.search);
    const requested = params.get('catalog');
    const fallback = list.getAttribute('data-catalog') || 'catalog.json';
    const name = requested === null ? fallback : requested;
    if (!/^(?:\.\/|\.\.\/)?[A-Za-z0-9._-]+$/.test(name)) {
      return null;
    }
    return new URL(name, document.baseURI).href;
  }

  async function load() {
    status.dataset.state = 'loading';
    status.textContent = 'Checking this list against the server\u2026';
    const params = new URLSearchParams(location.search);
    if (params.get('slow') === '1') {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
    const url = catalogUrl();
    if (!url) {
      showError();
      return;
    }
    let data;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      data = await response.json();
    } catch (error) {
      showError();
      return;
    }
    const kind = list.getAttribute('data-kind');
    const section = data && kind ? data[kind] : null;
    if (!Array.isArray(section)) {
      showError();
      return;
    }
    const ids = new Set(section.map((row) => String(row.id)));
    const domIds = rows.map((row) => row.getAttribute('data-id'));
    const same = domIds.length === ids.size && domIds.every((id) => ids.has(id));
    if (!same) {
      showError();
      return;
    }
    status.dataset.state = 'ready';
    status.textContent = section.length + ' in the catalog.';
    applyFilter();
  }

  if (input) {
    input.addEventListener('input', applyFilter);
  }
  document.querySelectorAll('[data-q]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!input) return;
      input.value = button.getAttribute('data-q') || '';
      applyFilter();
      input.focus();
    });
  });
  load();
})();
