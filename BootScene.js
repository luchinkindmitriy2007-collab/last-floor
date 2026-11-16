import Phaser from 'phaser';
import { registerPixelFont } from './PixelFont.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    registerPixelFont(this, 'px');
    this.scene.start('Preload');
  }
}
