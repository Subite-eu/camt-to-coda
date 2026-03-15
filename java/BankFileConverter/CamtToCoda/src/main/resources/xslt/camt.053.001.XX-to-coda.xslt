<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:cf="http://custom.functions.subite.eu/cf" extension-element-prefixes="cf">

	<xsl:include href="camt.05X.001.XX-to-coda.xslt" />

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
		<!-- Globalisation code -->
		<xsl:text>1</xsl:text>
		<!-- Next code. 0 = no record 2 or 3 with record identification 2 is following, 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord2.2_or_3)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code with next data record: 0 = no information record is following , 1 otherwise -->
		<xsl:text>0</xsl:text><!-- TODO -->
		<xsl:text>&#xa;</xsl:text>
	</xsl:template>
	<!-- ======================== Data record 2.1 - "movement record" - END ======================== -->

	<!-- ======================== Data record 2.2 - "movement record" - START ======================== -->
	<xsl:template name="createRecord.2.2">
		<xsl:param name="continuousSequenceNumber" />
		<xsl:param name="counterPartBic" />
		<xsl:param name="comm" />
		<xsl:param name="needRecord2.3" />

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
		<!-- BIC (8 or 11 characters) of the counterparty’s bank or blank -->
		<xsl:value-of select="cf:padRight($counterPartBic, 11, ' ')" />
		<!-- Blanks -->
		<xsl:value-of select="cf:padRight('', 3, ' ')" />
		<!-- Type of R-transaction or blank -->
		<xsl:value-of select="cf:padRight('', 1, ' ')" />
		<!-- ISO Reason Return Code or blanks -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- CategoryPurpose’ -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- Purpose -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- Next code: 0 = no record 3 with record identification 2 is following, 1 otherwise -->
		<xsl:value-of select="cf:getNextcode($needRecord2.3)" />
		<!-- Blank -->
		<xsl:text> </xsl:text>
		<!-- Link code with next data record: 0 = no information record is following , 1 otherwise -->
		<xsl:text>0</xsl:text>
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
			select="cf:debug(‘2300010000BE91516952884376                  EURAcme Co                                                                       0 1’)" />

		<!-- Record identification = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Article code = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padRight(‘’, 4, ‘0’)" />
		<!-- Counterparty’s account number and currency code or blank -->
		<xsl:value-of select="cf:padRight($counterPartIban, 34, ‘ ‘)" />
		<xsl:value-of select="$currency" />
		<!-- Counterparty’s name -->
		<xsl:value-of select="cf:padRight($counterPartName, 35, ‘ ‘)" />
		<!-- Communication (ctd.) -->
		<xsl:value-of select="cf:padRight($comm, 43, ‘ ‘)" />
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
		<xsl:param name="customerRef" select="''" />
		<xsl:param name="counterPartBic" select="''" />
		<xsl:param name="needRecord3.3" select="false()" />

		<xsl:value-of
			select="cf:debug('3200010001123 MAIN STREET                     1000 ANYTOWN                                                                    0 0')" />

		<!-- Record identification = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Article code = 2 -->
		<xsl:text>2</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padLeft($detailNumber, 4, '0')" />
		<!-- Communication (ctd.) -->
		<xsl:value-of select="cf:padRight($comm, 53, ' ')" />
		<!-- Customer reference or blank -->
		<xsl:value-of select="cf:padRight($customerRef, 35, ' ')" />
		<!-- BIC of the counterparty's bank or blank -->
		<xsl:value-of select="cf:padRight($counterPartBic, 11, ' ')" />
		<!-- Blanks -->
		<xsl:value-of select="cf:padRight('', 3, ' ')" />
		<!-- Type of R-transaction or blank -->
		<xsl:value-of select="cf:padRight('', 1, ' ')" />
		<!-- ISO Reason Return Code or blanks -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- CategoryPurpose -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
		<!-- Purpose -->
		<xsl:value-of select="cf:padRight('', 4, ' ')" />
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
		<xsl:param name="counterPartIban" select="''" />
		<xsl:param name="currency" select="'   '" />
		<xsl:param name="counterPartName" select="''" />
		<xsl:param name="comm" select="''" />

		<!-- Record identification = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Article code = 3 -->
		<xsl:text>3</xsl:text>
		<!-- Continuous sequence number -->
		<xsl:value-of select="$continuousSequenceNumber" />
		<!-- Detail number -->
		<xsl:value-of select="cf:padLeft($detailNumber, 4, '0')" />
		<!-- Counterparty's account number and currency code or blank -->
		<xsl:value-of select="cf:padRight($counterPartIban, 34, ' ')" />
		<xsl:value-of select="cf:padRight($currency, 3, ' ')" />
		<!-- Counterparty's name -->
		<xsl:value-of select="cf:padRight($counterPartName, 35, ' ')" />
		<!-- Communication (ctd.) -->
		<xsl:value-of select="cf:padRight($comm, 43, ' ')" />
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
		<xsl:param name="ref" />
		<xsl:param name="nbTrx" />

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
  