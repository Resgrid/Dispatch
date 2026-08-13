/**
 * Native stylesheet entry. Pairs with theme-styles.web.ts, which loads global.web.css instead.
 *
 * The two entries exist because the `dark:` variant cannot be shared: native drives it from the
 * colour-scheme media query (it has no theme class, and adding one to the app-wide wrapper View
 * breaks native scrolling), while web drives it from the .dark class on <html>. Tokens are shared
 * via theme-tokens.css.
 */
import '../../global.css';
