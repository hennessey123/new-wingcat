// WingCat - Cat Simulator Game
// 8 Worlds × 8 Levels each

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

// ─── World Definitions ───────────────────────────────────────────────────────
const WORLDS = [
  { name: 'Cat World',     bg: '#87CEEB', ground: '#8B4513', accent: '#DEB887', sky: '#87CEEB', emoji: '🐱' },
  { name: 'Lava World',    bg: '#FF4500', ground: '#B22222', accent: '#FF6347', sky: '#FF4500', emoji: '🌋' },
  { name: 'Jungle World',  bg: '#228B22', ground: '#2E8B57', accent: '#90EE90', sky: '#87CEEB', emoji: '🌴' },
  { name: 'Water World',   bg: '#1E90FF', ground: '#0000CD', accent: '#00BFFF', sky: '#87CEEB', emoji: '🌊' },
  { name: 'Meta World',    bg: '#663399', ground: '#4B0082', accent: '#9370DB', sky: '#2F0047', emoji: '🔮' },
  { name: 'Beach World',   bg: '#FFF8DC', ground: '#F4A460', accent: '#FFDEAD', sky: '#87CEEB', emoji: '🏖️' },
  { name: 'Rock World',    bg: '#696969', ground: '#404040', accent: '#808080', sky: '#708090', emoji: '🪨' },
  { name: 'Rainbow World', bg: '#FFD700', ground: '#FF69B4', accent: '#FFF', sky: '#FFD700', emoji: '🌈' },
];

// ─── State ───────────────────────────────────────────────────────────────────
let state = 'title'; // title | worldSelect | game | paused | dead | win | worldComplete | gameComplete
let currentWorld = 0;
let currentLevel = 0;
let lives = 3;
let score = 0;

// ─── Audio (Web Audio API) ───────────────────────────────────────────────────
let audioCtx = null;
let nyanInterval = null;
let nyanPlaying = false;

function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

// Nyan Cat melody (simplified)
const NYAN_MELODY = [
  // freq, duration (ms)
  [784,100],[784,100],[784,200],[622,100],[784,100],[784,100],[784,200],[622,200],
  [784,100],[880,100],[880,100],[784,100],[784,200],[659,100],[698,100],[784,100],
  [880,200],[784,100],[622,100],[784,100],[880,100],[988,100],[880,100],[784,100],
  [659,200],[622,100],[784,100],[622,100],[523,100],[587,100],[659,200],[784,100],
];

let nyanNoteIdx = 0;
let nyanTimeout = null;

function playNyanNote() {
  if (!nyanPlaying || !audioCtx) return;
  const [freq, dur] = NYAN_MELODY[nyanNoteIdx % NYAN_MELODY.length];
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.type = 'square';
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur / 1000);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + dur / 1000);
  nyanNoteIdx++;
  nyanTimeout = setTimeout(playNyanNote, dur);
}

function startNyan() {
  if (nyanPlaying) return;
  initAudio();
  nyanPlaying = true;
  nyanNoteIdx = 0;
  playNyanNote();
}

function stopNyan() {
  nyanPlaying = false;
  if (nyanTimeout) clearTimeout(nyanTimeout);
}

function playSound(type) {
  initAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  if (type === 'jump') {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(); osc.stop(audioCtx.currentTime + 0.2);
  } else if (type === 'box') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
  } else if (type === 'die') {
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(110, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);
    osc.start(); osc.stop(audioCtx.currentTime + 0.6);
  } else if (type === 'win') {
    [523, 659, 784, 1047].forEach((f, i) => {
      const o2 = audioCtx.createOscillator();
      const g2 = audioCtx.createGain();
      o2.connect(g2); g2.connect(audioCtx.destination);
      o2.type = 'sine';
      o2.frequency.setValueAtTime(f, audioCtx.currentTime + i * 0.15);
      g2.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.15);
      g2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.3);
      o2.start(audioCtx.currentTime + i * 0.15);
      o2.stop(audioCtx.currentTime + i * 0.15 + 0.4);
    });
  }
}

// ─── Level Generation ─────────────────────────────────────────────────────────
const GROUND_Y = H - 60;
const TILE = 40;

function generateLevel(worldIdx, levelIdx) {
  const isWaterWorld = worldIdx === 3;
  const isRainbowWorld = worldIdx === 7;
  const isLavaWorld = worldIdx === 1;

  const level = {
    platforms: [],
    boxes: [],
    goalX: 0,
    goalY: 0,
    isWaterWorld,
    isRainbowWorld,
    isLavaWorld,
    scrollWidth: 2400 + levelIdx * 400,
  };

  // Seed pseudo-random
  const seed = worldIdx * 100 + levelIdx;
  const rand = makePRNG(seed);

  // Ground platforms (solid floor with gaps in later levels)
  const groundGap = Math.max(0, levelIdx - 3);
  for (let x = 0; x < level.scrollWidth; x += TILE) {
    // Add gaps occasionally in higher levels
    if (groundGap > 0 && rand() < groundGap * 0.04 && x > 400 && x < level.scrollWidth - 200) continue;
    level.platforms.push({ x, y: GROUND_Y, w: TILE, h: 60, type: 'ground' });
  }

  // Floating platforms
  const numPlatforms = 8 + levelIdx * 2;
  for (let i = 0; i < numPlatforms; i++) {
    const px = 300 + rand() * (level.scrollWidth - 500);
    const py = GROUND_Y - 80 - rand() * 180;
    const pw = 80 + rand() * 80;
    level.platforms.push({ x: px, y: py, w: pw, h: 16, type: 'float' });
  }

  // Mystery boxes
  const numBoxes = 2 + Math.floor(levelIdx * 0.8) + worldIdx;
  for (let i = 0; i < numBoxes; i++) {
    const bx = 200 + rand() * (level.scrollWidth - 400);
    const by = GROUND_Y - 80 - rand() * 160;
    level.boxes.push({ x: bx, y: by, w: TILE, h: TILE, hit: false, sparkTimer: 0 });
  }

  // Water suit box (Water World only)
  if (isWaterWorld) {
    level.boxes.push({ x: 180, y: GROUND_Y - 80, w: TILE, h: TILE, hit: false, sparkTimer: 0, isSuitBox: true });
  }

  // Goal (flag at end)
  level.goalX = level.scrollWidth - 80;
  level.goalY = GROUND_Y - 80;

  return level;
}

function makePRNG(seed) {
  let s = seed + 1;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ─── Game Objects ─────────────────────────────────────────────────────────────
let player, mouse, level, camera;
let rainbowTrail = [];
let particles = [];
let msgTimer = 0;
let msgText = '';
let waterSuit = false;

function initGame() {
  const lvl = generateLevel(currentWorld, currentLevel);
  level = lvl;
  camera = { x: 0 };

  player = {
    x: 80, y: GROUND_Y - 48,
    w: 36, h: 48,
    vx: 0, vy: 0,
    onGround: false,
    winged: false,
    wingTimer: 0,
    flying: false,
    facingRight: true,
    animFrame: 0,
    animTimer: 0,
    dead: false,
  };

  // Mouse starts off-screen to the left
  mouse = {
    x: -200, y: GROUND_Y - 56,
    w: 56, h: 56,
    vx: 0, vy: 0,
    speed: 2.5 + currentLevel * 0.25 + currentWorld * 0.3,
    onGround: false,
    animFrame: 0,
    animTimer: 0,
  };

  rainbowTrail = [];
  particles = [];
  waterSuit = false;
}

// ─── Physics ──────────────────────────────────────────────────────────────────
const GRAVITY = 0.55;
const JUMP_VY = -13;
const FLY_VY = -4;
const PLAYER_SPEED = 4;
const FLY_SPEED = 6;
const WING_DURATION = 600; // frames

const keys = {};
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  if ((e.code === 'Space' || e.code === 'ArrowUp') && state === 'title') startGame();
  if (e.code === 'Enter' && (state === 'dead' || state === 'win' || state === 'worldComplete' || state === 'gameComplete')) handleEnter();
  if (e.code === 'Escape') {
    if (state === 'game') state = 'paused';
    else if (state === 'paused') state = 'game';
  }
  e.preventDefault();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

function startGame() {
  initAudio();
  state = 'worldSelect';
}

function handleEnter() {
  if (state === 'dead') {
    if (lives <= 0) { lives = 3; currentWorld = 0; currentLevel = 0; }
    initGame();
    state = 'game';
  } else if (state === 'win') {
    advanceLevel();
  } else if (state === 'worldComplete') {
    currentWorld++;
    currentLevel = 0;
    if (currentWorld >= 8) { state = 'gameComplete'; }
    else { initGame(); state = 'game'; }
  } else if (state === 'gameComplete') {
    lives = 3; currentWorld = 0; currentLevel = 0; initGame(); state = 'title';
  }
}

function advanceLevel() {
  stopNyan();
  currentLevel++;
  if (currentLevel >= 8) {
    state = 'worldComplete';
  } else {
    initGame();
    state = 'game';
  }
}

function collidesAABB(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayer(dt) {
  if (player.dead) return;

  // Horizontal movement
  const spd = player.winged && player.flying ? FLY_SPEED : PLAYER_SPEED;
  if (keys['ArrowLeft'] || keys['KeyA']) { player.vx = -spd; player.facingRight = false; }
  else if (keys['ArrowRight'] || keys['KeyD']) { player.vx = spd; player.facingRight = true; }
  else player.vx = 0;

  // Jump / Fly
  if (player.winged && (keys['Space'] || keys['ArrowUp']) && player.wingTimer > 0) {
    player.flying = true;
    player.vy = FLY_VY * 0.5;
    if (!nyanPlaying) startNyan();
  } else if ((keys['Space'] || keys['ArrowUp']) && player.onGround) {
    player.vy = JUMP_VY;
    player.flying = false;
    playSound('jump');
  }

  // Wing timer
  if (player.winged) {
    player.wingTimer--;
    if (player.wingTimer <= 0) {
      player.winged = false;
      player.flying = false;
      stopNyan();
    }
  }

  if (!player.flying) {
    player.vy += GRAVITY;
  } else {
    player.vy += GRAVITY * 0.15;
    if (player.vy > 2) player.vy = 2;
    // Rainbow trail
    rainbowTrail.push({ x: player.x + player.w / 2, y: player.y + player.h, life: 60, maxLife: 60 });
    if (rainbowTrail.length > 200) rainbowTrail.shift();
  }

  if (!player.flying && player.winged && !(keys['Space'] || keys['ArrowUp'])) {
    player.flying = false;
  }

  player.x += player.vx;
  player.y += player.vy;

  // Clamp left
  if (player.x < 0) player.x = 0;

  // Platform collisions
  player.onGround = false;
  for (const p of level.platforms) {
    if (collidesAABB(player, p)) {
      const overlapLeft = (player.x + player.w) - p.x;
      const overlapRight = (p.x + p.w) - player.x;
      const overlapTop = (player.y + player.h) - p.y;
      const overlapBottom = (p.y + p.h) - player.y;
      const minH = Math.min(overlapLeft, overlapRight);
      const minV = Math.min(overlapTop, overlapBottom);

      if (minV < minH) {
        if (overlapTop < overlapBottom) {
          // Landing on top
          player.y = p.y - player.h;
          if (player.vy > 0) { player.vy = 0; player.onGround = true; player.flying = false; }
        } else {
          // Hit from below - check mystery boxes
          player.y = p.y + p.h;
          player.vy = 1;
        }
      } else {
        if (overlapLeft < overlapRight) player.x = p.x - player.w;
        else player.x = p.x + p.w;
        player.vx = 0;
      }
    }
  }

  // Mystery box collisions (head bump)
  for (const box of level.boxes) {
    if (box.hit) continue;
    // Check if player's head hits the box from below
    const headRect = { x: player.x + 4, y: player.y, w: player.w - 8, h: 10 };
    const boxBottom = { x: box.x, y: box.y + box.h - 4, w: box.w, h: 8 };
    if (player.vy < 0 && collidesAABB(headRect, boxBottom)) {
      box.hit = true;
      box.sparkTimer = 30;
      playSound('box');
      spawnParticles(box.x + box.w / 2, box.y, 15, '#FFD700');
      if (box.isSuitBox) {
        waterSuit = true;
        showMsg('🐠 Water Suit!');
      } else {
        player.winged = true;
        player.wingTimer = WING_DURATION;
        showMsg('🦋 Wings!');
      }
    }
  }

  // Water world hazard
  if (level.isWaterWorld && !waterSuit) {
    // If player falls into "water" (ground level), they slow down
    if (player.y + player.h >= GROUND_Y + 20) {
      player.vy *= 0.8;
      player.vx *= 0.7;
      // If completely submerged without suit, die
      if (player.y + player.h >= GROUND_Y + 50) {
        killPlayer();
      }
    }
  }

  // Lava hazard (ground is lava)
  if (level.isLavaWorld) {
    if (player.y + player.h >= GROUND_Y + 10 && player.onGround) {
      // Need to keep moving or die
    }
    if (player.y > H) killPlayer();
  }

  // Fall off screen
  if (player.y > H + 100) killPlayer();

  // Scroll camera
  camera.x = Math.max(0, Math.min(player.x - W / 3, level.scrollWidth - W));

  // Reach goal
  const goal = { x: level.goalX, y: level.goalY, w: 30, h: 80 };
  if (collidesAABB(player, goal)) {
    playSound('win');
    stopNyan();
    state = 'win';
  }

  // Animation
  player.animTimer++;
  if (player.animTimer > 8) { player.animTimer = 0; player.animFrame = (player.animFrame + 1) % 4; }
}

function updateMouse() {
  if (state !== 'game') return;

  // Mouse chases player
  const dx = player.x - mouse.x;
  mouse.vx = dx > 0 ? mouse.speed : -mouse.speed;
  mouse.x += mouse.vx;

  // Simple gravity for mouse
  mouse.vy += GRAVITY;
  mouse.y += mouse.vy;

  // Mouse on ground platforms
  for (const p of level.platforms) {
    if (collidesAABB(mouse, p)) {
      const overlapTop = (mouse.y + mouse.h) - p.y;
      const overlapBottom = (p.y + p.h) - mouse.y;
      if (overlapTop < overlapBottom && mouse.vy >= 0) {
        mouse.y = p.y - mouse.h;
        mouse.vy = 0;
        // Mouse jumps if player is above
        if (player.y < mouse.y - 50) {
          mouse.vy = JUMP_VY * 0.8;
        }
      }
    }
  }

  if (mouse.y > H) { mouse.y = GROUND_Y - mouse.h; mouse.vy = 0; }

  mouse.animTimer++;
  if (mouse.animTimer > 10) { mouse.animTimer = 0; mouse.animFrame = (mouse.animFrame + 1) % 4; }

  // Mouse catches player
  if (!player.dead && collidesAABB(player, mouse)) {
    killPlayer();
  }
}

function killPlayer() {
  if (player.dead) return;
  player.dead = true;
  stopNyan();
  playSound('die');
  lives--;
  spawnParticles(player.x + player.w / 2, player.y + player.h / 2, 20, '#FF6347');
  setTimeout(() => {
    if (lives <= 0) {
      state = 'dead';
    } else {
      state = 'dead';
    }
  }, 800);
}

function showMsg(text) {
  msgText = text;
  msgTimer = 120;
}

function spawnParticles(x, y, count, color) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 40 + Math.random() * 30,
      color,
      r: 3 + Math.random() * 4,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
  for (let i = rainbowTrail.length - 1; i >= 0; i--) {
    rainbowTrail[i].life--;
    if (rainbowTrail[i].life <= 0) rainbowTrail.splice(i, 1);
  }
}

// ─── Drawing ──────────────────────────────────────────────────────────────────
const RAINBOW_COLORS = ['#FF0000','#FF7F00','#FFFF00','#00FF00','#0000FF','#8B00FF','#FF69B4'];

function drawBackground() {
  const w = WORLDS[currentWorld];

  // Sky gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, w.sky);
  grad.addColorStop(1, w.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // World-specific background elements
  if (currentWorld === 0) drawCatWorldBg();
  else if (currentWorld === 1) drawLavaWorldBg();
  else if (currentWorld === 2) drawJungleWorldBg();
  else if (currentWorld === 3) drawWaterWorldBg();
  else if (currentWorld === 4) drawMetaWorldBg();
  else if (currentWorld === 5) drawBeachWorldBg();
  else if (currentWorld === 6) drawRockWorldBg();
  else if (currentWorld === 7) drawRainbowWorldBg();
}

function drawCatWorldBg() {
  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  [[100, 80, 60, 30], [300, 60, 80, 35], [600, 90, 50, 25]].forEach(([x, y, w, h]) => {
    const cx = ((x - camera.x * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.beginPath(); ctx.ellipse(cx, y, w, h, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 30, y - 15, w * 0.7, h * 0.8, 0, 0, Math.PI * 2); ctx.fill();
  });
  // Cat paw prints in background
  ctx.fillStyle = 'rgba(139,69,19,0.2)';
  for (let i = 0; i < 8; i++) {
    const px = ((i * 250 - camera.x * 0.5) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.beginPath(); ctx.arc(px, H - 80, 12, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px - 18, H - 95, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px, H - 95, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + 18, H - 95, 6, 0, Math.PI * 2); ctx.fill();
  }
}

function drawLavaWorldBg() {
  // Lava bubbles in background
  ctx.fillStyle = 'rgba(255,69,0,0.4)';
  const t = Date.now() * 0.002;
  for (let i = 0; i < 6; i++) {
    const bx = ((i * 150 - camera.x * 0.2) % (W + 200) + W + 200) % (W + 200) - 100;
    const by = H - 80 + Math.sin(t + i) * 20;
    ctx.beginPath(); ctx.arc(bx, by, 20 + Math.sin(t * 2 + i) * 10, 0, Math.PI * 2); ctx.fill();
  }
  // Lava drips from ceiling
  ctx.fillStyle = '#FF4500';
  for (let i = 0; i < 5; i++) {
    const dx = ((i * 180 - camera.x * 0.15) % (W + 200) + W + 200) % (W + 200) - 100;
    const dh = 30 + Math.sin(t * 1.5 + i * 0.7) * 15;
    ctx.fillRect(dx, 0, 20, dh);
  }
}

function drawJungleWorldBg() {
  ctx.fillStyle = 'rgba(0,100,0,0.5)';
  for (let i = 0; i < 6; i++) {
    const tx = ((i * 200 - camera.x * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.fillRect(tx, GROUND_Y - 200, 20, 200);
    ctx.beginPath();
    ctx.moveTo(tx + 10, GROUND_Y - 200);
    ctx.lineTo(tx - 40, GROUND_Y - 100);
    ctx.lineTo(tx + 60, GROUND_Y - 100);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(tx + 10, GROUND_Y - 280);
    ctx.lineTo(tx - 30, GROUND_Y - 160);
    ctx.lineTo(tx + 50, GROUND_Y - 160);
    ctx.fill();
  }
}

function drawWaterWorldBg() {
  // Underwater effect
  ctx.fillStyle = 'rgba(0,100,200,0.3)';
  ctx.fillRect(0, 0, W, H);
  // Bubbles
  const t = Date.now() * 0.001;
  ctx.fillStyle = 'rgba(200,230,255,0.4)';
  for (let i = 0; i < 10; i++) {
    const bx = ((i * 80 - camera.x * 0.1) % (W + 100) + W + 100) % (W + 100);
    const by = ((H - (t * 30 + i * 60) % H + H) % H);
    ctx.beginPath(); ctx.arc(bx, by, 5 + i % 3 * 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawMetaWorldBg() {
  // Grid / meta pattern
  ctx.strokeStyle = 'rgba(147,112,219,0.3)';
  ctx.lineWidth = 1;
  const offset = camera.x % 60;
  for (let x = -offset; x < W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  // Floating text
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.font = '14px monospace';
  const words = ['if(cat)', 'fly()', 'purr++;', 'meow()', '0xFF', 'null'];
  for (let i = 0; i < words.length; i++) {
    const wx = ((i * 130 - camera.x * 0.2) % (W + 300) + W + 300) % (W + 300) - 100;
    ctx.fillText(words[i], wx, 50 + i * 60);
  }
}

function drawBeachWorldBg() {
  // Sun
  const sx = W - 120 - camera.x * 0.05;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath(); ctx.arc(((sx % (W + 200) + W + 200) % (W + 200)), 80, 50, 0, Math.PI * 2); ctx.fill();
  // Waves
  ctx.strokeStyle = 'rgba(30,144,255,0.5)';
  ctx.lineWidth = 3;
  const t = Date.now() * 0.002;
  ctx.beginPath();
  for (let x = 0; x < W; x += 5) {
    const y = GROUND_Y + Math.sin((x + camera.x * 0.5) * 0.05 + t) * 10;
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawRockWorldBg() {
  // Stalactites
  ctx.fillStyle = '#555';
  for (let i = 0; i < 8; i++) {
    const rx = ((i * 120 - camera.x * 0.2) % (W + 200) + W + 200) % (W + 200) - 100;
    ctx.beginPath();
    ctx.moveTo(rx, 0);
    ctx.lineTo(rx - 20, 60 + i % 3 * 30);
    ctx.lineTo(rx + 20, 60 + i % 3 * 30);
    ctx.fill();
  }
}

function drawRainbowWorldBg() {
  // Animated rainbow arcs
  const t = Date.now() * 0.001;
  for (let r = 0; r < RAINBOW_COLORS.length; r++) {
    ctx.strokeStyle = RAINBOW_COLORS[r];
    ctx.lineWidth = 20;
    ctx.globalAlpha = 0.3 + Math.sin(t + r) * 0.1;
    ctx.beginPath();
    ctx.arc(W / 2 - camera.x * 0.2, H + 100, 200 + r * 25, Math.PI, 0);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Stars/sparkles
  ctx.fillStyle = '#FFD700';
  for (let i = 0; i < 15; i++) {
    const sx = ((i * 60 - camera.x * 0.1) % (W + 100) + W + 100) % (W + 100);
    const sy = 30 + i % 5 * 50;
    const s = Math.sin(t * 2 + i) * 0.5 + 1;
    ctx.save(); ctx.translate(sx, sy); ctx.scale(s, s);
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
      const ai = a + Math.PI / 5;
      j === 0 ? ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8) : ctx.lineTo(Math.cos(a) * 8, Math.sin(a) * 8);
      ctx.lineTo(Math.cos(ai) * 4, Math.sin(ai) * 4);
    }
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

function drawPlatforms() {
  const w = WORLDS[currentWorld];
  for (const p of level.platforms) {
    const sx = p.x - camera.x;
    if (sx + p.w < 0 || sx > W) continue;

    if (p.type === 'ground') {
      // Ground tile
      ctx.fillStyle = w.ground;
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = w.accent;
      ctx.fillRect(sx, p.y, p.w, 8);
      if (currentWorld === 1) { // Lava cracks
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(sx + 5, p.y + 4, 4, 4);
      }
    } else {
      // Floating platform
      ctx.fillStyle = w.ground;
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle = w.accent;
      ctx.fillRect(sx, p.y, p.w, 5);
    }
  }
}

function drawBoxes() {
  for (const box of level.boxes) {
    const sx = box.x - camera.x;
    if (sx + box.w < 0 || sx > W) continue;

    if (box.hit) {
      // Empty/dimmed box
      ctx.fillStyle = '#888';
      ctx.fillRect(sx, box.y, box.w, box.h);
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx, box.y, box.w, box.h);
    } else {
      // Mystery box (animated)
      const t = Date.now() * 0.005;
      const glow = Math.sin(t) * 0.3 + 0.7;

      if (box.isSuitBox) {
        // Water suit box - blue
        ctx.fillStyle = `rgba(30,144,255,${glow})`;
        ctx.fillRect(sx, box.y, box.w, box.h);
        ctx.strokeStyle = '#00BFFF';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, box.y, box.w, box.h);
        ctx.fillStyle = '#fff';
        ctx.font = '22px serif';
        ctx.fillText('🐠', sx + 5, box.y + 30);
      } else {
        // Wing box - golden
        ctx.fillStyle = `rgba(255,215,0,${glow})`;
        ctx.fillRect(sx, box.y, box.w, box.h);
        ctx.strokeStyle = '#FFA500';
        ctx.lineWidth = 3;
        ctx.strokeRect(sx, box.y, box.w, box.h);
        ctx.fillStyle = '#fff';
        ctx.font = '22px serif';
        ctx.fillText('?', sx + 12, box.y + 28);
      }
    }
  }
}

function drawGoal() {
  const sx = level.goalX - camera.x;
  if (sx > W + 50 || sx < -50) return;

  // Flagpole
  ctx.fillStyle = '#555';
  ctx.fillRect(sx + 10, level.goalY - 60, 4, 140);

  // Flag (animated)
  const t = Date.now() * 0.005;
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.moveTo(sx + 14, level.goalY - 60);
  ctx.lineTo(sx + 14 + Math.sin(t) * 5 + 35, level.goalY - 45);
  ctx.lineTo(sx + 14, level.goalY - 30);
  ctx.fill();

  // Emoji flag
  ctx.font = '24px serif';
  ctx.fillText(WORLDS[currentWorld].emoji, sx, level.goalY - 65);
}

function drawRainbowTrail() {
  if (rainbowTrail.length < 2) return;
  for (let i = 0; i < rainbowTrail.length; i++) {
    const pt = rainbowTrail[i];
    const sx = pt.x - camera.x;
    const alpha = pt.life / pt.maxLife;
    const colorIdx = Math.floor((i / rainbowTrail.length) * RAINBOW_COLORS.length);
    ctx.globalAlpha = alpha * 0.8;
    ctx.fillStyle = RAINBOW_COLORS[colorIdx % RAINBOW_COLORS.length];
    const size = 6 + alpha * 6;
    ctx.fillRect(sx - size / 2, pt.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
}

function drawCat() {
  if (player.dead) return;
  const sx = player.x - camera.x;
  const sy = player.y;
  const t = Date.now() * 0.01;

  ctx.save();
  if (!player.facingRight) {
    ctx.translate(sx + player.w / 2, sy + player.h / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + player.w / 2), -(sy + player.h / 2));
  }

  // Body
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.roundRect(sx + 4, sy + 16, player.w - 8, player.h - 16, 8);
  ctx.fill();

  // Stripes
  ctx.fillStyle = 'rgba(150,80,0,0.4)';
  for (let s = 0; s < 3; s++) {
    ctx.fillRect(sx + 8 + s * 8, sy + 22, 4, 20);
  }

  // Head
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.ellipse(sx + player.w / 2, sy + 12, 18, 15, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#FFA500';
  ctx.beginPath();
  ctx.moveTo(sx + 6, sy + 4);
  ctx.lineTo(sx + 2, sy - 8);
  ctx.lineTo(sx + 14, sy + 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(sx + player.w - 6, sy + 4);
  ctx.lineTo(sx + player.w - 2, sy - 8);
  ctx.lineTo(sx + player.w - 14, sy + 2);
  ctx.fill();
  ctx.fillStyle = '#FF9999';
  ctx.beginPath();
  ctx.moveTo(sx + 7, sy + 3);
  ctx.lineTo(sx + 4, sy - 5);
  ctx.lineTo(sx + 12, sy + 2);
  ctx.fill();

  // Eyes
  ctx.fillStyle = '#2ECC71';
  ctx.beginPath(); ctx.ellipse(sx + 12, sy + 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + player.w - 12, sy + 10, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx + 12, sy + 10, 2, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + player.w - 12, sy + 10, 2, 4, 0, 0, Math.PI * 2); ctx.fill();

  // Nose
  ctx.fillStyle = '#FF6B9D';
  ctx.beginPath(); ctx.arc(sx + player.w / 2, sy + 15, 3, 0, Math.PI * 2); ctx.fill();

  // Whiskers
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  [[-1, 0], [-1, 1], [1, 0], [1, 1]].forEach(([dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(sx + player.w / 2 + dx * 3, sy + 16);
    ctx.lineTo(sx + player.w / 2 + dx * 20, sy + 16 + dy * 4);
    ctx.stroke();
  });

  // Tail
  const tailWag = Math.sin(t * 3) * 0.4;
  ctx.strokeStyle = '#FFA500';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sx + player.w - 4, sy + player.h - 10);
  ctx.quadraticCurveTo(sx + player.w + 20, sy + player.h - 20 + Math.sin(t * 3) * 15, sx + player.w + 10, sy + player.h - 30 + Math.cos(t * 3) * 10);
  ctx.stroke();

  // Legs (animated)
  ctx.fillStyle = '#FFA500';
  if (player.onGround && player.vx !== 0) {
    const legAnim = Math.sin(t * 8) * 8;
    ctx.fillRect(sx + 6, sy + player.h - 18, 10, 18 + legAnim);
    ctx.fillRect(sx + player.w - 16, sy + player.h - 18, 10, 18 - legAnim);
  } else {
    ctx.fillRect(sx + 6, sy + player.h - 18, 10, 18);
    ctx.fillRect(sx + player.w - 16, sy + player.h - 18, 10, 18);
  }

  // Wings (when powered up)
  if (player.winged) {
    const wingFlap = Math.sin(t * 12) * 0.3;
    ctx.fillStyle = player.flying ?
      `hsl(${(Date.now() * 0.2) % 360},100%,70%)` : 'rgba(200,200,255,0.8)';
    // Left wing
    ctx.save();
    ctx.translate(sx + 4, sy + 20);
    ctx.rotate(-0.3 + wingFlap);
    ctx.beginPath();
    ctx.ellipse(-18, -5, 22, 10, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Right wing
    ctx.save();
    ctx.translate(sx + player.w - 4, sy + 20);
    ctx.rotate(0.3 - wingFlap);
    ctx.beginPath();
    ctx.ellipse(18, -5, 22, 10, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // Water suit overlay
  if (waterSuit) {
    ctx.fillStyle = 'rgba(0,150,255,0.3)';
    ctx.beginPath();
    ctx.roundRect(sx + 4, sy + 16, player.w - 8, player.h - 16, 8);
    ctx.fill();
    ctx.strokeStyle = '#00BFFF';
    ctx.lineWidth = 2;
    ctx.strokeRect(sx + 4, sy + 16, player.w - 8, player.h - 16);
  }

  ctx.restore();
}

function drawMouse() {
  const sx = mouse.x - camera.x;
  const sy = mouse.y;
  if (sx + mouse.w < -50 || sx > W + 50) return;

  ctx.save();
  if (mouse.vx < 0) {
    ctx.translate(sx + mouse.w / 2, sy + mouse.h / 2);
    ctx.scale(-1, 1);
    ctx.translate(-(sx + mouse.w / 2), -(sy + mouse.h / 2));
  }

  const t = Date.now() * 0.01;

  // Body (giant mouse)
  ctx.fillStyle = '#9E9E9E';
  ctx.beginPath();
  ctx.ellipse(sx + mouse.w / 2, sy + mouse.h * 0.6, mouse.w / 2 - 2, mouse.h * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Head
  ctx.fillStyle = '#BDBDBD';
  ctx.beginPath();
  ctx.ellipse(sx + mouse.w / 2, sy + 20, 22, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = '#BDBDBD';
  ctx.beginPath(); ctx.ellipse(sx + 10, sy + 8, 10, 13, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + mouse.w - 10, sy + 8, 10, 13, 0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FF9999';
  ctx.beginPath(); ctx.ellipse(sx + 10, sy + 8, 6, 9, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + mouse.w - 10, sy + 8, 6, 9, 0.3, 0, Math.PI * 2); ctx.fill();

  // Eyes (menacing red)
  ctx.fillStyle = '#FF0000';
  ctx.beginPath(); ctx.ellipse(sx + 14, sy + 16, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + mouse.w - 14, sy + 16, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#000';
  ctx.beginPath(); ctx.ellipse(sx + 14, sy + 18, 2, 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(sx + mouse.w - 14, sy + 18, 2, 3, 0, 0, Math.PI * 2); ctx.fill();

  // Teeth (menacing)
  ctx.fillStyle = '#FFF';
  ctx.fillRect(sx + mouse.w / 2 - 8, sy + 28, 7, 10);
  ctx.fillRect(sx + mouse.w / 2 + 1, sy + 28, 7, 10);

  // Whiskers
  ctx.strokeStyle = 'rgba(50,50,50,0.7)';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 3; i++) {
    const angle = (-0.2 + i * 0.2);
    ctx.beginPath();
    ctx.moveTo(sx + mouse.w / 2, sy + 24);
    ctx.lineTo(sx + mouse.w / 2 - 30, sy + 24 + Math.sin(angle) * 15);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(sx + mouse.w / 2, sy + 24);
    ctx.lineTo(sx + mouse.w / 2 + 30, sy + 24 + Math.sin(angle) * 15);
    ctx.stroke();
  }

  // Tail
  ctx.strokeStyle = '#9E9E9E';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(sx + mouse.w - 4, sy + mouse.h * 0.6);
  ctx.quadraticCurveTo(sx + mouse.w + 25, sy + mouse.h * 0.3 + Math.sin(t * 4) * 15, sx + mouse.w + 15, sy + mouse.h * 0.1);
  ctx.stroke();

  // Legs
  const legMove = mouse.vx !== 0 ? Math.sin(t * 10) * 6 : 0;
  ctx.fillStyle = '#9E9E9E';
  ctx.fillRect(sx + 8, sy + mouse.h - 20, 12, 20 + legMove);
  ctx.fillRect(sx + mouse.w - 20, sy + mouse.h - 20, 12, 20 - legMove);

  // Shadow / angry indicator
  ctx.font = '16px serif';
  ctx.fillText('😤', sx + mouse.w - 5, sy - 5);

  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    const sx = p.x - camera.x;
    ctx.globalAlpha = p.life / 70;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(sx, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  // Wing timer bar
  if (player.winged) {
    const barW = 150;
    const barH = 12;
    const bx = W - barW - 10;
    const by = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(bx, by, barW, barH);
    const ratio = player.wingTimer / WING_DURATION;
    ctx.fillStyle = player.flying ? `hsl(${(Date.now() * 0.3) % 360},100%,60%)` : '#8B9DFF';
    ctx.fillRect(bx, by, barW * ratio, barH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx, by, barW, barH);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText('🦋 WING POWER', bx + 2, by + 10);
  }

  // Mouse danger indicator
  const mouseDist = Math.abs(player.x - mouse.x);
  if (mouseDist < 400) {
    const danger = 1 - mouseDist / 400;
    ctx.fillStyle = `rgba(255,0,0,${danger * 0.3})`;
    ctx.fillRect(0, 0, W, H);
    if (mouseDist < 200) {
      ctx.fillStyle = '#FF0000';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('⚠️ MOUSE INCOMING! ⚠️', W / 2, 35);
      ctx.textAlign = 'left';
    }
  }

  // Message
  if (msgTimer > 0) {
    ctx.globalAlpha = Math.min(1, msgTimer / 30);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(msgText, W / 2, H / 2 - 60);
    ctx.textAlign = 'left';
    ctx.globalAlpha = 1;
    msgTimer--;
  }

  // UI elements
  document.getElementById('livesUI').textContent = '❤️ ' + lives;
  document.getElementById('worldUI').textContent = WORLDS[currentWorld].name;
  document.getElementById('levelUI').textContent = 'Level ' + (currentLevel + 1) + '/8';
  document.getElementById('powerUI').textContent = player.winged ? (player.flying ? '🦋✨' : '🦋') : (waterSuit ? '🐠' : '');
}

// ─── Screen Renderers ─────────────────────────────────────────────────────────
function drawTitle() {
  // Background
  const t = Date.now() * 0.001;
  ctx.fillStyle = '#1a0a2e';
  ctx.fillRect(0, 0, W, H);

  // Animated rainbow title
  ctx.font = 'bold 64px monospace';
  ctx.textAlign = 'center';
  const titleText = 'WINGCAT';
  for (let i = 0; i < titleText.length; i++) {
    const hue = (i * 51 + t * 80) % 360;
    ctx.fillStyle = `hsl(${hue},100%,65%)`;
    ctx.fillText(titleText[i], W / 2 - (titleText.length - 1) * 20 + i * 40, 140 + Math.sin(t * 3 + i) * 10);
  }

  // Subtitle
  ctx.font = '22px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('🐱 The Flying Cat Adventure 🐱', W / 2, 200);

  // Cat illustration
  drawTitleCat(W / 2, 270, t);

  // Instructions
  ctx.font = '18px monospace';
  ctx.fillStyle = Math.sin(t * 3) > 0 ? '#FFD700' : '#FFA500';
  ctx.fillText('Press SPACE or ↑ to Start', W / 2, 360);

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('8 Worlds · 8 Levels Each · Collect Wings · Outrun the Giant Mouse!', W / 2, 400);
  ctx.textAlign = 'left';
}

function drawTitleCat(cx, cy, t) {
  ctx.save();
  ctx.translate(cx, cy);
  const scale = 1.2 + Math.sin(t * 2) * 0.05;
  ctx.scale(scale, scale);

  // Rainbow trail
  for (let i = 0; i < 8; i++) {
    ctx.fillStyle = `hsl(${i * 45},100%,60%)`;
    ctx.globalAlpha = 0.7;
    ctx.fillRect(-60 - i * 15, 5 + Math.sin(t * 3 + i * 0.5) * 5, 12, 12);
  }
  ctx.globalAlpha = 1;

  // Body
  ctx.fillStyle = '#FFA500';
  ctx.beginPath(); ctx.roundRect(-20, -10, 40, 35, 8); ctx.fill();

  // Head
  ctx.beginPath(); ctx.ellipse(0, -15, 20, 16, 0, 0, Math.PI * 2); ctx.fill();

  // Ears
  ctx.beginPath(); ctx.moveTo(-14, -22); ctx.lineTo(-20, -34); ctx.lineTo(-6, -22); ctx.fill();
  ctx.beginPath(); ctx.moveTo(14, -22); ctx.lineTo(20, -34); ctx.lineTo(6, -22); ctx.fill();

  // Eyes
  ctx.fillStyle = '#2ECC71';
  ctx.beginPath(); ctx.ellipse(-7, -16, 4, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(7, -16, 4, 5, 0, 0, Math.PI * 2); ctx.fill();

  // Wings
  const wingFlap = Math.sin(t * 8) * 0.4;
  ctx.fillStyle = `hsl(${(t * 100) % 360},100%,70%)`;
  ctx.save(); ctx.translate(-20, 0); ctx.rotate(-0.5 + wingFlap);
  ctx.beginPath(); ctx.ellipse(-18, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.translate(20, 0); ctx.rotate(0.5 - wingFlap);
  ctx.beginPath(); ctx.ellipse(18, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  ctx.restore();
}

function drawWorldSelect() {
  ctx.fillStyle = '#1a0a2e';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  ctx.font = 'bold 32px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('SELECT WORLD', W / 2, 50);

  const cols = 4;
  const rows = 2;
  const cellW = 180;
  const cellH = 140;
  const startX = (W - cols * cellW) / 2;
  const startY = 80;

  WORLDS.forEach((w, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = startX + col * cellW;
    const y = startY + row * cellH;
    const isHovered = hoveredWorld === i;

    ctx.fillStyle = isHovered ? 'rgba(255,215,0,0.3)' : 'rgba(255,255,255,0.1)';
    ctx.fillRect(x + 5, y + 5, cellW - 10, cellH - 10);
    ctx.strokeStyle = isHovered ? '#FFD700' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = isHovered ? 3 : 1;
    ctx.strokeRect(x + 5, y + 5, cellW - 10, cellH - 10);

    ctx.font = '36px serif';
    ctx.fillText(w.emoji, x + cellW / 2, y + 55);
    ctx.font = isHovered ? 'bold 13px monospace' : '12px monospace';
    ctx.fillStyle = isHovered ? '#FFD700' : '#fff';
    ctx.fillText(w.name, x + cellW / 2, y + 80);
    ctx.font = '10px monospace';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('World ' + (i + 1), x + cellW / 2, y + 98);
  });

  ctx.font = '14px monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Click a world or press 1-8 to select', W / 2, H - 15);
  ctx.textAlign = 'left';
}

let hoveredWorld = -1;

canvas.addEventListener('mousemove', e => {
  if (state !== 'worldSelect') return;
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (W / rect.width);
  const my = (e.clientY - rect.top) * (H / rect.height);
  const cols = 4, cellW = 180, cellH = 140;
  const startX = (W - cols * cellW) / 2;
  const startY = 80;
  hoveredWorld = -1;
  WORLDS.forEach((_, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const x = startX + col * cellW + 5;
    const y = startY + row * cellH + 5;
    if (mx >= x && mx <= x + cellW - 10 && my >= y && my <= y + cellH - 10) hoveredWorld = i;
  });
});

canvas.addEventListener('click', e => {
  if (state === 'worldSelect') {
    if (hoveredWorld >= 0) selectWorld(hoveredWorld);
  }
});

window.addEventListener('keydown', e => {
  if (state === 'worldSelect') {
    const num = parseInt(e.key);
    if (num >= 1 && num <= 8) selectWorld(num - 1);
  }
});

function selectWorld(idx) {
  currentWorld = idx;
  currentLevel = 0;
  initGame();
  state = 'game';
}

function drawPauseScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.font = 'bold 48px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '20px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Press ESC to continue', W / 2, H / 2 + 30);
  ctx.textAlign = 'left';
}

function drawDeadScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  if (lives <= 0) {
    ctx.font = 'bold 48px monospace';
    ctx.fillStyle = '#FF4444';
    ctx.fillText('GAME OVER', W / 2, H / 2 - 40);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('The giant mouse got you! 🐭', W / 2, H / 2 + 10);
    ctx.fillText('Press ENTER to try again from the start', W / 2, H / 2 + 50);
  } else {
    ctx.font = 'bold 42px monospace';
    ctx.fillStyle = '#FF6347';
    ctx.fillText('YOU DIED! 😿', W / 2, H / 2 - 40);
    ctx.font = '20px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Lives remaining: ${'❤️'.repeat(lives)}`, W / 2, H / 2 + 10);
    ctx.fillText('Press ENTER to retry', W / 2, H / 2 + 50);
  }
  ctx.textAlign = 'left';
}

function drawWinScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  const t = Date.now() * 0.003;
  ctx.font = 'bold 48px monospace';
  // Rainbow text
  'LEVEL CLEAR!'.split('').forEach((c, i) => {
    ctx.fillStyle = `hsl(${(i * 30 + t * 100) % 360},100%,65%)`;
    ctx.fillText(c, W / 2 - 160 + i * 28, H / 2 - 40);
  });

  ctx.font = '22px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`${WORLDS[currentWorld].name} - Level ${currentLevel + 1}`, W / 2, H / 2 + 20);
  ctx.font = '18px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Press ENTER to continue', W / 2, H / 2 + 60);
  ctx.textAlign = 'left';
}

function drawWorldCompleteScreen() {
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';

  const t = Date.now() * 0.003;
  ctx.font = 'bold 40px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('🎉 WORLD COMPLETE! 🎉', W / 2, H / 2 - 60);

  ctx.font = '28px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText(WORLDS[currentWorld].emoji + ' ' + WORLDS[currentWorld].name, W / 2, H / 2 - 10);
  ctx.fillText('Conquered!', W / 2, H / 2 + 30);

  if (currentWorld < 7) {
    ctx.font = '18px monospace';
    ctx.fillStyle = '#87CEEB';
    ctx.fillText('Next: ' + WORLDS[currentWorld + 1].emoji + ' ' + WORLDS[currentWorld + 1].name, W / 2, H / 2 + 75);
  }

  ctx.font = '18px monospace';
  ctx.fillStyle = Math.sin(t * 4) > 0 ? '#FFD700' : '#FFA500';
  ctx.fillText('Press ENTER to continue', W / 2, H / 2 + 110);
  ctx.textAlign = 'left';
}

function drawGameCompleteScreen() {
  const t = Date.now() * 0.002;
  // Full rainbow background
  for (let i = 0; i < RAINBOW_COLORS.length; i++) {
    ctx.fillStyle = RAINBOW_COLORS[i];
    ctx.fillRect(0, i * (H / RAINBOW_COLORS.length), W, H / RAINBOW_COLORS.length + 1);
  }

  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(0, 0, W, H);

  ctx.textAlign = 'center';
  ctx.font = 'bold 52px monospace';
  '🌈 YOU WIN! 🌈'.split('').forEach((c, i) => {
    ctx.fillStyle = `hsl(${(i * 20 + t * 150) % 360},100%,75%)`;
    ctx.fillText(c, W / 2 - 210 + i * 30, H / 2 - 60 + Math.sin(t * 4 + i) * 8);
  });

  ctx.font = '22px monospace';
  ctx.fillStyle = '#FFD700';
  ctx.fillText('WingCat has conquered all 8 worlds!', W / 2, H / 2 + 10);
  ctx.font = '18px monospace';
  ctx.fillStyle = '#fff';
  ctx.fillText('Thank you for playing! 🐱', W / 2, H / 2 + 50);
  ctx.fillText('Press ENTER to play again', W / 2, H / 2 + 90);
  ctx.textAlign = 'left';
}

// ─── Game Loop ────────────────────────────────────────────────────────────────
let lastTime = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 16.67, 3);
  lastTime = timestamp;

  ctx.clearRect(0, 0, W, H);

  if (state === 'title') {
    drawTitle();
  } else if (state === 'worldSelect') {
    drawWorldSelect();
  } else if (state === 'game' || state === 'paused') {
    // Update
    if (state === 'game') {
      updatePlayer(dt);
      updateMouse();
      updateParticles();
    }

    // Draw game world
    ctx.save();
    drawBackground();
    drawRainbowTrail();
    drawPlatforms();
    drawBoxes();
    drawGoal();
    drawMouse();
    drawCat();
    drawParticles();
    ctx.restore();

    drawHUD();
    if (state === 'paused') drawPauseScreen();

  } else if (state === 'dead') {
    // Draw game world (frozen)
    ctx.save();
    drawBackground();
    drawRainbowTrail();
    drawPlatforms();
    drawBoxes();
    drawGoal();
    drawMouse();
    // Dead cat spin
    ctx.save();
    ctx.translate(player.x - camera.x + player.w / 2, player.y + player.h / 2);
    ctx.rotate(Date.now() * 0.005);
    ctx.translate(-(player.w / 2), -(player.h / 2));
    drawCat();
    ctx.restore();
    drawParticles();
    ctx.restore();
    drawDeadScreen();

  } else if (state === 'win') {
    ctx.save();
    drawBackground();
    drawRainbowTrail();
    drawPlatforms();
    drawBoxes();
    drawGoal();
    drawCat();
    drawParticles();
    ctx.restore();
    drawWinScreen();
  } else if (state === 'worldComplete') {
    drawWorldCompleteScreen();
  } else if (state === 'gameComplete') {
    drawGameCompleteScreen();
  }

  requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
