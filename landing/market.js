/**
 * Mobile market side door — search, Grok advisor, quote/order/pay-dev, desk claims.
 */
(function () {
  var API =
    (typeof window !== 'undefined' && window.__CHAINLORDS_MIDDLEWARE_URL__) ||
    'http://127.0.0.1:3001';
  var PLAY =
    (typeof window !== 'undefined' && window.__CHAINLORDS_PLAY_URL__) ||
    (location.hostname === 'localhost' || location.hostname === '127.0.0.1'
      ? 'http://127.0.0.1:8081'
      : 'https://play.chainlords.net');

  var $ = function (id) {
    return document.getElementById(id);
  };

  function setText(id, t) {
    var el = $(id);
    if (el) el.textContent = t;
  }

  function api(path, opts) {
    return fetch(API + path, opts).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) throw new Error(j.error || r.statusText || 'request failed');
        return j;
      });
    });
  }

  function wallet() {
    return ($('mk-wallet').value || '').trim();
  }

  function renderListings(rows, el) {
    if (!el) return;
    if (!rows || !rows.length) {
      el.innerHTML = '<p class="mk-empty">No active offers match.</p>';
      return;
    }
    el.innerHTML = rows
      .map(function (r) {
        return (
          '<div class="mk-row-item">' +
          '<strong>' +
          r.quantity +
          '× ' +
          escapeHtml(r.itemName) +
          '</strong><br/>' +
          r.priceUsdc +
          ' USDC total · ' +
          r.unitUsdc +
          '/u · gold ' +
          r.listPriceGold +
          '<br/>' +
          escapeHtml(r.sellerCity || '?') +
          ' · ' +
          escapeHtml(r.sellerName || '') +
          ' · <code>' +
          escapeHtml(r.listingId) +
          '</code></div>'
        );
      })
      .join('');
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function refreshHealth() {
    api('/market/health')
      .then(function (h) {
        setText('mk-health', 'Listings active ~ ' + h.active + ' / ' + h.listings);
        setText('mk-fee', 'Fee ' + h.feePercent + '%');
        setText('mk-pay-mode', 'Pay ' + (h.payMode || 'dev'));
      })
      .catch(function (e) {
        setText('mk-health', 'API offline: ' + e.message);
      });
  }

  function doSearch() {
    var q = ($('mk-q').value || '').trim();
    api('/market/search?q=' + encodeURIComponent(q) + '&limit=40')
      .then(function (data) {
        renderListings(data.results, $('mk-results'));
      })
      .catch(function (e) {
        $('mk-results').innerHTML = '<p class="mk-empty">' + escapeHtml(e.message) + '</p>';
      });
  }

  function askGrok() {
    var message = ($('mk-advisor').value || '').trim();
    if (!message) return;
    $('mk-advisor-out').textContent = '…';
    api('/market/advisor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message }),
    })
      .then(function (data) {
        var lines = [data.reply || ''];
        if (data.plan) {
          lines.push(
            '',
            'filled ' + data.plan.filledQty + '/' + data.plan.requestedQty,
            'total ' + data.plan.totalUsdc + ' USDC (fee ' + data.plan.feeUsdc + ')',
          );
          if (data.suggestedOrder) {
            $('mk-buy-q').value = data.suggestedOrder.q || '';
            if (data.suggestedOrder.qty) $('mk-qty').value = data.suggestedOrder.qty;
            if (data.suggestedOrder.maxUnitUsdc != null)
              $('mk-max').value = data.suggestedOrder.maxUnitUsdc;
          }
        }
        if (data.results) {
          renderListings(data.results, $('mk-results'));
        }
        $('mk-advisor-out').textContent = lines.join('\n');
      })
      .catch(function (e) {
        $('mk-advisor-out').textContent = e.message;
      });
  }

  function doQuote() {
    var q = ($('mk-buy-q').value || '').trim();
    var qty = Number($('mk-qty').value || 1);
    var maxUnitUsdc = Number($('mk-max').value);
    $('mk-checkout-out').textContent = 'Quoting…';
    api('/market/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: q, qty: qty, maxUnitUsdc: maxUnitUsdc, asset: 'USDC' }),
    })
      .then(function (data) {
        var p = data.plan;
        $('mk-checkout-out').textContent = JSON.stringify(p, null, 2);
      })
      .catch(function (e) {
        $('mk-checkout-out').textContent = e.message;
      });
  }

  function doOrderPay() {
    var w = wallet();
    if (!w || w.length < 32) {
      $('mk-checkout-out').textContent = 'Connect or paste a Solana wallet first.';
      return;
    }
    var q = ($('mk-buy-q').value || '').trim();
    var qty = Number($('mk-qty').value || 1);
    var maxUnitUsdc = Number($('mk-max').value);
    $('mk-checkout-out').textContent = 'Creating order…';
    api('/market/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        wallet: w,
        q: q,
        qty: qty,
        maxUnitUsdc: maxUnitUsdc,
        asset: 'USDC',
        delivery: 'pickup_desk',
        partialOk: true,
      }),
    })
      .then(function (data) {
        var order = data.order;
        var orderId = order && order.orderId;
        var mode = (order && order.payMode) || 'dev';
        if (mode === 'live') {
          $('mk-checkout-out').textContent =
            'Order reserved (LIVE).\n' +
            'Send ' +
            order.totalUsdc +
            ' USDC to treasury:\n' +
            (order.treasury || '(set MARKET_TREASURY_WALLET)') +
            '\nmemo: ' +
            order.payMemo +
            '\nThen paste tx signature and use Confirm Pay (ops).\n\n' +
            JSON.stringify(order, null, 2);
          return null;
        }
        $('mk-checkout-out').textContent =
          'Order ' + orderId + ' reserved. Paying (dev)…\n' + JSON.stringify(order, null, 2);
        return api('/market/orders/' + orderId + '/pay-dev', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wallet: w }),
        });
      })
      .then(function (paid) {
        if (!paid) return;
        $('mk-checkout-out').textContent =
          'PAID → delivery desk ready.\nEnter World with this wallet to receive items in bag.\n' +
          JSON.stringify(paid.order, null, 2);
        refreshDesk();
        refreshHealth();
        doSearch();
      })
      .catch(function (e) {
        $('mk-checkout-out').textContent = e.message;
      });
  }

  function refreshDesk() {
    var w = wallet();
    if (!w) {
      $('mk-desk').innerHTML = '<p class="mk-empty">Set wallet to view claims.</p>';
      return;
    }
    api('/market/desk/' + encodeURIComponent(w))
      .then(function (data) {
        var claims = data.claims || [];
        if (!claims.length) {
          $('mk-desk').innerHTML = '<p class="mk-empty">No pending claims for this wallet.</p>';
          return;
        }
        $('mk-desk').innerHTML = claims
          .map(function (c) {
            return (
              '<div class="mk-row-item"><strong>' +
              c.quantity +
              '× ' +
              escapeHtml(c.itemName) +
              '</strong> · claim <code>' +
              escapeHtml(c.claimId) +
              '</code><br/>order ' +
              escapeHtml(c.orderId) +
              ' · ' +
              escapeHtml(c.delivery) +
              '</div>'
            );
          })
          .join('');
      })
      .catch(function (e) {
        $('mk-desk').innerHTML = '<p class="mk-empty">' + escapeHtml(e.message) + '</p>';
      });
  }

  async function connectPhantom() {
    var provider =
      (window.phantom && window.phantom.solana) || window.solana;
    if (!provider || !provider.isPhantom) {
      alert('Install Phantom (mobile app or extension).');
      window.open('https://phantom.app/download', '_blank');
      return;
    }
    try {
      var res = await provider.connect();
      var pk = res.publicKey ? res.publicKey.toString() : provider.publicKey && provider.publicKey.toString();
      if (pk) {
        $('mk-wallet').value = pk;
        refreshDesk();
      }
    } catch (e) {
      alert(e.message || 'Wallet connect cancelled');
    }
  }

  // Deep-link query ?q=merien
  try {
    var params = new URLSearchParams(location.search);
    if (params.get('q')) $('mk-q').value = params.get('q');
  } catch (_) {}

  $('mk-play').href = PLAY;
  $('mk-search-btn').addEventListener('click', doSearch);
  $('mk-q').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') doSearch();
  });
  $('mk-advisor-btn').addEventListener('click', askGrok);
  $('mk-quote-btn').addEventListener('click', doQuote);
  $('mk-order-btn').addEventListener('click', doOrderPay);
  $('mk-desk-btn').addEventListener('click', refreshDesk);
  $('mk-connect').addEventListener('click', connectPhantom);

  refreshHealth();
  doSearch();
})();
