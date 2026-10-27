var express = require('express');
var router = express.Router();

// Lista temporária na memória
let guides = [
  {
    id: '1',
    title: 'Como encontrar todos os finais em Chrono Trigger',
    game: 'Chrono Trigger',
    content: 'Um guia passo a passo detalhando as escolhas e momentos exatos para desbloquear cada um dos 13 finais do jogo.'
  }
];

/* GET Lista de Guias (/guides) */
router.get('/', function(req, res, next) {
  res.render('guides', { title: 'Guias & Dicas', guides: guides });
});

/* GET Formulário de Criar Guia (/guides/new) */
router.get('/new', function(req, res, next) {
  res.render('new-guide', { title: 'Novo Guia' });
});

/* POST Criar Guia (/guides) */
router.post('/', function(req, res, next) {
  const { title, game, content } = req.body;
  
  const newGuide = {
    id: Date.now().toString(), // Gera um ID único com base no timestamp
    title: title,
    game: game,
    content: content
  };

  guides.push(newGuide); // Salva no array temporário
  res.redirect('/guides'); // Redireciona de volta para a lista de guias
});

/* GET Ver Guia Completo (/guides/:id) */
router.get('/:id', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  
  if (!guide) {
    return res.status(404).render('error', { message: 'Guia não encontrado', error: {} });
  }

  res.render('guide-detail', { title: guide.title, guide: guide });
});
/* POST Excluir Guia (/guides/:id/delete) */
router.post('/:id/delete', function(req, res, next) {
  guides = guides.filter(g => g.id !== req.params.id);
  res.redirect('/guides');
});

/* GET Formulário de Edição (/guides/:id/edit) */
router.get('/:id/edit', function(req, res, next) {
  const guide = guides.find(g => g.id === req.params.id);
  
  if (!guide) {
    return res.status(404).render('error', { message: 'Guia não encontrado', error: {} });
  }

  res.render('edit-guide', { title: 'Editar Guia', guide: guide });
});

/* POST Salvar Edição (/guides/:id/edit) */
router.post('/:id/edit', function(req, res, next) {
  const { title, game, content } = req.body;
  const index = guides.findIndex(g => g.id === req.params.id);

  if (index !== -1) {
    guides[index].title = title;
    guides[index].game = game;
    guides[index].content = content;
  }

  res.redirect('/guides/' + req.params.id);
});
module.exports = router;