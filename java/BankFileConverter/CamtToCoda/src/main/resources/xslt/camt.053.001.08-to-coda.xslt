<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:c="urn:iso:std:iso:20022:tech:xsd:camt.053.001.08" xmlns:cf="http://custom.functions.subite.eu/cf"
	extension-element-prefixes="cf">

	<xsl:include href="camt.053.001.XX-to-coda.xslt" />

	<xsl:template match="/c:Document/c:BkToCstmrStmt">
		<xsl:message select="concat('Starting in debug mode: ', $debug.mode)" />
		<xsl:call-template name="handleDocument" />
	</xsl:template>

	<!-- ======================== Document - START ======================== -->
	<xsl:template name="handleDocument">
		<xsl:for-each select="c:Stmt">
			<xsl:call-template name="handleStmt" />
		</xsl:for-each>
	</xsl:template>
	<!-- ======================== Document - END ======================== -->

	<!-- ======================== Stmt - START ======================== -->
	<xsl:template name="handleStmt">

		<xsl:variable name="reportDate"
			select="cf:getReportDate(c:FrToDt/c:ToDtTm,c:CreDtTm,../c:GrpHdr/c:CreDtTm)" />
		<xsl:message select="concat('Report Date[', $reportDate, ']')" />

		<xsl:variable name="accountNumber"
			select="cf:getBankAccount(
				c:Acct/c:Id/c:IBAN,
				c:Acct/c:Id/c:Othr/c:Id)" />

		<xsl:variable name="bic"
			select="cf:getBic(
			c:Acct/c:Ownr/c:Id/c:OrgId/c:AnyBIC, 
			c:Acct/c:Svcr/c:FinInstnId/c:BIC,
			false())" />

		<xsl:variable name="currency" select="cf:getCurrency(c:Acct/c:Ccy, c:Bal[1]/c:Amt/@Ccy)" />

		<xsl:variable name="stmtId" select="c:Id" />

		<xsl:variable name="sequence"
			select="cf:getReportSequence(../c:Rpt/c:LglSeqNb, ../c:Rpt/c:ElctrncSeqNb, $reportDate, $accountNumber)" />

		<xsl:variable name="fileName"
			select="concat(cf:dateToYYYY-MM-DD($reportDate), '-', $accountNumber, '-', $currency, '-', $stmtId, '-CAMT-053.cod')" />

		<xsl:message
			select="concat('AccountNumber[', $accountNumber, '] - Currency[', $currency, '] - StmtId[', $stmtId, ']')" />
		<xsl:message select="concat('Output fileName[', $fileName, ']')" />

		<!-- BALANCE CHECK -->
		<xsl:variable name="openingBalance"
			select="cf:getSignedAmount(
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPBD']/c:Amt, 
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPBD']/c:CdtDbtInd)" />
		<xsl:variable name="mvt" select="round(sum(cf:getSumSignedAmounts(c:Ntry)), 2)" />
		<xsl:variable name="closingBalance"
			select="cf:getSignedAmount(
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'CLBD']/c:Amt, 
						c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'CLBD']/c:CdtDbtInd)" />
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
					<xsl:value-of select="$openingBalance" />
				</xsl:with-param>
				<xsl:with-param name="openingBalanceDate">
					<xsl:value-of select="c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'OPBD']/c:Dt/c:Dt" />
				</xsl:with-param>
				<xsl:with-param name="ownerName">
					<xsl:value-of select="c:Acct/c:Ownr/c:Nm" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:for-each select="c:Ntry">
				<xsl:variable name="refs">
					<!-- concatenate all nodes -->
					<xsl:value-of select="c:NtryDtls/c:TxDtls/c:Refs/*[text() != 'NOTPROVIDED']" separator="/" />
				</xsl:variable>

				<!-- Transaction code from ISO 20022 BkTxCd/Domn -->
				<xsl:variable name="transactionCode"
					select="cf:getTransactionCodeFromEntry(
						string(c:BkTxCd/c:Domn/c:Cd),
						string(c:BkTxCd/c:Domn/c:Fmly/c:Cd),
						string(c:BkTxCd/c:Domn/c:Fmly/c:SubFmlyCd))" />

				<!-- Structured vs unstructured remittance -->
				<xsl:variable name="hasStructuredComm"
					select="c:NtryDtls/c:TxDtls/c:RmtInf/c:Strd/c:CdtrRefInf/c:Ref != ''" />
				<xsl:variable name="structuredComm"
					select="c:NtryDtls/c:TxDtls/c:RmtInf/c:Strd/c:CdtrRefInf/c:Ref" />

				<xsl:variable name="commType">
					<xsl:choose>
						<xsl:when test="$hasStructuredComm">1</xsl:when>
						<xsl:otherwise>0</xsl:otherwise>
					</xsl:choose>
				</xsl:variable>

				<xsl:variable name="rawComm">
					<xsl:choose>
						<xsl:when test="$hasStructuredComm">
							<xsl:value-of select="concat('101', cf:padRight($structuredComm, 12, '0'))" />
						</xsl:when>
						<xsl:otherwise>
							<xsl:value-of select="cf:getComm(c:NtryDtls/c:TxDtls/c:RmtInf/c:Ustrd[text() != 'NOTPROVIDED'], c:NtryDtls/c:Btch/c:NbOfTxs, $refs)" />
						</xsl:otherwise>
					</xsl:choose>
				</xsl:variable>

				<xsl:variable name="comm" select="string($rawComm)" />

				<!-- Detect if Record 3 is needed: batch with multiple TxDtls -->
				<xsl:variable name="batchTxDetails" select="c:NtryDtls/c:TxDtls" />
				<xsl:variable name="needRecord3" select="count($batchTxDetails) > 1" />

				<xsl:variable name="needRecord2.2"
					select="string-length($comm) > 53
							or (c:CdtDbtInd = 'DBIT' and c:NtryDtls/c:TxDtls/c:RltdAgts/c:CdtrAgt/c:FinInstnId/c:BIC)
							or (c:CdtDbtInd = 'CRDT' and c:NtryDtls/c:TxDtls/c:RltdAgts/c:DbtrAgt/c:FinInstnId/c:BIC)" />

				<xsl:variable name="needRecord2.3"
					select="string-length($comm) > 106
							or (c:CdtDbtInd = 'DBIT' and c:NtryDtls/c:TxDtls/c:RltdPties/c:CdtrAcct/c:Id/c:IBAN)
							or (c:CdtDbtInd = 'CRDT' and c:NtryDtls/c:TxDtls/c:RltdPties/c:DbtrAcct/c:Id/c:IBAN)" />

				<xsl:variable name="continuousSequenceNumber" select="cf:padLeft(position(), 4, '0')" />

				<xsl:variable name="entryDate" select="cf:getEntryDate(c:BookgDt/c:Dt, $reportDate)" />

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
						<xsl:value-of select="cf:getValueDate(c:ValDt/c:Dt, c:ValDt/c:DtTm, c:BookgDt/c:Dt, $reportDate)" />
					</xsl:with-param>
					<xsl:with-param name="ref">
						<xsl:value-of select="$refs" />
					</xsl:with-param>
					<xsl:with-param name="comm">
						<xsl:value-of select="substring($comm, 1, 53)" />
					</xsl:with-param>
					<xsl:with-param name="commType">
						<xsl:value-of select="$commType" />
					</xsl:with-param>
					<xsl:with-param name="entryDate">
						<xsl:value-of select="$entryDate" />
					</xsl:with-param>
					<xsl:with-param name="transactionCode">
						<xsl:value-of select="$transactionCode" />
					</xsl:with-param>
					<xsl:with-param name="needRecord2.2_or_3">
						<xsl:value-of select="$needRecord2.2 or $needRecord2.3" />
					</xsl:with-param>
				</xsl:call-template>

				<xsl:if test="$needRecord2.2">
					<xsl:call-template name="createRecord.2.2">
						<xsl:with-param name="continuousSequenceNumber">
							<xsl:value-of select="$continuousSequenceNumber" />
						</xsl:with-param>
						<xsl:with-param name="counterPartBic">
							<xsl:choose>
								<xsl:when test="c:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdAgts/c:CdtrAgt/c:FinInstnId/c:BIC" />
								</xsl:when>
								<xsl:when test="c:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdAgts/c:DbtrAgt/c:FinInstnId/c:BIC" />
								</xsl:when>
							</xsl:choose>
						</xsl:with-param>
						<xsl:with-param name="comm">
							<xsl:value-of select="substring($comm, 54, 53)" />
						</xsl:with-param>
						<xsl:with-param name="needRecord2.3">
							<xsl:value-of select="$needRecord2.3" />
						</xsl:with-param>
					</xsl:call-template>
				</xsl:if>

				<xsl:if test="$needRecord2.3">
					<xsl:call-template name="createRecord.2.3">
						<xsl:with-param name="continuousSequenceNumber">
							<xsl:value-of select="$continuousSequenceNumber" />
						</xsl:with-param>
						<xsl:with-param name="counterPartIban">
							<xsl:choose>
								<xsl:when test="c:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdPties/c:CdtrAcct/c:Id/c:IBAN" />
								</xsl:when>
								<xsl:when test="c:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdPties/c:DbtrAcct/c:Id/c:IBAN" />
								</xsl:when>
							</xsl:choose>
						</xsl:with-param>
						<xsl:with-param name="currency">
							<xsl:value-of select="c:Amt/@Ccy" />
						</xsl:with-param>
						<xsl:with-param name="counterPartName">
							<xsl:choose>
								<xsl:when test="c:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdPties/c:Cdtr/c:Nm" />
								</xsl:when>
								<xsl:when test="c:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="c:NtryDtls/c:TxDtls/c:RltdPties/c:Dbtr/c:Nm" />
								</xsl:when>
							</xsl:choose>
						</xsl:with-param>
						<xsl:with-param name="comm">
							<xsl:value-of select="substring($comm, 107, 43)" />
						</xsl:with-param>
						<xsl:with-param name="needRecord3">
							<xsl:value-of select="$needRecord3" />
						</xsl:with-param>
					</xsl:call-template>
				</xsl:if>

				<!-- Record 3: Information records for batch detail entries -->
				<xsl:if test="$needRecord3">
					<xsl:for-each select="$batchTxDetails">
						<xsl:variable name="detailNumber" select="position()" />
						<xsl:variable name="txRefs">
							<xsl:value-of select="c:Refs/*[text() != 'NOTPROVIDED']" separator="/" />
						</xsl:variable>
						<xsl:variable name="txComm">
							<xsl:choose>
								<xsl:when test="c:RmtInf/c:Ustrd[text() != 'NOTPROVIDED']">
									<xsl:value-of select="c:RmtInf/c:Ustrd[text() != 'NOTPROVIDED']" />
								</xsl:when>
								<xsl:otherwise>
									<xsl:value-of select="$txRefs" />
								</xsl:otherwise>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txBic">
							<xsl:choose>
								<xsl:when test="c:RltdAgts/c:CdtrAgt/c:FinInstnId/c:BIC">
									<xsl:value-of select="c:RltdAgts/c:CdtrAgt/c:FinInstnId/c:BIC" />
								</xsl:when>
								<xsl:when test="c:RltdAgts/c:DbtrAgt/c:FinInstnId/c:BIC">
									<xsl:value-of select="c:RltdAgts/c:DbtrAgt/c:FinInstnId/c:BIC" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txIban">
							<xsl:choose>
								<xsl:when test="c:RltdPties/c:CdtrAcct/c:Id/c:IBAN">
									<xsl:value-of select="c:RltdPties/c:CdtrAcct/c:Id/c:IBAN" />
								</xsl:when>
								<xsl:when test="c:RltdPties/c:DbtrAcct/c:Id/c:IBAN">
									<xsl:value-of select="c:RltdPties/c:DbtrAcct/c:Id/c:IBAN" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txName">
							<xsl:choose>
								<xsl:when test="c:RltdPties/c:Cdtr/c:Nm">
									<xsl:value-of select="c:RltdPties/c:Cdtr/c:Nm" />
								</xsl:when>
								<xsl:when test="c:RltdPties/c:Dbtr/c:Nm">
									<xsl:value-of select="c:RltdPties/c:Dbtr/c:Nm" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="need3.2"
							select="string-length($txComm) > 73 or string-length($txBic) > 0" />
						<xsl:variable name="need3.3"
							select="string-length($txIban) > 0 or string-length($txName) > 0" />

						<xsl:call-template name="createRecord.3.1">
							<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
							<xsl:with-param name="detailNumber" select="$detailNumber" />
							<xsl:with-param name="bankRef" select="$txRefs" />
							<xsl:with-param name="transactionCode" select="$transactionCode" />
							<xsl:with-param name="comm" select="substring($txComm, 1, 73)" />
							<xsl:with-param name="entryDate" select="$entryDate" />
							<xsl:with-param name="needRecord3.2" select="$need3.2 or $need3.3" />
						</xsl:call-template>

						<xsl:if test="$need3.2 or $need3.3">
							<xsl:call-template name="createRecord.3.2">
								<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
								<xsl:with-param name="detailNumber" select="$detailNumber" />
								<xsl:with-param name="comm" select="substring($txComm, 74, 53)" />
								<xsl:with-param name="counterPartBic" select="$txBic" />
								<xsl:with-param name="needRecord3.3" select="$need3.3" />
							</xsl:call-template>
						</xsl:if>

						<xsl:if test="$need3.3">
							<xsl:call-template name="createRecord.3.3">
								<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
								<xsl:with-param name="detailNumber" select="$detailNumber" />
								<xsl:with-param name="counterPartIban" select="$txIban" />
								<xsl:with-param name="currency" select="c:AmtDtls/c:TxAmt/c:Amt/@Ccy" />
								<xsl:with-param name="counterPartName" select="$txName" />
								<xsl:with-param name="comm" select="substring($txComm, 127, 43)" />
							</xsl:call-template>
						</xsl:if>
					</xsl:for-each>
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
					<xsl:value-of select="c:Bal[c:Tp/c:CdOrPrtry/c:Cd = 'CLBD']/c:Dt/c:Dt" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:call-template name="createRecord.9">
				<xsl:with-param name="nbRecords">
					<xsl:value-of select="cf:countAllRecords(c:Ntry)" />
				</xsl:with-param>
				<xsl:with-param name="sumDebits">
					<xsl:value-of select="format-number(sum(c:Ntry[c:CdtDbtInd = 'DBIT']/c:Amt), '0.00')" />
				</xsl:with-param>
				<xsl:with-param name="sumCredits">
					<xsl:value-of select="format-number(sum(c:Ntry[c:CdtDbtInd = 'CRDT']/c:Amt), '0.00')" />
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

	<!-- Count all records for Record 9: 1(rec1) + per-entry records + 1(rec8) -->
	<xsl:function name="cf:countAllRecords" as="xs:integer">
		<xsl:param name="entries" />
		<xsl:sequence select="2 + sum(for $e in $entries return cf:countEntryRecords($e))" />
	</xsl:function>

	<xsl:function name="cf:countEntryRecords" as="xs:integer">
		<xsl:param name="e" />

		<!-- Record 2.1 always emitted -->
		<xsl:variable name="rec21" select="1" />

		<!-- Compute comm to check length (simplified: use unstructured or refs) -->
		<xsl:variable name="ustrd" select="string($e/c:NtryDtls/c:TxDtls/c:RmtInf/c:Ustrd[text() != 'NOTPROVIDED'])" />
		<xsl:variable name="commLen" select="string-length($ustrd)" />

		<!-- Record 2.2: long comm or counterparty BIC -->
		<xsl:variable name="hasBic"
			select="($e/c:CdtDbtInd = 'DBIT' and $e/c:NtryDtls/c:TxDtls/c:RltdAgts/c:CdtrAgt/c:FinInstnId/c:BIC != '')
					or ($e/c:CdtDbtInd = 'CRDT' and $e/c:NtryDtls/c:TxDtls/c:RltdAgts/c:DbtrAgt/c:FinInstnId/c:BIC != '')" />
		<xsl:variable name="rec22" select="if ($commLen > 53 or $hasBic) then 1 else 0" />

		<!-- Record 2.3: long comm or counterparty IBAN -->
		<xsl:variable name="hasIban"
			select="($e/c:CdtDbtInd = 'DBIT' and $e/c:NtryDtls/c:TxDtls/c:RltdPties/c:CdtrAcct/c:Id/c:IBAN != '')
					or ($e/c:CdtDbtInd = 'CRDT' and $e/c:NtryDtls/c:TxDtls/c:RltdPties/c:DbtrAcct/c:Id/c:IBAN != '')" />
		<xsl:variable name="rec23" select="if ($commLen > 106 or $hasIban) then 1 else 0" />

		<!-- Record 3: one set per TxDtls when batch has multiple details -->
		<xsl:variable name="txCount" select="count($e/c:NtryDtls/c:TxDtls)" />
		<xsl:variable name="rec3" select="if ($txCount > 1) then $txCount else 0" />

		<xsl:sequence select="$rec21 + $rec22 + $rec23 + $rec3" />
	</xsl:function>
	<!-- ======================== Stmt - END ======================== -->
</xsl:stylesheet>
  