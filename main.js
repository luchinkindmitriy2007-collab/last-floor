import Phaser from 'phaser';
import { GAME_W, GAME_H } from './Constants.js';
import { BootScene } from './BootScene.js';
import { PreloadScene } from './PreloadScene.js';
import { MenuScene } from './MenuScene.js';
import { GameScene } from './GameScene.js';
import { UIScene } from './UIScene.js';
import { ResultScene } from './ResultScene.js';
import { isDev, log } from './Helpers.js';

const forceCanvas = new URLSearchParams(location.search).has('canvas');
const config = {
  type: forceCanvas ? Phaser.CANVAS : Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#07060b',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  physics: { default: 'arcade', arcade: { debug: false, fps: 60 } },
  scale: { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  fps: { target: 60, smoothStep: true },
  scene: [BootScene, PreloadScene, MenuScene, GameScene, UIScene, ResultScene]
};

function start() {
  const game = new Phaser.Game(config);

  // Целочисленное масштабирование — пиксели остаются квадратными и чёткими.
  const fit = () => {
    const sx = window.innerWidth / GAME_W;
    const sy = window.innerHeight / GAME_H;
    let z = Math.floor(Math.min(sx, sy));
    if (z < 1) z = Math.min(sx, sy);
    game.scale.setZoom(z);
  };
  window.addEventListener('resize', fit);
  game.events.once('ready', () => {
    fit();
    game.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  });
  if (isDev()) window.__LF = game;
  return game;
}

try {
  start();
} catch (e) {
  log.error('Не удалось запустить игру', e);
  const el = document.getElementById('boot-error');
  if (el) { el.hidden = false; el.textContent = 'Не удалось запустить игру. Обновите страницу или попробуйте другой браузер.'; }
}

window.addEventListener('error', (e) => log.error('Необработанная ошибка:', e.message, e.filename, e.lineno));
window.addEventListener('unhandledrejection', (e) => log.error('Необработанный промис:', e.reason));
