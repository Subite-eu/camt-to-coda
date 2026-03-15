package parser

import (
	"camt54loader/data/camt_053_001_08"
)

type Camt53Parser struct {
	File string
}

func (p *Camt53Parser) Parse(file string) (*camt_053_001_08.Document, error) {
	parser := CamtParser[camt_053_001_08.Document]{}
	return parser.Parse(file)
}
