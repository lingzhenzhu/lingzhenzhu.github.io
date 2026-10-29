import fs from 'node:fs/promises';
const filename = new URL('../apps/studio/wrangler.jsonc', import.meta.url);
const config = JSON.parse(await fs.readFile(filename, 'utf8'));
const vars = config.vars;
if (vars.ENVIRONMENT !== 'production' || vars.PUBLIC_ORIGIN !== 'https://www.lzzhu.net')
  throw new Error('Production origin must be https://www.lzzhu.net');
if (
  !/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(vars.ACCESS_ISSUER) ||
  !vars.ACCESS_AUD ||
  !vars.ADMIN_EMAILS ||
  !vars.BUILD_SERVICE_ID
)
  throw new Error(
    'Configure Access issuer, audience, administrator emails and build identity before deploying',
  );
if (
  (vars.REWARDS_ACCESS_AUD || vars.REWARDS_EMAILS) &&
  (!vars.REWARDS_ACCESS_AUD || vars.REWARDS_ACCESS_AUD === vars.ACCESS_AUD || !vars.REWARDS_EMAILS)
)
  throw new Error('Configure a separate recipient Access application and recipient emails');
if (!config.d1_databases[0].database_id || config.d1_databases[0].database_id.startsWith('00000000'))
  throw new Error('Replace the D1 database placeholder');
if (config.workers_dev !== false || config.preview_urls !== false || config.assets.run_worker_first !== true)
  throw new Error('All admin assets must remain behind the Worker authentication boundary');
if (
  config.routes.length !== 2 ||
  config.routes.some(
    (route: { pattern: string }) => !['www.lzzhu.net/admin*', 'www.lzzhu.net/api/*'].includes(route.pattern),
  )
)
  throw new Error('Unexpected hostname or Worker route');
if (config.images?.binding !== 'IMAGES')
  throw new Error('Configure the Images binding for upload validation');
if (
  config.r2_buckets.length !== 1 ||
  config.r2_buckets[0].binding !== 'PRIVATE' ||
  !config.r2_buckets[0].bucket_name
)
  throw new Error('Configure one private R2 bucket');
if (vars.LOCAL_DEV_AUTH) throw new Error('Local authentication must not be configured for production');
console.log(
  'Production configuration validated. Secret values still require provisioning through Cloudflare.',
);
