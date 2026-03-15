package main

import (
	"camt54loader/app"
	"camt54loader/loader"
	"context"
	"fmt"
	"log"
	"log/slog"
	"math/rand/v2"
	"os"
	"slices"
	"strings"
	"time"

	formance "github.com/formancehq/formance-sdk-go/v3"
	"github.com/formancehq/formance-sdk-go/v3/pkg/models/operations"
	"github.com/formancehq/formance-sdk-go/v3/pkg/models/shared"
)

func main() {
	//slog.SetLogLoggerLevel(slog.LevelDebug)
	slog.SetLogLoggerLevel(slog.LevelInfo)
	slog.Info("Start")
	start := time.Now()

	args := os.Args[1:]

	switch {
	case slices.Contains(args, "analyse"):
		analyseCamt()
	default:
		executeOnLedger()
	}

	slog.Info("Done ", "in", time.Since(start))
}

func analyseCamt() {
	app := app.NewAnalyser(
		"../../example-files/CAMT/LT625883379695428516/CAMT_053",
		"../../example-files/CAMT/LT625883379695428516/CAMT_054",
	)
	app.Analyse()
}

func executeOnLedger() {

	//ledgerName := "camt-to-ledger"
	ledgerName := "camt-to-ledger-" + fmt.Sprintf("%v", rand.Int())
	client := initClient()
	createLedger(client, ledgerName)

	app := app.NewApp(
		ledgerName,
		loader.FormanceLoader{
			Client:     client,
			LedgerName: ledgerName,
		},
	)

	path := "../../example-files/CAMT/TEST"
	// path := "../../example-files/CAMT/LT625883379695428516/CAMT_054/"
	// path := "../../example-files/CAMT/LT809872649478701594/CAMT_054/"
	// path := "../../example-files/CAMT/LT625883379695428516/CAMT_054/2024-03-14.xml"
	app.Load(path)
}

func initClient() formance.Formance {
	slog.Info("initClient")
	var s = formance.New(
	// formance.WithServerURL("http://127.0.0.1:3068/"),
	// formance.WithServerURL("http://127.0.0.1/"),
	// formance.WithSecurity(shared.Security{
	// 	ClientID:     formance.String(""),
	// 	ClientSecret: formance.String(""),
	// }),
	// formance.WithSecurity(shared.Security{
	// 	ClientID:     formance.String("global"),
	// 	ClientSecret: formance.String("global"),
	// 	//TokenURL:     formance.String("http://127.0.0.1:80/api/auth/oauth/token"),
	// }),
	)
	return *s
}

func createLedger(s formance.Formance, ledgerName string) {
	if !ledgerExists(s, ledgerName) {
		slog.Info("Create", "ledger", ledgerName)
		ctx := context.Background()
		res, err := s.Ledger.V2.CreateLedger(ctx, operations.V2CreateLedgerRequest{
			V2CreateLedgerRequest: &shared.V2CreateLedgerRequest{
				Metadata: map[string]string{
					"admin": "true",
				},
			},
			Ledger: ledgerName,
		})
		if err != nil {
			log.Fatal(err)
		}
		if res != nil {
			// handle response
		}
	}
}

func ledgerExists(s formance.Formance, name string) bool {
	slog.Info("Existence of", "ledger", name)
	ctx := context.Background()
	res, err := s.Ledger.V2.GetLedger(ctx, operations.V2GetLedgerRequest{
		Ledger: name,
	})
	if err != nil {
		if strings.Contains(err.Error(), "NOT_FOUND") {
			slog.Warn("Ledger not found : ", "name", err)
			return false
		} else {
			log.Fatal(err)
		}
	}
	slog.Info("ledger found : ", "res", res.V2GetLedgerResponse.Data)
	return true
}
