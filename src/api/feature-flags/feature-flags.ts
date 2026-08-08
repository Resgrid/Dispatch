import { api } from '../common/client';

const FEATURE_TOGGLES = '/FeatureToggles';

// ---------------------------------------------------------------------------
// Feature toggle evaluation (department-scoped, any authenticated user).
// Backed by the v4 FeatureToggles API; keys live in Resgrid.Model.FeatureFlagKeys.
// ---------------------------------------------------------------------------

export interface FeatureToggleData {
  Key: string;
  Enabled: boolean;
  Value?: string | null;
  ValueType?: string | null;
  Source?: string | null;
}

export interface FeatureTogglesResult {
  Data?: FeatureToggleData[];
  StateHash?: string;
}

export interface FeatureToggleResult {
  Data?: FeatureToggleData;
}

/** Evaluates every active flag for the caller's department. */
export const getAllFeatureFlags = async (signal?: AbortSignal) => {
  const response = await api.get<FeatureTogglesResult>(`${FEATURE_TOGGLES}/GetAll`, { signal });
  return response.data;
};

/** Lightweight enabled-only check for a single flag. */
export const getFeatureFlagState = async (key: string, signal?: AbortSignal) => {
  const response = await api.get<FeatureToggleResult>(`${FEATURE_TOGGLES}/GetState`, { params: { key }, signal });
  return response.data;
};
