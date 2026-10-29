export type GitCommand = (args: string[]) => string;
export type DeploymentSource = { commit: string; branch: string };

const deploymentConfig = 'apps/studio/wrangler.jsonc';

export function resolveDeploymentSource(git: GitCommand, repository: string): DeploymentSource {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository))
    throw new Error('Configure a GitHub owner/repository before deploying.');

  const commit = git(['rev-parse', '--verify', 'HEAD']).trim();
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Could not determine the source commit.');

  // Account configuration may be local; application code must match the committed source.
  const changed = [
    ...git(['diff', '--name-only', '-z', 'HEAD']).split('\0'),
    ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0'),
  ].filter((file) => file && file !== deploymentConfig);
  if (changed.length)
    throw new Error(
      'Commit and push all source changes before deploying. Local account configuration may remain uncommitted.',
    );

  const remote = git(['remote', 'get-url', 'origin'])
    .trim()
    .replace(/\.git$/, '');
  const expected = [
    `https://github.com/${repository}`,
    `git@github.com:${repository}`,
    `ssh://git@github.com/${repository}`,
  ];
  if (!expected.some((url) => url.toLowerCase() === remote.toLowerCase()))
    throw new Error('The origin remote does not match the configured GitHub repository.');

  // Read GitHub itself, not a potentially stale local origin/HEAD tracking ref.
  const lines = git(['ls-remote', '--symref', 'origin', 'HEAD']).trim().split(/\r?\n/);
  const branch = lines.map((line) => /^ref: refs\/heads\/(.+)\tHEAD$/.exec(line)?.[1]).find(Boolean);
  const remoteCommit = lines.map((line) => /^([a-f0-9]{40})\tHEAD$/.exec(line)?.[1]).find(Boolean);
  if (!branch || !remoteCommit) throw new Error('Could not verify the GitHub default branch.');
  if (commit !== remoteCommit)
    throw new Error(
      `Production deployment requires the current GitHub default branch (${branch}). Merge the reviewed changes and update the checkout first.`,
    );
  return { commit, branch };
}

export function deploymentArguments(
  configPath: string,
  source: DeploymentSource,
  options: { dryRun?: boolean; secretsFile?: string } = {},
): string[] {
  const args = ['wrangler', 'deploy', '--config', configPath, '--var', `SOURCE_COMMIT:${source.commit}`];
  if (options.dryRun) args.push('--dry-run');
  if (options.secretsFile) args.push('--secrets-file', options.secretsFile);
  return args;
}
