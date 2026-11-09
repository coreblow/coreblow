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
    this.toolSteps = const [],
  });

  final String id;
  final String sender;
  final String content;
  final DateTime timestamp;
  final String? trace;
  final bool isStreaming;
  final List<String> toolSteps;

  StudioMessage copyWith({
    String? id,
    String? sender,
    String? content,
    DateTime? timestamp,
    String? trace,
    bool? isStreaming,
    List<String>? toolSteps,
  }) {
    return StudioMessage(
      id: id ?? this.id,
      sender: sender ?? this.sender,
      content: content ?? this.content,
      timestamp: timestamp ?? this.timestamp,
      trace: trace ?? this.trace,
      isStreaming: isStreaming ?? this.isStreaming,
      toolSteps: toolSteps ?? this.toolSteps,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'sender': sender,
    'content': content,
    'timestamp': timestamp.toIso8601String(),
    if (trace != null) 'trace': trace,
    'isStreaming': isStreaming,
    if (toolSteps.isNotEmpty) 'toolSteps': toolSteps,
  };

  factory StudioMessage.fromJson(Map<String, dynamic> json) {
    final rawSteps = json['toolSteps'];
    final steps = rawSteps is List ? rawSteps.map((e) => e.toString()).toList() : const <String>[];
    return StudioMessage(
      id: json['id']?.toString() ?? '',
      sender: json['sender']?.toString() ?? 'user',
      content: json['content']?.toString() ?? '',
      timestamp: DateTime.tryParse(json['timestamp']?.toString() ?? '') ?? DateTime.now(),
      trace: json['trace']?.toString(),
      isStreaming: json['isStreaming'] == true,
      toolSteps: steps,
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

enum ConnectionTestState {
  idle,
  testing,
  success,
  failed,
}

class ConnectionTestResult {
  const ConnectionTestResult({
    required this.state,
    this.message = '',
    this.latencyMs,
  });

  final ConnectionTestState state;
  final String message;
  final int? latencyMs;

  bool get isSuccess => state == ConnectionTestState.success;
  bool get isFailed => state == ConnectionTestState.failed;
  bool get isTesting => state == ConnectionTestState.testing;
}

class MemoryWikiEntry {
  const MemoryWikiEntry({
    required this.title,
    required this.path,
    required this.snippet,
    required this.updated,
    required this.sizeBytes,
    required this.sizeFormatted,
  });

  final String title;
  final String path;
  final String snippet;
  final String updated;
  final int sizeBytes;
  final String sizeFormatted;
}
