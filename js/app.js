/* Sparkbench — the user interface: bench, block editor, code view, missions. */
(function () {
  const SB = window.SB;
  const $ = (s, r) => (r || document).querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const svg = $('#bench'), panel = $('#panel'), paletteEl = $('#palette'), progEl = $('#program');
  const pyEl = $('#py'), outEl = $('#out'), hintEl = $('#benchHint'), tourCard = $('#tourCard'), runBtn = $('#runBtn');

  /* ---------- saved state ---------- */
  const KEY = 'sparkbench.v1';
  let store = { mode: 'mission', mi: 0, done: {}, free: null, m: {} };
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw && raw.m && typeof raw.mi === 'number') store = Object.assign(store, raw);
  } catch (e) { /* storage may be blocked; the app still works */ }
  store.mi = clamp(store.mi | 0, 0, SB.MISSIONS.length - 1);
  let saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }, 300);
  }

  const mission = () => (store.mode === 'mission' ? SB.MISSIONS[store.mi] : null);
  function ws() {
    if (store.mode === 'free') return store.free || (store.free = { bench: { parts: [], wires: [] }, program: [], got: {} });
    const m = mission();
    return store.m[m.id] || (store.m[m.id] = { bench: SB.missionBench(m), program: [], got: {} });
  }

  /* ---------- simulator state ---------- */
  const hw = new SB.Hardware(() => ws().bench);
  let runner = null, running = false, mem = {}, lastSig = '';
  const shown = {}; // servo angles as drawn, eased toward their target
  let pending = null, pointer = null, gesture = null; // wiring in progress
  let tourOn = false, tourKey = null, soundOn = true;
  let benchDirty = true;
  const dirty = () => { benchDirty = true; };

  /* ---------- bench drawing ---------- */
  const WIRE_COLORS = ['#ffcf33', '#4aa8ff', '#ff8fd0', '#9be28c', '#ffffff', '#ff9d5c', '#c7a6ff', '#5fe3d6'];
  function wireColor(pin) {
    const net = SB.PINS[pin].net;
    if (net === 'GND') return '#20262d';
    if (net === '5V') return '#e5483d';
    return WIRE_COLORS[(Number(pin.slice(1)) + (pin[0] === 'A' ? 3 : 0)) % WIRE_COLORS.length];
  }
  function renderBench() {
    const b = ws().bench;
    let s = SB.drawBoard(hw);
    b.parts.forEach((p) => {
      const d = SB.PARTS[p.type], v = SB.view(b, hw, p), fl = SB.isFlipped(p);
      if (p.type === 'servo') v.shown = shown[p.id] || 0;
      s += `<g transform="translate(${p.x} ${p.y})" class="part" data-act="part" data-part="${p.id}">`;
      d.terms.forEach((t) => { const tx = SB.termX(p, t); s += `<line x1="${tx}" y1="${fl ? 0 : d.h}" x2="${tx}" y2="${fl ? -12 : d.h + 12}" class="leg"/>`; });
      s += `<rect width="${d.w}" height="${d.h}" rx="10" class="card"/>`;
      s += `<text x="${d.w / 2}" y="${fl ? d.h - 5 : 13}" text-anchor="middle" class="p-name">${esc(d.name(p))}</text>`;
      d.terms.forEach((t) => { s += `<text x="${SB.termX(p, t)}" y="${fl ? 11 : d.h - 4}" text-anchor="middle" class="p-term">${t.label}</text>`; });
      s += d.draw(p, v);
      if (store.mode === 'free') s += `<g data-act="delpart" data-part="${p.id}" class="del"><title>Remove part</title><circle cx="${d.w - 3}" cy="3" r="9"/><path d="M${d.w - 7} -1l8 8m0-8l-8 8"/></g>`;
      s += '</g>';
    });
    let around = 0;
    b.wires.forEach((w, i) => {
      const p = b.parts.find((p) => p.id === w.part);
      if (!p) return;
      const a = SB.termPos(p, w.term), c = SB.pinPos(w.pin), col = wireColor(w.pin), B = SB.BOARD;
      let path;
      if (a.dir === c.dir && (a.dir > 0 ? a.y < B.y : a.y > B.y + B.h)) {
        // The pin is on the far edge of the board: go around the side instead of across the board.
        const k = around++ % 4, left = (a.x + c.x) / 2 < B.x + B.w / 2;
        const xs = left ? B.x - 30 - k * 8 : B.x + B.w + 14 + k * 8;
        path = `M${a.x} ${a.y}V${a.y + a.dir * (7 + k * 4)}H${xs}V${c.y + c.dir * (27 + k * 5)}H${c.x}V${c.y}`;
      } else path = `M${a.x} ${a.y}C${a.x} ${a.y + a.dir * 44} ${c.x} ${c.y + c.dir * (56 + (i % 4) * 9)} ${c.x} ${c.y}`;
      s += `<g class="wire" data-act="wire" data-i="${i}"><title>Click to remove this wire</title><path d="${path}" class="w-out"/><path d="${path}" class="w-in" stroke="${col}"/><circle cx="${c.x}" cy="${c.y}" r="5" fill="${col}"/></g>`;
    });
    b.parts.forEach((p) => SB.PARTS[p.type].terms.forEach((t) => {
      const q = SB.termPos(p, t.id);
      const pend = pending && pending.kind === 'term' && pending.part === p.id && pending.term === t.id;
      const wired = b.wires.some((w) => w.part === p.id && w.term === t.id);
      s += `<g data-act="term" data-part="${p.id}" data-term="${t.id}" class="term${pend ? ' pend' : ''}${wired ? ' wired' : ''}"><circle cx="${q.x}" cy="${q.y}" r="13" fill="transparent"/><circle cx="${q.x}" cy="${q.y}" r="6" class="dot"/></g>`;
    }));
    Object.values(SB.PINS).forEach((p) => {
      const pend = pending && pending.kind === 'pin' && pending.pin === p.id;
      s += `<g data-act="pin" data-pin="${p.id}" class="pinhit${pend ? ' pend' : ''}"><title>${p.net === 'GND' ? 'GND' : p.id}</title><rect x="${p.x - 14}" y="${p.y - 16}" width="28" height="32" fill="transparent"/><rect class="ring" x="${p.x - 10.5}" y="${p.y - 10.5}" width="21" height="21" rx="4"/></g>`;
    });
    if (pending && pointer && gesture && gesture.type === 'wire') {
      const a = pending.kind === 'term' ? SB.termPos(b.parts.find((p) => p.id === pending.part), pending.term) : SB.pinPos(pending.pin);
      s += `<path class="rubber" d="M${a.x} ${a.y}L${pointer.x} ${pointer.y}"/>`;
    }
    if (tourOn) s += SB.drawTour(tourKey);
    svg.innerHTML = s;
    $('#tidyBtn').hidden = !b.wires.length;
    svg.classList.toggle('arm-pins', !!pending && pending.kind === 'term');
    svg.classList.toggle('arm-terms', !!pending && pending.kind === 'pin');
    hintEl.textContent = tourOn ? 'Click a number to learn about that part of the board.'
      : pending ? (pending.kind === 'term' ? 'Now click a pin on the board to finish the wire.' : 'Now click a leg on a part to finish the wire.')
      : b.parts.length ? 'Click a leg, then a board pin, to add a wire. Click a wire to remove it.'
      : store.mode === 'free' ? 'Add parts from the drawer below.' : 'No parts needed for this one. The board has its own light.';
  }

  /* ---------- bench interaction ---------- */
  function svgPt(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  }
  const endOf = (el) => (el.dataset.act === 'term' ? { kind: 'term', part: el.dataset.part, term: el.dataset.term } : { kind: 'pin', pin: el.dataset.pin });
  function link(a, b) {
    const t = a.kind === 'term' ? a : b, p = a.kind === 'pin' ? a : b, bench = ws().bench;
    bench.wires = bench.wires.filter((w) => !(w.part === t.part && w.term === t.term));
    bench.wires.push({ part: t.part, term: t.term, pin: p.pin });
    benchChanged();
  }
  function benchChanged() { save(); dirty(); refreshSteps(); }
  function applySlider(pt) {
    const g = gesture, p = ws().bench.parts.find((p) => p.id === g.part);
    if (!p) return;
    p.input.value = Math.round(g.min + clamp((pt.x - p.x - g.x0) / (g.x1 - g.x0), 0, 1) * (g.max - g.min));
    dirty();
  }

  svg.addEventListener('pointerdown', (e) => {
    if (e.button) return;
    const el = e.target.closest('[data-act]'), bench = ws().bench, pt = svgPt(e);
    if (!el) { pending = null; dirty(); return; }
    e.preventDefault();
    const act = el.dataset.act, part = el.dataset.part && bench.parts.find((p) => p.id === el.dataset.part);
    if (act === 'tour') { tourKey = el.dataset.k; showTour(); }
    else if (act === 'term' || act === 'pin') {
      const here = endOf(el);
      if (pending && pending.kind !== here.kind) { link(pending, here); pending = null; }
      else { pending = here; pointer = pt; gesture = { type: 'wire', moved: false, x0: e.clientX, y0: e.clientY }; }
    } else if (act === 'wire') { bench.wires.splice(Number(el.dataset.i), 1); pending = null; benchChanged(); }
    else if (act === 'press' && part) { part.input.pressed = true; gesture = { type: 'press', part: part.id }; }
    else if (act === 'slider' && part) {
      const d = el.dataset;
      gesture = { type: 'slider', part: part.id, x0: +d.x0, x1: +d.x1, min: +d.min, max: +d.max };
      applySlider(pt);
    } else if (act === 'delpart' && part) {
      bench.parts = bench.parts.filter((p) => p !== part);
      bench.wires = bench.wires.filter((w) => w.part !== part.id);
      pending = null; benchChanged();
    } else if (act === 'part' && part) { pending = null; gesture = { type: 'move', part: part.id, dx: pt.x - part.x, dy: pt.y - part.y }; }
    dirty();
  });
  window.addEventListener('pointermove', (e) => {
    if (!gesture) return;
    const pt = svgPt(e);
    if (gesture.type === 'wire') {
      if (Math.hypot(e.clientX - gesture.x0, e.clientY - gesture.y0) > 8) gesture.moved = true;
      pointer = pt; dirty();
    } else if (gesture.type === 'slider') applySlider(pt);
    else if (gesture.type === 'move') {
      const p = ws().bench.parts.find((p) => p.id === gesture.part);
      if (!p) return;
      const d = SB.PARTS[p.type];
      p.x = Math.round(clamp(pt.x - gesture.dx, 4, SB.VIEW.w - d.w - 4));
      p.y = Math.round(clamp(pt.y - gesture.dy, 16, SB.VIEW.h - d.h - 50));
      dirty();
    }
  });
  function endGesture(e) {
    if (!gesture) return;
    const g = gesture;
    gesture = null;
    if (g.type === 'wire') {
      if (g.moved) {
        const under = document.elementFromPoint(e.clientX, e.clientY);
        const el = under && under.closest('[data-act="term"],[data-act="pin"]');
        if (el && pending) { const here = endOf(el); if (here.kind !== pending.kind) link(pending, here); }
        pending = null;
      }
      pointer = null;
    } else if (g.type === 'press') {
      const p = ws().bench.parts.find((p) => p.id === g.part);
      if (p) p.input.pressed = false;
    } else save();
    dirty();
  }
  window.addEventListener('pointerup', endGesture);
  window.addEventListener('pointercancel', endGesture);

  /* ---------- tidy up ---------- */
  function tidy() {
    const b = ws().bench;
    if (!b.parts.length) return;
    pending = null;
    SB.tidy(b);
    benchChanged();
  }
  $('#tidyBtn').addEventListener('click', tidy);

  /* ---------- tour ---------- */
  function showTour() {
    tourCard.hidden = !tourOn;
    const t = tourKey && SB.TOUR[tourKey];
    tourCard.innerHTML = t ? `<b>${esc(t.t)}</b>${esc(t.d)}` : '<b>Meet the board</b>Click a number on the board to find out what that part does.';
    dirty();
  }
  $('#tourBtn').addEventListener('click', (e) => {
    tourOn = !tourOn; tourKey = null; pending = null;
    e.currentTarget.setAttribute('aria-pressed', tourOn);
    showTour();
  });

  /* ---------- block editor ---------- */
  const opt = (v, cur, label) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(label || v)}</option>`;
  const sel = (attr, label, opts) => `<select ${attr} aria-label="${label}">${opts}</select>`;
  function field(v, t, path) {
    const P = `data-p="${path}"`;
    switch (t) {
      case 'dpin': return sel(P, 'pin', SB.DPINS.map((p) => opt(p, v)).join(''));
      case 'apin': return sel(P, 'analog pin', SB.APINS.map((p) => opt(p, v)).join(''));
      case 'onoff': return sel(P, 'on or off', opt('on', v, 'ON') + opt('off', v, 'OFF'));
      case 'note': return sel(P, 'note', Object.keys(SB.NOTES).map((n) => opt(n, v)).join(''));
      case 'var': return sel(P, 'variable', SB.VARS.map((n) => opt(n, v)).join(''));
      case 'op': return sel(P, 'compare', SB.OPS.map((n) => opt(n, v)).join(''));
      case 'num': return `<input type="number" step="any" ${P} value="${Number(v) || 0}" aria-label="number">`;
      case 'text': return `<input type="text" ${P} value="${esc(v)}" maxlength="40" aria-label="words to print">`;
      case 'value': {
        let h = sel(`data-kp="${path}"`, 'kind of value', Object.entries(SB.VALUE_KINDS).map(([k, l]) => opt(k, v.k, l)).join(''));
        if (v.k === 'num') h += field(v.v, 'num', path + '.v');
        else if (v.k === 'knob' || v.k === 'light') h += field(v.pin, 'apin', path + '.pin');
        else if (v.k === 'dist') h += '<span>trig</span>' + field(v.trig, 'dpin', path + '.trig') + '<span>echo</span>' + field(v.echo, 'dpin', path + '.echo');
        else if (v.k === 'var') h += field(v.name, 'var', path + '.name');
        return `<span class="slot">${h}</span>`;
      }
      case 'cond': {
        let h = sel(`data-kp="${path}"`, 'kind of question', Object.entries(SB.COND_KINDS).map(([k, l]) => opt(k, v.k, l)).join(''));
        if (v.k === 'cmp') h += field(v.a, 'value', path + '.a') + field(v.op, 'op', path + '.op') + field(v.b, 'value', path + '.b');
        else h += field(v.pin, 'dpin', path + '.pin');
        return `<span class="slot">${h}</span>`;
      }
    }
    return '';
  }
  function blkHtml(b) {
    const d = SB.BLOCKS[b.type];
    let h = `<div class="blk cat-${d.cat}" data-id="${b.id}"><div class="blk-row">`;
    h += d.parts.map((p) => (typeof p === 'string' ? `<span>${p}</span>` : field(b.f[p.f], p.t, p.f))).join('');
    h += '<button type="button" class="blk-x" title="Delete block" aria-label="Delete block">×</button></div>';
    if (d.body) h += `<div class="stack" data-list="${b.id}.body">${b.body.map(blkHtml).join('')}</div>`;
    if (d.else) h += `<div class="blk-row else-row"><span>else</span></div><div class="stack" data-list="${b.id}.else">${b.else.map(blkHtml).join('')}</div>`;
    return h + '</div>';
  }
  function renderProgram() {
    progEl.innerHTML = `<div class="stack root" data-list="root">${ws().program.map(blkHtml).join('')}</div>`;
  }
  function renderPalette() {
    paletteEl.innerHTML = SB.CATS.map((c) =>
      `<div class="pal-cat">${c.name}</div>` +
      Object.entries(SB.BLOCKS).filter(([, d]) => d.cat === c.id).map(([t, d]) => `<button type="button" class="pal-item cat-${d.cat}" data-type="${t}">${d.label}</button>`).join('')
    ).join('');
  }

  function findBlock(id, list) {
    list = list || ws().program;
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      if (b.id === id) return { b, list, i };
      const r = (b.body && findBlock(id, b.body)) || (b.else && findBlock(id, b.else));
      if (r) return r;
    }
    return null;
  }
  function getList(path) {
    if (path === 'root') return ws().program;
    const [id, key] = path.split('.'), f = findBlock(id);
    return f ? f.b[key] : null;
  }
  function setPath(obj, path, val) {
    const keys = path.split('.');
    while (keys.length > 1) obj = obj[keys.shift()];
    obj[keys[0]] = val;
  }
  function programChanged(rerender) {
    if (running) stop();
    if (rerender) renderProgram();
    renderCode(); save(); refreshSteps();
  }

  function onField(e) {
    const t = e.target, el = t.closest('.blk');
    if (!el) return;
    const f = findBlock(el.dataset.id);
    if (!f) return;
    if (t.dataset.kp) {
      if (e.type !== 'change') return;
      setPath(f.b.f, t.dataset.kp, SB.KIND_DEFAULT[t.value]());
      programChanged(true);
    } else if (t.dataset.p) {
      setPath(f.b.f, t.dataset.p, t.type === 'number' ? parseFloat(t.value) || 0 : t.value);
      programChanged(false);
    }
  }
  progEl.addEventListener('change', onField);
  progEl.addEventListener('input', onField);
  progEl.addEventListener('click', (e) => {
    const x = e.target.closest('.blk-x');
    if (!x) return;
    const f = findBlock(x.closest('.blk').dataset.id);
    if (f) { f.list.splice(f.i, 1); programChanged(true); }
  });

  /* drag and drop with pointer events, so it works with a mouse and with a finger */
  let drag = null;
  const dropLine = document.createElement('div');
  dropLine.className = 'drop-line';
  function onBlkDown(e) {
    if (e.button || e.target.closest('select,input,.blk-x')) return;
    const pal = e.target.closest('.pal-item'), blk = pal ? null : e.target.closest('.blk');
    if (!pal && !blk) return;
    if (blk) e.preventDefault();
    drag = { x0: e.clientX, y0: e.clientY, started: false, type: pal ? pal.dataset.type : null, id: blk ? blk.dataset.id : null, src: pal || blk, target: null };
    window.addEventListener('pointermove', onBlkMove);
    window.addEventListener('pointerup', onBlkUp);
    window.addEventListener('pointercancel', onBlkCancel);
  }
  function onBlkMove(e) {
    const d = drag;
    if (!d) return;
    if (!d.started) {
      if (Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      d.started = true;
      const r = d.src.getBoundingClientRect();
      d.ox = d.x0 - r.left; d.oy = d.y0 - r.top;
      d.ghost = d.src.cloneNode(true);
      d.ghost.classList.add('ghost');
      d.ghost.style.width = r.width + 'px';
      document.body.appendChild(d.ghost);
      if (d.id) d.src.classList.add('dragging');
    }
    d.ghost.style.left = e.clientX - d.ox + 'px';
    d.ghost.style.top = e.clientY - d.oy + 'px';
    const under = document.elementFromPoint(e.clientX, e.clientY);
    let stack = under && under.closest('.stack');
    if (!stack && under && under.closest('#program')) stack = $('.stack.root', progEl);
    if (stack && !progEl.contains(stack)) stack = null;
    dropLine.remove();
    d.target = null;
    if (stack) {
      const kids = [...stack.children].filter((c) => c.classList.contains('blk') && c !== d.src);
      let idx = kids.findIndex((k) => { const r = k.getBoundingClientRect(); return e.clientY < r.top + r.height / 2; });
      if (idx < 0) idx = kids.length;
      stack.insertBefore(dropLine, kids[idx] || null);
      d.target = { list: stack.dataset.list, idx };
    }
    d.ghost.classList.toggle('bin', !!d.id && !d.target);
  }
  function endDrag() {
    window.removeEventListener('pointermove', onBlkMove);
    window.removeEventListener('pointerup', onBlkUp);
    window.removeEventListener('pointercancel', onBlkCancel);
    if (drag && drag.ghost) drag.ghost.remove();
    if (drag && drag.src) drag.src.classList.remove('dragging');
    dropLine.remove();
    drag = null;
  }
  function onBlkCancel() { endDrag(); }
  function onBlkUp() {
    const d = drag;
    endDrag();
    if (!d) return;
    if (!d.started) {
      if (d.type) { // a plain click on the palette adds the block at the end
        ws().program.push(SB.B(d.type));
        programChanged(true);
        progEl.scrollTop = progEl.scrollHeight;
      }
      return;
    }
    let block = null;
    if (d.id) {
      const f = findBlock(d.id);
      if (!f) return;
      if (!d.target) { f.list.splice(f.i, 1); programChanged(true); return; } // dropped outside: delete
      block = f.b;
      f.list.splice(f.i, 1);
    } else if (d.target) block = SB.B(d.type);
    if (!block) return;
    const list = getList(d.target.list) || ws().program;
    list.splice(Math.min(d.target.idx, list.length), 0, block);
    programChanged(true);
  }
  progEl.addEventListener('pointerdown', onBlkDown);
  paletteEl.addEventListener('pointerdown', onBlkDown);
  // keyboard: Enter or Space on a palette button adds the block
  paletteEl.addEventListener('keydown', (e) => {
    const pal = e.target.closest('.pal-item');
    if (pal && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); ws().program.push(SB.B(pal.dataset.type)); programChanged(true); }
  });

  /* ---------- MicroPython view and output ---------- */
  function hl(line) {
    return line.replace(/(#.*$)|("(?:[^"\\]|\\.)*")|\b(from|import|def|return|if|else|while|for|in|True|False|pass)\b|\b(\d+(?:\.\d+)?)\b|(\w+|[^\w#"]+)/g,
      (m, c, s, k, n) => (c ? `<span class="c">${esc(c)}</span>` : s ? `<span class="s">${esc(s)}</span>` : k ? `<span class="k">${k}</span>` : n ? `<span class="n">${n}</span>` : esc(m)));
  }
  let codeText = '';
  function renderCode() {
    const lines = SB.generate(ws().program);
    codeText = lines.map((l) => l.t).join('\n') + '\n';
    pyEl.innerHTML = lines.map((l, i) => `<div class="ln"${l.id ? ` data-b="${l.id}"` : ''}><span class="no">${i + 1}</span><span>${hl(l.t) || ' '}</span></div>`).join('');
  }
  function showTab(which) {
    const out = which === 'out';
    $('#tabPy').classList.toggle('on', !out); $('#tabOut').classList.toggle('on', out);
    pyEl.hidden = out; outEl.hidden = !out;
    $('#copyBtn').hidden = out;
    if (out) { $('#outDot').hidden = true; outEl.scrollTop = outEl.scrollHeight; }
  }
  function log(text, cls) {
    const d = document.createElement('div');
    if (cls) d.className = cls;
    d.textContent = text;
    outEl.appendChild(d);
    while (outEl.childNodes.length > 200) outEl.removeChild(outEl.firstChild);
    if (outEl.hidden) $('#outDot').hidden = false; else outEl.scrollTop = outEl.scrollHeight;
  }
  $('#tabPy').addEventListener('click', () => showTab('py'));
  $('#tabOut').addEventListener('click', () => showTab('out'));
  $('#copyBtn').addEventListener('click', (e) => {
    const btn = e.currentTarget, done = (t) => { btn.textContent = t; setTimeout(() => { btn.textContent = 'Copy code'; }, 1500); };
    try { navigator.clipboard.writeText(codeText).then(() => done('Copied'), () => done('Select and copy by hand')); }
    catch (err) { done('Select and copy by hand'); }
  });

  /* ---------- sound ---------- */
  let actx = null;
  const voices = {};
  function audioStart() {
    if (!soundOn) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) { actx = null; }
  }
  function audioTick() {
    if (!actx) return;
    const b = ws().bench, want = {};
    if (soundOn) b.parts.forEach((p) => { if (p.type === 'buzzer') { const f = SB.view(b, hw, p).freq; if (f > 0) want[p.id] = f; } });
    try {
      Object.keys(voices).forEach((id) => {
        if (want[id]) return;
        voices[id].g.gain.setTargetAtTime(0, actx.currentTime, 0.01);
        voices[id].o.stop(actx.currentTime + 0.08);
        delete voices[id];
      });
      Object.keys(want).forEach((id) => {
        let v = voices[id];
        if (!v) {
          const o = actx.createOscillator(), g = actx.createGain();
          o.type = 'square'; g.gain.value = 0;
          o.connect(g); g.connect(actx.destination); o.start();
          g.gain.setTargetAtTime(0.04, actx.currentTime, 0.01);
          v = voices[id] = { o, g };
        }
        v.o.frequency.setValueAtTime(want[id], actx.currentTime);
      });
    } catch (e) { /* sound is a nice-to-have */ }
  }
  $('#soundBtn').addEventListener('click', (e) => {
    soundOn = !soundOn;
    e.currentTarget.setAttribute('aria-pressed', soundOn);
    e.currentTarget.textContent = soundOn ? 'Sound on' : 'Sound off';
    if (soundOn && running) audioStart();
  });

  /* ---------- run / stop ---------- */
  let activeEls = [];
  function highlight(id) {
    activeEls.forEach((el) => el.classList.remove('active'));
    activeEls = [];
    if (!id) return;
    const row = progEl.querySelector(`.blk[data-id="${id}"] > .blk-row`);
    if (row) activeEls.push(row);
    pyEl.querySelectorAll(`.ln[data-b="${id}"]`).forEach((el) => activeEls.push(el));
    activeEls.forEach((el) => el.classList.add('active'));
  }
  function setRunUi() {
    runBtn.textContent = running ? 'Stop' : 'Run';
    runBtn.classList.toggle('going', running);
  }
  function stop() {
    if (runner) { runner.stop(); runner = null; }
    running = false;
    hw.reset(); highlight(null); setRunUi(); dirty();
  }
  function run() {
    stop();
    const w = ws();
    outEl.innerHTML = '';
    if (!w.program.length) { log('Your program is empty. Drag some blocks in first.', 'warn'); showTab('out'); return; }
    const issues = SB.benchIssues(w.bench, w.program);
    if (issues.length) { log('Bench check found something to fix:', 'warn'); issues.forEach((i) => log('• ' + i, 'warn')); showTab('out'); }
    else log('Bench check passed. Running your program.', 'ok');
    mem = {};
    audioStart();
    const r = (runner = new SB.Runner(SB.clone(w.program), hw, { onBlock: highlight }));
    running = true; setRunUi();
    r.run().then((res) => {
      if (runner !== r) return;
      if (res === 'done') { log('Program finished. Put your blocks inside “repeat forever” to keep it going.', 'ok'); runner = null; running = false; hw.silence(); highlight(null); setRunUi(); dirty(); }
    }).catch((err) => { log('Something went wrong: ' + err.message, 'warn'); stop(); });
  }
  hw.onPrint = (t) => log(t);
  runBtn.addEventListener('click', () => (running ? stop() : run()));

  /* ---------- missions panel ---------- */
  const DRAWER = [['led', 'Red LED', 'red'], ['led', 'Yellow LED', 'yellow'], ['led', 'Green LED', 'green'], ['led', 'Blue LED', 'blue'], ['button', 'Button'], ['buzzer', 'Buzzer'], ['knob', 'Knob'], ['light', 'Light sensor'], ['servo', 'Servo'], ['dist', 'Distance sensor'], ['motion', 'Motion sensor']];
  function renderPanel() {
    const m = mission();
    if (m) {
      const n = SB.MISSIONS.length;
      panel.innerHTML =
        `<div class="mis-top"><div class="chips">${SB.MISSIONS.map((x, i) => `<button type="button" class="chip${i === store.mi ? ' cur' : ''}${store.done[x.id] ? ' done' : ''}" data-go="${i}" title="${esc(x.title)}" aria-label="Mission ${i + 1}: ${esc(x.title)}">${i + 1}</button>`).join('')}</div>` +
        `<div id="doneBox"></div><div class="spacer"></div><button type="button" class="link" data-do="answer">Show me the answer</button><button type="button" class="link" data-do="restart">Start over</button></div>` +
        `<div class="mis-body"><div><p class="eyebrow">Mission ${store.mi + 1} of ${n}</p><h2>${esc(m.title)}</h2><p class="story">${esc(m.story)}</p></div>` +
        `<ol class="steps">${m.steps.map((s) => `<li class="step"><span class="tick" aria-hidden="true"></span><div><p>${esc(s.text)}</p><p class="need" hidden></p><details><summary>Hint</summary><p>${esc(s.hint)}</p></details></div></li>`).join('')}</ol></div>`;
    } else {
      panel.innerHTML =
        `<p class="eyebrow">Free build</p><h2>Parts drawer</h2>` +
        `<div class="drawer">${DRAWER.map(([t, label, c]) => `<button type="button" data-add="${t}"${c ? ` data-color="${c}"` : ''}>${c ? `<span class="sw" style="background:${SB.LED_COLORS[c]}"></span>` : ''}${label}</button>`).join('')}</div>` +
        `<p class="story">Add parts, drag them where you like, wire them up and program anything. Your bench is saved in this browser.</p>` +
        `<div class="row"><button type="button" class="btn soft" data-do="clearBench">Clear the bench</button><button type="button" class="btn soft" data-do="clearProg">Clear the program</button></div>`;
    }
    lastDone = null;
    refreshSteps();
  }
  let lastDone = null;
  function refreshSteps() {
    const m = mission();
    if (!m) return;
    const w = ws(), ctx = { bench: w.bench, program: w.program, got: w.got };
    const els = panel.querySelectorAll('.step');
    let n = 0;
    m.steps.forEach((s, i) => {
      let ok = false;
      try { ok = !!s.check(ctx); } catch (e) { ok = false; }
      if (ok) n++;
      if (!els[i]) return;
      els[i].classList.toggle('done', ok);
      // say what is still missing, once there is something to judge
      let need = '';
      if (!ok && s.need && (w.program.length || i === m.steps.length - 1)) { try { need = s.need(ctx) || ''; } catch (e) { need = ''; } }
      const el = els[i].querySelector('.need');
      if (el) { el.hidden = !need; el.textContent = need ? 'Still needed: ' + need : ''; }
    });
    const complete = n === m.steps.length;
    if (complete && !store.done[m.id]) {
      store.done[m.id] = true; save();
      const chip = panel.querySelector(`.chip[data-go="${store.mi}"]`);
      if (chip) chip.classList.add('done');
    }
    if (complete !== lastDone) {
      lastDone = complete;
      const box = $('#doneBox', panel), last = store.mi === SB.MISSIONS.length - 1;
      if (box) box.innerHTML = complete
        ? `<div class="done-box"><span>Mission complete.</span>${last ? '<button type="button" class="btn" data-do="free">Try Free build</button>' : '<button type="button" class="btn" data-do="next">Next mission</button>'}</div>`
        : '';
    }
  }
  function freeSpot(def) {
    const parts = ws().bench.parts;
    for (let row = 0; row < 2; row++) for (let col = 0; col < 5; col++) {
      const s = SB.slot(row, col);
      if (!parts.some((p) => Math.abs(p.x - s.x) < 70 && Math.abs(p.y - s.y) < 60)) return s;
    }
    return { x: 30 + Math.random() * 500, y: 30 };
  }
  panel.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.go != null) return goMission(Number(t.dataset.go));
    if (t.dataset.add) {
      const type = t.dataset.add, part = SB.makePart(type, type + '_' + SB.uid(), freeSpot(SB.PARTS[type]), t.dataset.color ? { color: t.dataset.color } : {});
      ws().bench.parts.push(part);
      return benchChanged();
    }
    const m = mission(), w = ws();
    switch (t.dataset.do) {
      case 'next': return goMission(store.mi + 1);
      case 'free': return setMode('free');
      case 'restart': stop(); delete store.m[m.id]; return renderAll();
      case 'answer':
        stop();
        w.bench = SB.missionBench(m);
        w.bench.wires = m.wiring.map(([part, term, pin]) => ({ part, term, pin }));
        w.program = m.solution();
        SB.tidy(w.bench);
        return renderAll();
      case 'clearBench': stop(); w.bench = { parts: [], wires: [] }; return renderAll();
      case 'clearProg': stop(); w.program = []; return renderAll();
    }
  });
  function goMission(i) { stop(); store.mi = clamp(i, 0, SB.MISSIONS.length - 1); renderAll(); }
  function setMode(mode) { stop(); store.mode = mode; renderAll(); }
  $('#modeMission').addEventListener('click', () => setMode('mission'));
  $('#modeFree').addEventListener('click', () => setMode('free'));

  function renderAll() {
    pending = null; gesture = null;
    $('#modeMission').classList.toggle('on', store.mode === 'mission');
    $('#modeFree').classList.toggle('on', store.mode === 'free');
    renderProgram(); renderCode(); renderPanel(); showTab('py');
    outEl.innerHTML = '';
    save(); dirty();
  }

  /* ---------- the clock: eases servos, feeds sound, watches mission goals ---------- */
  function tick() {
    const w = ws(), b = w.bench;
    b.parts.forEach((p) => {
      if (p.type !== 'servo') return;
      const tgt = SB.view(b, hw, p).angle, cur = shown[p.id] || 0;
      if (tgt == null) return;
      if (Math.abs(tgt - cur) > 0.5) { shown[p.id] = cur + (tgt - cur) * 0.4; dirty(); }
      else if (cur !== tgt) { shown[p.id] = tgt; dirty(); }
    });
    audioTick();
    const sig = JSON.stringify(hw.pins);
    if (sig !== lastSig) { lastSig = sig; dirty(); }
    const m = mission();
    if (running && m && m.observe) {
      const part = (id) => b.parts.find((p) => p.id === id) || { input: {}, id, type: 'none' };
      const v = (id) => SB.view(b, hw, part(id));
      try {
        m.observe({ bench: b, hw, mem, got: w.got, t: performance.now(), part, level: (id) => v(id).level || 0, freq: (id) => v(id).freq || 0, angle: (id) => v(id).angle });
      } catch (e) { /* a part was removed mid-run */ }
      refreshSteps();
    }
  }
  setInterval(tick, 50);
  (function frame() {
    if (benchDirty) { benchDirty = false; renderBench(); }
    requestAnimationFrame(frame);
  })();

  renderPalette();
  renderAll();
  SB.app = { run, stop, store: () => store, ws, hw }; // handy in the browser console
})();
