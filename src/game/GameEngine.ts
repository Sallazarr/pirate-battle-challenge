import { Application, Ticker, Container } from 'pixi.js';
import { Player } from './Player';
import { Projectile } from './Projectile';
import { Chaser } from './Chaser';
import { Shooter } from './Shooter';
import { Boss } from './Boss';
import { LifePickup } from './LifePickup';
import { GameMap } from './GameMap';
import { Explosion } from './Explosion';
import { AudioManager } from './AudioManager';
import { HealthBar } from './HealthBar';
import { DEFAULT_GAME_CONFIGURATION, createMatchConfiguration } from './gameConfig';
import type { GameConfiguration } from './gameConfig';
import { COLS, ROWS, TILE } from './mapData';
import { advanceControlledTime, now, setControlledTime } from './gameClock';
import { isE2ERuntimeEnabled } from './e2e';
import type { GameTestHandle, GameTestSnapshot } from './e2e';
import { areSpritesColliding, resolveEnemyCollisions } from './collisionSystem';
import { EnemySpawner } from './EnemySpawner';

export class GameEngine {
  public app: Application;
  public world: Container;
  public audio: AudioManager;

  private isInitialized = false;
  private isGameOver = false;
  private isPaused = false;
  private isDestroyed = false;
  private runId = 0;
  private readonly isE2EMode = isE2ERuntimeEnabled();
  private readonly isManualTestClock = this.isE2EMode && new URLSearchParams(window.location.search).get('realtime') !== '1';

  private onGameStateChange?: (
    score: number,
    health: number,
    time: number,
    isGameOver: boolean,
    isPaused: boolean,
    highScore: number,
    durationSeconds: number
  ) => void;

  private currentScore = 0;
  private highScore = Number(localStorage.getItem('pirate_battle_highscore') || '0');
  private configuration: GameConfiguration;
  private playerHealth = DEFAULT_GAME_CONFIGURATION.player.health;
  private activeElapsedMs = 0;
  private enemyHealthBars = new Map<Chaser | Shooter, HealthBar>();

  private maxGameTime = DEFAULT_GAME_CONFIGURATION.sessionSeconds;
  private timeLeft = DEFAULT_GAME_CONFIGURATION.sessionSeconds;
  private baseSpawnIntervalMs = DEFAULT_GAME_CONFIGURATION.spawnIntervalSeconds * 1000;
  private timeAccumulator = 0;

  private gameMap: GameMap;
  private player: Player;
  private projectiles: Projectile[] = [];
  private enemyProjectiles: Projectile[] = [];
  private enemies: (Chaser | Shooter)[] = [];
  private lifePickups: LifePickup[] = [];
  private enemySpawner: EnemySpawner;
  private defeatedBossCount = 0;
  private explosions: Explosion[] = [];
  private peakEnemyCount = 0;
  private peakEntityCount = 0;

  private lastEnemySpawn = 0;
  private spawnInterval = DEFAULT_GAME_CONFIGURATION.spawnIntervalSeconds * 1000;

  constructor(configuration: GameConfiguration = createMatchConfiguration()) {
    this.configuration = configuration;
    this.enemySpawner = new EnemySpawner(configuration);
    this.app = new Application();
    this.world = new Container();
    this.audio = new AudioManager();
    this.gameMap = new GameMap();
    this.playerHealth = configuration.player.health;
    this.player = new Player(this.handleShoot.bind(this), configuration);
  }

  private getZoom(): number {
    const mapW = COLS * TILE;
    const mapH = ROWS * TILE;
    const marginX = window.innerWidth  < 600 ? 0   : 40;
    const marginY = window.innerHeight < 600 ? 0   : 40;
    const zoomX = (window.innerWidth  - marginX) / mapW;
    const zoomY = (window.innerHeight - marginY) / mapH;
    return Math.min(zoomX, zoomY, 0.6) * 0.765;
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
        proj = new Projectile(spawnX, spawnY, angle, this.configuration);
        await proj.init();
        if (this.isDestroyed) return;
        this.world.addChild(proj.sprite);
        this.projectiles.push(proj);
      } else {
        proj.spawn(spawnX, spawnY, angle);
      }
    };

    if (isLateral) {
      const count = this.configuration.weapons.lateralProjectileCount;
      for (let index = 0; index < count; index += 1) {
        const offset = (index - (count - 1) / 2) * this.configuration.weapons.lateralSpacing;
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
      proj = new Projectile(x, y, angle, this.configuration);
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

  public pause() {
    if (this.isGameOver || !this.isInitialized || this.isPaused) return;
    this.isPaused = true;
    this.player.isLocked = true;
    this.audio.playPause();
    this.audio.stopSailing();
    this.audio.stopHealthLow();
    this.notifyState();
  }

  public async init(
    container: HTMLElement,
    onGameStateChange: (
      score: number, health: number, time: number,
      isGameOver: boolean, isPaused: boolean, highScore: number, durationSeconds: number
    ) => void,
    onAssetProgress?: (percent: number) => void,
  ) {
    if (this.isInitialized) return;
    if (this.isManualTestClock) {
      setControlledTime(window.__PIRATE_E2E_CONFIG__?.startTime ?? 1_000_000);
    }

    this.maxGameTime = this.configuration.sessionSeconds;
    this.timeLeft = this.configuration.sessionSeconds;
    this.baseSpawnIntervalMs = this.configuration.spawnIntervalSeconds * 1000;
    this.playerHealth = this.configuration.player.health;
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

    this.app.stage.addChild(this.world);
    this.handleResize();
    window.addEventListener('resize', this.handleResize);

    await this.gameMap.init((progress) => onAssetProgress?.(Math.round(progress * 85)));
    if (this.isDestroyed) return;
    this.world.addChild(this.gameMap.container);

    onAssetProgress?.(90);
    await this.player.init();
    if (this.isDestroyed) return;
    onAssetProgress?.(100);

    this.player.sprite.x = 14 * TILE;
    this.player.sprite.y = 2 * TILE;
    this.world.addChild(this.player.sprite);

    this.audio.playGameStart();
    this.audio.startAmbience();

    this.player.isLocked = false;
    this.isInitialized = true;
    this.lastEnemySpawn = now();
    this.app.canvas.dataset.testid = 'game-canvas';
    this.app.canvas.setAttribute('aria-label', 'Pirate Battle arena');

    this.app.ticker.add((ticker: Ticker) => {
      if (!this.isManualTestClock) this.gameLoop(ticker.deltaTime, ticker.deltaMS);
    });
    if (this.isE2EMode) {
      const testHandle: GameTestHandle = {
        advanceSimulation: (milliseconds) => this.advanceTestSimulation(milliseconds),
        snapshot: () => this.getTestSnapshot(),
      };
      window.__PIRATE_GAME_TEST__ = testHandle;
    }
  }

  public restart(configuration: GameConfiguration = this.configuration) {
    this.configuration = configuration;
    this.enemySpawner.configure(configuration);
    this.enemySpawner.reset();
    this.runId += 1;
    this.maxGameTime = configuration.sessionSeconds;
    this.timeLeft = configuration.sessionSeconds;
    this.baseSpawnIntervalMs = configuration.spawnIntervalSeconds * 1000;
    this.spawnInterval = this.baseSpawnIntervalMs;
    this.currentScore = 0;
    this.playerHealth = configuration.player.health;
    this.isGameOver = false;
    this.isPaused = false;
    this.timeAccumulator = 0;
    this.activeElapsedMs = 0;
    this.defeatedBossCount = 0;
    this.peakEnemyCount = 0;
    this.peakEntityCount = 0;
    this.lastEnemySpawn = now();
    this.audio.stopHealthLow();
    this.projectiles.forEach(p => p.despawn());
    this.enemyProjectiles.forEach(p => p.despawn());
    this.explosions.forEach(e => e.despawn());
    this.enemies.forEach(e => e.destroy());
    this.enemies = [];
    this.enemyHealthBars.forEach((bar) => bar.destroy());
    this.enemyHealthBars.clear();
    this.lifePickups.forEach(pickup => pickup.destroy());
    this.lifePickups = [];
    this.player.sprite.x = 14 * TILE;
    this.player.sprite.y = 2 * TILE;
    this.player.sprite.rotation = -Math.PI / 2;
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

  private registerBossDefeat(boss: Boss) {
    this.defeatedBossCount += 1;
    if (this.defeatedBossCount % 2 === 0) {
      this.spawnLifePickup(boss.sprite.x, boss.sprite.y);
    }
  }

  private async spawnLifePickup(x: number, y: number) {
    const runId = this.runId;
    const pickup = new LifePickup(x, y);
    await pickup.init();
    if (this.isDestroyed || this.isGameOver || runId !== this.runId) {
      pickup.destroy();
      return;
    }
    this.world.addChild(pickup.sprite);
    this.lifePickups.push(pickup);
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
        this.isGameOver, this.isPaused, this.highScore, Math.floor(this.activeElapsedMs / 1000)
      );
    }
  }

  private gameLoop(delta: number, deltaMS: number = this.app.ticker.deltaMS) {
    if (!this.isInitialized || this.isGameOver || this.isPaused) return;

    this.activeElapsedMs += deltaMS;
    this.timeAccumulator += deltaMS;
    if (this.timeAccumulator >= 1000) {
      this.timeLeft -= 1;
      this.timeAccumulator -= 1000;
      const elapsed = this.maxGameTime - this.timeLeft;
      this.spawnInterval = Math.max(
        this.configuration.minimumSpawnIntervalMs,
        this.baseSpawnIntervalMs - (elapsed * this.configuration.spawnIntervalRampMsPerSecond),
      );
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
    const currentTime = now();
    if (currentTime - this.lastEnemySpawn > this.spawnInterval) {
      this.spawnEnemy();
      this.lastEnemySpawn = currentTime;
    }

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      const prevEx = enemy.sprite.x;
      const prevEy = enemy.sprite.y;
      enemy.update(
        delta,
        this.player.sprite.x,
        this.player.sprite.y,
        (x, y, hitbox) => this.gameMap.checkSolidCollision(x, y, hitbox),
      );
      this.enemyHealthBars.get(enemy)?.sync(
        enemy.sprite.x,
        enemy.sprite.y - enemy.sprite.height / 2 - 4,
        enemy.health,
        enemy.maxHealth,
      );
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
      if (areSpritesColliding(enemy.sprite, this.player.sprite)) {
        if (!enemy.isDead) {
          enemy.isDead = true;
          this.audio.playShipCollision();
          this.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
          this.playerHealth -= this.configuration.chaser.collisionDamage;
          if (this.playerHealth <= 0) { this.triggerGameOver(false); return; }
          this.notifyState();
        }
      }
      if (enemy.isDead) {
        enemy.destroy();
        this.enemyHealthBars.get(enemy)?.destroy();
        this.enemyHealthBars.delete(enemy);
        this.enemies.splice(i, 1);
      }
    }

    resolveEnemyCollisions(this.enemies, (x, y, hitbox) => this.gameMap.checkSolidCollision(x, y, hitbox));

    for (let i = this.lifePickups.length - 1; i >= 0; i--) {
      const pickup = this.lifePickups[i];
      if (!areSpritesColliding(pickup.sprite, this.player.sprite)) continue;
      pickup.destroy();
      this.lifePickups.splice(i, 1);
      if (this.playerHealth < this.configuration.player.health) {
        this.playerHealth = Math.min(this.configuration.player.health, this.playerHealth + this.configuration.player.pickupHeal);
        this.audio.setHealthLow(this.playerHealth <= 30 && this.playerHealth > 0);
        this.notifyState();
      }
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
          if (enemy.isDead) continue;
          if (areSpritesColliding(proj.sprite, enemy.sprite)) {
            proj.despawn();
            this.audio.playWoodHit();
            const defeated = enemy.takeHit(this.configuration.player.projectileDamage);
            if (defeated) {
              enemy.isDead = true;
              this.audio.playScorePoint();
              this.spawnExplosion(enemy.sprite.x, enemy.sprite.y);
              this.addScore();
              if (enemy instanceof Boss) this.registerBossDefeat(enemy);
              this.notifyState();
            }
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
      } else if (areSpritesColliding(proj.sprite, this.player.sprite)) {
        proj.despawn();
        this.audio.playWoodHit();
        this.spawnExplosion(proj.sprite.x, proj.sprite.y);
        this.playerHealth -= this.configuration.shooter.projectileDamage;
        if (this.playerHealth <= 0) { this.triggerGameOver(false); return; }
        this.notifyState();
      }
    }

    for (let i = 0; i < this.explosions.length; i++) {
      const exp = this.explosions[i];
      if (!exp.isDead) exp.update(delta);
    }
    let activeEntityCount = this.enemies.length + this.lifePickups.length;
    for (let i = 0; i < this.projectiles.length; i++) {
      if (!this.projectiles[i].isDead) activeEntityCount++;
    }
    for (let i = 0; i < this.enemyProjectiles.length; i++) {
      if (!this.enemyProjectiles[i].isDead) activeEntityCount++;
    }
    for (let i = 0; i < this.explosions.length; i++) {
      if (!this.explosions[i].isDead) activeEntityCount++;
    }
    this.peakEnemyCount = Math.max(this.peakEnemyCount, this.enemies.length);
    this.peakEntityCount = Math.max(this.peakEntityCount, activeEntityCount);
  }

  private async spawnEnemy() {
    if (this.isDestroyed || this.isGameOver || this.isPaused) return;
    const zoom = this.world.scale.x || this.getZoom();
    const enemy = this.enemySpawner.createNext({
      left: -this.world.x / zoom,
      right: (window.innerWidth - this.world.x) / zoom,
      top: -this.world.y / zoom,
      bottom: (window.innerHeight - this.world.y) / zoom,
    }, 96 / zoom, this.handleEnemyShoot.bind(this));
    if (enemy) await this.activateEnemy(enemy);
  }

  private async activateEnemy(enemy: Chaser | Shooter) {
    const healthBar = new HealthBar();
    try {
      await Promise.all([enemy.init(), healthBar.init()]);
    } catch (error) {
      enemy.destroy();
      healthBar.destroy();
      console.error('Enemy assets failed to load.', error);
      return;
    }
    if (this.isDestroyed || this.isGameOver || this.isPaused) {
      enemy.destroy();
      healthBar.destroy();
      return;
    }
    healthBar.sync(
      enemy.sprite.x,
      enemy.sprite.y - enemy.sprite.height / 2 - 4,
      enemy.health,
      enemy.maxHealth,
    );
    this.world.addChild(enemy.sprite, healthBar.frame, healthBar.fill);
    this.enemies.push(enemy);
    this.enemyHealthBars.set(enemy, healthBar);
  }

  public destroy() {
    this.isDestroyed = true;
    this.player.isLocked = true;
    window.removeEventListener('resize', this.handleResize);
    if (this.isE2EMode && window.__PIRATE_GAME_TEST__) delete window.__PIRATE_GAME_TEST__;
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
    this.player.destroy();
    this.gameMap.destroy();
    this.projectiles.forEach(p => p.destroy());
    this.enemyProjectiles.forEach(p => p.destroy());
    this.enemies.forEach(e => e.destroy());
    this.enemyHealthBars.forEach((bar) => bar.destroy());
    this.enemyHealthBars.clear();
    this.lifePickups.forEach(pickup => pickup.destroy());
    this.explosions.forEach(e => e.destroy());
    if (isRendererReady) {
      try { this.app.destroy(true, { children: true }); } catch (e) {}
    }
    this.isInitialized = false;
  }

  private advanceTestSimulation(milliseconds: number) {
    if (!this.isManualTestClock || milliseconds <= 0 || !Number.isFinite(milliseconds)) return;
    const frameMs = 1000 / 60;
    let remaining = milliseconds;
    while (remaining > 0 && !this.isDestroyed) {
      const currentFrameMs = Math.min(frameMs, remaining);
      advanceControlledTime(currentFrameMs);
      this.gameLoop(currentFrameMs / frameMs, currentFrameMs);
      remaining -= currentFrameMs;
    }
    if (!this.isDestroyed && this.app.renderer) this.app.renderer.render(this.app.stage);
  }

  private getTestSnapshot(): GameTestSnapshot {
    const activeProjectiles = this.projectiles.filter((projectile) => !projectile.isDead);
    const activeEnemyProjectiles = this.enemyProjectiles.filter((projectile) => !projectile.isDead);
    const activeExplosions = this.explosions.filter((explosion) => !explosion.isDead);
    return {
      score: this.currentScore,
      health: this.playerHealth,
      timeLeft: this.timeLeft,
      isPaused: this.isPaused,
      isGameOver: this.isGameOver,
      spawnCount: this.enemySpawner.totalSpawns,
      peakEnemyCount: this.peakEnemyCount,
      peakEntityCount: this.peakEntityCount,
      player: {
        x: this.player.sprite.x,
        y: this.player.sprite.y,
        rotation: this.player.sprite.rotation,
      },
      enemies: this.enemies.filter((enemy) => !enemy.isDead).map((enemy) => ({
        kind: enemy instanceof Boss ? 'boss' : enemy instanceof Shooter ? 'shooter' : 'chaser',
        model: enemy.modelId,
        x: enemy.sprite.x,
        y: enemy.sprite.y,
        health: enemy.health,
      })),
      projectiles: activeProjectiles.map((projectile) => ({ x: projectile.sprite.x, y: projectile.sprite.y })),
      enemyProjectiles: activeEnemyProjectiles.map((projectile) => ({ x: projectile.sprite.x, y: projectile.sprite.y })),
      pickups: this.lifePickups.map((pickup) => ({ x: pickup.sprite.x, y: pickup.sprite.y })),
      entityCount: this.enemies.length + activeProjectiles.length + activeEnemyProjectiles.length + activeExplosions.length + this.lifePickups.length,
    };
  }
}
