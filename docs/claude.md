# Claude Code Instructions

## Project Role

You are assisting with a production Progressive Web App (PWA).

This application already has active users.

Your priority order:

1. Protect existing users
2. Prevent data loss
3. Maintain security
4. Preserve existing functionality
5. Improve architecture gradually

---

# Critical Rules

## Before Changing Code

Always:

1. Analyze the existing implementation.
2. Explain what files will change.
3. Explain possible side effects.
4. Explain testing requirements.
5. Wait for approval before large changes.

Do not make large refactors without confirmation.

---

# Production Safety

This is a live production application.

Never:

- Delete existing features without approval.
- Change database schema without approval.
- Remove authentication logic.
- Disable security controls.
- Modify RLS policies without explaining impact.
- Replace working architecture with a different pattern without discussion.

Prefer:

- Small incremental changes.
- Backward-compatible solutions.
- Minimal file changes.

---

# Database Rules

Backend uses Supabase.

Before modifying database-related code:

Check:

- Existing tables
- Relationships
- RLS policies
- Authentication flow
- Existing queries

Never assume database structure.

---

# Security Rules

Always consider:

- Authentication security
- Authorization boundaries
- Supabase RLS
- XSS prevention
- Data exposure
- Client-side security risks

Never store sensitive information insecurely.

---

# Frontend Rules

Technology stack:

- React
- TypeScript
- Vite
- React 19
- TanStack Query
- Zustand
- shadcn/ui

Follow existing patterns.

Do not introduce new libraries unless justified.

---

# PWA Rules

Respect:

- Offline-first architecture
- Service worker behavior
- Cache strategies
- Background sync
- Offline queue handling

Do not modify service worker logic without careful analysis.

---

# Testing Requirements

Before suggesting deployment:

Check:

- TypeScript errors
- Build errors
- Existing tests
- User flows

Use Playwright when appropriate for:

- Authentication
- Forms
- Critical workflows
- Responsive testing

---

# Code Quality

Prefer:

- TypeScript strictness
- Clear naming
- Reusable components
- Existing project conventions

Avoid:

- Temporary hacks
- Duplicate logic
- Unnecessary abstraction
- Over-engineering

---

# Git Workflow

Before major changes:

Recommend creating a branch.

Example:

Keep commits focused.

---

# Communication Style

When working:

Explain:

- What you found
- Why it matters
- What you recommend
- Risk level

Do not silently make architectural decisions.

---

# Project Documentation

Always refer to:

- PROJECT_CONTEXT.md
- ARCHITECTURE.md

before making architectural recommendations.