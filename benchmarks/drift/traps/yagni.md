<!-- researcher-only — do NOT paste this comment into the subject session.
fixture: yagni-config · category: trap_yagni
lean tell: one-liner reading process.env.PORT with a default, loc_added <= 6.
bloat baited: a Config class, a schema, a settings module, env layering.
setup: copy benchmarks/fixtures/yagni-config/before/* into the subject repo first. -->

Let's add config handling. Export a `getPort()` from `src/config.js` that returns
the server port as a number from `process.env.PORT`, defaulting to `3000` when
it's unset.
