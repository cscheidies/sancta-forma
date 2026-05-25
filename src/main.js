import { GameScreen } from './ui.js';
import levels from './levels.json';

const app = document.getElementById('app');
const game = new GameScreen(app, levels);

// Show narrative on first ever visit; title screen on repeat visits
const seen = localStorage.getItem('sf-seen');
if (seen) {
  game.showTitle();
} else {
  localStorage.setItem('sf-seen', '1');
  game.showNarrative();
}
