import { Assets, Graphics, Sprite } from 'pixi.js';

export class HealthBar {
  public readonly frame = new Sprite();
  public readonly fill = new Graphics();

  private readonly frameWidth = 86;
  private readonly frameHeight = 21;
  private readonly fillWidth = 60;
  private readonly fillHeight = 10;
  private lastRatio = -1;

  public async init() {
    this.frame.texture = await Assets.load('/assets/png/default/ui/hud/enemy_health_frame.png');
    this.frame.anchor.set(0.5, 1);
    this.frame.width = this.frameWidth;
    this.frame.height = this.frameHeight;
    this.drawFill(1);
  }

  public sync(x: number, y: number, health: number, maxHealth: number) {
    this.frame.position.set(x, y);
    const barCenterY = y - this.frameHeight / 2;
    this.fill.position.set(x - this.fillWidth / 2, barCenterY - this.fillHeight / 2);
    const ratio = maxHealth > 0 ? Math.max(0, Math.min(1, health / maxHealth)) : 0;
    if (ratio !== this.lastRatio) this.drawFill(ratio);
  }

  private drawFill(ratio: number) {
    this.lastRatio = ratio;
    this.fill.clear();
    if (ratio <= 0) return;

    const color = ratio <= 0.34 ? 0xf04444 : ratio <= 0.67 ? 0xffbf38 : 0x39ed62;
    this.fill.roundRect(0, 0, this.fillWidth * ratio, this.fillHeight, this.fillHeight / 2).fill(color);
  }

  public destroy() {
    this.frame.destroy();
    this.fill.destroy();
  }
}
