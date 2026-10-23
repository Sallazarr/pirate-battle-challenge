import { Sprite, Assets } from 'pixi.js';

export class Chaser {
  public sprite: Sprite;
  public isDead = false;
  
  private speed = 2;

  constructor(x: number, y: number) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.sprite.x = x;
    this.sprite.y = y;
  }

  public async init() {
    // Confirme se o nome do asset corresponde a um navio inimigo na sua pasta
    this.sprite.texture = await Assets.load('/assets/png/default/ships/ship_7.png');
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