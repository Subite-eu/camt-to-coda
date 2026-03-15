package parser

import (
	"camt54loader/data/camt_054_001_10"
)

type Camt54Parser struct {
}

func (p *Camt54Parser) Parse(file string) (*camt_054_001_10.Document, error) {
	parser := CamtParser[camt_054_001_10.Document]{}
	return parser.Parse(file)
}
