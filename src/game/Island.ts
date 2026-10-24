import { Sprite, Assets } from 'pixi.js';

export class Island {
  public sprite: Sprite;

  constructor(x: number, y: number) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.sprite.scale.set(2);
  }

  public async init() {
    this.sprite.texture = await Assets.load('/assets/png/default/tiles/tile_1.png');
  }

  public destroy() {
    this.sprite.destroy();
  }
}
