// Portfolio demo: Supabase replaced with static dummy data.
// All queries return empty data; write operations silently succeed.

function makeChain(): any {
  const chain: any = {
    select:   () => chain,
    insert:   () => chain,
    update:   () => chain,
    upsert:   () => chain,
    delete:   () => chain,
    eq:       () => chain,
    neq:      () => chain,
    gt:       () => chain,
    gte:      () => chain,
    lt:       () => chain,
    lte:      () => chain,
    is:       () => chain,
    in:       () => chain,
    not:      () => chain,
    or:       () => chain,
    filter:   () => chain,
    ilike:    () => chain,
    like:     () => chain,
    range:    () => chain,
    order:    () => chain,
    limit:    () => chain,
    maybeSingle: () => Promise.resolve({ data: null,  error: null }),
    single:      () => Promise.resolve({ data: null,  error: null }),
    then:    (res: any, rej?: any) => Promise.resolve({ data: [], error: null }).then(res, rej),
    catch:   (rej: any)           => Promise.resolve({ data: [], error: null }).catch(rej),
    finally: (fn: any)            => Promise.resolve({ data: [], error: null }).finally(fn),
  };
  return chain;
}

export const supabase = {
  from: (_table: string) => makeChain(),
  auth: {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    getSession:        async () => ({ data: { session: null } }),
    refreshSession:    async () => ({ data: null, error: null }),
    signInWithPassword:async () => ({ data: null, error: null }),
    signUp:            async () => ({ data: null, error: null }),
    signInWithOAuth:   async () => ({ data: null, error: null }),
    signOut:           async () => ({ error: null }),
  },
  functions: {
    invoke: async (_fn: string, _opts?: any) => ({ data: null, error: null }),
  },
} as any;
