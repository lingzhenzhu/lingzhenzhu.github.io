import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from '@playwright/test';
import net from 'node:net';
const directory = path.resolve('.artifacts/performance');
await fs.mkdir(directory, { recursive: true });
const origin = process.env.AUDIT_ORIGIN || 'http://127.0.0.1:4173';
const server = process.env.AUDIT_ORIGIN
  ? null
  : spawn(process.execPath, ['scripts/test-server.mjs'], { stdio: 'ignore', windowsHide: true });
if (server) {
  process.on('exit', () => server.kill());
  let ready = false;
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(origin + '/admin/api/session')).ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw Error('Audit server did not start');
}
const cases = [
  ['home-mobile', '/', false],
  ['home-desktop', '/', true],
  ['research-mobile', '/research/', false],
  ['media-mobile', '/media/', false],
];
const results = [];
for (const [name, route, desktop] of cases) {
  console.log('Starting ' + name);
  for (const extension of ['json', 'html'])
    await fs.rm(path.join(directory, name + '.report.' + extension), { force: true });
  const port = await new Promise((resolve) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
  const browser = await chromium.launch({
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}),
    ignoreDefaultArgs: ['--disable-back-forward-cache'],
    args: [`--remote-debugging-port=${port}`],
  });
  const args = [
    path.resolve('node_modules/lighthouse/cli/index.js'),
    origin + route,
    '--quiet',
    `--port=${port}`,
    '--hostname=127.0.0.1',
    '--only-categories=performance,accessibility,best-practices,seo',
    '--output=json',
    '--output=html',
    '--output-path=' + path.join(directory, name),
    '--no-enable-error-reporting',
    ...(desktop ? ['--preset=desktop'] : []),
  ];
  const exit = await new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
      timeout: 300_000,
    });
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('exit', resolve);
  });
  await browser.close();
  if (exit !== 0) {
    console.error(name + ' did not complete: ' + exit);
    continue;
  }
  let report;
  try {
    report = JSON.parse(await fs.readFile(path.join(directory, name + '.report.json'), 'utf8'));
  } catch {
    console.log(name + ' failed: ' + exit);
    continue;
  }
  const result = {
    name,
    exit,
    fetchTime: report.fetchTime,
    lighthouseVersion: report.lighthouseVersion,
    environment: report.environment,
    settings: report.configSettings,
    scores: Object.fromEntries(
      Object.entries(report.categories).map(([k, v]) => [k, Math.round(v.score * 100)]),
    ),
    metrics: Object.fromEntries(
      [
        'first-contentful-paint',
        'largest-contentful-paint',
        'total-blocking-time',
        'cumulative-layout-shift',
        'speed-index',
        'total-byte-weight',
      ].map((k) => [k, { value: report.audits[k]?.numericValue, display: report.audits[k]?.displayValue }]),
    ),
    failedAudits: Object.values(report.audits)
      .filter((a) => a.score !== null && a.score < 1)
      .map(({ id, title, score, displayValue, details }) => ({ id, title, score, displayValue, details })),
    warnings: report.runWarnings,
  };
  const bestPracticeFailures = report.categories['best-practices'].auditRefs
    .filter(
      (reference) =>
        reference.weight > 0 &&
        report.audits[reference.id].score !== null &&
        report.audits[reference.id].score < 1,
    )
    .map((reference) => report.audits[reference.id]);
  const issues = report.audits['inspector-issues'].details?.items || [];
  // Preserve the real player and the unmodified Lighthouse score. Only this observed
  // upstream Cookie issue is tracked separately; new first-party failures fail CI.
  result.externalException =
    name === 'media-mobile' &&
    bestPracticeFailures.length === 1 &&
    bestPracticeFailures[0].id === 'inspector-issues' &&
    issues.length > 0 &&
    issues.every(
      (issue) =>
        issue.issueType === 'Cookie' &&
        issue.subItems?.items?.length > 0 &&
        issue.subItems.items.every((item) => {
          try {
            const host = new URL(item.url).hostname;
            return host === 'apple.com' || host.endsWith('.apple.com');
          } catch {
            return false;
          }
        }),
    )
      ? 'Apple Podcasts embed Cookie issue; original score retained'
      : null;
  results.push(result);
  await fs.writeFile(path.join(directory, 'lighthouse-summary.json'), JSON.stringify(results, null, 2));
  console.log(name, JSON.stringify(result.scores), JSON.stringify(result.metrics));
}

server?.kill();
const failures = results.filter(
  (r) =>
    r.scores.performance < 95 ||
    r.scores.accessibility < 100 ||
    (r.scores['best-practices'] < 100 &&
      (!r.externalException || process.env.STRICT_EXTERNAL_AUDIT === '1')) ||
    r.scores.seo < 100 ||
    r.metrics['cumulative-layout-shift'].value > 0.1,
);
if (results.length !== cases.length || failures.length) {
  console.error(
    'Performance gate failed:',
    failures.map((r) => r.name),
  );
  process.exitCode = 1;
}
