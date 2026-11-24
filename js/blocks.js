/* Sparkbench — block definitions and the MicroPython generator. */
(function () {
  const SB = (window.SB = window.SB || {});

  SB.NOTES = { C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523 };
  SB.VARS = ['count', 'level', 'speed', 'angle'];
  SB.OPS = ['<', '>', '='];

  SB.CATS = [
    { id: 'ctrl', name: 'Control' },
    { id: 'out', name: 'Lights' },
    { id: 'sound', name: 'Sound' },
    { id: 'move', name: 'Movement' },
    { id: 'say', name: 'Print' },
    { id: 'var', name: 'Variables' },
  ];

  /* parts: strings are label text, objects are fields. t = field type, d = default. */
  SB.BLOCKS = {
    forever: { cat: 'ctrl', label: 'repeat forever', parts: ['repeat forever'], body: true },
    repeat: { cat: 'ctrl', label: 'repeat 3 times', parts: ['repeat', { f: 'times', t: 'num', d: 3 }, 'times'], body: true },
    if: { cat: 'ctrl', label: 'if … else', parts: ['if', { f: 'cond', t: 'cond', d: { k: 'button', pin: 'D2' } }], body: true, else: true },
    wait: { cat: 'ctrl', label: 'wait 1 second', parts: ['wait', { f: 'secs', t: 'num', d: 1 }, 'seconds'] },
    pin_on: { cat: 'out', label: 'turn pin ON / OFF', parts: ['turn pin', { f: 'pin', t: 'dpin', d: 'D13' }, { f: 'state', t: 'onoff', d: 'on' }] },
    brightness: { cat: 'out', label: 'set brightness', parts: ['set pin', { f: 'pin', t: 'dpin', d: 'D9' }, 'brightness to', { f: 'value', t: 'value', d: { k: 'num', v: 50 } }, '%'] },
    tone: { cat: 'sound', label: 'play note', parts: ['play note', { f: 'note', t: 'note', d: 'C4' }, 'on pin', { f: 'pin', t: 'dpin', d: 'D6' }] },
    tone_off: { cat: 'sound', label: 'stop sound', parts: ['stop sound on pin', { f: 'pin', t: 'dpin', d: 'D6' }] },
    servo: { cat: 'move', label: 'move servo', parts: ['move servo on pin', { f: 'pin', t: 'dpin', d: 'D5' }, 'to', { f: 'value', t: 'value', d: { k: 'num', v: 90 } }, '°'] },
    print_text: { cat: 'say', label: 'print words', parts: ['print', { f: 'text', t: 'text', d: 'hello' }] },
    print_val: { cat: 'say', label: 'print a value', parts: ['print', { f: 'value', t: 'value', d: { k: 'knob', pin: 'A0' } }] },
    set_var: { cat: 'var', label: 'set variable', parts: ['set', { f: 'name', t: 'var', d: 'count' }, 'to', { f: 'value', t: 'value', d: { k: 'num', v: 0 } }] },
    change_var: { cat: 'var', label: 'change variable', parts: ['change', { f: 'name', t: 'var', d: 'count' }, 'by', { f: 'by', t: 'num', d: 1 }] },
  };

  SB.VALUE_KINDS = { num: 'number', knob: 'knob on', light: 'light on', dist: 'distance (cm)', var: 'variable' };
  SB.COND_KINDS = { button: 'button pressed on', motion: 'motion seen on', cmp: 'compare' };
  SB.KIND_DEFAULT = {
    num: () => ({ k: 'num', v: 50 }),
    knob: () => ({ k: 'knob', pin: 'A0' }),
    light: () => ({ k: 'light', pin: 'A0' }),
    dist: () => ({ k: 'dist', trig: 'D9', echo: 'D10' }),
    var: () => ({ k: 'var', name: 'count' }),
    button: () => ({ k: 'button', pin: 'D2' }),
    motion: () => ({ k: 'motion', pin: 'D3' }),
    cmp: () => ({ k: 'cmp', a: { k: 'knob', pin: 'A0' }, op: '<', b: { k: 'num', v: 50 } }),
  };

  let seq = 1;
  SB.uid = () => 'b' + Date.now().toString(36) + (seq++).toString(36);
  const clone = (SB.clone = (o) => JSON.parse(JSON.stringify(o)));

  /* B('wait', {secs: 1}) or B('forever', {}, [children], [elseChildren]) */
  SB.B = function (type, f, body, els) {
    const d = SB.BLOCKS[type], b = { id: SB.uid(), type, f: {} };
    d.parts.forEach((p) => { if (typeof p === 'object') b.f[p.f] = clone(p.d); });
    Object.assign(b.f, clone(f || {}));
    if (d.body) b.body = body || [];
    if (d.else) b.else = els || [];
    return b;
  };
  SB.reId = function (list) {
    list.forEach((b) => { b.id = SB.uid(); if (b.body) SB.reId(b.body); if (b.else) SB.reId(b.else); });
    return list;
  };

  /* ---- walking the program ---- */
  SB.flat = function (list, out) {
    out = out || [];
    list.forEach((b) => { out.push(b); if (b.body) SB.flat(b.body, out); if (b.else) SB.flat(b.else, out); });
    return out;
  };
  SB.flatIn = function (list, type) {
    const out = [];
    SB.flat(list).filter((b) => b.type === type).forEach((b) => { SB.flat(b.body || [], out); SB.flat(b.else || [], out); });
    return out;
  };
  function valuesOf(b) {
    const out = [];
    const visit = (v) => { if (!v || typeof v !== 'object') return; out.push(v); if (v.k === 'cmp') { visit(v.a); visit(v.b); } };
    SB.BLOCKS[b.type].parts.forEach((p) => { if (typeof p === 'object' && (p.t === 'value' || p.t === 'cond')) visit(b.f[p.f]); });
    return out;
  }
  SB.valuesOf = valuesOf;

  /* Which pins does the program use, and how? */
  SB.scan = function (program) {
    const u = { out: new Set(), pwm: new Set(), tone: new Set(), servo: new Set(), button: new Set(), motion: new Set(), adc: new Set(), dist: [], vars: new Set(), wait: false };
    SB.flat(program).forEach((b) => {
      const f = b.f;
      if (b.type === 'pin_on') u.out.add(f.pin);
      if (b.type === 'brightness') u.pwm.add(f.pin);
      if (b.type === 'tone' || b.type === 'tone_off') u.tone.add(f.pin);
      if (b.type === 'servo') u.servo.add(f.pin);
      if (b.type === 'wait') u.wait = true;
      if (b.type === 'set_var' || b.type === 'change_var') u.vars.add(f.name);
      valuesOf(b).forEach((v) => {
        if (v.k === 'button') u.button.add(v.pin);
        if (v.k === 'motion') u.motion.add(v.pin);
        if (v.k === 'knob' || v.k === 'light') u.adc.add(v.pin);
        if (v.k === 'var') u.vars.add(v.name);
        if (v.k === 'dist' && !u.dist.some((d) => d.trig === v.trig && d.echo === v.echo)) u.dist.push({ trig: v.trig, echo: v.echo });
      });
    });
    return u;
  };

  /* ---- MicroPython ---- */
  const low = (p) => p.toLowerCase();
  const num = (n) => String(Number(n) || 0);
  const byPin = (a, b) => (a[0] === b[0] ? Number(a.slice(1)) - Number(b.slice(1)) : a < b ? -1 : 1);

  function expr(v) {
    switch (v.k) {
      case 'num': return num(v.v);
      case 'knob': case 'light': return `read_percent(sensor_${low(v.pin)})`;
      case 'dist': return `distance_cm(trig_${low(v.trig)}, echo_${low(v.echo)})`;
      case 'var': return v.name;
      case 'button': return `button_${low(v.pin)}.value() == 0`;
      case 'motion': return `motion_${low(v.pin)}.value() == 1`;
      case 'cmp': return `${expr(v.a)} ${v.op === '=' ? '==' : v.op} ${expr(v.b)}`;
    }
    return '0';
  }

  /* Returns [{t: 'line of code', id: blockId|null}] */
  SB.generate = function (program) {
    const L = [], add = (t, id) => L.push({ t, id: id || null });
    if (!program.length) {
      add('# Drag blocks into your program.');
      add('# The MicroPython for them shows up here.');
      return L;
    }
    const u = SB.scan(program), sorted = (s) => [...s].sort(byPin);
    const usesPwm = u.pwm.size || u.tone.size || u.servo.size;
    const anyPin = u.out.size || usesPwm || u.button.size || u.motion.size || u.adc.size || u.dist.length;
    const names = [];
    if (anyPin) names.push('Pin');
    if (usesPwm) names.push('PWM');
    if (u.adc.size) names.push('ADC');
    if (u.dist.length) names.push('time_pulse_us');
    if (names.length) add(`from machine import ${names.join(', ')}`);
    add('import time');
    add('');
    if (anyPin) add('# Tell the board what is plugged in where');
    sorted(u.out).forEach((p) => add(`pin_${low(p)} = Pin("${p}", Pin.OUT)`));
    sorted(u.pwm).forEach((p) => add(`led_${low(p)} = PWM(Pin("${p}"), freq=1000)`));
    sorted(u.tone).forEach((p) => add(`buzzer_${low(p)} = PWM(Pin("${p}"))`));
    sorted(u.servo).forEach((p) => add(`servo_${low(p)} = PWM(Pin("${p}"), freq=50)`));
    sorted(u.button).forEach((p) => add(`button_${low(p)} = Pin("${p}", Pin.IN, Pin.PULL_UP)`));
    sorted(u.motion).forEach((p) => add(`motion_${low(p)} = Pin("${p}", Pin.IN)`));
    sorted(u.adc).forEach((p) => add(`sensor_${low(p)} = ADC(Pin("${p}"))`));
    const dp = new Set();
    u.dist.forEach((d) => {
      if (!dp.has('t' + d.trig)) add(`trig_${low(d.trig)} = Pin("${d.trig}", Pin.OUT)`);
      if (!dp.has('e' + d.echo)) add(`echo_${low(d.echo)} = Pin("${d.echo}", Pin.IN)`);
      dp.add('t' + d.trig); dp.add('e' + d.echo);
    });
    if (anyPin) add('');
    const helper = (lines) => { lines.forEach((l) => add(l)); add(''); };
    if (u.adc.size) helper(['def read_percent(adc):', '    # 0 to 65535 becomes 0 to 100', '    return adc.read_u16() * 100 // 65535']);
    if (u.pwm.size) helper(['def set_brightness(pwm, percent):', '    percent = max(0, min(100, percent))', '    pwm.duty_u16(int(percent * 65535 / 100))']);
    if (u.servo.size) helper(['def set_servo(pwm, angle):', '    # a pulse of 0.5 to 2.5 ms means 0 to 180 degrees', '    angle = max(0, min(180, angle))', '    pwm.duty_ns(int(500000 + angle * 2000000 / 180))']);
    if (u.dist.length) helper(['def distance_cm(trig, echo):', '    trig.value(0)', '    time.sleep_us(2)', '    trig.value(1)', '    time.sleep_us(10)', '    trig.value(0)', '    t = time_pulse_us(echo, 1, 30000)', '    if t < 0:', '        return 999  # nothing in range', '    return t / 58']);
    if (u.vars.size) { [...u.vars].sort().forEach((v) => add(`${v} = 0`)); add(''); }

    const emit = (list, ind) => {
      const pad = '    '.repeat(ind);
      if (!list.length) { add(pad + 'pass'); return; }
      list.forEach((b) => {
        const f = b.f, a = (t) => add(pad + t, b.id);
        switch (b.type) {
          case 'forever': a('while True:'); emit(b.body, ind + 1); break;
          case 'repeat': a(`for i in range(${Math.max(0, Math.floor(Number(f.times) || 0))}):`); emit(b.body, ind + 1); break;
          case 'if':
            a(`if ${expr(f.cond)}:`); emit(b.body, ind + 1);
            if (b.else.length) { a('else:'); emit(b.else, ind + 1); }
            break;
          case 'wait': a(`time.sleep(${num(f.secs)})`); break;
          case 'pin_on': a(`pin_${low(f.pin)}.value(${f.state === 'on' ? 1 : 0})`); break;
          case 'brightness': a(`set_brightness(led_${low(f.pin)}, ${expr(f.value)})`); break;
          case 'tone': a(`buzzer_${low(f.pin)}.freq(${SB.NOTES[f.note]})  # note ${f.note}`); a(`buzzer_${low(f.pin)}.duty_u16(32768)`); break;
          case 'tone_off': a(`buzzer_${low(f.pin)}.duty_u16(0)`); break;
          case 'servo': a(`set_servo(servo_${low(f.pin)}, ${expr(f.value)})`); break;
          case 'print_text': a(`print(${JSON.stringify(String(f.text))})`); break;
          case 'print_val': a(`print(${expr(f.value)})`); break;
          case 'set_var': a(`${f.name} = ${expr(f.value)}`); break;
          case 'change_var': a(`${f.name} = ${f.name} + ${num(f.by)}`); break;
        }
      });
    };
    emit(program, 0);
    return L;
  };
})();
