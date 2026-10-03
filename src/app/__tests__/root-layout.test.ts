import fs from 'fs';
import path from 'path';

// A web sign-in popup comes back to the page its redirect names (/login/sso here), and a production web build loads a
// route's module only when that route is shown, so the sign-in hooks' own module may never load in the popup. The root
// layout loads on every page: it must complete the popup. Every other import of the layout is stubbed, so this loads
// only the layout's own module code.
const stub = (): unknown =>
  new Proxy(function stubbed() {}, {
    get: (_target, key) => {
      if (key === '__esModule') return true;
      if (key === Symbol.toPrimitive) return () => '';
      if (key === 'then' || typeof key === 'symbol') return undefined;
      return stub();
    },
    apply: () => stub(),
    construct: () => stub() as object,
  });

const layoutImports = (layoutPath: string): string[] => {
  const source = fs.readFileSync(layoutPath, 'utf8');
  const specifiers = new Set<string>();
  for (const match of source.matchAll(/^\s*(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s+)?['"]([^'"]+)['"]/gm)) {
    specifiers.add(match[1]);
  }
  return [...specifiers];
};

describe('root layout', () => {
  it('completes a pending web sign-in on whatever page the popup returns to', () => {
    const layoutPath = path.join(__dirname, '..', '_layout.tsx');
    const maybeCompleteAuthSession = jest.fn();

    // The setup file's mocks are already built, and a built mock wins over a later doMock until the registry is reset.
    jest.resetModules();
    jest.isolateModules(() => {
      for (const specifier of layoutImports(layoutPath)) {
        if (specifier === 'react') continue;
        const target = specifier.startsWith('.') ? path.resolve(path.dirname(layoutPath), specifier) : specifier;
        const factory = specifier === 'expo-web-browser' ? () => ({ __esModule: true, maybeCompleteAuthSession }) : stub;
        try {
          jest.doMock(target, factory);
        } catch {
          jest.doMock(target, factory, { virtual: true });
        }
      }
      require(layoutPath);
    });

    expect(maybeCompleteAuthSession).toHaveBeenCalledTimes(1);
  });
});
