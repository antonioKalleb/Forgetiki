var express = require('express');
var router = express.Router();

const postCategories = [
  { name: 'Guia', icon: '📖' },
  { name: 'Dica', icon: '💡' },
  { name: 'Tutorial', icon: '🎓' },
  { name: 'Segredo', icon: '🗝️' },
  { name: 'Interação', icon: '💬' },
  { name: 'Discussão', icon: '❓' }
];

let guides = [
  {
    id: '1',
    title: 'Como sobreviver aos primeiros dias no Dungeon',
    game: 'Fear & Hunger',
    category: 'Guia',
    tags: ['Fear_&_Hunger', 'Sobrevivência', 'Dungeon', 'Iniciante'],
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
    links: [],
    content: 'Guia de sobrevivência básica: priorize salvar recursos, evite combates desnecessários e aprenda o padrão de movimento das moedas.',
    comments: []
  }
];

router.getGuides = function() {
  return guides;
};

router.getPostCategories = function() {
  return postCategories;
};

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

function parseTags(tagsString) {
  if (!tagsString) return [];
  return tagsString
    .split('#')
    .map(t => t.trim().replace(/\s+/g, '_'))
    .filter(t => t.length > 0);
}

// Converte linhas de links em uma lista limpa de URLs válidas
function parseLinks(linksRaw) {
  if (!linksRaw) return [];
  return linksRaw
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => (/^https?:\/\//i.test(l) ? l : 'https://' + l));
}

// Extrai URL de embed caso algum dos links seja do YouTube
function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

function getFandomOptions() {
  const gamesRouter = require('./games');
  const all = gamesRouter.getAllGames();
  const countPosts = (name) =>
    guides.filter(g => g.game && g.game.toLowerCase() === name.toLowerCase()).length;

  return [
    { name: 'Geral', official: false, isGeneral: true, count: countPosts('Geral') },
    ...all.official.map(g => ({ name: g.name, official: true, isGeneral: false, count: countPosts(g.name) })),
    ...all.community.map(g => ({ name: g.name, official: false, isGeneral: false, count: countPosts(g.name) }))
  ];
}

/* GET Lista de Posts */
router.get('/', function(req, res, next) {
  const { q, tag, game, category } = req.query;
  let filteredGuides = guides;

  if (q && q.trim().length > 0) {
    const queryNorm = normalizeText(q.trim());
    filteredGuides = filteredGuides.filter(g => {
      const inTitle = normalizeText(g.title).includes(queryNorm);
      const inContent = normalizeText(g.content).includes(queryNorm);
      const inGame = normalizeText(g.game).includes(queryNorm);
      const inCategory = normalizeText(g.category).includes(queryNorm);
      const inTags = (g.tags || []).some(t => normalizeText(t).includes(queryNorm) || normalizeText('#' + t).includes(queryNorm));
      return inTitle || inContent || inGame || inCategory || inTags;
    });
  }

  if (category) {
    filteredGuides = filteredGuides.filter(g =>
      g.category && normalizeText(g.category) === normalizeText(category)
    );
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
    title: 'Central de Posts & Guias',
    guides: filteredGuides,
    popularTags: getPopularTags(),
    postCategories: postCategories,
    searchQuery: q || '',
    activeTag: tag || null,
    activeGame: game || null,
    activeCategory: category || null
  });
});

/* GET Formulário de Criar Postagem */
router.get('/new', function(req, res, next) {
  res.render('new-guide', {
    title: 'Nova Postagem',
    popularTags: getPopularTags(),
    postCategories: postCategories,
    selectedGame: req.query.game || 'Geral',
    selectedCategory: req.query.category || 'Guia',
    fandomOptions: getFandomOptions()
  });
});

/* POST Criar Postagem */
router.post('/', function(req, res, next) {
  const { title, game, category, tags, imageUrl, links, content } = req.body;

  const newGuide = {
    id: Date.now().toString(),
    title,
    game: game && game.trim() ? game.trim() : 'Geral',
    category: category && category.trim() ? category.trim() : 'Guia',
    tags: parseTags(tags),
    imageUrl: imageUrl ? imageUrl.trim() : '',
    links: parseLinks(links),
    content,
    comments: []
  };

  guides.push(newGuide);
  res.redirect('/guides');
});

/* GET Ver Post Completo */
router.get('/:id', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (!guide) {
    return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
  }

  guide.comments.forEach((c, idx) => {
    if (!c.id) c.id = 'c_' + idx + '_' + Date.now();
  });

  res.render('guide-detail', {
    title: guide.title,
    guide: guide,
    getYoutubeEmbedUrl: getYoutubeEmbedUrl
  });
});

/* POST Adicionar Comentário */
router.post('/:id/comments', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (guide) {
    const { author, text } = req.body;
    const now = new Date();
    guide.comments.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      author: author && author.trim() ? author.trim() : 'Anônimo',
      text: text,
      edited: false,
      createdAt: now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    });
  }
  res.redirect('/guides/' + req.params.id);
});

/* POST Editar Comentário */
router.post('/:id/comments/:commentId/edit', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (guide) {
    const comment = guide.comments.find(c => c.id === req.params.commentId);
    if (comment && req.body.text && req.body.text.trim()) {
      comment.text = req.body.text.trim();
      comment.edited = true;
    }
  }
  res.redirect('/guides/' + req.params.id);
});

/* POST Excluir Comentário */
router.post('/:id/comments/:commentId/delete', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (guide) {
    guide.comments = guide.comments.filter(c => c.id !== req.params.commentId);
  }
  res.redirect('/guides/' + req.params.id);
});

/* GET Formulário de Edição de Post */
router.get('/:id/edit', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  if (!guide) {
    return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
  }
  res.render('edit-guide', {
    title: 'Editar Postagem',
    guide: guide,
    popularTags: getPopularTags(),
    postCategories: postCategories,
    fandomOptions: getFandomOptions()
  });
});

/* POST Salvar Edição de Post */
router.post('/:id/edit', function(req, res, next) {
  const { title, game, category, tags, imageUrl, links, content } = req.body;
  const index = guides.findIndex(g => g.id === req.params.id);

  if (index !== -1) {
    guides[index].title = title;
    guides[index].game = game && game.trim() ? game.trim() : 'Geral';
    guides[index].category = category && category.trim() ? category.trim() : 'Guia';
    guides[index].tags = parseTags(tags);
    guides[index].imageUrl = imageUrl ? imageUrl.trim() : '';
    guides[index].links = parseLinks(links);
    guides[index].content = content;
  }

  res.redirect('/guides/' + req.params.id);
});

/* POST Excluir Post */
router.post('/:id/delete', function(req, res, next) {
  guides = guides.filter(g => g.id !== req.params.id);
  res.redirect('/guides');
});

module.exports = router;