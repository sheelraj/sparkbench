/* Sparkbench — board geometry and part definitions.
   Everything hangs off the global SB namespace so the app works from file:// and GitHub Pages with no build step. */
(function () {
  const SB = (window.SB = window.SB || {});

  SB.VIEW = { w: 760, h: 622 };
  /* The board is drawn in a 360 x 216 box and scaled up by k. */
  const BOARD = (SB.BOARD = { x: 155, y: 158, w: 450, h: 270, k: 1.25 });
  const K = BOARD.k;

  /* ---- board pins ---- */
  const PINS = (SB.PINS = {});
  ['GND', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2'].forEach((p, i) => {
    const id = p === 'GND' ? 'GND1' : p;
    PINS[id] = {
      id, side: 'top', net: p,
      x: BOARD.x + K * (44 + i * 24 + (i > 6 ? 10 : 0)), y: BOARD.y + K * 15,
      label: p === 'GND' ? 'GND' : p.slice(1),
    };
  });
  ['5V', 'GND2', 'GND3', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'].forEach((id, i) => {
    const net = id.startsWith('GND') ? 'GND' : id;
    PINS[id] = {
      id, side: 'bot', net, label: net,
      x: BOARD.x + K * (150 + i * 24 + (i > 2 ? 10 : 0)), y: BOARD.y + K * 201,
    };
  });
  SB.DPINS = ['D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13'];
  SB.APINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
  SB.isGnd = (pin) => !!pin && PINS[pin] && PINS[pin].net === 'GND';
  SB.is5V = (pin) => pin === '5V';

  /* ---- part slots on the mat ---- */
  SB.slot = (row, col) => ({ x: 20 + col * 148, y: row === 0 ? 18 : 464 });

  const LED_COLORS = (SB.LED_COLORS = {
    red: '#ff4b3e', yellow: '#ffcf33', green: '#35d07f', blue: '#4aa8ff',
  });

  function slider(p, x0, x1, y, min, max) {
    const v = p.input.value;
    const tx = x0 + ((v - min) / (max - min)) * (x1 - x0);
    return (
      `<line x1="${x0}" y1="${y}" x2="${x1}" y2="${y}" class="sl-track"/>` +
      `<line x1="${x0}" y1="${y}" x2="${tx}" y2="${y}" class="sl-fill"/>` +
      `<circle cx="${tx}" cy="${y}" r="7" class="sl-thumb"/>` +
      `<rect x="${x0 - 10}" y="${y - 12}" width="${x1 - x0 + 20}" height="24" fill="transparent" class="grab-x" ` +
      `data-act="slider" data-part="${p.id}" data-x0="${x0}" data-x1="${x1}" data-min="${min}" data-max="${max}"/>`
    );
  }
  const waves = (cx, cy, on) =>
    on
      ? `<g class="waves" fill="none" stroke="#ff6a13" stroke-width="2.5" stroke-linecap="round">` +
        `<path d="M${cx + 20} ${cy - 10} q8 10 0 20"/><path d="M${cx + 27} ${cy - 16} q13 16 0 32"/>` +
        `<path d="M${cx - 20} ${cy - 10} q-8 10 0 20"/><path d="M${cx - 27} ${cy - 16} q-13 16 0 32"/></g>`
      : '';

  /* Each part: size, terminals (x along the edge), default input, and a draw(part, view) that returns SVG.
     Artwork stays between y=18 and y=h-14 so the name and leg labels fit whichever way the part faces. */
  SB.PARTS = {
    led: {
      name: (p) => p.color[0].toUpperCase() + p.color.slice(1) + ' LED', w: 64, h: 92,
      terms: [{ id: 'a', label: '+', x: 20 }, { id: 'k', label: '–', x: 44 }],
      draw(p, v) {
        const c = LED_COLORS[p.color] || LED_COLORS.red, l = v.level || 0;
        return (
          `<circle cx="32" cy="46" r="29" fill="${c}" opacity="${(0.4 * l).toFixed(2)}"/>` +
          `<path d="M18 62V44a14 14 0 0 1 28 0v18z" fill="#3a3f47"/>` +
          `<path d="M18 62V44a14 14 0 0 1 28 0v18z" fill="${c}" opacity="${(0.3 + 0.7 * l).toFixed(2)}"/>` +
          `<path d="M23 44a9 9 0 0 1 6-8" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity="${0.35 + 0.5 * l}"/>` +
          `<rect x="14" y="61" width="36" height="6" rx="2" fill="${c}"/><rect x="14" y="61" width="36" height="6" rx="2" fill="#000" opacity=".25"/>`
        );
      },
    },
    button: {
      name: () => 'Button', w: 72, h: 92, input: { pressed: false },
      terms: [{ id: 'p1', label: '1', x: 22 }, { id: 'p2', label: '2', x: 50 }],
      draw(p) {
        const d = p.input.pressed;
        return (
          `<rect x="15" y="24" width="42" height="42" rx="7" fill="#2b3138"/>` +
          `<circle cx="36" cy="${d ? 46 : 44}" r="14" fill="${d ? '#a62a20' : '#e5483d'}" stroke="#7d1b14" stroke-width="2" ` +
          `class="pressable" data-act="press" data-part="${p.id}"/>`
        );
      },
    },
    buzzer: {
      name: () => 'Buzzer', w: 72, h: 92,
      terms: [{ id: 'pos', label: '+', x: 22 }, { id: 'neg', label: '–', x: 50 }],
      draw(p, v) {
        return (
          waves(36, 46, v.freq > 0) +
          `<circle cx="36" cy="46" r="23" fill="#1c1f24"/><circle cx="36" cy="46" r="19" fill="none" stroke="#3b4048" stroke-width="2"/>` +
          `<circle cx="36" cy="46" r="5" fill="#59606b"/>`
        );
      },
    },
    knob: {
      name: () => 'Knob', w: 96, h: 104, input: { value: 50 },
      terms: [{ id: 'vcc', label: '5V', x: 20 }, { id: 'out', label: 'OUT', x: 48 }, { id: 'gnd', label: 'GND', x: 76 }],
      draw(p) {
        const a = -135 + 2.7 * p.input.value;
        return (
          `<circle cx="48" cy="42" r="19" fill="#2f6fde"/><circle cx="48" cy="42" r="13" fill="#eef2f6" stroke="#1d3f86" stroke-width="2"/>` +
          `<line x1="48" y1="42" x2="48" y2="31" stroke="#14202b" stroke-width="3" stroke-linecap="round" transform="rotate(${a} 48 42)"/>` +
          slider(p, 16, 80, 76, 0, 100)
        );
      },
    },
    light: {
      name: () => 'Light sensor', w: 96, h: 104, input: { value: 70 },
      terms: [{ id: 'vcc', label: '5V', x: 20 }, { id: 'out', label: 'OUT', x: 48 }, { id: 'gnd', label: 'GND', x: 76 }],
      draw(p) {
        const l = p.input.value / 100;
        return (
          `<circle cx="48" cy="42" r="23" fill="#ffcf33" opacity="${(0.08 + 0.75 * l).toFixed(2)}"/>` +
          `<circle cx="48" cy="42" r="14" fill="#c9772b" stroke="#7a4514" stroke-width="2"/>` +
          `<path d="M39 38h18v4H39v4h18" fill="none" stroke="#fbe9c8" stroke-width="2"/>` +
          `<circle cx="10" cy="76" r="3" fill="#14202b"/><circle cx="86" cy="76" r="4" fill="#e09a00"/>` +
          slider(p, 22, 74, 76, 0, 100)
        );
      },
    },
    servo: {
      name: () => 'Servo', w: 104, h: 104,
      terms: [{ id: 'sig', label: 'SIG', x: 24 }, { id: 'vcc', label: '5V', x: 52 }, { id: 'gnd', label: 'GND', x: 80 }],
      draw(p, v) {
        const a = v.shown || 0;
        return (
          `<rect x="20" y="34" width="64" height="42" rx="6" fill="#2f6fde"/><rect x="12" y="46" width="80" height="8" rx="3" fill="#1d4fb0"/>` +
          `<g transform="rotate(${(a - 90).toFixed(1)} 52 55)"><rect x="47" y="24" width="10" height="38" rx="5" fill="#fff" stroke="#14202b" stroke-width="1.5"/>` +
          `<circle cx="52" cy="30" r="1.8" fill="#14202b"/></g><circle cx="52" cy="55" r="5" fill="#fff" stroke="#14202b" stroke-width="1.5"/>` +
          `<text x="98" y="30" text-anchor="end" class="p-read">${Math.round(a)}°</text>`
        );
      },
    },
    dist: {
      name: () => 'Distance sensor', w: 124, h: 104, input: { value: 60 },
      terms: [{ id: 'vcc', label: '5V', x: 20 }, { id: 'trig', label: 'TRIG', x: 48 }, { id: 'echo', label: 'ECHO', x: 76 }, { id: 'gnd', label: 'GND', x: 104 }],
      draw(p) {
        const eye = (x) => `<circle cx="${x}" cy="40" r="13" fill="#cfd6de" stroke="#6b7580" stroke-width="2"/><circle cx="${x}" cy="40" r="7" fill="#59606b"/>`;
        return (
          `<rect x="12" y="22" width="100" height="36" rx="5" fill="#2f6fde"/>` + eye(38) + eye(86) +
          slider(p, 16, 76, 76, 2, 150) +
          `<text x="118" y="80" text-anchor="end" class="p-read">${Math.round(p.input.value)} cm</text>`
        );
      },
    },
    motion: {
      name: () => 'Motion sensor', w: 96, h: 104, input: { pressed: false },
      terms: [{ id: 'vcc', label: '5V', x: 20 }, { id: 'out', label: 'OUT', x: 48 }, { id: 'gnd', label: 'GND', x: 76 }],
      draw(p) {
        const d = p.input.pressed;
        return (
          waves(48, 42, d) +
          `<rect x="20" y="22" width="56" height="40" rx="6" fill="#2f8f5b"/>` +
          `<circle cx="48" cy="42" r="15" fill="${d ? '#ffe2c9' : '#f4f6f8'}" stroke="#9aa5b1" stroke-width="2" class="pressable" data-act="press" data-part="${p.id}"/>` +
          `<path d="M39 42h18M48 33v18M41.500 35.500l13 13M54.500 35.500l-13 13" stroke="#c5ccd4" stroke-width="1" pointer-events="none"/>` +
          `<text x="48" y="80" text-anchor="middle" class="p-tip">hold to wave</text>`
        );
      },
    },
  };

  SB.makePart = function (type, id, pos, extra) {
    const def = SB.PARTS[type];
    return Object.assign(
      { id, type, x: pos.x, y: pos.y, input: def.input ? Object.assign({}, def.input) : {} },
      type === 'led' ? { color: 'red' } : {},
      extra || {}
    );
  };

  /* ---- geometry helpers ---- */
  SB.isFlipped = (p) => p.y + SB.PARTS[p.type].h / 2 > BOARD.y + BOARD.h / 2;
  SB.termPos = function (p, termId) {
    const def = SB.PARTS[p.type], t = def.terms.find((t) => t.id === termId), fl = SB.isFlipped(p);
    return { x: p.x + t.x, y: fl ? p.y - 12 : p.y + def.h + 12, dir: fl ? -1 : 1 };
  };
  SB.pinPos = (pin) => ({ x: PINS[pin].x, y: PINS[pin].y, dir: PINS[pin].side === 'top' ? -1 : 1 });

  /* ---- the board drawing ---- */
  SB.TOUR = {
    usb: { t: 'USB port', d: 'Plugs into your computer. It carries power and your program to the board.', r: [-12, 34, 50, 46] },
    jack: { t: 'Power jack', d: 'For a battery pack or wall adapter when the board is not plugged into a computer.', r: [-6, 146, 44, 44] },
    reset: { t: 'Reset button', d: 'Starts your program again from the top.', r: [6, 92, 34, 34] },
    chip: { t: 'Microcontroller', d: 'The tiny computer that runs your code, one line at a time.', r: [150, 104, 170, 46] },
    digital: { t: 'Digital pins D2–D13', d: 'Each one can switch ON or OFF, or listen for ON/OFF from a button or sensor.', r: [58, 2, 296, 42] },
    led: { t: 'Built-in LED “L”', d: 'A tiny light already wired to pin D13. Perfect for your first program.', r: [84, 50, 44, 30] },
    power: { t: 'Power pins', d: '5V gives parts their electricity. GND is the way back. Every circuit needs both.', r: [138, 172, 74, 42] },
    analog: { t: 'Analog pins A0–A5', d: 'These measure how much, not just on or off. Knobs and light sensors plug in here.', r: [220, 172, 136, 42] },
  };

  SB.drawBoard = function (hw) {
    const B = { x: BOARD.x, y: BOARD.y, w: 360, h: 216 }, l13 = hw ? hw.level('D13') : 0;
    let s = `<g transform="translate(${B.x} ${B.y}) scale(${K})">`;
    s += `<rect x="0" y="6" width="${B.w}" height="${B.h}" rx="14" fill="#000" opacity=".25"/>`;
    s += `<rect width="${B.w}" height="${B.h}" rx="14" class="pcb"/>`;
    s += `<rect x="6" y="6" width="${B.w - 12}" height="${B.h - 12}" rx="10" fill="none" stroke="#fff" stroke-opacity=".12"/>`;
    // usb, jack, reset
    s += `<rect x="-10" y="38" width="46" height="38" rx="3" fill="#c9d0d8" stroke="#7b8590" stroke-width="2"/>`;
    s += `<rect x="-4" y="150" width="40" height="36" rx="4" fill="#1c1f24"/>`;
    s += `<rect x="12" y="98" width="22" height="22" rx="3" fill="#c9d0d8"/><circle cx="23" cy="109" r="6" fill="#e5483d"/>`;
    // chip + crystal + traces
    s += `<g stroke="#fff" stroke-opacity=".16" fill="none" stroke-width="2"><path d="M70 60h40v50h44M320 126h18v40M236 104V64h60V40"/></g>`;
    s += `<rect x="156" y="110" width="158" height="34" rx="3" fill="#1c1f24"/>`;
    for (let i = 0; i < 14; i++) s += `<rect x="${161 + i * 11}" y="105" width="5" height="5" fill="#c9d0d8"/><rect x="${161 + i * 11}" y="144" width="5" height="5" fill="#c9d0d8"/>`;
    s += `<circle cx="166" cy="127" r="3" fill="#3b4048"/><rect x="92" y="118" width="34" height="14" rx="7" fill="#c9d0d8"/>`;
    // built-in LED and power LED
    s += `<circle cx="100" cy="64" r="12" fill="#ffcf33" opacity="${(0.55 * l13).toFixed(2)}"/>`;
    s += `<rect x="94" y="60" width="12" height="8" rx="2" fill="${l13 > 0.05 ? '#ffe27a' : '#6b5a1e'}"/><text x="112" y="68" class="b-lab">L</text>`;
    s += `<rect x="326" y="92" width="12" height="8" rx="2" fill="#35d07f"/><text x="322" y="100" text-anchor="end" class="b-lab">ON</text>`;
    s += `<text x="150" y="88" class="b-name">UNO-style board</text><text x="150" y="100" class="b-sub">runs MicroPython</text>`;
    // headers
    s += `<rect x="34" y="5" width="${324 - 8}" height="20" rx="3" fill="#14171b"/>`;
    s += `<rect x="140" y="${B.h - 25}" width="216" height="20" rx="3" fill="#14171b"/>`;
    s += `<text x="${B.w - 8}" y="56" text-anchor="end" class="b-sub">DIGITAL</text><text x="230" y="${B.h - 42}" class="b-sub">ANALOG IN</text><text x="144" y="${B.h - 42}" class="b-sub">POWER</text>`;
    s += '</g>';
    Object.values(PINS).forEach((p) => {
      const ty = p.side === 'top' ? p.y + 31 : p.y - 21;
      s += `<rect x="${p.x - 7.5}" y="${p.y - 7.5}" width="15" height="15" rx="2.5" fill="#3b4048"/><rect x="${p.x - 4}" y="${p.y - 4}" width="8" height="8" rx="1" fill="#0a0c0e"/>`;
      s += `<text x="${p.x}" y="${ty}" text-anchor="middle" class="b-pin${p.net === '5V' ? ' v5' : p.net === 'GND' ? ' gnd' : ''}">${p.label}</text>`;
    });
    return s;
  };

  SB.drawTour = function (current) {
    const B = BOARD;
    return Object.entries(SB.TOUR).map(([k, t], i) => {
      const [x, y, w, h] = t.r.map((n) => n * K);
      return `<g class="tour-spot${current === k ? ' on' : ''}" data-act="tour" data-k="${k}"><rect x="${B.x + x}" y="${B.y + y}" width="${w}" height="${h}" rx="8"/>` +
        `<circle cx="${B.x + x + 2}" cy="${B.y + y + 2}" r="10"/><text x="${B.x + x + 2}" y="${B.y + y + 6}" text-anchor="middle">${i + 1}</text></g>`;
    }).join('');
  };
})();
