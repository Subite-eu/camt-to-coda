package main

import (
	"fmt"

	"github.com/gocomply/xsd2go/pkg/xsd2go"
)

func main() {
	convert("../../specifications/CAMT/camt.054.001.10.xsd")
	convert("../../specifications/CAMT/camt.053.001.08.xsd")
}

func convert(xsd string) {
	err := xsd2go.Convert(xsd, "camtxml", "../camt54loader/data", make([]string, 0))
	if err != nil {
		fmt.Println(err)
	}
}
