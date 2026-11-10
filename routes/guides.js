var express = require('express');
var router = express.Router();

// Lista de jogos difíceis e/ou pouco valorizados
const availableGames = [
  'Fear & Hunger',
  'Rain World',
  'La-Mulana',
  'Pathologic 2',
  'Nine Sols',
  'Vagrant Story'
];

// Estrutura de guias na memória com mídia e comentários
let guides = [
  {
    id: '1',
    title: 'Como sobreviver aos primeiros dias no Dungeon',
    game: 'Fear & Hunger',
    imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
    videoUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    content: 'Guia de sobrevivência básica: priorize salvar recursos, evite combates desnecessários e aprenda o padrão de movimento das moedas.',
    comments: [
      { author: 'DarkKnight', text: 'Esse jogo é brutal! Essa dica de evitar combate salvou minha run.', createdAt: '10/11/2026 14:30' }
    ]
  }
];

/* GET Lista de Guias */
router.get('/', function(req, res, next) {
  res.render('guides', { title: 'Guias & Dicas', guides: guides });
});

/* GET Formulário de Criar Guia */
router.get('/new', function(req, res, next) {
  res.render('new-guide', { title: 'Novo Guia', games: availableGames });
});

/* POST Criar Guia */
router.post('/', function(req, res, next) {
  const { title, game, imageUrl, videoUrl, content } = req.body;
  
  // Trata link do YouTube para formato de embed
  let formattedVideoUrl = videoUrl || '';
  if (formattedVideoUrl.includes('watch?v=')) {
    formattedVideoUrl = formattedVideoUrl.replace('watch?v=', 'embed/');
  }

  const newGuide = {
    id: Date.now().toString(),
    title,
    game,
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

/* POST Adicionar Comentário no Guia */
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
  res.render('edit-guide', { title: 'Editar Guia', guide: guide, games: availableGames });
});

/* POST Salvar Edição */
router.post('/:id/edit', function(req, res, next) {
  const { title, game, imageUrl, videoUrl, content } = req.body;
  const index = guides.findIndex(g => g.id === req.params.id);

  if (index !== -1) {
    let formattedVideoUrl = videoUrl || '';
    if (formattedVideoUrl.includes('watch?v=')) {
      formattedVideoUrl = formattedVideoUrl.replace('watch?v=', 'embed/');
    }

    guides[index].title = title;
    guides[index].game = game;
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