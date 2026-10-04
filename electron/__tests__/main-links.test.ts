/**
 * The desktop app's main process hands its scheme's links to the waiting legacy sign-in (electron/main.js): the scheme is
 * registered, macOS's open-url and a second instance's argv (Windows, Linux) both reach it, and only one instance runs.
 * Electron itself is a stand-in here; the main process's own handlers run.
 *
 * @jest-environment node
 */

const mockAppEvents: Record<string, (...args: unknown[]) => void> = {};
const mockIpcHandlers: Record<string, (...args: unknown[]) => unknown> = {};
const mockApp = {
  on: jest.fn((event: string, handler: (...args: unknown[]) => void) => {
    mockAppEvents[event] = handler;
  }),
  setAsDefaultProtocolClient: jest.fn(),
  requestSingleInstanceLock: jest.fn(() => true),
  // Never ready: no window is made in this test.
  whenReady: jest.fn(() => new Promise(() => undefined)),
  quit: jest.fn(),
  isPackaged: true,
  name: 'Resgrid Dispatch',
  // Desktop push keeps its receiver state here (push-receiver.js); nothing is written in this test.
  getPath: jest.fn(() => '/nonexistent/resgrid-dispatch'),
  isReady: jest.fn(() => false),
  setAppUserModelId: jest.fn(),
};
const mockShell = { openExternal: jest.fn(async () => undefined) };
const mockWindow = {
  on: jest.fn(),
  once: jest.fn(),
  loadURL: jest.fn(),
  isMinimized: () => false,
  restore: jest.fn(),
  focus: jest.fn(),
  show: jest.fn(),
  webContents: { on: jest.fn(), send: jest.fn(), setWindowOpenHandler: jest.fn(), isLoading: () => false, openDevTools: jest.fn() },
};

jest.mock(
  'electron',
  () => ({
    app: mockApp,
    BrowserWindow: Object.assign(
      jest.fn(() => mockWindow),
      { getAllWindows: () => [] }
    ),
    ipcMain: {
      handle: (channel: string, handler: (...args: unknown[]) => unknown) => {
        mockIpcHandlers[channel] = handler;
      },
      on: jest.fn(),
    },
    Notification: { isSupported: () => false },
    nativeTheme: { shouldUseDarkColors: false },
    Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
    protocol: { registerSchemesAsPrivileged: jest.fn(), handle: jest.fn() },
    net: { fetch: jest.fn() },
    shell: mockShell,
  }),
  { virtual: true }
);
jest.mock('electron-squirrel-startup', () => false, { virtual: true });

const START = 'https://api.resgrid.com/api/v4/connect/saml-mobile-login?departmentToken=enc&RelayState=dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13';
const RETURN = 'resgriddispatch://auth/callback?saml_response=saml-relay%3Aabc&department_token=enc&relay_state=dispatch.3f2b8c1e-5d7a-4e9b-8a61-0c4d2e7f9b13';
const tick = () => new Promise((resolve) => setImmediate(resolve));

describe('main process: the app scheme reaches the waiting legacy sign-in', () => {
  beforeAll(() => {
    jest.isolateModules(() => {
      require('../main');
    });
  });

  it("registers this app's scheme and holds the single-instance lock", () => {
    expect(mockApp.setAsDefaultProtocolClient).toHaveBeenCalledWith('ResgridDispatch');
    expect(mockApp.requestSingleInstanceLock).toHaveBeenCalled();
    expect(mockApp.quit).not.toHaveBeenCalled();
    expect(Object.keys(mockIpcHandlers)).toEqual(expect.arrayContaining(['legacy-sso:oidc', 'legacy-sso:saml', 'legacy-sso:cancel']));
    // Desktop push is wired up beside it.
    expect(Object.keys(mockIpcHandlers)).toEqual(expect.arrayContaining(['push:start', 'push:stop', 'push:take-pending-click']));
  });

  it("takes the return from macOS's open-url", async () => {
    const signIn = mockIpcHandlers['legacy-sso:saml']({}, START) as Promise<unknown>;
    await tick();
    expect(mockShell.openExternal).toHaveBeenLastCalledWith(START);

    const event = { preventDefault: jest.fn() };
    mockAppEvents['open-url'](event, RETURN);
    expect(event.preventDefault).toHaveBeenCalled();
    await expect(signIn).resolves.toEqual({ ok: true, url: RETURN });
  });

  it("takes the return from a second instance's arguments on Windows and Linux", async () => {
    const signIn = mockIpcHandlers['legacy-sso:saml']({}, START) as Promise<unknown>;
    await tick();

    mockAppEvents['second-instance']({}, ['C:\\Program Files\\Resgrid Dispatch\\Resgrid Dispatch.exe', '--flag', RETURN]);
    await expect(signIn).resolves.toEqual({ ok: true, url: RETURN });
  });

  it('a second launch without a link ends nothing', async () => {
    const signIn = mockIpcHandlers['legacy-sso:saml']({}, START) as Promise<unknown>;
    await tick();
    mockAppEvents['second-instance']({}, ['Resgrid Dispatch.exe']);
    mockAppEvents['open-url']({ preventDefault: jest.fn() }, 'resgriddispatch://calls/42');

    mockIpcHandlers['legacy-sso:cancel']({});
    await expect(signIn).resolves.toEqual({ ok: false, reason: 'cancelled' });
  });

  it("passes the page every other link, as before, and never the sign-in's return", () => {
    mockAppEvents['open-url']({ preventDefault: jest.fn() }, 'resgriddispatch://calls/42');
    expect(mockWindow.webContents.send).toHaveBeenCalledWith('deep-link', 'resgriddispatch://calls/42');
    expect(mockWindow.webContents.send).not.toHaveBeenCalledWith('deep-link', RETURN);
  });
});

describe('main process: a second instance', () => {
  it('quits once it has handed its link to the first', () => {
    mockApp.requestSingleInstanceLock.mockReturnValueOnce(false);
    mockApp.quit.mockClear();
    jest.isolateModules(() => {
      require('../main');
    });
    expect(mockApp.quit).toHaveBeenCalled();
  });
});
