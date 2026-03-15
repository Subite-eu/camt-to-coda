package app

import (
	"camt54loader/loader"
	"camt54loader/parser"
	"camt54loader/tools"
	"fmt"
	"log"
	"log/slog"
	"path/filepath"
	"sync"
)

type App struct {
	LedgerName string
	Parser     parser.Camt54Parser
	Loader     loader.FormanceLoader
	Results    map[string]string
}

func NewApp(ledgerName string, loader loader.FormanceLoader) App {
	return App{
		LedgerName: ledgerName,
		Parser:     parser.Camt54Parser{},
		Loader:     loader,
		Results:    make(map[string]string),
	}
}
func (a App) Load(path string) {
	var wg sync.WaitGroup
	a.loadAny(&wg, path)
	wg.Wait()
	slog.Info("Results:")
	for file, res := range a.Results {
		fmt.Printf("%s - %v\n", file, res)
	}
}
func (a App) loadAny(wg *sync.WaitGroup, path string) {
	if tools.IsDirectory(path) {
		slog.Info("loading", "dir", path)
		files, err := filepath.Glob(path + "/*")
		if err != nil {
			log.Fatal(err)
		}

		for _, child := range files {
			if tools.IsDirectory(child) {
				a.loadAny(wg, child)
			} else {
				a.loadFile(wg, child)
			}
		}
	} else {
		a.loadFile(wg, path)
	}
}
func (a App) loadFile(wg *sync.WaitGroup, file string) {
	slog.Info("loading", "file", file)
	wg.Add(1)
	go func() {
		defer wg.Done()

		doc, err := a.Parser.Parse(file)
		if err != nil {
			slog.Warn("Unexpected error", "file", file, "error", err)
			a.Results[file] = err.Error()
			return
		}

		err = a.Loader.Load(*doc)
		if err != nil {
			slog.Warn("Unexpected error", "file", file, "error", err)
			a.Results[file] = err.Error()
		} else {
			a.Results[file] = "Ok"
		}
	}()
}
