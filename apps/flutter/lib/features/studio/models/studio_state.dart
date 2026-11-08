enum StudioNavTab {
  home,
  history,
  coreHub,
  team,
  docs,
  git,
}

class StudioMessage {
  const StudioMessage({
    required this.id,
    required this.sender,
    required this.content,
    required this.timestamp,
  });

  final String id;
  final String sender; // 'user' or 'assistant'
  final String content;
  final DateTime timestamp;
}
