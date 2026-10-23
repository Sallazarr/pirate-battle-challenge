import { Assets, Sprite } from 'pixi.js';

export class LifePickup {
  public readonly sprite = new Sprite();

  constructor(x: number, y: number) {
    this.sprite.anchor.set(0.5);
    this.sprite.position.set(x, y);
  }

  public async init() {
    this.sprite.texture = await Assets.load('/assets/png/default/ui/hud/icon_heart.png');
    this.sprite.width = 32;
    this.sprite.height = 32;
  }

  public destroy() {
    this.sprite.destroy();
  }
}
