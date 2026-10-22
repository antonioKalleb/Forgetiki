var express = require('express');
var router = express.Router();

/* GET Lista de Guias (/guides) */
router.get('/', function(req, res, next) {
  res.render('guides', { title: 'Guias & Dicas' });
});

/* GET Formulário do Novo Guia (/guides/new) */
router.get('/new', function(req, res, next) {
  res.render('new-guide', { title: 'Novo Guia' });
});

/* Trata o envio do formulário (Simulação da N1) */
router.post('/', function(req, res, next) {
  res.redirect('/guides');
});
module.exports = router;