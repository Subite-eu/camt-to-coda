# HTTP API

The Node server serves the built browser app and a separate conversion API. **API requests upload statements to the Node server**; conversions performed through the browser UI run locally in its worker. The hosted static sites do not provide this Node API.

## Start the server

From a source checkout with dependencies installed:

```bash
npm run build
npm run build:web
node dist/cli.js serve --port 3000 --host 127.0.0.1
```

Defaults are loopback host `127.0.0.1`, port `3000`, and a **10 MiB** request body limit. `--max-body-mb 20` sets a 20 × 1024 × 1024-byte limit, including multipart overhead. `--cors-origin https://example.com` enables that exact browser origin; without it the server sends no CORS allowance. There is no built-in authentication. Bind another interface explicitly when required by your deployment.

## Health

```bash
curl --fail http://127.0.0.1:3000/api/health
```

`GET /api/health` returns `200` with `{"status":"ok"}`.

## Conversion requests

`POST /api/convert` accepts one UTF-8 source document. It may contain several statements. Raw bodies support `application/xml`, `text/xml`, `text/plain` or `application/octet-stream`; an absent Content-Type is also accepted. JSON is not a supported input envelope.

```bash
# CAMT → CODA; direction detected from leading XML markup.
curl --fail-with-body -H 'Content-Type: application/xml' --data-binary @examples/camt/camt.053.001.08.xml http://127.0.0.1:3000/api/convert

# CODA → CAMT with an explicit output namespace.
curl --fail-with-body -H 'Content-Type: text/plain' --data-binary @examples/coda/coda-basic-eur.cod 'http://127.0.0.1:3000/api/convert?direction=coda-to-camt&camt-version=camt.053.001.08'

# Multipart upload and privacy export; let curl set the boundary.
curl --fail-with-body -F 'file=@examples/coda/coda-basic-eur.cod' -F 'anonymize=true' http://127.0.0.1:3000/api/convert
```

Multipart requests use `multipart/form-data` with a `file` part (a part with a filename is also recognized). The first matching file is converted; this is not a multi-file batch endpoint.

| Query parameter | Behavior |
|---|---|
| `direction` | Optional `camt-to-coda` or `coda-to-camt`. Otherwise leading `<` selects CAMT; other input selects CODA. |
| `camt-version` | Reverse output only, camt.053.001.02 through .13; default camt.053.001.08. Forward input versions are detected from XML. |
| `anonymize` | Literal `true` enables privacy export in either direction. A multipart `anonymize` part accepts `true` or `1`. |

## Successful responses

Responses are JSON, including converted content; the API does not return a binary file or ZIP.

**Forward:** `{ direction: "camt-to-coda", files, version, validation }`. `files` has one item per statement, each with `fileName`, `lines`, `recordCount` and `validation`. Normally `lines` contains annotated `CodaLine` objects with `raw` text and field metadata. With anonymization enabled, `lines` contains raw string records and filenames are generic `statement-N.cod`. To save a file, join the raw strings (or normal `line.raw` values) with line breaks.

**Reverse:** `{ direction: "coda-to-camt", xml, lines, fileName, statement, statements, warnings, validation }`. `xml` contains all reconstructed statements. `statements` is the full model array; `statement` is its first element for compatibility. Normal `lines` contains parsed CODA records and the filename is `converted-statements.xml`.

Successful validation includes `valid`, `errors`, `warnings`, `checks: ["syntax", "structure", "business", "reconciliation"]` and **`xsdValidated: false`**. These are runtime checks, not full XSD validation. Clients should surface conversion warnings as well as validation failures. See [limitations](conversion-limitations.md) for losses and version-specific detail restrictions.

## Privacy responses

Forward privacy export anonymizes CODA lines and uses generic filenames. Reverse privacy export rebuilds XML from an allowlisted anonymized model, replaces the filename with `anonymized-statements.xml`, returns `lines: []`, and uses generic warnings so original references are not echoed through those fields. Amounts, dates, currencies and transaction patterns remain; deterministic pseudonyms can be linked. Synthetic account identifiers must not be used for bank import.

The server necessarily receives the original request. Anonymization describes the result artifact, not an upload-free API or a guarantee that retained financial patterns cannot identify someone. Use independently invented [examples](../examples/README.md) for public testing.

## Errors

| Status | Typical cause |
|---|---|
| `400` | Empty/malformed input, invalid direction, missing multipart file/boundary, unsupported namespace/output version, or a conversion exception |
| `413` | Declared or streamed body exceeds the configured cap |
| `415` | Unsupported Content-Type, including `application/json` |
| `422` | Modeled CAMT/CODA validation or reconciliation failed |
| `500` | Unexpected server error |

Errors have an `error` string and may include `validation`. Error validation shapes vary by failure stage; clients must not assume every error includes `checks` or `xsdValidated`. Treat all non-2xx responses as failed conversions.
