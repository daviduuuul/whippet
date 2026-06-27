# Worked example: the "http hook missing url" check

A complete, real end-to-end addition of one `error` check, touching all four pieces. This is the
canonical shape to mirror. The check: an http-type hook with no `url` can never fire, so it is
inert — exactly parallel to a command hook with no `command` (which whippet already flags).

## 1. Engine — `whippet/scripts/config-audit.js`

Inside `checkStructured`, in the loop over each hook entry `h` of an event, right next to the
`hook missing command` check:

```js
if (h && h.type === 'http' && !h.url) {
  add('error', 'hooks', `http hook missing url: ${event}`,
    'an http-type hook has no url to call, so it never fires',
    'add a url or remove the hook', `${label}:hooks.${event}`);
  continue;
}
```

Why this is FP-safe:
- `h &&` guards a `null` entry; reading `.type`/`.url` off a non-object is then impossible.
- It fires **only** when the type is *explicitly* `'http'` **and** `url` is falsy. A command hook,
  a typo'd type, or an http hook *with* a url all skip it — no valid config is touched.
- The message states a verifiable runtime fact ("never fires"), confirmed against the hooks docs.

## 2. Unit tests — `whippet/scripts/config-audit.test.js`

Positive + false-positive probe. (A malformed-input case is covered by the shared no-throw tests.)

```js
{ // HT1 http-type hook with no url -> error (parallel to a command hook with no command)
  const r = run({ settings: { hooks: { PreToolUse: [{ hooks: [{ type: 'http' }] }] } } });
  ck('HT1 http hook missing url -> error', hasFinding(r, 'hooks', 'http hook missing url: PreToolUse'));
}
{ // HT2 http hook with a url -> clean (FP guard)
  const r = run({ settings: { hooks: { PreToolUse: [{ hooks: [{ type: 'http', url: 'https://hooks.example.com/x' }] }] } } });
  ck('HT2 http hook with url -> no finding', !hasFinding(r, 'hooks', 'http hook missing url'));
}
```

Note the FP probe (HT2) uses a **synthetic placeholder** url (`hooks.example.com`) — never a real
endpoint. The repo is public; corpora and tests use generic placeholders only.

## 3. Benchmark map — `benchmarks/config-eval/eval.js`

Add the planted-issue `kind` → finding `category` line to `KIND_CATEGORY`:

```js
http_hook_missing_url: 'hooks',
```

The eval matches a planted issue when an in-scope finding of the mapped category contains the
issue's `token` in its title/detail/evidence. Here `category: 'hooks'` and the token `PreToolUse`
appears in the title `http hook missing url: PreToolUse`. ✓

## 4. Corpus — `benchmarks/config-eval/corpus.json`

Two scenarios. **Planted** (the eval scores recall on this):

```json
{
  "description": "Drift: an http-type hook is configured with no url, so it can never fire — Claude Code accepts the entry but the hook is inert. Should be flagged as an http hook missing its url (parallel to a command hook with no command).",
  "settings": { "hooks": { "PreToolUse": [ { "hooks": [{ "type": "http" }] } ] } },
  "settingsLocal": null,
  "mcp": null,
  "issues": [
    { "kind": "http_hook_missing_url", "token": "PreToolUse", "note": "an http hook with no url is inert" }
  ],
  "id": "s89"
}
```

**Clean-but-tricky FP probe** (`"issues": []` — the eval scores precision on this; it must produce
no in-scope finding). Often folded into a multi-surface clean scenario, e.g.:

```json
{
  "description": "Clean-but-tricky across the newer checks: ... an http hook has a proper url ... None of the newer checks should fire — a false-positive probe over their valid surfaces.",
  "settings": { "hooks": { "PreToolUse": [ { "hooks": [{ "type": "http", "url": "https://hooks.example.com/ci" }] } ] } },
  "settingsLocal": null,
  "mcp": null,
  "issues": [],
  "id": "s92"
}
```

## 5. Verify, in order

```bash
# from repo root
npm test                                  # HT1/HT2 + everything else green

# from benchmarks/config-eval
node eval.js corpus.json                  # false positives: 0  (gate), detected ↑
```

Confirm `false positives (in-scope findings with no planted issue): 0` **first**, then that
`detected` rose by one planted issue. Record the new baseline (e.g. `detected 91/92, recall 98.9%,
FP 0`) in the commit message. Done.
