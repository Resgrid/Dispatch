import { addResourceBundleDeploymentTarget } from '../withResourceBundleDeploymentTarget';

const podfile = `target 'ResgridDispatch' do
  post_install do |installer|
    react_native_post_install(installer)
  end
end
`;

describe('addResourceBundleDeploymentTarget', () => {
  it('raises resource bundles inside the post_install hook', () => {
    const lines = addResourceBundleDeploymentTarget(podfile).split('\n');
    const hookLine = lines.findIndex((line) => line.includes('post_install do |installer|'));

    expect(lines[hookLine + 1]).toContain('@generated begin resgrid-resource-bundle-deployment-target');
    expect(lines.join('\n')).toContain('result.resource_bundle_targets.each');
    expect(lines.join('\n')).toContain("build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_version_supported");
    expect(lines.findIndex((line) => line.includes('react_native_post_install'))).toBeGreaterThan(hookLine);
  });

  it('only adds the block once across repeated prebuilds', () => {
    const once = addResourceBundleDeploymentTarget(podfile);
    const twice = addResourceBundleDeploymentTarget(once);

    expect(twice).toBe(once);
    expect(twice.match(/resource_bundle_targets/g)).toHaveLength(1);
  });
});
