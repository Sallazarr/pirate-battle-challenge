export class AudioManager {
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private oceanAmbience: HTMLAudioElement | null = null;
  private sailingLoop: HTMLAudioElement | null = null;
  private healthLowAudio: HTMLAudioElement | null = null;
  
  private currentSailingVolume = 0;
  public isMuted = false;

  constructor() {
    this.preloadSounds();
  }

  private preloadSounds() {
    const soundFiles = [
      'cannon_broadside.wav',
      'cannon_fire_1.wav',
      'cannon_fire_2.wav',
      'cannon_fire_3.wav',
      'cannonball_water_hit_1.wav',
      'cannonball_water_hit_2.wav',
      'game_complete.wav',
      'game_over.wav',
      'game_pause.wav',
      'game_resume.wav',
      'game_start.wav',
      'health_low.wav',
      'ocean_ambience_loop.wav',
      'score_point.wav',
      'ship_collision.wav',
      'ship_explosion_1.wav',
      'ship_explosion_2.wav',
      'ship_sailing_loop.wav',
      'ship_sinking.wav',
      'ship_wood_hit_1.wav',
      'ship_wood_hit_2.wav',
      'time_warning.wav',
      'ui_click.wav'
    ];

    soundFiles.forEach((file) => {
      const audio = new Audio(`/assets/sounds/${file}`);
      audio.preload = 'auto';
      this.sounds.set(file, audio);
    });

    const ocean = this.sounds.get('ocean_ambience_loop.wav');
    if (ocean) {
      this.oceanAmbience = ocean;
      this.oceanAmbience.loop = true;
      this.oceanAmbience.volume = 0.15;
    }

    const sailing = this.sounds.get('ship_sailing_loop.wav');
    if (sailing) {
      this.sailingLoop = sailing;
      this.sailingLoop.loop = true;
      this.sailingLoop.volume = 0;
    }

    const health = this.sounds.get('health_low.wav');
    if (health) {
      this.healthLowAudio = health;
      this.healthLowAudio.loop = true;
      this.healthLowAudio.volume = 1;
    }
  }

  private playSound(key: string, volume = 0.2) {
    if (this.isMuted) return;
    const sound = this.sounds.get(key);
    if (sound) {
      const audioClone = sound.cloneNode() as HTMLAudioElement;
      audioClone.volume = volume;
      audioClone.play().catch(() => {});
    }
  }

  public startAmbience() {
    if (this.isMuted || !this.oceanAmbience) return;
    this.oceanAmbience.play().catch(() => {});
  }

  public stopAmbience() {
    if (this.oceanAmbience) {
      this.oceanAmbience.pause();
      this.oceanAmbience.currentTime = 0;
    }
  }

  public updateSailing(isMoving: boolean, delta: number) {
    if (this.isMuted || !this.sailingLoop) return;

    const maxVolume = 0.12;
    const fadeSpeed = 0.003 * delta;

    if (isMoving) {
      if (this.sailingLoop.paused) {
        this.sailingLoop.play().catch(() => {});
      }
      this.currentSailingVolume = Math.min(maxVolume, this.currentSailingVolume + fadeSpeed);
    } else {
      this.currentSailingVolume = Math.max(0, this.currentSailingVolume - fadeSpeed);
      if (this.currentSailingVolume <= 0 && !this.sailingLoop.paused) {
        this.sailingLoop.pause();
      }
    }

    this.sailingLoop.volume = this.currentSailingVolume;
  }

  public stopSailing() {
    if (this.sailingLoop) {
      this.sailingLoop.pause();
      this.sailingLoop.currentTime = 0;
      this.currentSailingVolume = 0;
      this.sailingLoop.volume = 0;
    }
  }

  public setHealthLow(isLow: boolean) {
    if (this.isMuted || !this.healthLowAudio) return;

    if (isLow) {
      this.healthLowAudio.volume = 1;
      if (this.healthLowAudio.paused) {
        this.healthLowAudio.play().catch(() => {});
      }
    } else {
      if (!this.healthLowAudio.paused) {
        this.healthLowAudio.pause();
        this.healthLowAudio.currentTime = 0;
      }
    }
  }

  public stopHealthLow() {
    if (this.healthLowAudio) {
      this.healthLowAudio.pause();
      this.healthLowAudio.currentTime = 0;
    }
  }

  // --- INTERFACE E MENU ---
  public playPause() {
    this.playSound('game_pause.wav', 0.5);
  }

  public playResume() {
    this.playSound('game_resume.wav', 0.5);
  }

  public playClick() {
    this.playSound('ui_click.wav', 0.4);
  }

  // --- EFEITOS DE COMBATE ---
  public playTimeWarning() {
    this.playSound('time_warning.wav', 0.4);
  }

  public playCannon(isLateral = false) {
    if (isLateral) {
      this.playSound('cannon_broadside.wav', 0.15);
    } else {
      const num = Math.floor(Math.random() * 3) + 1;
      this.playSound(`cannon_fire_${num}.wav`, 0.12);
    }
  }

  public playExplosion() {
    const num = Math.floor(Math.random() * 2) + 1;
    this.playSound(`ship_explosion_${num}.wav`, 0.18);
  }

  public playWoodHit() {
    const num = Math.floor(Math.random() * 2) + 1;
    this.playSound(`ship_wood_hit_${num}.wav`, 0.15);
  }

  public playWaterHit() {
    const num = Math.floor(Math.random() * 2) + 1;
    this.playSound(`cannonball_water_hit_${num}.wav`, 0.10);
  }

  public playShipCollision() {
    this.playSound('ship_collision.wav', 0.20);
  }

  public playShipSinking() {
    this.playSound('ship_sinking.wav', 0.18);
  }

  public playGameStart() {
    this.playSound('game_start.wav', 0.35);
  }

  public playGameOver() {
    this.playSound('game_over.wav', 0.45);
  }

  public playGameComplete() {
    this.playSound('game_complete.wav', 0.45);
  }

  public playScorePoint() {
    this.playSound('score_point.wav', 0.25);
  }
}