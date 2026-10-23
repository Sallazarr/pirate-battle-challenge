import { Sprite, Assets } from 'pixi.js';
import { now } from './gameClock';
 
export interface PlayerInputs {
  up: boolean;
  left: boolean;
  right: boolean;
  space: boolean;   // tiro frontal (Space)
  shift: boolean;   // tiro lateral esquerdo (Q)
  ctrl: boolean;    // tiro lateral direito (E)
}
 
export class Player {
  public sprite: Sprite;
  public isLocked = true;
  public moveSpeed = 3;
  public rotationSpeed = 0.05;
 
  // Objeto unificado — teclado E touch escrevem aqui
  public inputs: PlayerInputs = {
    up: false, left: false, right: false,
    space: false, shift: false, ctrl: false,
  };
 
  private lastShotTime = 0;
  private shootCooldown = 500;
 
  private onShoot: (x: number, y: number, angle: number, isLateral: boolean, shipRotation: number) => void;
 
  private _keydown: (e: KeyboardEvent) => void;
  private _keyup: (e: KeyboardEvent) => void;
 
  constructor(onShoot: (x: number, y: number, angle: number, isLateral: boolean, shipRotation: number) => void) {
    this.sprite = new Sprite();
    this.sprite.anchor.set(0.5);
    this.onShoot = onShoot;
 
    this._keydown = (e: KeyboardEvent) => {
      if (this.isLocked) return;
      switch (e.code) {
        case 'ArrowUp':    case 'KeyW': this.inputs.up    = true; break;
        case 'ArrowLeft':  case 'KeyA': this.inputs.left  = true; break;
        case 'ArrowRight': case 'KeyD': this.inputs.right = true; break;
        case 'Space':  this.inputs.space = true; e.preventDefault(); break;
        case 'KeyQ':   this.inputs.shift = true; break;
        case 'KeyE':   this.inputs.ctrl  = true; break;
      }
    };
 
    this._keyup = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'ArrowUp':    case 'KeyW': this.inputs.up    = false; break;
        case 'ArrowLeft':  case 'KeyA': this.inputs.left  = false; break;
        case 'ArrowRight': case 'KeyD': this.inputs.right = false; break;
        case 'Space':  this.inputs.space = false; break;
        case 'KeyQ':   this.inputs.shift = false; break;
        case 'KeyE':   this.inputs.ctrl  = false; break;
      }
    };
 
    window.addEventListener('keydown', this._keydown);
    window.addEventListener('keyup', this._keyup);
  }
 
  public async init() {
    this.sprite.texture = await Assets.load('/assets/png/default/ships/ship_2.png');
    this.sprite.x = window.innerWidth / 2;
    this.sprite.y = window.innerHeight / 2;
    this.sprite.rotation = -Math.PI / 2;
  }
 
  public update(delta: number) {
    if (this.isLocked) return;
 
    if (this.inputs.left)  this.sprite.rotation -= this.rotationSpeed * delta;
    if (this.inputs.right) this.sprite.rotation += this.rotationSpeed * delta;
 
    // Compensação de -90° porque o PNG aponta para cima
    const mathAngle = this.sprite.rotation + Math.PI / 2;
 
    if (this.inputs.up) {
      this.sprite.x += Math.cos(mathAngle) * this.moveSpeed * delta;
      this.sprite.y += Math.sin(mathAngle) * this.moveSpeed * delta;
    }
 
    const currentTime = now();
    if (currentTime - this.lastShotTime > this.shootCooldown) {
      if (this.inputs.space) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle, false, mathAngle);
        this.lastShotTime = currentTime;
      } else if (this.inputs.shift) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle - Math.PI / 2, true, mathAngle);
        this.lastShotTime = currentTime;
      } else if (this.inputs.ctrl) {
        this.onShoot(this.sprite.x, this.sprite.y, mathAngle + Math.PI / 2, true, mathAngle);
        this.lastShotTime = currentTime;
      }
    }
  }
 
  public destroy() {
    window.removeEventListener('keydown', this._keydown);
    window.removeEventListener('keyup', this._keyup);
    this.inputs = { up: false, left: false, right: false, space: false, shift: false, ctrl: false };
    this.sprite.destroy();
  }
}
