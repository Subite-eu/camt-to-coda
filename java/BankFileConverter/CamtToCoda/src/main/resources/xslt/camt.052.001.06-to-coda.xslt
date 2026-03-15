<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:c="urn:iso:std:iso:20022:tech:xsd:camt.052.001.06" xmlns:cf="http://custom.functions.subite.eu/cf"
	extension-element-prefixes="cf">

	<xsl:include href="camt.052.001.XX-to-coda.xslt" />

	<xsl:template match="/c:Document/c:BkToCstmrAcctRpt">
		<xsl:message select="concat('Starting in debug mode: ', $debug.mode)" />
		<xsl:call-template name="handleDocument" />
	</xsl:template>

	<!-- ======================== Document - START ======================== -->
	<xsl:template name="handleDocument">
		<xsl:variable name="reportDate" select="cf:getReportDate(c:GrpHdr/c:CreDtTm, '', '')" />
		<xsl:message select="concat('Report Date[', $reportDate, ']')" />

		<xsl:for-each select="c:Rpt">
			<xsl:call-template name="handleReport">
				<xsl:with-param name="reportDate">
					<xsl:value-of select="$reportDate" />
				</xsl:with-param>
			</xsl:call-template>
		</xsl:for-each>
	</xsl:template>
	<!-- ======================== Document - END ======================== -->

	<!-- ======================== Report - START ======================== -->
	<xsl:template name="handleReport">
		<xsl:param name="reportDate" />

		<xsl:variable name="accountNumber"
			select="cf:getBankAccount(
				c:Acct/c:Id/c:IBAN,
				c:Acct/c:Id/c:Othr/c:Id)" />

		<xsl:variable name="bic"
			select="cf:getBic(
			c:Acct/c:Ownr/c:Id/c:OrgId/c:AnyBIC, 
			c:Acct/c:Svcr/c:FinInstnId/c:BIC,
			true())" />

		<xsl:variable name="currency" select="cf:getCurrency(c:Acct/c:Ccy, c:Bal[1]/c:Amt/@Ccy)" />

		<xsl:variable name="stmtId" select="c:Id" />

		<xsl:variable name="sequence"
			select="cf:getReportSequence(../c:Rpt/c:LglSeqNb, ../c:Rpt/c:ElctrncSeqNb, $reportDate, $accountNumber)" />

		<xsl:variable name="fileName"
			select="concat(cf:dateToYYYY-MM-DD($reportDate), '-', $accountNumber, '-', $currency, '-', $stmtId, '-CAMT-052.cod')" />

		<xsl:message
			select="concat('AccountNumber[', $accountNumber, '] - Currency[', $currency, '] - StmtId[', $stmtId, ']')" />
		<xsl:message select="concat('Output fileName[', $fileName, ']')" />

		<!-- BALANCE CHECK -->
		<xsl:variable name="openingBalance"
			select="cf:getSignedAmount(
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPAV']/c:Amt/text(), 
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPAV']/c:CdtDbtInd)" />

		<xsl:variable name="mvt"
			select="round(sum(cf:getSumSignedAmounts(c:Bal[c:Tp/c:CdOrPrtry != 'OPAV' and c:Tp/c:CdOrPrtry != 'INFO'])), 2)" />

		<xsl:variable name="closingBalance"
			select="cf:getSignedAmount(
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'INFO']/c:Amt/text(), 
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'INFO']/c:CdtDbtInd)" />

		<xsl:message select="cf:checkBalances($openingBalance, $mvt, $closingBalance)" />

		<!-- START WRITING -->
		<xsl:result-document href="{$fileName}" method="text">

			<xsl:call-template name="createRecord.0">
				<xsl:with-param name="date">
					<xsl:value-of select="$reportDate" />
				</xsl:with-param>
				<xsl:with-param name="bic">
					<xsl:value-of select="$bic" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:call-template name="createRecord.1">
				<xsl:with-param name="accountNumber">
					<xsl:value-of select="$accountNumber" />
				</xsl:with-param>
				<xsl:with-param name="sequence">
					<xsl:value-of select="$sequence" />
				</xsl:with-param>
				<xsl:with-param name="currency">
					<xsl:value-of select="$currency" />
				</xsl:with-param>
				<xsl:with-param name="openingBalance">
					<xsl:value-of select="c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPAV']/c:Amt" />
				</xsl:with-param>
				<xsl:with-param name="openingBalanceDate">
					<xsl:value-of select="c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPAV']/c:Dt/c:Dt" />
				</xsl:with-param>
				<xsl:with-param name="ownerName">
					<xsl:value-of select="c:Acct/c:Ownr/c:Nm" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:for-each select="c:Bal[c:Tp/c:CdOrPrtry != 'OPAV' and c:Tp/c:CdOrPrtry != 'INFO']">
				<xsl:variable name="continuousSequenceNumber" select="cf:padLeft(position(), 4, '0')" />

				<xsl:variable name="counterPartIban" select="c:Tp/c:SubTp/c:Prtry" />

				<xsl:variable name="counterPartBic" select="c:Tp/c:CdOrPrtry/c:Prtry" />

				<xsl:variable name="balDate"
					select="cf:getValueDate(c:Dt/c:Dt, c:Avlbty/c:Dt/c:Dt/c:ActlDt, '', $reportDate)" />

				<xsl:call-template name="createRecord.2.1">
					<xsl:with-param name="continuousSequenceNumber">
						<xsl:value-of select="$continuousSequenceNumber" />
					</xsl:with-param>
					<xsl:with-param name="movementDirection">
						<xsl:value-of select="cf:getMovementDirection(c:CdtDbtInd)" />
					</xsl:with-param>
					<xsl:with-param name="amount">
						<xsl:value-of select="c:Amt" />
					</xsl:with-param>
					<xsl:with-param name="valueDate">
						<xsl:value-of select="$balDate" />
					</xsl:with-param>
					<xsl:with-param name="ref">
						<xsl:value-of select="''" />
					</xsl:with-param>
					<xsl:with-param name="comm">
						<xsl:value-of select="substring('', 1, 53)" />
					</xsl:with-param>
					<xsl:with-param name="entryDate">
						<xsl:value-of select="$balDate" />
					</xsl:with-param>
					<xsl:with-param name="needRecord2.2_or_3">
						<xsl:value-of select="$counterPartIban or $counterPartBic" />
					</xsl:with-param>
				</xsl:call-template>

				<xsl:if test="$counterPartIban or $counterPartBic">
					<xsl:call-template name="createRecord.2.2">
						<xsl:with-param name="continuousSequenceNumber">
							<xsl:value-of select="$continuousSequenceNumber" />
						</xsl:with-param>
						<xsl:with-param name="counterPartBic">
							<xsl:value-of select="$counterPartBic" />
						</xsl:with-param>
						<xsl:with-param name="comm">
							<xsl:value-of select="''" />
						</xsl:with-param>
						<xsl:with-param name="needRecord2.3">
							<xsl:value-of select="$counterPartIban" />
						</xsl:with-param>
					</xsl:call-template>
				</xsl:if>

				<xsl:if test="$counterPartIban">
					<xsl:call-template name="createRecord.2.3">
						<xsl:with-param name="continuousSequenceNumber">
							<xsl:value-of select="$continuousSequenceNumber" />
						</xsl:with-param>
						<xsl:with-param name="counterPartIban">
							<xsl:value-of select="$counterPartIban" />
						</xsl:with-param>
						<xsl:with-param name="currency">
							<xsl:value-of select="c:Amt/@Ccy" />
						</xsl:with-param>
						<xsl:with-param name="counterPartName">
							<xsl:value-of select="''" />
						</xsl:with-param>
						<xsl:with-param name="comm">
							<xsl:value-of select="''" />
						</xsl:with-param>
					</xsl:call-template>
				</xsl:if>
			</xsl:for-each>

			<xsl:call-template name="createRecord.8">
				<xsl:with-param name="accountNumber">
					<xsl:value-of select="c:Acct/c:Id/c:Othr/c:Id" />
				</xsl:with-param>
				<xsl:with-param name="sequence">
					<xsl:value-of select="$sequence" />
				</xsl:with-param>
				<xsl:with-param name="currency">
					<xsl:value-of select="$currency" />
				</xsl:with-param>
				<xsl:with-param name="closingBalance">
					<xsl:value-of select="$closingBalance" />
				</xsl:with-param>
				<xsl:with-param name="closingBalanceDate">
					<xsl:value-of select="c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'INFO']/c:Dt/c:Dt" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:call-template name="createRecord.9">
				<xsl:with-param name="nbRecords">
					<xsl:value-of select="cf:countAllRecords052(c:Bal[c:Tp/c:CdOrPrtry != 'OPAV' and c:Tp/c:CdOrPrtry != 'INFO'])" />
				</xsl:with-param>
				<xsl:with-param name="sumDebits">
					<xsl:value-of
						select="format-number(sum(c:Bal[c:Tp/c:CdOrPrtry != 'OPAV' and c:Tp/c:CdOrPrtry != 'INFO' and c:CdtDbtInd = 'DBIT']/c:Amt), '0.00')" />
				</xsl:with-param>
				<xsl:with-param name="sumCredits">
					<xsl:value-of
						select="format-number(sum(c:Bal[c:Tp/c:CdOrPrtry != 'OPAV' and c:Tp/c:CdOrPrtry != 'INFO' and c:CdtDbtInd = 'CRDT']/c:Amt), '0.00')" />
				</xsl:with-param>
			</xsl:call-template>
		</xsl:result-document>

	</xsl:template>

	<xsl:function name="cf:getSumSignedAmounts">
		<xsl:param name="nodes" />
		<xsl:for-each select="$nodes">
			<xsl:sequence select="cf:getSignedAmount(c:Amt/text(), c:CdtDbtInd)" />
		</xsl:for-each>
	</xsl:function>

	<!-- Count all records for Record 9: 1(rec1) + per-balance-entry records + 1(rec8) -->
	<xsl:function name="cf:countAllRecords052" as="xs:integer">
		<xsl:param name="entries" />
		<xsl:sequence select="2 + sum(for $e in $entries return cf:countBalEntryRecords($e))" />
	</xsl:function>

	<xsl:function name="cf:countBalEntryRecords" as="xs:integer">
		<xsl:param name="e" />
		<!-- Record 2.1 always -->
		<xsl:variable name="rec21" select="1" />
		<!-- Record 2.2: if counterpart BIC or IBAN present -->
		<xsl:variable name="counterPartIban" select="$e/c:Tp/c:SubTp/c:Prtry" />
		<xsl:variable name="counterPartBic" select="$e/c:Tp/c:CdOrPrtry/c:Prtry" />
		<xsl:variable name="rec22" select="if ($counterPartIban or $counterPartBic) then 1 else 0" />
		<!-- Record 2.3: if counterpart IBAN present -->
		<xsl:variable name="rec23" select="if ($counterPartIban) then 1 else 0" />
		<xsl:sequence select="$rec21 + $rec22 + $rec23" />
	</xsl:function>
	<!-- ======================== Report - END ======================== -->
</xsl:stylesheet>
  