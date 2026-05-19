package corechat

import "strings"

type Message struct {
	ID      string
	Role    string
	Content string
}

type Thread struct {
	ID       string
	Messages []Message
}

func NormalizeMessage(message Message) Message {
	return Message{
		ID:      strings.TrimSpace(message.ID),
		Role:    strings.ToLower(strings.TrimSpace(message.Role)),
		Content: strings.TrimSpace(message.Content),
	}
}

func AppendMessage(thread Thread, message Message) Thread {
	next := Thread{ID: strings.TrimSpace(thread.ID)}
	next.Messages = append(next.Messages, thread.Messages...)
	next.Messages = append(next.Messages, NormalizeMessage(message))
	return next
}
