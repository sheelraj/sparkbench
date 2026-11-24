/* Sparkbench — guided missions.
   Each mission lists its parts, the right wiring, and steps. A step is done when check(ctx) is true.
   ctx = { bench, program, got }. "got" holds things seen while the program ran; observe(o) fills it in. */
(function () {
  const SB = (window.SB = window.SB || {});
  const B = (...a) => SB.B(...a);

  const wire = (c, part, term) => SB.pinOf(c.bench, part, term);
  const gnd = (c, part, term) => SB.isGnd(wire(c, part, term));
  const all = (c) => SB.flat(c.program);
  const looped = (c) => SB.flatIn(c.program, 'forever');
  const has = (list, type, test) => list.some((b) => b.type === type && (!test || test(b.f, b)));
  const count = (list, type) => list.filter((b) => b.type === type).length;
  const usesValue = (b, k) => SB.valuesOf(b).some((v) => v.k === k);

  /* Counts real blinks: the light has to stay on, and stay off, long enough to see. */
  function blink(mem, key, on, t) {
    const s = mem[key] || (mem[key] = { on, since: t, good: 0 });
    if (on !== s.on) { if (t - s.since >= 120) s.good++; s.on = on; s.since = t; }
    return Math.floor(s.good / 2);
  }

  const ledWire = (id, name, pin) => [
    { text: `Wire the ${name}’s + leg to pin ${pin}.`, hint: `Click the + leg under the LED, then click pin ${pin.slice(1)} on the board.`, check: (c) => wire(c, id, 'a') === pin },
    { text: `Wire the ${name}’s – leg to GND.`, hint: 'Electricity needs a way back. Any pin marked GND works.', check: (c) => gnd(c, id, 'k') },
  ];
  const powerWires = (id, name) => [
    { text: `Give the ${name} power: 5V leg to 5V, GND leg to GND.`, hint: 'Sensors need electricity to work. Both power pins are on the bottom edge of the board.', check: (c) => SB.is5V(wire(c, id, 'vcc')) && gnd(c, id, 'gnd') },
  ];

  SB.MISSIONS = [
    {
      id: 'blink', title: 'Hello, blink',
      story: 'Every maker starts here. The board has a tiny light of its own, marked L, wired to pin D13. Make it blink.',
      parts: [], wiring: [],
      steps: [
        { text: 'Drag a “repeat forever” block into your program.', hint: 'It is at the top of the block list. Anything inside it runs again and again.', check: (c) => has(all(c), 'forever') },
        { text: 'Inside it: turn pin D13 ON, wait, turn pin D13 OFF, wait.', hint: 'You need four blocks inside the loop. Without the second wait, the light turns back on too fast to see.', check: (c) => has(looped(c), 'pin_on', (f) => f.pin === 'D13' && f.state === 'on') && has(looped(c), 'pin_on', (f) => f.pin === 'D13' && f.state === 'off') && count(looped(c), 'wait') >= 2 },
        { text: 'Press Run and watch the L light blink three times.', hint: 'The light sits on the board, just under pin 13.', check: (c) => c.got.blink },
      ],
      observe(o) { if (blink(o.mem, 'L', o.hw.level('D13') > 0.5, o.t) >= 3) o.got.blink = true; },
      solution: () => [B('forever', {}, [B('pin_on', { pin: 'D13', state: 'on' }), B('wait', { secs: 0.5 }), B('pin_on', { pin: 'D13', state: 'off' }), B('wait', { secs: 0.5 })])],
    },
    {
      id: 'wire', title: 'Your first wire',
      story: 'Time to plug something in. An LED has two legs: + lets electricity in, – lets it out to GND (ground).',
      parts: [{ id: 'led', type: 'led', color: 'red', slot: [0, 2] }],
      wiring: [['led', 'a', 'D8'], ['led', 'k', 'GND1']],
      steps: [
        ...ledWire('led', 'red LED', 'D8'),
        { text: 'Build a blink program for pin D8.', hint: 'Same as mission 1, but change both pin blocks from D13 to D8.', check: (c) => has(looped(c), 'pin_on', (f) => f.pin === 'D8' && f.state === 'on') && has(looped(c), 'pin_on', (f) => f.pin === 'D8' && f.state === 'off') && count(looped(c), 'wait') >= 2 },
        { text: 'Press Run. The red LED should blink three times.', hint: 'Nothing happening? Look at the Output tab. It tells you which wire is wrong.', check: (c) => c.got.blink },
      ],
      observe(o) { if (blink(o.mem, 'led', o.level('led') > 0.5, o.t) >= 3) o.got.blink = true; },
      solution: () => [B('forever', {}, [B('pin_on', { pin: 'D8', state: 'on' }), B('wait', { secs: 0.5 }), B('pin_on', { pin: 'D8', state: 'off' }), B('wait', { secs: 0.5 })])],
    },
    {
      id: 'traffic', title: 'Traffic light',
      story: 'Three LEDs, three pins. Run them in the right order: green, then yellow, then red, with only one lit at a time.',
      parts: [{ id: 'red', type: 'led', color: 'red', slot: [0, 1] }, { id: 'yellow', type: 'led', color: 'yellow', slot: [0, 2] }, { id: 'green', type: 'led', color: 'green', slot: [0, 3] }],
      wiring: [['red', 'a', 'D10'], ['red', 'k', 'GND1'], ['yellow', 'a', 'D9'], ['yellow', 'k', 'GND1'], ['green', 'a', 'D8'], ['green', 'k', 'GND1']],
      steps: [
        { text: 'Wire red to D10, yellow to D9 and green to D8.', hint: 'That is the + leg of each LED. One wire each.', check: (c) => wire(c, 'red', 'a') === 'D10' && wire(c, 'yellow', 'a') === 'D9' && wire(c, 'green', 'a') === 'D8' },
        { text: 'Wire all three – legs to GND.', hint: 'They can all share the same GND pin.', check: (c) => gnd(c, 'red', 'k') && gnd(c, 'yellow', 'k') && gnd(c, 'green', 'k') },
        { text: 'Program the sequence: each light turns on, waits, then turns off.', hint: 'For each colour you need ON, wait, OFF. Put all nine blocks inside a repeat forever.', check: (c) => ['D8', 'D9', 'D10'].every((p) => has(all(c), 'pin_on', (f) => f.pin === p && f.state === 'on') && has(all(c), 'pin_on', (f) => f.pin === p && f.state === 'off')) && count(all(c), 'wait') >= 3 },
        { text: 'Press Run and watch green, yellow, red.', hint: 'Two lights on together? Check you turn each one OFF before the next one comes ON.', check: (c) => c.got.seq },
      ],
      observe(o) {
        const lit = ['green', 'yellow', 'red'].filter((id) => o.level(id) > 0.5);
        if (!o.mem.started) { o.mem.started = true; o.got.overlap = false; }
        if (lit.length > 1) o.got.overlap = true;
        const sole = lit.length === 1 ? lit[0][0] : lit.length ? 'x' : '';
        if (sole && sole !== o.mem.last) { o.mem.seq = (o.mem.seq || '') + sole; o.mem.last = sole; }
        if (/gyr/.test(o.mem.seq || '')) o.got.seq = true;
      },
      solution: () => [B('forever', {}, [
        B('pin_on', { pin: 'D8', state: 'on' }), B('wait', { secs: 1.5 }), B('pin_on', { pin: 'D8', state: 'off' }),
        B('pin_on', { pin: 'D9', state: 'on' }), B('wait', { secs: 0.6 }), B('pin_on', { pin: 'D9', state: 'off' }),
        B('pin_on', { pin: 'D10', state: 'on' }), B('wait', { secs: 1.5 }), B('pin_on', { pin: 'D10', state: 'off' }),
      ])],
    },
    {
      id: 'doorbell', title: 'Doorbell',
      story: 'So far the board only talks. Now it listens. When someone presses the button, ring the buzzer.',
      parts: [{ id: 'buzzer', type: 'buzzer', slot: [0, 2] }, { id: 'btn', type: 'button', slot: [0, 3] }],
      wiring: [['btn', 'p1', 'D2'], ['btn', 'p2', 'GND1'], ['buzzer', 'pos', 'D6'], ['buzzer', 'neg', 'GND1']],
      steps: [
        { text: 'Wire the button: one leg to D2, the other leg to GND.', hint: 'Pressing the button joins its two legs, so pin D2 gets connected to GND. That is how the board notices.', check: (c) => (wire(c, 'btn', 'p1') === 'D2' && gnd(c, 'btn', 'p2')) || (wire(c, 'btn', 'p2') === 'D2' && gnd(c, 'btn', 'p1')) },
        { text: 'Wire the buzzer: + to D6, – to GND.', hint: 'Just like an LED.', check: (c) => wire(c, 'buzzer', 'pos') === 'D6' && gnd(c, 'buzzer', 'neg') },
        { text: 'Program it: forever, if the button on D2 is pressed, play a note on D6. Else, stop the sound.', hint: 'Use the “if … else” block. Put “play note” in the top gap and “stop sound” in the else gap.', check: (c) => has(looped(c), 'if', (f) => f.cond.k === 'button' && f.cond.pin === 'D2') && has(all(c), 'tone', (f) => f.pin === 'D6') && has(all(c), 'tone_off', (f) => f.pin === 'D6') },
        { text: 'Press Run, then hold the red button and let go.', hint: 'The buzzer should sound only while you hold the button down.', check: (c) => c.got.ring && c.got.quiet },
      ],
      observe(o) {
        const down = o.part('btn').input.pressed, f = o.freq('buzzer');
        if (down && f > 0) o.got.ring = true;
        if (!down && f === 0 && o.got.ring) o.got.quiet = true;
      },
      solution: () => [B('forever', {}, [B('if', { cond: { k: 'button', pin: 'D2' } }, [B('tone', { note: 'E4', pin: 'D6' })], [B('tone_off', { pin: 'D6' })])])],
    },
    {
      id: 'dimmer', title: 'Dimmer knob',
      story: 'ON and OFF are not the only choices. A knob gives a number from 0 to 100, and an LED can glow at any brightness in between.',
      parts: [{ id: 'led', type: 'led', color: 'blue', slot: [0, 2] }, { id: 'knob', type: 'knob', slot: [1, 2] }],
      wiring: [['led', 'a', 'D9'], ['led', 'k', 'GND1'], ['knob', 'vcc', '5V'], ['knob', 'out', 'A0'], ['knob', 'gnd', 'GND2']],
      steps: [
        ...ledWire('led', 'blue LED', 'D9'),
        ...powerWires('knob', 'knob'),
        { text: 'Wire the knob’s OUT leg to analog pin A0.', hint: 'Analog pins measure how much. They are on the bottom edge, marked A0 to A5.', check: (c) => wire(c, 'knob', 'out') === 'A0' },
        { text: 'Program it: forever, set pin D9 brightness to the knob on A0.', hint: 'Drag in “set brightness”. In its value box, change “number” to “knob on”.', check: (c) => has(looped(c), 'brightness', (f) => f.pin === 'D9' && f.value.k === 'knob' && f.value.pin === 'A0') },
        { text: 'Press Run and slide the knob all the way down, then all the way up.', hint: 'Drag the slider under the knob. The LED should fade with it.', check: (c) => c.got.low && c.got.high },
      ],
      observe(o) {
        const k = o.part('knob').input.value, l = o.level('led');
        if (k <= 15 && l <= 0.2) o.got.low = true;
        if (k >= 85 && l >= 0.8) o.got.high = true;
      },
      solution: () => [B('forever', {}, [B('brightness', { pin: 'D9', value: { k: 'knob', pin: 'A0' } })])],
    },
    {
      id: 'night', title: 'Night light',
      story: 'Now the board decides for itself. Build a light that switches on when the room gets dark.',
      parts: [{ id: 'led', type: 'led', color: 'yellow', slot: [0, 2] }, { id: 'light', type: 'light', slot: [1, 2] }],
      wiring: [['led', 'a', 'D9'], ['led', 'k', 'GND1'], ['light', 'vcc', '5V'], ['light', 'out', 'A1'], ['light', 'gnd', 'GND2']],
      steps: [
        ...ledWire('led', 'yellow LED', 'D9'),
        ...powerWires('light', 'light sensor'),
        { text: 'Wire the light sensor’s OUT leg to A1.', hint: 'Careful: this mission uses A1, not A0.', check: (c) => wire(c, 'light', 'out') === 'A1' },
        { text: 'Program it: forever, if light on A1 < 40, turn D9 ON. Else turn D9 OFF.', hint: 'In the “if” block, change the question to “compare”. Then set the left side to “light on” A1 and the right side to 40.', check: (c) => has(looped(c), 'if', (f, b) => f.cond.k === 'cmp' && SB.valuesOf(b).some((v) => v.k === 'light' && v.pin === 'A1')) && has(all(c), 'pin_on', (f) => f.pin === 'D9' && f.state === 'on') && has(all(c), 'pin_on', (f) => f.pin === 'D9' && f.state === 'off') },
        { text: 'Press Run. Slide the sensor to dark, then to bright.', hint: 'The LED should be on in the dark and off in the light.', check: (c) => c.got.dark && c.got.bright },
      ],
      observe(o) {
        const v = o.part('light').input.value, l = o.level('led');
        if (v <= 20 && l > 0.5) o.got.dark = true;
        if (v >= 80 && l < 0.1) o.got.bright = true;
      },
      solution: () => [B('forever', {}, [B('if', { cond: { k: 'cmp', a: { k: 'light', pin: 'A1' }, op: '<', b: { k: 'num', v: 40 } } }, [B('pin_on', { pin: 'D9', state: 'on' })], [B('pin_on', { pin: 'D9', state: 'off' })])])],
    },
    {
      id: 'parking', title: 'Parking sensor',
      story: 'Cars beep when they get close to a wall. The distance sensor sends out a sound too high to hear and times the echo.',
      parts: [{ id: 'buzzer', type: 'buzzer', slot: [0, 3] }, { id: 'dist', type: 'dist', slot: [1, 1] }],
      wiring: [['buzzer', 'pos', 'D6'], ['buzzer', 'neg', 'GND1'], ['dist', 'vcc', '5V'], ['dist', 'trig', 'D9'], ['dist', 'echo', 'D10'], ['dist', 'gnd', 'GND2']],
      steps: [
        { text: 'Wire the buzzer: + to D6, – to GND.', hint: 'Same as the doorbell.', check: (c) => wire(c, 'buzzer', 'pos') === 'D6' && gnd(c, 'buzzer', 'neg') },
        ...powerWires('dist', 'distance sensor'),
        { text: 'Wire TRIG to D9 and ECHO to D10.', hint: 'TRIG sends the ping. ECHO hears it come back.', check: (c) => wire(c, 'dist', 'trig') === 'D9' && wire(c, 'dist', 'echo') === 'D10' },
        { text: 'Program it: forever, print the distance. If distance < 20, play a note on D6, else stop the sound. Then wait 0.2 seconds.', hint: 'Use “print a value” and pick “distance (cm)”. The short wait stops the Output tab from flooding.', check: (c) => has(looped(c), 'if', (f, b) => f.cond.k === 'cmp' && usesValue(b, 'dist')) && has(all(c), 'tone', (f) => f.pin === 'D6') && has(all(c), 'tone_off') && has(all(c), 'print_val', (f) => f.value.k === 'dist') },
        { text: 'Press Run. Slide the distance close (under 15 cm), then far (over 40 cm).', hint: 'Open the Output tab to watch the numbers change.', check: (c) => c.got.near && c.got.far && c.got.printed },
      ],
      observe(o) {
        const d = o.part('dist').input.value, f = o.freq('buzzer');
        if (d <= 15 && f > 0) o.got.near = true;
        if (d >= 40 && f === 0 && o.got.near) o.got.far = true;
        if (o.hw.printed > 0) o.got.printed = true;
      },
      solution: () => {
        const d = { k: 'dist', trig: 'D9', echo: 'D10' };
        return [B('forever', {}, [B('print_val', { value: d }), B('if', { cond: { k: 'cmp', a: d, op: '<', b: { k: 'num', v: 20 } } }, [B('tone', { note: 'A4', pin: 'D6' })], [B('tone_off', { pin: 'D6' })]), B('wait', { secs: 0.2 })])];
      },
    },
    {
      id: 'gate', title: 'Robot gate',
      story: 'Your last mission makes something move. When the motion sensor sees someone, a servo lifts the gate, then lowers it again.',
      parts: [{ id: 'servo', type: 'servo', slot: [0, 2] }, { id: 'motion', type: 'motion', slot: [1, 3] }],
      wiring: [['servo', 'sig', 'D5'], ['servo', 'vcc', '5V'], ['servo', 'gnd', 'GND1'], ['motion', 'vcc', '5V'], ['motion', 'out', 'D3'], ['motion', 'gnd', 'GND2']],
      steps: [
        ...powerWires('servo', 'servo'),
        { text: 'Wire the servo’s SIG leg to D5.', hint: 'SIG is the signal wire. It tells the servo which angle to turn to.', check: (c) => wire(c, 'servo', 'sig') === 'D5' },
        ...powerWires('motion', 'motion sensor'),
        { text: 'Wire the motion sensor’s OUT leg to D3.', hint: 'Two parts can share the 5V pin. On a real board you would use a breadboard for that.', check: (c) => wire(c, 'motion', 'out') === 'D3' },
        { text: 'Program it: forever, if motion is seen on D3, move the servo on D5 to 90. Else move it to 0.', hint: 'Change the question in the “if” block to “motion seen on”. You need two “move servo” blocks.', check: (c) => has(looped(c), 'if', (f) => f.cond.k === 'motion' && f.cond.pin === 'D3') && count(all(c).filter((b) => b.f.pin === 'D5'), 'servo') >= 2 },
        { text: 'Press Run. Hold the white dome to wave at the sensor, then let go.', hint: 'The servo arm should swing up to 90° and back down to 0°.', check: (c) => c.got.open && c.got.closed },
      ],
      observe(o) {
        const m = o.part('motion').input.pressed, a = o.angle('servo');
        if (m && a != null && a >= 80) o.got.open = true;
        if (!m && a != null && a <= 10 && o.got.open) o.got.closed = true;
      },
      solution: () => [B('forever', {}, [B('if', { cond: { k: 'motion', pin: 'D3' } }, [B('servo', { pin: 'D5', value: { k: 'num', v: 90 } })], [B('servo', { pin: 'D5', value: { k: 'num', v: 0 } })])])],
    },
  ];

  /* ---- "Still needed" messages: what an unticked coding step is missing, in plain words ---- */
  const onOff = (list, pin, state) => has(list, 'pin_on', (f) => f.pin === pin && f.state === state);
  function blinkNeed(c, pin) {
    const A = all(c), L = looped(c);
    if (!has(A, 'forever')) return 'Add a “repeat forever” block and put your blocks inside it.';
    for (const state of ['on', 'off']) {
      const S = state.toUpperCase();
      if (onOff(L, pin, state)) continue;
      if (onOff(A, pin, state)) return `Your “turn pin ${pin} ${S}” block is outside the loop. Drag it inside “repeat forever”.`;
      return has(A, 'pin_on', (f) => f.pin !== pin) && !has(A, 'pin_on', (f) => f.pin === pin)
        ? `Your pin blocks use a different pin. Change them to ${pin}.`
        : `Pin ${pin} is never turned ${S}.`;
    }
    const n = count(L, 'wait');
    if (n < 2) return `You need two “wait” blocks inside the loop, one after ON and one after OFF. You have ${n}.`;
    return null;
  }
  /* test(f, b) says whether an "if" block asks the right question; ask describes that question */
  function ifNeed(c, test, ask) {
    const A = all(c);
    if (!has(A, 'if')) return 'Add an “if … else” block.';
    if (!has(A, 'if', test)) return `Set the question in the “if” block to ${ask}.`;
    if (!has(looped(c), 'if', test)) return 'Put the “if … else” block inside “repeat forever” so the board keeps checking.';
    return null;
  }
  const NEED = {
    blink: { 1: (c) => blinkNeed(c, 'D13') },
    wire: { 2: (c) => blinkNeed(c, 'D8') },
    traffic: {
      2: (c) => {
        const A = all(c);
        for (const [pin, name] of [['D8', 'green'], ['D9', 'yellow'], ['D10', 'red']]) {
          if (!onOff(A, pin, 'on')) return `The ${name} light (pin ${pin}) is never turned ON.`;
          if (!onOff(A, pin, 'off')) return `The ${name} light (pin ${pin}) is never turned OFF. Add “turn pin ${pin} OFF” after its wait.`;
        }
        const n = count(A, 'wait');
        return n < 3 ? `Each light needs a “wait” while it is on, so three in total. You have ${n}.` : null;
      },
      3: (c) => (c.got.overlap ? 'Last run, more than one light was on at the same time. Turn each light OFF before the next one comes ON.' : null),
    },
    doorbell: {
      2: (c) => ifNeed(c, (f) => f.cond.k === 'button' && f.cond.pin === 'D2', '“button pressed on” D2')
        || (!has(all(c), 'tone', (f) => f.pin === 'D6') ? 'Add “play note … on pin D6” in the top gap of the “if” block.' : null)
        || (!has(all(c), 'tone_off', (f) => f.pin === 'D6') ? 'Add “stop sound on pin D6” in the else gap.' : null),
    },
    dimmer: {
      4: (c) => {
        const A = all(c), ok = (f) => f.pin === 'D9' && f.value.k === 'knob' && f.value.pin === 'A0';
        if (!has(A, 'brightness')) return 'Add a “set brightness” block.';
        if (!has(A, 'brightness', (f) => f.pin === 'D9')) return 'Set the pin in the brightness block to D9.';
        if (!has(A, 'brightness', ok)) return 'In the brightness block, change “number” to “knob on” and pick A0.';
        if (!has(looped(c), 'brightness', ok)) return 'Put the brightness block inside “repeat forever” so the LED keeps following the knob.';
        return null;
      },
    },
    night: {
      4: (c) => ifNeed(c, (f, b) => f.cond.k === 'cmp' && SB.valuesOf(b).some((v) => v.k === 'light' && v.pin === 'A1'), '“compare”, with “light on” A1 on the left')
        || (!onOff(all(c), 'D9', 'on') ? 'Add “turn pin D9 ON” in the top gap of the “if” block.' : null)
        || (!onOff(all(c), 'D9', 'off') ? 'Add “turn pin D9 OFF” in the else gap.' : null),
    },
    parking: {
      3: (c) => (!has(all(c), 'print_val', (f) => f.value.k === 'dist') ? 'Add “print a value” and change its value to “distance (cm)”.' : null)
        || ifNeed(c, (f, b) => f.cond.k === 'cmp' && usesValue(b, 'dist'), '“compare”, with “distance (cm)” on the left')
        || (!has(all(c), 'tone', (f) => f.pin === 'D6') ? 'Add “play note … on pin D6” in the top gap of the “if” block.' : null)
        || (!has(all(c), 'tone_off') ? 'Add “stop sound on pin D6” in the else gap.' : null),
    },
    gate: {
      4: (c) => {
        const r = ifNeed(c, (f) => f.cond.k === 'motion' && f.cond.pin === 'D3', '“motion seen on” D3');
        if (r) return r;
        const n = count(all(c).filter((b) => b.f.pin === 'D5'), 'servo');
        return n < 2 ? `You need two “move servo on pin D5” blocks: one to 90 in the top gap and one to 0 in the else gap. You have ${n}.` : null;
      },
    },
  };
  SB.MISSIONS.forEach((m) => Object.entries(NEED[m.id] || {}).forEach(([i, fn]) => { m.steps[i].need = fn; }));

  SB.missionBench = function (m) {
    return { parts: m.parts.map((p) => SB.makePart(p.type, p.id, SB.slot(p.slot[0], p.slot[1]), p.color ? { color: p.color } : {})), wires: [] };
  };
})();
