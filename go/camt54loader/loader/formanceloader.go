package loader

import (
	"camt54loader/data/camt_054_001_10"
	"camt54loader/data/statements"
	"camt54loader/loaderror"
	"camt54loader/tools"
	"context"
	"fmt"
	"log/slog"
	"math/big"
	"reflect"
	"strings"

	formance "github.com/formancehq/formance-sdk-go/v3"
	"github.com/formancehq/formance-sdk-go/v3/pkg/models/operations"
	"github.com/formancehq/formance-sdk-go/v3/pkg/models/shared"
)

type FormanceLoader struct {
	Client     formance.Formance
	LedgerName string
}

const script = `
vars {
	account $source
	account $destination
	monetary $mvt
}
send $mvt (
	source = $source allowing unbounded overdraft
	destination = $destination
)`

func (l FormanceLoader) Load(doc camt_054_001_10.Document) error {
	slog.Info("loading", "doc", reflect.TypeOf(doc))
	slog.Debug("doc", "namespace", doc.XMLName.Space)
	slog.Debug("GrpHdr", "CreDtTm", doc.BkToCstmrDbtCdtNtfctn.GrpHdr.CreDtTm)
	slog.Debug("GrpHdr", "MsgId", doc.BkToCstmrDbtCdtNtfctn.GrpHdr.MsgId)
	slog.Debug("Ntfctn", "len", len(doc.BkToCstmrDbtCdtNtfctn.Ntfctn))

	stmtChannel := make(chan statements.Statement, 100)
	go func() {
		defer close(stmtChannel)
		if len(doc.BkToCstmrDbtCdtNtfctn.Ntfctn) > 0 {
			for _, notif := range doc.BkToCstmrDbtCdtNtfctn.Ntfctn {
				var bankAccount = statements.BankAccount{
					Iban: string(*notif.Acct.Id.Iban),
					Bic:  string(*notif.Acct.Ownr.Id.OrgId.AnyBic),
				}
				slog.Debug("Ntfctn", "bankAccount", bankAccount)

				slog.Debug("Ntfctn[].Ntry", "len", len(notif.Ntry))
				if len(notif.Ntry) > 0 {
					for _, re := range notif.Ntry {
						handleEntry(re, stmtChannel)
					}
				}
			}
		}
	}()

	total := new(big.Int)
	totalPAYV := new(big.Int)
	// bicTotalMap := make(map[string]big.Int)
	// bicNbMap := make(map[string]int64)
	for stmt := range stmtChannel {
		slog.Debug(">", "Type", stmt.MvtType, "Amount", stmt.Amount, "From", stmt.DebitorAccount.Bic, "To", stmt.CreditorAccount.Bic, "Ref", stmt.RefEndToEndId)

		amct := tools.MustAmountCent(stmt.Amount)
		// bicCredit, ok := bicTotalMap[stmt.CreditorAccount.Bic]
		// if !ok {
		// 	bicCredit = *new(big.Int)
		// }
		// bicDebit, ok := bicTotalMap[stmt.DebitorAccount.Bic]
		// if !ok {
		// 	bicDebit = *new(big.Int)
		// }
		// bicNbMap[stmt.CreditorAccount.Bic]++
		// bicNbMap[stmt.DebitorAccount.Bic]++
		if stmt.MvtType == "CRDT" {
			total.Add(total, amct)
			// 	if strings.HasPrefix(stmt.CreditorAccount.Bic, "PAYV") {
			// 		totalPAYV.Add(totalPAYV, amct) // Normal case
			// 		bicTotalMap[stmt.CreditorAccount.Bic] = *new(big.Int).Add(&bicCredit, amct)
			// 		bicTotalMap[stmt.DebitorAccount.Bic] = *new(big.Int).Sub(&bicDebit, amct)
			// 	} else if strings.HasPrefix(stmt.DebitorAccount.Bic, "PAYV") {
			// 		// attempt to fix bank messy report
			// 		slog.Info("Inconsistant statement - inverse it", "type", stmt.MvtType, "Debitor BIC", stmt.DebitorAccount.Bic, "Creditor BIC", stmt.CreditorAccount.Bic, "amount", stmt.Amount)
			// 		totalPAYV.Add(totalPAYV, amct)
			// 		bicTotalMap[stmt.CreditorAccount.Bic] = *new(big.Int).Sub(&bicCredit, amct)
			// 		bicTotalMap[stmt.DebitorAccount.Bic] = *new(big.Int).Add(&bicDebit, amct)
			// 	} else {
			// 		slog.Info(strings.Repeat("?", 100))
			// 	}
		} else {
			total.Sub(total, amct)
			// 	if strings.HasPrefix(stmt.DebitorAccount.Bic, "PAYV") {
			// 		totalPAYV.Sub(totalPAYV, amct) // Normal case
			// 		bicTotalMap[stmt.CreditorAccount.Bic] = *new(big.Int).Add(&bicCredit, amct)
			// 		bicTotalMap[stmt.DebitorAccount.Bic] = *new(big.Int).Sub(&bicDebit, amct)
			// 	} else if strings.HasPrefix(stmt.CreditorAccount.Bic, "PAYV") {
			// 		// attempt to fix bank messy report
			// 		slog.Info("Inconsistant statement - inverse it", "type", stmt.MvtType, "Debitor BIC", stmt.DebitorAccount.Bic, "Creditor BIC", stmt.CreditorAccount.Bic, "amount", stmt.Amount)
			// 		totalPAYV.Sub(totalPAYV, amct)
			// 		bicTotalMap[stmt.CreditorAccount.Bic] = *new(big.Int).Sub(&bicCredit, amct)
			// 		bicTotalMap[stmt.DebitorAccount.Bic] = *new(big.Int).Add(&bicDebit, amct)
			// 	} else {
			// 		slog.Info(strings.Repeat("?", 100))
			// 	}
		}

		slog.Debug(strings.Repeat("=", 100))

		debitorAccountBefore := tools.Must(l.getBalance(stmt.DebitorAccount))
		creditorAccountBefore := tools.Must(l.getBalance(stmt.CreditorAccount))
		slog.Debug("Before Trx", "DebitorAccount", debitorAccountBefore, "CreditorAccount", creditorAccountBefore)

		slog.Debug(strings.Repeat("-", 100))
		l.executeTrx(stmt)
		slog.Debug(strings.Repeat("-", 100))

		debitorAccountAfter := tools.Must(l.getBalance(stmt.DebitorAccount))
		creditorAccountAfter := tools.Must(l.getBalance(stmt.CreditorAccount))
		slog.Debug("After Trx", "DebitorAccount", debitorAccountAfter, "CreditorAccount", creditorAccountAfter)

		checkBalances(debitorAccountBefore, debitorAccountAfter, creditorAccountBefore, creditorAccountAfter, stmt)
	}
	slog.Info("", "total", total)
	// keys := tools.SortMap(bicTotalMap)
	// for _, bic := range keys {
	// 	total := bicTotalMap[bic]
	// 	slog.Info("", "bic", bic, "nb", bicNbMap[bic], "total", &total)
	// }

	expectedTotal := tools.MustAmountCent(doc.BkToCstmrDbtCdtNtfctn.Ntfctn[0].Ntry[0].Amt.Text)

	if doc.BkToCstmrDbtCdtNtfctn.Ntfctn[0].Ntry[0].CdtDbtInd != "CRDT" {
		expectedTotal.Neg(expectedTotal)
	}

	if total.Cmp(expectedTotal) != 0 {
		return loaderror.CamtLoadError{Msg: fmt.Sprintf("Unexpected total - expected: %s - got: %s - diff: %s",
			expectedTotal, total, new(big.Int).Sub(total, totalPAYV))}
	}

	// if total.Cmp(totalPAYV) != 0 {
	// 	return loaderror.CamtLoadError{Msg: fmt.Sprintf("Unexpected totalPAYV - expected: %s - got: %s - diff: %s",
	// 		total, totalPAYV, new(big.Int).Sub(total, totalPAYV))}
	// }
	return nil
}

func checkBalances(
	beforeDeb map[string]*big.Int, afterDeb map[string]*big.Int,
	beforeCre map[string]*big.Int, afterCre map[string]*big.Int,
	stmt statements.Statement) error {
	key := stmt.Currency + "/2"
	amountCent := tools.MustAmountCent(stmt.Amount)

	var before = beforeDeb[key]
	if beforeDeb[key] == nil {
		before = big.NewInt(0)
	}
	slog.Debug("DEBITOR before", "currency", key, "bal", before, "amountCent", amountCent)
	slog.Debug("DEBITOR after", "currency", key, "bal", afterDeb[key])
	if big.NewInt(0).Sub(before, amountCent).Cmp(afterDeb[key]) != 0 {
		return loaderror.CamtLoadError{
			Msg: fmt.Sprintf("!!!!!!! INVESTIGATE statement !!!!!!! expected balance after: %s", big.NewInt(0).Sub(before, amountCent)),
		}
	}

	before = beforeCre[key]
	if beforeCre[key] == nil {
		before = big.NewInt(0)
	}
	slog.Debug("CREDITOR before", "currency", key, "bal", before, "amountCent", amountCent)
	slog.Debug("CREDITOR after", "currency", key, "bal", afterCre[key])
	if big.NewInt(0).Add(before, amountCent).Cmp(afterCre[key]) != 0 {
		return loaderror.CamtLoadError{
			Msg: fmt.Sprintf("!!!!!!! INVESTIGATE !!!!!!! expected balance after: %s", big.NewInt(0).Add(before, amountCent)),
		}
	}
	return nil
}

func handleEntry(re camt_054_001_10.ReportEntry12, stmtChannel chan statements.Statement) {
	size := len(re.NtryDtls)
	slog.Debug("Ntfctn[].Ntry[].NtryDtls", "len", size)
	if len(re.NtryDtls) > 0 {
		for _, entryDetails := range re.NtryDtls {
			handleEntryDetails(entryDetails, stmtChannel)
		}
	}
}

func handleEntryDetails(ed camt_054_001_10.EntryDetails11, stmtChannel chan statements.Statement) {
	size := len(ed.TxDtls)
	slog.Debug("Ntfctn[].Ntry[].NtryDtls[].TxDtls", "len", size)
	// res := make([]statements.Statement, size)
	for _, et := range ed.TxDtls {
		convert(et, stmtChannel)
	}
}

func convert(et camt_054_001_10.EntryTransaction12, stmtChannel chan statements.Statement) {
	statement := statements.Statement{
		MvtType:       string(*et.CdtDbtInd),
		Amount:        et.Amt.Text,
		Currency:      string(et.Amt.Ccy),
		RefEndToEndId: string(*et.Refs.EndToEndId),
		RefTxId:       string(*et.Refs.TxId),
		TrxDateTime:   string(*et.RltdDts.TxDtTm),
		CreditorAccount: statements.BankAccount{
			Iban: string(*et.RltdPties.CdtrAcct.Id.Iban),
			Bic:  string(*et.RltdAgts.CdtrAgt.FinInstnId.Bicfi),
		},
		DebitorAccount: statements.BankAccount{
			Iban: string(*et.RltdPties.DbtrAcct.Id.Iban),
			Bic:  string(*et.RltdAgts.DbtrAgt.FinInstnId.Bicfi),
		},
		// TODO make it formance compliant...
	}
	stmtChannel <- statement
}

// func getCreateAccount( ba statements.BankAccount) *shared.V2Account { DOES NOT EXIST !?
// 	account := getAccount(ba)
// 	if account == nil {
// 		slog.Info("Create", "Account", ba)
// 		ctx := context.Background()
// 		res, err := s.Ledger.V2.accCreateLedger(ctx, operations.V2CreateLedgerRequest{
// 			V2CreateLedgerRequest: &shared.V2CreateLedgerRequest{
// 				Metadata: map[string]string{
// 					"BIC": ba.Bic,
// 				},
// 			},
// 			Ledger: ledgerName,
// 		})
// 		if err != nil {
// 			return loaderror.CamtLoadError{Msg: err)
// 		}
// 		if res != nil {
// 			// handle response
// 			account = getAccount(ba)
// 		}
// 	}
// 	return account
// }

// func (l FormanceLoader) getAccount(ba statements.BankAccount) (*shared.V2Account, error) {
// 	slog.Debug("Check existance of ", "Account", ba)
// 	ctx := context.Background()

// 	var data *shared.V2Account = nil

// 	res, err := l.Client.Ledger.V2.GetAccount(ctx, operations.V2GetAccountRequest{
// 		Address: ba.Iban,
// 		Ledger:  l.LedgerName,
// 	})
// 	if err != nil {
// 		if strings.Contains(err.Error(), "NOT_FOUND") {
// 			slog.Warn("Account not found : ", "name", err)
// 		} else {
// 			return nil, err
// 		}
// 	} else {
// 		slog.Info("account exists", "res", res.V2AccountResponse.Data)
// 		if res.V2AccountResponse != nil {
// 			data = &res.V2AccountResponse.Data
// 		}
// 	}
// 	return data, nil
// }

func (l FormanceLoader) getBalance(ba statements.BankAccount) (map[string]*big.Int, error) {
	slog.Debug("Get balance of", "Account", ba)
	ctx := context.Background()
	resBal, err := l.Client.Ledger.V2.GetBalancesAggregated(ctx, operations.V2GetBalancesAggregatedRequest{
		RequestBody: map[string]interface{}{
			"$match": map[string]any{
				"address": ba.Iban,
			},
		},
		Ledger: l.LedgerName,
	})

	if err != nil {
		return nil, err
	}
	return resBal.V2AggregateBalancesResponse.Data, nil
}

func (l FormanceLoader) executeTrx(stmt statements.Statement) error {
	slog.Debug("Execute Trx for", "stmt", stmt)
	ctx := context.Background()

	ref := stmt.RefTxId + "_" + stmt.RefEndToEndId
	idempotencyKey := stmt.CreditorAccount.Iban + "_" + stmt.DebitorAccount.Iban + "_" + ref
	destination := stmt.CreditorAccount.Iban
	source := stmt.DebitorAccount.Iban
	amount := tools.MustAmountCent(stmt.Amount)
	mvt := fmt.Sprintf("%s/2 %s", stmt.Currency, amount)

	// fix bank messy report. Is this working ?
	invalidCreditAccountAssignment := stmt.MvtType == "CRDT" && strings.HasPrefix(stmt.DebitorAccount.Bic, "PAYV")
	invalidDebitAccountAssignment := stmt.MvtType == "DBIT" && strings.HasPrefix(stmt.CreditorAccount.Bic, "PAYV")
	if invalidCreditAccountAssignment || invalidDebitAccountAssignment {
		slog.Info("Inconsistant statement - inverse it:", "type", stmt.MvtType, "Debitor BIC", stmt.DebitorAccount.Bic, "Creditor BIC", stmt.CreditorAccount.Bic, "amount", stmt.Amount)
		destination = stmt.DebitorAccount.Iban
		source = stmt.CreditorAccount.Iban
	}

	slog.Debug(" > ", "source", source)
	slog.Debug(" > ", "destination", destination)
	slog.Debug(" > ", "mvt", mvt)
	slog.Debug(" > ", "ref", ref)
	slog.Debug(" > ", "idempotencyKey", idempotencyKey)

	res, err := l.Client.Ledger.V2.CreateTransaction(ctx, operations.V2CreateTransactionRequest{
		Ledger:         l.LedgerName,
		IdempotencyKey: formance.String(idempotencyKey), // does not seem to work
		V2PostTransaction: shared.V2PostTransaction{
			Metadata:  map[string]string{},
			Reference: formance.String(ref), // does not seem to work
			Script: &shared.V2PostTransactionScript{
				Plain: script,
				Vars: map[string]any{
					"mvt":         mvt,
					"source":      source,
					"destination": destination,
				},
			},
		},
	})
	if err != nil {
		return err
	}
	if res != nil {
		slog.Debug("Successful", "Trx", res.V2CreateTransactionResponse)
	}
	return nil
}
