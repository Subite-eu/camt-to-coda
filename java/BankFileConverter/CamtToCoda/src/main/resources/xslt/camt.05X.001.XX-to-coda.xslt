<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
	xmlns:fn="http://www.w3.org/2005/xpath-functions" xmlns:xs="http://www.w3.org/2001/XMLSchema"
	xmlns:cf="http://custom.functions.subite.eu/cf" extension-element-prefixes="cf">

	<!-- put true() for non 'polluting" mode -->
	<xsl:variable name="debug.mode" select="false()" as="xs:boolean" />

	<xsl:variable name="NL" select="'&#xa;'" />

	<xsl:strip-space elements="*" />

	<xsl:include href="DateUtils.xslt" />
	<xsl:include href="AmountUtils.xslt" />
	<xsl:include href="TransactionCodeUtils.xslt" />

	<xsl:function name="cf:debug">
		<xsl:param name="msg" />
		<xsl:if test="$debug.mode">
			<xsl:sequence
				select="concat('________________________________________________________________________________________________________________________________', $NL, $msg, $NL)" />
		</xsl:if>
	</xsl:function>
	
	<xsl:function name="cf:getAccountStructure">
		<xsl:param name="accountNumber" />
		<xsl:choose>
			<!-- IBAN of the Belgian account number -->
			<xsl:when test="starts-with($accountNumber, 'BE')">
				<xsl:sequence select="2" />
			</xsl:when>
			<!-- IBAN of the foreign account number -->
			<xsl:when test="string(number(substring($accountNumber, 1, 3)))='NaN'">
				<xsl:sequence select="3" />
			</xsl:when>
			<!-- TODO what about 0 & 1 ? -->
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>Bank Account not an IBAN... not supported yet: </xsl:text>
					<xsl:value-of select="$accountNumber" />
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getBankAccount">
		<xsl:param name="iban" />
		<xsl:param name="other" />
		<xsl:choose>
			<xsl:when test="$iban != ''">
				<xsl:sequence select="$iban" />
			</xsl:when>
			<xsl:when test="$other != ''">
				<xsl:sequence select="$other" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>Bank Account not found</xsl:text>
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>
	
	<xsl:function name="cf:getBic">
		<xsl:param name="bic1" />
		<xsl:param name="bic2" />
		<xsl:param name="accemptEmpty" as="xs:boolean" />
		<xsl:choose>
			<xsl:when test="$bic1 != ''">
				<xsl:sequence select="$bic1" />
			</xsl:when>
			<xsl:when test="$bic2 != ''">
				<xsl:sequence select="$bic2" />
			</xsl:when>
			<xsl:when test="$accemptEmpty">
				<xsl:sequence select="''" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>BIC not found</xsl:text>
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getCurrency">
		<xsl:param name="curInAcct" />
		<xsl:param name="curInBal" />
		<xsl:choose>
			<xsl:when test="$curInAcct">
				<xsl:sequence select="$curInAcct" />
			</xsl:when>
			<xsl:when test="$curInBal">
				<xsl:sequence select="$curInBal" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>Currency not found in 'Acct/Ccy' nor in 'Bal/Amt/@Ccy'</xsl:text>
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:getValueDate">
		<xsl:param name="date1" />
		<xsl:param name="date2" />
		<xsl:param name="date3" />
		<xsl:param name="date4" />
		<xsl:choose>
			<xsl:when test="$date1 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date1)" />
			</xsl:when>
			<xsl:when test="$date2 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date2)" />
			</xsl:when>
			<xsl:when test="$date3 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date3)" />
			</xsl:when>
			<xsl:when test="$date4 != ''">
				<xsl:sequence select="cf:dateToDdMmYy($date4)" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:text>000000</xsl:text>
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

	<xsl:function name="cf:checkBalances">
		<xsl:param name="open" />
		<xsl:param name="mvt" />
		<xsl:param name="close" />
		<xsl:choose>
			<xsl:when test="round($open + $mvt, 2) = $close">
				<xsl:sequence select="'Balances are consistent &#x1f929;&#x1F37E;'" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:value-of select="concat('Balances are inconsistent !? &#x1f624;&#x1f624;: ', $NL)" />
					<xsl:value-of select="concat(cf:padRight('Open: ', 10, ' '), cf:padLeft(format-number($open, '0.00'), 15, ' '), $NL)" />
					<xsl:value-of select="concat(cf:padRight('Movements: ', 10, ' '), cf:padLeft(format-number($mvt, '0.00'), 15, ' '), $NL)" />
					<xsl:value-of select="concat(cf:padRight('Close: ', 10, ' '), cf:padLeft(format-number($close, '0.00'), 15, ' '), $NL)" />
					<xsl:value-of
						select="concat(cf:padRight('Diff: ', 10, ' '), cf:padLeft(format-number(round($open + $mvt - $close, 2), '0.00'), 15, ' '), $NL)" />
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>
	
	<xsl:function name="cf:getReportDate">
		<xsl:param name="date1" />
		<xsl:param name="date2" />
		<xsl:param name="date3" />
		<xsl:choose>
			<xsl:when test="$date1 != ''">
				<xsl:sequence select="$date1" />
			</xsl:when>
			<xsl:when test="$date2 != ''">
				<xsl:sequence select="$date2" />
			</xsl:when>
			<xsl:when test="$date3 != ''">
				<xsl:sequence select="$date3" />
			</xsl:when>
			<xsl:otherwise>
				<xsl:variable name="message">
					<xsl:text>Report date required</xsl:text>
				</xsl:variable>
				<xsl:sequence select="cf:throwError($message)" />
			</xsl:otherwise>
		</xsl:choose>
	</xsl:function>

</xsl:stylesheet>
  