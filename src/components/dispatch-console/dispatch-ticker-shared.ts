/** Type → badge appearance for the dispatched-resources ticker. */
export const getDispatchTypeStyle = (type: string): { bg: string; fg: string; label: string } => {
  const t = (type || '').toLowerCase();
  if (t.includes('user') || t.includes('personnel')) return { bg: '#2563eb', fg: '#ffffff', label: 'P' };
  if (t.includes('unit')) return { bg: '#d97706', fg: '#ffffff', label: 'U' };
  if (t.includes('group')) return { bg: '#059669', fg: '#ffffff', label: 'G' };
  if (t.includes('role')) return { bg: '#7c3aed', fg: '#ffffff', label: 'R' };
  return { bg: '#6b7280', fg: '#ffffff', label: '•' };
};

/** Deduplicate dispatches by Id, falling back to Type+Name. */
export const dedupeDispatches = <T extends { Id: string; Type: string; Name: string }>(dispatches: T[]): T[] => {
  const seen = new Set<string>();
  return dispatches.filter((d) => {
    const key = d.Id || `${d.Type}:${d.Name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
