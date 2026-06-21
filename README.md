<div align="center">

<img src="assets/whippet-logo.png" alt="Whippet" width="200">

# Whippet

***keeps your Claude Code setup from quietly drifting***

[![Claude Code](https://img.shields.io/badge/Claude_Code-plugin-d97757?style=flat-square&logo=anthropic&logoColor=white)](https://docs.claude.com/en/docs/claude-code)
[![Version](https://img.shields.io/badge/version-3.0.1-4c8bf5?style=flat-square)](#)
[![License](https://img.shields.io/badge/license-MIT-3fb950?style=flat-square)](LICENSE)
[![Dependencies](https://img.shields.io/badge/dependencies-0-555?style=flat-square)](package.json)
[![Node](https://img.shields.io/badge/node-%E2%89%A522-339933?style=flat-square&logo=nodedotjs&logoColor=white)](package.json)

</div>

---

Whippet audits your Claude Code setup for the drift the schema can't catch — dead plugin, hook, and MCP references, fragile local marketplaces, duplicate components, malformed JSON, mistyped settings keys, and orphaned files, across `settings.json` and `settings.local.json`. Read-only, deterministic, zero dependencies. Run the full audit on demand with `/whippet-config`; once installed, a quiet advisory at session start speaks up only when your setup has actual errors.

## Install

```
/plugin marketplace add daviduuuul/whippet
/plugin install whippet@whippet
```
