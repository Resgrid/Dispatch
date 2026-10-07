/**
 * Collapses concurrent calls into one in-flight execution plus at most one trailing re-run.
 *
 * The dispatch console refreshes the same data set from several places at once -- the screen's focus
 * effect, the resources and unit-actions panels, the status sheet after a save, and every SignalR push
 * -- and each one would otherwise start its own full refetch, all writing the same result into the
 * same store. Wrapping the store action means those callers share requests instead.
 *
 * A caller that arrives while a request is already out is not handed that request: it may be
 * refreshing because of a change saved after the request left, and the in-flight answer would not
 * include it (a unit status set mid-fetch stayed stale on the board until the next push). Instead it
 * is queued behind one trailing run that starts as soon as the current one settles, and it resolves
 * or rejects with that run's result. Every mid-flight caller shares the same trailing run, so a
 * burst still costs at most two requests.
 *
 * Callers that arrive after everything settles start a fresh one, so this is deduplication, not
 * caching. A rejected run releases the slot like a successful one, and a queued trailing run still
 * goes out after a failure.
 */
export function singleFlight<T>(fn: () => Promise<T>): () => Promise<T> {
  let inFlight: Promise<T> | null = null;
  let trailing: Promise<T> | null = null;
  let startTrailing: (() => void) | null = null;

  const start = (): Promise<T> => {
    let result: Promise<T>;
    try {
      result = Promise.resolve(fn());
    } catch (error) {
      result = Promise.reject(error);
    }

    const current = result.finally(() => {
      inFlight = null;

      // Hand the slot straight to the queued run, in the same tick, so no other caller can slip in
      // between and start a second concurrent request.
      const next = startTrailing;
      startTrailing = null;
      trailing = null;
      next?.();
    });

    inFlight = current;
    return current;
  };

  return () => {
    if (!inFlight) {
      return start();
    }

    if (!trailing) {
      trailing = new Promise<T>((resolve, reject) => {
        startTrailing = () => {
          start().then(resolve, reject);
        };
      });
    }

    return trailing;
  };
}
