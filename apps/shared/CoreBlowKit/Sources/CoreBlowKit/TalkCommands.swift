import Foundation
public enum TalkCommands { public enum Action: String, Sendable { case startListening, stopListening, speak, cancel } }
