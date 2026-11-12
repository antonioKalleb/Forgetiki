var express = require('express');
var router = express.Router();

// Usuários em memória (conta Admin pronta para testes)
let users = [
  {
    id: '1',
    username: 'Admin',
    email: 'admin@fandomarchive.com',
    password: '123',
    role: 'admin'
  }
];

/* GET Tela de Entrar / Cadastrar */
router.get('/login', function(req, res, next) {
  res.render('login', {
    title: 'Entrar / Cadastrar',
    error: null,
    activeTab: req.query.tab || 'login'
  });
});

/* POST Processar Login */
router.post('/login', function(req, res, next) {
  const { loginId, password } = req.body;
  const cleanId = (loginId || '').trim().toLowerCase();

  const user = users.find(
    u => (u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId) && u.password === password
  );

  if (!user) {
    return res.render('login', {
      title: 'Entrar / Cadastrar',
      error: 'Usuário/e-mail ou senha incorretos.',
      activeTab: 'login'
    });
  }

  res.cookie('fa_user', JSON.stringify({
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  }), { httpOnly: true });

  res.redirect('/');
});

/* POST Processar Cadastro */
router.post('/register', function(req, res, next) {
  const { username, email, password } = req.body;
  const cleanUser = (username || '').trim();
  const cleanEmail = (email || '').trim().toLowerCase();

  if (!cleanUser || !cleanEmail || !password) {
    return res.render('login', {
      title: 'Entrar / Cadastrar',
      error: 'Preencha todos os campos para criar sua conta.',
      activeTab: 'register'
    });
  }

  const alreadyExists = users.some(
    u => u.username.toLowerCase() === cleanUser.toLowerCase() || u.email.toLowerCase() === cleanEmail
  );

  if (alreadyExists) {
    return res.render('login', {
      title: 'Entrar / Cadastrar',
      error: 'Este nome de usuário ou e-mail já está em uso.',
      activeTab: 'register'
    });
  }

  const newUser = {
    id: Date.now().toString(),
    username: cleanUser,
    email: cleanEmail,
    password: password,
    role: 'member'
  };

  users.push(newUser);

  res.cookie('fa_user', JSON.stringify({
    id: newUser.id,
    username: newUser.username,
    email: newUser.email,
    role: newUser.role
  }), { httpOnly: true });

  res.redirect('/');
});

/* GET Sair da Conta */
router.get('/logout', function(req, res, next) {
  res.clearCookie('fa_user');
  res.redirect('/');
});

/* GET Redireciona /register para a aba de cadastro */
router.get('/register', function(req, res, next) {
  res.redirect('/login?tab=register');
});
module.exports = router;