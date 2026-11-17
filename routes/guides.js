var express = require('express');
var router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database/db');

const postCategories = [
  { name: 'Guia', icon: '📖' },
  { name: 'Dica', icon: '💡' },
  { name: 'Tutorial', icon: '🎓' },
  { name: 'Segredo', icon: '🗝️' },
  { name: 'Interação', icon: '💬' },
  { name: 'Discussão', icon: '❓' }
];

function formatGuide(row, comments = []) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    game: row.game,
    category: row.category || 'Guia',
    tags: JSON.parse(row.tags || '[]'),
    imageUrl: row.image_url || '',
    links: JSON.parse(row.links || '[]'),
    content: row.content,
    authorId: row.author_id,
    authorName: row.author_name || 'Anônimo',
    createdAt: row.created_at,
    comments: comments
  };
}

function formatComment(row) {
  return {
    id: String(row.id),
    guideId: String(row.guide_id),
    authorId: row.author_id,
    author: row.author,
    text: row.text,
    edited: Boolean(row.edited),
    createdAt: row.created_at
  };
}

router.getGuides = async function() {
  const rows = await dbAll('SELECT * FROM guides ORDER BY id ASC');
  return rows.map(r => formatGuide(r));
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

function getPopularTags(sourceGuides) {
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

function parseLinks(linksRaw) {
  if (!linksRaw) return [];
  return linksRaw
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(l => l.length > 0)
    .map(l => (/^https?:\/\//i.test(l) ? l : 'https://' + l));
}

function getYoutubeEmbedUrl(url) {
  if (!url) return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

async function getFandomOptions(allGuides) {
  const gameRows = await dbAll('SELECT name, is_official FROM games ORDER BY is_official DESC, name ASC');
  const countPosts = (name) =>
    allGuides.filter(g => g.game && g.game.toLowerCase() === name.toLowerCase()).length;

  return [
    { name: 'Geral', official: false, isGeneral: true, count: countPosts('Geral') },
    ...gameRows.map(g => ({
      name: g.name,
      official: g.is_official === 1,
      isGeneral: false,
      count: countPosts(g.name)
    }))
  ];
}

/* GET Lista de Posts */
router.get('/', async function(req, res, next) {
  try {
    const { q, tag, game, category } = req.query;
    const rows = await dbAll('SELECT * FROM guides ORDER BY id DESC');
    const allGuides = rows.map(r => formatGuide(r));
    let filteredGuides = allGuides;

    if (q && q.trim().length > 0) {
      const queryNorm = normalizeText(q.trim());
      filteredGuides = filteredGuides.filter(g => {
        const inTitle = normalizeText(g.title).includes(queryNorm);
        const inContent = normalizeText(g.content).includes(queryNorm);
        const inGame = normalizeText(g.game).includes(queryNorm);
        const inCategory = normalizeText(g.category).includes(queryNorm);
        const inTags = g.tags.some(t => normalizeText(t).includes(queryNorm) || normalizeText('#' + t).includes(queryNorm));
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
        g.tags.some(t => normalizeText(t) === normalizeText(tag))
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
      popularTags: getPopularTags(allGuides),
      postCategories: postCategories,
      searchQuery: q || '',
      activeTag: tag || null,
      activeGame: game || null,
      activeCategory: category || null
    });
  } catch (err) {
    next(err);
  }
});

/* GET Formulário de Criar Postagem */
router.get('/new', async function(req, res, next) {
  try {
    const rows = await dbAll('SELECT * FROM guides');
    const allGuides = rows.map(r => formatGuide(r));

    res.render('new-guide', {
      title: 'Nova Postagem',
      popularTags: getPopularTags(allGuides),
      postCategories: postCategories,
      selectedGame: req.query.game || 'Geral',
      selectedCategory: req.query.category || 'Guia',
      fandomOptions: await getFandomOptions(allGuides)
    });
  } catch (err) {
    next(err);
  }
});

/* POST Criar Postagem */
router.post('/', async function(req, res, next) {
  try {
    const { title, game, category, tags, imageUrl, links, content } = req.body;
    const currentUser = res.locals.currentUser;

    await dbRun(
      `INSERT INTO guides (title, game, category, tags, image_url, links, content, author_id, author_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        game && game.trim() ? game.trim() : 'Geral',
        category && category.trim() ? category.trim() : 'Guia',
        JSON.stringify(parseTags(tags)),
        imageUrl ? imageUrl.trim() : '',
        JSON.stringify(parseLinks(links)),
        content,
        currentUser ? currentUser.id : null,
        currentUser ? currentUser.username : 'Anônimo',
        new Date().toLocaleString('pt-BR')
      ]
    );

    res.redirect('/guides');
  } catch (err) {
    next(err);
  }
});

/* GET Ver Post Completo */
router.get('/:id', async function(req, res, next) {
  try {
    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
    }

    const commentRows = await dbAll('SELECT * FROM comments WHERE guide_id = ? ORDER BY id ASC', [row.id]);
    const guide = formatGuide(row, commentRows.map(formatComment));

    res.render('guide-detail', {
      title: guide.title,
      guide: guide,
      getYoutubeEmbedUrl: getYoutubeEmbedUrl
    });
  } catch (err) {
    next(err);
  }
});

/* POST Adicionar Comentário */
router.post('/:id/comments', async function(req, res, next) {
  try {
    const row = await dbGet('SELECT id FROM guides WHERE id = ?', [req.params.id]);
    if (row) {
      const { author, text } = req.body;
      const currentUser = res.locals.currentUser;
      const now = new Date();
      const timestamp = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      await dbRun(
        'INSERT INTO comments (guide_id, author_id, author, text, edited, created_at) VALUES (?, ?, ?, ?, 0, ?)',
        [
          row.id,
          currentUser ? currentUser.id : null,
          currentUser ? currentUser.username : (author && author.trim() ? author.trim() : 'Anônimo'),
          text,
          timestamp
        ]
      );
    }
    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* POST Editar Comentário */
router.post('/:id/comments/:commentId/edit', async function(req, res, next) {
  try {
    const comment = await dbGet('SELECT * FROM comments WHERE id = ? AND guide_id = ?', [req.params.commentId, req.params.id]);
    if (comment && req.body.text && req.body.text.trim()) {
      await dbRun('UPDATE comments SET text = ?, edited = 1 WHERE id = ?', [req.body.text.trim(), comment.id]);
    }
    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* POST Excluir Comentário */
router.post('/:id/comments/:commentId/delete', async function(req, res, next) {
  try {
    await dbRun('DELETE FROM comments WHERE id = ? AND guide_id = ?', [req.params.commentId, req.params.id]);
    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* GET Formulário de Edição de Post */
router.get('/:id/edit', async function(req, res, next) {
  try {
    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
    }

    const allRows = await dbAll('SELECT * FROM guides');
    const allGuides = allRows.map(r => formatGuide(r));

    res.render('edit-guide', {
      title: 'Editar Postagem',
      guide: formatGuide(row),
      popularTags: getPopularTags(allGuides),
      postCategories: postCategories,
      fandomOptions: await getFandomOptions(allGuides)
    });
  } catch (err) {
    next(err);
  }
});

/* POST Salvar Edição de Post */
router.post('/:id/edit', async function(req, res, next) {
  try {
    const { title, game, category, tags, imageUrl, links, content } = req.body;
    await dbRun(
      `UPDATE guides SET title = ?, game = ?, category = ?, tags = ?, image_url = ?, links = ?, content = ?
       WHERE id = ?`,
      [
        title,
        game && game.trim() ? game.trim() : 'Geral',
        category && category.trim() ? category.trim() : 'Guia',
        JSON.stringify(parseTags(tags)),
        imageUrl ? imageUrl.trim() : '',
        JSON.stringify(parseLinks(links)),
        content,
        req.params.id
      ]
    );

    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* POST Excluir Post */
router.post('/:id/delete', async function(req, res, next) {
  try {
    await dbRun('DELETE FROM guides WHERE id = ?', [req.params.id]);
    res.redirect('/guides');
  } catch (err) {
    next(err);
  }
});

module.exports = router;