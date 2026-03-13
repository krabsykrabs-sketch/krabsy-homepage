/* ── Krabsy — Shared Logic ── */

(function () {
  'use strict';

  const TOPIC_EMOJI = {
    irregular_verbs: '✏️',
    tenses: '⏰',
    vocabulary: '📚'
  };

  let i18n = {};
  let games = [];
  let currentLang = localStorage.getItem('krabsy-lang') || 'de';

  /* ── Bootstrap ── */
  async function init() {
    const [i18nData, gamesData] = await Promise.all([
      fetch('i18n.json').then(r => r.json()),
      fetch('games.json').then(r => r.json())
    ]);
    i18n = i18nData;
    games = gamesData.games;

    applyLang(currentLang);
    setupLangToggle();

    const isGamePage = document.body.dataset.page === 'game';
    if (isGamePage) {
      initGamePage();
    }

    renderGrid(document.querySelector('.game-grid'), isGamePage);
  }

  /* ── Language ── */
  function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem('krabsy-lang', lang);
    document.documentElement.lang = lang;

    // Update toggle buttons
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.lang === lang);
    });

    // Update all translatable elements
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      var key = el.dataset.i18n;
      if (i18n[lang] && i18n[lang][key]) {
        el.textContent = i18n[lang][key];
      }
    });

    // Update page title + meta
    var titleEl = document.querySelector('title');
    var metaDesc = document.querySelector('meta[name="description"]');
    var isGamePage = document.body.dataset.page === 'game';

    if (isGamePage) {
      var gameId = new URLSearchParams(window.location.search).get('id');
      var game = games.find(function (g) { return g.id === gameId; });
      if (game) {
        var gameTitle = lang === 'de' ? game.title_de : game.title_es;
        titleEl.textContent = gameTitle + ' — Krabsy';
        document.querySelector('.game-title').textContent = gameTitle;
      }
    } else {
      if (i18n[lang]) {
        titleEl.textContent = i18n[lang].meta_title;
        if (metaDesc) metaDesc.content = i18n[lang].meta_description;
      }
    }

    // Re-render grids to update card text
    document.querySelectorAll('.game-grid').forEach(function (grid) {
      renderGrid(grid, isGamePage);
    });
  }

  function setupLangToggle() {
    document.querySelectorAll('.lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        applyLang(btn.dataset.lang);
      });
    });
  }

  /* ── Game Grid ── */
  function renderGrid(container, isGamePage) {
    if (!container) return;
    container.innerHTML = '';

    var currentGameId = null;
    if (isGamePage) {
      currentGameId = new URLSearchParams(window.location.search).get('id');
    }

    games.forEach(function (game) {
      var card = document.createElement('div');
      card.className = 'game-card';

      var title = currentLang === 'de' ? game.title_de : game.title_es;
      var desc = currentLang === 'de' ? game.description_de : game.description_es;

      if (game.status === 'coming_soon') {
        card.classList.add('coming-soon');
        var emoji = TOPIC_EMOJI[game.topic] || '🎮';
        var comingSoonText = i18n[currentLang] ? i18n[currentLang].coming_soon : 'Coming soon';
        card.innerHTML =
          '<div class="card-placeholder topic-' + game.topic + '">' +
            '<span class="card-placeholder-emoji">' + emoji + '</span>' +
            '<span class="card-placeholder-title">' + title + '</span>' +
            '<span class="card-placeholder-badge">' + comingSoonText + '</span>' +
          '</div>';
      } else {
        // Active game card
        if (game.thumbnail) {
          card.innerHTML =
            '<img class="card-thumb" src="' + game.thumbnail + '" alt="' + title + '" loading="lazy" onerror="this.parentElement.querySelector(\'.card-placeholder\') || krabsyFallback(this, \'' + game.topic + '\', \'' + escapeAttr(title) + '\')">' +
            '<div class="card-overlay">' +
              '<div class="card-overlay-title">' + title + '</div>' +
              '<div class="card-overlay-desc">' + desc + '</div>' +
            '</div>';
        } else {
          var emoji2 = TOPIC_EMOJI[game.topic] || '🎮';
          card.innerHTML =
            '<div class="card-placeholder topic-' + game.topic + '">' +
              '<span class="card-placeholder-emoji">' + emoji2 + '</span>' +
              '<span class="card-placeholder-title">' + title + '</span>' +
            '</div>';
        }

        // Highlight current game on game page
        if (isGamePage && game.id === currentGameId) {
          card.style.outline = '3px solid var(--coral)';
          card.style.outlineOffset = '-3px';
        }

        card.addEventListener('click', function () {
          window.location.href = 'game.html?id=' + game.id;
        });
      }

      container.appendChild(card);
    });
  }

  /* ── Thumbnail fallback ── */
  window.krabsyFallback = function (img, topic, title) {
    var emoji = TOPIC_EMOJI[topic] || '🎮';
    var placeholder = document.createElement('div');
    placeholder.className = 'card-placeholder topic-' + topic;
    placeholder.innerHTML =
      '<span class="card-placeholder-emoji">' + emoji + '</span>' +
      '<span class="card-placeholder-title">' + title + '</span>';
    img.replaceWith(placeholder);
  };

  function escapeAttr(s) {
    return s.replace(/'/g, "\\'").replace(/"/g, '&quot;');
  }

  /* ── Game Page ── */
  function initGamePage() {
    var gameId = new URLSearchParams(window.location.search).get('id');
    var game = games.find(function (g) { return g.id === gameId; });

    if (!game || !game.file) {
      window.location.href = 'index.html';
      return;
    }

    var title = currentLang === 'de' ? game.title_de : game.title_es;
    document.querySelector('.game-title').textContent = title;

    var iframe = document.querySelector('.game-iframe-wrap iframe');
    iframe.src = game.file;
  }

  /* ── Start ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
