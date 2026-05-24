import { GameScreen } from './ui.js';
import levels from './levels.json';

const app = document.getElementById('app');
const game = new GameScreen(app, levels);

// Show narrative on first visit; skip to level select on repeat
const seen = sessionStorage.getItem('sf-seen');
if (seen) {
  game.showLevelSelect();
} else {
  sessionStorage.setItem('sf-seen', '1');
  game.showNarrative();
}
