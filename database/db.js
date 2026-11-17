const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();

const dbDir = __dirname;
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'forgetiki.db');
const db = new sqlite3.Database(dbPath);

function hashPassword(password) {
  return crypto.scryptSync(password, 'fandomarchive_salt_v1', 32).toString('hex');
}

function rawRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function rawGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function rawAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function initDatabase() {
  await rawRun('PRAGMA foreign_keys = ON');

  await rawRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'member',
      created_at TEXT
    )
  `);

  await rawRun(`
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      genre TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      is_official INTEGER DEFAULT 0,
      creator_id INTEGER,
      creator_name TEXT DEFAULT 'Comunidade',
      image_url TEXT DEFAULT '',
      description TEXT NOT NULL,
      extended_description TEXT DEFAULT ''
    )
  `);

  await rawRun(`
    CREATE TABLE IF NOT EXISTS guides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      game TEXT NOT NULL,
      category TEXT DEFAULT 'Guia',
      tags TEXT DEFAULT '[]',
      image_url TEXT DEFAULT '',
      links TEXT DEFAULT '[]',
      content TEXT NOT NULL,
      author_id INTEGER,
      author_name TEXT DEFAULT 'Anônimo',
      created_at TEXT
    )
  `);

  await rawRun(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guide_id INTEGER NOT NULL,
      author_id INTEGER,
      author TEXT NOT NULL,
      text TEXT NOT NULL,
      edited INTEGER DEFAULT 0,
      created_at TEXT,
      FOREIGN KEY (guide_id) REFERENCES guides(id) ON DELETE CASCADE
    )
  `);

  await rawRun(`
    CREATE TABLE IF NOT EXISTS fandom_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fandom_name TEXT NOT NULL,
      type TEXT NOT NULL,
      reason TEXT DEFAULT '',
      details TEXT NOT NULL,
      created_at TEXT
    )
  `);

  const userCount = await rawGet('SELECT COUNT(*) as total FROM users');
  if (userCount && userCount.total === 0) {
    await rawRun(
      'INSERT INTO users (username, email, password, role, created_at) VALUES (?, ?, ?, ?, ?)',
      ['Admin', 'admin@fandomarchive.com', hashPassword('123'), 'admin', new Date().toLocaleString('pt-BR')]
    );
  }

  const gameCount = await rawGet('SELECT COUNT(*) as total FROM games');
  if (gameCount && gameCount.total === 0) {
    const initialGames = [
      ['Fear & Hunger', 'RPG / Survival Horror', 'Extrema', 1, 'Oficial', 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=300&q=80',
        'Um jogo brutal focado em exploração masoquista, gestão de recursos e escolhas de alto risco nas masmorras de Prehevil.',
        'Comunidade dedicada a rotas de sobrevivência, finais S, tabelas de fraquezas de chefes, alquimia e lore profundo do universo criado por Miro Haverinen.'],
      ['Rain World', 'Survival Platformer', 'Muito Alta', 1, 'Oficial', 'https://images.unsplash.com/photo-1518837695005-2083093ee35b?w=300&q=80',
        'Controle um Slugcat num ecossistema pré-histórico hostil com IA de predadores dinâmica e ciclos de chuva mortais.',
        'Espaço para compartilhar mapas de regiões, comportamento de criaturas, rotas de passagem, pérolas de lore e estratégias para todas as campanhas de Downpour.'],
      ['La-Mulana', 'Metroidvania / Puzzle', 'Extrema', 1, 'Oficial', 'https://images.unsplash.com/photo-1599940824399-b87987ceb72a?w=300&q=80',
        'Ruínas antigas repletas de armadilhas e enigmas arqueológicos complexos que exigem anotações reais para serem decifrados.',
        'Arquivo colaborativo de tabuletas traduzidas, dicas sem spoilers pesados para enigmas de Eg-Lana e localização de softwares e selos.'],
      ['Pathologic 2', 'Survival / Narrative', 'Muito Alta', 1, 'Oficial', 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=300&q=80',
        'Uma simulação angustiante de 12 dias combatendo uma praga mortal numa cidade isolada onde recursos e tempo são escassos.',
        'Discussões sobre gestão de imunidade e fome, preparo de tinturas, rotas de trocas noturnas e análise teatral dos eventos da Cidade-no-Gorkhon.'],
      ['Nine Sols', 'Action Platformer', 'Alta', 1, 'Oficial', 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=300&q=80',
        'Ação 2D desenhada à mão focada em combate de deflexão (parry) num universo Taopunk sombrio.',
        'Guias de builds de Jades, timing de Talismãs e Unbounded Counter contra os Sols, além de segredos para o final verdadeiro.'],
      ['Vagrant Story', 'Tactical RPG', 'Alta', 1, 'Oficial', 'https://images.unsplash.com/photo-1519074069444-1ba4fff66d16?w=300&q=80',
        'Clássico sombrio focado em forja de armas, afinidades elementais e combate tático por partes do corpo.',
        'Manuais de combinação de metais (Damascus), controle de Risk, cadeias de Battle Abilities e exploração dos segredos de Leá Monde.'],
      ['Kenshi', 'RPG Sandbox / Estratégia', 'Muito Alta', 0, 'Comunidade', 'https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=300&q=80',
        'RPG de mundo aberto implacável onde você não é o escolhido e precisa sobreviver, construir e recrutar num mundo pós-apocalíptico.',
        'Compartilhe locais seguros para montar entrepostos, rotas de comércio lucrativas, recrutas únicos e estratégias para enfrentar as facções do continente.']
    ];

    for (const g of initialGames) {
      await rawRun(
        `INSERT INTO games (name, genre, difficulty, is_official, creator_name, image_url, description, extended_description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        g
      );
    }
  }

  const guideCount = await rawGet('SELECT COUNT(*) as total FROM guides');
  if (guideCount && guideCount.total === 0) {
    await rawRun(
      `INSERT INTO guides (title, game, category, tags, image_url, links, content, author_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'Como sobreviver aos primeiros dias no Dungeon',
        'Fear & Hunger',
        'Guia',
        JSON.stringify(['Fear_&_Hunger', 'Sobrevivência', 'Dungeon', 'Iniciante']),
        'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=600',
        JSON.stringify([]),
        'Guia de sobrevivência básica: priorize salvar recursos, evite combates desnecessários e aprenda o padrão de movimento das moedas.',
        'Admin',
        new Date().toLocaleString('pt-BR')
      ]
    );
  }

  console.log('[SQLite] Banco conectado e pronto em:', dbPath);
}

const dbReady = initDatabase().catch(err => {
  console.error('[SQLite] Erro fatal ao inicializar banco:', err);
  throw err;
});

async function dbRun(sql, params = []) {
  await dbReady;
  return rawRun(sql, params);
}

async function dbGet(sql, params = []) {
  await dbReady;
  return rawGet(sql, params);
}

async function dbAll(sql, params = []) {
  await dbReady;
  return rawAll(sql, params);
}

module.exports = {
  db,
  dbRun,
  dbGet,
  dbAll,
  hashPassword
};