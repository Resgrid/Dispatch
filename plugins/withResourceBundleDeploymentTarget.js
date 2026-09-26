/* eslint-env node */
const { withPodfile } = require('@expo/config-plugins');
const { mergeContents } = require('@expo/config-plugins/build/utils/generateCode');

/**
 * Raises the iOS deployment target of CocoaPods resource-bundle targets to React Native's floor.
 *
 * `react_native_post_install` lifts every pod's native target to `min_ios_version_supported`, but
 * skips the resource bundles that pods such as MapboxMaps, RNSVG and react-native-permissions
 * declare. Those keep their podspec minimum (12.4 / 14.0), which Xcode 27 rejects outright — its
 * supported range starts at iOS 15.0 — failing the build with "IPHONEOS_DEPLOYMENT_TARGET is set to 12.4".
 */

const POST_INSTALL_BLOCK = `    installer.target_installation_results.pod_target_installation_results.each_value do |result|
      result.resource_bundle_targets.each do |bundle_target|
        bundle_target.build_configurations.each do |build_config|
          deployment_target = build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
          next if deployment_target.nil? || deployment_target.to_f >= min_ios_version_supported.to_f

          build_config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = min_ios_version_supported
        end
      end
    end`;

function addResourceBundleDeploymentTarget(podfile) {
  return mergeContents({
    tag: 'resgrid-resource-bundle-deployment-target',
    src: podfile,
    newSrc: POST_INSTALL_BLOCK,
    anchor: /^\s*post_install do \|installer\|/,
    offset: 1,
    comment: '#',
  }).contents;
}

const withResourceBundleDeploymentTarget = (config) =>
  withPodfile(config, (podfileConfig) => {
    podfileConfig.modResults.contents = addResourceBundleDeploymentTarget(podfileConfig.modResults.contents);
    return podfileConfig;
  });

module.exports = withResourceBundleDeploymentTarget;
module.exports.addResourceBundleDeploymentTarget = addResourceBundleDeploymentTarget;
