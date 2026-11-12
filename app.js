var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// Importação das Rotas
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var guidesRouter = require('./routes/guides');
var gamesRouter = require('./routes/games');
var authRouter = require('./routes/auth');

var app = express();

// View engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
// Disponibiliza o usuário logado para todas as telas (.ejs)
app.use(function(req, res, next) {
  try {
    res.locals.currentUser = req.cookies && req.cookies.fa_user ? JSON.parse(req.cookies.fa_user) : null;
  } catch (e) {
    res.locals.currentUser = null;
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Uso das Rotas
app.use('/', indexRouter);
app.use('/', authRouter);
app.use('/users', usersRouter);
app.use('/guides', guidesRouter); // <-- Ativação da Rota (/guides)
app.use('/games', gamesRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;