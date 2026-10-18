## 2024-03-20 - [App React Rendering Bottleneck]
**Learning:** The application frequently re-renders the top-level `App` component during active voice dictation due to `dictation.partial` state updates.
**Action:** Any derived state or expensive calculations (like regex) depending on document text must be memoized (e.g., using `useMemo`) to prevent main thread blocking and UI jank.
