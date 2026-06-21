#!/usr/bin/env node
'use strict';
// SessionStart(startup): audit the Claude config once and surface a quiet one-line
// advisory ONLY if there are errors (warnings/info are left for /whippet-config on
// demand, so this never nags). Never throws. Off with WHIPPET_CONFIG_OFF=1.
try {
  if (!process.env.WHIPPET_CONFIG_OFF) {
    const { audit, resolveConfigDir } = require('../scripts/config-audit.js');
    const rep = audit(resolveConfigDir([]));
    if (rep.summary.error > 0) {
      const w = rep.summary.warning;
      process.stdout.write(
        `whippet config: ${rep.summary.error} error(s)` + (w ? `, ${w} warning(s)` : '') +
        ` in your Claude setup — run /whippet-config for details. (off: WHIPPET_CONFIG_OFF=1)`);
    }
  }
} catch { /* degrade silently */ }
process.exit(0);
