## 2024-05-18 - Memoizing expensive text calculations on every dictation update
**Learning:** The App component re-renders many times a second during voice dictation because of dictation.partial updates. Expensive calculations that depend on the full document text (like countWords regex) will run on every single word spoken if not memoized, causing main thread blocking.
**Action:** Always memoize derived state that depends on the document text when the component also subscribes to high-frequency updates like active voice dictation.
