/* eslint-env node */
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/**
 * Stamps the environment/version badges onto the app icons for non-production builds.
 *
 * Replaces the `app-icon-badge` config plugin, which starts its icon writes without ever awaiting
 * them. Expo registers its own icon mods after project plugins, so they run first and read the
 * badged PNGs while a write — or the truncation from one of prebuild's repeated config evaluations —
 * is still in flight, and jimp fails with "Could not find MIME for Buffer <null>".
 *
 * Config plugins are synchronous, so the badges are rendered in a child process that is waited on.
 * Output names carry a hash of their inputs, so repeat evaluations reuse the finished files, and each
 * file is renamed into place only once the render has fully completed.
 */

const OUTPUT_DIR = path.join('.expo', 'app-icon-badge');
const RENDERER_VERSION = require('app-icon-badge/package.json').version;

function getIconTargets(config) {
  return [
    {
      name: 'icon',
      source: config.icon,
      isAdaptiveIcon: false,
      apply: (iconPath) => {
        config.icon = iconPath;
      },
    },
    {
      name: 'ios-icon',
      source: config.ios?.icon,
      isAdaptiveIcon: false,
      apply: (iconPath) => {
        config.ios.icon = iconPath;
      },
    },
    {
      name: 'adaptive-icon',
      source: config.android?.adaptiveIcon?.foregroundImage,
      isAdaptiveIcon: true,
      apply: (iconPath) => {
        config.android.adaptiveIcon.foregroundImage = iconPath;
      },
    },
  ].filter((target) => typeof target.source === 'string');
}

// Per config object, the source each icon was rendered from and the output the config was pointed at.
// Applied to the same config again, the plugin renders from those sources rather than badging its own
// output, so a changed badge or a deleted output is rendered afresh.
const appliedIcons = new WeakMap();

function resolveSource(config, target) {
  const applied = appliedIcons.get(config)?.[target.name];
  return applied && applied.output === target.source ? applied.source : target.source;
}

// A copy of a config this plugin already rewrote carries no record of its sources. Its icons are this
// plugin's output; badging them again would stack a second badge and delete the first render.
function isBadgeOutput(projectRoot, source) {
  const relative = path.relative(path.resolve(projectRoot, OUTPUT_DIR), path.resolve(projectRoot, source));
  return relative.length > 0 && !relative.startsWith('..') && !path.isAbsolute(relative);
}

function getOutputPath(projectRoot, target, badges) {
  const hash = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.resolve(projectRoot, target.source)))
    .update(JSON.stringify({ badges, isAdaptiveIcon: target.isAdaptiveIcon, renderer: RENDERER_VERSION }))
    .digest('hex')
    .slice(0, 12);

  return path.join(OUTPUT_DIR, `${target.name}-${hash}.png`);
}

function renderBadges(projectRoot, targets, badges) {
  const outputDir = path.resolve(projectRoot, OUTPUT_DIR);
  fs.mkdirSync(outputDir, { recursive: true });

  const jobs = targets.map((target) => {
    const finalPath = path.resolve(projectRoot, target.output);
    return {
      icon: path.resolve(projectRoot, target.source),
      dstPath: finalPath.replace(/\.png$/, '.partial.png'),
      finalPath,
      badges,
      isAdaptiveIcon: target.isAdaptiveIcon,
    };
  });

  // addBadge() does not await its own write, so the files are only complete once the child exits.
  execFileSync(process.execPath, [__filename, JSON.stringify(jobs)], { stdio: ['ignore', 'ignore', 'inherit'] });

  jobs.forEach((job) => fs.renameSync(job.dstPath, job.finalPath));

  targets.forEach((target) => {
    const current = path.basename(target.output);
    fs.readdirSync(outputDir)
      .filter((file) => file.startsWith(`${target.name}-`) && file !== current)
      .forEach((file) => fs.rmSync(path.join(outputDir, file), { force: true }));
  });
}

const withIconBadge = (config, { enabled = true, badges = [] } = {}) => {
  if (!enabled || badges.length === 0) {
    return config;
  }

  const projectRoot = config._internal?.projectRoot ?? process.cwd();
  const targets = getIconTargets(config)
    .map((target) => ({ ...target, source: resolveSource(config, target) }))
    .filter((target) => !isBadgeOutput(projectRoot, target.source))
    .map((target) => ({ ...target, output: getOutputPath(projectRoot, target, badges) }));
  const pending = targets.filter((target) => !fs.existsSync(path.resolve(projectRoot, target.output)));

  if (pending.length > 0) {
    renderBadges(projectRoot, pending, badges);
  }

  targets.forEach((target) => target.apply(target.output));
  appliedIcons.set(config, { ...appliedIcons.get(config), ...Object.fromEntries(targets.map((target) => [target.name, { source: target.source, output: target.output }])) });
  return config;
};

module.exports = withIconBadge;

if (require.main === module) {
  const { addBadge } = require('app-icon-badge');
  const jobs = JSON.parse(process.argv[2]);

  Promise.all(jobs.map(({ icon, dstPath, badges, isAdaptiveIcon }) => addBadge({ icon, dstPath, badges, isAdaptiveIcon }))).catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
