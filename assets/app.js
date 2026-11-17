(function () {
  // Theme toggle. Storage may be unavailable, so every access is guarded.
  var root = document.documentElement;
  function stored() { try { return localStorage.getItem('theme'); } catch (e) { return null; } }
  function save(v) { try { localStorage.setItem('theme', v); } catch (e) {} }
  var s = stored();
  if (s === 'light' || s === 'dark') root.setAttribute('data-theme', s);
  function current() {
    var t = root.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  var btn = document.getElementById('theme');
  function label() { if (btn) btn.textContent = current() === 'dark' ? 'Light mode' : 'Dark mode'; }
  if (btn) {
    label();
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next); save(next); label();
    });
  }

  var box = document.querySelector('[data-replay]');
  if (!box) return;
  var data = JSON.parse(document.getElementById('replay-data').textContent);
  var out = box.querySelector('.out');

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function pill(ok) { return ok ? '<span class="pill pass">matches expected</span>' : '<span class="pill fail">differs from expected</span>'; }
  function dl(pairs) {
    return '<dl>' + pairs.map(function (p) { return '<dt>' + esc(p[0]) + '</dt><dd>' + p[1] + '</dd>'; }).join('') + '</dl>';
  }
  function options(sel, items, labelFn) {
    sel.innerHTML = items.map(function (it, i) { return '<option value="' + i + '">' + esc(labelFn(it)) + '</option>'; }).join('');
  }
  function tabs(container, names, onPick) {
    container.innerHTML = names.map(function (n, i) {
      return '<button type="button" aria-pressed="' + (i === 0) + '" data-i="' + i + '">' + esc(n[1]) + '</button>';
    }).join('');
    container.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      container.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
      onPick(+b.getAttribute('data-i'));
    });
  }

  var kind = box.getAttribute('data-replay');

  if (kind === 'ihm') {
    var suites = data.suites, sel = box.querySelector('select'), tabBox = box.querySelector('.tabs'), cur = 0;
    function list() { return data.rows.filter(function (r) { return r.suite === suites[cur][0]; }); }
    function show() {
      var r = list()[+sel.value];
      out.innerHTML = dl([
        ['Case', esc(r.case_id) + ' — ' + esc(r.what_it_tests)],
        ['Expected', esc(r.expected)],
        ['What the system did', esc(r.actual)],
        ['Detail logged', r.detail ? '<code>' + esc(r.detail) + '</code>' : '<span class="muted">—</span>'],
        ['Result', pill(r.passed)]
      ]) + '<p class="small muted" style="margin-top:10px">Run ' + esc(r.run_id) + ', ' + esc(r.run_at) + ' (UTC). Source: ' + esc(r.file) + '</p>';
    }
    tabs(tabBox, suites, function (i) { cur = i; options(sel, list(), function (r) { return r.case_id + ' — ' + r.what_it_tests; }); show(); });
    options(sel, list(), function (r) { return r.case_id + ' — ' + r.what_it_tests; });
    sel.addEventListener('change', show); show();
  }

  if (kind === 'slider') {
    var range = box.querySelector('input[type=range]'), lab = box.querySelector('.daylbl');
    range.min = 0; range.max = data.steps.length - 1; range.value = 0;
    function render() {
      var i = +range.value, step = data.steps[i];
      lab.textContent = step;
      var rows = data.rows.filter(function (r) { return r.step === step; });
      var lc = data.cols.filter(function (c) { return c[2] === 'lvl'; })[0], key = data.cols[0][0];
      var hits = rows.filter(function (r) { return ['high', 'urgent', 'red', 'yellow'].indexOf(String(r[lc[0]])) >= 0; });
      var sum = '<p style="margin:10px 0 8px"><strong>' + (hits.length ? data.sumLabel + ': ' + hits.map(function (r) { return esc(r[key].split(' ')[0]) + ' (' + esc(r[lc[0]]) + ')'; }).join(', ') : data.noneLabel) + '</strong></p>';
      out.innerHTML = sum + '<div class="tbl"><table class="stack"><thead><tr>' + data.cols.map(function (c) { return '<th>' + esc(c[1]) + '</th>'; }).join('') +
        '</tr></thead><tbody>' + rows.map(function (r) {
          return '<tr>' + data.cols.map(function (c) {
            var v = r[c[0]];
            var dlab = ' data-label="' + esc(c[1]) + '"';
            if (c[2] === 'lvl') return '<td' + dlab + '><span class="lvl ' + esc(String(v).split(' ')[0]) + '">' + esc(v) + '</span></td>';
            return '<td' + dlab + '>' + esc(v) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table></div>' + (data.note ? '<p class="small muted">' + esc(data.note) + '</p>' : '');
    }
    range.addEventListener('input', render); render();
  }

  var NAMES = { draft_review: 'draft for human review', drug_safety: 'Drug Safety queue', senior_mi: 'senior MI reviewer', mi_human: 'MI human queue',
    quality: 'Quality queue', product_information: 'product information', product_complaint: 'product complaint', adverse_event: 'possible adverse event',
    off_label: 'off-label', non_medical: 'non-medical', unclassified: 'unclassified (invalid AI output)' };
  function hn(v) { return esc(NAMES[v] || String(v).replace(/_/g, ' ')); }
  if (kind === 'pharma') {
    var sel2 = box.querySelector('select'), tb = box.querySelector('.tabs'), run = 0;
    options(sel2, data.cases, function (c) { return c.case_id + ' — ' + c.note; });
    function showP() {
      var c = data.cases[+sel2.value], res = data.results[data.runs[run][0]][c.case_id];
      out.innerHTML = dl([
        ['Enquiry', esc(c.enquiry_text) + (c.case_id === 'AE-02' ? ' <span class="small muted">(test set v2 wording; runs 1–2 used the earlier wording)</span>' : '')],
        ['From', esc(c.requester_type) + ', product ' + esc(c.product)],
        ['Expected', hn(res.expected_category) + ' → ' + hn(res.expected_queue)],
        ['What the system did', hn(res.ai_category) + ' → ' + hn(res.routed_queue)],
        ['AE flag', 'keyword rules: ' + (res.ae_rule ? 'yes' : 'no') + ' · Claude: ' + (res.ae_ai ? 'yes' : 'no')],
        ['Planted personal data masked', (+res.pii_seeded ? esc(res.pii_masked) + ' of ' + esc(res.pii_seeded) : 'none planted in this enquiry') + (res.contact_leak ? ' · contact details leaked' : ' · no contact details reached the AI')],
        ['Draft cites', res.cited_source ? esc(res.cited_source) + (res.citation_ok ? ' (valid)' : ' (invalid)') : '<span class="muted">no draft</span>'],
        ['Result', pill(res.case_pass) + (res.note ? ' <span class="small">' + esc(res.note) + '</span>' : '')]
      ]);
    }
    tabs(tb, data.runs, function (i) { run = i; showP(); });
    sel2.addEventListener('change', showP); showP();
  }

  if (kind === 'ka') {
    var sel3 = box.querySelector('select');
    options(sel3, data.rows, function (r) { return r.id + ' — ' + r.question; });
    function showK() {
      var r = data.rows[+sel3.value], pct = Math.min(100, r.score * 100), th = data.threshold * 100;
      out.innerHTML = dl([
        ['Expected', esc(r.expected)],
        ['Best match score', '<div style="position:relative;height:14px;max-width:320px;background:var(--bg);border:1px solid var(--line);border-radius:4px;margin:4px 0">' +
          '<div style="height:100%;width:' + pct + '%;background:' + (r.score >= data.threshold ? 'var(--rule)' : 'var(--muted)') + ';border-radius:3px"></div>' +
          '<div title="threshold" style="position:absolute;top:-4px;bottom:-4px;left:' + th + '%;border-left:2px dashed var(--fg)"></div></div>' +
          esc(r.score.toFixed(3)) + ' (threshold ' + data.threshold + ': ' + (r.score >= data.threshold ? 'sent to Claude' : 'answered “I don\'t know” without calling the AI') + ')'],
        ['Retrieved sections', esc(r.retrieved || 'none')],
        ['Status', esc(r.status)],
        ['Cited', esc(r.cited || '—')]
      ]);
    }
    sel3.addEventListener('change', showK); showK();
  }
})();
