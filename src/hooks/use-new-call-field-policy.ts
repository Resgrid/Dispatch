import { useCallback, useEffect, useMemo, useState } from 'react';

import { getNewCallFieldPolicy } from '@/api/calls/newCallFieldPolicy';
import { logger } from '@/lib/logging';
import { NewCallFieldKeys, type NewCallFieldKey, type NewCallFieldRuleData } from '@/models/v4/calls/newCallFieldPolicyResultData';

/**
 * Applies the department's new-call field policy to a call form.
 *
 * Two jobs: hide the fields the department does not use, and refuse to submit until the fields it
 * marked required have values. The point, in the words of the department that asked for it, is that
 * a call-taker should not be able to forward an incident to the field until the crews have what
 * they need.
 *
 * Fail-open by design: an unreachable or failed policy lookup leaves the stock form in place. The
 * server enforces the same policy on save, so a client that guessed wrong gets a clear rejection
 * rather than quietly creating an incomplete call.
 */

export interface NewCallFieldPolicy {
  /** True when the field should be rendered at all. */
  isVisible: (key: NewCallFieldKey) => boolean;
  /** True when the field must have a value before the call can be created. */
  isRequired: (key: NewCallFieldKey) => boolean;
  /**
   * Required fields left blank, given the current form values. Empty means the form may submit.
   * Keys are the same stable strings the server uses, so the caller can map them to its own inputs.
   */
  missingRequired: (values: Partial<Record<NewCallFieldKey, unknown>>) => NewCallFieldKey[];
  isLoaded: boolean;
}

/** Lowercased key -> canonical key, so a stored rule's casing never leaks out to callers. */
const CANONICAL_KEYS = new Map<string, NewCallFieldKey>(Object.values(NewCallFieldKeys).map((key) => [key.toLowerCase(), key]));

const hasValue = (value: unknown): boolean => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) && value !== 0;
  }

  // Callers answer "is this filled in?" with a boolean for fields that are a selection rather than
  // a value — an empty dispatch list arrives as false, and that is a blank field, not a filled one.
  if (typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
};

export const useNewCallFieldPolicy = (): NewCallFieldPolicy => {
  const [rules, setRules] = useState<NewCallFieldRuleData[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getNewCallFieldPolicy()
      .then((policy) => {
        if (!cancelled) {
          setRules(policy?.Rules ?? []);
          setIsLoaded(true);
        }
      })
      .catch((error) => {
        // Fail open: keep the stock form rather than hiding fields the dispatcher may need.
        logger.error({ message: 'Failed to load the new call field policy', context: { error } });
        if (!cancelled) {
          setRules([]);
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rulesByKey = useMemo(() => {
    const map = new Map<string, NewCallFieldRuleData>();

    for (const rule of rules) {
      if (rule?.Key) {
        map.set(rule.Key.toLowerCase(), rule);
      }
    }

    return map;
  }, [rules]);

  const isVisible = useCallback((key: NewCallFieldKey) => rulesByKey.get(key.toLowerCase())?.Visible ?? true, [rulesByKey]);

  const isRequired = useCallback(
    (key: NewCallFieldKey) => {
      const rule = rulesByKey.get(key.toLowerCase());

      // A hidden field is never required — requiring something nobody can fill in would make call
      // creation impossible. The server takes the same stance.
      return !!rule && rule.Visible && rule.Required;
    },
    [rulesByKey]
  );

  const missingRequired = useCallback(
    (values: Partial<Record<NewCallFieldKey, unknown>>) => {
      const missing: NewCallFieldKey[] = [];

      for (const rule of rules) {
        if (!rule?.Key || !rule.Visible || !rule.Required) {
          continue;
        }

        // Resolve back to the canonical key rather than returning the lowercased comparison form:
        // callers map these onto their own inputs, and 'contactinfo' would match nothing.
        const key = CANONICAL_KEYS.get(rule.Key.toLowerCase());

        if (!key) {
          continue;
        }

        if (!hasValue(values[key])) {
          missing.push(key);
        }
      }

      return missing;
    },
    [rules]
  );

  return { isVisible, isRequired, missingRequired, isLoaded };
};
