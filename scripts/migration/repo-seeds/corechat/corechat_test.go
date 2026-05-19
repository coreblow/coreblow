package corechat

import "testing"

func TestAppendMessageNormalizesMessage(t *testing.T) {
	thread := AppendMessage(Thread{ID: " t1 "}, Message{ID: " m1 ", Role: " User ", Content: " hello "})
	if thread.ID != "t1" || len(thread.Messages) != 1 {
		t.Fatalf("unexpected thread: %#v", thread)
	}
	if thread.Messages[0].Role != "user" || thread.Messages[0].Content != "hello" {
		t.Fatalf("unexpected message: %#v", thread.Messages[0])
	}
}
