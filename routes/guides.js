var express = require('express');
var router = express.Router();

let guides = [
  {
    id: '1',
    title: 'Como sobreviver aos primeiros dias no Dungeon',
    game: 'Fear & Hunger',
    tags: ['Fear_&_Hunger', 'Sobrevivência', 'Dungeon', 'Iniciante'],
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
    videoUrl: '',
    content: 'Guia de sobrevivência básica: priorize salvar recursos, evite combates desnecessários e aprenda o padrão de movimento das moedas.',
    comments: []
  }
];

router.getGuides = function() {
  return guides;
};

// Normaliza texto para buscas sem diferenciar acentos ou maiúsculas
function normalizeText(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getPopularTags(sourceGuides = guides) {
  const tagCounts = {};
  sourceGuides.forEach(g => {
    if (g.tags && Array.isArray(g.tags)) {
      g.tags.forEach(t => {
        const cleanTag = t.trim();
        if (cleanTag) {
          tagCounts[cleanTag] = (tagCounts[cleanTag] || 0) + 1;
        }
      });
    }
  });

  return Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

// Converte "#isso é lindo #1   #40" -> ["isso_é_lindo", "1", "40"]
function parseTags(tagsString) {
  if (!tagsString) return [];
  return tagsString
    .split('#')
    .map(t => t.trim().replace(/\s+/g, '_'))
    .filter(t => t.length > 0);
}

// Prepara lista unificada de fandoms com contagem de posts para o buscador
function getFandomOptions() {
  const gamesRouter = require('./games');
  const all = gamesRouter.getAllGames();
  const countPosts = (name) =>
    guides.filter(g => g.game && g.game.toLowerCase() === name.toLowerCase()).length;

  const list = [
    { name: 'Geral', official: false, isGeneral: true, count: countPosts('Geral') },
    ...all.official.map(g => ({ name: g.name, official: true, isGeneral: false, count: countPosts(g.name) })),
    ...all.community.map(g => ({ name: g.name, official: false, isGeneral: false, count: countPosts(g.name) }))
  ];

  return list;
}

/* GET Lista de Guias (com busca por texto ?q=, ?tag= e ?game=) */
router.get('/', function(req, res, next) {
  const { q, tag, game } = req.query;
  let filteredGuides = guides;

  if (q && q.trim().length > 0) {
    const queryNorm = normalizeText(q.trim());
    filteredGuides = filteredGuides.filter(g => {
      const inTitle = normalizeText(g.title).includes(queryNorm);
      const inContent = normalizeText(g.content).includes(queryNorm);
      const inGame = normalizeText(g.game).includes(queryNorm);
      const inTags = (g.tags || []).some(t => normalizeText(t).includes(queryNorm) || normalizeText('#' + t).includes(queryNorm));
      return inTitle || inContent || inGame || inTags;
    });
  }

  if (tag) {
    filteredGuides = filteredGuides.filter(g =>
      g.tags && g.tags.some(t => normalizeText(t) === normalizeText(tag))
    );
  }

  if (game) {
    filteredGuides = filteredGuides.filter(g =>
      g.game && normalizeText(g.game) === normalizeText(game)
    );
  }

  res.render('guides', {
    title: 'Guias & Dicas',
    guides: filteredGuides,
    popularTags: getPopularTags(),
    searchQuery: q || '',
    activeTag: tag || null,
    activeGame: game || null
  });
});

/* GET Formulário de Criar Guia */
router.get('/new', function(req, res, next) {
  res.render('new-guide', {
    title: 'Novo Guia',
    popularTags: getPopularTags(),
    selectedGame: req.query.game || 'Geral',
    fandomOptions: getFandomOptions()
  });
});

/* POST Criar Guia */
router.post('/', function(req, res, next) {
  const { title, game, tags, imageUrl, videoUrl, content } = req.body;
  
  let formattedVideoUrl = videoUrl || '';
  if (formattedVideoUrl.includes('watch?v=')) {
    formattedVideoUrl = formattedVideoUrl.replace('watch?v=', 'embed/');
  }

  const newGuide = {
    id: Date.now().toString(),
    title,
    game: game && game.trim() ? game.trim() : 'Geral',
    tags: parseTags(tags),
    imageUrl: imageUrl || '',
    videoUrl: formattedVideoUrl,
    content,
    comments: []
  };

  guides.push(newGuide);
  res.redirect('/guides');
});

/* GET Ver Guia Completo */
router.get('/:id', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (!guide) {
    return res.status(404).render('error', { message: 'Guia não encontrado', error: {} });
  }
  res.render('guide-detail', { title: guide.title, guide: guide });
});

/* POST Adicionar Comentário */
router.post('/:id/comments', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (guide) {
    const { author, text } = req.body;
    const now = new Date();
    guide.comments.push({
      author: author || 'Anônimo',
      text: text,
      createdAt: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }
  res.redirect('/guides/' + req.params.id);
});

/* GET Formulário de Edição */
router.get('/:id/edit', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (!guide) {
    return res.status(404).render('error', { message: 'Guia não encontrado', error: {} });
  }
  res.render('edit-guide', {
    title: 'Editar Guia',
    guide: guide,
    popularTags: getPopularTags(),
    fandomOptions: getFandomOptions()
  });
});

/* POST Salvar Edição */
router.post('/:id/edit', function(req, res, next) {
  const { title, game, tags, imageUrl, videoUrl, content } = req.body;
  const index = guides.findIndex(g => g.id === req.params.id);

  if (index !== -1) {
    let formattedVideoUrl = videoUrl || '';
    if (formattedVideoUrl.includes('watch?v=')) {
      formattedVideoUrl = formattedVideoUrl.replace('watch?v=', 'embed/');
    }

    guides[index].title = title;
    guides[index].game = game && game.trim() ? game.trim() : 'Geral';
    guides[index].tags = parseTags(tags);
    guides[index].imageUrl = imageUrl;
    guides[index].videoUrl = formattedVideoUrl;
    guides[index].content = content;
  }

  res.redirect('/guides/' + req.params.id);
});

/* POST Excluir Guia */
router.post('/:id/delete', function(req, res, next) {
  guides = guides.filter(g => g.id !== req.params.id);
  res.redirect('/guides');
});

module.exports = router;