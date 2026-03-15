package eu.subite.tools;

import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

import eu.subite.error.CustomXsltException;
import net.sf.saxon.expr.XPathContext;
import net.sf.saxon.lib.ExtensionFunctionCall;
import net.sf.saxon.lib.ExtensionFunctionDefinition;
import net.sf.saxon.om.Sequence;
import net.sf.saxon.om.StructuredQName;
import net.sf.saxon.trans.XPathException;
import net.sf.saxon.value.SequenceType;
import net.sf.saxon.value.StringValue;

public class XsltErrorHelper extends ExtensionFunctionDefinition {

	private static final Logger LOGGER = LogManager.getLogger();

	@Override
	public StructuredQName getFunctionQName() {
		return new StructuredQName("cf", "http://custom.functions.subite.eu/cf", "throwError");
	}

	@Override
	public SequenceType[] getArgumentTypes() {
		return new SequenceType[] { SequenceType.SINGLE_STRING };
	}

	@Override
	public SequenceType getResultType(SequenceType[] suppliedArgumentTypes) {
		return SequenceType.VOID;
	}

	@Override
	public ExtensionFunctionCall makeCallExpression() {
		return new ExtensionFunctionCall() {
			@Override
			public Sequence call(XPathContext context, Sequence[] arguments) throws XPathException {
				var message = ((StringValue) arguments[0].iterate().next()).getStringValue();
				LOGGER.error(message);
				throw new CustomXsltException(message);
			}
		};
	}

}
