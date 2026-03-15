package tools

import (
	"camt54loader/loaderror"
	"fmt"
	"log"
	"math/big"
	"os"
	"sort"
	"strings"
	"unicode/utf8"
)

func IsDirectory(path string) bool {
	fileInfo, err := os.Stat(path)
	if err != nil {
		log.Fatal(err)
	}

	return fileInfo.IsDir()
}

func Must[T any](o T, err error) T {
	if err != nil {
		log.Fatal(err)
	}
	return o
}
func MustGetFloat[T any](o T, b int, err error) T {
	if err != nil {
		log.Fatal(err)
	}
	return o
}

func MustAmountCent(amountStr string) *big.Int {
	return Must(AmountCent(amountStr))
}

func AmountCent(amountStr string) (*big.Int, error) {
	parts := strings.Split(amountStr, ".")
	if len(parts) > 2 {
		return nil, loaderror.CamtLoadError{Msg: fmt.Sprintf("invalid amount: %s", amountStr)}
	}

	decimals := "00"
	if len(parts) > 1 {
		decimals = parts[1]
		deciamlSize := utf8.RuneCountInString(decimals)
		if deciamlSize > 2 {
			return nil, loaderror.CamtLoadError{Msg: "Invalid amount - too many positions after comma"}
		}
		if deciamlSize < 2 {
			decimals = parts[1] + strings.Repeat("0", 2-deciamlSize)
		}
	}

	amountCent, ok := new(big.Int).SetString(parts[0]+decimals, 10)
	if !ok {
		return nil, loaderror.CamtLoadError{Msg: fmt.Sprintf("invalid amount: %s", amountStr)}
	}
	return amountCent, nil
}

func SortMap[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	return keys
}
