import { GameScreen } from './ui.js';
import levels from './levels.json';

const app = document.getElementById('app');
const game = new GameScreen(app, levels);

game.showTitle();
