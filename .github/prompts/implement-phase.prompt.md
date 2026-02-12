# Implement a Full Phase

## Context
You are implementing an entire phase from the PUNCHLIST suggested implementation order. Phases group related tasks that should be done together.

## Phases (from PUNCHLIST.md)
1. **Phase 0 — Foundation:** 0a → 0b → 0c → 8e-i
2. **Phase 1 — Core List:** 1a-ii → 1a-iii → 1b-iii → 1b-ii → 1c-iv → 1d-iv → 1c-v → 1c-vi
3. **Phase 2 — File Items:** 1a-vi → 1b-vi → 1c-vii → 1b-v → 1a-x
4. **Phase 3 — Diff Viewing:** 1a-vii → 1a-viii → 6d → 6c → 6e
5. **Phase 4 — Commands Hardening:** 2c → 2d → 2e → 2f → 3c → 3d → 4c → 4d
6. **Phase 5 — Reactivity:** 1e-ii → 1e-iii → 8e-ii → 8e-iii → 8e-iv
7. **Phase 6 — Polish:** 1d-v → 1d-vi → 8a-ii → 8a-iii → 8d → 8c-i → 8c-ii
8. **Phase 7 — Testing:** 9a → 9b → 9c
9. **Phase 8 — Release:** 10a → 10b → 10c

## Instructions
1. **Read all tasks** in the phase from `PUNCHLIST.md`.
2. **Verify dependencies** — all prerequisite tasks from earlier phases must be `[x]`.
3. **Implement tasks in order** — the arrow sequence matters (later tasks depend on earlier ones).
4. **For each task:**
   - Read the task spec in PUNCHLIST
   - Implement in the listed file(s)
   - Mark `- [x]` in PUNCHLIST
5. **After all tasks in the phase:**
   - Update the Progress Summary table
   - Run `npm run compile` — zero errors required
   - Summarize what was done

## Which phase to implement
<!-- e.g.: "Implement Phase 0 — Foundation (tasks 0a, 0b, 0c, 8e-i)" -->
