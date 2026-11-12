var express = require('express');
var router = express.Router();

/* GET Página Inicial */
router.get('/', function(req, res, next) {
  const guidesRouter = require('./guides');
  const gamesRouter = require('./games');

  const allGuides = guidesRouter.getGuides();
  const postCategories = guidesRouter.getPostCategories();
  const allGames = gamesRouter.getAllGames();

  // Pega os 4 posts mais recentes
  const recentPosts = [...allGuides].reverse().slice(0, 4);

  // Pega os primeiros fandoms oficiais para destaque
  const featuredGames = allGames.official.slice(0, 4);

  res.render('index', {
    title: 'Início',
    recentPosts: recentPosts,
    postCategories: postCategories,
    featuredGames: featuredGames,
    totalPosts: allGuides.length
  });
});

module.exports = router;