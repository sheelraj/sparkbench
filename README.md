# Sparkbench

A browser app where kids wire up an Arduino-style board, program it with drag-and-drop blocks, and read the MicroPython those blocks produce. Nothing to install and no build step: it is plain HTML, CSS and JavaScript.

## What is in it

- **Workbench** – an UNO-style board on a cutting mat. Click a leg on a part, then a pin on the board, to run a wire. Click a wire to remove it. Parts can be dragged around.
- **8 parts** – LED (four colours), button, buzzer, knob, light sensor, servo, distance sensor, motion sensor. Sensors have sliders or press-and-hold controls so kids can test their code.
- **Blocks** – loops, if/else, wait, lights, brightness, sound, servo, print and variables. Drag them from the list, or click one to add it at the end. Drag a block out of the program to delete it.
- **Live MicroPython** – the code for the blocks updates as they change. While the program runs, the current block and its line of code light up together.
- **Bench check** – pressing Run first checks the wiring and explains, in plain words, what is wrong (for example an LED that is in backwards).
- **8 guided missions** – Blink, First wire, Traffic light, Doorbell, Dimmer knob, Night light, Parking sensor, Robot gate. Each step ticks itself off when the wiring, the code, or the behaviour is right. An unticked coding step says what is still missing.
- **Free build** – an open bench with a parts drawer.
- **Meet the board** – a short tour of the parts of the board.

Progress and the free-build bench are saved in the browser (localStorage), per device.

## Try it on your computer

Open `index.html` in a browser. That is all.

## Put it live with GitHub Pages

1. Create a new repository on GitHub (public is simplest).
2. Upload everything in this folder to the repository, keeping the `css` and `js` folders. On the repository page: **Add file → Upload files**, drag the files in, commit.
3. Go to **Settings → Pages**. Under **Build and deployment**, set **Source** to *Deploy from a branch*, choose branch `main` and folder `/ (root)`, then save.
4. After a minute or so the site is live at `https://<your-username>.github.io/<repository-name>/`.

Every later commit to `main` updates the live site.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page layout |
| `css/style.css` | All styling |
| `js/parts.js` | Board geometry, pin positions, part drawings |
| `js/blocks.js` | Block definitions and the MicroPython generator |
| `js/sim.js` | Pin states, how parts react, wiring checks, the block runner |
| `js/missions.js` | The guided missions |
| `js/app.js` | The interface: bench, block editor, code view, panels |

### Adding a mission

Add an object to `SB.MISSIONS` in `js/missions.js`: the parts and where they sit, the correct wiring, a list of steps (each with a `check` function), an `observe` function that watches the running circuit, and a `solution`.

### Adding a block

Add an entry to `SB.BLOCKS` in `js/blocks.js`, a `case` for it in `SB.generate` (the MicroPython it makes) and a `case` in `Runner.exec` in `js/sim.js` (what it does in the simulator).

### Adding a part

Add an entry to `SB.PARTS` in `js/parts.js` (size, legs, drawing), teach `SB.view` and `SB.benchIssues` in `js/sim.js` about it, and add it to the `DRAWER` list in `js/app.js`.

## Using the code on a real board

The simulator is not an emulator. It runs the blocks directly and shows the matching MicroPython, so timing and electrical details are simplified.

- The classic **Arduino UNO R3 cannot run MicroPython** (its chip is too small). Boards that can include the Arduino Nano ESP32, Arduino Nano RP2040 Connect and Raspberry Pi Pico. MicroPython on the UNO R4 exists but is not officially supported by Arduino.
- Pin names differ between boards. The generated code uses names like `Pin("D8")` and `Pin("A0")`. On some boards you will need numbers instead, for example `Pin(8)`.
- Real LEDs need a resistor (about 220 Ω) in series. The LEDs here behave as if one is built in.
- On a real board, parts that share 5V or GND are joined through a breadboard. Here several wires can go to the same pin.

## Ideas for later

- A breadboard and resistors
- More parts: RGB LED, LCD or OLED screen, DC motor, temperature sensor
- Typing MicroPython directly and running it in the simulator
- Saving and sharing projects as a link or file
- A teacher view of mission progress
