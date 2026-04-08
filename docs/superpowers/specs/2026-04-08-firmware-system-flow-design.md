# Firmware System Flow Redesign

## Goal

Replace the current firmware architecture Mermaid diagram with a cleaner story-first overview that still expands into code-faithful detail views.

The main card should stay easy to read for a first-time visitor. Each clicked expansion should remain visually clean, but it must map back to the real firmware control flow in `C:\dev\_work\PaddlingPulse\firmware`.

## Source of Truth

The redesign is based primarily on:

- `firmware/app/src/paddling_pulse_app.c`
- `firmware/app/src/paddling_pulse_stroke_rate.c`
- `firmware/app/include/paddling_pulse_imu.h`

The most important architectural facts reflected in the diagram are:

- The product advertises and waits for a BLE client connection.
- The runtime pipeline only starts once CSC notifications are enabled.
- The active runtime is timer-driven, with three concurrent lanes:
  - IMU processing
  - stroke-rate / DSP update
  - CSC measurement notification
- The DSP path is `sample store -> autocorrelation -> Kalman -> cadence RPM`.
- Disconnects or notification disable events tear the pipeline down and return the app to advertising.

## User Experience

### Main Diagram

The main diagram should present a short narrative rather than an implementation trace.

Proposed path:

`Boot -> BLE advertise -> Client connects -> CSC notifications enabled -> Sensor input -> Stroke estimate -> BLE cadence out`

Design rules:

- Keep the diagram in one compact horizontal story.
- Only three nodes are interactive:
  - `Sensor input`
  - `Stroke estimate`
  - `BLE cadence out`
- Show restart behavior as a light return path to advertising, not as a dominant branch.
- Avoid implementation-heavy labels such as timer names, callback names, or low-level BLE task names in the overview.

### Expanded Diagram Behavior

Clicking an interactive node replaces the main diagram in the same card.

Each expanded view should show three side-by-side lanes:

1. `Sensor / IMU`
2. `DSP / Stroke Rate`
3. `BLE / CSCP`

The clicked lane becomes the focus lane with more steps. The other two lanes stay compact so the user keeps system context.

The expanded views should include a visible close/back control that returns to the main overview.

## Lane Content

### Sensor / IMU Expansion

Focused lane should reflect compile-time routed sensor behavior without turning into a full driver listing.

Show:

- IMU source selected at compile time
- Driver init
- Start acquisition
- Periodic `pp_imu_process()` or event-driven Polar data flow
- Samples pushed toward the stroke-rate path

Keep the branching simple:

- `LIS3DH / MPU6050` can be grouped as local sensor drivers
- `Polar` should be shown as BLE-sourced data with a lighter note that it is event-driven rather than polled

### DSP / Stroke Estimate Expansion

Focused lane should follow the real processing pipeline in `paddling_pulse_stroke_rate.c`.

Show:

- Sample store window
- Autocorrelation
- Confidence / harmonic guard
- Kalman smoothing
- Cadence RPM output

Avoid exposing fixed-point implementation details in the diagram body. Those belong in code, not the landing page.

### BLE / CSCP Expansion

Focused lane should reflect connection and notification gating from `paddling_pulse_app.c`.

Show:

- BLE advertising
- Client connection
- CSC notification enable
- `pipeline_start()`
- CSCP measurement timer
- Cadence notification sent
- Disconnect or notification disable returns to advertising

Keep connection parameter update and manufacturer-data refresh out of the diagram. They are real, but not central to the architectural story.

## Rendering and Layout

### Mermaid Direction

- Main overview should be laid out primarily left-to-right.
- Expanded views should use a stable three-lane layout that reads as parallel responsibilities.
- The focused lane may be taller than the supporting lanes, but widths should stay balanced.

### Node Style

- Use mostly rounded rectangles.
- Reserve diamonds for only true decision points that improve understanding.
- Keep labels to short phrases, ideally 2-4 words.
- Use a single emphasis color for the clicked lane.
- Keep non-focused lanes visually quieter.

### Sizing

The current card feels awkward because Mermaid is allowed to produce uneven node sizing and cramped layouts. The redesign should:

- increase the diagram container height for expanded states
- keep the overview more compact than the detail views
- avoid large multiline labels
- avoid deeply nested subgraphs
- prefer lane grouping over long vertical chains

## Interaction Rules

- Clicking a highlighted node replaces the overview with its detail view.
- Clicking the close control restores the overview.
- Clicking the DSP output action inside the DSP detail view still navigates to `flow.html`.
- Only clicks inside the firmware system flow card should affect the diagram.

## Non-Goals

- Do not turn the site diagram into a literal source-code call graph.
- Do not mirror every BLE callback or every Polar state machine transition.
- Do not add new architecture sections or secondary cards on the page.
- Do not change the Flow Builder itself as part of this redesign.

## Verification Plan

- Add or update regression tests for Mermaid definition generation and click routing.
- Verify the diagram definitions stay Mermaid-compatible across overview and all expanded states.
- Manually verify that overview and each expansion fit cleanly in the card without obviously distorted sizing.
- Confirm the main story matches the real firmware runtime:
  - notifications gate pipeline start
  - three lanes exist in expanded views
  - DSP expansion reflects sample store, autocorrelation, Kalman, and cadence output
