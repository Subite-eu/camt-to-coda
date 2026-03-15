package app

import (
	"camt54loader/data/camt_053_001_08"
	"camt54loader/data/camt_054_001_10"
	"camt54loader/loaderror"
	"camt54loader/parser"
	"camt54loader/tools"
	"fmt"
	"log/slog"
	"math/big"
	"path/filepath"
	"reflect"
	"strconv"
	"strings"
	"sync"
)

type ToStringConverter interface {
	ToCsv() string
}

type AnalysisResults struct {
	Camt53OpeningBalance *big.Int
	Camt53ClosingBalance *big.Int
	Camt53Mvt            *big.Int
	Diff53Bal            *big.Int
	Diff53BalMvt         *big.Int
	Camt53Nb             int
	Camt54Nb             int
	Camt54Mvt            *big.Int
	Camt54Total          *big.Int
	Diff54TotalMvt       *big.Int
	Diff53Mvt_54Total    *big.Int
	Error                error
}

func (a AnalysisResults) ToCsv() string {
	return fmt.Sprintf("%s,%s,%s,%s,%s,%d,%d,%s,%s,%s,%s,%v",
		a.Camt53OpeningBalance,
		a.Camt53ClosingBalance,
		a.Camt53Mvt,
		a.Diff53Bal,
		a.Diff53BalMvt,
		a.Camt53Nb,
		a.Camt54Nb,
		a.Camt54Mvt,
		a.Camt54Total,
		a.Diff54TotalMvt,
		a.Diff53Mvt_54Total,
		a.Error,
	)
}

type Analyser struct {
	Camt053Dir   string
	Camt054Dir   string
	Camt53Parser parser.Camt53Parser
	Camt54Parser parser.Camt54Parser
	Results      map[string]map[string]AnalysisResults
}

func NewAnalyser(camt053Dir string, camt054Dir string) Analyser {
	return Analyser{
		Camt053Dir:   camt053Dir,
		Camt054Dir:   camt054Dir,
		Camt53Parser: parser.Camt53Parser{},
		Camt54Parser: parser.Camt54Parser{},
		Results:      make(map[string]map[string]AnalysisResults),
	}
}

func (a Analyser) Analyse() error {
	var wg sync.WaitGroup
	err := a.analyse(&wg)
	if err != nil {
		return err
	}
	wg.Wait()
	a.printResults()
	return nil
}

func (a Analyser) printResults() {
	slog.Info("Results:")
	a.printHeaders()
	keyAccounts := tools.SortMap(a.Results)
	for _, account := range keyAccounts {
		resPerDate := a.Results[account]
		keyDates := tools.SortMap(resPerDate)
		for idx, date := range keyDates {
			res := resPerDate[date]

			balanceCheck := "NA"
			if idx > 0 {
				previous, ok := resPerDate[keyDates[idx-1]]
				if ok && previous.Camt53ClosingBalance != nil {
					if previous.Camt53ClosingBalance.Cmp(res.Camt53OpeningBalance) == 0 {
						balanceCheck = "OK"
					} else {
						balanceCheck = fmt.Sprintf("%s", new(big.Int).Sub(previous.Camt53ClosingBalance, res.Camt53OpeningBalance))
					}
				}
			}
			fmt.Printf("%s,%s,%s,%s\n", account, date, res.ToCsv(), balanceCheck)
		}
	}
}

func (a Analyser) printHeaders() {
	fmt.Print("Account,Date,")
	val := reflect.Indirect(reflect.ValueOf(AnalysisResults{}))
	for i := 0; i < val.NumField(); i++ {
		fmt.Print(val.Type().Field(i).Name + ",")
	}
	fmt.Println("Check Balance seq")
}

func (a Analyser) analyse(wg *sync.WaitGroup) error {
	if !tools.IsDirectory(a.Camt053Dir) {
		return loaderror.CamtLoadError{Msg: fmt.Sprintf("Camt053Dir: '%s' is not a directory", a.Camt053Dir)}
	}
	if !tools.IsDirectory(a.Camt054Dir) {
		return loaderror.CamtLoadError{Msg: fmt.Sprintf("Camt054Dir: '%s' is not a directory", a.Camt054Dir)}
	}
	return a.doAnalyseFolder(wg)
}

func (a Analyser) doAnalyseFolder(wg *sync.WaitGroup) error {
	files, err := filepath.Glob(a.Camt053Dir + "/*")
	if err != nil {
		return err
	}
	var mutex = &sync.RWMutex{}
	for _, child := range files {
		if !tools.IsDirectory(child) {
			a.doAnalyseFile(wg, mutex, child)
		}
	}
	return nil
}

func (a Analyser) doAnalyseFile(wg *sync.WaitGroup, mutex *sync.RWMutex, camt053File string) {
	slog.Info("loading", "camt053File", camt053File)
	wg.Add(1)
	go func() {
		defer wg.Done()

		fileName := filepath.Base(camt053File)
		fileDate := strings.Split(fileName, ".")[0]

		camt53Doc, err := a.Camt53Parser.Parse(camt053File)
		if err != nil {
			slog.Warn("Unexpected error", "camt053File", camt053File, "error", err)
			a.writeResult(mutex, "?", fileDate, AnalysisResults{
				Error: err,
			})
			return
		}
		camt054File := a.Camt054Dir + "/" + fileName

		camt54Doc, err54 := a.Camt54Parser.Parse(camt054File)
		if err54 != nil {
			slog.Warn("Unexpected error", "camt054File", camt053File, "error", err54)
		}

		for _, stmt := range camt53Doc.BkToCstmrStmt.Stmt {
			acc := string(stmt.Acct.Id.Othr.Id)
			res := AnalysisResults{
				Camt53OpeningBalance: tools.MustAmountCent(stmt.Bal[0].Amt.Text),
				Camt53ClosingBalance: tools.MustAmountCent(stmt.Bal[1].Amt.Text),
				Camt53Mvt:            a.computeCamt53Mvt(stmt),
				Camt53Nb:             a.countCamt53Mvt(stmt),
				Error:                err54,
			}
			res.Diff53Bal = new(big.Int).Sub(res.Camt53ClosingBalance, res.Camt53OpeningBalance)
			res.Diff53BalMvt = new(big.Int).Sub(res.Diff53Bal, res.Camt53Mvt)
			if err54 == nil {
				res.Camt54Nb = a.countCamt54Mvt(acc, camt54Doc.BkToCstmrDbtCdtNtfctn.Ntfctn)
				res.Camt54Mvt = a.computeCamt54Mvt(acc, camt54Doc.BkToCstmrDbtCdtNtfctn.Ntfctn)
				res.Camt54Total = a.computeCamt54Total(acc, camt54Doc.BkToCstmrDbtCdtNtfctn.Ntfctn)
				res.Diff54TotalMvt = new(big.Int).Sub(res.Camt54Total, res.Camt54Mvt)
				res.Diff53Mvt_54Total = new(big.Int).Sub(res.Camt53Mvt, res.Camt54Total)
			}
			a.writeResult(mutex, acc, fileDate, res)
		}

	}()
}
func (a Analyser) writeResult(mutex *sync.RWMutex, account string, date string, res AnalysisResults) {
	mutex.Lock()
	_, ok := a.Results[account]
	if !ok {
		a.Results[account] = make(map[string]AnalysisResults)
	}
	a.Results[account][date] = res
	mutex.Unlock()
}

func (a Analyser) computeCamt53Mvt(stmt camt_053_001_08.AccountStatement9) *big.Int {
	total := new(big.Int)
	for _, entry := range stmt.Ntry {
		amount := a.signAmount(string(entry.CdtDbtInd), entry.Amt.Text)
		if entry.CdtDbtInd == "DBIT" {
			amount = new(big.Int).Neg(amount)
		}
		slog.Info("", "amount", amount)
		total.Add(total, amount)
	}
	return total
}

func (a Analyser) countCamt53Mvt(stmt camt_053_001_08.AccountStatement9) int {
	var total int
	for _, entry := range stmt.Ntry {
		for _, batch := range entry.NtryDtls {
			total += tools.Must(strconv.Atoi(string(*batch.Btch.NbOfTxs)))
		}
	}
	return total
}

func (a Analyser) computeCamt54Mvt(acc string, notifs []camt_054_001_10.AccountNotification20) *big.Int {
	total := new(big.Int)
	for _, notif := range notifs {
		if string(*notif.Acct.Id.Iban) == acc {
			for _, entry := range notif.Ntry {
				for _, details := range entry.NtryDtls {
					for _, detail := range details.TxDtls {
						total.Add(total, a.signAmount(string(*detail.CdtDbtInd), detail.Amt.Text))
					}
				}
			}
		}
	}
	return total
}

func (a Analyser) countCamt54Mvt(acc string, notifs []camt_054_001_10.AccountNotification20) int {
	total := 0
	for _, notif := range notifs {
		if string(*notif.Acct.Id.Iban) == acc {
			for _, entry := range notif.Ntry {
				for _, details := range entry.NtryDtls {
					total += len(details.TxDtls)
				}
			}
		}
	}
	return total
}

func (a Analyser) computeCamt54Total(acc string, notifs []camt_054_001_10.AccountNotification20) *big.Int {
	total := new(big.Int)
	for _, notif := range notifs {
		//slog.Error("computeCamt54Total", "notif.Acct.Id.Iban", notif.Acct.Id.Iban)
		if string(*notif.Acct.Id.Iban) == acc {
			for _, entry := range notif.Ntry {
				total.Add(total, a.signAmount(string(entry.CdtDbtInd), entry.Amt.Text))
			}
		}
	}
	return total
}

func (a Analyser) signAmount(mvtType string, amountStr string) *big.Int {
	amount := tools.MustAmountCent(amountStr)
	if mvtType == "DBIT" {
		amount = new(big.Int).Neg(amount)
	}
	return amount
}
