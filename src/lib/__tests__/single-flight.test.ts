import { singleFlight } from '../single-flight';

/** A promise the test settles by hand, so it can place callers before, during and after a run. */
const deferred = <T = void>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe('singleFlight', () => {
  it('collapses concurrent callers into one execution and one trailing re-run', async () => {
    let calls = 0;
    const gates = [deferred(), deferred()];

    const wrapped = singleFlight(async () => {
      calls += 1;
      const call = calls;
      await gates[call - 1].promise;
      return call;
    });

    // Four panels asking for the same data set at once -- the first starts the request, the other
    // three share the single trailing run.
    const results = Promise.all([wrapped(), wrapped(), wrapped(), wrapped()]);
    expect(calls).toBe(1);

    gates[0].resolve();
    gates[1].resolve();

    expect(await results).toEqual([1, 2, 2, 2]);
    expect(calls).toBe(2);
  });

  it('does not start the trailing run until the in-flight one settles', async () => {
    let calls = 0;
    let concurrent = 0;
    let maxConcurrent = 0;
    const gates = [deferred(), deferred()];

    const wrapped = singleFlight(async () => {
      calls += 1;
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      try {
        await gates[calls - 1].promise;
        return calls;
      } finally {
        concurrent -= 1;
      }
    });

    const first = wrapped();
    const second = wrapped();

    // Let any eagerly-scheduled work run; the trailing run must still be waiting.
    await Promise.resolve();
    await Promise.resolve();
    expect(calls).toBe(1);

    gates[0].resolve();
    await expect(first).resolves.toBe(1);

    gates[1].resolve();
    await expect(second).resolves.toBe(2);
    expect(maxConcurrent).toBe(1);
  });

  it('picks up a change saved after the in-flight request left', async () => {
    // The server state the fetch reads. A unit status saved mid-fetch must reach the store.
    let serverStatus = 'Dispatched';
    const firstGate = deferred();
    let calls = 0;

    const wrapped = singleFlight(async () => {
      calls += 1;
      const snapshot = serverStatus;
      if (calls === 1) {
        await firstGate.promise;
      }
      return snapshot;
    });

    const mount = wrapped();
    serverStatus = 'Enroute';
    // The push for that save arrives while the first request is still out.
    const pushRefresh = wrapped();

    firstGate.resolve();

    await expect(mount).resolves.toBe('Dispatched');
    await expect(pushRefresh).resolves.toBe('Enroute');
  });

  it('starts a fresh execution once the previous one settles', async () => {
    let calls = 0;
    const wrapped = singleFlight(async () => {
      calls += 1;
      return calls;
    });

    await expect(wrapped()).resolves.toBe(1);
    await expect(wrapped()).resolves.toBe(2);
    expect(calls).toBe(2);
  });

  it('starts fresh after a trailing run settles', async () => {
    let calls = 0;
    const gate = deferred();
    const wrapped = singleFlight(async () => {
      calls += 1;
      if (calls === 1) {
        await gate.promise;
      }
      return calls;
    });

    const first = wrapped();
    const trailing = wrapped();
    gate.resolve();

    await expect(first).resolves.toBe(1);
    await expect(trailing).resolves.toBe(2);

    // Nothing in flight and nothing queued: a new caller gets its own run, not a replay.
    await expect(wrapped()).resolves.toBe(3);
    expect(calls).toBe(3);
  });

  it('releases the in-flight slot when the call rejects', async () => {
    let calls = 0;
    const wrapped = singleFlight(async () => {
      calls += 1;
      throw new Error(`boom ${calls}`);
    });

    await expect(wrapped()).rejects.toThrow('boom 1');
    // A failed refresh must not wedge the slot shut for the rest of the session.
    await expect(wrapped()).rejects.toThrow('boom 2');
  });

  it('releases the slot when the function throws synchronously', async () => {
    let calls = 0;
    const wrapped = singleFlight((() => {
      calls += 1;
      throw new Error(`sync boom ${calls}`);
    }) as () => Promise<number>);

    await expect(wrapped()).rejects.toThrow('sync boom 1');
    await expect(wrapped()).rejects.toThrow('sync boom 2');
  });

  it('still runs the trailing call after the in-flight one rejects', async () => {
    let calls = 0;
    const gate = deferred();
    const wrapped = singleFlight(async () => {
      calls += 1;
      if (calls === 1) {
        await gate.promise;
        throw new Error('boom');
      }
      return calls;
    });

    const first = wrapped();
    const second = wrapped();
    const third = wrapped();

    gate.resolve();

    // The in-flight caller sees its own failure; the queued callers get the trailing run's answer.
    await expect(first).rejects.toThrow('boom');
    await expect(second).resolves.toBe(2);
    await expect(third).resolves.toBe(2);
    expect(calls).toBe(2);
  });

  it('shares a trailing rejection with every queued caller', async () => {
    let calls = 0;
    const gate = deferred();
    const wrapped = singleFlight(async () => {
      calls += 1;
      if (calls === 1) {
        await gate.promise;
        return 'ok';
      }
      throw new Error('trailing boom');
    });

    const first = wrapped();
    const a = wrapped();
    const b = wrapped();

    gate.resolve();

    await expect(first).resolves.toBe('ok');
    await expect(a).rejects.toThrow('trailing boom');
    await expect(b).rejects.toThrow('trailing boom');
    expect(calls).toBe(2);

    // And the wrapper is usable afterwards.
    await expect(wrapped()).rejects.toThrow('trailing boom');
    expect(calls).toBe(3);
  });
});
