import { Sprite, Assets } from 'pixi.js';

export class Chaser {
  public sprite: Sprite;
  public isDead = false;
  public health: number;
  public modelId: string;
  
  private speed = 2;
  private texturePath: string;

  constructor(x: number, y: number, model: 'basic' | 'advanced' = 'basic') {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
    this.health = model === 'advanced' ? 2 : 1;
    const shipModel = model === 'advanced' ? 4 : 7;
    this.modelId = model === 'advanced' ? 'chaser-advanced' : 'chaser-basic';
    this.texturePath = `/assets/png/default/ships/ship_${shipModel}.png`;
  }

  public async init() {
    this.sprite.texture = await Assets.load(this.texturePath);
  }

  public takeHit(): boolean {
    this.health = Math.max(0, this.health - 1);
    return this.health === 0;
  }

  // Recebe a posição do jogador para o perseguir
  public update(delta: number, playerX: number, playerY: number) {
    const dx = playerX - this.sprite.x;
    const dy = playerY - this.sprite.y;
    const angle = Math.atan2(dy, dx);

    // A imagem roda +90 graus para alinhar o nariz com o jogador
    this.sprite.rotation = angle - Math.PI / 2;

    // A física usa o ângulo matemático puro
    this.sprite.x += Math.cos(angle) * this.speed * delta;
    this.sprite.y += Math.sin(angle) * this.speed * delta;
  }

  public destroy() {
    this.sprite.destroy();
  }
}
