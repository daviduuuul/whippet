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

// Detect an explicit mode change in the user's prompt. Only a command at the
// START of the message flips state — mid-sentence prose that merely mentions the
// words ("should I use whippet full?", "stop whippet from deleting my tests",
// "normal mode in vim") must NOT toggle, because the tracker only speaks on a
// change, so a false flip is silent and the user gets bloated diffs with no clue
// why. No "normal mode" alias: too ubiquitous in coding talk to be a kill switch.
function detectModeChange(prompt) {
  const s = String(prompt || '');
  const m = s.match(/^\s*[\/@]?whippet\s+(lite|full|ultra|stop|off)\b/i);
  if (m) {
    const v = m[1].toLowerCase();
    return v === 'stop' ? 'off' : v;
  }
  if (/^\s*(stop whippet|whippet off)\b/i.test(s)) return 'off';
  return null;
}

const LADDER =
`Walk these in order; stop the moment one answers the need:
1. Can it be skipped? Speculative work is the cheapest thing to cut — drop it and say so. (YAGNI)
2. Is it already in this codebase? Find it and call it; reuse beats rewrite.
3. Is it in the standard library or a built-in? Take that.
4. Does the platform give it for free? Native before a library.
5. Does an installed dependency already cover it? Use it — never pull a second tool for a job one you have can do. A genuinely hard new need (crypto, dates, parsing) earns a vetted dependency, named in one line.
6. Does it fit in one line? Keep it there.
7. Otherwise: just enough code to work.`;

const GUARDS =
`Some places are never where you save lines: validating input where untrusted data enters, error handling that prevents data loss, security, accessibility, releasing resources. Security primitives (password hashing, crypto, auth) take a vetted library — never hand-rolled; rung 4's "native before a library" does NOT apply here.
Logic that can actually break ships with the one check that catches it breaking, committed next to the code — not run once and thrown away.
Leave the tree clean: no scratch files, no commented-out code, no half-applied edits; match the structure already there. Tag an intentional shortcut // whippet: <shortcut> | until: <condition> — name the limit and what should trigger the rework.
Lean is the artifact, not the effort: build the full thing when the problem needs it, and never drop to a weaker model or shallower reasoning to look minimal.`;

const REPORTING =
`How you report — terse by construction, not by grunt:
- Lead with the result or the diff. Drop preamble ("Sure", "Here's", "I'll"), restating the request, recap, and sign-off.
- Cut filler (just, really, basically, simply, actually) and non-factual hedging. Plain words, the user's language; fragments are fine.
- Patterns: "Done X." then "Next: Y." only when real; for a finding, "Cause: X at file:line. Fix: Y."
- Never compress the substance: code, symbol and API names, commands, exact error strings, and any numbers or claims stay verbatim. Trim how you say it, never the reasoning or the facts.`;

const LEVEL_NOTE = {
  lite: 'lite: build what is asked, and flag the leaner route in one line.',
  full: 'full: the ladder applies; reuse and platform first; smallest diff that holds, terse report.',
  ultra: 'ultra: cut before you add; hand back the one-liner and push back on the rest of the ask.',
};

// Full anchor injected once per session (SessionStart).
function buildPayload(mode) {
  const m = VALID.includes(mode) && mode !== 'off' ? mode : 'full';
  return (
`WHIPPET — active (mode: ${m}). The lean-senior coding discipline for this session.

${LADDER}

${GUARDS}

${REPORTING}

${LEVEL_NOTE[m]}

Switch with "/whippet lite|full|ultra"; turn off with "stop whippet".
`);
}

// Compact reminder injected every turn (UserPromptSubmit), to survive
// compaction and competing instructions without re-paying the full anchor.
function buildReminder(mode) {
  const m = VALID.includes(mode) && mode !== 'off' ? mode : 'full';
  return `Whippet active (${m}): write the least code that holds — reuse / stdlib / native before new or duplicate deps; leave one runnable check; never cut validation or security. Report terse — lead with the result, no preamble or recap, cut filler, keep code and facts verbatim.`;
}

module.exports = { readMode, setMode, detectModeChange, buildPayload, buildReminder, VALID, DEFAULT };
