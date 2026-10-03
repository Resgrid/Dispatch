import { Env } from '@/lib/env';

/** The Mapbox token built into this app; used whenever the server has not supplied a verified one. */
export const MAPBOX_BUILT_IN_TOKEN: string = Env.MAPBOX_PUBKEY ?? '';
