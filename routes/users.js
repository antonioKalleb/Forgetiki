var express = require('express');
var router = express.Router();

// Banco de dados temporário de usuários na memória
let users = [];

/* GET Tela de Login */
router.get('/login', function(req, res, next) {
  res.render('login', { title: 'Entrar', error: null, success: null });
});

/* GET Tela de Cadastro */
router.get('/register', function(req, res, next) {
  res.render('register', { title: 'Cadastrar', error: null });
});

/* POST Processar Cadastro */
router.post('/register', function(req, res, next) {
  const { username, email, password } = req.body;

  const userExists = users.find(u => u.email === email);
  if (userExists) {
    return res.render('register', { title: 'Cadastrar', error: 'Este e-mail já está cadastrado.' });
  }

  users.push({ id: Date.now().toString(), username, email, password });
  res.render('login', { title: 'Entrar', error: null, success: 'Conta criada com sucesso! Faça login abaixo.' });
});

/* POST Processar Login */
router.post('/login', function(req, res, next) {
  const { email, password } = req.body;

  const user = users.find(u => u.email === email && u.password === password);
  if (!user) {
    return res.render('login', { title: 'Entrar', error: 'E-mail ou senha incorretos.', success: null });
  }

  // Redireciona para os guias após o login
  res.redirect('/guides');
});

module.exports = router;