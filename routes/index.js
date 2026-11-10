var express = require('express');
var router = express.Router();

/* GET Home Page */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'FandomArchive' });
});

/* GET /login (Redireciona para /users/login para evitar erro 404/ReferenceError) */
router.get('/login', function(req, res, next) {
  res.redirect('/users/login');
});

module.exports = router;