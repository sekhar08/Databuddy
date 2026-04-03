# AI Component Streaming & Chart Redesign

**Date:** 2026-04-03
**Status:** Approved

## Goal

Upgrade AI agent chart components to match the dashboard's visual language using the existing composable chart system, and add progressive rendering so charts build incrementally as the agent streams JSON rather than snapping in after completion.

## Non-Goals

- Backwards compatibility with old column-oriented chart JSON format
- Changes to non-chart components (links-list, goals-list, etc.) beyond minor format cleanup
- Agent SDK or model changes

---

## 1. Row-Oriented Component Protocol

All chart components switch from column-oriented to row-oriented data format. This enables progressive rendering because each row is a self-contained data point that can render immediately.

### Time-series (line-chart, bar-chart, area-chart, stacked-bar-chart)

```json
{
  "type": "line-chart",
  "title": "Traffic Over Time",
  "series": ["pageviews", "visitors"],
  "rows": [["Mon", 100, 80], ["Tue", 150, 110], ["Wed", 120, 90]]
}
```

- `series` streams early, enabling legend rendering before data arrives
- Each `rows` entry maps positionally to `series`: `[xLabel, series[0]Value, series[1]Value, ...]`
- Partial rows (truncated mid-array) are dropped by the repair function

### Distribution (pie-chart, donut-chart)

```json
{
  "type": "pie-chart",
  "title": "Device Distribution",
  "rows": [["Desktop", 650], ["Mobile", 280], ["Tablet", 70]]
}
```

- Each row is `[label, value]`
- Slices appear as rows stream in

### Data table

```json
{
  "type": "data-table",
  "title": "Top Pages",
  "columns": ["Page", "Views", "Avg Time"],
  "align": ["left", "right", "right"],
  "rows": [["/home", 1500, "245ms"], ["/pricing", 800, "180ms"]]
}
```

- `columns` and `align` are flat arrays (stream early, before data)
- `rows` are positional arrays matching `columns` order
- `align` is optional (defaults to left for all)

### Non-chart components

Referrers-list, mini-map, links-list, funnels-list, goals-list, annotations-list, and all preview types keep their current object-per-item format. These are small payloads that complete quickly and don't benefit from row-oriented streaming.

---

## 2. Partial JSON Parser

### repairPartialJSON(input: string): string | null

Closes all open syntactic structures in truncated JSON to produce parseable output. Returns null if the input is too incomplete to repair (e.g., just `{"`).

Handles:
- Unclosed strings: `"Traff` -> `"Traff"`
- Unclosed arrays: `[100, 150` -> `[100, 150]`
- Unclosed objects: `{"x": [1, 2]` -> `{"x": [1, 2]}`
- Incomplete key-value pairs: `{"type":"line-chart","tit` -> `{"type":"line-chart"}`
- Trailing commas: `[1, 2,` -> `[1, 2]`
- Nested combinations of all the above

Does NOT handle:
- Malformed JSON that wouldn't be valid even if complete
- Non-JSON text mixed in

Edge case behavior:
- Input too short to identify type (e.g., `{"ty`): returns null, parser treats as text
- Type identified but nothing else (e.g., `{"type":"line-chart"`): repairs to `{"type":"line-chart"}`, renderer shows skeleton
- Complete `rows` entry mid-stream (e.g., `"rows":[["Mon",100,80],["Tue",15`): repairs to `"rows":[["Mon",100,80]]`, drops the partial second row
- Empty rows array (e.g., `"rows":[`): repairs to `"rows":[]`, renderer shows skeleton (no data to plot)

### Parser changes (parseContentSegments)

When brace counting fails to find a closing `}` for a `{"type":"` pattern:

1. Extract partial JSON from `{"type":"` to end of content
2. Call `repairPartialJSON()`
3. If repair produces valid JSON with a known component `type`, emit as `streaming-component` segment
4. If repair fails, treat as text (current behavior)

### New segment type

```typescript
export type ContentSegment =
  | { type: "text"; content: string }
  | { type: "component"; content: RawComponentInput }
  | { type: "streaming-component"; content: RawComponentInput };
```

---

## 3. Progressive Rendering States

Each chart renderer accepts a `streaming?: boolean` prop and handles three states:

### Skeleton state
Triggered when we have `type` but insufficient data to render (no `rows` yet, or `series` not received for time-series).

- Card with the composable `Chart.Surface` shell
- Skeleton shimmer filling the plot area
- Title shown if available
- Chart type icon (line/bar/pie) in the skeleton center

### Partial state
Triggered when `streaming={true}` and we have at least one complete row.

- Chart renders with available data points
- Time-series: line/bars grow left-to-right as rows arrive. Subtle pulse on the rightmost point.
- Distribution: slices appear and angles redistribute with CSS transitions
- Data table: rows appear top-to-bottom, last row fades in
- Legend pills visible (from `series` field)

### Complete state
Triggered when `streaming` is false/undefined (JSON fully parsed).

- Full chart with all data
- Pulse animation removed
- This is the steady state for scrolling back through chat history

### Transition
No explicit transition animation between partial and complete. The chart simply stops growing -- the last row arrives, the pulse stops. This feels natural because the chart was already rendering correctly with partial data.

---

## 4. Chart Renderer Rewrite

Both time-series and distribution renderers are rewritten to use the dashboard's composable chart system.

### Time-series renderer

Uses:
- `Chart.Surface` for the card wrapper (replaces hand-rolled `<Card>`)
- `Chart.Content` for loading/error state handling
- `Chart.Plot` for the Recharts container with consistent background
- `CartesianGrid` with `chartCartesianGridDefault` tokens
- `XAxis` / `YAxis` with `chartAxisTickDefault` tokens and `chartAxisYWidthCompact`
- `chartSeriesColorAtIndex()` for theme-aware series colors (replaces hardcoded `CHART_COLORS`)
- `Chart.createRechartsSingleValueTooltip()` for tooltips (replaces custom tooltip JSX)
- `chartLegendPillClassName` for footer legend pills
- Interactive legend: click a pill to toggle that series on/off (using `activeIndex` state)
- `formatMetricNumber` for axis tick formatting (replaces local `formatNumber`)

Height: 200px (up from 180px to match dashboard charts).

### Distribution renderer

Uses:
- Same composable shell (Surface, Content, Plot)
- `chartSeriesColorAtIndex()` for slice colors
- Dashboard tooltip pattern
- Legend pills in footer with percentages
- Interactive hover with `activeShape` (already implemented, just needs composable tokens)

Height: 220px (up from 200px).

### Data table renderer

Minimal changes:
- Adapt to flat `columns`/`align`/`rows` arrays instead of `columns` objects
- Use dashboard table styling tokens if available
- No composable chart shell needed (it's a table, not a chart)

### Transform layer

New transform functions in the registry that convert row-oriented format to what Recharts expects:

```typescript
// Time-series: rows → [{x, series1, series2, ...}]
function transformTimeSeriesRows(series: string[], rows: unknown[][]) {
  return rows
    .filter(row => row.length === series.length + 1) // drop partial rows
    .map(([x, ...values]) => ({
      x,
      ...Object.fromEntries(series.map((key, i) => [key, values[i]]))
    }));
}

// Distribution: rows → [{name, value}]
function transformDistributionRows(rows: unknown[][]) {
  return rows
    .filter(row => row.length >= 2)
    .map(([name, value]) => ({ name: String(name), value: Number(value) }));
}
```

These transforms are memoized on `rows.length` so they don't re-compute when only the last (potentially partial) row changes.

---

## 5. Prompt Changes

Update `ANALYTICS_CHART_RULES` in `apps/api/src/ai/prompts/analytics.ts` to document the new row-oriented format with examples for each chart type. Remove the old column-oriented examples entirely.

Update the few-shot examples in `ANALYTICS_EXAMPLES` to use the new format.

---

## 6. Zod Schema Updates

Update `apps/dashboard/lib/ai-components/schemas.ts` to validate the new row-oriented format:

- `timeSeriesSchema`: requires `series` (string array) and `rows` (array of arrays)
- `distributionSchema`: requires `rows` (array of [string, number] tuples)
- `dataTableSchema`: requires `columns` (string array), `rows` (array of arrays), optional `align`
- Non-chart schemas: unchanged

---

## 7. Files Changed

| File | Change |
|---|---|
| `lib/ai-components/parser.ts` | Add `repairPartialJSON()`, emit `streaming-component` segments |
| `lib/ai-components/types.ts` | New row-oriented input types, `streaming-component` segment type |
| `lib/ai-components/schemas.ts` | Rewrite chart schemas for row-oriented format |
| `lib/ai-components/registry.tsx` | New validators/transforms for row format |
| `components/ai-elements/ai-component.tsx` | Accept `streaming` prop, pass to renderers |
| `lib/ai-components/renderers/charts/time-series.tsx` | Full rewrite using Chart composable |
| `lib/ai-components/renderers/charts/distribution.tsx` | Full rewrite using Chart composable |
| `lib/ai-components/renderers/data-table.tsx` | Adapt to flat columns/rows format |
| `lib/ai-components/renderers/config.ts` | Remove `CHART_COLORS` (use composable palette) |
| `agent/_components/agent-messages.tsx` | Handle `streaming-component` segment type |
| `apps/api/src/ai/prompts/analytics.ts` | Update chart format in prompt rules and examples |

No new files. The repair utility lives in `parser.ts`.
