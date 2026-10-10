#!/usr/bin/env python3
"""Author synthetic original sources from ISO XSD/CODA 2.6 layouts.

This independent fixture author NEVER imports or invokes camt2coda. Tests consume
the checked-in files and literal manifest expectations, not this authoring code.
Run with --check to detect an accidental edit without rewriting any fixture.
"""
from pathlib import Path
from decimal import Decimal
import argparse
import json
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
X = {"xs": "http://www.w3.org/2001/XMLSchema"}
FILES = {}
CASES = []
DATE = "2026-10-09"
DDMMYY = "091026"
ACCOUNT = "BE68539007547034"
OTHER_ACCOUNT = "BE71096123456769"


def amount(value):
    return f"{Decimal(str(value)):.3f}"


def unsigned(value):
    return str(int(abs(Decimal(str(value))) * 1000)).zfill(15)


def expected(account=ACCOUNT, currency="EUR", opening=100, closing=112.345,
             amounts=None, signs=None, **extras):
    return dict(account=account, currency=currency, opening=opening, closing=closing,
                amounts=[12.345] if amounts is None else amounts,
                signs=["CRDT"] if signs is None else signs, **extras)


def entry(value=12.345, sign="CRDT", comm="Example invoice 42", ref="E2E-EXAMPLE-42", **extra):
    return dict(value=value, sign=sign, comm=comm, ref=ref, **extra)


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def camt_statement(version, kind="053", account=ACCOUNT, currency="EUR", opening=100,
                   closing=112.345, entries=None, sid="EXAMPLE-001", other=False,
                   repeated=False, datetime=False):
    entries = [entry()] if entries is None else entries
    schema = f"camt.{kind}.001.{version:02}"
    # Schema choices, independently derived from the authoritative source XSD.
    xsd = ET.parse(ROOT.parent / "specifications" / "CAMT" / f"{schema}.xsd").getroot()
    types = {t.attrib["name"]: t for t in xsd.findall("xs:complexType", X)}
    ntry = next(t for name, t in types.items() if name.startswith("ReportEntry"))
    status = next(e.attrib["type"] for e in ntry.findall("xs:sequence/xs:element", X) if e.attrib["name"] == "Sts")
    bic = "BIC" if version == 2 else "BICFI"
    party_wrapper = version >= 7
    part = "Rpt" if kind == "052" else "Stmt"
    body = [f"<{part}><Id>{sid}</Id><ElctrncSeqNb>1</ElctrncSeqNb><CreDtTm>{DATE}T12:00:00Z</CreDtTm>"]
    identifier = f"<Othr><Id>{esc(account)}</Id></Othr>" if other else f"<IBAN>{account}</IBAN>"
    body.append(f"<Acct><Id>{identifier}</Id><Ccy>{currency}</Ccy><Ownr><Nm>Example Company</Nm></Ownr><Svcr><FinInstnId><{bic}>EXAMBEBB</{bic}></FinInstnId></Svcr></Acct>")
    for code, value in [("OPBD", opening), ("CLBD", closing)]:
        # OPBD/CLBD also valid for 052; balances are not transactions.
        body.append(f"<Bal><Tp><CdOrPrtry><Cd>{code}</Cd></CdOrPrtry></Tp><Amt Ccy=\"{currency}\">{amount(abs(value))}</Amt><CdtDbtInd>{'DBIT' if value < 0 else 'CRDT'}</CdtDbtInd><Dt><Dt>{DATE}</Dt></Dt></Bal>")
    for index, item in enumerate(entries, 1):
        sign = item["sign"]
        body.append(f"<Ntry><NtryRef>ENTRY-{index}</NtryRef><Amt Ccy=\"{currency}\">{amount(item['value'])}</Amt><CdtDbtInd>{sign}</CdtDbtInd>")
        if item.get("reversal"):
            body.append("<RvslInd>true</RvslInd>")
        body.append("<Sts><Cd>BOOK</Cd></Sts>" if status in types else "<Sts>BOOK</Sts>")
        day = f"<DtTm>{DATE}T12:00:00Z</DtTm>" if datetime else f"<Dt>{DATE}</Dt>"
        body.append(f"<BookgDt>{day}</BookgDt><ValDt>{day}</ValDt><AcctSvcrRef>BANK-EXAMPLE-{index}</AcctSvcrRef>")
        family = "RCDT" if sign == "CRDT" else "ICDT"
        body.append(f"<BkTxCd><Domn><Cd>PMNT</Cd><Fmly><Cd>{family}</Cd><SubFmlyCd>ESCT</SubFmlyCd></Fmly></Domn></BkTxCd>")
        details = item.get("details", [item])
        detail_xml = []
        for detail in details:
            party = "Dbtr" if detail["sign"] == "CRDT" else "Cdtr"
            party_text = f"<Nm>{esc(detail.get("name", "Example Counterparty"))}</Nm>"
            if party_wrapper:
                party_text = f"<Pty>{party_text}</Pty>"
            refs = f"<Refs><EndToEndId>{esc(detail['ref'])}</EndToEndId></Refs>" if detail.get("ref") else ""
            parts = ["<TxDtls>", refs]
            if 3 <= version <= 6 or detail.get("explicitAmount"):
                parts.append(f'<Amt Ccy="{currency}">{amount(detail["value"])}</Amt><CdtDbtInd>{detail["sign"]}</CdtDbtInd>')
            own_party = "<Dbtr><Pty><Nm>Example Own Party</Nm></Pty></Dbtr>" if detail.get("ownParty") else ""
            parts.append(f"<RltdPties>{own_party}<{party}>{party_text}</{party}></RltdPties>")
            if detail.get("purpose"):
                parts.append(f"<Purp><Cd>{detail['purpose']}</Cd></Purp>")
            if detail.get("structured"):
                remittance = f"<Strd><CdtrRefInf><Tp><CdOrPrtry><Cd>SCOR</Cd></CdOrPrtry><Issr>BBA</Issr></Tp><Ref>{detail['structured']}</Ref></CdtrRefInf></Strd>"
            else:
                remittance = f"<Ustrd>{esc(detail.get('comm', ''))}</Ustrd>"
            parts.append(f"<RmtInf>{remittance}</RmtInf>")
            if detail.get("reason"):
                parts.append(f"<RtrInf><Rsn><Cd>{detail['reason']}</Cd></Rsn></RtrInf>")
            parts.append("</TxDtls>")
            detail_xml.append("".join(parts))
        if repeated:
            body.extend(f"<NtryDtls>{detail}</NtryDtls>" for detail in detail_xml)
        else:
            body.append("<NtryDtls>" + "".join(detail_xml) + "</NtryDtls>")
        body.append("</Ntry>")
    body.append(f"</{part}>")
    return "\n".join(body)


def camt(version=8, kind="053", statements=None, prefix=False, single_quotes=False, **options):
    schema = f"camt.{kind}.001.{version:02}"
    wrapper = "BkToCstmrAcctRpt" if kind == "052" else "BkToCstmrStmt"
    body = statements if statements is not None else [camt_statement(version, kind, **options)]
    text = f'<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="urn:iso:std:iso:20022:tech:xsd:{schema}"><{wrapper}>\n<GrpHdr><MsgId>PUBLIC-EXAMPLE</MsgId><CreDtTm>{DATE}T12:00:00Z</CreDtTm></GrpHdr>\n' + "\n".join(body) + f"\n</{wrapper}></Document>\n"
    if prefix:
        import re
        text = text.replace("xmlns=", "xmlns:bank=")
        text = re.sub(r"<(\/?)([A-Za-z][A-Za-z0-9]*)", r"<\1bank:\2", text)
    if single_quotes:
        text = text.replace('"', "'")
    return text


def line(record, fields):
    """Literal 1-based CODA 2.6 Annexe I positions, independent of src tables."""
    chars = [" "] * 128
    chars[0:len(record)] = record
    for position, width, value in fields:
        value = str(value)
        assert len(value) <= width, (position, width, value)
        chars[position - 1:position - 1 + width] = value.ljust(width)
    result = "".join(chars)
    assert len(result) == 128
    return result


def coda(account=ACCOUNT, currency="EUR", opening=100, closing=112.345,
         entries=None, last="2", extra_information=False, free_text=False, sid="PUBLIC0001"):
    entries = [entry()] if entries is None else entries
    lines = [line("0", [(2, 4, "0000"), (6, 6, DDMMYY), (12, 3, "000"), (15, 2, "05"), (25, 10, sid), (61, 11, "EXAMBEBB"), (84, 5, "00000"), (128, 1, "2")])]
    structure = "2" if account.startswith("BE") else "0"
    lines.append(line("1", [(2, 1, structure), (3, 3, "001"), (6, 34, account), (40, 3, currency), (43, 1, "1" if opening < 0 else "0"), (44, 15, unsigned(opening)), (59, 6, DDMMYY), (65, 26, "Example Company"), (126, 3, "001")]))
    for index, item in enumerate(entries, 1):
        seq = f"{index:04}"
        comm = "101" + item["structured"] if item.get("structured") else item.get("comm", "")
        code = "00150000" if item["sign"] == "CRDT" else "00101000"
        cont = bool(item.get("ref") or len(comm) > 53 or item.get("reason") or item.get("purpose"))
        cp = bool(item.get("counterparty"))
        more23 = cp or len(comm) > 106
        infos = extra_information or len(comm) > 149
        lines.append(line("21", [(3, 4, seq), (7, 4, "0000"), (11, 21, f"BANK-EXAMPLE-{index}"), (32, 1, "1" if item["sign"] == "DBIT" else "0"), (33, 15, unsigned(item["value"])), (48, 6, DDMMYY), (54, 8, code), (62, 1, "1" if item.get("structured") else "0"), (63, 53, comm[:53]), (116, 6, DDMMYY), (122, 3, "001"), (125, 1, "0"), (126, 1, "1" if cont or more23 else "0"), (128, 1, "1" if infos and not(cont or more23) else "0")]))
        if cont:
            lines.append(line("22", [(3, 4, seq), (7, 4, "0000"), (11, 53, comm[53:106]), (64, 35, item.get("ref", "")), (113, 1, "4" if item.get("reversal") else "2" if item.get("reason") else ""), (114, 4, item.get("reason", "")), (122, 4, item.get("purpose", "")), (126, 1, "1" if more23 else "0"), (128, 1, "1" if infos and not more23 else "0")]))
        if more23:
            lines.append(line("23", [(3, 4, seq), (7, 4, "0000"), (11, 34, OTHER_ACCOUNT if cp else ""), (45, 3, currency), (48, 35, item.get("counterparty", "")), (83, 43, comm[106:149]), (126, 1, "0"), (128, 1, "1" if infos else "0")]))
        if infos:
            lines.append(line("31", [(3, 4, seq), (7, 4, "0001"), (11, 21, f"BANK-EXAMPLE-{index}"), (32, 8, code), (40, 1, "1" if item.get("structured") else "0"), (41, 73, comm[:73]), (126, 1, "1" if len(comm) > 73 else "0"), (128, 1, "0")]))
            if len(comm) > 73:
                lines.append(line("32", [(3, 4, seq), (7, 4, "0001"), (11, 105, comm[73:178]), (126, 1, "1" if len(comm) > 178 else "0"), (128, 1, "0")]))
            if len(comm) > 178:
                lines.append(line("33", [(3, 4, seq), (7, 4, "0001"), (11, 90, comm[178:268]), (126, 1, "0"), (128, 1, "0")]))
    if free_text:
        lines.append(line("4", [(3, 4, "0001"), (7, 4, "0001"), (33, 80, "Example bank-only free communication"), (128, 1, "0")]))
    lines.append(line("8", [(2, 3, "001"), (5, 34, account), (39, 3, currency), (42, 1, "1" if closing < 0 else "0"), (43, 15, unsigned(closing)), (58, 6, DDMMYY), (128, 1, "0")]))
    debit = sum(Decimal(str(e["value"])) for e in entries if e["sign"] == "DBIT")
    credit = sum(Decimal(str(e["value"])) for e in entries if e["sign"] == "CRDT")
    lines.append(line("9", [(17, 6, str(sum(row[0] in "1238" for row in lines)).zfill(6)), (23, 15, unsigned(debit)), (38, 15, unsigned(credit)), (128, 1, last)]))
    return "\n".join(lines) + "\n"


def add(identifier, format, content, want, features, schema=None, valid=True):
    path = f"{'invalid' if not valid else format}/{identifier}.{'xml' if format == 'camt' else 'cod'}"
    FILES[path] = content
    CASES.append(dict(id=identifier, format=format, path=path, valid=valid,
                      schema=schema, features=features, expected=want))


def main():
    for kind in ["052", "053"]:
        for version in range(2, 14):
            schema = f"camt.{kind}.001.{version:02}"
            add(schema, "camt", camt(version, kind), [expected(counterparty="Example Counterparty", endToEndId="E2E-EXAMPLE-42", remittance="Example invoice 42")], ["version", "booked-entry", "party", "end-to-end-reference", "three-decimals"], schema)
    schema = "camt.053.001.08"
    add("camt-prefixed-namespace", "camt", camt(prefix=True), [expected()], ["prefixed-namespace"], schema)
    add("camt-single-quoted-namespace", "camt", camt(single_quotes=True), [expected()], ["single-quoted-namespace"], schema)
    add("camt-datetime-choices", "camt", camt(datetime=True), [expected()], ["datetime-choices"], schema)
    add("camt-empty-statement", "camt", camt(entries=[], closing=100), [expected(amounts=[], signs=[], closing=100)], ["empty-statement"], schema)
    add("camt-three-decimal-kwd", "camt", camt(currency="KWD", opening=1.234, closing=1.235, entries=[entry(0.001)]), [expected(currency="KWD", opening=1.234, closing=1.235, amounts=[0.001])], ["currency", "three-decimals"], schema)
    add("camt-debit-and-zero", "camt", camt(opening=1, closing=-1, entries=[entry(2, "DBIT"), entry(0)]), [expected(opening=1, closing=1, amounts=[2, 0], signs=["DBIT", "CRDT"], closingSign="DBIT")], ["debit-balance", "zero-movement"], schema)
    multi = [camt_statement(8), camt_statement(8, account=OTHER_ACCOUNT, sid="EXAMPLE-002", opening=20, closing=21, entries=[entry(1)])]
    add("camt-multiple-statements", "camt", camt(statements=multi), [expected(), expected(account=OTHER_ACCOUNT, opening=20, closing=21, amounts=[1])], ["multiple-statements"], schema)
    add("camt-other-account", "camt", camt(account="EXAMPLE-LOCAL-001", other=True), [expected(account="EXAMPLE-LOCAL-001")], ["other-account"], schema)
    add("camt-structured-ogm", "camt", camt(entries=[entry(structured="010806817183")]), [expected(structuredReference="010806817183")], ["structured-ogm", "checksum"], schema)
    # XSD Ustrd max140, so long text is supplied as two Ustrd occurrences (supported by v08).
    long_text = "A" * 73 + " " + "B" * 36 + " " + "C" * 68 + " " + "D" * 42
    long_xml = camt(entries=[entry(comm=long_text[:110])]).replace(f"<Ustrd>{long_text[:110]}</Ustrd>", f"<Ustrd>{long_text[:110]}</Ustrd><Ustrd>{long_text[110:]}</Ustrd>")
    add("camt-long-remittance", "camt", long_xml, [expected(remittance=long_text)], ["long-remittance", "multiple-unstructured", "continuation-boundary-space"], schema)
    detail_entry = entry(details=[entry(comm="Detail one"), entry(comm="Detail two", ref="E2E-SECOND")])
    add("camt-repeated-entry-details", "camt", camt(entries=[detail_entry], repeated=True), [expected(remittance="Detail two", detailCount=2)], ["repeated-entry-details", "multiple-details"], schema)
    add("camt-return-purpose", "camt", camt(entries=[entry(reason="AC01", reversal=True, purpose="SALA")]), [expected(reason="AC01", reversal=True, purpose="SALA")], ["return-reason", "reversal", "purpose"], schema)
    add("coda-basic-eur", "coda", coda(), [expected(remittance="Example invoice 42", endToEndId="E2E-EXAMPLE-42")], ["original-coda", "three-decimals", "customer-reference"])
    add("coda-empty-statement", "coda", coda(entries=[], closing=100), [expected(amounts=[], signs=[], closing=100)], ["empty-statement"])
    add("coda-three-decimal-kwd", "coda", coda(currency="KWD", opening=1.234, closing=1.235, entries=[entry(0.001)]), [expected(currency="KWD", opening=1.234, closing=1.235, amounts=[0.001])], ["currency", "three-decimals"])
    add("coda-debit-and-zero", "coda", coda(opening=1, closing=-1, entries=[entry(2, "DBIT"), entry(0)]), [expected(opening=1, closing=1, amounts=[2, 0], signs=["DBIT", "CRDT"], closingSign="DBIT")], ["debit-balance", "zero-movement"])
    add("coda-multiple-statements", "coda", coda(last="1") + coda(account=OTHER_ACCOUNT, opening=20, closing=21, entries=[entry(1)], sid="PUBLIC0002"), [expected(), expected(account=OTHER_ACCOUNT, opening=20, closing=21, amounts=[1])], ["multiple-statements", "multiple-file-indicator"])
    add("coda-counterparty", "coda", coda(entries=[entry(counterparty="Example Counterparty")]), [expected(counterparty="Example Counterparty", endToEndId="E2E-EXAMPLE-42")], ["counterparty-account", "counterparty-name"])
    add("coda-structured-ogm", "coda", coda(entries=[entry(structured="010806817183")], extra_information=True), [expected(structuredReference="010806817183")], ["structured-ogm", "information-record"])
    add("coda-long-remittance", "coda", coda(entries=[entry(comm=long_text)], extra_information=True), [expected(remittance=long_text)], ["record-3.3", "long-remittance", "continuation-boundary-space"])
    add("coda-return-purpose", "coda", coda(entries=[entry(reason="AC01", reversal=True, purpose="SALA")]), [expected(reason="AC01", reversal=True, purpose="SALA")], ["return-reason", "reversal", "purpose"])
    add("coda-free-communication", "coda", coda(free_text=True), [expected()], ["record-4", "documented-loss"])
    add("coda-crlf", "coda", coda().replace("\n", "\r\n"), [expected()], ["crlf"])
    valued = entry(details=[entry(6, comm="Breakdown 1", explicitAmount=True), entry(6.345, comm="Breakdown 2", explicitAmount=True)])
    add("camt-monetary-details", "camt", camt(entries=[valued]), [expected(detailAmounts=[6, 6.345])], ["monetary-details", "no-double-counting"], schema)
    invalid_detail = camt(entries=[entry(details=[entry(1.0001, explicitAmount=True)])]).replace(">1.000</Amt>", ">1.0001</Amt>")
    add("camt-detail-subprecision", "camt", invalid_detail, [], ["detail-subprecision"], valid=False)
    mixed = entry(details=[entry(15, explicitAmount=True), entry(2.655, "DBIT", explicitAmount=True, name="Paid Supplier", ownParty=True)])
    add("camt-mixed-sign-details", "camt", camt(entries=[mixed]), [expected(detailAmounts=[15, 2.655], detailSigns=["CRDT", "DBIT"], detailCounterparties=["Example Counterparty", "Paid Supplier"])], ["mixed-sign-details", "own-and-counterparty", "creditor-role"], schema)
    returned = entry(details=[entry(6, explicitAmount=True, reason="AC01"), entry(6.345, explicitAmount=True)])
    add("camt-local-detail-return-reason", "camt", camt(entries=[returned]), [expected(detailAmounts=[6, 6.345], detailReasons=["AC01", None])], ["detail-return-reason", "no-sibling-contamination"], schema)
    detailed = coda().splitlines()
    for number, value in [(1, 6), (2, 6.345)]:
        detail = list(detailed[2])
        detail[6:10] = f"{number:04}"
        detail[10:31] = f"DETAIL-BANK-{number}".ljust(21)
        detail[32:47] = unsigned(value)
        detail[62:115] = f"Breakdown {number}".ljust(53)
        detail[125] = "0"
        detail[127] = "0"
        detailed.insert(-2, "".join(detail))
    detailed[-1] = detailed[-1][:16] + "000006" + detailed[-1][22:]
    add("coda-monetary-details", "coda", "\n".join(detailed) + "\n", [expected(detailAmounts=[6, 6.345], detailBankReferences=["DETAIL-BANK-1", "DETAIL-BANK-2"])], ["monetary-details", "no-double-counting", "detail-bank-reference"])
    bban = coda(account="539007547034").splitlines()
    for index, start in [(1, 5), (-2, 4)]:
        bban[index] = bban[index][:start] + "539007547034 EUR".ljust(37) + bban[index][start+37:]
    add("coda-belgian-bban", "coda", "\n".join(bban) + "\n", [expected(account="539007547034")], ["belgian-bban", "packed-currency"])
    maximum = 999999999999.999
    add("camt-maximum-coda-amount", "camt", camt(opening=0, closing=maximum, entries=[entry(maximum)]), [expected(opening=0, closing=maximum, amounts=[maximum])], ["maximum-amount", "fixed-point"], schema)
    add("coda-maximum-amount", "coda", coda(opening=0, closing=maximum, entries=[entry(maximum)]), [expected(opening=0, closing=maximum, amounts=[maximum])], ["maximum-amount", "fixed-point"])
    add("camt-negative-opening", "camt", camt(opening=-20, closing=-7.655), [expected(opening=20, closing=7.655, openingSign="DBIT", closingSign="DBIT")], ["negative-opening", "negative-closing"], schema)
    add("coda-negative-opening", "coda", coda(opening=-20, closing=-7.655), [expected(opening=20, closing=7.655, openingSign="DBIT", closingSign="DBIT")], ["negative-opening", "negative-closing"])
    add("camt-foreign-iban", "camt", camt(account="NL91ABNA0417164300"), [expected(account="NL91ABNA0417164300")], ["foreign-iban"], schema)
    add("coda-foreign-iban", "coda", coda(account="NL91ABNA0417164300").replace("10001NL", "13001NL"), [expected(account="NL91ABNA0417164300")], ["foreign-iban"])
    add("camt-mixed-currency", "camt", camt().replace('<Ntry><NtryRef>ENTRY-1</NtryRef><Amt Ccy="EUR">', '<Ntry><NtryRef>ENTRY-1</NtryRef><Amt Ccy="USD">'), [], ["mixed-currency"], valid=False)
    add("camt-subprecision", "camt", camt().replace(">12.345</Amt>", ">12.3456</Amt>"), [], ["subprecision"], valid=False)
    add("camt-tiny-subprecision", "camt", camt().replace(">12.345</Amt>", ">0.0000001</Amt>"), [], ["tiny-subprecision", "no-tolerance-rounding"], valid=False)
    add("camt-large-subprecision", "camt", camt().replace(">12.345</Amt>", ">999999999999.9990001</Amt>"), [], ["large-subprecision", "validate-before-float"], valid=False)
    add("camt-overflow", "camt", camt().replace(">12.345</Amt>", ">1000000000000.000</Amt>"), [], ["overflow"], valid=False)
    add("camt-unsupported-version", "camt", camt().replace("camt.053.001.08", "camt.053.001.99"), [], ["unsupported-version"], valid=False)
    broken_link = coda().splitlines()
    broken_link[2] = broken_link[2][:125] + "0" + broken_link[2][126:]
    add("coda-broken-continuation", "coda", "\n".join(broken_link) + "\n", [], ["continuation-link"], valid=False)
    wrong_account = coda().splitlines()
    wrong_account[-2] = wrong_account[-2][:4] + OTHER_ACCOUNT.ljust(34) + wrong_account[-2][38:]
    add("coda-mismatched-closing-account", "coda", "\n".join(wrong_account) + "\n", [], ["account-consistency"], valid=False)
    add("camt-unclosed", "camt", camt().replace("</Document>", ""), [], ["syntax"], valid=False)
    add("camt-nonnumeric-amount", "camt", camt().replace(">12.345</Amt>", ">not-a-number</Amt>"), [], ["numeric-domain"], valid=False)
    add("camt-missing-account", "camt", camt().replace(f"<IBAN>{ACCOUNT}</IBAN>", ""), [], ["required-account"], valid=False)
    add("coda-invalid-ogm-checksum", "coda", coda(entries=[entry(structured="010806817184")], extra_information=True), [], ["invalid-ogm-checksum"], valid=False)
    add("coda-empty", "coda", "", [], ["empty-input"], valid=False)
    add("coda-short-record", "coda", coda().replace("\n", "\n", 1)[1:], [], ["line-width"], valid=False)
    add("coda-missing-trailer", "coda", "\n".join(coda().splitlines()[:-1]) + "\n", [], ["required-trailer"], valid=False)
    numeric = coda().splitlines()
    numeric[2] = numeric[2][:32] + "X" * 15 + numeric[2][47:]
    add("coda-nonnumeric-amount", "coda", "\n".join(numeric) + "\n", [], ["numeric-domain"], valid=False)
    trailer = coda().splitlines()
    trailer[-1] = trailer[-1][:37] + "000000000000000" + trailer[-1][52:]
    add("coda-wrong-trailer-total", "coda", "\n".join(trailer) + "\n", [], ["trailer-total"], valid=False)
    FILES["manifest.json"] = json.dumps(dict(provenance="Synthetic original source fixtures authored independently from ISO 20022 XSDs and CODA 2.6 Annexe I; no converter imports or private bank data.", cases=CASES), indent=2) + "\n"
    args = argparse.ArgumentParser()
    args.add_argument("--check", action="store_true")
    check = args.parse_args().check
    for filename, text in FILES.items():
        path = ROOT / filename
        if check:
            assert path.read_bytes() == text.encode(), f"Fixture differs: {filename}"
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(text.encode())
    print(f"{'Checked' if check else 'Authored'} {len(CASES)} independent source fixtures")


if __name__ == "__main__":
    main()
