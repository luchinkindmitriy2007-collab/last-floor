import Phaser from 'phaser';

/**
 * Абстракция управления: клавиатура + мышь сейчас, сенсорный ввод позже
 * (достаточно заполнить те же поля из виртуального джойстика).
 */
export class Controls {
  constructor(scene) {
    this.scene = scene;
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = scene.input.keyboard.addKeys({
      up: K.W, down: K.S, left: K.A, right: K.D,
      up2: K.UP, down2: K.DOWN, left2: K.LEFT, right2: K.RIGHT,
      attack: K.SPACE, attack2: K.J, ability: K.SHIFT, ability2: K.K,
      interact: K.E, interact2: K.F, potion: K.Q,
      inventory: K.TAB, inventory2: K.I, map: K.M, pause: K.ESC
    }, false);
    scene.input.keyboard.addCapture([K.SPACE, K.TAB, K.UP, K.DOWN, K.LEFT, K.RIGHT]);
    this.pointer = scene.input.activePointer;
    this.lastMouseMove = -99999;
    this.mouseAim = false;
    scene.input.on('pointermove', () => { this.lastMouseMove = scene.time.now; this.mouseAim = true; });
    scene.input.on('pointerdown', () => { this.lastMouseMove = scene.time.now; this.mouseAim = true; });
    this.touch = { move: null, attack: false, ability: false }; // для будущего сенсорного ввода
    this.pressed = {};
    this.prev = {};
  }

  isDown(...names) { return names.some((n) => this.keys[n] && this.keys[n].isDown); }

  /** Вызывать один раз за кадр: вычисляет «нажато в этом кадре». */
  poll() {
    const p = this.pointer;
    const now = {
      ability: this.isDown('ability', 'ability2') || (p.rightButtonDown && p.rightButtonDown()) || this.touch.ability,
      interact: this.isDown('interact', 'interact2'),
      potion: this.isDown('potion'),
      inventory: this.isDown('inventory', 'inventory2'),
      map: this.isDown('map'),
      pause: this.isDown('pause')
    };
    for (const k of Object.keys(now)) { this.pressed[k] = now[k] && !this.prev[k]; this.prev[k] = now[k]; }
  }
  justPressed(name) { return !!this.pressed[name]; }

  move() {
    if (this.touch.move) return this.touch.move;
    let x = 0; let y = 0;
    if (this.isDown('left', 'left2')) x -= 1;
    if (this.isDown('right', 'right2')) x += 1;
    if (this.isDown('up', 'up2')) y -= 1;
    if (this.isDown('down', 'down2')) y += 1;
    if (x && y) { x *= Math.SQRT1_2; y *= Math.SQRT1_2; }
    return { x, y };
  }

  attackHeld() {
    const p = this.pointer;
    return this.isDown('attack', 'attack2') || (p.leftButtonDown && p.leftButtonDown() && p.isDown) || this.touch.attack;
  }

  /** Мышь считается прицелом, если ею пользовались последние 4 с. */
  usingMouse() { return this.mouseAim && this.scene.time.now - this.lastMouseMove < 4000; }
  aimWorld(cam) { const p = this.pointer; const wp = cam.getWorldPoint(p.x, p.y); return wp; }
}
