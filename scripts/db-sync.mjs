// Replaces the local development database (docker-compose.yml) with a copy of
// the source database named by DEV_DB_SOURCE_URL in apps/api/.env. The source
// is only read; everything in the local database is dropped first.
// pg_dump and pg_restore run inside the container, so nothing is installed on
// the host, and the source URL reaches them through the environment, never
// the command line or the output.
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONTAINER = 'tutorio-dev-pg';
const DATABASE = 'tutorio';
const envFile = fileURLToPath(new URL('../apps/api/.env', import.meta.url));

if (existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DEV_DB_SOURCE_URL) {
  console.error('DEV_DB_SOURCE_URL is not set in apps/api/.env — nothing to copy from.');
  process.exit(1);
}

const run = (args, options = {}) => execFileSync('docker', args, { stdio: 'inherit', ...options });
const psql = (sql) =>
  run([
    'exec',
    CONTAINER,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    sql,
  ]);

console.log('Starting the local database…');
run(['compose', 'up', '--detach', '--wait', 'postgres'], {
  cwd: fileURLToPath(new URL('..', import.meta.url)),
});

console.log(`Recreating "${DATABASE}"…`);
psql(`DROP DATABASE IF EXISTS ${DATABASE} WITH (FORCE)`);
psql(`CREATE DATABASE ${DATABASE}`);

console.log('Copying the source database (schema, data, migration history)…');
run([
  'exec',
  '--env',
  'DEV_DB_SOURCE_URL',
  CONTAINER,
  'bash',
  '-c',
  'set -o pipefail; pg_dump "$DEV_DB_SOURCE_URL" --format=custom --no-owner --no-acl' +
    ` | pg_restore --no-owner --no-acl --exit-on-error -U postgres -d ${DATABASE}`,
]);

console.log('Done: the local database is a copy of the source.');
