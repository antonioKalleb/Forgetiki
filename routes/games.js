var express = require('express');
var router = express.Router();
const { dbAll, dbGet, dbRun } = require('../database/db');

function canManage(user, ownerId, ownerName) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (ownerId !== null && ownerId !== undefined && Number(user.id) === Number(ownerId)) {
    return true;
  }
  if ((ownerId === null || ownerId === undefined) && ownerName && ownerName !== 'Comunidade') {
    return user.username.toLowerCase() === ownerName.toLowerCase();
  }
  return false;
}

function formatGame(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    genre: row.genre,
    difficulty: row.difficulty,
    isOfficial: Boolean(row.is_official),
    creatorId: row.creator_id,
    creator: row.creator_name || 'Comunidade',
    imageUrl: row.image_url || '',
    description: row.description,
    extendedDescription: row.extended_description || ''
  };
}

router.getAllGames = async function() {
  const rows = await dbAll('SELECT * FROM games ORDER BY is_official DESC, id ASC');
  return {
    official: rows.filter(r => r.is_official === 1).map(formatGame),
    community: rows.filter(r => r.is_official === 0).map(formatGame)
  };
};

/* GET Lista Unificada de Fandoms */
router.get('/', async function(req, res, next) {
  try {
    const gameRows = await dbAll('SELECT * FROM games ORDER BY is_official DESC, id ASC');
    const guideRows = await dbAll('SELECT game FROM guides');

    const countPosts = (gameName) =>
      guideRows.filter(g => g.game && g.game.toLowerCase() === gameName.toLowerCase()).length;

    const mergedGames = gameRows.map(row => {
      const formatted = formatGame(row);
      return {
        ...formatted,
        guideCount: countPosts(formatted.name)
      };
    });

    res.render('games', {
      title: 'Fandoms & Wikis',
      games: mergedGames
    });
  } catch (err) {
    next(err);
  }
});

/* GET Formulário para Criar Fandom da Comunidade */
router.get('/new', function(req, res, next) {
  res.render('new-game', { title: 'Criar Fandom da Comunidade', error: null });
});

/* POST Processar Criação de Fandom da Comunidade */
router.post('/', async function(req, res, next) {
  try {
    const { name, genre, difficulty, imageUrl, description, extendedDescription } = req.body;
    const cleanName = name ? name.trim() : '';

    const duplicate = await dbGet('SELECT id FROM games WHERE LOWER(name) = ?', [cleanName.toLowerCase()]);
    if (duplicate) {
      return res.render('new-game', {
        title: 'Criar Fandom da Comunidade',
        error: `O Fandom "${cleanName}" já está cadastrado! Procure-o na lista.`
      });
    }

    const currentUser = res.locals.currentUser;
    const creatorId = currentUser ? currentUser.id : null;
    const creatorName = currentUser ? currentUser.username : 'Comunidade';

    await dbRun(
      `INSERT INTO games (name, genre, difficulty, is_official, creator_id, creator_name, image_url, description, extended_description)
       VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)`,
      [
        cleanName,
        genre || 'Indie / Geral',
        difficulty || 'Média',
        creatorId,
        creatorName,
        imageUrl ? imageUrl.trim() : '',
        description,
        extendedDescription ? extendedDescription.trim() : ''
      ]
    );

    res.redirect('/games');
  } catch (err) {
    next(err);
  }
});

/* GET Formulário de Edição de Fandom da Comunidade */
router.get('/:name/edit', async function(req, res, next) {
  try {
    const gameName = req.params.name;
    const row = await dbGet('SELECT * FROM games WHERE LOWER(name) = ?', [gameName.toLowerCase()]);

    if (!row || row.is_official === 1) {
      return res.status(403).render('error', {
        message: 'Apenas Fandoms da Comunidade podem ser editados aqui.',
        error: {}
      });
    }

    if (!canManage(res.locals.currentUser, row.creator_id, row.creator_name)) {
      return res.status(403).render('error', {
        message: 'Apenas o criador deste Fandom ou um Administrador pode editá-lo.',
        error: {}
      });
    }

    res.render('edit-game', {
      title: `Editar Fandom: ${row.name}`,
      fandom: formatGame(row),
      error: null
    });
  } catch (err) {
    next(err);
  }
});

/* POST Salvar Edição de Fandom da Comunidade */
router.post('/:name/edit', async function(req, res, next) {
  try {
    const oldName = req.params.name;
    const row = await dbGet('SELECT * FROM games WHERE LOWER(name) = ? AND is_official = 0', [oldName.toLowerCase()]);

    if (!row) {
      return res.status(404).render('error', { message: 'Fandom não encontrado', error: {} });
    }

    if (!canManage(res.locals.currentUser, row.creator_id, row.creator_name)) {
      return res.status(403).render('error', {
        message: 'Apenas o criador deste Fandom ou um Administrador pode editá-lo.',
        error: {}
      });
    }

    const { name, genre, difficulty, imageUrl, description, extendedDescription } = req.body;
    const cleanName = name ? name.trim() : row.name;

    const duplicate = await dbGet(
      'SELECT id FROM games WHERE LOWER(name) = ? AND id != ?',
      [cleanName.toLowerCase(), row.id]
    );

    if (duplicate) {
      return res.render('edit-game', {
        title: `Editar Fandom: ${row.name}`,
        fandom: formatGame(row),
        error: `Já existe outro Fandom chamado "${cleanName}".`
      });
    }

    await dbRun(
      `UPDATE games SET name = ?, genre = ?, difficulty = ?, image_url = ?, description = ?, extended_description = ?
       WHERE id = ?`,
      [
        cleanName,
        genre || 'Indie / Geral',
        difficulty || 'Média',
        imageUrl ? imageUrl.trim() : '',
        description,
        extendedDescription ? extendedDescription.trim() : '',
        row.id
      ]
    );

    await dbRun('UPDATE guides SET game = ? WHERE LOWER(game) = ?', [cleanName, oldName.toLowerCase()]);

    res.redirect('/games/' + encodeURIComponent(cleanName) + '?feedback=updated');
  } catch (err) {
    next(err);
  }
});

/* POST Excluir Fandom da Comunidade */
router.post('/:name/delete', async function(req, res, next) {
  try {
    const gameName = req.params.name;
    const row = await dbGet('SELECT * FROM games WHERE LOWER(name) = ? AND is_official = 0', [gameName.toLowerCase()]);

    if (!row) {
      return res.status(404).render('error', { message: 'Fandom não encontrado', error: {} });
    }

    if (!canManage(res.locals.currentUser, row.creator_id, row.creator_name)) {
      return res.status(403).render('error', {
        message: 'Apenas o criador deste Fandom ou um Administrador pode excluí-lo.',
        error: {}
      });
    }

    await dbRun('DELETE FROM games WHERE id = ?', [row.id]);
    await dbRun("UPDATE guides SET game = 'Geral' WHERE LOWER(game) = ?", [gameName.toLowerCase()]);

    res.redirect('/games');
  } catch (err) {
    next(err);
  }
});

/* POST Enviar Sugestão */
router.post('/:name/suggest', async function(req, res, next) {
  try {
    const gameName = req.params.name;
    const { suggestion } = req.body;
    if (suggestion && suggestion.trim()) {
      await dbRun(
        'INSERT INTO fandom_feedback (fandom_name, type, details, created_at) VALUES (?, ?, ?, ?)',
        [gameName, 'suggestion', suggestion.trim(), new Date().toLocaleString('pt-BR')]
      );
    }
    res.redirect('/games/' + encodeURIComponent(gameName) + '?feedback=suggested');
  } catch (err) {
    next(err);
  }
});

/* POST Enviar Denúncia */
router.post('/:name/report', async function(req, res, next) {
  try {
    const gameName = req.params.name;
    const { reason, details } = req.body;
    await dbRun(
      'INSERT INTO fandom_feedback (fandom_name, type, reason, details, created_at) VALUES (?, ?, ?, ?, ?)',
      [gameName, 'report', reason || 'Conteúdo inadequado', details ? details.trim() : '', new Date().toLocaleString('pt-BR')]
    );
    res.redirect('/games/' + encodeURIComponent(gameName) + '?feedback=reported');
  } catch (err) {
    next(err);
  }
});

/* GET Página Wiki de um Fandom Específico */
router.get('/:name', async function(req, res, next) {
  try {
    const gameName = req.params.name;
    const row = await dbGet('SELECT * FROM games WHERE LOWER(name) = ?', [gameName.toLowerCase()]);

    if (!row) {
      return res.status(404).render('error', { message: 'Fandom não encontrado', error: {} });
    }

    const fandom = formatGame(row);
    const guideRows = await dbAll('SELECT * FROM guides WHERE LOWER(game) = ? ORDER BY id DESC', [fandom.name.toLowerCase()]);
    const commentCounts = await dbAll('SELECT guide_id, COUNT(*) as total FROM comments GROUP BY guide_id');
    const countMap = {};
    commentCounts.forEach(c => { countMap[c.guide_id] = c.total; });

    const gameGuides = guideRows.map(g => ({
      id: String(g.id),
      title: g.title,
      game: g.game,
      category: g.category,
      tags: JSON.parse(g.tags || '[]'),
      imageUrl: g.image_url,
      content: g.content,
      authorName: g.author_name || 'Anônimo',
      createdAt: g.created_at,
      comments: new Array(countMap[g.id] || 0)
    }));

    const tagCounts = {};
    gameGuides.forEach(g => {
      g.tags.forEach(t => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
      });
    });

    const gameTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    res.render('game-detail', {
      title: `Wiki: ${fandom.name}`,
      fandom: fandom,
      canEditFandom: !fandom.isOfficial && canManage(res.locals.currentUser, fandom.creatorId, fandom.creator),
      guides: gameGuides,
      gameTags: gameTags,
      feedback: req.query.feedback || null
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;