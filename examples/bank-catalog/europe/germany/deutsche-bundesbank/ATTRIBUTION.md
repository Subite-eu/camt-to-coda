# Unchanged Deutsche Bundesbank examples

**Quelle: Deutsche Bundesbank**

These 22 XML files are unchanged members of the Bundesbank's official [EBICS archive](https://www.bundesbank.de/resource/blob/943090/3d1c4aa7aa18e86e724a5a42ce10a889/472B63F073F071307366337C94F8C870/beispieldateien-format-camt-052-ebics-data.zip) and [SWIFT archive](https://www.bundesbank.de/resource/blob/943092/4b2c43de91b04dc4cf2b36ee73a025aa/472B63F073F071307366337C94F8C870/beispieldateien-format-camt-052-swift-data.zip), retrieved 2026-10-11. Full archive/member hashes, original names and source quality classifications are in [source-inventory.json](../../../source-inventory.json).

[Bundesbank website terms §4.1](https://www.bundesbank.de/de/startseite/benutzerhinweise/benutzerhinweise-642874?index=2) permit personal/business storage, forwarding and reproduction of its information, unchanged and with the attribution above. These source files retain the publisher's rights and conditions; the repository's MIT licence does not relicense them. Do not edit or normalize these originals. Derived converter outputs are tested separately and must not be represented as Bundesbank publications.

Scope: central-bank cash-account/interbank examples, **not retail banking**. Twenty files illustrate CAMT052 and two CAMT053, intended version08. Five originals declare `xmlns:n0` but leave their actual elements unqualified, including both CAMT053 examples. They are intentionally retained and fail the intended XSD. Other report examples can omit balances required for CODA conversion. These are source/reference fixtures, not a bank certification of this converter.
