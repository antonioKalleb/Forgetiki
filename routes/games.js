var express = require('express');
var router = express.Router();

const gamesList = [
  { name: 'Fear & Hunger', genre: 'RPG / Survival Horror', difficulty: 'Extrema', description: 'Um jogo brutal focado em exploração masoquista, gestão de recursos e escolhas de alto risco.' },
  { name: 'Rain World', genre: 'Survival Platformer', difficulty: 'Muito Alta', description: 'Controle um Slugcat num ecossistema pré-histórico com IA de predadores imprevisível.' },
  { name: 'La-Mulana', genre: 'Metroidvania / Puzzle', difficulty: 'Extrema', description: 'Ruínas antigas com enigmas complexos que exigem anotações reais para serem resolvidos.' },
  { name: 'Pathologic 2', genre: 'Survival / Narrative', difficulty: 'Muito Alta', description: 'Uma simulação angustiante de combate a uma praga numa cidade isolada contra o tempo.' },
  { name: 'Nine Sols', genre: 'Action Platformer (Sekiro-like)', difficulty: 'Alta', description: 'Ação 2D focada em parry num cenário Taopunk único.' },
  { name: 'Vagrant Story', genre: 'Tactical RPG', difficulty: 'Alta', description: 'Clássico sombrio focado em criação de armas e combate tático por partes do corpo.' }
];

/* GET Lista de Jogos/Fandoms */
router.get('/', function(req, res, next) {
  res.render('games', { title: 'Fandoms & Jogos', games: gamesList });
});

module.exports = router;