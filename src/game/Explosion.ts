import { Sprite, Assets } from 'pixi.js';
import { random } from './random';

export class Explosion {
  public sprite: Sprite;
  public isDead = false;
  private type: number = 1;
  private texturesReady = false;

  constructor(x: number, y: number, type?: number) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.spawn(x, y, type);
  }

  public async init() {
    try {
      const textures = await Promise.all(
        [1, 2, 3].map((type) => Assets.load(`/assets/png/default/effects/explosion_${type}.png`)),
      );
      this.sprite.texture = textures[this.type - 1];
      this.texturesReady = true;
    } catch (e) {
      console.warn('Texturas de explosão não foram carregadas:', e);
    }
  }

  public spawn(x: number, y: number, type?: number) {
    this.sprite.x = x;
    this.sprite.y = y;
    
    this.type = type || (Math.floor(random() * 2) + 1);
    
    if (this.texturesReady) {
      const texture = Assets.get(`/assets/png/default/effects/explosion_${this.type}.png`);
      if (texture) this.sprite.texture = texture;
    }

    this.sprite.scale.set(0.3);
    this.sprite.alpha = 1;
    this.isDead = false;
    this.sprite.visible = true;
  }

  public despawn() {
    this.isDead = true;
    this.sprite.visible = false;
  }

  public update(delta: number) {
    if (this.isDead) return;
    
    this.sprite.scale.x += 0.03 * delta;
    this.sprite.scale.y += 0.03 * delta;
    this.sprite.alpha -= 0.04 * delta; 

    if (this.sprite.alpha <= 0) {
      this.despawn();
    }
  }

  public destroy() {
    this.sprite.destroy();
  }
}
