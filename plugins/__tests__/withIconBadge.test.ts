import type { AppIconBadgeConfig } from 'app-icon-badge/types';
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import withIconBadge from '../withIconBadge';

jest.mock('child_process', () => ({ execFileSync: jest.fn() }));

interface RenderJob {
  icon: string;
  dstPath: string;
  isAdaptiveIcon: boolean;
}

interface TestConfig {
  _internal: { projectRoot: string };
  icon: string;
  ios: { icon: string | Record<string, string> };
  android: { adaptiveIcon: { foregroundImage: string } };
}

const mockExecFileSync = execFileSync as jest.MockedFunction<typeof execFileSync>;
const badges: AppIconBadgeConfig['badges'] = [{ text: 'development', type: 'banner', color: 'white' }];
const outputDir = path.join('.expo', 'app-icon-badge');

describe('withIconBadge', () => {
  let projectRoot: string;

  const createConfig = (): TestConfig => ({
    _internal: { projectRoot },
    icon: './assets/icon.png',
    ios: { icon: './assets/ios-icon.png' },
    android: { adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png' } },
  });

  const applyPlugin = (config: TestConfig, options: AppIconBadgeConfig): TestConfig => withIconBadge(config, options);

  const getRenderJobs = (call: number): RenderJob[] => JSON.parse((mockExecFileSync.mock.calls[call][1] as string[])[1]);

  beforeEach(() => {
    projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'icon-badge-'));
    fs.mkdirSync(path.join(projectRoot, 'assets'));
    ['icon.png', 'ios-icon.png', 'adaptive-icon.png'].forEach((file) => fs.writeFileSync(path.join(projectRoot, 'assets', file), file));

    mockExecFileSync.mockReset();
    mockExecFileSync.mockImplementation((_file, args) => {
      const jobs: RenderJob[] = JSON.parse((args as string[])[1]);
      jobs.forEach((job) => fs.writeFileSync(job.dstPath, 'badged'));
      return Buffer.from('');
    });
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  });

  it('leaves the config untouched when disabled', () => {
    const config = applyPlugin(createConfig(), { enabled: false, badges });

    expect(config.icon).toBe('./assets/icon.png');
    expect(mockExecFileSync).not.toHaveBeenCalled();
  });

  it('finishes rendering every icon before pointing the config at it', () => {
    const config = applyPlugin(createConfig(), { badges });
    const iconPaths = [config.icon, config.ios.icon as string, config.android.adaptiveIcon.foregroundImage];

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(getRenderJobs(0).map((job) => job.isAdaptiveIcon)).toEqual([false, false, true]);
    expect(new Set(iconPaths).size).toBe(3);
    iconPaths.forEach((iconPath) => {
      expect(iconPath.startsWith(outputDir)).toBe(true);
      expect(fs.readFileSync(path.join(projectRoot, iconPath), 'utf8')).toBe('badged');
    });
    expect(fs.readdirSync(path.join(projectRoot, outputDir)).filter((file) => file.includes('.partial.'))).toEqual([]);
  });

  it('reuses finished icons on repeated config evaluations', () => {
    const first = applyPlugin(createConfig(), { badges });
    const second = applyPlugin(createConfig(), { badges });

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect(second.icon).toBe(first.icon);
    expect(second.android.adaptiveIcon.foregroundImage).toBe(first.android.adaptiveIcon.foregroundImage);
  });

  it('does not badge its own output again when applied twice to the same config', () => {
    const config = applyPlugin(createConfig(), { badges });
    const badgedPaths = [config.icon, config.ios.icon as string, config.android.adaptiveIcon.foregroundImage];

    applyPlugin(config, { badges });

    expect(mockExecFileSync).toHaveBeenCalledTimes(1);
    expect([config.icon, config.ios.icon, config.android.adaptiveIcon.foregroundImage]).toEqual(badgedPaths);
    badgedPaths.forEach((iconPath) => expect(fs.existsSync(path.join(projectRoot, iconPath))).toBe(true));
  });

  it('renders an output deleted since the last application from the original icon, not its own output', () => {
    const config = applyPlugin(createConfig(), { badges });
    fs.rmSync(path.join(projectRoot, outputDir), { recursive: true, force: true });

    applyPlugin(config, { badges });

    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
    expect(getRenderJobs(1).map((job) => path.relative(projectRoot, job.icon))).toEqual([path.join('assets', 'icon.png'), path.join('assets', 'ios-icon.png'), path.join('assets', 'adaptive-icon.png')]);
    [config.icon, config.ios.icon as string, config.android.adaptiveIcon.foregroundImage].forEach((iconPath) => expect(fs.existsSync(path.join(projectRoot, iconPath))).toBe(true));
  });

  it('badges the original icon when the same config is applied again with a different badge', () => {
    const config = applyPlugin(createConfig(), { badges });
    const firstIcon = config.icon;

    applyPlugin(config, { badges: [{ ...badges[0], text: 'staging' }] });

    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
    expect(path.relative(projectRoot, getRenderJobs(1)[0].icon)).toBe(path.join('assets', 'icon.png'));
    expect(config.icon).not.toBe(firstIcon);
  });

  it('re-renders and removes the stale icons when a badge changes', () => {
    const first = applyPlugin(createConfig(), { badges });
    const second = applyPlugin(createConfig(), { badges: [{ ...badges[0], text: 'staging' }] });

    expect(mockExecFileSync).toHaveBeenCalledTimes(2);
    expect(second.icon).not.toBe(first.icon);
    expect(fs.existsSync(path.join(projectRoot, first.icon))).toBe(false);
    expect(fs.existsSync(path.join(projectRoot, second.icon))).toBe(true);
  });

  it('throws rather than pointing at an unfinished icon when rendering fails', () => {
    mockExecFileSync.mockImplementation(() => {
      throw new Error('render failed');
    });

    expect(() => applyPlugin(createConfig(), { badges })).toThrow('render failed');
  });

  it('leaves non-path icon values alone', () => {
    const iosIcon = { light: './assets/ios-icon.png' };
    const config = applyPlugin({ ...createConfig(), ios: { icon: iosIcon } }, { badges });

    expect(config.ios.icon).toBe(iosIcon);
    expect(getRenderJobs(0)).toHaveLength(2);
  });
});
