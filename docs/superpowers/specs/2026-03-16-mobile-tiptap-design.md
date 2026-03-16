# Mobile TipTap Adaptation Design

## Context

The mobile writing experience currently reuses the desktop TipTap interaction model:

- text formatting uses a floating bubble menu near the current selection
- image editing uses a floating menu centered above the image node
- table editing uses a floating menu near the current cell selection
- quote-to-chat feedback is short in chat and subtle in the editor

This creates several mobile-specific problems:

- action rows can exceed the viewport width
- mobile system copy/select menus compete with app actions
- selection state is easy to lose when the editor blurs
- image/table actions feel disconnected from text actions
- quoted content is hard to visually confirm in both editor and chat

## Goals

- Make text-selection actions feel stable and easy on mobile
- Prevent mobile action rows from overflowing the screen
- Unify text, image, and table editing under one mobile interaction model
- Preserve the user's active selection context even when focus changes
- Make quote-to-chat feedback obvious in both the editor and chat input

## Non-Goals

- Redesign the desktop editing experience
- Replace native mobile selection handles or fully suppress system copy menus
- Rebuild TipTap command implementations from scratch

## Proposed Interaction Model

### 1. Fixed Mobile Context Bar

Mobile editing uses a fixed context bar rendered below the mobile writing header instead of floating menus near content.

The bar appears only when there is a meaningful editing context:

- selected text
- selected image
- active table selection

The bar stays visually stable during scrolling, keyboard changes, and focus changes.

### 2. Context Modes

The bar changes mode based on the current editor target.

#### Text mode

High-frequency actions:

- quote to chat
- AI actions
- bold
- highlight
- more

#### Image mode

High-frequency actions:

- edit/replace source
- edit alt text
- delete image
- more

#### Table mode

High-frequency actions:

- insert row
- insert column
- alignment
- more

### 3. Bottom Drawer for Low-Frequency Actions

Low-frequency or width-heavy actions move into a bottom drawer instead of staying in the top row.

This drawer is used for:

- extra text formatting actions
- image source / alt editing forms
- advanced table operations

This keeps the top bar compact and consistent across mobile contexts.

### 4. Mobile Selection Context

The mobile editor stores a separate `mobileSelectionContext` snapshot so actions do not depend on the browser preserving the live selection at all times.

Snapshot data varies by mode:

- text: `from`, `to`, preview text, available actions
- image: node position and image attributes
- table: current table-active state and relevant cell metadata

Top-bar actions restore the relevant selection or node before executing commands if the editor has lost focus.

### 5. Quote Visibility

Quote-to-chat receives stronger visual confirmation.

In the editor:

- keep native selection highlighting
- add a stronger app-level quoted-state highlight that does not depend on editor focus

In chat:

- show a larger quote preview card
- keep file/line metadata visible
- allow expanded preview instead of a very short truncated snippet

## Component Boundaries

### New or Expanded Units

- `mobile-selection-context.ts`
  - pure helpers for deriving and validating mobile editor context
- `mobile-editor-context-bar.tsx`
  - fixed top action bar for mobile writing
- `mobile-editor-more-sheet.tsx`
  - drawer for context-specific secondary actions

### Existing Units to Adapt

- `tiptap-editor.tsx`
  - expose/update mobile context state
  - disable floating menus on mobile
  - restore selection before running context actions
- `bubble-menu.tsx`
  - desktop only
- `image-bubble-menu.tsx`
  - desktop only
- `floating-table-menu.tsx`
  - desktop only
- `style.css`
  - mobile selection/highlight styles and layout offsets
- `quote-display.tsx`
  - stronger quote preview on mobile-friendly layouts

## State Flow

1. User selects text, image, or table region in the editor.
2. Editor derives a fresh mobile context snapshot.
3. Mobile context bar renders the corresponding action set.
4. User taps a top-bar action.
5. Editor restores the relevant selection/node if needed, then runs the command.
6. If the action opens an advanced flow, a bottom drawer handles the secondary UI.
7. Quote-to-chat updates both chat preview state and editor quote highlight.

## Failure Handling

- If the saved selection range is no longer valid after document changes, clear the mobile context instead of acting on stale positions.
- If a node-backed action can no longer find the target node, close the active mobile context.
- Native system copy menus may still appear; app actions remain available through the fixed bar and retained context.

## Testing Strategy

### Automated

Prefer pure logic tests for:

- deriving mobile context mode from editor state
- generating quote preview summaries
- invalidating stale selection snapshots
- deciding when mobile context should be cleared

### Manual

Validate on mobile writing flow:

- select text and trigger quote / AI / formatting
- switch to chat and confirm quoted content visibility
- tap image and perform edit/delete flows
- operate inside tables with narrow screens
- scroll with an active context bar
- open/close keyboard while context is active

## Risks

- `tiptap-editor.tsx` is already large, so mobile-only state should be pushed into focused helpers/components where possible.
- Position-based context restoration must be conservative to avoid editing the wrong content after document mutations.
- Some native mobile selection UI cannot be fully controlled, so the design deliberately avoids direct competition near the selection.

## Verification Notes

- Helper logic now lives in TypeScript modules under `src/app/core/main/editor/markdown` and `src/app/core/main/chat`.
- Manual interaction verification is expected to be done in the app during mobile editing flows.
- Baseline issue: `pnpm lint` still fails in this in-repo worktree layout because `next lint` detects conflicting `@next/next` plugin resolution from both the main workspace and the nested worktree `.eslintrc.json` paths.
