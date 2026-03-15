package parser

import (
	"camt54loader/loaderror"
	"encoding/xml"
	"fmt"
	"io"
	"log/slog"
	"os"
	"reflect"
)

type CamtParser[T any] struct {
}

func (p *CamtParser[T]) Parse(file string) (*T, error) {
	slog.Info("Parsing", "file", file)
	xmlFile, err := os.Open(file)
	if err != nil {
		return nil,
			loaderror.CamtLoadError{Msg: fmt.Sprintf("Unexpected error while opening file: %s - error: %s",
				file, err.Error())}
	}
	defer xmlFile.Close()

	byteValue, _ := io.ReadAll(xmlFile)
	doc := new(T)
	err = xml.Unmarshal(byteValue, doc)
	if err != nil {
		return nil,
			loaderror.CamtLoadError{Msg: fmt.Sprintf("Unexpected error while Unmarshalling file: %s to type %s - error: %s",
				file, reflect.TypeOf(doc), err.Error())}
	}

	slog.Info("Successfully parsed", "file", file)
	return doc, nil
}
