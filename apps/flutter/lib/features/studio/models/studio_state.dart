enum StudioNavTab {
  home,
  history,
  coreHub,
  team,
  docs,
  git,
  settings,
}

enum PreFlightStatus {
  pending,
  running,
  pass,
  fail,
}

class StudioMessage {
  const StudioMessage({
    required this.id,
    required this.sender, // 'user' or 'assistant'
    required this.content,
    required this.timestamp,
    this.trace,
    this.isStreaming = false,
  });

  final String id;
  final String sender;
  final String content;
  final DateTime timestamp;
  final String? trace;
  final bool isStreaming;

  StudioMessage copyWith({
    String? id,
    String? sender,
    String? content,
    DateTime? timestamp,
    String? trace,
    bool? isStreaming,
  }) {
    return StudioMessage(
      id: id ?? this.id,
      sender: sender ?? this.sender,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      trace: trace ?? this.trace,
      isStreaming: isStreaming ?? this.isStreaming,
    );
  }
}

class StudioThread {
  StudioThread({
    required this.id,
    required this.title,
    required this.createdAt,
    List<StudioMessage>? messages,
  }) : messages = messages ?? [];

  final String id;
  String title;
  final DateTime createdAt;
  final List<StudioMessage> messages;
}

class CoreHubModuleItem {
  const CoreHubModuleItem({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.assetPng,
    required this.category,
    required this.tier,
    required this.statusText,
    required this.isInstalled,
    required this.hasUpdate,
    this.score,
  });

  final String id;
  final String name;
  final String slug;
  final String description;
  final String assetPng;
  final String category;
  final String tier;
  final String statusText;
  final bool isInstalled;
  final bool hasUpdate;
  final double? score;

  CoreHubModuleItem copyWith({
    String? id,
    String? name,
    String? slug,
    String? description,
    String? assetPng,
    String? category,
    String? tier,
    String? statusText,
    bool? isInstalled,
    bool? hasUpdate,
    double? score,
  }) {
    return CoreHubModuleItem(
      id: id ?? this.id,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      description: description ?? this.description,
      assetPng: assetPng ?? this.assetPng,
      category: category ?? this.category,
      tier: tier ?? this.tier,
      statusText: statusText ?? this.statusText,
      isInstalled: isInstalled ?? this.isInstalled,
      hasUpdate: hasUpdate ?? this.hasUpdate,
      score: score ?? this.score,
    );
  }
}

class PreFlightGate {
  const PreFlightGate({
    required this.name,
    required this.command,
    required this.description,
    this.status = PreFlightStatus.pass,
    this.duration = '120ms',
  });

  final String name;
  final String command;
  final String description;
  final PreFlightStatus status;
  final String duration;

  PreFlightGate copyWith({
    String? name,
    String? command,
    String? description,
    PreFlightStatus? status,
    String? duration,
  }) {
    return PreFlightGate(
      name: name ?? this.name,
      command: command ?? this.command,
      description: description ?? this.description,
      status: status ?? this.status,
      duration: duration ?? this.duration,
    );
  }
}

class MessagingChannelStatus {
  const MessagingChannelStatus({
    required this.name,
    required this.protocol,
    required this.status,
    required this.isOnline,
    this.unread = 0,
  });

  final String name;
  final String protocol;
  final String status;
  final bool isOnline;
  final int unread;
}
