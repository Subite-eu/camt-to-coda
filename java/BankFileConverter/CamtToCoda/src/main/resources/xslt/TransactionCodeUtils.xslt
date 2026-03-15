<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:cf="http://custom.functions.subite.eu/cf"
	exclude-result-prefixes="cf">

	<!-- Maps ISO 20022 BkTxCd/Domn (Domain/Family/SubFamily) to 8-char CODA transaction code.
	     CODA code format: 2-char family + 2-char operation + 4-char category
	     See CODA 2.6 specification for full code reference. -->

	<xsl:function name="cf:getTransactionCode" as="xs:string">
		<xsl:param name="domain" as="xs:string" />
		<xsl:param name="family" as="xs:string" />
		<xsl:param name="subFamily" as="xs:string" />

		<xsl:variable name="key" select="concat($domain, '/', $family, '/', $subFamily)" />

		<xsl:choose>
			<!-- SEPA Credit Transfers -->
			<xsl:when test="$key = 'PMNT/RCDT/ESCT'">
				<xsl:text>04500001</xsl:text>
			</xsl:when>
			<xsl:when test="$key = 'PMNT/ICDT/ESCT'">
				<xsl:text>13010001</xsl:text>
			</xsl:when>

			<!-- International Transfers -->
			<xsl:when test="$key = 'PMNT/ICDT/ISCT'">
				<xsl:text>41010000</xsl:text>
			</xsl:when>
			<xsl:when test="$key = 'PMNT/RCDT/ISCT'">
				<xsl:text>41500000</xsl:text>
			</xsl:when>

			<!-- SEPA Direct Debits -->
			<xsl:when test="$key = 'PMNT/IDDT/ESDD'">
				<xsl:text>05010000</xsl:text>
			</xsl:when>
			<xsl:when test="$key = 'PMNT/RDDT/ESDD'">
				<xsl:text>05500000</xsl:text>
			</xsl:when>

			<!-- Instant SEPA Credit Transfers -->
			<xsl:when test="$key = 'PMNT/RCDT/INST'">
				<xsl:text>02500001</xsl:text>
			</xsl:when>
			<xsl:when test="$key = 'PMNT/ICDT/INST'">
				<xsl:text>02010001</xsl:text>
			</xsl:when>

			<!-- Card Payments (any SubFamily under CCRD) -->
			<xsl:when test="$domain = 'PMNT' and $family = 'CCRD'">
				<xsl:text>04370000</xsl:text>
			</xsl:when>

			<!-- Interest -->
			<xsl:when test="$key = 'CAMT/ACCB/INTR'">
				<xsl:text>35010000</xsl:text>
			</xsl:when>

			<!-- Bank Charges -->
			<xsl:when test="$key = 'CAMT/ACCB/CHRG'">
				<xsl:text>80370000</xsl:text>
			</xsl:when>

			<!-- Fallback: 8 spaces (unknown transaction code) -->
			<xsl:otherwise>
				<xsl:text>        </xsl:text>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<!-- Convenience function that extracts BkTxCd fields from a node and returns the CODA code.
	     Handles both Domn (ISO 20022 domain) and Prtry (proprietary) code structures.
	     When only proprietary codes exist, returns 8 spaces (fallback). -->
	<xsl:function name="cf:getTransactionCodeFromEntry" as="xs:string">
		<xsl:param name="domainCode" as="xs:string" />
		<xsl:param name="familyCode" as="xs:string" />
		<xsl:param name="subFamilyCode" as="xs:string" />

		<xsl:choose>
			<xsl:when test="$domainCode != '' and $familyCode != ''">
				<xsl:sequence select="cf:getTransactionCode($domainCode, $familyCode, $subFamilyCode)" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:text>        </xsl:text>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

</xsl:stylesheet>
