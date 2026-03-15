#!/usr/bin/env python3
"""
CAMT XML Anonymizer — replaces all sensitive data with deterministic fakes.
Produces valid IBANs (mod-97 check digits) and maintains referential integrity.

Usage:
    python3 anonymize.py <input_dir_or_file> <output_dir>
"""

import sys, os, re, hashlib, random, copy
from xml.etree import ElementTree as ET
from pathlib import Path

SEED = 42

# ── Deterministic generators seeded per original value ──────────────────────

def _seeded_random(original: str) -> random.Random:
    """Deterministic random from original value — same input always gives same output."""
    h = int(hashlib.sha256((str(SEED) + original).encode()).hexdigest(), 16)
    return random.Random(h)

# ── IBAN generator with valid mod-97 check digits ───────────────────────────

def _letters_to_digits(s: str) -> str:
    return ''.join(str(ord(c) - ord('A') + 10) if c.isalpha() else c for c in s.upper())

def _compute_check_digits(country: str, bban: str) -> str:
    rearranged = bban + _letters_to_digits(country) + "00"
    remainder = int(rearranged) % 97
    check = 98 - remainder
    return f"{check:02d}"

def _validate_iban(iban: str) -> bool:
    if not iban or len(iban) < 5:
        return False
    rearranged = iban[4:] + iban[:4]
    numeric = _letters_to_digits(rearranged)
    return int(numeric) % 97 == 1

_iban_cache: dict[str, str] = {}

def fake_iban(original: str) -> str:
    if original in _iban_cache:
        return _iban_cache[original]
    r = _seeded_random(original)
    country = original[:2] if len(original) >= 2 and original[:2].isalpha() else "BE"
    if country == "BE":
        bank = f"{r.randint(100,999)}"
        acct = f"{r.randint(1000000,9999999)}"
        nat_check = int(bank + acct) % 97
        if nat_check == 0: nat_check = 97
        bban = f"{bank}{acct}{nat_check:02d}"
    elif country == "LT":
        bban = f"{r.randint(10000,99999)}{r.randint(10000000000,99999999999)}"
    elif country == "NL":
        banks = ["ABNA", "INGB", "RABO", "KNAB"]
        bban = banks[r.randint(0, len(banks)-1)] + f"{r.randint(1000000000,9999999999)}"
    elif country == "DE":
        bban = f"{r.randint(10000000,99999999)}{r.randint(1000000000,9999999999)}"
    elif country == "FR":
        bban = f"{r.randint(10000,99999)}{r.randint(10000,99999)}{r.randint(10000000000,99999999999)}{r.randint(10,99)}"
    elif country == "IT":
        bban = chr(r.randint(65,90)) + f"{r.randint(10000,99999)}{r.randint(10000,99999)}{r.randint(100000000000,999999999999)}"
    elif country == "GR":
        bban = f"{r.randint(100,999)}{r.randint(1000,9999)}{r.randint(10000000000000,99999999999999)}"
    elif country == "ES":
        bban = f"{r.randint(1000,9999)}{r.randint(1000,9999)}{r.randint(10,99)}{r.randint(1000000000,9999999999)}"
    elif country == "PT":
        bban = f"{r.randint(1000,9999)}{r.randint(1000,9999)}{r.randint(10000000000,99999999999)}{r.randint(10,99)}"
    else:
        bban = f"{r.randint(100000000000,999999999999)}"
        country = "BE"

    check = _compute_check_digits(country, bban)
    result = f"{country}{check}{bban}"
    assert _validate_iban(result), f"Generated invalid IBAN: {result} from {original}"
    _iban_cache[original] = result
    return result

# ── BIC generator ───────────────────────────────────────────────────────────

_bic_cache: dict[str, str] = {}
_BIC_BANKS = ["BNPA", "GEBA", "KRED", "ABNA", "INGB", "RABO", "DEUT", "SWED", "NDEA", "FINA", "HBUK", "BKAU"]

def fake_bic(original: str) -> str:
    if original in _bic_cache:
        return _bic_cache[original]
    r = _seeded_random(original)
    bank = _BIC_BANKS[r.randint(0, len(_BIC_BANKS)-1)]
    country = original[4:6] if len(original) >= 6 and original[4:6].isalpha() else "BE"
    loc = chr(r.randint(65,90)) + str(r.randint(0,9))
    bic = f"{bank}{country}{loc}"
    if len(original) > 8:
        bic += "".join(chr(r.randint(65,90)) for _ in range(3))
    _bic_cache[original] = bic
    return bic

# ── Name generator ──────────────────────────────────────────────────────────

_name_cache: dict[str, str] = {}
_PREFIXES = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Theta", "Sigma", "Omega", "Nova", "Apex", "Vertex", "Quantum", "Stellar"]
_SUFFIXES = ["Corp", "SA", "NV", "BV", "GmbH", "Ltd", "SRL", "Inc", "Solutions", "Holdings", "Group", "Services"]

def fake_name(original: str) -> str:
    if original in _name_cache:
        return _name_cache[original]
    r = _seeded_random(original)
    name = f"{_PREFIXES[r.randint(0, len(_PREFIXES)-1)]} {_SUFFIXES[r.randint(0, len(_SUFFIXES)-1)]}"
    _name_cache[original] = name
    return name

# ── Reference generator ────────────────────────────────────────────────────

_ref_counter = [0]

def fake_ref(original: str) -> str:
    _ref_counter[0] += 1
    r = _seeded_random(original)
    return f"REF{_ref_counter[0]:08d}{r.randint(1000,9999)}"

def fake_e2e(original: str) -> str:
    r = _seeded_random(original)
    return f"E2E{''.join(chr(r.randint(65,90)) for _ in range(8))}{r.randint(10000000,99999999)}"

def fake_txid(original: str) -> str:
    r = _seeded_random(original)
    return str(r.randint(100000, 999999))

def fake_msgid(original: str) -> str:
    r = _seeded_random(original)
    return f"MSG{r.randint(10000000,99999999)}-{''.join(chr(r.randint(65,90)) for _ in range(6))}"

def fake_remittance(original: str) -> str:
    r = _seeded_random(original)
    templates = ["Payment for invoice {}", "Transfer ref {}", "Settlement {}", "Service fee {}", "Order {} payment"]
    tmpl = templates[r.randint(0, len(templates)-1)]
    return tmpl.format(f"{''.join(chr(r.randint(65,90)) for _ in range(6))}{r.randint(1000,9999)}")

def fake_address_line(original: str) -> str:
    r = _seeded_random(original)
    streets = ["Main Street", "Market Square", "Commerce Ave", "Industry Blvd", "Park Lane", "High Street"]
    return f"{r.randint(1,200)} {streets[r.randint(0, len(streets)-1)]}"

def fake_city(original: str) -> str:
    r = _seeded_random(original)
    cities = ["Anytown", "Bankville", "Clearwater", "Newburgh", "Westfield", "Riverside"]
    return cities[r.randint(0, len(cities)-1)]

def fake_postal(original: str) -> str:
    r = _seeded_random(original)
    return str(r.randint(1000, 9999))

# ── XML anonymization engine ───────────────────────────────────────────────

# Tags to anonymize (local name → handler)
LEAF_HANDLERS = {
    "IBAN": fake_iban,
    "BIC": fake_bic,
    "BICFI": fake_bic,
    "AnyBIC": fake_bic,
    "Nm": fake_name,
    "MsgId": fake_msgid,
    "StmtId": fake_msgid,
    "AcctRptId": fake_msgid,
    "NtryRef": fake_ref,
    "AcctSvcrRef": fake_ref,
    "EndToEndId": lambda o: o if o == "NOTPROVIDED" else fake_e2e(o),
    "TxId": fake_txid,
    "InstrId": lambda o: o if o == "NOTPROVIDED" else fake_msgid(o),
    "Ustrd": lambda o: o if o == "NOTPROVIDED" else fake_remittance(o),
    "StrtNm": fake_address_line,
    "AdrLine": fake_address_line,
    "BldgNb": lambda o: str(_seeded_random(o).randint(1, 200)),
    "PstCd": fake_postal,
    "TwnNm": fake_city,
}

# Tags where Othr/Id under Acct should be treated as account numbers
ACCT_ID_PARENTS = {"Acct"}

def _local(tag: str) -> str:
    """Strip namespace prefix."""
    return tag.split("}")[-1] if "}" in tag else tag

def _has_ancestor(elem, root_map, ancestor_local):
    """Check if element has an ancestor with given local name."""
    parent = root_map.get(elem)
    while parent is not None:
        if _local(parent.tag) == ancestor_local:
            return True
        parent = root_map.get(parent)
    return parent

def _build_parent_map(root):
    """Build child→parent map for ancestor lookups."""
    parent_map = {}
    for parent in root.iter():
        for child in parent:
            parent_map[child] = parent
    return parent_map

def anonymize_tree(root):
    parent_map = _build_parent_map(root)

    for elem in list(root.iter()):
        local = _local(elem.tag)
        text = (elem.text or "").strip()
        if not text:
            continue

        # Special: Id under Othr under Acct → treat as account identifier
        if local == "Id":
            parent = parent_map.get(elem)
            if parent is not None and _local(parent.tag) == "Othr":
                grandparent = parent_map.get(parent)
                if grandparent is not None and _local(grandparent.tag) == "Id":
                    great = parent_map.get(grandparent)
                    if great is not None and _local(great.tag) in ACCT_ID_PARENTS:
                        if len(text) >= 10:
                            elem.text = fake_iban(text)
                            continue
            # Id directly under Stmt/Rpt → statement ID
            if parent is not None and _local(parent.tag) in ("Stmt", "Rpt"):
                elem.text = fake_msgid(text)
                continue
            continue

        if local == "Ref":
            # Structured communication reference under CdtrRefInf
            parent = parent_map.get(elem)
            if parent is not None and _local(parent.tag) == "CdtrRefInf":
                r = _seeded_random(text)
                elem.text = f"{r.randint(100000000000, 999999999999):012d}"
                continue

        # Prtry tags that look like BICs (8 or 11 chars, SWIFT code pattern)
        if local == "Prtry":
            if re.match(r'^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$', text):
                elem.text = fake_bic(text)
                continue
            # Prtry under SubTp that looks like an account number (e.g., LTxx...)
            parent = parent_map.get(elem)
            if parent is not None and _local(parent.tag) == "SubTp":
                if len(text) >= 10 and re.match(r'^[A-Z]{2}\d', text):
                    elem.text = fake_iban(text)
                    continue

        if local in LEAF_HANDLERS:
            elem.text = LEAF_HANDLERS[local](text)

def anonymize_file(input_path: Path, output_path: Path):
    ET.register_namespace("", "urn:iso:std:iso:20022:tech:xsd:camt.053.001.08")
    ET.register_namespace("", "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02")
    ET.register_namespace("", "urn:iso:std:iso:20022:tech:xsd:camt.052.001.06")
    ET.register_namespace("", "urn:iso:std:iso:20022:tech:xsd:camt.054.001.08")
    ET.register_namespace("", "urn:iso:std:iso:20022:tech:xsd:camt.054.001.02")

    # Read raw to detect namespace
    raw = input_path.read_text(encoding="utf-8")
    ns_match = re.search(r'xmlns="(urn:iso:std:iso:20022:tech:xsd:camt\.\d+\.\d+\.\d+)"', raw)
    if ns_match:
        ET.register_namespace("", ns_match.group(1))

    tree = ET.parse(str(input_path))
    root = tree.getroot()
    anonymize_tree(root)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    tree.write(str(output_path), encoding="unicode", xml_declaration=True)
    # Add trailing newline
    with open(output_path, "a") as f:
        f.write("\n")

def main():
    if len(sys.argv) < 3:
        print(f"Usage: {sys.argv[0]} <input_dir_or_file> <output_dir>")
        sys.exit(1)

    input_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])

    if input_path.is_file():
        output_file = output_dir / input_path.name
        print(f"  {input_path.name}")
        anonymize_file(input_path, output_file)
    elif input_path.is_dir():
        xml_files = sorted(input_path.rglob("*.xml"))
        print(f"Found {len(xml_files)} XML files to anonymize")
        for f in xml_files:
            rel = f.relative_to(input_path)
            out = output_dir / rel
            print(f"  {rel}")
            try:
                anonymize_file(f, out)
            except Exception as e:
                print(f"  ERROR: {e}")
    else:
        print(f"Input not found: {input_path}")
        sys.exit(1)

    print(f"\nAnonymization complete.")
    print(f"  IBANs replaced: {len(_iban_cache)}")
    print(f"  BICs replaced: {len(_bic_cache)}")
    print(f"  Names replaced: {len(_name_cache)}")

if __name__ == "__main__":
    main()
