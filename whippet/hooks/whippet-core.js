// whippet-core.js — shared logic for the whippet hooks.
// Pure Node builtins, no dependencies. Nothing here may throw to the caller:
// the hooks wrap every call so a failure never breaks a session.

const fs = require('fs');
const os = require('os');
const path = require('path');

const VALID = ['off', 'lite', 'full', 'ultra'];
const DEFAULT = (() => {
  const e = (process.env.WHIPPET_DEFAULT_MODE || '').toLowerCase();
  return VALID.includes(e) && e !== 'off' ? e : 'full';
})();

function configDir() {
  return process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
}
function flagPath() {
  return path.join(configDir(), '.whippet-active');
}

// Read the current mode. Refuses to follow a symlink (a predictable path an
// attacker could repoint at a secret) and only ever returns a whitelisted value.
function readMode() {
  try {
    const p = flagPath();
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink() || !st.isFile() || st.size > 16) return DEFAULT;
    const v = fs.readFileSync(p, 'utf8').trim().toLowerCase();
    return VALID.includes(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

// Persist the mode atomically (temp + rename), 0600, whitelist-checked.
function setMode(mode) {
  if (!VALID.includes(mode)) return;
  try {
    const dir = configDir();
    fs.mkdirSync(dir, { recursive: true });
    const tmp = path.join(dir, '.whippet-active.tmp');
    fs.writeFileSync(tmp, mode, { mode: 0o600 });
    fs.renameSync(tmp, flagPath());
  } catch {
    /* a failed write just means the mode doesn't persist; never fatal */
  }
}

// Detect an explicit mode change in the user's prompt. Conservative on purpose:
// only a clear "/whippet <level>" or "stop whippet" flips state, so normal
// prose that mentions the word doesn't toggle anything.
function detectModeChange(prompt) {
  const s = String(prompt || '');
  let m = s.match(/(?:^|\s)[\/@]?whippet\s+(lite|full|ultra|stop|off)\b/i);
  if (m) {
    const v = m[1].toLowerCase();
    return v === 'stop' ? 'off' : v;
  }
  if (/\b(stop whippet|whippet off|normal mode)\b/i.test(s)) return 'off';
  return null;
}

const LADDER =
`Before writing code, stop at the first rung that holds:
1. Does this need to exist at all? If not, skip it and say so. (YAGNI)
2. Does the codebase already do it? Reuse it.
3. Does the standard library / built-in do it? Use it.
4. Does a native platform feature cover it? Native before a library.
5. Does an installed dependency solve it? Use it — never add a second library for a job something already does (no duplicate/overlapping deps). A genuinely hard new need (crypto, dates, parsing) earns a vetted dep, justified in one line.
6. Can it be one line? One line.
7. Only then: the minimum code that works.`;

const GUARDS =
`Never cut for the sake of small: input validation at trust boundaries, error handling that prevents data loss, security, accessibility, resource cleanup. Security primitives (password hashing, crypto, auth) use a vetted library, never hand-rolled.
Non-trivial logic leaves ONE runnable check that ships with the code.
Clean up after yourself: no scratch files, no commented-out code, no half-finished edits. Follow the project's existing structure.
Lazy means better judgment, not less effort: build fully when the problem needs it, and never downgrade the model or the reasoning to look minimal.
Report terse, in the user's language: what changed, the next step, one question only if it is load-bearing.`;

const LEVEL_NOTE = {
  lite: 'Lite: build what is asked, but name the leaner alternative in one line.',
  full: 'Full: the ladder enforced; shortest working diff and explanation.',
  ultra: 'Ultra: deletion before addition; ship the one-liner and challenge the rest of the request.',
};

// Full anchor injected once per session (SessionStart).
function buildPayload(mode) {
  const m = VALID.includes(mode) && mode !== 'off' ? mode : 'full';
  return (
`WHIPPET — active (mode: ${m}). The lean-senior coding discipline for this session.

${LADDER}

${GUARDS}

${LEVEL_NOTE[m]}

Switch with "/whippet lite|full|ultra"; turn off with "stop whippet".
`);
}

// Compact reminder injected every turn (UserPromptSubmit), to survive
// compaction and competing instructions without re-paying the full anchor.
function buildReminder(mode) {
  const m = VALID.includes(mode) && mode !== 'off' ? mode : 'full';
  return `Whippet active (${m}): lean code — reuse / stdlib / native before new or duplicate deps; leave one runnable check; never cut validation or security; report terse.`;
}

module.exports = { readMode, setMode, detectModeChange, buildPayload, buildReminder, VALID, DEFAULT };
