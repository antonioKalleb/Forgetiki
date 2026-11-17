var express = require('express');
var router = express.Router();
const { dbAll, dbRun, hashPassword } = require('../database/db');

/* GET Tela de Entrar / Cadastrar */
router.get('/login', function(req, res, next) {
  res.render('login', {
    title: 'Entrar / Cadastrar',
    error: null,
    activeTab: req.query.tab || 'login'
  });
});

/* GET Redireciona /register para a aba de cadastro */
router.get('/register', function(req, res, next) {
  res.redirect('/login?tab=register');
});

/* POST Processar Login */
router.post('/login', async function(req, res, next) {
  try {
    const { loginId, password } = req.body;
    const cleanId = (loginId || '').trim().toLowerCase();
    const hashed = hashPassword(password || '');

    const allUsers = await dbAll('SELECT * FROM users');
    const user = allUsers.find(
      u => (u.email.toLowerCase() === cleanId || u.username.toLowerCase() === cleanId) && u.password === hashed
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
  } catch (err) {
    next(err);
  }
});

/* POST Processar Cadastro */
router.post('/register', async function(req, res, next) {
  try {
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

    const allUsers = await dbAll('SELECT username, email FROM users');
    const existing = allUsers.some(
      u => u.username.toLowerCase() === cleanUser.toLowerCase() || u.email.toLowerCase() === cleanEmail
    );

    if (existing) {
      return res.render('login', {
        title: 'Entrar / Cadastrar',
        error: 'Este nome de usuário ou e-mail já está em uso.',
        activeTab: 'register'
      });
    }

    const result = await dbRun(
      'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [cleanUser, cleanEmail, hashPassword(password), 'member', new Date().toLocaleString('pt-BR')]
    );

    console.log('[SQLite] Nova conta salva:', cleanUser, '(ID:', result.lastID + ')');

    res.cookie('fa_user', JSON.stringify({
      id: result.lastID,
      username: cleanUser,
      email: cleanEmail,
      role: 'member'
    }), { httpOnly: true });

    res.redirect('/');
  } catch (err) {
    next(err);
  }
});

/* GET Sair da Conta */
router.get('/logout', function(req, res, next) {
  res.clearCookie('fa_user');
  res.redirect('/');
});

module.exports = router;