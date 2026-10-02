import { desktopLegacySso } from '../legacy-sso-desktop';

type Bridge = Record<string, unknown>;
const setBridge = (bridge: Bridge | undefined) => {
  (window as unknown as { electronAPI?: Bridge }).electronAPI = bridge;
};

describe('desktopLegacySso', () => {
  afterEach(() => setBridge(undefined));

  it("is the desktop app's bridge only when its preload offers all three legacy SSO calls", () => {
    expect(desktopLegacySso()).toBeNull();

    // An older desktop build: brokered SSO only.
    const brokered = { ssoListen: jest.fn(), ssoOpen: jest.fn(), ssoCancel: jest.fn() };
    setBridge(brokered);
    expect(desktopLegacySso()).toBeNull();

    setBridge({ ...brokered, legacySsoOidc: jest.fn(), legacySsoSaml: jest.fn() });
    expect(desktopLegacySso()).toBeNull();
    setBridge({ ...brokered, legacySsoOidc: jest.fn(), legacySsoCancel: jest.fn() });
    expect(desktopLegacySso()).toBeNull();
    setBridge({ ...brokered, legacySsoSaml: jest.fn(), legacySsoCancel: jest.fn() });
    expect(desktopLegacySso()).toBeNull();

    const full = { ...brokered, legacySsoOidc: jest.fn(), legacySsoSaml: jest.fn(), legacySsoCancel: jest.fn() };
    setBridge(full);
    expect(desktopLegacySso()).toBe(full);
  });
});
