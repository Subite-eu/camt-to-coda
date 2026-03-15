<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:cf="http://custom.functions.subite.eu/cf"
	exclude-result-prefixes="cf">

	<xsl:variable name="SPACES"
		select="'                                                                           '" />
	<xsl:variable name="ZEROS"
		select="'000000000000000000000000000000000000000000000000000000000000000000000000000'" />

	<xsl:function name="cf:getpaddingString" as="xs:string?">
		<xsl:param name="padChar" as="xs:string?" />
		<xsl:choose>
			<xsl:when test="$padChar = '0'">
				<xsl:sequence select="$ZEROS" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:sequence select="$SPACES" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:padRight">
		<xsl:param name="toPad" />
		<xsl:param name="size" as="xs:integer" />
		<xsl:param name="padChar" as="xs:string" />

		<xsl:variable name="truncated" select="substring(string($toPad), 1, $size)" />
		<xsl:sequence select="concat($truncated, cf:pad($truncated, $size, $padChar))" />
	</xsl:function>

	<xsl:function name="cf:padLeft">
		<xsl:param name="toPad" />
		<xsl:param name="size" as="xs:integer" />
		<xsl:param name="padChar" as="xs:string" />

		<xsl:variable name="truncated" select="substring(string($toPad), 1, $size)" />
		<xsl:sequence select="concat(cf:pad($truncated, $size, $padChar), $truncated)" />
	</xsl:function>

	<xsl:function name="cf:pad">
		<xsl:param name="toPad" />
		<xsl:param name="size" as="xs:integer" />
		<xsl:param name="padChar" as="xs:string" />

		<xsl:variable name="length" select="string-length(string($toPad))" />
		<xsl:variable name="paddingString" select="cf:getpaddingString($padChar)" />

		<xsl:sequence select="substring($paddingString, 1, $size - $length)" />
	</xsl:function>
</xsl:stylesheet>
