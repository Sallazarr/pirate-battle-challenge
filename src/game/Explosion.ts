import { Sprite, Assets } from 'pixi.js';

export class Explosion {
  public sprite: Sprite;
  public isDead = false;
  private type: number = 1;

  constructor(x: number, y: number, type?: number) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.spawn(x, y, type);
  }

  public async init() {
    try {
      // Como o Pooling exige reuso rápido, podemos carregar
      // e cachear a textura específica desta instância
      const texture = await Assets.load(`/assets/png/default/effects/explosion_${this.type}.png`);
      this.sprite.texture = texture;
    } catch (e) {
      console.warn(`Textura explosion_${this.type}.png não encontrada:`, e);
    }
  }

  public spawn(x: number, y: number, type?: number) {
    this.sprite.x = x;
    this.sprite.y = y;
    
    // Repõe o tipo e a textura
    this.type = type || (Math.floor(Math.random() * 2) + 1);
    
    // Tenta repor a textura em cache para o novo tipo, se já estiver carregada na memória global
    import('pixi.js').then(({ Assets }) => {
      const tex = Assets.get(`/assets/png/default/effects/explosion_${this.type}.png`);
      if (tex) this.sprite.texture = tex;
    });

    this.sprite.scale.set(0.3); // Comportamento original
    this.sprite.alpha = 1;      // Repõe transparência
    this.isDead = false;
    this.sprite.visible = true;
  }

  public despawn() {
    this.isDead = true;
    this.sprite.visible = false;
  }

  public update(delta: number) {
    if (this.isDead) return;
    
    // Animação original restaurada
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