# WINGCAT

A browser platformer about a cat that earns wings from mystery boxes, leaves a rainbow trail
when it flies, and is pursued through every level by a mouse the size of a bus.

Eight worlds, eight levels each. One self-contained HTML file — no build step, no dependencies,
no assets. Everything is drawn to canvas and the music is synthesized at runtime with the Web
Audio API.

**Play:** https://hennessey123.github.io/new-wingcat/

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Move | Arrows / A D | Tip the device forward or back, or slide the left pad |
| Sprint | Hold L or Shift | SPRINT button |
| Jump | Space / W / Up | Tap the screen |
| Smash / dive | Down / S | SMASH button |

Jump height scales with how long you hold the button. Two full-height jumps in a row arm a
third that becomes a front flip, which goes higher than a normal jump.

## Mechanics

- **Wings** — headbutt a `?` box from below, or smash it from above with Down. A rainbow
  flight suit pops out and hovers; jump into it before it fades. Wings last 10 seconds, raise
  your top speed, and start the theme music.
- **The mouse** — enters from the left and accelerates through the worlds, from 2.55 px/frame
  in Cat World to 4.60 in Rainbow World. From world 7 on, walking loses the race and sprinting
  is mandatory.
- **Gunners** — grey figures that track your position, lead their shots more in later worlds,
  and fire live mice. A dashed line telegraphs the shot. Land on their heads to flatten them.
- **Pit recovery** — hold into a pit wall while falling to cling to it, then hit jump to kick
  off. You can climb out of any plain gap. Hazard pits still kill.
- **Water world** — needs the blue dive suit or water is instant death.
- **Rainbow world** — permanent wings, and the rainbow gaps only hold you while flying.

## Tilt steering

Steering reads the device's pitch: tip the far edge of the phone down to run forward, pull it
back toward you to reverse. Hold it flat to stand still.

Motion sensors need two things: an HTTPS page, and a page that isn't inside an iframe. GitHub
Pages satisfies both, so tilt works here. iOS will prompt for motion permission on the first
tap of the steering button.

If steering comes out backwards on your device, hit `INVERT` — sensor sign conventions vary by
manufacturer. `RECENTER` sets whatever angle you're currently holding as neutral.

Where sensors are unavailable, the game detects it within 1.6 seconds and switches to slide
steering: the left half of the screen becomes a drag pad. A diagnostic line on the title screen
reports which sensor path is live, event count, and whether the page is framed or insecure.

## Local development

It's one file. Open `index.html` in a browser.

Tilt will not work over `http://192.168.x.x` — LAN addresses aren't secure contexts, so
browsers disable sensors with no error. Use `cloudflared tunnel --url http://localhost:8000`
or `ngrok http 8000` if you need to test tilt locally.
