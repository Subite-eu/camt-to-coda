package loaderror

import "fmt"

type CamtLoadError struct {
	Msg string
}

func (e CamtLoadError) Error() string {
	return fmt.Sprintf("Camt Load Error %v", e.Msg)
}

func New(msg string) CamtLoadError {
	return CamtLoadError{
		Msg: msg,
	}
}
