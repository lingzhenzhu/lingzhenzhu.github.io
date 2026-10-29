import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { deploymentArguments, resolveDeploymentSource, type GitCommand } from './deployment/source';

const root = fileURLToPath(new URL('../', import.meta.url));
const configPath = path.join(root, 'apps/studio/wrangler.jsonc');
const git: GitCommand = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
  } catch {
    throw new Error(
      `Git ${args[0]} failed. Check repository access and network connectivity; nothing was deployed.`,
    );
  }
};

async function deploy() {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean' }, 'secrets-file': { type: 'string' } },
    allowPositionals: false,
    strict: true,
  });
  const pnpm = process.env.npm_execpath;
  if (!pnpm) throw new Error('Run this command through pnpm deploy:studio.');
  const configText = await fs.readFile(configPath, 'utf8');
  const config = JSON.parse(configText);
  const source = resolveDeploymentSource(git, config.vars.GITHUB_REPOSITORY || '');
  const secretsFile = values['secrets-file']
    ? path.resolve(process.env.INIT_CWD || process.cwd(), values['secrets-file'])
    : undefined;
  if (secretsFile && !(await fs.stat(secretsFile)).isFile())
    throw new Error('The secrets file must be a local file.');

  console.log(
    `Preparing ${source.branch} at ${source.commit}. SOURCE_COMMIT will be injected automatically.`,
  );
  for (const command of ['backend:check', 'verify', 'audit:output'])
    execFileSync(process.execPath, [pnpm, command], { cwd: root, stdio: 'inherit' });

  // A long build must not silently deploy a different checkout or account configuration.
  const checked = resolveDeploymentSource(git, config.vars.GITHUB_REPOSITORY);
  if (
    checked.commit !== source.commit ||
    checked.branch !== source.branch ||
    (await fs.readFile(configPath, 'utf8')) !== configText
  )
    throw new Error('Source or deployment configuration changed during verification. Run deployment again.');

  execFileSync(
    process.execPath,
    [
      path.join(root, 'scripts/tool.mjs'),
      ...deploymentArguments(configPath, source, { dryRun: values['dry-run'], secretsFile }),
    ],
    { cwd: root, stdio: 'inherit' },
  );
}

deploy().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Deployment failed.');
  process.exitCode = 1;
});
