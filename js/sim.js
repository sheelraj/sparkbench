/* Sparkbench — the pretend electricity: pin states, what each part does with them, and the block runner. */
(function () {
  const SB = (window.SB = window.SB || {});
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* ---- reading the bench ---- */
  const pinOf = (SB.pinOf = (bench, partId, term) => {
    const w = bench.wires.find((w) => w.part === partId && w.term === term);
    return w ? w.pin : null;
  });
  const isSig = (pin) => !!pin && /^[DA]\d/.test(pin);
  const powered = (bench, p) => SB.is5V(pinOf(bench, p.id, 'vcc')) && SB.isGnd(pinOf(bench, p.id, 'gnd'));

  class Hardware {
    constructor(getBench) { this.getBench = getBench; this.pins = {}; this.onPrint = null; this.printed = 0; }
    reset() { this.pins = {}; this.printed = 0; }
    pin(p) { return this.pins[p] || (this.pins[p] = { mode: null, v: 0, duty: 0, freq: 0, angle: null }); }
    write(p, on) { Object.assign(this.pin(p), { mode: 'out', v: on ? 1 : 0 }); }
    pwm(p, pct) { Object.assign(this.pin(p), { mode: 'pwm', duty: clamp(Number(pct) || 0, 0, 100) / 100 }); }
    tone(p, f) { Object.assign(this.pin(p), { mode: 'tone', freq: f }); }
    servo(p, a) { Object.assign(this.pin(p), { mode: 'servo', angle: clamp(Number(a) || 0, 0, 180) }); }
    silence() { Object.values(this.pins).forEach((s) => { if (s.mode === 'tone') s.freq = 0; }); }
    /* how "on" a pin is, 0..1, as an LED would see it */
    level(p) {
      const s = this.pins[p];
      if (!s) return 0;
      return s.mode === 'out' ? s.v : s.mode === 'pwm' ? s.duty : s.mode === 'tone' && s.freq > 0 ? 0.5 : 0;
    }
    print(text) { this.printed++; if (this.onPrint) this.onPrint(String(text)); }
    /* inputs */
    button(pin) {
      const b = this.getBench();
      return b.parts.some((p) => {
        if (p.type !== 'button' || !p.input.pressed) return false;
        const a = pinOf(b, p.id, 'p1'), c = pinOf(b, p.id, 'p2');
        return (a === pin && SB.isGnd(c)) || (c === pin && SB.isGnd(a));
      });
    }
    motion(pin) {
      const b = this.getBench();
      return b.parts.some((p) => p.type === 'motion' && p.input.pressed && pinOf(b, p.id, 'out') === pin && powered(b, p));
    }
    analog(pin) {
      const b = this.getBench();
      const p = b.parts.find((p) => (p.type === 'knob' || p.type === 'light') && pinOf(b, p.id, 'out') === pin && powered(b, p));
      return p ? Math.round(p.input.value) : 0;
    }
    distance(trig, echo) {
      const b = this.getBench();
      const p = b.parts.find((p) => p.type === 'dist' && pinOf(b, p.id, 'trig') === trig && pinOf(b, p.id, 'echo') === echo && powered(b, p));
      return p ? Math.round(p.input.value) : 999;
    }
  }
  SB.Hardware = Hardware;

  /* What a part is doing right now. */
  SB.view = function (bench, hw, p) {
    const pin = (t) => pinOf(bench, p.id, t);
    if (p.type === 'led') {
      const a = pin('a'), k = pin('k');
      if (!SB.isGnd(k)) return { level: 0 };
      return { level: SB.is5V(a) ? 1 : /^D/.test(a || '') ? hw.level(a) : 0 };
    }
    if (p.type === 'buzzer') {
      const a = pin('pos'), s = a && hw.pins[a];
      return { freq: SB.isGnd(pin('neg')) && s && s.mode === 'tone' ? s.freq : 0 };
    }
    if (p.type === 'servo') {
      const a = pin('sig'), s = a && hw.pins[a];
      return { angle: powered(bench, p) && s && s.mode === 'servo' ? s.angle : null };
    }
    return {};
  };

  /* Friendly wiring problems, checked when Run is pressed. */
  SB.benchIssues = function (bench, program) {
    const out = [], u = SB.scan(program);
    const name = (p) => SB.PARTS[p.type].name(p);
    bench.parts.forEach((p) => {
      const pin = (t) => pinOf(bench, p.id, t), n = name(p);
      const terms = SB.PARTS[p.type].terms.map((t) => pin(t.id));
      if (terms.every((t) => !t)) { out.push(`${n} has no wires yet.`); return; }
      const needPower = () => {
        if (!SB.is5V(pin('vcc'))) out.push(`${n}: the 5V leg needs a wire to the 5V pin.`);
        if (!SB.isGnd(pin('gnd'))) out.push(`${n}: the GND leg needs a wire to a GND pin.`);
      };
      if (p.type === 'led') {
        if (SB.isGnd(pin('a')) && isSig(pin('k'))) out.push(`${n} is in backwards. Swap the two wires: + goes to the numbered pin, – goes to GND.`);
        else {
          if (!pin('a')) out.push(`${n}: the + leg needs a wire to a digital pin.`);
          else if (/^A/.test(pin('a'))) out.push(`${n}: the + leg is on an analog pin. Move it to a digital pin (D2–D13).`);
          if (!SB.isGnd(pin('k'))) out.push(`${n}: the – leg needs a wire to a GND pin.`);
        }
      } else if (p.type === 'button') {
        const a = pin('p1'), b = pin('p2');
        if (!((isSig(a) && SB.isGnd(b)) || (isSig(b) && SB.isGnd(a)))) out.push(`${n}: one leg goes to a digital pin, the other leg goes to GND.`);
      } else if (p.type === 'buzzer') {
        if (!isSig(pin('pos'))) out.push(`${n}: the + leg needs a wire to a digital pin.`);
        if (!SB.isGnd(pin('neg'))) out.push(`${n}: the – leg needs a wire to a GND pin.`);
      } else if (p.type === 'knob' || p.type === 'light') {
        needPower();
        if (!/^A/.test(pin('out') || '')) out.push(`${n}: the OUT leg needs a wire to an analog pin (A0–A5).`);
      } else if (p.type === 'servo') {
        needPower();
        if (!/^D/.test(pin('sig') || '')) out.push(`${n}: the SIG leg needs a wire to a digital pin.`);
      } else if (p.type === 'dist') {
        needPower();
        if (!/^D/.test(pin('trig') || '')) out.push(`${n}: the TRIG leg needs a wire to a digital pin.`);
        if (!/^D/.test(pin('echo') || '')) out.push(`${n}: the ECHO leg needs a wire to a digital pin.`);
      } else if (p.type === 'motion') {
        needPower();
        if (!/^D/.test(pin('out') || '')) out.push(`${n}: the OUT leg needs a wire to a digital pin.`);
      }
    });
    const used = new Set([...u.out, ...u.pwm, ...u.tone, ...u.servo, ...u.button, ...u.motion, ...u.adc]);
    u.dist.forEach((d) => { used.add(d.trig); used.add(d.echo); });
    used.forEach((pin) => {
      if (pin === 'D13' && (u.out.has(pin) || u.pwm.has(pin))) return; // built-in LED
      if (!bench.wires.some((w) => w.pin === pin)) out.push(`Your code uses pin ${pin}, but nothing is wired to ${pin}.`);
    });
    return out;
  };

  /* ---- running blocks ---- */
  const STOP = { stop: true };
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  class Runner {
    constructor(program, hw, hooks) { this.program = program; this.hw = hw; this.hooks = hooks || {}; this.vars = {}; this.stopped = false; }
    stop() { this.stopped = true; }
    check() { if (this.stopped) throw STOP; }
    async run() {
      try { await this.list(this.program); return 'done'; }
      catch (e) { if (e === STOP) return 'stopped'; throw e; }
    }
    async sleep(ms) {
      const end = performance.now() + ms;
      for (;;) {
        this.check();
        const left = end - performance.now();
        if (left <= 0) return;
        await pause(Math.min(left, 40));
      }
    }
    val(v) {
      const hw = this.hw;
      switch (v.k) {
        case 'num': return Number(v.v) || 0;
        case 'knob': case 'light': return hw.analog(v.pin);
        case 'dist': return hw.distance(v.trig, v.echo);
        case 'var': return this.vars[v.name] || 0;
        case 'button': return hw.button(v.pin);
        case 'motion': return hw.motion(v.pin);
        case 'cmp': {
          const a = this.val(v.a), b = this.val(v.b);
          return v.op === '<' ? a < b : v.op === '>' ? a > b : a === b;
        }
      }
      return 0;
    }
    async list(blocks) {
      for (const b of blocks) {
        this.check();
        if (this.hooks.onBlock) this.hooks.onBlock(b.id);
        await this.exec(b);
      }
    }
    async exec(b) {
      const f = b.f, hw = this.hw;
      switch (b.type) {
        case 'forever':
          for (;;) { await this.list(b.body); await pause(4); this.check(); }
        case 'repeat': {
          const n = clamp(Math.floor(Number(f.times) || 0), 0, 10000);
          for (let i = 0; i < n; i++) { await this.list(b.body); if (i % 25 === 24) { await pause(0); this.check(); } }
          break;
        }
        case 'if': await this.list(this.val(f.cond) ? b.body : b.else); break;
        case 'wait': await this.sleep(clamp(Number(f.secs) || 0, 0, 3600) * 1000); break;
        case 'pin_on': hw.write(f.pin, f.state === 'on'); break;
        case 'brightness': hw.pwm(f.pin, this.val(f.value)); break;
        case 'tone': hw.tone(f.pin, SB.NOTES[f.note] || 262); break;
        case 'tone_off': hw.tone(f.pin, 0); break;
        case 'servo': hw.servo(f.pin, this.val(f.value)); break;
        case 'print_text': hw.print(f.text); break;
        case 'print_val': { const v = this.val(f.value); hw.print(Number.isInteger(v) ? v : Math.round(v * 100) / 100); break; }
        case 'set_var': this.vars[f.name] = this.val(f.value); break;
        case 'change_var': this.vars[f.name] = (this.vars[f.name] || 0) + (Number(f.by) || 0); break;
      }
    }
  }
  SB.Runner = Runner;
})();
