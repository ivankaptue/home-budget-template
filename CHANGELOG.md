# Changelog

All notable changes to Carnet Budget Maison. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versions follow [Semantic Versioning](https://semver.org/) — **major**: breaks backward compatibility (data, rules,
budget JSON), **minor**: new feature, **patch**: fix. Budget-only changes (`budget/*.json`) are published separately
and are not app versions.

## [Unreleased]

## [1.0.0] — 2026-10-07

### Added
- Offline-first PWA (Preact + TypeScript, Firestore persistent cache), Google sign-in limited to the verified emails
  of `ALLOWED_EMAILS` by the security rules.
- Budget envelopes with their own income, expense / savings items, cross-envelope transfers, leftover to savings,
  annual charges; versioned budget files with validation and archiving, publish and export scripts.
- Month view (tick fixed items, log variable and extra expenses, over-budget highlighting), « Compte chèque » view,
  yearly report (« Bilan ») with a monthly chart per envelope.
- Eye button hiding every amount, version badge, light / dark / automatic theme.
- Your own copy: `.env` configuration, `SETUP.md`, example budget, GitHub Actions deploy and rollback workflows.
