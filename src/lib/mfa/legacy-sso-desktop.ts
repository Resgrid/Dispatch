// ---------------------------------------------------------------------------
// Legacy (unbrokered) SSO in the desktop app (electron/legacy-sso.js). The provider and the server's SAML relay return to
// this app's own scheme, which only the OS can hand to the app, and a page served from app:// cannot redeem a desktop
// app's OIDC code. So the main process runs the provider's sign-in in the member's own browser and answers with the
// id_token (OIDC) or the relay's link (SAML, which the page still checks against its own RelayState).
// ---------------------------------------------------------------------------

export type DesktopLegacySsoFailure = { ok: false; reason: 'cancelled' | 'denied' | 'failed'; code?: string };

export interface DesktopLegacySso {
  /** With reauthenticate (a shared installation), the provider must authenticate the member again. */
  legacySsoOidc: (authority: string, clientId: string, reauthenticate?: boolean) => Promise<{ ok: true; idToken: string } | DesktopLegacySsoFailure>;
  legacySsoSaml: (signInUrl: string) => Promise<{ ok: true; url: string } | DesktopLegacySsoFailure>;
  legacySsoCancel: () => Promise<void>;
}

/** The desktop app's bridge; null everywhere else. */
export const desktopLegacySso = (): DesktopLegacySso | null => {
  const bridge = typeof window !== 'undefined' ? (window as unknown as { electronAPI?: Partial<DesktopLegacySso> }).electronAPI : undefined;
  return bridge?.legacySsoOidc && bridge.legacySsoSaml && bridge.legacySsoCancel ? (bridge as DesktopLegacySso) : null;
};
