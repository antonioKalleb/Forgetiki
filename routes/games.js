var express = require('express');
var router = express.Router();

const officialGames = [
  {
    name: 'Fear & Hunger',
    genre: 'RPG / Survival Horror',
    difficulty: 'Extrema',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
    description: 'Um jogo brutal focado em exploração masoquista, gestão de recursos e escolhas de alto risco nas masmorras de Prehevil.'
  },
  {
    name: 'Rain World',
    genre: 'Survival Platformer',
    difficulty: 'Muito Alta',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&q=80',
    description: 'Controle um Slugcat num ecossistema pré-histórico hostil com IA de predadores dinâmica e ciclos de chuva mortais.'
  },
  {
    name: 'La-Mulana',
    genre: 'Metroidvania / Puzzle',
    difficulty: 'Extrema',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=300&q=80',
    description: 'Ruínas antigas repletas de armadilhas e enigmas arqueológicos complexos que exigem anotações reais para serem decifrados.'
  },
  {
    name: 'Pathologic 2',
    genre: 'Survival / Narrative',
    difficulty: 'Muito Alta',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&q=80',
    description: 'Uma simulação angustiante de 12 dias combatendo uma praga mortal numa cidade isolada onde recursos e tempo são escassos.'
  },
  {
    name: 'Nine Sols',
    genre: 'Action Platformer',
    difficulty: 'Alta',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80',
    description: 'Ação 2D desenhada à mão focada em combate de deflexão (parry) num universo Taopunk sombrio.'
  },
  {
    name: 'Vagrant Story',
    genre: 'Tactical RPG',
    difficulty: 'Alta',
    isOfficial: true,
    imageUrl: 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=300&q=80',
    description: 'Clássico sombrio focado em forja de armas, afinidades elementais e combate tático por partes do corpo.'
  }
];

let communityGames = [
  {
    name: 'Kenshi',
    genre: 'RPG Sandbox / Estratégia',
    difficulty: 'Muito Alta',
    isOfficial: false,
    creator: 'Comunidade',
    imageUrl: 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=300&q=80',
    description: 'RPG de mundo aberto implacável onde você não é o escolhido e precisa sobreviver, construir e recrutar num mundo pós-apocalíptico.'
  }
];

// Registros na memória para denúncias e sugestões
let fandomReports = [];
let fandomSuggestions = [];

router.getAllGames = function() {
  return {
    official: officialGames,
    community: communityGames
  };
};

/* GET Lista Unificada de Fandoms */
router.get('/', function(req, res, next) {
  const guidesRouter = require('./guides');
  const allGuides = guidesRouter.getGuides();

  const countPosts = (gameName) =>
    allGuides.filter(g => g.game && g.game.toLowerCase() === gameName.toLowerCase()).length;

  const mergedGames = [
    ...officialGames.map(g => ({ ...g, guideCount: countPosts(g.name) })),
    ...communityGames.map(g => ({ ...g, guideCount: countPosts(g.name) }))
  ];

  res.render('games', {
    title: 'Fandoms & Wikis',
    games: mergedGames
  });
});

/* GET Formulário para Criar Fandom da Comunidade */
router.get('/new', function(req, res, next) {
  res.render('new-game', { title: 'Criar Fandom da Comunidade', error: null });
});

/* POST Processar Criação de Fandom da Comunidade */
router.post('/', function(req, res, next) {
  const { name, genre, difficulty, imageUrl, description } = req.body;
  const cleanName = name ? name.trim() : '';

  const existsInOfficial = officialGames.some(g => g.name.toLowerCase() === cleanName.toLowerCase());
  const existsInCommunity = communityGames.some(g => g.name.toLowerCase() === cleanName.toLowerCase());

  if (existsInOfficial || existsInCommunity) {
    return res.render('new-game', {
      title: 'Criar Fandom da Comunidade',
      error: `O Fandom "${cleanName}" já está cadastrado! Procure-o na lista.`
    });
  }

  communityGames.push({
    name: cleanName,
    genre: genre || 'Indie / Geral',
    difficulty: difficulty || 'Média',
    isOfficial: false,
    creator: 'Criador / Admin',
    imageUrl: imageUrl ? imageUrl.trim() : '',
    description: description
  });

  res.redirect('/games');
});

/* GET Formulário de Edição de Fandom da Comunidade */
router.get('/:name/edit', function(req, res, next) {
  const gameName = req.params.name;
  const fandom = communityGames.find(g => g.name.toLowerCase() === gameName.toLowerCase());

  if (!fandom) {
    return res.status(403).render('error', {
      message: 'Apenas Fandoms da Comunidade podem ser editados aqui.',
      error: {}
    });
  }

  res.render('edit-game', {
    title: `Editar Fandom: ${fandom.name}`,
    fandom: fandom,
    error: null
  });
});

/* POST Salvar Edição de Fandom da Comunidade */
router.post('/:name/edit', function(req, res, next) {
  const oldName = req.params.name;
  const index = communityGames.findIndex(g => g.name.toLowerCase() === oldName.toLowerCase());

  if (index === -1) {
    return res.status(404).render('error', { message: 'Fandom não encontrado', error: {} });
  }

  const { name, genre, difficulty, imageUrl, description } = req.body;
  const cleanName = name ? name.trim() : communityGames[index].name;

  // Evita colisão de nome com outro fandom existente
  const duplicate =
    officialGames.some(g => g.name.toLowerCase() === cleanName.toLowerCase()) ||
    communityGames.some((g, i) => i !== index && g.name.toLowerCase() === cleanName.toLowerCase());

  if (duplicate) {
    return res.render('edit-game', {
      title: `Editar Fandom: ${communityGames[index].name}`,
      fandom: communityGames[index],
      error: `Já existe outro Fandom chamado "${cleanName}".`
    });
  }

  // Atualiza os guias vinculados caso o nome do fandom tenha sido alterado
  const guidesRouter = require('./guides');
  const allGuides = guidesRouter.getGuides();
  allGuides.forEach(guide => {
    if (guide.game && guide.game.toLowerCase() === oldName.toLowerCase()) {
      guide.game = cleanName;
    }
  });

  communityGames[index] = {
    ...communityGames[index],
    name: cleanName,
    genre: genre || 'Indie / Geral',
    difficulty: difficulty || 'Média',
    imageUrl: imageUrl ? imageUrl.trim() : '',
    description: description
  };

  res.redirect('/games/' + encodeURIComponent(cleanName) + '?feedback=updated');
});

/* POST Excluir Fandom da Comunidade */
router.post('/:name/delete', function(req, res, next) {
  const gameName = req.params.name;
  const exists = communityGames.some(g => g.name.toLowerCase() === gameName.toLowerCase());

  if (exists) {
    communityGames = communityGames.filter(g => g.name.toLowerCase() !== gameName.toLowerCase());

    // Move guias órfãos desse fandom para "Geral" para não perder postagens
    const guidesRouter = require('./guides');
    const allGuides = guidesRouter.getGuides();
    allGuides.forEach(guide => {
      if (guide.game && guide.game.toLowerCase() === gameName.toLowerCase()) {
        guide.game = 'Geral';
      }
    });
  }

  res.redirect('/games');
});

/* POST Enviar Sugestão para um Fandom */
router.post('/:name/suggest', function(req, res, next) {
  const gameName = req.params.name;
  const { suggestion } = req.body;
  if (suggestion && suggestion.trim()) {
    fandomSuggestions.push({
      fandom: gameName,
      text: suggestion.trim(),
      createdAt: new Date().toLocaleString('pt-BR')
    });
  }
  res.redirect('/games/' + encodeURIComponent(gameName) + '?feedback=suggested');
});

/* POST Enviar Denúncia de um Fandom */
router.post('/:name/report', function(req, res, next) {
  const gameName = req.params.name;
  const { reason, details } = req.body;
  fandomReports.push({
    fandom: gameName,
    reason: reason || 'Conteúdo inadequado / Duplicado',
    details: details ? details.trim() : '',
    createdAt: new Date().toLocaleString('pt-BR')
  });
  res.redirect('/games/' + encodeURIComponent(gameName) + '?feedback=reported');
});

/* GET Página Wiki de um Fandom Específico */
router.get('/:name', function(req, res, next) {
  const guidesRouter = require('./guides');
  const gameName = req.params.name;
  const allGuides = guidesRouter.getGuides();

  const fandom =
    officialGames.find(g => g.name.toLowerCase() === gameName.toLowerCase()) ||
    communityGames.find(g => g.name.toLowerCase() === gameName.toLowerCase());

  if (!fandom) {
    return res.status(404).render('error', { message: 'Fandom não encontrado', error: {} });
  }

  const gameGuides = allGuides.filter(
    g => g.game && g.game.toLowerCase() === fandom.name.toLowerCase()
  );

  const tagCounts = {};
  gameGuides.forEach(g => {
    (g.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  const gameTags = Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  res.render('game-detail', {
    title: `Wiki: ${fandom.name}`,
    fandom: fandom,
    guides: gameGuides,
    gameTags: gameTags,
    feedback: req.query.feedback || null
  });
});

module.exports = router;