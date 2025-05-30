import { Game } from './game.js';

window.onload = () => {
    new Game();
};

// Add window resize event listener
window.addEventListener('resize', () => {
    if (window.gameInstance) window.gameInstance.renderer.onWindowResize();
  });