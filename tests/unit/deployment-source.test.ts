import { describe, expect, it, vi } from 'vitest';
import { deploymentArguments, resolveDeploymentSource } from '../../scripts/deployment/source';

const repository = 'lingzhenzhu/lingzhenzhu.github.io';
const commit = 'a'.repeat(40);
const newer = 'b'.repeat(40);

function fixture(
  options: {
    changed?: string;
    untracked?: string;
    remote?: string;
    remoteCommit?: string;
    branch?: string;
    remoteOutput?: string;
  } = {},
) {
  return vi.fn((args: string[]) => {
    const command = args.join(' ');
    if (command === 'rev-parse --verify HEAD') return commit + '\n';
    if (command === 'diff --name-only -z HEAD') return options.changed || '';
    if (command === 'ls-files --others --exclude-standard -z') return options.untracked || '';
    if (command === 'remote get-url origin') return options.remote || `https://github.com/${repository}.git`;
    if (command === 'ls-remote --symref origin HEAD')
      return (
        options.remoteOutput ??
        `ref: refs/heads/${options.branch || 'gh-pages'}\tHEAD\n${options.remoteCommit || commit}\tHEAD\n`
      );
    throw new Error('Unexpected Git command: ' + command);
  });
}

describe('automatic production source selection', () => {
  it('uses the live default branch and permits local account configuration', () => {
    const git = fixture({ changed: 'apps/studio/wrangler.jsonc\0', branch: 'main' });
    expect(resolveDeploymentSource(git, repository)).toEqual({ commit, branch: 'main' });
    expect(git).toHaveBeenCalledWith(['ls-remote', '--symref', 'origin', 'HEAD']);
  });

  it.each([
    { changed: 'apps/studio/server/releases.ts\0' },
    { untracked: 'packages/content/src/new-module.ts\0' },
    { changed: 'apps/studio/wrangler.jsonc\0package.json\0' },
  ])('stops before remote access when source differs from the commit: %j', (changes) => {
    const git = fixture(changes);
    expect(() => resolveDeploymentSource(git, repository)).toThrow('Commit and push');
    expect(git).not.toHaveBeenCalledWith(['ls-remote', '--symref', 'origin', 'HEAD']);
  });

  it('rejects an unmerged branch or an outdated checkout', () => {
    expect(() => resolveDeploymentSource(fixture({ remoteCommit: newer }), repository)).toThrow(
      'Merge the reviewed changes',
    );
  });

  it.each([
    'https://github.com/someone/another-repository.git',
    'https://github.com.example.test/lingzhenzhu/lingzhenzhu.github.io.git',
  ])('rejects a different remote: %s', (remote) => {
    expect(() => resolveDeploymentSource(fixture({ remote }), repository)).toThrow('does not match');
  });

  it.each([`git@github.com:${repository}.git`, `ssh://git@github.com/${repository}.git`])(
    'accepts the configured repository over SSH: %s',
    (remote) => {
      expect(resolveDeploymentSource(fixture({ remote }), repository).commit).toBe(commit);
    },
  );

  it.each(['', `${commit}\tHEAD\n`, 'ref: refs/heads/main\tHEAD\ninvalid\tHEAD\n'])(
    'fails closed for an incomplete remote response',
    (remoteOutput) => {
      expect(() => resolveDeploymentSource(fixture({ remoteOutput }), repository)).toThrow(
        'Could not verify',
      );
    },
  );

  it('does not substitute a local tracking ref when GitHub is unavailable', () => {
    const normal = fixture();
    const git = (args: string[]) => {
      if (args[0] === 'ls-remote') throw new Error('Network unavailable');
      return normal(args);
    };
    expect(() => resolveDeploymentSource(git, repository)).toThrow('Network unavailable');
  });

  it('pins both dry runs and deployments, preserving a secret file path as one argument', () => {
    const source = { commit, branch: 'gh-pages' };
    expect(
      deploymentArguments('C:/My Website/wrangler.jsonc', source, {
        dryRun: true,
        secretsFile: 'C:/My Secrets/worker.json',
      }),
    ).toEqual([
      'wrangler',
      'deploy',
      '--config',
      'C:/My Website/wrangler.jsonc',
      '--var',
      `SOURCE_COMMIT:${commit}`,
      '--dry-run',
      '--secrets-file',
      'C:/My Secrets/worker.json',
    ]);
    expect(deploymentArguments('config.jsonc', source)).toContain(`SOURCE_COMMIT:${commit}`);
  });
});
