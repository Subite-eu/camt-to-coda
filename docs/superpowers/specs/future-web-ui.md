# Future: Full Web UI (v2.0)

This document captures the design vision for a rich web-based CAMT-to-CODA converter UI. This is **not in scope for v1.0** — the v1.0 web UI is a minimal serve mode (drag-drop, preview, download). This doc is for when we're ready to build the real thing.

## Vision

A browser-based tool where users can:
1. Upload a CAMT file (drag-and-drop)
2. See the CODA output rendered in real-time with syntax highlighting
3. **Click any character position** in a CODA line and see exactly which CAMT field it came from
4. Inspect field mappings, validation results, and transformation details
5. Edit mapping overrides (e.g., force a different transaction code)
6. Download the CODA file or push directly to S3

## Field Inspector

The killer feature. When a user clicks on position 54-61 of a Record 2.1 line:

```
┌─────────────────────────────────────────────────────┐
│ Record 2.1 — Movement                    line 3     │
│                                                     │
│ 2 1 0001 0000 E2E-REF-12345       0 000000001000 ▌  │
│                                    ▲                │
│                                    └── clicked here │
│                                                     │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Position 54-61: Transaction Code                │ │
│ │                                                 │ │
│ │ Value: "04500001"                               │ │
│ │ Meaning: Incoming SEPA credit transfer          │ │
│ │                                                 │ │
│ │ Source: BkTxCd/Domn                             │ │
│ │   Domain: PMNT                                  │ │
│ │   Family: RCDT                                  │ │
│ │   SubFamily: ESCT                               │ │
│ │                                                 │ │
│ │ Mapping rule: PMNT/RCDT/ESCT → 04500001        │ │
│ └─────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Implementation Approach

Each record builder would return not just a string, but a **field map** — metadata about which positions came from which source:

```typescript
interface CodaField {
  start: number       // 0-indexed position
  end: number
  name: string        // "transaction_code"
  value: string       // "04500001"
  source?: string     // "BkTxCd/Domn/Cd=PMNT, Fmly/Cd=RCDT, SubFmlyCd=ESCT"
  mapping?: string    // "PMNT/RCDT/ESCT → 04500001"
  description?: string // "Incoming SEPA credit transfer"
}

interface CodaLine {
  text: string        // the 128-char line
  recordType: string  // "2.1"
  fields: CodaField[] // metadata for each field
}
```

The v1.0 record builders return plain strings. The v2.0 builders would return `CodaLine` objects. The `.text` property is backward-compatible with v1.0.

### Frontend Stack

- **Framework:** Svelte or vanilla web components (keep it light)
- **Rendering:** Monospace grid with hover/click handlers per character position
- **State:** Reactive — upload file → parse → show results, click position → show field detail
- **No build step for simple version:** Could start as a single HTML file with inline JS, graduate to Svelte when complexity warrants it

### Additional v2 Features

- **Side-by-side view:** CAMT XML on left, CODA output on right, linked highlighting
- **Batch processing dashboard:** Upload multiple files, see progress, download all
- **Mapping overrides:** User can override specific field mappings via UI (saved as config)
- **History:** Local storage of recent conversions for quick re-access
- **CODA spec reference:** Inline documentation — hover over a record type to see the spec description
- **Diff view:** Compare two CODA outputs (e.g., before/after a mapping change)

### API Extensions for v2

The v1.0 API (`POST /api/convert`) returns lines. The v2 API would also return field metadata:

```
POST /api/convert?detail=true

Response:
{
  "fileName": "...",
  "lines": [
    {
      "text": "21000100004500001...",
      "recordType": "2.1",
      "fields": [
        { "start": 0, "end": 0, "name": "record_id", "value": "2" },
        { "start": 1, "end": 1, "name": "article_code", "value": "1" },
        { "start": 53, "end": 60, "name": "transaction_code", "value": "04500001",
          "source": "PMNT/RCDT/ESCT", "description": "Incoming SEPA CT" }
      ]
    }
  ]
}
```

### Estimated Effort

- Field metadata in record builders: 1-2 days
- Basic inspector UI (Svelte): 2-3 days
- Side-by-side CAMT/CODA view: 1-2 days
- Polish + testing: 1-2 days
- **Total: ~1 week**
