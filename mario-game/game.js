// ═══════════════════════════════════════════════════
//  Super Kiro Bros – game.js
// ═══════════════════════════════════════════════════

const canvas  = document.getElementById('gameCanvas');
const ctx     = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const livesEl = document.getElementById('lives');
const scoreEl = document.getElementById('score');
const levelEl = document.getElementById('level');

// ───────── CONSTANTES ─────────
const W        = canvas.width;
const H        = canvas.height;
const GRAVITY  = 0.5;
const GROUND_Y = H - 60;
const TILE     = 40;

// ───────── ESTADO GLOBAL ─────────
let gameState = 'menu'; // menu | playing | dead | win | gameover
let score     = 0;
let lives     = 3;
let level     = 1;
let keys      = {};
let cameraX   = 0;
let player;
let currentLevel;

// ════════════════════════════════════════════════════
//  GERADOR DE FASES
// ════════════════════════════════════════════════════
function buildLevel(lvl) {
  const worldWidth = 3200;
  const platforms  = [];
  const coins      = [];
  const enemies    = [];

  // Chão base
  for (let x = 0; x < worldWidth; x += TILE) {
    platforms.push({ x, y: GROUND_Y, w: TILE, h: 60, color: '#5d3a1a' });
  }

  // Plataformas flutuantes
  const seed = lvl * 7;
  const positions = [
    { x: 300,  y: 260 }, { x: 400,  y: 260 }, { x: 500,  y: 260 },
    { x: 700,  y: 220 }, { x: 800,  y: 220 },
    { x: 1000, y: 280 }, { x: 1100, y: 280 }, { x: 1200, y: 280 },
    { x: 1400, y: 200 }, { x: 1500, y: 200 }, { x: 1600, y: 200 },
    { x: 1800, y: 260 }, { x: 1900, y: 260 },
    { x: 2100, y: 220 }, { x: 2200, y: 220 }, { x: 2300, y: 220 },
    { x: 2500, y: 180 }, { x: 2600, y: 180 }, { x: 2700, y: 180 },
  ];

  positions.forEach(p => {
    platforms.push({
      x: p.x,
      y: p.y + (seed % 20) - 10,
      w: TILE,
      h: TILE,
      color: '#27ae60',
    });
  });

  // Moedas
  for (let i = 0; i < 30 + lvl * 5; i++) {
    const px = 200 + i * 90;
    const py = GROUND_Y - 30 - Math.floor(Math.random() * 100);
    coins.push({ x: px, y: py, r: 10, collected: false, anim: Math.random() * Math.PI * 2 });
  }

  // Inimigos (Goomba-like)
  for (let i = 0; i < 6 + lvl * 2; i++) {
    enemies.push({
      x:        400 + i * 320,
      y:        GROUND_Y - 36,
      w:        36,
      h:        36,
      vx:       -(0.8 + lvl * 0.2),
      vy:       0,
      alive:    true,
      onGround: true,
      eyeAnim:  0,
    });
  }

  // Bandeira (fim da fase)
  const flag = { x: worldWidth - 160, y: GROUND_Y - 200, w: 20, h: 200 };

  return { platforms, coins, enemies, flag, worldWidth };
}

// ════════════════════════════════════════════════════
//  JOGADOR
// ════════════════════════════════════════════════════
function createPlayer() {
  return {
    x: 80, y: GROUND_Y - 48,
    w: 32, h: 48,
    vx: 0, vy: 0,
    onGround:   false,
    invincible: 0,
    walkFrame:  0,
    walkTimer:  0,
    facing:     1, // 1 = direita, -1 = esquerda
  };
}

// ════════════════════════════════════════════════════
//  CONTROLE DE FASES / HUD
// ════════════════════════════════════════════════════
function updateHUD() {
  livesEl.textContent = lives;
  scoreEl.textContent = score;
  levelEl.textContent = level;
}

function loadLevel() {
  player       = createPlayer();
  currentLevel = buildLevel(level);
  cameraX      = 0;
}

function startGame() {
  score = 0; lives = 3; level = 1;
  updateHUD();
  loadLevel();
  gameState = 'playing';
  overlay.style.display = 'none';
  loop();
}

function showOverlay(title, msg, btnLabel) {
  overlay.innerHTML = `
    <h1>${title}</h1>
    <p>${msg}</p>
    <button id="startBtn">▶ ${btnLabel}</button>
  `;
  overlay.style.display = 'flex';
  document.getElementById('startBtn').addEventListener('click', startGame);
}

function playerDie() {
  lives--;
  updateHUD();
  if (lives <= 0) {
    gameState = 'gameover';
    showOverlay('💀 GAME OVER', `Pontuação: ${score}`, 'TENTAR NOVAMENTE');
  } else {
    player  = createPlayer();
    cameraX = 0;
  }
}

// ════════════════════════════════════════════════════
//  COLISÃO AABB
// ════════════════════════════════════════════════════
function rectCollide(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// ════════════════════════════════════════════════════
//  UPDATE
// ════════════════════════════════════════════════════
function update() {
  if (gameState !== 'playing') return;

  const { platforms, coins, enemies, flag, worldWidth } = currentLevel;
  const p = player;

  // — Movimento horizontal —
  const speed = 3.5;
  if (keys['ArrowLeft']  || keys['a']) { p.vx = -speed; p.facing = -1; }
  else if (keys['ArrowRight'] || keys['d']) { p.vx = speed;  p.facing =  1; }
  else p.vx *= 0.8;

  // — Pulo —
  if ((keys['ArrowUp'] || keys[' '] || keys['w']) && p.onGround) {
    p.vy       = -12;
    p.onGround = false;
  }

  // — Gravidade —
  p.vy += GRAVITY;
  p.x  += p.vx;
  p.y  += p.vy;

  // — Limitar no mundo —
  if (p.x < 0)              p.x = 0;
  if (p.x + p.w > worldWidth) p.x = worldWidth - p.w;

  // — Colisão com plataformas —
  p.onGround = false;
  for (const plat of platforms) {
    if (!rectCollide(p, plat)) continue;

    const overlapX = Math.min(p.x + p.w - plat.x, plat.x + plat.w - p.x);
    const overlapY = Math.min(p.y + p.h - plat.y, plat.y + plat.h - p.y);

    if (overlapY < overlapX) {
      if (p.vy > 0 && p.y + p.h - p.vy <= plat.y + 2) {
        p.y        = plat.y - p.h;
        p.vy       = 0;
        p.onGround = true;
      } else if (p.vy < 0) {
        p.y  = plat.y + plat.h;
        p.vy = 0;
      }
    } else {
      p.x  = p.vx > 0 ? plat.x - p.w : plat.x + plat.w;
      p.vx = 0;
    }
  }

  // — Morreu caindo —
  if (p.y > H + 100) { playerDie(); return; }

  // — Câmera —
  cameraX = Math.max(0, Math.min(p.x - W / 3, worldWidth - W));

  // — Moedas —
  for (const c of coins) {
    if (c.collected) continue;
    c.anim += 0.08;
    const hitbox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (rectCollide(p, hitbox)) {
      c.collected = true;
      score      += 100;
      updateHUD();
    }
  }

  // — Inimigos —
  for (const e of enemies) {
    if (!e.alive) continue;
    e.eyeAnim += 0.1;
    e.vy      += GRAVITY;
    e.x       += e.vx;
    e.y       += e.vy;

    // Colisão inimigo × plataforma
    for (const plat of platforms) {
      if (!rectCollide(e, plat)) continue;
      const ovY = Math.min(e.y + e.h - plat.y, plat.y + plat.h - e.y);
      const ovX = Math.min(e.x + e.w - plat.x, plat.x + plat.w - e.x);
      if (ovY < ovX && e.vy > 0 && e.y + e.h - e.vy <= plat.y + 2) {
        e.y        = plat.y - e.h;
        e.vy       = 0;
        e.onGround = true;
      } else {
        e.vx *= -1;
      }
    }

    if (e.x < 0 || e.x > worldWidth) e.vx *= -1;

    // Colisão jogador × inimigo
    if (p.invincible <= 0 && rectCollide(p, e)) {
      if (p.vy > 0 && p.y + p.h < e.y + e.h * 0.6) {
        // Pisou no inimigo
        e.alive  = false;
        p.vy     = -8;
        score   += 200;
        updateHUD();
      } else {
        playerDie();
        return;
      }
    }
  }

  // — Bandeira (chegou ao fim) —
  if (rectCollide(p, { x: flag.x, y: flag.y, w: flag.w, h: flag.h })) {
    score += 500 * level;
    updateHUD();
    if (level < 3) {
      level++;
      updateHUD();
      loadLevel();
    } else {
      gameState = 'win';
      showOverlay('🏆 VOCÊ VENCEU!', `Pontuação Final: ${score}`, 'JOGAR NOVAMENTE');
    }
    return;
  }

  // — Animação de caminhada —
  p.walkTimer++;
  if (Math.abs(p.vx) > 0.5 && p.walkTimer % 8 === 0)
    p.walkFrame = (p.walkFrame + 1) % 2;

  if (p.invincible > 0) p.invincible--;
}

// ════════════════════════════════════════════════════
//  DESENHO
// ════════════════════════════════════════════════════

/** Nuvem decorativa */
function drawCloud(x, y) {
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(x,      y,      25, 0, Math.PI * 2);
  ctx.arc(x + 30, y - 10, 30, 0, Math.PI * 2);
  ctx.arc(x + 65, y,      25, 0, Math.PI * 2);
  ctx.fill();
}

function drawBackground() {
  // Gradiente de céu
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#5c94fc');
  grad.addColorStop(1, '#9db8f9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Nuvens com parallax leve
  [[120, 60], [380, 40], [620, 70], [900, 50]].forEach(([cx, cy]) => {
    const nx = ((cx - cameraX * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
    drawCloud(nx, cy);
  });

  // Montanhas com parallax médio
  ctx.fillStyle = '#7b9e3a';
  [[80, 300], [280, 260], [500, 310], [720, 270], [940, 300]].forEach(([mx, my]) => {
    const nx = ((mx - cameraX * 0.6) % (W + 300) + W + 300) % (W + 300) - 150;
    ctx.beginPath();
    ctx.moveTo(nx - 80, GROUND_Y);
    ctx.lineTo(nx,       my);
    ctx.lineTo(nx + 80,  GROUND_Y);
    ctx.fill();
  });
}

function drawPlatforms() {
  for (const p of currentLevel.platforms) {
    const sx = p.x - cameraX;
    if (sx + p.w < 0 || sx > W) continue;

    if (p.h === 60) {
      // Chão
      ctx.fillStyle = '#228B22';
      ctx.fillRect(sx, p.y, p.w, 12);
      ctx.fillStyle = '#5d3a1a';
      ctx.fillRect(sx, p.y + 12, p.w, p.h - 12);
    } else {
      // Bloco tijolo flutuante
      ctx.fillStyle   = '#c0803b';
      ctx.fillRect(sx, p.y, p.w, p.h);
      ctx.fillStyle   = '#e09050';
      ctx.fillRect(sx + 2, p.y + 2, p.w - 4, 10);
      ctx.strokeStyle = '#6B3410';
      ctx.lineWidth   = 2;
      ctx.strokeRect(sx, p.y, p.w, p.h);
    }
  }
}

function drawCoins() {
  for (const c of currentLevel.coins) {
    if (c.collected) continue;
    const sx = c.x - cameraX;
    if (sx + c.r < 0 || sx - c.r > W) continue;

    const bob = Math.sin(c.anim) * 3;

    // Sombra
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx, c.y + c.r + bob + 2, c.r * 0.8, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Moeda dourada
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(sx, c.y + bob, c.r, 0, Math.PI * 2);
    ctx.fill();

    // Reflexo
    ctx.fillStyle = '#FFA500';
    ctx.beginPath();
    ctx.arc(sx - 2, c.y + bob - 2, c.r * 0.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath();
    ctx.arc(sx - 3, c.y + bob - 3, c.r * 0.25, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawEnemies() {
  for (const e of currentLevel.enemies) {
    if (!e.alive) continue;
    const sx = e.x - cameraX;
    if (sx + e.w < 0 || sx > W) continue;

    // Corpo redondo
    ctx.fillStyle = '#8B4513';
    ctx.beginPath();
    ctx.arc(sx + e.w / 2, e.y + e.h / 2 - 2, e.w / 2, 0, Math.PI * 2);
    ctx.fill();

    // Chapéu
    ctx.fillStyle = '#3a2000';
    ctx.fillRect(sx + 4, e.y + 2,  e.w - 8, 10);
    ctx.fillRect(sx,     e.y + 10, e.w,     6);

    // Olhos
    ctx.fillStyle = 'white';
    ctx.fillRect(sx + 6,          e.y + 16, 8, 8);
    ctx.fillRect(sx + e.w - 14,   e.y + 16, 8, 8);

    ctx.fillStyle = '#000';
    const eOff = Math.sin(e.eyeAnim) > 0 ? 1 : 0;
    ctx.fillRect(sx + 7 + eOff,         e.y + 18, 4, 4);
    ctx.fillRect(sx + e.w - 13 + eOff,  e.y + 18, 4, 4);

    // Pés
    ctx.fillStyle = '#3a2000';
    ctx.fillRect(sx + 2,          e.y + e.h - 10, 12, 10);
    ctx.fillRect(sx + e.w - 14,   e.y + e.h - 10, 12, 10);
  }
}

function drawPlayer() {
  const p  = player;
  // Pisca quando invencível
  if (p.invincible > 0 && Math.floor(p.invincible / 4) % 2 === 0) return;

  const sx = p.x - cameraX;

  ctx.save();
  if (p.facing === -1) {
    ctx.scale(-1, 1);
    ctx.translate(-sx * 2 - p.w, 0);
  }

  // Sapatos
  ctx.fillStyle = '#5d3a1a';
  ctx.fillRect(sx,              p.y + p.h - 12, 14, 12);
  ctx.fillRect(sx + p.w - 14,  p.y + p.h - 12, 14, 12);

  // Calça
  ctx.fillStyle = '#1a56b0';
  ctx.fillRect(sx + 2, p.y + p.h - 26, p.w - 4, 16);

  // Camisa
  ctx.fillStyle = '#e03030';
  ctx.fillRect(sx + 2, p.y + 20, p.w - 4, p.h - 46);

  // Luvas
  ctx.fillStyle = '#fff';
  const handY = p.y + 30 + (p.walkFrame === 0 ? 0 : 4);
  ctx.fillRect(sx - 4,         handY, 10, 10);
  ctx.fillRect(sx + p.w - 6,   handY, 10, 10);

  // Cabeça
  ctx.fillStyle = '#f5cba7';
  ctx.fillRect(sx + 4, p.y, p.w - 8, 20);

  // Chapéu
  ctx.fillStyle = '#e03030';
  ctx.fillRect(sx,     p.y - 8,  p.w,     10);
  ctx.fillRect(sx + 4, p.y - 16, p.w - 8, 10);

  // Bigode
  ctx.fillStyle = '#5d3a1a';
  ctx.fillRect(sx + 6, p.y + 12, p.w - 12, 5);

  // Olho
  ctx.fillStyle = '#fff';
  ctx.fillRect(sx + 7, p.y + 4, 7, 7);
  ctx.fillStyle = '#000';
  ctx.fillRect(sx + 9, p.y + 5, 4, 4);

  ctx.restore();
}

function drawFlag() {
  const { flag } = currentLevel;
  const sx = flag.x - cameraX;
  if (sx + flag.w < 0 || sx > W) return;

  // Mastro
  ctx.fillStyle = '#aaa';
  ctx.fillRect(sx + 8, flag.y, 4, flag.h);

  // Pano da bandeira
  ctx.fillStyle = '#27ae60';
  ctx.beginPath();
  ctx.moveTo(sx + 12, flag.y);
  ctx.lineTo(sx + 50, flag.y + 15);
  ctx.lineTo(sx + 12, flag.y + 30);
  ctx.closePath();
  ctx.fill();

  // Esfera no topo
  ctx.fillStyle = '#FFD700';
  ctx.beginPath();
  ctx.arc(sx + 10, flag.y, 8, 0, Math.PI * 2);
  ctx.fill();
}

function drawHUDBar() {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(0, H - 30, W, 30);
  ctx.fillStyle = '#fff';
  ctx.font      = '12px monospace';
  ctx.fillText('← → Mover  |  ↑ / ESPAÇO Pular  |  Pise nos inimigos para eliminá-los!', 10, H - 10);
}

function draw() {
  ctx.clearRect(0, 0, W, H);
  drawBackground();
  drawPlatforms();
  drawCoins();
  drawEnemies();
  drawPlayer();
  drawFlag();
  drawHUDBar();
}

// ════════════════════════════════════════════════════
//  LOOP PRINCIPAL
// ════════════════════════════════════════════════════
function loop() {
  if (gameState !== 'playing') return;
  update();
  draw();
  requestAnimationFrame(loop);
}

// ════════════════════════════════════════════════════
//  CONTROLES
// ════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  keys[e.key] = true;
  if (e.key === ' ') e.preventDefault();
});

document.addEventListener('keyup', e => {
  keys[e.key] = false;
});

// ════════════════════════════════════════════════════
//  INICIALIZAÇÃO
// ════════════════════════════════════════════════════
document.getElementById('startBtn').addEventListener('click', startGame);

// Tela de título estática enquanto o menu está visível
(function titleScreen() {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#5c94fc');
  grad.addColorStop(1, '#9db8f9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#228B22';
  ctx.fillRect(0, H - 60, W, 10);
  ctx.fillStyle = '#5d3a1a';
  ctx.fillRect(0, H - 50, W, 50);

  drawCloud(150, 60);
  drawCloud(500, 40);
  drawCloud(680, 70);
})();
