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

let parentIdColumnEnsured = false;
async function ensureParentIdColumn() {
  if (parentIdColumnEnsured) return;
  try {
    await dbRun('ALTER TABLE comments ADD COLUMN parent_id INTEGER DEFAULT NULL');
  } catch (e) {
    // Coluna já existe no banco
  }
  parentIdColumnEnsured = true;
}

// Trava estrita de autoria exclusivamente pelo ID numérico da conta
function isStrictOwner(user, ownerId) {
  if (!user) return false;
  if (ownerId === null || ownerId === undefined) return false;
  return Number(user.id) === Number(ownerId);
}

function safeJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function formatGuide(row, comments = []) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: row.title,
    game: row.game,
    category: row.category || 'Guia',
    tags: safeJsonArray(row.tags),
    imageUrl: row.image_url || '',
    links: safeJsonArray(row.links),
    content: row.content,
    authorId: row.author_id !== null && row.author_id !== undefined ? Number(row.author_id) : null,
    authorName: (row.author_name && row.author_name.trim()) ? row.author_name : 'Admin',
    createdAt: row.created_at,
    comments: comments
  };
}

function formatComment(row, currentUser = null, canModeratePost = false) {
  const authorId = row.author_id !== null && row.author_id !== undefined ? Number(row.author_id) : null;
  const isAuthor = isStrictOwner(currentUser, authorId);
  return {
    id: String(row.id),
    guideId: String(row.guide_id),
    parentId: row.parent_id ? String(row.parent_id) : null,
    authorId: authorId,
    author: row.author || 'Anônimo',
    text: row.text,
    edited: Boolean(row.edited),
    createdAt: row.created_at,
    canEdit: isAuthor,
    canDelete: isAuthor || canModeratePost,
    replies: []
  };
}

async function isPostOrFandomModerator(currentUser, guideRow) {
  if (!currentUser || !guideRow) return false;
  if (currentUser.role === 'admin') return true;
  if (isStrictOwner(currentUser, guideRow.author_id)) return true;

  if (guideRow.game && guideRow.game.toLowerCase() !== 'geral') {
    const fandomRow = await dbGet(
      'SELECT creator_id, is_official FROM games WHERE LOWER(name) = ?',
      [guideRow.game.toLowerCase()]
    );
    if (fandomRow && fandomRow.is_official === 0) {
      if (isStrictOwner(currentUser, fandomRow.creator_id)) {
        return true;
      }
    }
  }
  return false;
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

/* GET Formulário de Criar Postagem (Exclusivo para usuários logados) */
router.get('/new', async function(req, res, next) {
  try {
    if (!res.locals.currentUser) {
      return res.redirect('/login');
    }

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

/* POST Criar Postagem (Exclusivo para usuários logados) */
router.post('/', async function(req, res, next) {
  try {
    const currentUser = res.locals.currentUser;
    if (!currentUser) {
      return res.redirect('/login');
    }

    const { title, game, category, tags, imageUrl, links, content } = req.body;

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
        currentUser.id,
        currentUser.username,
        new Date().toLocaleString('pt-BR')
      ]
    );

    res.redirect('/guides');
  } catch (err) {
    next(err);
  }
});

/* GET Ver Post Completo (com comentários e respostas estilo YouTube) */
router.get('/:id', async function(req, res, next) {
  try {
    await ensureParentIdColumn();
    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
    }

    const currentUser = res.locals.currentUser;
    const canModeratePost = await isPostOrFandomModerator(currentUser, row);
    const commentRows = await dbAll('SELECT * FROM comments WHERE guide_id = ? ORDER BY id ASC', [row.id]);

    const allFormatted = commentRows.map(c => formatComment(c, currentUser, canModeratePost));
    const commentMap = {};
    allFormatted.forEach(c => { commentMap[c.id] = c; });

    const topLevelComments = [];
    allFormatted.forEach(c => {
      if (c.parentId && commentMap[c.parentId]) {
        let rootParent = commentMap[c.parentId];
        while (rootParent.parentId && commentMap[rootParent.parentId]) {
          rootParent = commentMap[rootParent.parentId];
        }
        rootParent.replies.push(c);
      } else {
        topLevelComments.push(c);
      }
    });

    const guide = formatGuide(row, topLevelComments);
    guide.totalComments = allFormatted.length;
    const isGuideAuthor = isStrictOwner(currentUser, guide.authorId);

    res.render('guide-detail', {
      title: guide.title,
      guide: guide,
      canEditGuide: isGuideAuthor,
      canDeleteGuide: isGuideAuthor || canModeratePost,
      feedback: req.query.feedback || null,
      getYoutubeEmbedUrl: getYoutubeEmbedUrl
    });
  } catch (err) {
    next(err);
  }
});

/* POST Adicionar Comentário ou Resposta (com opção de usar conta ou comentar anônimo) */
router.post('/:id/comments', async function(req, res, next) {
  try {
    await ensureParentIdColumn();
    const row = await dbGet('SELECT id FROM guides WHERE id = ?', [req.params.id]);
    if (row) {
      const { author, text, parentId, useAccount } = req.body;
      const currentUser = res.locals.currentUser;
      const now = new Date();
      const timestamp = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      let resolvedParentId = null;
      if (parentId) {
        const parentRow = await dbGet(
          'SELECT id, parent_id FROM comments WHERE id = ? AND guide_id = ?',
          [parentId, row.id]
        );
        if (parentRow) {
          resolvedParentId = parentRow.parent_id ? parentRow.parent_id : parentRow.id;
        }
      }

      const isUsingAccount = Boolean(currentUser && currentUser.id && useAccount === '1');
      const commentAuthorId = isUsingAccount ? currentUser.id : null;
      const commentAuthorName = isUsingAccount
        ? currentUser.username
        : (author && author.trim() ? author.trim() : 'Anônimo');

      await dbRun(
        'INSERT INTO comments (guide_id, parent_id, author_id, author, text, edited, created_at) VALUES (?, ?, ?, ?, ?, 0, ?)',
        [
          row.id,
          resolvedParentId,
          commentAuthorId,
          commentAuthorName,
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

/* POST Editar Comentário ou Resposta (ESTRITAMENTE apenas o autor pelo ID) */
router.post('/:id/comments/:commentId/edit', async function(req, res, next) {
  try {
    const comment = await dbGet('SELECT * FROM comments WHERE id = ? AND guide_id = ?', [req.params.commentId, req.params.id]);
    if (!comment) {
      return res.redirect('/guides/' + req.params.id);
    }

    if (!isStrictOwner(res.locals.currentUser, comment.author_id)) {
      return res.redirect('/guides/' + req.params.id + '?feedback=unauthorized');
    }

    if (req.body.text && req.body.text.trim()) {
      await dbRun('UPDATE comments SET text = ?, edited = 1 WHERE id = ?', [req.body.text.trim(), comment.id]);
    }
    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* POST Excluir Comentário (e suas respostas) ou Resposta */
router.post('/:id/comments/:commentId/delete', async function(req, res, next) {
  try {
    await ensureParentIdColumn();
    const guideRow = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    const comment = await dbGet('SELECT * FROM comments WHERE id = ? AND guide_id = ?', [req.params.commentId, req.params.id]);
    if (!guideRow || !comment) {
      return res.redirect('/guides/' + req.params.id);
    }

    const isAuthor = isStrictOwner(res.locals.currentUser, comment.author_id);
    const canModeratePost = await isPostOrFandomModerator(res.locals.currentUser, guideRow);

    if (!isAuthor && !canModeratePost) {
      return res.redirect('/guides/' + req.params.id + '?feedback=unauthorized');
    }

    await dbRun(
      'DELETE FROM comments WHERE (id = ? OR parent_id = ?) AND guide_id = ?',
      [req.params.commentId, req.params.commentId, req.params.id]
    );
    res.redirect('/guides/' + req.params.id);
  } catch (err) {
    next(err);
  }
});

/* POST Denunciar Comentário ou Resposta (liberado para todos) */
router.post('/:id/comments/:commentId/report', async function(req, res, next) {
  try {
    const { reason, details } = req.body;
    await dbRun(
      'INSERT INTO fandom_feedback (fandom_name, type, reason, details, created_at) VALUES (?, ?, ?, ?, ?)',
      [
        `Post #${req.params.id} (Comentário #${req.params.commentId})`,
        'comment_report',
        reason || 'Comentário inadequado',
        details ? details.trim() : '',
        new Date().toLocaleString('pt-BR')
      ]
    );
    res.redirect('/guides/' + req.params.id + '?feedback=reported');
  } catch (err) {
    next(err);
  }
});

/* GET Formulário de Edição de Post (ESTRITAMENTE apenas o autor pelo ID) */
router.get('/:id/edit', async function(req, res, next) {
  try {
    if (!res.locals.currentUser) {
      return res.redirect('/login');
    }

    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
    }

    if (!isStrictOwner(res.locals.currentUser, row.author_id)) {
      return res.redirect('/guides/' + req.params.id + '?feedback=unauthorized');
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

/* POST Salvar Edição de Post (ESTRITAMENTE apenas o autor pelo ID) */
router.post('/:id/edit', async function(req, res, next) {
  try {
    if (!res.locals.currentUser) {
      return res.redirect('/login');
    }

    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.status(404).render('error', { message: 'Postagem não encontrada', error: {} });
    }

    if (!isStrictOwner(res.locals.currentUser, row.author_id)) {
      return res.redirect('/guides/' + req.params.id + '?feedback=unauthorized');
    }

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

/* POST Excluir Post (Autor do post, Dono do Fandom ou Admin) */
router.post('/:id/delete', async function(req, res, next) {
  try {
    if (!res.locals.currentUser) {
      return res.redirect('/login');
    }

    const row = await dbGet('SELECT * FROM guides WHERE id = ?', [req.params.id]);
    if (!row) {
      return res.redirect('/guides');
    }

    const isGuideAuthor = isStrictOwner(res.locals.currentUser, row.author_id);
    const canModeratePost = await isPostOrFandomModerator(res.locals.currentUser, row);

    if (!isGuideAuthor && !canModeratePost) {
      return res.redirect('/guides/' + req.params.id + '?feedback=unauthorized');
    }

    await dbRun('DELETE FROM guides WHERE id = ?', [req.params.id]);
    res.redirect('/guides');
  } catch (err) {
    next(err);
  }
});

module.exports = router;