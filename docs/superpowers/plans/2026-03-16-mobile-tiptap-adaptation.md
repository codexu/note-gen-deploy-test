# Mobile TipTap Adaptation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-specific TipTap interaction model with a fixed context bar, retained selection context, and clearer quote visibility without regressing desktop behavior.

**Architecture:** Keep desktop floating menus intact, but gate them off on mobile. Add a small mobile context model plus focused mobile UI components that reuse existing editor commands instead of duplicating formatting behavior. Push testable context/quote logic into pure helper modules and keep `tiptap-editor.tsx` as the integration point.

**Tech Stack:** React 19, Next.js App Router, TipTap, Tailwind CSS, `node:test`

---

## Chunk 1: Mobile Context Model

### Task 1: Add pure mobile editor context helpers

**Files:**
- Create: `src/app/core/main/editor/markdown/mobile-selection-context.ts`
- Create: `src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildMobileSelectionContext,
  isMobileSelectionContextStale,
} from './mobile-selection-context.js'

test('builds text selection context when range has content', () => {
  const context = buildMobileSelectionContext({
    mode: 'text',
    from: 5,
    to: 12,
    previewText: 'selected',
  })

  assert.equal(context.mode, 'text')
  assert.equal(context.from, 5)
  assert.equal(context.to, 12)
})

test('marks text context stale when document shrinks before saved range', () => {
  assert.equal(
    isMobileSelectionContextStale({
      mode: 'text',
      from: 8,
      to: 12,
    }, 6),
    true
  )
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function buildMobileSelectionContext(input) {
  if (input.mode === 'text' && input.from < input.to && input.previewText.trim()) {
    return { ...input }
  }
  return null
}

export function isMobileSelectionContextStale(context, docSize) {
  if (!context) return true
  if (context.mode === 'text') {
    return context.from < 0 || context.to > docSize || context.from >= context.to
  }
  return false
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/main/editor/markdown/mobile-selection-context.ts src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs
git commit -m "test: add mobile selection context helpers"
```

### Task 2: Add quote preview helpers for chat display

**Files:**
- Create: `src/app/core/main/chat/quote-preview.ts`
- Create: `src/app/core/main/chat/quote-preview.spec.mjs`

- [ ] **Step 1: Write the failing test**

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { getQuotePreview } from './quote-preview.js'

test('keeps more mobile-visible quote content without losing full value', () => {
  const preview = getQuotePreview('1234567890'.repeat(20), 160)
  assert.equal(preview.length <= 163, true)
  assert.equal(preview.endsWith('...'), true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/core/main/chat/quote-preview.spec.mjs`
Expected: FAIL because the helper module does not exist yet.

- [ ] **Step 3: Write minimal implementation**

```js
export function getQuotePreview(content, limit = 160) {
  if (content.length <= limit) return content
  return `${content.slice(0, limit)}...`
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/core/main/chat/quote-preview.spec.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/main/chat/quote-preview.ts src/app/core/main/chat/quote-preview.spec.mjs
git commit -m "test: add quote preview helpers"
```

## Chunk 2: Mobile Editor UI

### Task 3: Add mobile context bar and more-actions sheet

**Files:**
- Create: `src/app/core/main/editor/markdown/mobile-editor-context-bar.tsx`
- Create: `src/app/core/main/editor/markdown/mobile-editor-more-sheet.tsx`
- Modify: `src/app/mobile/writing/page.tsx`
- Modify: `src/app/mobile/writing/custom-header.tsx`

- [ ] **Step 1: Write the failing test**

Write a focused pure helper assertion in `mobile-selection-context.spec.mjs` for the action list returned by context mode, for example:

```js
test('text mode exposes quote and formatting actions first', () => {
  const context = buildMobileSelectionContext({
    mode: 'text',
    from: 1,
    to: 4,
    previewText: 'abc',
  })

  assert.deepEqual(context.actions.slice(0, 3), ['quote', 'ai', 'bold'])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: FAIL because actions are not derived yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

- action derivation in `mobile-selection-context.ts`
- a compact top bar component that reads mobile context and renders the primary actions
- a bottom drawer component for `more`, image metadata editing, and extra table commands

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/main/editor/markdown/mobile-selection-context.ts src/app/core/main/editor/markdown/mobile-editor-context-bar.tsx src/app/core/main/editor/markdown/mobile-editor-more-sheet.tsx src/app/mobile/writing/page.tsx src/app/mobile/writing/custom-header.tsx
git commit -m "feat: add mobile editor context bar"
```

### Task 4: Integrate mobile context into TipTap editor

**Files:**
- Modify: `src/app/core/main/editor/markdown/tiptap-editor.tsx`
- Modify: `src/hooks/use-mobile.tsx`

- [ ] **Step 1: Write the failing test**

Extend `mobile-selection-context.spec.mjs` with a stale-selection recovery case:

```js
test('clears text context when saved range becomes invalid', () => {
  const stale = isMobileSelectionContextStale({
    mode: 'text',
    from: 10,
    to: 14,
  }, 9)

  assert.equal(stale, true)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: FAIL if stale handling or mode handling is incomplete.

- [ ] **Step 3: Write minimal implementation**

Implement in `tiptap-editor.tsx`:

- mobile-only context state
- selection / image / table listeners that update context
- helpers to restore selection before running commands
- mobile gates that disable `BubbleMenu`, `ImageBubbleMenu`, and `FloatingTableMenu`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/main/editor/markdown/tiptap-editor.tsx src/hooks/use-mobile.tsx
git commit -m "feat: integrate mobile tiptap context"
```

## Chunk 3: Quote Visibility and Styling

### Task 5: Improve quote preview and editor quote visibility

**Files:**
- Modify: `src/app/core/main/chat/quote-display.tsx`
- Modify: `src/app/core/main/editor/markdown/quote-mark.ts`
- Modify: `src/app/core/main/editor/markdown/style.css`

- [ ] **Step 1: Write the failing test**

Add a second quote preview test:

```js
test('returns full content when quote is already short', () => {
  assert.equal(getQuotePreview('short', 160), 'short')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/app/core/main/chat/quote-preview.spec.mjs`
Expected: FAIL if helper behavior is not fully covered yet.

- [ ] **Step 3: Write minimal implementation**

Implement:

- expanded mobile-friendly quote card preview using `quote-preview.ts`
- stronger quoted-state styles that remain visible when focus changes
- mobile-safe spacing so the fixed context bar does not overlap editor content

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/app/core/main/chat/quote-preview.spec.mjs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/core/main/chat/quote-display.tsx src/app/core/main/chat/quote-preview.ts src/app/core/main/chat/quote-preview.spec.mjs src/app/core/main/editor/markdown/quote-mark.ts src/app/core/main/editor/markdown/style.css
git commit -m "feat: improve mobile quote visibility"
```

### Task 6: Verify behavior and document known baseline issue

**Files:**
- Modify: `docs/superpowers/specs/2026-03-16-mobile-tiptap-design.md`

- [ ] **Step 1: Run targeted automated tests**

Run: `node --test src/app/core/main/editor/markdown/mobile-selection-context.spec.mjs src/app/core/main/chat/quote-preview.spec.mjs`
Expected: PASS

- [ ] **Step 2: Run project lint**

Run: `pnpm lint`
Expected: known failure in this worktree layout because `next lint` sees duplicate `.eslintrc.json` paths and reports `Plugin "@next/next" was conflicted ...`

- [ ] **Step 3: Manually verify mobile flows**

Check:

- text selection keeps top bar stable
- image selection switches to image actions
- table selection switches to table actions
- quote preview is readable in chat

- [ ] **Step 4: Record verification notes**

Append a short verification note to the spec describing:

- which automated tests passed
- which manual checks were completed
- the known worktree lint baseline issue

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-03-16-mobile-tiptap-design.md
git commit -m "docs: record mobile editor verification notes"
```
