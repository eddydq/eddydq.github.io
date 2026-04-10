# Flow Builder Toolbar Refinement Design

## Goal

Refine the flow-builder UI so the header controls read as one intentional top bar, the dock toggles use `+` and `-`, and the left DSP catalog opens and closes with the same smoothness as the bottom outputs bar.

## Approved Layout

- Use a single bordered top control bar instead of split header groups.
- Place `Back to Site` on the left as the navigation/escape action.
- Keep the operational controls together in the middle: play, upload, progress, and status.
- Pin `EN | FR` to the far right of the same bar, matching the main site menu placement.

## Panel Behavior

- Keep the VS Code-like docked side panel and bottom panel.
- Use `-` when a panel is open and `+` when a panel is collapsed.
- Keep the dock tabs as the only collapse controls; do not reintroduce the old square buttons inside panel headers.

## Motion

- Animate the left panel with width transition plus a content fade/slide so it does not snap shut.
- Preserve the bottom panel collapse behavior and make the left panel feel comparable in timing and smoothness.
- Clip the sidebar content during collapse but keep the dock tab accessible outside the panel edge.

## Constraints

- Work in the `.worktrees/panel-docks` branch state, which still uses the older `../styles.css` and `../script.js` layout.
- Keep existing flow-builder ids used by runtime logic and tests.
- Add or update focused regression coverage for the dock-toggle contract.
