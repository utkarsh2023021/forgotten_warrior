/* * FORGOTTEN WARRIOR: FIERCE MOBILE EDITION
 * - Huge Map
 * - Touch Controls
 * - Optimized for fun
 */

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const GAME_W = 320;
const GAME_H = 180;
canvas.width = GAME_W;
canvas.height = GAME_H;

let gameState = "MENU";
let score = 0;
let shakeTime = 0;

const keys = {
  ArrowUp:false, ArrowDown:false, ArrowLeft:false, ArrowRight:false,
  KeyW:false, KeyS:false, KeyA:false, KeyD:false, Space:false, KeyK:false
};

const TILE_SIZE = 16;
const assets = {};

function createPattern(drawFn,w=16,h=16){
  const c=document.createElement("canvas"); c.width=w; c.height=h;
  const cx=c.getContext("2d"); drawFn(cx); return c;
}

function initAssets(){
  if(assets.stone) return;
  assets.stone = createPattern(cx=>{
    cx.fillStyle="#5d5052"; cx.fillRect(0,0,16,16);
    cx.fillStyle="#7a6a6c"; cx.fillRect(0,0,16,1);
    cx.fillStyle="#3e3536"; cx.fillRect(0,15,16,1);
    cx.fillStyle="rgba(0,0,0,0.2)"; cx.fillRect(5,5,2,2);
  });
  assets.grass = createPattern(cx=>{
    cx.drawImage(assets.stone,0,0);
    cx.fillStyle="#4a9c2d"; cx.fillRect(0,0,16,5);
    cx.fillStyle="#76c442"; cx.fillRect(0,0,16,2);
  });
  assets.ladder = createPattern(cx=>{
    cx.fillStyle="#6d4e34"; cx.fillRect(4,0,2,16); cx.fillRect(10,0,2,16);
    cx.fillStyle="#8f6b4e"; cx.fillRect(4,3,8,2); cx.fillRect(4,9,8,2);
  });
  assets.bg = createPattern(cx=>{
    let g=cx.createLinearGradient(0,0,0,180);
    g.addColorStop(0,"#87CEEB"); g.addColorStop(1,"#E0F7FA");
    cx.fillStyle=g; cx.fillRect(0,0,320,180);
  },320,180);
  assets.coin = createPattern(cx=>{
    cx.fillStyle="#ffcc00"; cx.beginPath(); cx.arc(8,8,5,0,Math.PI*2); cx.fill();
    cx.fillStyle="#fff"; cx.beginPath(); cx.arc(6,6,2,0,Math.PI*2); cx.fill();
  });
}

// 1=Wall, 2=Grass, 3=Ladder, 9=Coin, 0=Air
// New map is 100+ tiles wide with verticality
const levelMap = [
  "111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111",
  "100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100099900000000000000000000000001111000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100022200000000000000000000000001001000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100000000000011110000000000000001001000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100000000000030030000000000000001001000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100222220000030030000000000000001001000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100111110000030030000000000000001001000000000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "100111110000030030000000000000001001222110000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "122111110000030030000000000000001000000110000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "111111110000030030000000000000001000990110000000000000000000000000000000000000000000000000000000000000000000000000000001",
  "111111110022210011111111111222221222220111111111110000001100000001100000001100000001100000000111111000000000000000000001",
  "111111110011110011111111111111111111110000000000110000001100000001100000001100000001100000003000000000000000000000000001",
  "111111110011110000000000000000000000000000000000111111111111111111111111111111111111111111113000000222000022200022200001",
  "111111112211111111111111111111111111110000000000000000000000000000000000000000000000000000003000000111000011100011100001",
  "111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111111"
];

function getTile(col,row){
  if(row<0||row>=levelMap.length||col<0||col>=levelMap[0].length) return 1;
  return parseInt(levelMap[row][col]);
}

let particles = [];
class Particle {
  constructor(x,y,color,speed,life){
    this.x=x; this.y=y; this.vx=(Math.random()-0.5)*speed; this.vy=(Math.random()-0.5)*speed;
    this.life=life; this.maxLife=life; this.color=color; this.size=Math.random()*3+1;
  }
  update(dt){ this.x+=this.vx*dt; this.y+=this.vy*dt; this.life-=dt; this.size=(this.life/this.maxLife)*3; }
  draw(ctx,camX,camY){ ctx.fillStyle=this.color; ctx.fillRect(this.x-camX,this.y-camY,this.size,this.size); }
}
function spawnParticles(x,y,color,count){ for(let i=0;i<count;i++) particles.push(new Particle(x,y,color,60,0.5)); }

class Entity {
  constructor(x,y,w,h){
    this.x=x; this.y=y; this.w=w; this.h=h; this.vx=0; this.vy=0;
    this.onGround=false; this.facingRight=true; this.dead=false; this.touchingWall=0;
  }
  resolveMapCollision(dt){
    this.x += this.vx * dt;
    this.touchingWall = 0;
    let leftCol = Math.floor(this.x / TILE_SIZE);
    let rightCol = Math.floor((this.x + this.w - 0.1) / TILE_SIZE);
    let topRow = Math.floor(this.y / TILE_SIZE);
    let bottomRow = Math.floor((this.y + this.h - 0.1) / TILE_SIZE);

    if (this.vx > 0) {
      if ([1,2].includes(getTile(rightCol, topRow)) || [1,2].includes(getTile(rightCol, bottomRow))) {
        this.x = rightCol * TILE_SIZE - this.w; this.vx = 0; this.touchingWall = 1;
      }
    } else if (this.vx < 0) {
      if ([1,2].includes(getTile(leftCol, topRow)) || [1,2].includes(getTile(leftCol, bottomRow))) {
        this.x = (leftCol + 1) * TILE_SIZE; this.vx = 0; this.touchingWall = -1;
      }
    }

    this.y += this.vy * dt;
    leftCol = Math.floor(this.x / TILE_SIZE);
    rightCol = Math.floor((this.x + this.w - 0.1) / TILE_SIZE);
    topRow = Math.floor(this.y / TILE_SIZE);
    bottomRow = Math.floor((this.y + this.h - 0.1) / TILE_SIZE);

    this.onGround = false;
    if (this.vy > 0) {
      if ([1,2].includes(getTile(leftCol, bottomRow)) || [1,2].includes(getTile(rightCol, bottomRow))) {
        this.y = bottomRow * TILE_SIZE - this.h; this.vy = 0; this.onGround = true;
      }
    } else if (this.vy < 0) {
      if ([1,2].includes(getTile(leftCol, topRow)) || [1,2].includes(getTile(rightCol, topRow))) {
        this.y = (topRow + 1) * TILE_SIZE; this.vy = 0;
      }
    }
  }
}

class Player extends Entity {
  constructor(){
    super(40,40,12,14);
    this.speed = 120;
    this.jumpForce = -260;
    this.hp = 100; this.maxHp = 100;
    this.mp = 100; this.maxMp = 100;
    this.maxJumps = 2; this.jumpCount = 0;
    this.hpRegenRate=3; this.mpRegenRate=15; this.timeSinceDamage=999;
  }

  update(dt){
    if(this.dead) return;

    if (keys.ArrowLeft || keys.KeyA) { 
      this.vx = -this.speed; this.facingRight = false; 
      if(this.onGround && Math.random()>0.85) spawnParticles(this.x+this.w,this.y+this.h,"#888",1); 
    }
    else if (keys.ArrowRight || keys.KeyD) { 
      this.vx = this.speed; this.facingRight = true; 
      if(this.onGround && Math.random()>0.85) spawnParticles(this.x,this.y+this.h,"#888",1); 
    }
    else this.vx = 0;

    let centerCol = Math.floor((this.x + this.w/2)/TILE_SIZE);
    let centerRow = Math.floor((this.y + this.h/2)/TILE_SIZE);
    let onLadder = getTile(centerCol, centerRow) === 3;

    if(onLadder){
      this.vy = 0; this.jumpCount = 0;
      if(keys.ArrowUp || keys.KeyW) this.vy = -80;
      if(keys.ArrowDown || keys.KeyS) this.vy = 80;
    } else {
      this.vy += 900 * dt;
      if(this.touchingWall !== 0 && !this.onGround && this.vy > 0){ this.vy = 50; } // Wall slide
    }

    const jumpKey = keys.Space || keys.ArrowUp;
    if (jumpKey && !this.jumpPressed) {
      if (this.onGround || onLadder) {
        this.vy = this.jumpForce; this.jumpCount = 1; spawnParticles(this.x+this.w/2,this.y+this.h,"#fff",8);
      } else if (this.touchingWall !== 0) {
        this.vy = this.jumpForce; this.vx = -this.touchingWall * this.speed * 1.5; this.jumpCount = 1; spawnParticles(this.touchingWall===1?this.x+this.w:this.x,this.y+this.h/2,"#fff",5);
      } else if (this.jumpCount < this.maxJumps) {
        this.vy = this.jumpForce; this.jumpCount++; spawnParticles(this.x+this.w/2,this.y+this.h,"#8fd1ff",5);
      }
    }
    this.jumpPressed = jumpKey;
    if(this.onGround) this.jumpCount = 0;

    this.resolveMapCollision(dt);

    if (keys.KeyK && this.mp >= 10 && projectiles.length < 3) {
      keys.KeyK = false;
      projectiles.push(new Projectile(this.x + (this.facingRight ? 10 : -10), this.y + 4, this.facingRight));
      this.mp -= 10;
      updateUI();
    }

    if(getTile(centerCol, centerRow) === 9){
      let rowStr = levelMap[centerRow].split('');
      rowStr[centerCol] = '0';
      levelMap[centerRow] = rowStr.join('');
      score += 10;
      updateUI();
      spawnParticles(this.x + this.w/2, this.y, "#ffd700", 12);
    }

    if(this.y > levelMap.length * TILE_SIZE + 100) this.takeDamage(999);

    this.timeSinceDamage += dt;
    if(this.timeSinceDamage >= 4 && this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + this.hpRegenRate * dt);
    if(this.mp < this.maxMp) this.mp = Math.min(this.maxMp, this.mp + this.mpRegenRate * dt);
    updateUI();
  }

  takeDamage(amt){
    if(this.dead) return;
    this.hp -= amt; this.timeSinceDamage = 0; shakeTime = 0.3;
    spawnParticles(this.x + this.w/2, this.y + this.h/2, "#e71d36", 10);
    updateUI();
    if(this.hp <= 0){ this.dead = true; endGame(); }
  }

  draw(ctx, camX, camY){
    if(this.dead) return;
    let x=Math.floor(this.x-camX), y=Math.floor(this.y-camY);
    let speedFactor = Math.abs(this.vx)/100;
    let capeOffset = Math.sin(Date.now()/100) * 2 * (speedFactor + 0.2);
    ctx.fillStyle = this.facingRight ? "#d00" : "#a00";
    ctx.fillRect(x + (this.facingRight?-4:4) + capeOffset, y+2, 10, 10);
    ctx.fillStyle = "#222"; ctx.fillRect(x+2, y+10, 8, 4);
    ctx.fillStyle = "#aaa"; ctx.fillRect(x+1, y-1, 10, 10);
    ctx.fillStyle = "#33ffaa"; ctx.fillRect(x + (this.facingRight?6:2), y+2, 4, 2);
  }
}

class Enemy extends Entity {
  constructor(x,y){ super(x,y,14,14); this.speed=30; this.vx=this.speed; this.hp=3; }
  update(dt){
    if(this.dead) return;
    this.vy += 800*dt;
    let nextCol = Math.floor((this.x + (this.vx>0 ? this.w : 0) + this.vx*dt*10)/TILE_SIZE);
    let row = Math.floor(this.y / TILE_SIZE);
    let nextGround = Math.floor((this.y + this.h + 2) / TILE_SIZE);
    if([1,2].includes(getTile(nextCol,row)) || getTile(nextCol,nextGround)===0){ this.vx *= -1; }
    this.resolveMapCollision(dt);
    if(rectIntersect(this, player)){ player.takeDamage(10); player.vy = -150; player.vx = (player.x < this.x) ? -200 : 200; }
  }
  draw(ctx,camX,camY){
    if(this.dead) return;
    let x = Math.floor(this.x - camX), y = Math.floor(this.y - camY);
    ctx.fillStyle="#ddd"; ctx.fillRect(x+3,y,8,8);
    ctx.fillStyle="#222"; ctx.fillRect(x+4,y+2,2,2); ctx.fillRect(x+8,y+2,2,2);
    ctx.fillStyle="#ddd"; ctx.fillRect(x+5,y+9,4,5);
    let armOff = Math.sin(Date.now()/200) * 3;
    ctx.fillRect(x+1,y+9+armOff,2,4); ctx.fillRect(x+11,y+9-armOff,2,4);
  }
}

class Projectile {
  constructor(x,y,goingRight){ this.x=x; this.y=y; this.w=14; this.h=6; this.vx=goingRight?350:-350; this.life=0.8; this.active=true; }
  update(dt){
    this.x += this.vx*dt; this.life -= dt; if(this.life<=0) this.active=false;
    if(Math.random()>0.5) spawnParticles(this.x,this.y+2,"#0ff",1);
    enemies.forEach(e=>{
      if(!e.dead && rectIntersect(this,e)){
        e.hp--; this.active=false; spawnParticles(e.x+e.w/2,e.y+e.h/2,"#fff",6);
        if(e.hp<=0){ e.dead=true; score+=50; updateUI(); }
      }
    });
    let c = Math.floor((this.x + this.w/2) / TILE_SIZE);
    let r = Math.floor(this.y / TILE_SIZE);
    if([1,2].includes(getTile(c,r))){ this.active=false; spawnParticles(this.x,this.y,"#0ff",5); }
  }
  draw(ctx,camX,camY){
    ctx.fillStyle="#0ff"; ctx.fillRect(this.x-camX,this.y-camY,this.w,this.h);
    ctx.fillStyle="rgba(255,255,255,0.7)"; ctx.fillRect(this.x-camX+2,this.y-camY+2,this.w-4,2);
  }
}

let player; let enemies = []; let projectiles = []; let camera = {x:0,y:0};

function startGame(){
  initAssets();
  document.getElementById("story-screen").classList.remove("active");
  document.getElementById("story-screen").classList.add("hidden");
  setupMobileControls();

  player = new Player();
  // MORE ENEMIES FOR FIERCE DIFFICULTY
  enemies = [ 
    new Enemy(200,40), new Enemy(500,60), new Enemy(700, 100),
    new Enemy(900,100), new Enemy(1100,60), new Enemy(1300,100),
    new Enemy(1450,150), new Enemy(1550,150)
  ];
  
  projectiles = []; particles = []; score = 0; shakeTime = 0;
  updateUI();
  gameState = "PLAY";
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

function endGame(){
  gameState = "OVER";
  document.getElementById("game-over-screen").classList.remove("hidden");
  document.getElementById("game-over-screen").classList.add("active");
}

function updateUI(){
  if(!player) return;
  const hpPercent = Math.max(0, Math.round((player.hp / player.maxHp) * 100));
  const mpPercent = Math.max(0, Math.round((player.mp / player.maxMp) * 100));
  document.getElementById("hp-bar").style.width = hpPercent + "%";
  document.getElementById("mp-bar").style.width = mpPercent + "%";
  document.getElementById("score").innerText = score;
  document.getElementById("hp-text").innerText = Math.round(player.hp);
  document.getElementById("mp-text").innerText = Math.round(player.mp);
}

function rectIntersect(r1,r2){ return !(r2.x > r1.x + r1.w || r2.x + r2.w < r1.x || r2.y > r1.y + r1.h || r2.y + r2.h < r1.y); }

let lastTime = 0;
function gameLoop(timestamp){
  if(gameState !== "PLAY") return;
  const dt = Math.min((timestamp - lastTime) / 1000, 0.1);
  lastTime = timestamp;

  let shakeX=0, shakeY=0;
  if(shakeTime>0){ shakeTime -= dt; shakeX=(Math.random()-0.5)*4; shakeY=(Math.random()-0.5)*4; }

  player.update(dt);
  enemies.forEach(e=>e.update(dt));
  projectiles.forEach(p=>p.update(dt));
  particles.forEach(p=>p.update(dt));

  projectiles = projectiles.filter(p=>p.active);
  particles = particles.filter(p=>p.life>0);

  let targetX = player.x - GAME_W/2 + (player.facingRight ? 40 : -40);
  let targetY = player.y - GAME_H/2;
  // Adjusted Camera clamp for huge map
  targetX = Math.max(0, Math.min(targetX, levelMap[0].length * TILE_SIZE - GAME_W));
  targetY = Math.max(0, Math.min(targetY, levelMap.length * TILE_SIZE - GAME_H));
  camera.x += (targetX - camera.x)*0.12;
  camera.y += (targetY - camera.y)*0.12;

  ctx.save();
  ctx.translate(shakeX, shakeY);

  if(assets.bg) ctx.drawImage(assets.bg, 0, 0);

  let startCol = Math.floor(camera.x / TILE_SIZE);
  let endCol = startCol + (GAME_W / TILE_SIZE) + 1;
  let startRow = Math.floor(camera.y / TILE_SIZE);
  let endRow = startRow + (GAME_H / TILE_SIZE) + 1;

  for(let r=startRow;r<endRow;r++){
    for(let c=startCol;c<endCol;c++){
      let tile = getTile(c,r);
      if(tile===0) continue;
      let x = Math.floor(c * TILE_SIZE - camera.x);
      let y = Math.floor(r * TILE_SIZE - camera.y);
      if(tile===1 && assets.stone) ctx.drawImage(assets.stone,x,y);
      if(tile===2 && assets.grass) ctx.drawImage(assets.grass,x,y);
      if(tile===3 && assets.ladder) ctx.drawImage(assets.ladder,x,y);
      if(tile===9 && assets.coin) ctx.drawImage(assets.coin,x,y);
    }
  }

  player.draw(ctx,camera.x,camera.y);
  enemies.forEach(e=>e.draw(ctx,camera.x,camera.y));
  projectiles.forEach(p=>p.draw(ctx,camera.x,camera.y));
  particles.forEach(p=>p.draw(ctx,camera.x,camera.y));

  ctx.restore();
  requestAnimationFrame(gameLoop);
}

// Controls Logic
window.addEventListener("keydown", e => { if(keys.hasOwnProperty(e.code)) keys[e.code]=true; });
window.addEventListener("keyup", e => { if(keys.hasOwnProperty(e.code)) keys[e.code]=false; });

// MOBILE CONTROL SETUP
function setupMobileControls() {
  const btnUp = document.getElementById("btn-up");
  const btnLeft = document.getElementById("btn-left");
  const btnRight = document.getElementById("btn-right");
  const btnDown = document.getElementById("btn-down");
  const btnJump = document.getElementById("btn-jump");
  const btnShoot = document.getElementById("btn-shoot");

  function bindBtn(btn, keyList) {
    if(!btn) return;
    btn.addEventListener("touchstart", (e) => {
      e.preventDefault();
      keyList.forEach(k => keys[k] = true);
    });
    btn.addEventListener("touchend", (e) => {
      e.preventDefault();
      keyList.forEach(k => keys[k] = false);
    });
    // Mouse fallback for testing on PC with clicks
    btn.addEventListener("mousedown", () => keyList.forEach(k => keys[k] = true));
    btn.addEventListener("mouseup", () => keyList.forEach(k => keys[k] = false));
  }

  // D-Pad
  bindBtn(btnUp, ["ArrowUp", "KeyW"]);
  bindBtn(btnDown, ["ArrowDown", "KeyS"]);
  bindBtn(btnLeft, ["ArrowLeft", "KeyA"]);
  bindBtn(btnRight, ["ArrowRight", "KeyD"]);
  
  // Actions
  bindBtn(btnJump, ["Space"]);
  bindBtn(btnShoot, ["KeyK"]);
}

function resizeCanvas(){
  const wrapper = document.getElementById("game-container");
  const w = wrapper.clientWidth, h = wrapper.clientHeight;
  const scale = Math.min(w / GAME_W, h / GAME_H);
  canvas.style.width = GAME_W * scale + "px";
  canvas.style.height = GAME_H * scale + "px";
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();