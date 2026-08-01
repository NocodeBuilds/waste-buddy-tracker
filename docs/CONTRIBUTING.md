# Contributing

---

## Branching Strategy

We follow a simplified Git Flow:

| Branch | Purpose |
|---|---|
| `main` | Production-ready code (protected, requires PR review) |
| `Revamp` | Active development branch |
| `feature/*` | New features |
| `bugfix/*` | Bug fixes |

### Creating a Branch

```bash
git checkout Revamp
git pull origin Revamp
git checkout -b feature/your-feature-name
```

### Submitting a PR

```bash
# 1. Push your branch
git push origin feature/your-feature-name

# 2. Create PR via GitHub CLI
gh pr create --base Revamp --title "feat: description" --body "..."
```

PRs to `main` require:
- ✅ All checks pass (lint, type-check, build, tests)
- ✅ Code review approval
- ✅ Up-to-date with `main`

---

## Commit Style

We use [Conventional Commits](https://www.conventionalcommits.org/):

```bash
<type>(<scope>): <subject>
```

| Type | Purpose | Example |
|---|---|---|
| `feat` | New feature | `feat(disposal): add batch numbering` |
| `fix` | Bug fix | `fix(auth): resolve session expiry bug` |
| `refactor` | Code refactor | `refactor(components): split WasteForm` |
| `docs` | Docs only | `docs(readme): update deployment guide` |
| `style` | Formatting | `style: format with prettier` |
| `test` | Add tests | `test(disposal): add batch tests` |
| `chore` | Build/tooling | `chore(deps): update vite to 5.4` |
| `perf` | Performance | `perf(queries): enable index on waste_entries` |

---

## Code Style

- **TypeScript strict mode** (no `any` unless absolutely necessary)
- **Components**: PascalCase (`WasteForm.tsx`)
- **Hooks**: `useXxx.ts`
- **Utilities**: camelCase (`utils.ts`)
- **No barrel exports** for performance — import directly from files
- **Imports**: External → Internal → Relative, alphabetical

---

## Pre-PR Checklist

- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] Tests pass: `npm run test`
- [ ] Build succeeds: `npm run build`
- [ ] Reviewed your own diff
- [ ] Added/updated tests if needed
- [ ] Documentation updated if needed

---

## Reporting Issues

Use GitHub Issues. Include:
1. Reproduction steps
2. Expected vs actual behavior
3. Browser/device
4. Screenshots/logs

---

## License

By contributing, you agree that your contributions will be licensed under MIT.
