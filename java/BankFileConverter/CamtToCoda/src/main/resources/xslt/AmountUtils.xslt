<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:cf="http://custom.functions.subite.eu/cf">

	<xsl:include href="StringUtils.xslt" />

	<xsl:function name="cf:getAmountSignCode">
		<xsl:param name="amount" />
		<xsl:choose>
			<xsl:when test="$amount >= 0">
				<xsl:sequence select="'1'" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:sequence select="'0'" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getSignedAmount">
		<xsl:param name="amount" />
		<xsl:param name="type" />
		<xsl:choose>
			<xsl:when test="$type = 'CRDT' or string($type) = ''">
				<xsl:sequence select="$amount" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:sequence select="-$amount" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:formatBalance">
		<xsl:param name="balance" />

		<xsl:variable name="integer" select="cf:padLeft(substring-before($balance, '.'), 12, '0')" />
		<xsl:variable name="decimals" select="cf:padRight(substring-after($balance, '.'), 3, '0')" />

		<xsl:sequence select="concat($integer, $decimals)" />
	</xsl:function>

</xsl:stylesheet>
