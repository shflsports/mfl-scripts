(function () {
  'use strict';

  /* ─────────────────────────────────────────────
     CONFIG — update these if anything changes
  ───────────────────────────────────────────── */
  var CFG = {
    league:      '56086',
    host:        'www42.myfantasyleague.com',
    year:        '2025',
    commishId:   '0011',
    deadlineDay: 0,      // Sunday
    deadlineHour: 13,    // 1 PM ET
    multiplier:  0.5,
    qbPos:       ['QB'],
    hbPos:       ['RB', 'WR', 'TE'],
    idpPos:      ['DL', 'LB', 'DB', 'DE', 'DT', 'CB', 'S', 'SS', 'FS'],
    fscoreadjUrl: 'https://www42.myfantasyleague.com/2025/csetup?L=56086&C=FSCOREADJ'
  };

  /* ─────────────────────────────────────────────
     READ MFL PAGE GLOBALS
     MFL injects: franchise_id, league_id, year
     into every league page as JS globals.
  ───────────────────────────────────────────── */
  var PAGE = {
    franchiseId: (typeof franchise_id !== 'undefined') ? String(franchise_id).padStart(4, '0') : null,
    leagueId:    (typeof league_id    !== 'undefined') ? String(league_id) : CFG.league,
    year:        (typeof year         !== 'undefined') ? String(year)       : CFG.year
  };

  var isCommish = PAGE.franchiseId === CFG.commishId;
  var currentWeek = getWeek();

  /* ─────────────────────────────────────────────
     STORAGE KEYS  (localStorage — same domain)
  ───────────────────────────────────────────── */
  function subKey(franchiseId, week) {
    return 'mfl_backup_' + CFG.league + '_wk' + week + '_' + franchiseId;
  }
  function allSubKeys(week) {
    var keys = [], prefix = 'mfl_backup_' + CFG.league + '_wk' + week + '_';
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf(prefix) === 0) keys.push(k);
    }
    return keys;
  }
  function saveSubmission(data) {
    localStorage.setItem(subKey(data.franchiseId, data.week), JSON.stringify(data));
  }
  function loadSubmission(franchiseId, week) {
    try { return JSON.parse(localStorage.getItem(subKey(franchiseId, week))); } catch(e) { return null; }
  }
  function loadAllSubmissions(week) {
    var out = {};
    allSubKeys(week).forEach(function(k) {
      try { var d = JSON.parse(localStorage.getItem(k)); if (d) out[d.franchiseId] = d; } catch(e) {}
    });
    return out;
  }

  /* ─────────────────────────────────────────────
     HELPERS
  ───────────────────────────────────────────── */
  function getWeek() {
    var start = new Date('2025-09-04');
    var diff  = Math.max(0, Math.floor((Date.now() - start) / (7 * 86400000)));
    return Math.min(18, diff + 1);
  }
  function isDeadlinePassed() {
    var now = new Date();
    // Approximate ET offset (not accounting for DST precisely — close enough)
    var etHour = (now.getUTCHours() - 4 + 24) % 24;
    return now.getUTCDay() === CFG.deadlineDay && etHour >= CFG.deadlineHour;
  }
  function apiUrl(type, extra) {
    var base = 'https://' + CFG.host + '/' + PAGE.year + '/export?TYPE=' + type +
               '&L=' + CFG.league + '&JSON=1';
    return extra ? base + '&' + extra : base;
  }
  function fetchJson(url) {
    return fetch(url, { credentials: 'include' }).then(function(r) { return r.json(); });
  }
  function fmtPts(v) {
    if (v === null || v === undefined) return '—';
    return parseFloat(v).toFixed(1);
  }
  function posFilter(pos, list) {
    return list.indexOf((pos || '').toUpperCase()) !== -1;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  /* ─────────────────────────────────────────────
     CSS  (injected once)
  ───────────────────────────────────────────── */
  var CSS = [
    '#mfl-backup-wrap *{box-sizing:border-box;margin:0;padding:0}',
    '#mfl-backup-wrap{font-family:Arial,sans-serif;font-size:13px;color:#222;max-width:860px;margin:12px auto}',
    '.mbk-card{background:#fff;border:1px solid #ddd;border-radius:6px;padding:16px;margin-bottom:12px}',
    '.mbk-title{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#666;margin-bottom:12px}',
    '.mbk-slot{border:1px solid #e2e2e2;border-radius:6px;padding:12px;margin-bottom:10px;background:#fafafa}',
    '.mbk-slot-hdr{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
    '.mbk-badge{display:inline-flex;align-items:center;justify-content:center;padding:2px 9px;border-radius:99px;font-size:10px;font-weight:700}',
    '.mbk-qb{background:#dbeafe;color:#1e40af}',
    '.mbk-hb{background:#dcfce7;color:#166534}',
    '.mbk-idp{background:#ede9fe;color:#5b21b6}',
    '.mbk-slot-name{font-weight:600;font-size:13px}',
    '.mbk-slot-desc{font-size:11px;color:#888}',
    '.mbk-field label{font-size:11px;color:#666;display:block;margin-bottom:3px}',
    '.mbk-field select{width:100%;padding:7px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;background:#fff}',
    '.mbk-btn{display:block;width:100%;padding:9px;background:#185FA5;color:#fff;border:none;border-radius:5px;font-size:14px;font-weight:600;cursor:pointer;margin-top:4px}',
    '.mbk-btn:hover{background:#0c447c}',
    '.mbk-btn:disabled{background:#bbb;cursor:not-allowed}',
    '.mbk-alert{border-radius:4px;padding:9px 12px;font-size:12px;margin-bottom:10px;display:flex;align-items:flex-start;gap:7px}',
    '.mbk-info{background:#dbeafe;color:#1e3a5f;border:1px solid #93c5fd}',
    '.mbk-success{background:#dcfce7;color:#14532d;border:1px solid #86efac}',
    '.mbk-warn{background:#fef9c3;color:#713f12;border:1px solid #fde047}',
    '.mbk-err{background:#fee2e2;color:#7f1d1d;border:1px solid #fca5a5}',
    '.mbk-deadline{display:flex;align-items:center;gap:8px;background:#f3f4f6;border-radius:4px;padding:8px 12px;font-size:12px;color:#555;margin-bottom:12px}',
    '.mbk-open{color:#1d4ed8;font-size:11px;font-weight:600;text-decoration:none;margin-left:auto;white-space:nowrap}',
    '.mbk-tabs{display:flex;border-bottom:2px solid #e2e2e2;margin-bottom:14px}',
    '.mbk-tab{padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:none;color:#666;border-bottom:2px solid transparent;margin-bottom:-2px}',
    '.mbk-tab.mbk-active{color:#185FA5;border-bottom-color:#185FA5}',
    '.mbk-panel{display:none}.mbk-tab-active-panel{display:block}',
    '.mbk-tbl{width:100%;border-collapse:collapse;font-size:12px}',
    '.mbk-tbl th{background:#f3f4f6;padding:6px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#555;border-bottom:1px solid #ddd}',
    '.mbk-tbl td{padding:7px 10px;border-bottom:1px solid #f0f0f0;vertical-align:middle}',
    '.mbk-tbl tr:last-child td{border-bottom:none}',
    '.mbk-tbl tr:hover td{background:#f9fafb}',
    '.mbk-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}',
    '.mbk-stat{background:#f3f4f6;border-radius:5px;padding:10px 12px}',
    '.mbk-stat-lbl{font-size:10px;color:#666;margin-bottom:3px}',
    '.mbk-stat-val{font-size:20px;font-weight:700;color:#222}',
    '.mbk-qual{color:#16a34a;font-weight:700}',
    '.mbk-zero{color:#b91c1c;font-weight:700}',
    '.mbk-muted{color:#9ca3af}',
    '.mbk-xml{background:#1e1e1e;color:#d4d4d4;border-radius:5px;padding:14px;font-family:monospace;font-size:11px;white-space:pre;overflow-x:auto;line-height:1.7;margin-bottom:10px}',
    '.mbk-row-done{background:#dcfce7!important;color:#166534}',
    '.mbk-row-pend{background:#fef9c3!important;color:#854d0e}',
    '.mbk-hdr-bar{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
    '.mbk-week-lbl{font-size:16px;font-weight:700}',
    '.mbk-copy{padding:4px 10px;font-size:11px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer}',
    '.mbk-steps{font-size:12px;color:#555;padding-left:1.3rem;line-height:2.1}',
    '.mbk-open-btn{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:#185FA5;color:#fff;border:none;border-radius:4px;font-size:12px;font-weight:600;cursor:pointer;text-decoration:none}',
    '.mbk-open-btn:hover{background:#0c447c}',
    '.mbk-spinner{display:inline-block;width:12px;height:12px;border:2px solid #93c5fd;border-top-color:#185FA5;border-radius:50%;animation:mbk-spin .7s linear infinite;flex-shrink:0}',
    '@keyframes mbk-spin{to{transform:rotate(360deg)}}',
    '.mbk-empty{text-align:center;padding:24px;color:#9ca3af;font-size:13px}',
    '.mbk-note{font-size:11px;color:#9ca3af;margin-top:6px}'
  ].join('\n');

  var styleTag = document.createElement('style');
  styleTag.textContent = CSS;
  document.head.appendChild(styleTag);

  /* ─────────────────────────────────────────────
     ROOT CONTAINER — injected into current page
  ───────────────────────────────────────────── */
  var wrap = document.createElement('div');
  wrap.id = 'mfl-backup-wrap';
  // Insert after the MFL page header / before main content
  var target = document.querySelector('#container-wrap') ||
               document.querySelector('.content-wrap') ||
               document.body;
  target.insertBefore(wrap, target.firstChild);

  /* ─────────────────────────────────────────────
     ALERT HELPER
  ───────────────────────────────────────────── */
  function showAlert(containerId, msg, type, autoClear) {
    var c = document.getElementById(containerId);
    if (!c) return;
    c.innerHTML = '<div class="mbk-alert mbk-' + (type || 'info') + '">' + msg + '</div>';
    if (autoClear) setTimeout(function() { if(c) c.innerHTML = ''; }, autoClear);
  }

  /* ─────────────────────────────────────────────
     OWNER VIEW
  ───────────────────────────────────────────── */
  function renderOwnerView() {
    var fid = PAGE.franchiseId;
    var wk  = currentWeek;
    var locked = isDeadlinePassed();

    wrap.innerHTML = '';

    // Header bar
    var hdr = el('div', 'mbk-card');
    var hdrBar = el('div', 'mbk-hdr-bar');
    var weekLbl = el('div', 'mbk-week-lbl', '&#127944; Week ' + wk + ' backup players');
    hdrBar.appendChild(weekLbl);
    if (isCommish) {
      var swBtn = el('button', '', 'Switch to commissioner view');
      swBtn.style.cssText = 'font-size:11px;padding:4px 10px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer';
      swBtn.onclick = renderCommishView;
      hdrBar.appendChild(swBtn);
    }
    hdr.appendChild(hdrBar);

    // Deadline bar
    var dl = el('div', 'mbk-deadline');
    dl.innerHTML = '&#128337; Deadline: <strong>Sunday 1:00 PM ET</strong>';
    var dlStatus = el('span', 'mbk-open');
    dlStatus.innerHTML = locked
      ? '<span style="color:#b91c1c">&#128274; Closed</span>'
      : '<span style="color:#16a34a">&#9989; Open</span>';
    dl.appendChild(dlStatus);
    hdr.appendChild(dl);

    wrap.appendChild(hdr);

    // Alert container
    var alertBox = el('div', '');
    alertBox.id = 'mbk-owner-alert';
    wrap.appendChild(alertBox);

    // Roster loading state
    var formCard = el('div', 'mbk-card');
    formCard.innerHTML = '<div class="mbk-title">Select your backup players</div>';
    var slotsDiv = el('div', '');
    slotsDiv.id = 'mbk-slots';
    slotsDiv.innerHTML = '<div class="mbk-alert mbk-info"><span class="mbk-spinner"></span>&nbsp;Loading your roster…</div>';
    formCard.appendChild(slotsDiv);
    wrap.appendChild(formCard);

    // Fetch roster then render slots
    fetchJson(apiUrl('rosters', 'FRANCHISE=' + fid))
      .then(function(data) {
        var franchises = [].concat((data.rosters || {}).franchise || []);
        var mine = franchises.find(function(f) { return String(f.id) === String(fid); }) || {};
        var players = [].concat((mine.player || []));
        renderSlots(slotsDiv, players, fid, wk, locked, formCard);
      })
      .catch(function() {
        slotsDiv.innerHTML = '<div class="mbk-alert mbk-err">Could not load your roster. Make sure you are logged in to MFL.</div>';
      });
  }

  function renderSlots(container, players, fid, wk, locked, parentCard) {
    var slots = [
      { key:'qb',  label:'Alt QB',  desc:'Quarterback on your roster',       filter: function(p){ return posFilter(p.position, CFG.qbPos);  } },
      { key:'hb',  label:'Alt HB',  desc:'RB, WR or TE on your roster',      filter: function(p){ return posFilter(p.position, CFG.hbPos);  } },
      { key:'idp', label:'Alt IDP', desc:'DL, LB or DB on your roster',      filter: function(p){ return posFilter(p.position, CFG.idpPos); } }
    ];

    var saved = loadSubmission(fid, wk) || {};
    container.innerHTML = '';

    slots.forEach(function(slot) {
      var eligible = players.filter(slot.filter);
      var div = el('div', 'mbk-slot');

      var hdr = el('div', 'mbk-slot-hdr');
      hdr.innerHTML = '<span class="mbk-badge mbk-' + slot.key + '">' + slot.label + '</span>' +
        '<div><div class="mbk-slot-name">' + slot.label + '</div>' +
        '<div class="mbk-slot-desc">' + slot.desc + '</div></div>';
      div.appendChild(hdr);

      var field = el('div', 'mbk-field');
      var lbl = el('label', '', 'Select player');
      lbl.setAttribute('for', 'mbk-sel-' + slot.key);
      field.appendChild(lbl);

      var sel = document.createElement('select');
      sel.id = 'mbk-sel-' + slot.key;
      sel.disabled = locked;
      var blank = document.createElement('option');
      blank.value = ''; blank.textContent = eligible.length ? 'Choose…' : 'No eligible players';
      blank.disabled = true; blank.selected = !saved[slot.key + 'Id'];
      sel.appendChild(blank);

      eligible.forEach(function(p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.name || p.id) + ' (' + (p.position || '?') + ')';
        if (saved[slot.key + 'Id'] && String(p.id) === String(saved[slot.key + 'Id'])) opt.selected = true;
        sel.appendChild(opt);
      });
      field.appendChild(sel);
      div.appendChild(field);
      container.appendChild(div);
    });

    // Saved note
    if (saved.submittedAt) {
      container.appendChild(el('div', 'mbk-alert mbk-success', '&#9989; Your week ' + wk + ' backups were saved on ' + new Date(saved.submittedAt).toLocaleString() + '.'));
    }

    // Submit button
    if (!locked) {
      var btn = el('button', 'mbk-btn', 'Save backup players');
      btn.onclick = function() {
        var qbSel  = document.getElementById('mbk-sel-qb');
        var hbSel  = document.getElementById('mbk-sel-hb');
        var idpSel = document.getElementById('mbk-sel-idp');
        if (!qbSel.value || !hbSel.value || !idpSel.value) {
          showAlert('mbk-owner-alert', 'Please select all three backup players.', 'warn', 3000); return;
        }
        var payload = {
          franchiseId:  fid,
          week:         wk,
          submittedAt:  new Date().toISOString(),
          qbId:   qbSel.value,  qbName:  qbSel.options[qbSel.selectedIndex].text,
          hbId:   hbSel.value,  hbName:  hbSel.options[hbSel.selectedIndex].text,
          idpId:  idpSel.value, idpName: idpSel.options[idpSel.selectedIndex].text
        };
        saveSubmission(payload);
        showAlert('mbk-owner-alert', '&#9989; Backup players saved!', 'success', 4000);
      };
      parentCard.appendChild(btn);
    } else {
      parentCard.appendChild(el('div', 'mbk-alert mbk-warn', '&#128274; The deadline has passed. Submissions are closed for week ' + wk + '.'));
    }

    parentCard.appendChild(el('p', 'mbk-note', 'Credentials stay within MFL — nothing is sent to external servers.'));
  }

  /* ─────────────────────────────────────────────
     COMMISSIONER VIEW
  ───────────────────────────────────────────── */
  function renderCommishView() {
    wrap.innerHTML = '';

    var hdr = el('div', 'mbk-card');
    var hdrBar = el('div', 'mbk-hdr-bar');

    var leftSide = el('div', '');
    leftSide.innerHTML = '<div class="mbk-week-lbl">&#128203; Week <span id="mbk-wk-lbl">' + currentWeek + '</span> adjustments</div>' +
      '<div style="font-size:11px;color:#888;margin-top:2px">League ' + CFG.league + ' · Backup rule: starter = 0 pts → backup × ' + CFG.multiplier + '</div>';

    var rightSide = el('div', '');
    rightSide.style.display = 'flex';
    rightSide.style.gap = '8px';
    rightSide.style.alignItems = 'center';

    var weekInput = document.createElement('input');
    weekInput.type = 'number'; weekInput.min = 1; weekInput.max = 18;
    weekInput.value = currentWeek;
    weekInput.style.cssText = 'width:56px;padding:5px 7px;border:1px solid #ccc;border-radius:4px;font-size:13px';

    var runBtn = el('button', 'mbk-btn', 'Run');
    runBtn.style.cssText = 'width:auto;padding:6px 14px;font-size:12px;margin-top:0';
    runBtn.onclick = function() {
      var w = parseInt(weekInput.value);
      if (!w || w < 1 || w > 18) return;
      currentWeek = w;
      document.getElementById('mbk-wk-lbl').textContent = w;
      runCommishCalc(w);
    };

    var ownerBtn = el('button', '', 'Owner view');
    ownerBtn.style.cssText = 'font-size:11px;padding:5px 10px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer';
    ownerBtn.onclick = renderOwnerView;

    rightSide.appendChild(el('label', '', '<span style="font-size:11px;color:#666">Week</span>'));
    rightSide.appendChild(weekInput);
    rightSide.appendChild(runBtn);
    rightSide.appendChild(ownerBtn);

    hdrBar.appendChild(leftSide);
    hdrBar.appendChild(rightSide);
    hdr.appendChild(hdrBar);
    wrap.appendChild(hdr);

    // Stat summary cards
    var statGrid = el('div', 'mbk-stat-grid');
    statGrid.innerHTML =
      '<div class="mbk-stat"><div class="mbk-stat-lbl">Teams checked</div><div class="mbk-stat-val" id="mbk-s-teams">—</div></div>' +
      '<div class="mbk-stat"><div class="mbk-stat-lbl">Qualified</div><div class="mbk-stat-val mbk-qual" id="mbk-s-qual">—</div></div>' +
      '<div class="mbk-stat"><div class="mbk-stat-lbl">No adjustment</div><div class="mbk-stat-val mbk-muted" id="mbk-s-none">—</div></div>' +
      '<div class="mbk-stat"><div class="mbk-stat-lbl">Total pts added</div><div class="mbk-stat-val" id="mbk-s-pts">—</div></div>';
    wrap.appendChild(statGrid);

    // Status bar
    var statusBar = el('div', '');
    statusBar.id = 'mbk-status';
    wrap.appendChild(statusBar);

    // Tabs
    var tabs = el('div', 'mbk-tabs');
    ['Results', 'XML import', 'All submissions'].forEach(function(name, i) {
      var t = el('button', 'mbk-tab' + (i === 0 ? ' mbk-active' : ''), name);
      t.onclick = function() {
        document.querySelectorAll('#mfl-backup-wrap .mbk-tab').forEach(function(x){ x.classList.remove('mbk-active'); });
        document.querySelectorAll('#mfl-backup-wrap .mbk-panel').forEach(function(x){ x.classList.remove('mbk-tab-active-panel'); });
        t.classList.add('mbk-active');
        document.getElementById('mbk-panel-' + i).classList.add('mbk-tab-active-panel');
      };
      tabs.appendChild(t);
    });
    wrap.appendChild(tabs);

    ['0','1','2'].forEach(function(i) {
      var p = el('div', 'mbk-panel' + (i === '0' ? ' mbk-tab-active-panel' : ''));
      p.id = 'mbk-panel-' + i;
      wrap.appendChild(p);
    });

    runCommishCalc(currentWeek);
  }

  function setStatus(html, type) {
    var el2 = document.getElementById('mbk-status');
    if (!el2) return;
    el2.innerHTML = html ? '<div class="mbk-alert mbk-' + (type || 'info') + '" style="margin-bottom:10px">' + html + '</div>' : '';
  }

  function runCommishCalc(wk) {
    setStatus('<span class="mbk-spinner"></span>&nbsp;Loading week ' + wk + ' submissions…');
    ['0','1','2'].forEach(function(i) {
      var p = document.getElementById('mbk-panel-' + i);
      if (p) p.innerHTML = '<div class="mbk-empty">Loading…</div>';
    });

    var subs = loadAllSubmissions(wk);
    var subList = Object.values(subs);

    if (!subList.length) {
      setStatus('No backup submissions found for week ' + wk + '.', 'warn');
      updateStats(0, 0, 0, 0);
      renderAllSubs(subs, wk);
      return;
    }

    // Collect all player IDs we need scores for
    var playerIds = [];
    subList.forEach(function(s) {
      if (s.qbId)  playerIds.push(s.qbId);
      if (s.hbId)  playerIds.push(s.hbId);
      if (s.idpId) playerIds.push(s.idpId);
    });
    var uniqueIds = playerIds.filter(function(v,i,a){ return a.indexOf(v) === i; });

    setStatus('<span class="mbk-spinner"></span>&nbsp;Fetching player scores for week ' + wk + '…');

    Promise.all([
      fetchJson(apiUrl('playerScores', 'W=' + wk + '&PLAYERS=' + uniqueIds.join(','))),
      fetchJson(apiUrl('weeklyResults', 'W=' + wk))
    ]).then(function(results) {
      var scoreMap   = buildScoreMap(results[0]);
      var starterMap = buildStarterMap(results[1], Object.keys(subs));
      var adjResults = calcAdjustments(subs, scoreMap, starterMap, wk);
      renderResults(adjResults);
      renderXml(adjResults, wk);
      renderAllSubs(subs, wk);
      var qual  = adjResults.filter(function(r){ return r.qualified; }).length;
      var none  = adjResults.filter(function(r){ return !r.qualified && r.starterPts !== null; }).length;
      var total = adjResults.filter(function(r){ return r.qualified; }).reduce(function(s,r){ return s + r.adjustment; }, 0);
      updateStats(new Set(adjResults.map(function(r){ return r.franchiseId; })).size, qual, none, total);
      setStatus('');
    }).catch(function(e) {
      setStatus('Error fetching scores: ' + e.message, 'err');
    });
  }

  function buildScoreMap(data) {
    var map = {};
    [].concat(((data.playerScores || {}).playerScore) || []).forEach(function(p) {
      map[String(p.id)] = { name: p.name || p.id, pts: parseFloat(p.score || 0) };
    });
    return map;
  }

  function buildStarterMap(data, franchiseIds) {
    var map = {};
    [].concat((data.weeklyResults || {}).matchup || []).forEach(function(m) {
      [].concat(m.franchise || []).forEach(function(f) {
        if (franchiseIds.indexOf(String(f.id)) === -1) return;
        var qbPts = 0, hbPts = 0, idpPts = 0, qbFound = false, hbFound = false, idpFound = false;
        [].concat(((f.players || {}).player) || []).forEach(function(p) {
          var pos = (p.starting_position || p.position || '').toUpperCase();
          var pts = parseFloat(p.score || 0);
          if (posFilter(pos, CFG.qbPos))  { qbPts  = Math.max(qbPts,  pts); qbFound  = true; }
          else if (posFilter(pos, CFG.hbPos))  { hbPts  = Math.max(hbPts,  pts); hbFound  = true; }
          else if (posFilter(pos, CFG.idpPos)) { idpPts = Math.max(idpPts, pts); idpFound = true; }
        });
        map[String(f.id)] = {
          qbPts:  qbFound  ? qbPts  : null,
          hbPts:  hbFound  ? hbPts  : null,
          idpPts: idpFound ? idpPts : null
        };
      });
    });
    return map;
  }

  function calcAdjustments(subs, scoreMap, starterMap, wk) {
    var rows = [];
    Object.entries(subs).forEach(function(entry) {
      var fid = entry[0], sub = entry[1];
      var starter = starterMap[fid] || { qbPts: null, hbPts: null, idpPts: null };
      [
        { slot:'QB',  backupId: sub.qbId,  backupName: sub.qbName,  starterPts: starter.qbPts  },
        { slot:'HB',  backupId: sub.hbId,  backupName: sub.hbName,  starterPts: starter.hbPts  },
        { slot:'IDP', backupId: sub.idpId, backupName: sub.idpName, starterPts: starter.idpPts }
      ].forEach(function(sl) {
        var bk = scoreMap[String(sl.backupId)] || null;
        var bkPts = bk ? bk.pts : null;
        var qualified = sl.starterPts !== null && sl.starterPts === 0 && bkPts !== null && bkPts > 0;
        var adjustment = qualified ? Math.round(bkPts * CFG.multiplier * 10) / 10 : 0;
        rows.push({
          franchiseId:  fid,
          teamName:     sub.teamName || fid,
          slot:         sl.slot,
          backupId:     sl.backupId,
          backupName:   (bk ? bk.name : null) || sl.backupName || sl.backupId,
          starterPts:   sl.starterPts,
          backupPts:    bkPts,
          qualified:    qualified,
          adjustment:   adjustment
        });
      });
    });
    return rows;
  }

  function renderResults(rows) {
    var panel = document.getElementById('mbk-panel-0');
    if (!panel) return;
    if (!rows.length) { panel.innerHTML = '<div class="mbk-empty">No results.</div>'; return; }

    var tbl = el('table', 'mbk-tbl');
    tbl.innerHTML = '<thead><tr><th>Team</th><th>Slot</th><th>Backup player</th><th>Starter pts</th><th>Backup pts</th><th>Adjustment</th></tr></thead>';
    var tbody = document.createElement('tbody');

    var lastFid = null;
    rows.forEach(function(r) {
      var tr = document.createElement('tr');
      var starterCell = r.starterPts === null ? '<span class="mbk-muted">—</span>'
        : r.starterPts === 0 ? '<span class="mbk-zero">0.0</span>'
        : fmtPts(r.starterPts);
      var backupCell  = r.backupPts  === null ? '<span class="mbk-muted">—</span>'
        : '<span class="' + (r.qualified ? 'mbk-qual' : '') + '">' + fmtPts(r.backupPts) + '</span>';
      var adjCell = r.qualified
        ? '<span style="background:#dcfce7;color:#166534;padding:2px 8px;border-radius:99px;font-weight:700;font-size:11px">+' + fmtPts(r.adjustment) + '</span>'
        : r.starterPts === null || r.backupPts === null
          ? '<span class="mbk-muted">no data</span>'
          : '<span class="mbk-muted">—</span>';
      tr.innerHTML =
        '<td style="font-weight:600">' + (r.franchiseId !== lastFid ? r.teamName : '') + '</td>' +
        '<td><span class="mbk-badge mbk-' + r.slot.toLowerCase() + '">' + r.slot + '</span></td>' +
        '<td>' + (r.backupName || '—') + '</td>' +
        '<td>' + starterCell + '</td>' +
        '<td>' + backupCell  + '</td>' +
        '<td>' + adjCell     + '</td>';
      lastFid = r.franchiseId;
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);

    var card = el('div', 'mbk-card');
    card.style.overflowX = 'auto';
    card.appendChild(tbl);
    panel.innerHTML = '';
    panel.appendChild(card);
  }

  function renderXml(rows, wk) {
    var panel = document.getElementById('mbk-panel-1');
    if (!panel) return;
    var qualified = rows.filter(function(r){ return r.qualified; });

    var xml;
    if (!qualified.length) {
      xml = '<!-- No qualified adjustments for week ' + wk + ' -->';
    } else {
      var grouped = {};
      qualified.forEach(function(r) {
        if (!grouped[r.franchiseId]) grouped[r.franchiseId] = { teamName: r.teamName, adjs: [] };
        grouped[r.franchiseId].adjs.push(r);
      });
      xml = '<scoreAdjustments>\n';
      Object.entries(grouped).forEach(function(entry) {
        var fid = entry[0], g = entry[1];
        var total = g.adjs.reduce(function(s,r){ return s + r.adjustment; }, 0);
        var note  = g.adjs.map(function(r){
          return r.slot + ' backup: ' + r.backupName + ' (' + fmtPts(r.backupPts) + ' \u00D7 0.5 = ' + fmtPts(r.adjustment) + ')';
        }).join('; ');
        xml += '  <franchise id="' + fid + '" score="' + fmtPts(total) + '" week="' + wk + '" description="Wk' + wk + ' backup adj: ' + note + '"/>\n';
      });
      xml += '</scoreAdjustments>';
    }

    panel.innerHTML = '';
    var card = el('div', 'mbk-card');

    var infoBar = el('div', 'mbk-alert mbk-info', '&#128203; Copy the XML below, then paste it into the <strong>DATA</strong> field on the MFL score adjustment page.');
    card.appendChild(infoBar);

    var toolbar = el('div', 'mbk-hdr-bar');
    toolbar.style.marginBottom = '6px';
    var copyBtn = el('button', 'mbk-copy', '&#128203; Copy XML');
    copyBtn.onclick = function() {
      navigator.clipboard.writeText(xml).then(function() {
        copyBtn.textContent = '\u2705 Copied!';
        setTimeout(function(){ copyBtn.innerHTML = '&#128203; Copy XML'; }, 2000);
      });
    };
    var openBtn = el('a', 'mbk-open-btn', '&#128279; Open MFL adjuster');
    openBtn.href = CFG.fscoreadjUrl;
    openBtn.target = '_blank';

    toolbar.appendChild(copyBtn);
    toolbar.appendChild(openBtn);
    card.appendChild(toolbar);

    var xmlBlock = el('div', 'mbk-xml', xml.replace(/</g,'&lt;').replace(/>/g,'&gt;'));
    card.appendChild(xmlBlock);

    var steps = el('ol', 'mbk-steps');
    steps.innerHTML = '<li>Click <strong>Open MFL adjuster</strong> above</li>' +
      '<li>Click <strong>Copy XML</strong> and paste into the DATA field</li>' +
      '<li>Set TYPE to <code>scoreAdjustments</code> and click Import</li>';
    card.appendChild(steps);
    panel.appendChild(card);
  }

  function renderAllSubs(subs, wk) {
    var panel = document.getElementById('mbk-panel-2');
    if (!panel) return;

    // Fetch all franchises to get team names for teams that haven't submitted
    fetchJson(apiUrl('league', '')).then(function(data) {
      var allFranchises = [].concat(((data.league || {}).franchises || {}).franchise || []);
      panel.innerHTML = '';
      var card = el('div', 'mbk-card');
      var tbl = el('table', 'mbk-tbl');
      tbl.innerHTML = '<thead><tr><th>Team</th><th>Alt QB</th><th>Alt HB</th><th>Alt IDP</th><th>Status</th><th>Submitted</th></tr></thead>';
      var tbody = document.createElement('tbody');

      allFranchises.forEach(function(f) {
        var sub = subs[String(f.id)];
        var tr = document.createElement('tr');
        tr.className = sub ? 'mbk-row-done' : 'mbk-row-pend';
        var submittedTime = sub ? new Date(sub.submittedAt).toLocaleString([], {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : '—';
        tr.innerHTML =
          '<td style="font-weight:600">' + (f.name || f.id) + '</td>' +
          '<td>' + (sub ? (sub.qbName  || '—').split(' (')[0] : '—') + '</td>' +
          '<td>' + (sub ? (sub.hbName  || '—').split(' (')[0] : '—') + '</td>' +
          '<td>' + (sub ? (sub.idpName || '—').split(' (')[0] : '—') + '</td>' +
          '<td><span style="font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;background:' +
            (sub ? '#dcfce7' : '#fef9c3') + ';color:' + (sub ? '#166534' : '#854d0e') + '">' +
            (sub ? 'Submitted' : 'Pending') + '</span></td>' +
          '<td style="color:#888">' + submittedTime + '</td>';
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      card.style.overflowX = 'auto';
      card.appendChild(tbl);
      panel.appendChild(card);
    }).catch(function() {
      // Fallback: just show submitted teams
      var sArr = Object.values(subs);
      panel.innerHTML = sArr.length
        ? sArr.map(function(s){ return '<div style="padding:6px 0;border-bottom:1px solid #eee">' + (s.teamName||s.franchiseId) + ' — submitted</div>'; }).join('')
        : '<div class="mbk-empty">No submissions yet.</div>';
    });
  }

  function updateStats(teams, qual, none, total) {
    var s = function(id, v) { var e = document.getElementById(id); if(e) e.textContent = v; };
    s('mbk-s-teams', teams || '0');
    s('mbk-s-qual',  qual  || '0');
    s('mbk-s-none',  none  || '0');
    s('mbk-s-pts',   qual  ? fmtPts(total) : '0');
  }

  /* ─────────────────────────────────────────────
     BOOT — decide which view to show
  ───────────────────────────────────────────── */
  if (!PAGE.franchiseId) {
    wrap.innerHTML = '<div class="mbk-card"><div class="mbk-alert mbk-warn">&#9888;&#65039; Please log in to your MFL account to use this tool.</div></div>';
  } else if (isCommish) {
    // Commissioner gets the adjustment view by default (with option to switch)
    renderCommishView();
  } else {
    renderOwnerView();
  }

})();
