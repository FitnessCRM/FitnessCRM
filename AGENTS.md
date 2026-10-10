# Review rules for FitnessCRM

Rules for the automated review run by GGA on staged files. Each rule is a
hard constraint from `CLAUDE.md` («Reglas duras») or a convention from its
«Convenciones». Report only violations in the staged code, with file and line.

## Architecture

1. `lib/domain/` must not import React, Next, the DOM, or any network code.
   It may only depend on TypeScript and zod.
2. Firebase SDK imports (`firebase`, `@firebase/*`) appear only under
   `lib/data/adapters/firebase/`. Any other backend SDK (`@supabase/*`, an ORM,
   a database client) is a violation.
3. Components and hooks never call a data source directly. Data goes through
   `lib/data/hooks/`, which talks to the interfaces in `lib/data/ports/`.
4. `components/client/` and `components/trainer/` never import from each other.
   Shared code belongs in `components/charts/`, `components/review/`,
   `components/editor/`, or `components/ui/`.
5. Each domain concept has one zod schema in `lib/domain/schemas`. Forms and
   other consumers must validate against it, not against a copy.

## Language and copy

6. Every visible literal (JSX text, labels, placeholders, `aria-label`, titles)
   comes from `lib/i18n/es.ts`. Hardcoded user-facing strings in components are
   violations.
7. The app name comes from `APP_NAME` in `lib/i18n/es.ts`. The literal
   `HECTOR` must not appear in components, `<title>`, or the manifest.
8. Labels about a person are invariant: nouns or phrases such as «En activo»,
   not gendered adjectives such as «Activo» or «Invitado».
9. Identifiers, branch names and commit messages are in English. Visible copy
   is in Spanish. Comments may be in Spanish or English: do not flag the
   language of a comment.

## Design

10. Colors come from Tailwind tokens. Raw color values (hex, `rgb()`,
    `oklch()`, or arbitrary `text-[#...]`) in components are violations.

## Scope

11. Do not flag style issues already handled by ESLint or Prettier, which run
    in pre-commit through lint-staged.
