const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const canvasWrap = document.getElementById("canvasWrap");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const tapText = document.getElementById("tapText");
const summary = document.getElementById("summary");
const finalScore = document.getElementById("finalScore");
const newHighBadge = document.getElementById("newHighBadge");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const flapBtn = document.getElementById("flapBtn");
const scoreEl = document.getElementById("score");
const bestEl = document.getElementById("best");
const particleLayer = document.getElementById("particleLayer");
const scorePopLayer = document.getElementById("scorePopLayer");

const world = {
  gravity: 0.48,
  flapForce: -6.8,
  maxFallSpeed: 8.4,
  velocityEasing: 0.18,
  rotationEasing: 0.2,
  speed: 2.8,
  pipeGap: 200,
  spawnEvery: 130,
  floorHeight: 78,
};

const difficultyConfig = {
  baseGap: 200,
  minGap: 110,
  baseSpeed: 2.8,
  maxSpeed: 5.4,
  baseGravity: 0.48,
  maxGravity: 0.68,
  baseFlapForce: -6.8,
  minFlapForce: -5.9,
  baseSpawnEvery: 130,
  minSpawnEvery: 92,
  basePipeMargin: 85,
  minPipeMargin: 56,
};

const bird = {
  x: 88,
  y: canvas.height / 2,
  size: 22,
  velocity: 0,
  targetVelocity: 0,
  rotation: 0,
};

const uiState = {
  displayedScore: 0,
};

const audioState = {
  context: null,
  bgNode: null,
};

const difficultyState = {
  factor: 1,
  gap: difficultyConfig.baseGap,
  speed: difficultyConfig.baseSpeed,
  gravity: difficultyConfig.baseGravity,
  flapForce: difficultyConfig.baseFlapForce,
  spawnEvery: difficultyConfig.baseSpawnEvery,
  pipeMargin: difficultyConfig.basePipeMargin,
  level: 1,
};

let pipes = [];
let cloudOffset = 0;
let frame = 0;
let score = 0;
const HIGH_SCORE_KEY = "happyBirdBest";
let bestScore = 0;
let gameState = "idle";
let spawnTimer = 0;
let minorShakeCooldown = 0;

bestScore = loadHighScore();
bestEl.textContent = String(bestScore);


function loadHighScore() {
  const saved = Number(localStorage.getItem(HIGH_SCORE_KEY));
  if (Number.isFinite(saved) && saved >= 0) {
    return Math.floor(saved);
  }
  localStorage.setItem(HIGH_SCORE_KEY, "0");
  return 0;
}

function persistHighScore(nextHighScore) {
  if (nextHighScore === bestScore) {
    return false;
  }
  bestScore = nextHighScore;
  bestEl.textContent = String(bestScore);
  localStorage.setItem(HIGH_SCORE_KEY, String(bestScore));
  return true;
}

function syncHighScoreWithScore() {
  if (score > bestScore) {
    return persistHighScore(score);
  }
  return false;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getLevel(scoreValue) {
  if (scoreValue <= 10) {
    return { id: 1, name: "Easy" };
  }
  if (scoreValue <= 25) {
    return { id: 2, name: "Medium" };
  }
  if (scoreValue <= 50) {
    return { id: 3, name: "Hard" };
  }
  return { id: 4, name: "Expert" };
}

function updateDifficulty() {
  difficultyState.factor = clamp(1 + score * 0.02, 1, 2.4);

  difficultyState.gap = clamp(
    difficultyConfig.baseGap - score * 1.8,
    difficultyConfig.minGap,
    difficultyConfig.baseGap
  );

  difficultyState.speed = clamp(
    difficultyConfig.baseSpeed + score * 0.04,
    difficultyConfig.baseSpeed,
    difficultyConfig.maxSpeed
  );

  difficultyState.gravity = clamp(
    difficultyConfig.baseGravity + score * 0.003,
    difficultyConfig.baseGravity,
    difficultyConfig.maxGravity
  );

  difficultyState.flapForce = clamp(
    difficultyConfig.baseFlapForce + score * 0.015,
    difficultyConfig.baseFlapForce,
    difficultyConfig.minFlapForce
  );

  difficultyState.spawnEvery = clamp(
    difficultyConfig.baseSpawnEvery - score * 0.72,
    difficultyConfig.minSpawnEvery,
    difficultyConfig.baseSpawnEvery
  );

  difficultyState.pipeMargin = clamp(
    difficultyConfig.basePipeMargin - score * 0.32,
    difficultyConfig.minPipeMargin,
    difficultyConfig.basePipeMargin
  );

  world.pipeGap = difficultyState.gap;
}

function showLevelUp(levelInfo) {
  const pop = document.createElement("span");
  pop.className = "score-pop";
  pop.textContent = `Level ${levelInfo.id}: ${levelInfo.name}`;
  pop.style.left = "50%";
  pop.style.top = "30%";
  pop.style.transform = "translateX(-50%)";
  pop.style.fontSize = "1rem";
  scorePopLayer.appendChild(pop);
  setTimeout(() => pop.remove(), 760);
}

function resetGame() {
  pipes = [];
  frame = 0;
  score = 0;
  spawnTimer = 0;
  minorShakeCooldown = 0;
  uiState.displayedScore = 0;
  cloudOffset = 0;
  bird.y = canvas.height / 2;
  bird.velocity = 0;
  bird.targetVelocity = 0;
  bird.rotation = 0;
  difficultyState.level = 1;
  updateDifficulty();
  scoreEl.textContent = "0";
  scoreEl.classList.remove("bump");
}

function startGame() {
  initAudio();
  playButtonSound();
  resetGame();
  gameState = "running";
  hideOverlay();
  pulseScore();
}

function gameOver() {
  gameState = "over";
  canvasWrap.classList.add("shake");
  setTimeout(() => canvasWrap.classList.remove("shake"), 330);

  const isNewHigh = syncHighScoreWithScore();

  finalScore.textContent = String(score);
  summary.hidden = false;
  newHighBadge.hidden = !isNewHigh;

  showOverlay(
    "Oops! Abhay Bird bumped.",
    `High Score: ${bestScore} · Tap restart and soar higher!`
  );
}

function showOverlay(title, text) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  overlay.classList.remove("hidden");
  tapText.style.display = gameState === "idle" ? "block" : "none";
  startBtn.textContent = gameState === "over" ? "Play Again" : "Start Game";
}

function hideOverlay() {
  overlay.classList.add("hidden");
  summary.hidden = true;
  newHighBadge.hidden = true;
}

function flap() {
  if (gameState === "idle") {
    startGame();
  }
  if (gameState !== "running") {
    return;
  }
  bird.targetVelocity = difficultyState.flapForce;
  spawnFlapParticles();
  playFlapSound();
}

function spawnPipe() {
  const topMin = difficultyState.pipeMargin;
  const topMax =
    canvas.height - world.floorHeight - world.pipeGap - difficultyState.pipeMargin;

  let top = Math.random() * (topMax - topMin) + topMin;

  if (score >= 25 && Math.random() < Math.min(0.32, 0.08 + score * 0.003)) {
    const offset = (Math.random() - 0.5) * (12 + score * 0.45);
    top = clamp(top + offset, topMin, topMax);
  }

  pipes.push({
    x: canvas.width + 45,
    width: 66,
    top,
    counted: false,
  });
}

function animateScore() {
  uiState.displayedScore += (score - uiState.displayedScore) * 0.28;
  if (Math.abs(score - uiState.displayedScore) < 0.02) {
    uiState.displayedScore = score;
  }
  scoreEl.textContent = String(Math.round(uiState.displayedScore));
}

function pulseScore() {
  scoreEl.classList.add("bump");
  setTimeout(() => scoreEl.classList.remove("bump"), 210);
}

function popScoreText(x, y) {
  const pop = document.createElement("span");
  pop.className = "score-pop";
  pop.textContent = "+1";
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;
  scorePopLayer.appendChild(pop);
  setTimeout(() => pop.remove(), 580);
}

function spawnFlapParticles() {
  for (let i = 0; i < 4; i += 1) {
    const p = document.createElement("span");
    p.className = "particle";
    p.style.left = `${bird.x - 12 + Math.random() * 12}px`;
    p.style.top = `${bird.y + 6 + Math.random() * 10}px`;
    p.style.setProperty("--x", `${-18 - Math.random() * 24}px`);
    p.style.setProperty("--y", `${-8 + Math.random() * 16}px`);
    particleLayer.appendChild(p);
    setTimeout(() => p.remove(), 460);
  }
}

function spawnPassParticles(x, y) {
  for (let i = 0; i < 5; i += 1) {
    const p = document.createElement("span");
    p.className = "particle";
    p.style.left = `${x + Math.random() * 14}px`;
    p.style.top = `${y - 8 + Math.random() * 18}px`;
    p.style.setProperty("--x", `${10 + Math.random() * 20}px`);
    p.style.setProperty("--y", `${-20 - Math.random() * 26}px`);
    particleLayer.appendChild(p);
    setTimeout(() => p.remove(), 460);
  }
}

function initAudio() {
  if (!audioState.context) {
    audioState.context = new AudioContext();
    const gain = audioState.context.createGain();
    gain.gain.value = 0.02;
    const filter = audioState.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 620;
    const osc = audioState.context.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 160;
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioState.context.destination);
    osc.start();
    audioState.bgNode = { osc, gain };
  }

  if (audioState.context.state === "suspended") {
    audioState.context.resume();
  }
}

function beep(type, frequency, duration, volume) {
  if (!audioState.context) {
    return;
  }

  const now = audioState.context.currentTime;
  const osc = audioState.context.createOscillator();
  const gain = audioState.context.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  osc.connect(gain);
  gain.connect(audioState.context.destination);
  osc.start(now);
  osc.stop(now + duration + 0.02);
}

function playButtonSound() {
  beep("sine", 480, 0.08, 0.045);
}

function playFlapSound() {
  beep("triangle", 330, 0.1, 0.04);
}

function update(deltaTime = 1 / 60) {
  if (gameState !== "running") {
    return;
  }

  updateDifficulty();
  const frameScale = Math.min(2.5, Math.max(0.5, deltaTime * 60));

  frame += 1;
  cloudOffset += difficultyState.speed * 0.34 * frameScale;

  bird.targetVelocity += difficultyState.gravity * frameScale;
  bird.targetVelocity = Math.min(world.maxFallSpeed, bird.targetVelocity);

  const velocityBlend = 1 - Math.pow(1 - world.velocityEasing, frameScale);
  bird.velocity += (bird.targetVelocity - bird.velocity) * velocityBlend;
  bird.y += bird.velocity * frameScale;

  const targetRotation = Math.min(1.05, Math.max(-0.45, bird.velocity / world.maxFallSpeed));
  const rotationBlend = 1 - Math.pow(1 - world.rotationEasing, frameScale);
  bird.rotation += (targetRotation - bird.rotation) * rotationBlend;

  spawnTimer += deltaTime;
  const spawnInterval = difficultyState.spawnEvery / 60;
  while (spawnTimer >= spawnInterval) {
    spawnPipe();
    spawnTimer -= spawnInterval;
  }

  pipes.forEach((pipe) => {
    pipe.x -= difficultyState.speed * frameScale;

    if (!pipe.counted && pipe.x + pipe.width < bird.x) {
      pipe.counted = true;
      score += 1;
      syncHighScoreWithScore();
      const nextLevel = getLevel(score);
      if (nextLevel.id !== difficultyState.level) {
        difficultyState.level = nextLevel.id;
        showLevelUp(nextLevel);
      }
      pulseScore();
      popScoreText(bird.x + 30, bird.y - 28);
      spawnPassParticles(bird.x + 18, bird.y);
    }

    const hitX =
      bird.x + bird.size > pipe.x && bird.x - bird.size < pipe.x + pipe.width;
    const hitTop = bird.y - bird.size < pipe.top;
    const hitBottom = bird.y + bird.size > pipe.top + world.pipeGap;
    if (hitX && (hitTop || hitBottom)) {
      gameOver();
    }
  });

  pipes = pipes.filter((pipe) => pipe.x + pipe.width > -5);

  const hitCeiling = bird.y - bird.size < 0;
  const hitFloor = bird.y + bird.size > canvas.height - world.floorHeight;
  if (hitCeiling || hitFloor) {
    gameOver();
  }

  if (difficultyState.speed >= 4.5) {
    minorShakeCooldown -= deltaTime;
    if (minorShakeCooldown <= 0 && Math.random() < 0.03 * frameScale) {
      canvasWrap.classList.add("shake");
      setTimeout(() => canvasWrap.classList.remove("shake"), 150);
      minorShakeCooldown = 0.55;
    }
  }

  animateScore();
}

function drawBackground() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const levelMix = clamp((difficultyState.level - 1) / 3, 0, 1);
  const topBlue = Math.round(143 - levelMix * 20);
  const midBlue = Math.round(182 - levelMix * 26);
  const lowBlue = Math.round(255 - levelMix * 18);

  const skyGradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGradient.addColorStop(0, `rgb(${topBlue}, ${224 - levelMix * 10}, ${lowBlue})`);
  skyGradient.addColorStop(0.5, `rgb(119, ${midBlue}, 255)`);
  skyGradient.addColorStop(1, `rgb(${100 - levelMix * 8}, ${162 - levelMix * 6}, 255)`);
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sun = ctx.createRadialGradient(340, 90, 10, 340, 90, 80);
  sun.addColorStop(0, "#fff6c2");
  sun.addColorStop(1, "rgba(255,246,194,0)");
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(340, 90, 80, 0, Math.PI * 2);
  ctx.fill();

  const backCloudShift = (cloudOffset * 0.45) % (canvas.width + 180);
  for (let i = -1; i < 4; i += 1) {
    drawCloud(canvas.width - backCloudShift + i * 190, 66 + (i % 2) * 30, 0.92, 0.4);
  }

  const frontCloudShift = cloudOffset % (canvas.width + 160);
  for (let i = -1; i < 4; i += 1) {
    drawCloud(canvas.width - frontCloudShift + i * 170, 100 + (i % 2) * 42, 1.02, 0.68);
  }
}

function drawCloud(x, y, scale = 1, alpha = 0.7) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = `rgba(255,255,255,${alpha})`;
  ctx.beginPath();
  ctx.arc(0, 0, 17, 0, Math.PI * 2);
  ctx.arc(17, -7, 21, 0, Math.PI * 2);
  ctx.arc(38, 0, 15, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPipes() {
  pipes.forEach((pipe) => {
    drawPipe(pipe.x, 0, pipe.width, pipe.top, true);
    drawPipe(
      pipe.x,
      pipe.top + world.pipeGap,
      pipe.width,
      canvas.height - pipe.top - world.pipeGap - world.floorHeight,
      false
    );
  });
}

function drawPipe(x, y, width, height, top) {
  const body = ctx.createLinearGradient(x, y, x + width, y);
  body.addColorStop(0, "#2e8b57");
  body.addColorStop(0.5, "#51c878");
  body.addColorStop(1, "#1f6f42");

  ctx.fillStyle = body;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = "#185737";
  const capY = top ? y + height - 12 : y;
  ctx.fillRect(x - 4, capY, width + 8, 12);
}

function drawGround() {
  const groundY = canvas.height - world.floorHeight;
  const stripe = 32;

  ctx.fillStyle = "#5da864";
  ctx.fillRect(0, groundY, canvas.width, world.floorHeight);

  for (let i = 0; i < canvas.width / stripe + 2; i += 1) {
    ctx.fillStyle = i % 2 ? "#6bbc74" : "#4d9454";
    ctx.fillRect(i * stripe - (frame * difficultyState.speed) % stripe, groundY, stripe, world.floorHeight);
  }
}

function drawBird() {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  ctx.rotate(bird.rotation);

  ctx.fillStyle = "#ffd84a";
  ctx.beginPath();
  ctx.ellipse(0, 0, bird.size + 3, bird.size, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#fca311";
  ctx.beginPath();
  ctx.ellipse(-7, 6, bird.size * 0.45, bird.size * 0.35, -0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ff7f50";
  ctx.beginPath();
  ctx.moveTo(15, 0);
  ctx.lineTo(29, 4);
  ctx.lineTo(15, 10);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(5, -7, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#2d2d2d";
  ctx.beginPath();
  ctx.arc(7, -7, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function draw() {
  drawBackground();
  drawPipes();
  drawGround();
  drawBird();
}

let lastTime = performance.now();

function loop(now = performance.now()) {
  const deltaTime = (now - lastTime) / 1000;
  lastTime = now;
  update(deltaTime);
  draw();
  requestAnimationFrame(loop);
}

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", () => {
  initAudio();
  playButtonSound();
  startGame();
});
flapBtn.addEventListener("click", () => {
  initAudio();
  playButtonSound();
  flap();
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "ArrowUp") {
    event.preventDefault();
    flap();
  }
});

canvas.addEventListener("pointerdown", flap);

showOverlay(
  "Ready to Fly?",
  "Press Space, click, or tap to flap and keep Abhay Bird in the sky!"
);
loop();