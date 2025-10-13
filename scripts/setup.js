// Setup script: provisions Postgres (db/role/privileges), creates tables, seeds user, and updates .env
// Quick usage:
//   node scripts/setup.js
// Options (CLI):
//   --db-name video_app --db-host localhost --db-port 5432
//   --app-user app_user --app-pass app_pass
//   --admin-url postgresql://postgres:postgres@localhost:5432/postgres
//   --username admin --password admin123  (usuario de aplicação na tabela users)
// Options (ENV):
//   ADMIN_DATABASE_URL, SETUP_DB_NAME, SETUP_DB_HOST, SETUP_DB_PORT, SETUP_APP_USER, SETUP_APP_PASSWORD, SETUP_USERNAME, SETUP_PASSWORD

import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

// Load .env if available (best-effort). If dotenv isn't installed, fallback to manual parse
let dotenvLoaded = false;
try { await import('dotenv/config'); dotenvLoaded = true; } catch {}
if (!dotenvLoaded) {
  try {
    const raw = readFileSync('.env', 'utf8');
    for (const line of raw.split(/\r?\n/)) {
      if (!line || line.trim().startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx === -1) continue;
      const k = line.slice(0, idx);
      const v = line.slice(idx + 1);
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {}
}

function log(step, msg) { console.log(`[${step}] ${msg}`); }

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--username' || a === '-u') args.username = argv[++i]; // seed app user (users table)
    else if (a === '--password' || a === '-p') args.password = argv[++i]; // seed app password (users table)
    else if (a === '--app-user') args.appUser = argv[++i]; // DB role name
    else if (a === '--app-pass') args.appPass = argv[++i]; // DB role password
    else if (a === '--db-name') args.dbName = argv[++i];
    else if (a === '--db-host') args.dbHost = argv[++i];
    else if (a === '--db-port') args.dbPort = parseInt(argv[++i], 10);
    else if (a === '--admin-url') args.adminUrl = argv[++i];
    else if (a === '--admin-user') args.adminUser = argv[++i];
    else if (a === '--admin-pass') args.adminPass = argv[++i];
    else if (a === '--reset') args.reset = true;
  }
  return args;
}

const {
  username: argUser,
  password: argPass,
  appUser: argAppUser,
  appPass: argAppPass,
  dbName: argDbName,
  dbHost: argDbHost,
  dbPort: argDbPort,
  adminUrl: argAdminUrl,
  adminUser: argAdminUser,
  adminPass: argAdminPass,
  reset: argReset,
} = parseArgs(process.argv);

const SEED_USERNAME = argUser || process.env.SETUP_USERNAME || 'admin';
const SEED_PASSWORD = argPass || process.env.SETUP_PASSWORD || 'admin123';

const DB_HOST = argDbHost || process.env.SETUP_DB_HOST || 'localhost';
const DB_PORT = argDbPort || parseInt(process.env.SETUP_DB_PORT || '5432', 10);
const DB_NAME = argDbName || process.env.SETUP_DB_NAME || 'video_app';
const APP_DB_USER = argAppUser || process.env.SETUP_APP_USER || 'video_app_user';
const APP_DB_PASSWORD = argAppPass || process.env.SETUP_APP_PASSWORD || 'video_app_pass123';
let ADMIN_DATABASE_URL = argAdminUrl || process.env.ADMIN_DATABASE_URL || '';
if (!ADMIN_DATABASE_URL && argAdminUser) {
  const ap = argAdminPass || '';
  ADMIN_DATABASE_URL = makeDbUrl({ user: argAdminUser, pass: ap, host: DB_HOST, port: DB_PORT, db: 'postgres' });
}

function makeDbUrl({ user, pass, host, port, db }) {
  const u = encodeURIComponent(user);
  const p = encodeURIComponent(pass);
  return `postgresql://${u}:${p}@${host}:${port}/${db}`;
}

function replaceDbInUrl(urlStr, dbName) {
  const u = new URL(urlStr);
  u.pathname = `/${dbName}`;
  return u.toString();
}

const TARGET_DATABASE_URL = makeDbUrl({
  user: APP_DB_USER,
  pass: APP_DB_PASSWORD,
  host: DB_HOST,
  port: DB_PORT,
  db: DB_NAME,
});

// 1) Install dependencies (ensure base deps; ensure 'pg')
try {
  const ensureBaseDeps = () => {
    if (!existsSync('node_modules')) {
      const hasLock = existsSync('package-lock.json');
      log('deps', `${hasLock ? 'npm ci' : 'npm install'} iniciando...`);
      execSync(hasLock ? 'npm ci' : 'npm install', { stdio: 'inherit' });
    } else {
      log('deps', 'Dependências já instaladas, pulando.');
    }
  };
  ensureBaseDeps();

  // Ensure 'pg' is installed
  let pgOk = true;
  try { await import('pg'); } catch { pgOk = false; }
  if (!pgOk) {
    log('deps', "Instalando dependência 'pg'...");
    execSync('npm install pg@^8', { stdio: 'inherit' });
  }
} catch (err) {
  console.error('Falha ao instalar dependências:', err.message || err);
  process.exit(1);
}

// 2) Provision DB/ROLE and prepare effective DATABASE_URL
import pgModule from 'pg';
const { Pool, Client } = pgModule;

let provisioned = false;
const originalEnvDatabaseUrl = process.env.DATABASE_URL || '';

let adminConn = ADMIN_DATABASE_URL;
if (!adminConn) {
  const guesses = [
    makeDbUrl({ user: 'postgres', pass: 'postgres', host: DB_HOST, port: DB_PORT, db: 'postgres' }),
    makeDbUrl({ user: 'postgres', pass: 'admin', host: DB_HOST, port: DB_PORT, db: 'postgres' }),
    makeDbUrl({ user: 'postgres', pass: '', host: DB_HOST, port: DB_PORT, db: 'postgres' }),
    makeDbUrl({ user: 'admin', pass: 'admin', host: DB_HOST, port: DB_PORT, db: 'postgres' }),
    makeDbUrl({ user: 'admin', pass: '', host: DB_HOST, port: DB_PORT, db: 'postgres' }),
  ];
  for (const g of guesses) {
    try { const c = new Client({ connectionString: g }); await c.connect(); await c.end(); adminConn = g; break; } catch {}
  }
}

let effectiveDatabaseUrl = originalEnvDatabaseUrl;
// Treat placeholder DATABASE_URL values as empty
const maybeUrl = (effectiveDatabaseUrl || '').toLowerCase();
if (maybeUrl.includes('seu_usuario') || maybeUrl.includes('sua_senha')) {
  effectiveDatabaseUrl = '';
}

if (!adminConn) {
  log('provision', 'Admin indisponível; continuando com DATABASE_URL existente (se configurado).');
  if (!effectiveDatabaseUrl) {
    console.error('Erro: sem ADMIN_DATABASE_URL e sem DATABASE_URL válido no .env. Configure um dos dois e rode novamente.');
    console.error('Exemplo: node scripts/setup.js --admin-user admin --admin-pass SUA_SENHA');
    process.exit(1);
  }

  // Se a DATABASE_URL aponta para o usuário do app padrão e não há admin,
  // valide a conexão antes de seguir. Se falhar, oriente o usuário.
  try {
    const test = new Client({ connectionString: effectiveDatabaseUrl });
    await test.connect();
    await test.end();
  } catch (e) {
    const who = (() => { try { return new URL(effectiveDatabaseUrl).username; } catch { return 'desconhecido'; } })();
    console.error(`Erro: não foi possível autenticar com DATABASE_URL (usuário '${who}').`);
    console.error('Sem acesso admin, não é possível criar o usuário/DB automaticamente.');
    console.error('Rode com credenciais de admin para provisionar:');
    console.error('  node scripts/setup.js --admin-user admin --admin-pass SUA_SENHA');
    console.error('Ou ajuste manualmente a DATABASE_URL no .env para um usuário existente e com permissão.');
    process.exit(1);
  }
} else {
  log('provision', `Conectando como admin para ${argReset ? 'resetar' : 'criar'} DB/ROLE...`);
  const admin = new Pool({ connectionString: adminConn });
  try {
    if (argReset) {
      // terminate connections and drop database if exists
      const adminDbName = new URL(adminConn).pathname.slice(1) || 'postgres';
      if (adminDbName === DB_NAME) {
        // switch to postgres DB for drop target
        admin.end();
      }
      const ctl = new Pool({ connectionString: replaceDbInUrl(adminConn, 'postgres') });
      try {
        await ctl.query(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid();`, [DB_NAME]);
        await ctl.query(`DROP DATABASE IF EXISTS "${DB_NAME}"`);
        log('provision', `Banco '${DB_NAME}' dropado.`);
      } finally { await ctl.end(); }
    }

    // Create database if not exists
    const dbExists = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [DB_NAME]);
    if (dbExists.rowCount === 0) {
      await admin.query(`CREATE DATABASE "${DB_NAME}"`);
      log('provision', `Banco '${DB_NAME}' criado.`);
    } else {
      log('provision', `Banco '${DB_NAME}' já existe.`);
    }

    // Create / update role
    const roleExists = await admin.query('SELECT 1 FROM pg_roles WHERE rolname = $1', [APP_DB_USER]);
    if (roleExists.rowCount === 0) {
      const pw = APP_DB_PASSWORD.replace(/'/g, "''");
      await admin.query(`CREATE ROLE "${APP_DB_USER}" LOGIN PASSWORD '${pw}'`);
      log('provision', `Role '${APP_DB_USER}' criada.`);
    } else {
      const pw = APP_DB_PASSWORD.replace(/'/g, "''");
      await admin.query(`ALTER ROLE "${APP_DB_USER}" WITH LOGIN PASSWORD '${pw}'`);
      log('provision', `Role '${APP_DB_USER}' já existe; senha atualizada.`);
    }

    // Connect to target DB for grants and extension
    const adminDb = new Pool({ connectionString: replaceDbInUrl(adminConn, DB_NAME) });
    try {
      await adminDb.query('CREATE EXTENSION IF NOT EXISTS pgcrypto;');
      await adminDb.query(`GRANT CONNECT ON DATABASE "${DB_NAME}" TO "${APP_DB_USER}";`).catch(()=>{});
      await adminDb.query(`GRANT USAGE ON SCHEMA public TO "${APP_DB_USER}";`);
      await adminDb.query(`GRANT CREATE ON SCHEMA public TO "${APP_DB_USER}";`);
      await adminDb.query(`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO "${APP_DB_USER}";`);
      await adminDb.query(`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO "${APP_DB_USER}";`);
      await adminDb.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO "${APP_DB_USER}";`);
      await adminDb.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO "${APP_DB_USER}";`);
      log('provision', 'Permissões concedidas e pgcrypto habilitado.');
    } finally { await adminDb.end(); }

    provisioned = true;
    effectiveDatabaseUrl = TARGET_DATABASE_URL;
  } finally { await admin.end(); }
}

// When --reset without admin, do a best-effort: drop existing tables via current user
if (argReset && !provisioned) {
  try {
    log('reset', 'Sem admin: tentando limpar tabelas existentes (best-effort)...');
    const pool = new Pool({ connectionString: effectiveDatabaseUrl });
    try {
      await pool.query('DROP TABLE IF EXISTS videos CASCADE;');
      await pool.query('DROP TABLE IF EXISTS users CASCADE;');
    } finally { await pool.end(); }
  } catch {}
}

// Update .env only if provisioning succeeded (to avoid breaking a valid local DATABASE_URL)
if (provisioned) {
  try {
    let envContent = '';
    try { envContent = readFileSync('.env', 'utf8'); } catch {}
    const lines = envContent.split(/\r?\n/).filter(l => l.length > 0);
    const kv = Object.fromEntries(lines.map(l => {
      const idx = l.indexOf('=');
      if (idx === -1) return [l, ''];
      return [l.slice(0, idx), l.slice(idx+1)];
    }));
    kv['DATABASE_URL'] = effectiveDatabaseUrl;
    const out = Object.entries(kv).map(([k,v]) => `${k}=${v}`).join('\n');
    writeFileSync('.env', out + '\n', 'utf8');
    process.env.DATABASE_URL = effectiveDatabaseUrl;
    log('env', 'DATABASE_URL atualizado em .env');
  } catch (e) {
    console.warn('Aviso: não foi possível atualizar .env automaticamente:', e.message || e);
    process.env.DATABASE_URL = effectiveDatabaseUrl;
  }
}

// 3) Push schema with app user
try {
  log('db:push', 'Aplicando schema com drizzle-kit push...');
  execSync('npx drizzle-kit push', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: effectiveDatabaseUrl } });
} catch (err) {
  console.error('Falha ao executar drizzle-kit push:', err.message || err);
  process.exit(1);
}

// 4) Seed default application user
try {
  log('seed', 'Inserindo usuário padrão na tabela users...');
  const pool = new Pool({ connectionString: effectiveDatabaseUrl });
  try {
    const insertSQL = `
      INSERT INTO users (username, password)
      VALUES ($1, $2)
      ON CONFLICT (username) DO NOTHING
      RETURNING id;
    `;
    const res = await pool.query(insertSQL, [SEED_USERNAME, SEED_PASSWORD]);
    if (res.rowCount && res.rows[0]?.id) {
      log('seed', `Usuário '${SEED_USERNAME}' criado (id=${res.rows[0].id}).`);
    } else {
      log('seed', `Usuário '${SEED_USERNAME}' já existe; nenhuma alteração.`);
    }
  } finally { await pool.end(); }
} catch (err) {
  console.error('Falha ao semear usuário:', err.message || err);
  process.exit(1);
}

log('ok', 'Setup concluído com sucesso. Agora rode: npm run dev');
