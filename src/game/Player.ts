import { Sprite, Assets } from 'pixi.js';

export class Player {
  public sprite: Sprite;
  public isLocked = true; // Bloqueio inicial para menus e pausas
  public moveSpeed = 3;
  public rotationSpeed = 0.05;

  private keys: Record<string, boolean> = {};
  
  // Gestão de cooldown (em milissegundos)
  private lastShotTime = 0;
  private shootCooldown = 500; 

  // Callback atualizado para aceitar a rotação do casco (5º argumento) para alinhar os tiros
  private onShoot: (x: number, y: number, angle: number, isLateral: boolean, shipRotation: number) => void;

  constructor(onShoot: (x: number, y: number, angle: number, isLateral: boolean, shipRotation: number) => void) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.onShoot = onShoot;

    const keydown = (e: KeyboardEvent) => { this.keys[e.code] = true; };
    const keyup = (e: KeyboardEvent) => { this.keys[e.code] = false; };
    
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    
    // Guardamos as funções para conseguir remover os event listeners depois
    (this as any)._keydown = keydown;
    (this as any)._keyup = keyup;
  }

  public async init() {
    this.sprite.texture = await Assets.load('/assets/png/default/ships/ship_1.png');
    this.sprite.x = window.innerWidth / 2;
    this.sprite.y = window.innerHeight / 2;
    this.sprite.rotation = -Math.PI / 2; 
  }

  public update(delta: number) {
    // Se estiver bloqueado (Pausa, Game Over ou Menu), ignora inputs
    if (this.isLocked) return;

    if (this.keys['ArrowLeft'] || this.keys['KeyA']) this.sprite.rotation -= this.rotationSpeed * delta;
    if (this.keys['ArrowRight'] || this.keys['KeyD']) this.sprite.rotation += this.rotationSpeed * delta;

    // Compensação de -90 graus porque o PNG do navio aponta para cima
    const mathAngle = this.sprite.rotation + Math.PI / 2;

    // Apenas movimento para a frente, sem marcha-atrás
    if (this.keys['ArrowUp'] || this.keys['KeyW']) {
      this.sprite.x += Math.cos(mathAngle) * this.moveSpeed * delta;
      this.sprite.y += Math.sin(mathAngle) * this.moveSpeed * delta;
    }

    const now = Date.now();
    if (now - this.lastShotTime > this.shootCooldown) {
      if (this.keys['Space']) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle, false, mathAngle); // Frente
        this.lastShotTime = now;
      } else if (this.keys['KeyQ']) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle - Math.PI / 2, true, mathAngle); // Lado Esquerdo
        this.lastShotTime = now;
      } else if (this.keys['KeyE']) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle + Math.PI / 2, true, mathAngle); // Lado Direito
        this.lastShotTime = now;
      }
    }
  }

  public destroy() {
    window.removeEventListener('keydown', (this as any)._keydown);
    window.removeEventListener('keyup', (this as any)._keyup);
    this.sprite.destroy();
  }
}