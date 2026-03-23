<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# RAD Pioneer - Agent Instructions

## Tech Stack & Standards
- **Framework**: Next.js 15+ (App Router)
- **React version**: 19 (Beta/RC)
- **Compiler**: React Compiler enabled (Experimental). 
  - RULE: Do NOT use `useMemo`, `useCallback`, or `React.memo` unless specifically required for stable object references in external libraries. Let the compiler handle optimization.
- **Styling**: Tailwind CSS (Utility-first)
- **Animations**: Framer Motion (Always use for transitions)
- **Icons**: Lucide React
- **Data**: Supabase (Auth Helpers for Next.js)

## Coding Principles (Premium UX)
1. **The "Juice" Rule**: Every user interaction (button click, XP gain) must have a visual or motion feedback.
2. **Optimistic First**: Always implement Optimistic UI updates using React `useOptimistic` or local state before the DB sync.
3. **Type Safety**: No `any`. Strict TypeScript for all props and DB returns.
4. **Server Components**: Use Server Components by default. Use `"use client"` only for interactivity, Context Providers, or Framer Motion.

## Component Architecture
- **Global State**: Use `MissionContext` for student XP, Level, and Streak.
- **Atomic UI**: Keep components small. Logic goes in Hooks; "Juice" goes in Components.