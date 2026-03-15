<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:c="urn:iso:std:iso:20022:tech:xsd:camt.053.001.10" xmlns:cf="http://custom.functions.subite.eu/cf"
	extension-element-prefixes="cf">

	<xsl:include href="camt.053.001.XX-to-coda.xslt" />

	<xsl:template match="/c:Document/c:BkToCstmrStmt">
		<xsl:message select="concat('Starting in debug mode: ', $debug.mode)" />
		<xsl:call-template name="handleDocument" />
	</xsl:template>

</xsl:stylesheet>
