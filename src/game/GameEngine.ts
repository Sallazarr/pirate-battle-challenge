import { Application, Ticker, Sprite, Container } from 'pixi.js';
import { Player } from './Player';
import { Projectile } from './Projectile';
import { Chaser } from './Chaser';
import { Shooter } from './Shooter';
import { GameMap } from './GameMap';
import { Explosion } from './Explosion';
import { AudioManager } from './AudioManager';
import { COLS, ROWS, TILE } from './mapData';
 
export class GameEngine {
  public app: Application;
  public world: Container;
  public audio: AudioManager;
 
  private isInitialized = false;
  private isGameOver = false;
  private isPaused = false;
  private isDestroyed = false;
 
  private onGameStateChange?: (
    score: number,
    health: number,
    time: number,
    isGameOver: boolean,
    isPaused: boolean,
    highScore: number
  ) => void;
 
  private currentScore = 0;
  private highScore = Number(localStorage.getItem('pirate_battle_highscore') || '0');
  private playerHealth = 100;
 
  private maxGameTime = 60;
  private timeLeft = 60;
  private baseSpawnIntervalMs = 3000;
  private timeAccumulator = 0;
 
  private gameMap: GameMap;
  private player: Player;
  private projectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private enemies: (Chaser | Shooter)[] = [];
  private explosions: Explosion[] = [];
 
  private lastEnemySpawn = 0;
  private spawnInterval = 3000;
 
  constructor() {
    this.app = new Application();
    this.world = new Container();
    this.audio = new AudioManager();
    this.gameMap = new GameMap();
    this.player = new Player(this.handleShoot.bind(this));
  }
 
  // Calcula o zoom ideal para que o mapa caiba na tela com uma margem mínima
  private getZoom(): number {
    const mapW = COLS * TILE;
    const mapH = ROWS * TILE;
    const marginX = window.innerWidth  < 600 ? 0   : 40;
    const marginY = window.innerHeight < 600 ? 0   : 40;
    const zoomX = (window.innerWidth  - marginX) / mapW;
    const zoomY = (window.innerHeight - marginY) / mapH;
    // Usa o menor zoom para garantir que o mapa inteiro apareça
    // Limita entre 0.25 (muito pequeno) e 0.7 (muito grande em desktop)
    return Math.min(zoomX, zoomY, 0.7);
  }
 
  public setControl(action: 'forward' | 'left' | 'right' | 'fireFront' | 'fireLeft' | 'fireRight', active: boolean) {
    if (this.isDestroyed || this.isGameOver || this.isPaused || !this.player) return;
 
    const playerInputs = (this.player as any).inputs;
    if (!playerInputs) return;
 
    switch (action) {
      case 'forward':   playerInputs.up    = active; break;
      case 'left':      playerInputs.left  = active; break;
      case 'right':     playerInputs.right = active; break;
      case 'fireFront': playerInputs.space = active; break;
      case 'fireLeft':  playerInputs.shift = active; break;
      case 'fireRight': playerInputs.ctrl  = active; break;
    }
  }
 
  private handleResize = () => {
    if (!this.app || !this.app.renderer || this.isDestroyed) return;
    const zoom = this.getZoom();
    this.world.scale.set(zoom);
    const mapPixelWidth  = COLS * TILE * zoom;
    const mapPixelHeight = ROWS * TILE * zoom;
    this.world.x = (window.innerWidth  - mapPixelWidth)  / 2;
    this.world.y = (window.innerHeight - mapPixelHeight) / 2;
  };
 
  private async handleShoot(x: number, y: number, fireAngle: number, isLateral: boolean, shipRotation: number = fireAngle) {
    if (this.isDestroyed || this.isGameOver || this.isPaused) return;
 
    this.audio.playCannon(isLateral);
 
    const fire = async (spawnX: number, spawnY: number, angle: number) => {
      let proj = this.projectiles.find(p => p.isDead);
      if (!proj) {
        proj = new Projectile(spawnX, spawnY, angle);
        await proj.init();
        if (this.isDestroyed) return;
        this.world.addChild(proj.sprite);
        this.projectiles.push(proj);
      } else {
        proj.spawn(spawnX, spawnY, angle);
      }
    };
 
    if (isLateral) {
      const offsets = [-20, 0, 20];
      for (const offset of offsets) {
        const spawnX = x + Math.cos(shipRotation) * offset;
        const spawnY = y + Math.sin(shipRotation) * offset;
        await fire(spawnX, spawnY, fireAngle);
      }
    } else {
      await fire(x, y, fireAngle);
    }
  }
 
  private async handleEnemyShoot(x: number, y: number, angle: number) {
    if (this.isDestroyed || this.isGameOver || this.isPaused) return;
    this.audio.playCannon(false);
    let proj = this.enemyProjectiles.find(p => p.isDead);
    if (!proj) {
      proj = new Projectile(x, y, angle);
      await proj.init();
      if (this.isDestroyed) return;
      proj.sprite.tint = 0xff4444;
      this.world.addChild(proj.sprite);
      this.enemyProjectiles.push(proj);
    } else {
      proj.spawn(x, y, angle);
      proj.sprite.tint = 0xff4444;
    }
  }
 
  private async spawnExplosion(x: number, y: number, type?: number) {
    if (this.isDestroyed) return;
    if (type === 3) { this.audio.playWaterHit(); }
    else { this.audio.playExplosion(); this.audio.playShipSinking(); }
    let explosion = this.explosions.find(e => e.isDead);
    if (!explosion) {
      explosion = new Explosion(x, y, type);
      await explosion.init();
      if (this.isDestroyed) return;
      this.world.addChild(explosion.sprite);
      this.explosions.push(explosion);
    } else {
      explosion.spawn(x, y, type);
    }
  }
 
  private checkEntityCollision(a: Sprite, b: Sprite): boolean {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy) < 45;
  }
 
  public togglePause() {
    if (this.isGameOver || !this.isInitialized) return;
    this.isPaused = !this.isPaused;
    this.player.isLocked = this.isPaused;
    if (this.isPaused) {
      this.audio.playPause();
      this.audio.stopSailing();
      this.audio.stopHealthLow();
    } else {
      this.audio.playResume();
    }
    this.notifyState();
  }
 
  public async init(
    container: HTMLElement,
    gameTime: number = 60,
    spawnTimeSec: number = 3,
    onGameStateChange: (
      score: number, health: number, time: number,
      isGameOver: boolean, isPaused: boolean, highScore: number
    ) => void
  ) {
    if (this.isInitialized) return;
 
    this.maxGameTime = gameTime;
    this.timeLeft = gameTime;
    this.baseSpawnIntervalMs = spawnTimeSec * 1000;
    this.spawnInterval = this.baseSpawnIntervalMs;
    this.onGameStateChange = onGameStateChange;
    this.notifyState();
 
    await this.app.init({
      resizeTo: window,
      backgroundColor: 0x001a33,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });
 
    if (this.isDestroyed) {
      this.app.destroy(true, { children: true, texture: true });
      return;
    }
    container.appendChild(this.app.canvas);
 
    // Zoom responsivo calculado uma vez no init, depois mantido pelo handleResize
    this.app.stage.addChild(this.world);
    this.handleResize();
    window.addEventListener('resize', this.handleResize);
 
    await this.gameMap.init();
    if (this.isDestroyed) return;
    this.world.addChild(this.gameMap.container);
 
    await this.player.init();
    if (this.isDestroyed) return;
 
    this.player.sprite.x = 14 * TILE;
    this.player.sprite.y = 2 * TILE;
    this.world.addChild(this.player.sprite);
 
    this.audio.playGameStart();
    this.audio.startAmbience();
 
    this.player.isLocked = false;
    this.isInitialized = true;
 
    this.app.ticker.add((ticker: Ticker) => {
      this.gameLoop(ticker.deltaTime);
    });
  }
 
  public restart(gameTime?: number, spawnTimeSec?: number) {
    if (gameTime !== undefined) {
      this.maxGameTime = gameTime;
      this.timeLeft = gameTime;
    } else {
      this.timeLeft = this.maxGameTime;
    }
    if (spawnTimeSec !== undefined) {
      this.baseSpawnIntervalMs = spawnTimeSec * 1000;
      this.spawnInterval = this.baseSpawnIntervalMs;
    }
    this.currentScore = 0;
    this.playerHealth = 100;
    this.isGameOver = false;
    this.isPaused = false;
    this.timeAccumulator = 0;
    this.lastEnemySpawn = Date.now();
    this.audio.stopHealthLow();
    this.projectiles.forEach(p => p.despawn());
    this.enemyProjectiles.forEach(p => p.despawn());
    this.explosions.forEach(e => e.despawn());
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.player.sprite.x = 14 * TILE;
    this.player.sprite.y = 2 * TILE;
    this.player.isLocked = false;
    this.audio.playGameStart();
    this.audio.startAmbience();
    this.notifyState();
  }
 
  private addScore() {
    this.currentScore += 1;
    if (this.currentScore > this.highScore) {
      this.highScore = this.currentScore;
      localStorage.setItem('pirate_battle_highscore', String(this.highScore));
    }
  }
 
  private triggerGameOver(isVictory: boolean) {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.player.isLocked = true;
    this.audio.stopSailing();
    this.audio.stopAmbience();
    this.audio.stopHealthLow();
    if (isVictory) { this.audio.playGameComplete(); }
    else { this.audio.playGameOver(); }
    this.notifyState();
  }
 
  private notifyState() {
    if (this.onGameStateChange) {
      this.onGameStateChange(
        this.currentScore, this.playerHealth, this.timeLeft,
        this.isGameOver, this.isPaused, this.highScore
      );
    }
  }
 
  private gameLoop(delta: number) {
    if (!this.isInitialized || this.isGameOver || this.isPaused) return;
 
    this.timeAccumulator += this.app.ticker.deltaMS;
    if (this.timeAccumulator >= 1000) {
      this.timeLeft -= 1;
      this.timeAccumulator -= 1000;
      const elapsed = this.maxGameTime - this.timeLeft;
      this.spawnInterval = Math.max(600, this.baseSpawnIntervalMs - (elapsed * 40));
      if (this.timeLeft <= 10 && this.timeLeft > 0) this.audio.playTimeWarning();
      if (this.timeLeft <= 0) { this.triggerGameOver(true); return; }
      this.notifyState();
    }
 
    const prevPx = this.player.sprite.x;
    const prevPy = this.player.sprite.y;
    this.player.update(delta);
 
    const isMoving = Math.abs(this.player.sprite.x - prevPx) > 0.05 || Math.abs(this.player.sprite.y - prevPy) > 0.05;
    this.audio.updateSailing(isMoving, delta);
    this.audio.setHealthLow(this.playerHealth <= 30 && this.playerHealth > 0);
 
    const zoom = this.world.scale.x;
    const padding = 25;
    const minX = (0 - this.world.x) / zoom + padding;
    const maxX = (window.innerWidth  - this.world.x) / zoom - padding;
    const minY = (0 - this.world.y) / zoom + padding;
    const maxY = (window.innerHeight - this.world.y) / zoom - padding;
    this.player.sprite.x = Math.max(minX, Math.min(maxX, this.player.sprite.x));
    this.player.sprite.y = Math.max(minY, Math.min(maxY, this.player.sprite.y));
 
    if (this.gameMap.checkSolidCollision(this.player.sprite.x, this.player.sprite.y)) {
      this.player.sprite.x = prevPx;
      if (this.gameMap.checkSolidCollision(this.player.sprite.x, this.player.sprite.y)) {
        this.player.sprite.x = prevPx;
        this.player.sprite.y = prevPy;
      }
    }
 
    const now = Date.now();
    if (now - this.lastEnemySpawn > this.spawnInterval) {
      this.spawnEnemy();
      this.lastEnemySpawn = now;
    }
 
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const prevEx = enemy.sprite.x;
      const prevEy = enemy.sprite.y;
      enemy.update(delta, this.player.sprite.x, this.player.sprite.y);
      if (this.gameMap.checkSolidCollision(enemy.sprite.x, enemy.sprite.y)) {
        const testX = enemy.sprite.x;
        enemy.sprite.x = prevEx;
        if (this.gameMap.checkSolidCollision(enemy.sprite.x, enemy.sprite.y)) {
          enemy.sprite.x = testX;
          enemy.sprite.y = prevEy;
          if (this.gameMap.checkSolidCollision(enemy.sprite.x, enemy.sprite.y)) {
            enemy.sprite.x = prevEx;
            enemy.sprite.y = prevEy;
          }
        }
      }
      if (this.checkEntityCollision(enemy.sprite, this.player.sprite)) {
        if (!enemy.isDead) {
          enemy.isDead = true;
          this.audio.playShipCollision();
          this.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
          this.playerHealth -= 20;
          if (this.playerHealth <= 0) { this.triggerGameOver(false); return; }
          this.notifyState();
        }
      }
      if (enemy.isDead) { enemy.destroy(); this.enemies.splice(i, 1); }
    }
 
    for (let i = 0; i < this.projectiles.length; i++) {
      const proj = this.projectiles[i];
      if (proj.isDead) continue;
      proj.update(delta);
      if (this.gameMap.checkSolidCollision(proj.sprite.x, proj.sprite.y, 8)) {
        proj.despawn();
        this.spawnExplosion(proj.sprite.x, proj.sprite.y, 3);
      } else {
        for (let j = this.enemies.length - 1; j >= 0; j--) {
          const enemy = this.enemies[j];
          if (this.checkEntityCollision(proj.sprite, enemy.sprite)) {
            proj.despawn();
            enemy.isDead = true;
            this.audio.playWoodHit();
            this.audio.playScorePoint();
            this.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
            this.addScore();
            this.notifyState();
            break;
          }
        }
      }
    }
 
    for (let i = 0; i < this.enemyProjectiles.length; i++) {
      const proj = this.enemyProjectiles[i];
      if (proj.isDead) continue;
      proj.update(delta);
      if (this.gameMap.checkSolidCollision(proj.sprite.x, proj.sprite.y, 8)) {
        proj.despawn();
        this.spawnExplosion(proj.sprite.x, proj.sprite.y, 3);
      } else if (this.checkEntityCollision(proj.sprite, this.player.sprite)) {
        proj.despawn();
        this.audio.playWoodHit();
        this.spawnExplosion(proj.sprite.x, proj.sprite.y);
        this.playerHealth -= 10;
        if (this.playerHealth <= 0) { this.triggerGameOver(false); return; }
        this.notifyState();
      }
    }
 
    for (let i = 0; i < this.explosions.length; i++) {
      const exp = this.explosions[i];
      if (!exp.isDead) exp.update(delta);
    }
  }
 
  private async spawnEnemy() {
    if (this.isDestroyed || this.isGameOver || this.isPaused) return;
    const safeSpawns = [
      { col: 8,  row: -25 },
      { col: 8,  row: 36  },
      { col: -25, row: 5  },
      { col: 40,  row: 5  }
    ];
    const spawn = safeSpawns[Math.floor(Math.random() * safeSpawns.length)];
    const x = spawn.col * TILE;
    const y = spawn.row * TILE;
    if (Math.random() > 0.5) {
      const enemy = new Chaser(x, y);
      await enemy.init();
      if (this.isDestroyed || this.isGameOver || this.isPaused) return;
      this.world.addChild(enemy.sprite);
      this.enemies.push(enemy);
    } else {
      const enemy = new Shooter(x, y, this.handleEnemyShoot.bind(this));
      await enemy.init();
      if (this.isDestroyed || this.isGameOver || this.isPaused) return;
      this.world.addChild(enemy.sprite);
      this.enemies.push(enemy);
    }
  }
 
  public destroy() {
    this.isDestroyed = true;
    this.player.isLocked = true;
    window.removeEventListener('resize', this.handleResize);
    this.audio.stopAmbience();
    this.audio.stopSailing();
    this.audio.stopHealthLow();
    const isRendererReady = this.app && (this.app as any).renderer;
    if (isRendererReady) {
      try {
        if (this.app.canvas && this.app.canvas.parentNode) {
          this.app.canvas.parentNode.removeChild(this.app.canvas);
        }
      } catch (e) {}
    }
    if (this.isInitialized) {
      this.player.destroy();
      this.gameMap.destroy();
      this.projectiles.forEach(p => p.destroy());
      this.enemyProjectiles.forEach(p => p.destroy());
      this.enemies.forEach(e => e.destroy());
      this.explosions.forEach(e => e.destroy());
      if (isRendererReady) {
        try { this.app.destroy(true, { children: true, texture: true }); } catch (e) {}
      }
      this.isInitialized = false;
    } else if (isRendererReady) {
      try { this.app.destroy(true); } catch (e) {}
    }
  }
}