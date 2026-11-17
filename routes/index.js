var express = require('express');
var router = express.Router();

/* GET Página Inicial */
router.get('/', async function(req, res, next) {
  try {
    const guidesRouter = require('./guides');
    const gamesRouter = require('./games');

    const allGuides = await guidesRouter.getGuides();
    const postCategories = guidesRouter.getPostCategories();
    const allGames = await gamesRouter.getAllGames();

    const recentPosts = [...allGuides].reverse().slice(0, 4);
    const featuredGames = allGames.official.slice(0, 4);

    res.render('index', {
      title: 'Início',
      recentPosts: recentPosts,
      postCategories: postCategories,
      featuredGames: featuredGames,
      totalPosts: allGuides.length
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;