## 2024-06-25 - Prevent regex re-evaluation during top-level re-renders

**Learning:** This codebase's architecture frequently re-renders the top-level `App` component during active voice dictation due to the `dictation.partial` state updating multiple times a second. Calculations dependent only on `text` (like `countWords` which uses a regex) are run unnecessarily on every tick, which can lead to jank in typing and voice recognition on long documents.

**Action:** Whenever introducing derived state in `App.tsx` (or other top-level components) that depends on document text or other large data structures, STRICTLY use `useMemo` to prevent re-evaluation on every speech recognition tick.
