import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Guards `patches/react-native-webview+13.15.0.patch`.
 *
 * `RNCWebViewDecisionManager` is a process-wide singleton whose `decisionHandlers`
 * dictionary is written from the main thread (`WKNavigationDelegate` storing a handler)
 * and read from a bridge worker thread (`shouldStartLoadWithLockIdentifier` resolving one
 * from JS). Unsynchronized, a lookup could probe buckets while the dictionary rehashed and
 * send `isEqual:` to a freed key — `EXC_BAD_ACCESS ... KERN_INVALID_ADDRESS`, which crashed
 * the app when a WebView screen was torn down mid-navigation.
 *
 * Upstream fixed this in 14.0.1, but Expo SDK 54 pins react-native-webview to exactly
 * 13.15.0, so the fix is backported verbatim rather than taken by upgrade.
 * Losing the patch — to a `yarn install`, or to an Expo bump that lands a version still
 * carrying the race — brings the crash straight back.
 */
describe('react-native-webview decision manager patch', () => {
  const source = readFileSync(join(process.cwd(), 'node_modules/react-native-webview/apple/RNCWebViewDecisionManager.m'), 'utf8');

  it('serialises access to the shared decision handler map', () => {
    expect(source).toContain('@synchronized (self)');
    // Both entry points must hold the lock, not just the reader.
    expect(source.match(/@synchronized \(self\)/g)).toHaveLength(2);
  });

  it('invokes the handler outside the lock so a re-entrant navigation cannot deadlock', () => {
    // The entry is removed inside the lock, then the closing brace, then the call.
    expect(source).toMatch(/removeObjectForKey:@\(lockIdentifier\)\];\s*\}\s*handler\(shouldStart\);/);
  });
});
