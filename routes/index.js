var express = require('express');
var router = express.Router();

/* GET Home Page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Página Inicial' });
});

/* GET Tela de Login */
router.get('/login', function(req, res, next) {
  res.render('login', { title: 'Login / Cadastro' });
});

/* GET Lista de Jogos */
router.get('/games', function(req, res, next) {
  res.render('games', { title: 'Fandoms & Jogos' });
});

module.exports = router;