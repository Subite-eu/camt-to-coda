<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
	xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:datetime="http://exslt.org/dates-and-times"
	xmlns:fn="http://www.w3.org/2005/xpath-functions"
	xmlns:cf="http://custom.functions.subite.eu/cf">

	<xsl:function name="cf:dateToDdMmYy">
		<xsl:param name="date" />
		<xsl:variable name="safeDate"
			select="cf:dateTimeToDate($date)" />
		<xsl:sequence
			select="fn:format-date($safeDate, '[D01][M01][Y01]')" />
	</xsl:function>

	<xsl:function name="cf:dateToYYYY-MM-DD">
		<xsl:param name="date" />
		<xsl:variable name="safeDate"
			select="cf:dateTimeToDate($date)" />
		<xsl:sequence
			select="fn:format-date($safeDate, '[Y0001]-[M01]-[D01]')" />
	</xsl:function>

	<xsl:function name="cf:dateTimeToDate">
		<xsl:param name="date" />
		<xsl:sequence
			select="xs:date(cf:dateTimeToDateStr($date))" />
	</xsl:function>

	<xsl:function name="cf:dateTimeToDateStr">
		<xsl:param name="date" />
		<xsl:sequence select="substring($date, 1, 10)" />
	</xsl:function>
</xsl:stylesheet>
