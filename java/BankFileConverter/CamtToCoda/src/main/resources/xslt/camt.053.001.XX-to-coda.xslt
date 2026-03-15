<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:cf="http://custom.functions.subite.eu/cf" extension-element-prefixes="cf">

	<xsl:include href="camt.05X.001.XX-to-coda.xslt" />

	<!-- ======================== Document - START ======================== -->
	<xsl:template name="handleDocument">
		<xsl:for-each select="*:Stmt">
			<xsl:call-template name="handleStmt" />
		</xsl:for-each>
	</xsl:template>
	<!-- ======================== Document - END ======================== -->

	<!-- ======================== Stmt - START ======================== -->
	<xsl:template name="handleStmt">

		<xsl:variable name="reportDate"
			select="cf:getReportDate(*:FrToDt/*:ToDtTm,*:CreDtTm,../*:GrpHdr/*:CreDtTm)" />
		<xsl:message select="concat('Report Date[', $reportDate, ']')" />

		<xsl:variable name="accountNumber"
			select="cf:getBankAccount(
				*:Acct/*:Id/*:IBAN,
				*:Acct/*:Id/*:Othr/*:Id)" />

		<xsl:variable name="bic"
			select="cf:getBic(
			*:Acct/*:Ownr/*:Id/*:OrgId/*:AnyBIC,
			(*:Acct/*:Svcr/*:FinInstnId/*:BIC | *:Acct/*:Svcr/*:FinInstnId/*:BICFI)[1],
			false())" />

		<xsl:variable name="currency" select="cf:getCurrency(*:Acct/*:Ccy, *:Bal[1]/*:Amt/@Ccy)" />

		<xsl:variable name="stmtId" select="*:Id" />

		<xsl:variable name="sequence"
			select="cf:getReportSequence(../*:Rpt/*:LglSeqNb, ../*:Rpt/*:ElctrncSeqNb, $reportDate, $accountNumber)" />

		<xsl:variable name="fileName"
			select="concat(cf:dateToYYYY-MM-DD($reportDate), '-', $accountNumber, '-', $currency, '-', $stmtId, '-CAMT-053.cod')" />

		<xsl:message
			select="concat('AccountNumber[', $accountNumber, '] - Currency[', $currency, '] - StmtId[', $stmtId, ']')" />
		<xsl:message select="concat('Output fileName[', $fileName, ']')" />

		<!-- Opening balance: support both OPBD (v02/v08) and PRCD (v10+) -->
		<xsl:variable name="openingBalanceNode"
			select="(*:Bal[*:Tp/*:CdOrPrtry/*:Cd = 'OPBD'] | *:Bal[*:Tp/*:CdOrPrtry/*:Cd = 'PRCD'])[1]" />

		<!-- BALANCE CHECK -->
		<xsl:variable name="openingBalance"
			select="cf:getSignedAmount(
						$openingBalanceNode/*:Amt,
						$openingBalanceNode/*:CdtDbtInd)" />
		<xsl:variable name="mvt" select="round(sum(cf:getSumSignedAmounts(*:Ntry)), 2)" />
		<xsl:variable name="closingBalance"
			select="cf:getSignedAmount(
						*:Bal[*:Tp/*:CdOrPrtry/*:Cd = 'CLBD']/*:Amt,
						*:Bal[*:Tp/*:CdOrPrtry/*:Cd = 'CLBD']/*:CdtDbtInd)" />
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
					<xsl:value-of select="$openingBalanceNode/*:Dt/*:Dt" />
				</xsl:with-param>
				<xsl:with-param name="ownerName">
					<xsl:value-of select="*:Acct/*:Ownr/*:Nm" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:for-each select="*:Ntry">
				<xsl:variable name="refs">
					<!-- concatenate all nodes -->
					<xsl:value-of select="*:NtryDtls/*:TxDtls/*:Refs/*[text() != 'NOTPROVIDED']" separator="/" />
				</xsl:variable>

				<!-- Transaction code from ISO 20022 BkTxCd/Domn -->
				<xsl:variable name="transactionCode"
					select="cf:getTransactionCodeFromEntry(
						string(*:BkTxCd/*:Domn/*:Cd),
						string(*:BkTxCd/*:Domn/*:Fmly/*:Cd),
						string(*:BkTxCd/*:Domn/*:Fmly/*:SubFmlyCd))" />

				<!-- Structured vs unstructured remittance -->
				<xsl:variable name="hasStructuredComm"
					select="*:NtryDtls/*:TxDtls/*:RmtInf/*:Strd/*:CdtrRefInf/*:Ref != ''" />
				<xsl:variable name="structuredComm"
					select="*:NtryDtls/*:TxDtls/*:RmtInf/*:Strd/*:CdtrRefInf/*:Ref" />

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
							<xsl:value-of select="cf:getComm(*:NtryDtls/*:TxDtls/*:RmtInf/*:Ustrd[text() != 'NOTPROVIDED'], *:NtryDtls/*:Btch/*:NbOfTxs, $refs)" />
						</xsl:otherwise>
					</xsl:choose>
				</xsl:variable>

				<xsl:variable name="comm" select="string($rawComm)" />

				<!-- Detect if Record 3 is needed: batch with multiple TxDtls -->
				<xsl:variable name="batchTxDetails" select="*:NtryDtls/*:TxDtls" />
				<xsl:variable name="needRecord3" select="count($batchTxDetails) > 1" />

				<xsl:variable name="needRecord2.2"
					select="string-length($comm) > 53
							or (*:CdtDbtInd = 'DBIT' and (*:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BIC | *:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BICFI)[1])
							or (*:CdtDbtInd = 'CRDT' and (*:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BIC | *:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BICFI)[1])" />

				<xsl:variable name="needRecord2.3"
					select="string-length($comm) > 106
							or (*:CdtDbtInd = 'DBIT' and *:NtryDtls/*:TxDtls/*:RltdPties/*:CdtrAcct/*:Id/*:IBAN)
							or (*:CdtDbtInd = 'CRDT' and *:NtryDtls/*:TxDtls/*:RltdPties/*:DbtrAcct/*:Id/*:IBAN)" />

				<xsl:variable name="continuousSequenceNumber" select="cf:padLeft(position(), 4, '0')" />

				<xsl:variable name="entryDate" select="cf:getEntryDate(*:BookgDt/*:Dt, $reportDate)" />

				<xsl:call-template name="createRecord.2.1">
					<xsl:with-param name="continuousSequenceNumber">
						<xsl:value-of select="$continuousSequenceNumber" />
					</xsl:with-param>
					<xsl:with-param name="movementDirection">
						<xsl:value-of select="cf:getMovementDirection(*:CdtDbtInd)" />
					</xsl:with-param>
					<xsl:with-param name="amount">
						<xsl:value-of select="*:Amt" />
					</xsl:with-param>
					<xsl:with-param name="valueDate">
						<xsl:value-of select="cf:getValueDate(*:ValDt/*:Dt, *:ValDt/*:DtTm, *:BookgDt/*:Dt, $reportDate)" />
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
					<xsl:with-param name="needRecord3">
						<xsl:value-of select="$needRecord3" />
					</xsl:with-param>
				</xsl:call-template>

				<xsl:if test="$needRecord2.2">
					<xsl:call-template name="createRecord.2.2">
						<xsl:with-param name="continuousSequenceNumber">
							<xsl:value-of select="$continuousSequenceNumber" />
						</xsl:with-param>
						<xsl:with-param name="counterPartBic">
							<xsl:choose>
								<xsl:when test="*:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="(*:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BIC | *:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BICFI)[1]" />
								</xsl:when>
								<xsl:when test="*:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="(*:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BIC | *:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BICFI)[1]" />
								</xsl:when>
							</xsl:choose>
						</xsl:with-param>
						<xsl:with-param name="comm">
							<xsl:value-of select="substring($comm, 54, 53)" />
						</xsl:with-param>
						<xsl:with-param name="needRecord2.3">
							<xsl:value-of select="$needRecord2.3" />
						</xsl:with-param>
						<xsl:with-param name="needRecord3">
							<xsl:value-of select="$needRecord3" />
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
								<xsl:when test="*:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="*:NtryDtls/*:TxDtls/*:RltdPties/*:CdtrAcct/*:Id/*:IBAN" />
								</xsl:when>
								<xsl:when test="*:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="*:NtryDtls/*:TxDtls/*:RltdPties/*:DbtrAcct/*:Id/*:IBAN" />
								</xsl:when>
							</xsl:choose>
						</xsl:with-param>
						<xsl:with-param name="currency">
							<xsl:value-of select="*:Amt/@Ccy" />
						</xsl:with-param>
						<xsl:with-param name="counterPartName">
							<xsl:choose>
								<xsl:when test="*:CdtDbtInd = 'DBIT'">
									<xsl:value-of select="*:NtryDtls/*:TxDtls/*:RltdPties/*:Cdtr/*:Nm" />
								</xsl:when>
								<xsl:when test="*:CdtDbtInd = 'CRDT'">
									<xsl:value-of select="*:NtryDtls/*:TxDtls/*:RltdPties/*:Dbtr/*:Nm" />
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
							<xsl:value-of select="*:Refs/*[text() != 'NOTPROVIDED']" separator="/" />
						</xsl:variable>
						<xsl:variable name="txComm">
							<xsl:choose>
								<xsl:when test="*:RmtInf/*:Ustrd[text() != 'NOTPROVIDED']">
									<xsl:value-of select="*:RmtInf/*:Ustrd[text() != 'NOTPROVIDED']" />
								</xsl:when>
								<xsl:otherwise>
									<xsl:value-of select="$txRefs" />
								</xsl:otherwise>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txBic">
							<xsl:choose>
								<xsl:when test="(*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BIC | *:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BICFI)[1]">
									<xsl:value-of select="(*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BIC | *:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BICFI)[1]" />
								</xsl:when>
								<xsl:when test="(*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BIC | *:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BICFI)[1]">
									<xsl:value-of select="(*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BIC | *:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BICFI)[1]" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txIban">
							<xsl:choose>
								<xsl:when test="*:RltdPties/*:CdtrAcct/*:Id/*:IBAN">
									<xsl:value-of select="*:RltdPties/*:CdtrAcct/*:Id/*:IBAN" />
								</xsl:when>
								<xsl:when test="*:RltdPties/*:DbtrAcct/*:Id/*:IBAN">
									<xsl:value-of select="*:RltdPties/*:DbtrAcct/*:Id/*:IBAN" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="txName">
							<xsl:choose>
								<xsl:when test="*:RltdPties/*:Cdtr/*:Nm">
									<xsl:value-of select="*:RltdPties/*:Cdtr/*:Nm" />
								</xsl:when>
								<xsl:when test="*:RltdPties/*:Dbtr/*:Nm">
									<xsl:value-of select="*:RltdPties/*:Dbtr/*:Nm" />
								</xsl:when>
							</xsl:choose>
						</xsl:variable>

						<xsl:variable name="need3.2"
							select="string-length($txComm) > 73" />
						<xsl:variable name="need3.3"
							select="string-length($txComm) > 178" />

						<xsl:call-template name="createRecord.3.1">
							<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
							<xsl:with-param name="detailNumber" select="$detailNumber" />
							<xsl:with-param name="bankRef" select="$txRefs" />
							<xsl:with-param name="transactionCode" select="$transactionCode" />
							<xsl:with-param name="comm" select="substring($txComm, 1, 73)" />
							<xsl:with-param name="entryDate" select="$entryDate" />
							<xsl:with-param name="needRecord3.2" select="$need3.2" />
						</xsl:call-template>

						<xsl:if test="$need3.2">
							<xsl:call-template name="createRecord.3.2">
								<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
								<xsl:with-param name="detailNumber" select="$detailNumber" />
								<xsl:with-param name="comm" select="substring($txComm, 74, 105)" />
								<xsl:with-param name="needRecord3.3" select="$need3.3" />
							</xsl:call-template>
						</xsl:if>

						<xsl:if test="$need3.3">
							<xsl:call-template name="createRecord.3.3">
								<xsl:with-param name="continuousSequenceNumber" select="$continuousSequenceNumber" />
								<xsl:with-param name="detailNumber" select="$detailNumber" />
								<xsl:with-param name="comm" select="substring($txComm, 179, 90)" />
							</xsl:call-template>
						</xsl:if>
					</xsl:for-each>
				</xsl:if>
			</xsl:for-each>

			<xsl:call-template name="createRecord.8">
				<xsl:with-param name="accountNumber">
					<xsl:value-of select="$accountNumber" />
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
					<xsl:value-of select="*:Bal[*:Tp/*:CdOrPrtry/*:Cd = 'CLBD']/*:Dt/*:Dt" />
				</xsl:with-param>
			</xsl:call-template>

			<xsl:call-template name="createRecord.9">
				<xsl:with-param name="nbRecords">
					<xsl:value-of select="cf:countAllRecords(*:Ntry)" />
				</xsl:with-param>
				<xsl:with-param name="sumDebits">
					<xsl:value-of select="format-number(sum(*:Ntry[*:CdtDbtInd = 'DBIT']/*:Amt), '0.00')" />
				</xsl:with-param>
				<xsl:with-param name="sumCredits">
					<xsl:value-of select="format-number(sum(*:Ntry[*:CdtDbtInd = 'CRDT']/*:Amt), '0.00')" />
				</xsl:with-param>
			</xsl:call-template>
		</xsl:result-document>

	</xsl:template>

	<xsl:function name="cf:getSumSignedAmounts">
		<xsl:param name="nodes" />
		<xsl:for-each select="$nodes">
			<xsl:sequence select="cf:getSignedAmount(*:Amt/text(), *:CdtDbtInd)" />
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
		<xsl:variable name="ustrd" select="string($e/*:NtryDtls/*:TxDtls/*:RmtInf/*:Ustrd[text() != 'NOTPROVIDED'])" />
		<xsl:variable name="commLen" select="string-length($ustrd)" />

		<!-- Record 2.2: long comm or counterparty BIC (support both BIC and BICFI element names) -->
		<xsl:variable name="hasBic"
			select="($e/*:CdtDbtInd = 'DBIT' and ($e/*:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BIC != '' or $e/*:NtryDtls/*:TxDtls/*:RltdAgts/*:CdtrAgt/*:FinInstnId/*:BICFI != ''))
					or ($e/*:CdtDbtInd = 'CRDT' and ($e/*:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BIC != '' or $e/*:NtryDtls/*:TxDtls/*:RltdAgts/*:DbtrAgt/*:FinInstnId/*:BICFI != ''))" />
		<xsl:variable name="rec22" select="if ($commLen > 53 or $hasBic) then 1 else 0" />

		<!-- Record 2.3: long comm or counterparty IBAN -->
		<xsl:variable name="hasIban"
			select="($e/*:CdtDbtInd = 'DBIT' and $e/*:NtryDtls/*:TxDtls/*:RltdPties/*:CdtrAcct/*:Id/*:IBAN != '')
					or ($e/*:CdtDbtInd = 'CRDT' and $e/*:NtryDtls/*:TxDtls/*:RltdPties/*:DbtrAcct/*:Id/*:IBAN != '')" />
		<xsl:variable name="rec23" select="if ($commLen > 106 or $hasIban) then 1 else 0" />

		<!-- Record 3: one set per TxDtls when batch has multiple details -->
		<xsl:variable name="txCount" select="count($e/*:NtryDtls/*:TxDtls)" />
		<xsl:variable name="rec3" select="if ($txCount > 1) then $txCount else 0" />

		<xsl:sequence select="$rec21 + $rec22 + $rec23 + $rec3" />
	</xsl:function>
	<!-- ======================== Stmt - END ======================== -->

	<!-- ======================== Header record 0 - START ======================== -->
	<xsl:template name="createRecord.0">
		<xsl:param name="date" />
		<xsl:param name="bic" />

		<xsl:value-of
			select="cf:debug('0000026082420005                  Acme Co                   EXMPBE21   00000000000 00000                                       2')" />

		<!-- Record identification = 0 -->
		<xsl:text>0</xsl:text>
		<!-- Zeros -->
		<xsl:value-of select="cf:padRight('', 4, '0')" />
		<!-- Creation date (DDMMYY) -->
		<xsl:value-of select="cf:dateToDdMmYy($date)" />
		<!-- Bank identification number or zeros -->
		<xsl:value-of select="cf:padRight('', 3, '0')" />
		<!-- Application code -->
		<xsl:text>05</xsl:text>
		<!-- If duplicate "D", otherwise blank -->
		<xsl:text> </xsl:text>
		<!-- blank -->
		<xsl:value-of select="cf:padRight('', 7, ' ')" />
		<!-- file reference as determined by the bank or blank -->
		<xsl:value-of select="cf:padRight('', 10, ' ')" />
		<!-- Name addressee -->
		<xsl:value-of select="cf:padRight('', 26, ' ')" />
		<!-- BIC -->
		<xsl:value-of select="cf:padRight($bic, 11, ' ')" />
		<!-- Identification number of the Belgium-based account holder: 0 + company number -->
		<xsl:value-of select="cf:padLeft('', 11, ' ')" />
		<!-- <xsl:call-template name="padLeft"> <xsl:with-param name="string">TODO </xsl:with-param> <xsl:with-param
			name="size"> 11 </xsl:with-param> </xsl:call-template> -->
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Code "separate application" -->
		<xsl:value-of select="cf:padLeft('', 5, '0')" />
		<!-- Blank or Transaction reference -->
		<xsl:value-of select="cf:padLeft('', 16, ' ')" />
		<!-- Blank or Related reference -->
		<xsl:value-of select="cf:padLeft('', 16, ' ')" />
		<!-- Blank -->
		<xsl:value-of select="cf:padLeft('', 7, ' ')" />
		<!-- Version code = 2 -->
		<xsl:text>2</xsl:text>
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Header record 0 - END ======================== -->

	<!-- ======================== Data record - "old balance" 1 - START ======================== -->
	<xsl:template name="createRecord.1">
		<xsl:param name="accountNumber" />
		<xsl:param name="sequence" />
		<xsl:param name="currency" />
		<xsl:param name="openingBalance" />
		<xsl:param name="openingBalanceDate" />
		<xsl:param name="ownerName" />

		<xsl:value-of
			select="cf:debug('12001BE68793230773034                  EUR0000000000000000000000Acme Co                                                      001')" />

		<!-- Record identification = 1 -->
		<xsl:text>1</xsl:text>
		<!-- Account structure -->
		<xsl:value-of select="cf:getAccountStructure($accountNumber)" />
		<!-- Sequence number statement of account on paper or Julian date or zeros. -->
		<xsl:value-of select="$sequence" />
		<!-- Account number and currency code -->
		<xsl:value-of select="cf:padRight($accountNumber, 34, ' ')" />
		<xsl:value-of select="$currency" />
		<!-- Old balance sign (0 = credit, 1 = debit) -->
		<xsl:value-of select="cf:getAmountSignCode($openingBalance)" />
		<!-- Old balance (12 pos. + 3 decimals) -->
		<xsl:value-of select="cf:formatBalance($openingBalance)" />
		<!-- Old balance date (DDMMYY) -->
		<xsl:value-of select="cf:dateToDdMmYy($openingBalanceDate)" />
		<!-- Name of the account holder -->
		<xsl:value-of select="cf:padRight($ownerName, 26, ' ')" />
		<!-- Account description -->
		<xsl:value-of select="cf:padRight('', 35, ' ')" />
		<!-- Sequence number of the coded statement of account or zeros. -->
		<xsl:value-of select="$sequence" /><!-- TODO -->
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record - "old balance" 1 - END ======================== -->

	<!-- ======================== Data record 2.1 - "movement record" - START ======================== -->
	<xsl:template name="createRecord.2.1">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="movementDirection" />
		<xsl:param name="amount" />
		<xsl:param name="valueDate" />
		<xsl:param name="ref" />
		<xsl:param name="comm" />
		<xsl:param name="commType" select="'0'" />
		<xsl:param name="entryDate" />
		<xsl:param name="transactionCode" select="'        '" />
		<xsl:param name="needRecord2.2_or_3" />
		<xsl:param name="needRecord3" select="false()" />

		<xsl:value-of
			select="cf:debug('21000100002408261316054947     000000000000001026082400150000012702719841                                          26082400101 0')" />

		<!-- Record identification = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Article code = 1 -->
		<xsl:text>1</xsl:text>
		<!-- Continuous sequence number Starts at 0001 and is increased by 1 for each movement -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number starts at 0000 and is increased by 1 for each movement record -->
		<xsl:value-of select="cf:padLeft('', 4, '0')" />
		<!-- Reference number of the bank This information is purely informative. -->
		<xsl:value-of select="cf:padRight($ref, 21, ' ')" />
		<!-- Movement sign: 0 = credit, 1 = debit -->
		<xsl:value-of select="$movementDirection" />
		<!-- Amount: 12 pos. + 3 decimals -->
		<xsl:value-of select="cf:formatBalance($amount)" />
		<!-- Value date or 000000 if not known (DDMMYY) -->
		<xsl:value-of select="$valueDate" />
		<!-- Transaction code -->
		<xsl:value-of select="$transactionCode" />
		<!-- Communication type: 0 = none or unstructured, 1 = structured -->
		<xsl:value-of select="$commType" />
		<!-- Communication zone -->
		<xsl:value-of select="cf:padRight($comm, 53, ' ')" />
		<!-- Entry date DDMMYY -->
		<xsl:value-of select="$entryDate" />
		<!-- Sequence number statement of account on paper or Julian date or zeros -->
		<xsl:value-of select="cf:padLeft('', 3, '0')" />
		<!-- Globalisation code: 0 = no globalisation, 1 = first level (batch details follow) -->
		<xsl:value-of select="cf:getNextcode($needRecord3)" />
		<!-- Next code. 0 = no record 2 or 3 with record identification 2 is following, 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord2.2_or_3)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code with next data record: 0 = no information record is following , 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord3)" />
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 2.1 - "movement record" - END ======================== -->

	<!-- ======================== Data record 2.2 - "movement record" - START ======================== -->
	<xsl:template name="createRecord.2.2">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="counterPartBic" />
		<xsl:param name="comm" />
		<xsl:param name="needRecord2.3" />
		<xsl:param name="needRecord3" select="false()" />

		<xsl:value-of
			select="cf:debug('2200010000                                                     202408261020064068J DOE            EXMPBE21                   1 0')" />

		<!-- Record identification = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Article code = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padRight('', 4, '0')" />
		<!-- Communication (ctd.) -->
		<xsl:value-of select="cf:padRight($comm, 53, ' ')" />
		<!-- Customer reference or blank -->
		<xsl:value-of select="cf:padRight('', 35, ' ')" />
		<!-- BIC (8 or 11 characters) of the counterparty's bank or blank -->
		<xsl:value-of select="cf:padRight($counterPartBic, 11, ' ')" />
		<!-- Blanks -->
		<xsl:value-of select="cf:padRight('', 3, ' ')" />
		<!-- Type of R-transaction or blank -->
		<xsl:value-of select="cf:padRight('', 1, ' ')" />
		<!-- ISO Reason Return Code or blanks -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- CategoryPurpose' -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- Purpose -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- Next code: 0 = no record 3 with record identification 2 is following, 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord2.3)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code with next data record: 0 = no information record is following , 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord3)" />
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 2.2 - "movement record" - END ======================== -->

	<!-- ======================== Data record 2.3 - "movement record" - START ======================== -->
	<xsl:template name="createRecord.2.3">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="counterPartIban" />
		<xsl:param name="currency" />
		<xsl:param name="counterPartName" />
		<xsl:param name="comm" />
		<xsl:param name="needRecord3" select="false()" />

		<xsl:value-of
			select="cf:debug('2300010000BE91516952884376                  EURAcme Co                                                                       0 1')" />

		<!-- Record identification = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Article code = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padRight('', 4, '0')" />
		<!-- Counterparty's account number and currency code or blank -->
		<xsl:value-of select="cf:padRight($counterPartIban, 34, ' ')" />
		<xsl:value-of select="$currency" />
		<!-- Counterparty's name -->
		<xsl:value-of select="cf:padRight($counterPartName, 35, ' ')" />
		<!-- Communication (ctd.) -->
		<xsl:value-of select="cf:padRight($comm, 43, ' ')" />
		<!-- Next code – always 0 -->
		<xsl:text>0</xsl:text>
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code with next data record: 0 = no information record is following (data record 3), 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord3)" />
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 2.3 - "movement record" - END ======================== -->

	<!-- ======================== Data record 3.1 - "information record" - START ======================== -->
	<xsl:template name="createRecord.3.1">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="detailNumber" />
		<xsl:param name="bankRef" />
		<xsl:param name="transactionCode" select="'        '" />
		<xsl:param name="commType" select="'0'" />
		<xsl:param name="comm" />
		<xsl:param name="entryDate" />
		<xsl:param name="sequence" select="'000'" />
		<xsl:param name="needRecord3.2" select="false()" />

		<xsl:value-of
			select="cf:debug('31000100012408261316054947     001500001001Acme Co                                                                           1 0')" />

		<!-- Record identification = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Article code = 1 -->
		<xsl:text>1</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padLeft($detailNumber, 4, '0')" />
		<!-- Reference number of the bank -->
		<xsl:value-of select="cf:padRight($bankRef, 21, ' ')" />
		<!-- Transaction code type: 0=normal, 1=detail of globalisation -->
		<xsl:text>1</xsl:text>
		<!-- Transaction code -->
		<xsl:value-of select="$transactionCode" />
		<!-- Communication type: 0=unstructured, 1=structured -->
		<xsl:value-of select="$commType" />
		<!-- Communication zone -->
		<xsl:value-of select="cf:padRight($comm, 73, ' ')" />
		<!-- Entry date DDMMYY -->
		<xsl:value-of select="$entryDate" />
		<!-- Sequence number -->
		<xsl:value-of select="$sequence" />
		<!-- Globalisation code: 0=detail of a globalised movement -->
		<xsl:text>0</xsl:text>
		<!-- Next code: 0=no 3.2 following, 1=3.2 follows -->
		<xsl:value-of select="cf:getNextcode($needRecord3.2)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code: always 0 for record 3 -->
		<xsl:text>0</xsl:text>
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 3.1 - "information record" - END ======================== -->

	<!-- ======================== Data record 3.2 - "information record" - START ======================== -->
	<xsl:template name="createRecord.3.2">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="detailNumber" />
		<xsl:param name="comm" />
		<xsl:param name="needRecord3.3" select="false()" />

		<!-- Record identification = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Article code = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padLeft($detailNumber, 4, '0')" />
		<!-- Communication (ctd.) 105 chars -->
		<xsl:value-of select="cf:padRight($comm, 105, ' ')" />
		<!-- Blank 10 chars -->
		<xsl:value-of select="cf:padRight('', 10, ' ')" />
		<!-- Next code: 0=no 3.3 following, 1=3.3 follows -->
		<xsl:value-of select="cf:getNextcode($needRecord3.3)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code: always 0 for record 3 -->
		<xsl:text>0</xsl:text>
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 3.2 - "information record" - END ======================== -->

	<!-- ======================== Data record 3.3 - "information record" - START ======================== -->
	<xsl:template name="createRecord.3.3">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="detailNumber" />
		<xsl:param name="comm" select="''" />

		<!-- Record identification = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Article code = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padLeft($detailNumber, 4, '0')" />
		<!-- Communication (ctd.) 90 chars -->
		<xsl:value-of select="cf:padRight($comm, 90, ' ')" />
		<!-- Blank 25 chars -->
		<xsl:value-of select="cf:padRight('', 25, ' ')" />
		<!-- Next code – always 0 -->
		<xsl:text>0</xsl:text>
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code: always 0 for record 3 -->
		<xsl:text>0</xsl:text>
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 3.3 - "information record" - END ======================== -->

	<!-- ======================== Data record 8 - "new balance" - START ======================== -->
	<xsl:template name="createRecord.8">
		<xsl:param name="accountNumber" />
		<xsl:param name="sequence" />
		<xsl:param name="currency" />
		<xsl:param name="closingBalance" />
		<xsl:param name="closingBalanceDate" />

		<xsl:value-of
			select="cf:debug('8001BE68793230773034                  EUR0000000000000010260824                                                                0')" />

		<!-- Record identification = 2 -->
		<xsl:text>8</xsl:text>
		<!-- Sequence number statement of account on paper or Julian date or zeros. -->
		<xsl:value-of select="$sequence" />
		<!-- Account number and currency code -->
		<xsl:value-of select="cf:padRight($accountNumber, 34, ' ')" />
		<!-- Account number and currency code -->
		<xsl:value-of select="$currency" />
		<!-- Old balance sign (0 = credit, 1 = debit) -->
		<xsl:value-of select="cf:getAmountSignCode($closingBalance)" />
		<!-- Old balance (12 pos. + 3 decimals) -->
		<xsl:value-of select="cf:formatBalance($closingBalance)" />
		<!-- Old balance date (DDMMYY) -->
		<xsl:value-of select="cf:dateToDdMmYy($closingBalanceDate)" />
		<!-- Blank -->
		<xsl:value-of select="cf:padRight('', 64, ' ')" />
		<!-- Link code with next data record: -->
		<!--0 = no free communication is following (data record 4) -->
		<!--1 = a free communication is following -->
		<xsl:text>0</xsl:text>
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 8 - "new balance" - END ======================== -->

	<!-- ======================== Data record 4 - "free communication" - START ======================== -->
	<!-- ======================== Data record 4 - "free communication" - END ======================== -->

	<!-- ======================== Trailer record 9 - START ======================== -->
	<xsl:template name="createRecord.9">
		<xsl:param name="nbRecords" />
		<xsl:param name="sumDebits" />
		<xsl:param name="sumCredits" />

		<xsl:value-of
			select="cf:debug('9               000007000000000000000000000000000010                                                                           1')" />

		<!-- Record identification = 2 -->
		<xsl:text>9</xsl:text>
		<!-- Blank -->
		<xsl:value-of select="cf:padRight('', 15, ' ')" />
		<!-- Number of records 1, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3 and 8 -->
		<xsl:value-of select="cf:padLeft($nbRecords, 6, '0')" /><!-- TODO -->
		<!-- Debit movement Sum of the amounts in type 2 records with detail number 0000 -->
		<xsl:value-of select="cf:formatBalance($sumDebits)" /><!-- TODO -->
		<!-- Credit movement Sum of the amounts in type 2 records with detail number 0000 -->
		<xsl:value-of select="cf:formatBalance($sumCredits)" /><!-- TODO -->
		<!-- Blank -->
		<xsl:value-of select="cf:padRight('', 75, ' ')" />
		<!-- Multiple file code: 1 = another file is following, 2 = last file -->
		<xsl:text>2</xsl:text><!-- TODO -->
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Trailer record 9 - END ======================== -->

	<!-- ======================== TOOLS ======================== -->

	<xsl:function name="cf:getEntryDate">
		<xsl:param name="date1" />
		<xsl:param name="date2" />
		<xsl:choose>
			<xsl:when test="$date1 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date1)" />
			</xsl:when>
			<xsl:when test="$date2 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date2)" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>Entry date required</xsl:text>
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getReportSequence">
		<xsl:param name="legalSequenceNumber" />
		<xsl:param name="electronicSequenceNumber" />
		<xsl:param name="dateForSequence" />
		<xsl:param name="accountNumber" />

		<xsl:variable name="sequence">
			<xsl:choose>
				<xsl:when test="$legalSequenceNumber != ''">
					<xsl:value-of select="$legalSequenceNumber mod 1000" />
				</xsl:when>
				<xsl:when test="$electronicSequenceNumber != ''">
					<xsl:value-of select="$electronicSequenceNumber mod 1000" />
				</xsl:when>
				<xsl:otherwise>
					<xsl:value-of
						select="cf:nb-working-days-this-year($accountNumber, cf:dateTimeToDateStr($dateForSequence))" />
				</xsl:otherwise>
			</xsl:choose>
		</xsl:variable>

		<xsl:sequence select="cf:padLeft($sequence, 3, '0')" />
	</xsl:function>

	<xsl:function name="cf:getMovementDirection">
		<xsl:param name="mvt" />
		<xsl:choose>
			<xsl:when test="$mvt = 'CRDT'">
				<xsl:text>0</xsl:text>
			</xsl:when>
			<xsl:otherwise>
				<xsl:text>1</xsl:text>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getNextcode">
		<xsl:param name="hasNextRecord" />
		<xsl:choose>
			<xsl:when test="$hasNextRecord">
				<xsl:text>1</xsl:text>
			</xsl:when>
			<xsl:otherwise>
				<xsl:text>0</xsl:text>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getComm">
		<xsl:param name="remittanceInfo" />
		<xsl:param name="nbTrx" />
		<xsl:param name="ref" />

		<xsl:choose>
			<xsl:when test="$remittanceInfo != ''">
				<xsl:sequence select="$remittanceInfo" />
			</xsl:when>
			<xsl:when test="$ref != ''">
				<xsl:sequence select="$ref" />
			</xsl:when>
			<xsl:when test="$nbTrx != '' and $nbTrx > 0">
				<xsl:sequence select="concat($nbTrx, ' transaction(s)')" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:sequence select="''" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

</xsl:stylesheet>
