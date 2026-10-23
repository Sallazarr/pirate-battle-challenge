import { Container, Sprite, Assets, Rectangle } from 'pixi.js';
import { buildMapData, TILE, COLS, ROWS } from './mapData';

export class GameMap {
  public container: Container;
  public solidBounds: Rectangle[] = [];

  constructor() {
    this.container = new Container();
  }

  public async init() {
    const map = buildMapData();

    for (const s of map.solids) {
      this.solidBounds.push(new Rectangle(s.x * TILE, s.y * TILE, s.w * TILE, s.h * TILE));
    }

    const ids = new Set<number>([73]);
    for (const layer of map.layers)
      for (const row of layer.data) for (const cell of row) if (cell) ids.add(cell.id);
    await Promise.all([...ids].map(id => Assets.load(this.path(id))));

    // OCEANO EXPANDIDO: Garante cobertura total para monitores 1440p, Ultrawide e 4K
    for (let r = -60; r <= 60; r++) {
      for (let c = -60; c <= 80; c++) {
        this.addTile(73, c * TILE, r * TILE, TILE);
      }
    }

    for (const layer of map.layers) {
      for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
          const cell = layer.data[row][col];
          if (cell) this.addTile(cell.id, col * TILE, row * TILE, TILE, cell.fx, cell.fy);
        }
      }
    }
  }

  private path(id: number) {
    return `/assets/png/default/tiles/tile_${id}.png`;
  }

  private addTile(id: number, x: number, y: number, size: number, fx = false, fy = false) {
    try {
      const texture = Assets.get(this.path(id));
      const sprite = new Sprite(texture);
      const sx = size / texture.width;
      const sy = size / texture.height;
      sprite.scale.set(fx ? -sx : sx, fy ? -sy : sy);
      sprite.x = x + (fx ? size : 0);
      sprite.y = y + (fy ? size : 0);
      this.container.addChild(sprite);
    } catch (e) {
      console.warn(`Tile ${id} falhou ao carregar.`);
    }
  }

  public checkSolidCollision(x: number, y: number, hitboxSize: number = 36): boolean {
    const left = x - hitboxSize / 2;
    const right = x + hitboxSize / 2;
    const top = y - hitboxSize / 2;
    const bottom = y + hitboxSize / 2;

    for (const bounds of this.solidBounds) {
      if (left < bounds.x + bounds.width && right > bounds.x && top < bounds.y + bounds.height && bottom > bounds.y) {
        return true;
      }
    }
    return false;
  }

  public destroy() {
    this.container.destroy({ children: true });
  }
}