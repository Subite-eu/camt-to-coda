package statements

type BankAccount struct {
	Iban string
	Bic  string
}

type Statement struct {
	MvtType         string
	Amount          string
	Currency        string
	RefEndToEndId   string
	RefTxId         string
	TrxDateTime     string
	CreditorAccount BankAccount
	DebitorAccount  BankAccount
}
