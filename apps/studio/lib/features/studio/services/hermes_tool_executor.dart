import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

/// Structured outcome of a Hermes tool execution.
class HermesToolResult {
  final bool success;
  final String output;
  final int? exitCode;
  final String? error;

  const HermesToolResult({
    required this.success,
    required this.output,
    this.exitCode,
    this.error,
  });

  factory HermesToolResult.success(String output, {int? exitCode}) =>
      HermesToolResult(success: true, output: output, exitCode: exitCode);

  factory HermesToolResult.error(String error, {int? exitCode}) =>
      HermesToolResult(success: false, output: error, exitCode: exitCode, error: error);

  Map<String, dynamic> toJson() => {
    'success': success,
    'output': output,
    if (exitCode != null) 'exitCode': exitCode,
    if (error != null) 'error': error,
  };

  @override
  String toString() => output;
}

/// A parsed tool invocation emitted by the model (native OpenAI or Hermes XML).
class ParsedToolCall {
  final String id;
  final String name;
  final Map<String, dynamic> arguments;
  final String rawBlock;

  const ParsedToolCall({
    required this.id,
    required this.name,
    required this.arguments,
    required this.rawBlock,
  });

  String get shortSummary {
    if (name == 'terminal') {
      final cmd = (arguments['command'] ?? '').toString();
      return cmd.length > 40 ? '${cmd.substring(0, 40)}...' : cmd;
    }
    if (name == 'list_dir' || name == 'read_file' || name == 'write_file' || name == 'patch') {
      final p = (arguments['path'] ?? '').toString();
      final filename = p.split('/').where((s) => s.isNotEmpty).lastOrNull ?? p;
      return filename.isNotEmpty ? filename : p;
    }
    if (name == 'search_files') {
      return '${arguments['pattern'] ?? ''}';
    }
    return arguments.toString();
  }
}

typedef ProcessRunner = Future<ProcessResult> Function(
  String executable,
  List<String> arguments, {
  String? workingDirectory,
  Map<String, String>? environment,
});

/// Hermes Autonomous ReAct Local Tool Executor for CoreBlow Studio.
///
/// Implements the 6 core Hermes local tools:
/// 1. terminal
/// 2. read_file
/// 3. write_file
/// 4. patch
/// 5. search_files
/// 6. list_dir
class HermesToolExecutor {
  ProcessRunner processRunner;
  final void Function(String filePath)? onFileModified;

  HermesToolExecutor({
    ProcessRunner? processRunner,
    this.onFileModified,
  }) : processRunner = processRunner ?? Process.run;

  /// OpenAI-compatible tools schema for Hermes ReAct Engine.
  static const List<Map<String, dynamic>> openAiTools = [
    {
      'type': 'function',
      'function': {
        'name': 'terminal',
        'description': 'Execute a shell command in macOS bash with timeout and safety guards',
        'parameters': {
          'type': 'object',
          'properties': {
            'command': {'type': 'string', 'description': 'The bash command to execute'},
            'cwd': {'type': 'string', 'description': 'Optional working directory'}
          },
          'required': ['command']
        }
      }
    },
    {
      'type': 'function',
      'function': {
        'name': 'read_file',
        'description': 'Read file contents with 1-based line numbers and line limits',
        'parameters': {
          'type': 'object',
          'properties': {
            'path': {'type': 'string', 'description': 'Path to the file to read'},
            'offset': {'type': 'integer', 'description': 'Starting line number (1-based)'},
            'limit': {'type': 'integer', 'description': 'Maximum number of lines to read'}
          },
          'required': ['path']
        }
      }
    },
    {
      'type': 'function',
      'function': {
        'name': 'write_file',
        'description': 'Write full text content to a file (requires Full access profile)',
        'parameters': {
          'type': 'object',
          'properties': {
            'path': {'type': 'string', 'description': 'Path to the file to write'},
            'content': {'type': 'string', 'description': 'The full text content to write'}
          },
          'required': ['path', 'content']
        }
      }
    },
    {
      'type': 'function',
      'function': {
        'name': 'patch',
        'description': 'Replace target text in a file with new text (requires Full access profile)',
        'parameters': {
          'type': 'object',
          'properties': {
            'path': {'type': 'string', 'description': 'Path to the file to patch'},
            'old_text': {'type': 'string', 'description': 'Exact text to be replaced'},
            'new_text': {'type': 'string', 'description': 'Replacement text'}
          },
          'required': ['path', 'old_text', 'new_text']
        }
      }
    },
    {
      'type': 'function',
      'function': {
        'name': 'search_files',
        'description': 'Search file names and file contents in a directory',
        'parameters': {
          'type': 'object',
          'properties': {
            'path': {'type': 'string', 'description': 'Directory to search'},
            'pattern': {'type': 'string', 'description': 'Text pattern or regex to search for'},
            'max_matches': {'type': 'integer', 'description': 'Maximum matches to return'}
          },
          'required': ['pattern']
        }
      }
    },
    {
      'type': 'function',
      'function': {
        'name': 'list_dir',
        'description': 'List files and folders in a directory with file sizes',
        'parameters': {
          'type': 'object',
          'properties': {
            'path': {'type': 'string', 'description': 'Directory path to list'},
            'max_depth': {'type': 'integer', 'description': 'Max recursion depth (default 2)'},
            'max_entries': {'type': 'integer', 'description': 'Max entries to return'}
          },
          'required': ['path']
        }
      }
    }
  ];

  /// Default macOS environment with augmented toolchain PATHs.
  static Map<String, String> get augmentedEnvironment {
    final env = Map<String, String>.from(Platform.environment);
    final home = env['HOME'] ?? '';
    final existingPath = env['PATH'] ?? '';
    final additions = [
      '/opt/homebrew/bin',
      '/opt/homebrew/sbin',
      '/usr/local/bin',
      if (home.isNotEmpty) '$home/.local/share/pnpm',
      if (home.isNotEmpty) '$home/.bun/bin',
      if (home.isNotEmpty) '$home/.cargo/bin',
      '/usr/bin',
      '/bin',
      '/usr/sbin',
      '/sbin',
    ];
    final existingParts = existingPath.split(':').where((s) => s.isNotEmpty).toSet();
    final merged = [
      ...additions.where((p) => !existingParts.contains(p)),
      existingPath,
    ].where((p) => p.isNotEmpty).join(':');
    env['PATH'] = merged;
    return env;
  }

  /// Normalizes shorthand paths like `user/febrinanda/...`, `~/...`, and relative paths.
  static String normalizePath(String rawPath, {String? defaultCwd}) {
    var p = rawPath.trim();
    if (p.isEmpty) {
      return defaultCwd ?? Platform.environment['HOME'] ?? '/';
    }

    // Expand user/<username>/... or users/<username>/... -> /Users/<username>/...
    final userRegex = RegExp(r'^(?:user|users)/([a-zA-Z0-9_\-\.]+)(?:/(.*))?$', caseSensitive: false);
    final userMatch = userRegex.firstMatch(p);
    if (userMatch != null) {
      final user = userMatch.group(1)!;
      final rest = userMatch.group(2) ?? '';
      p = rest.isNotEmpty ? '/Users/$user/$rest' : '/Users/$user';
    }

    // Expand ~ or ~/
    final home = Platform.environment['HOME'] ?? '';
    if (p == '~') {
      p = home;
    } else if (p.startsWith('~/')) {
      p = home.isNotEmpty ? '$home/${p.substring(2)}' : p.substring(1);
    }

    // Relative path against defaultCwd
    if (!p.startsWith('/') && defaultCwd != null && defaultCwd.isNotEmpty) {
      p = '$defaultCwd/$p';
    }

    // Remove redundant ./ and //
    p = p.replaceAll('/./', '/');
    while (p.contains('//')) {
      p = p.replaceAll('//', '/');
    }

    // Clean trailing slashes if not root
    while (p.length > 1 && p.endsWith('/')) {
      p = p.substring(0, p.length - 1);
    }

    return p;
  }

  /// Scans arbitrary prompt text for path references and returns the normalized path.
  static String? detectAndNormalizePath(String text) {
    if (text.trim().isEmpty) return null;

    // Pattern 1: user/febrinanda/foo or users/febrinanda/foo
    final userRegex = RegExp(r'\b(?:user|users)/([a-zA-Z0-9_\-\.]+)(?:/([a-zA-Z0-9_\-\./]+))?', caseSensitive: false);
    final userMatch = userRegex.firstMatch(text);
    if (userMatch != null) {
      final matchedRaw = userMatch.group(0)!;
      return normalizePath(matchedRaw);
    }

    // Pattern 2: /Users/username/foo or /path/to/foo
    final absRegex = RegExp(r'(/(?:Users|home|var|tmp|private)/[a-zA-Z0-9_\-\./]+)');
    final absMatch = absRegex.firstMatch(text);
    if (absMatch != null) {
      return normalizePath(absMatch.group(1)!);
    }

    // Pattern 3: ~/foo
    final tildeRegex = RegExp(r'(~/[a-zA-Z0-9_\-\./]+)');
    final tildeMatch = tildeRegex.firstMatch(text);
    if (tildeMatch != null) {
      return normalizePath(tildeMatch.group(1)!);
    }

    return null;
  }

  /// Validates whether a terminal command is allowed under the current execution profile.
  static bool isCommandAllowed(String command, String executionProfile) {
    final trimmed = command.trim();
    if (trimmed.isEmpty) return false;

    // Catastrophic system-wipe checks across all profiles
    final catastrophicPatterns = [
      RegExp(r'rm\s+(-[a-zA-Z]*r[a-zA-Z]*f[a-zA-Z]*|-rf)\s+/(?:\s|$|\*)'),
      RegExp(r'mkfs(?:\.[a-zA-Z0-9]+)?\b'),
      RegExp(r'dd\s+if=/dev/zero\b'),
      RegExp(r':\(\)\s*\{\s*:\|:&\s*\};:'),
      RegExp(r'chmod\s+(-[a-zA-Z]*R[a-zA-Z]*)\s+777\s+/'),
    ];
    for (final pattern in catastrophicPatterns) {
      if (pattern.hasMatch(trimmed)) {
        return false;
      }
    }

    if (executionProfile == 'Full access') {
      return true;
    }

    // In restricted/read-only mode, only allow safe inspection commands
    const allowedPrefixes = [
      'ls', 'find', 'cat', 'head', 'tail', 'grep', 'rg', 'git status',
      'git log', 'git diff', 'git branch', 'git show', 'pwd', 'stat',
      'wc', 'tree', 'file', 'which', 'echo', 'du', 'test', 'uname',
    ];

    // Split pipeline or sequential operators
    final subCommands = trimmed
        .split(RegExp(r'[|;&]+'))
        .map((s) => s.trim())
        .where((s) => s.isNotEmpty);

    for (final sub in subCommands) {
      final subLower = sub.toLowerCase();
      final isAllowed = allowedPrefixes.any((prefix) =>
          subLower == prefix ||
          subLower.startsWith('$prefix ') ||
          subLower.startsWith('$prefix\t'));
      if (!isAllowed) {
        return false;
      }
    }

    return true;
  }

  /// Unified dispatch method for all Hermes tools.
  Future<HermesToolResult> executeTool({
    required String name,
    required Map<String, dynamic> arguments,
    String executionProfile = 'Full access',
    String? defaultCwd,
  }) async {
    switch (name) {
      case 'terminal':
        return executeTerminal(
          command: (arguments['command'] ?? '').toString(),
          cwd: arguments['cwd']?.toString(),
          executionProfile: executionProfile,
          defaultCwd: defaultCwd,
        );
      case 'read_file':
        final offset = int.tryParse(arguments['offset']?.toString() ?? '1') ?? 1;
        final limit = int.tryParse(arguments['limit']?.toString() ?? '200') ?? 200;
        return readFile(
          path: (arguments['path'] ?? '').toString(),
          offset: offset,
          limit: limit,
          defaultCwd: defaultCwd,
        );
      case 'write_file':
        return writeFile(
          path: (arguments['path'] ?? '').toString(),
          content: (arguments['content'] ?? '').toString(),
          executionProfile: executionProfile,
          defaultCwd: defaultCwd,
        );
      case 'patch':
        return patchFile(
          path: (arguments['path'] ?? '').toString(),
          oldText: (arguments['old_text'] ?? '').toString(),
          newText: (arguments['new_text'] ?? '').toString(),
          executionProfile: executionProfile,
          defaultCwd: defaultCwd,
        );
      case 'search_files':
        final maxMatches = int.tryParse(arguments['max_matches']?.toString() ?? '100') ?? 100;
        return searchFiles(
          path: arguments['path']?.toString(),
          pattern: (arguments['pattern'] ?? '').toString(),
          maxMatches: maxMatches,
          defaultCwd: defaultCwd,
        );
      case 'list_dir':
        final maxDepth = int.tryParse(arguments['max_depth']?.toString() ?? '2') ?? 2;
        final maxEntries = int.tryParse(arguments['max_entries']?.toString() ?? '150') ?? 150;
        return listDir(
          path: arguments['path']?.toString(),
          maxDepth: maxDepth,
          maxEntries: maxEntries,
          defaultCwd: defaultCwd,
        );
      default:
        return HermesToolResult.error(
          'Unknown Hermes tool: $name. Available tools: terminal, read_file, write_file, patch, search_files, list_dir.',
        );
    }
  }

  /// 1. `terminal`: Executes a shell command in macOS bash with timeout & safety guards.
  Future<HermesToolResult> executeTerminal({
    required String command,
    String? cwd,
    String executionProfile = 'Full access',
    String? defaultCwd,
  }) async {
    final trimmedCmd = command.trim();
    if (trimmedCmd.isEmpty) {
      return HermesToolResult.error('Empty command provided to terminal tool.');
    }

    // Security profile enforcement
    if (!isCommandAllowed(trimmedCmd, executionProfile)) {
      if (executionProfile == 'Full access') {
        return HermesToolResult.error('Blocked for system safety: catastrophic command pattern detected.');
      }
      return HermesToolResult.error(
        'Blocked by execution profile ($executionProfile). Switch to \'Full access\' in Studio to run modifying commands.',
      );
    }

    final targetDir = normalizePath(cwd ?? defaultCwd ?? Platform.environment['HOME'] ?? '/');
    final effectiveDir = Directory(targetDir).existsSync()
        ? targetDir
        : (Platform.environment['HOME'] ?? '/');

    try {
      final result = await processRunner(
        'bash',
        ['-lc', trimmedCmd],
        workingDirectory: effectiveDir,
        environment: augmentedEnvironment,
      ).timeout(const Duration(seconds: 20));

      final rawStdout = result.stdout.toString();
      final rawStderr = result.stderr.toString();

      // Cap stdout at 24 KB
      String formattedStdout = rawStdout;
      if (formattedStdout.length > 24 * 1024) {
        formattedStdout = '${formattedStdout.substring(0, 24 * 1024)}\n[... stdout truncated at 24KB ...]';
      }

      // Cap stderr at 8 KB
      String formattedStderr = rawStderr;
      if (formattedStderr.length > 8 * 1024) {
        formattedStderr = '${formattedStderr.substring(0, 8 * 1024)}\n[... stderr truncated at 8KB ...]';
      }

      final buffer = StringBuffer();
      buffer.writeln('[exitCode: ${result.exitCode}]');
      if (formattedStdout.trim().isNotEmpty) {
        buffer.writeln('STDOUT:');
        buffer.writeln(formattedStdout.trim());
      }
      if (formattedStderr.trim().isNotEmpty) {
        buffer.writeln('STDERR:');
        buffer.writeln(formattedStderr.trim());
      }
      if (formattedStdout.trim().isEmpty && formattedStderr.trim().isEmpty) {
        buffer.writeln('(No output produced)');
      }

      final output = buffer.toString().trim();
      return HermesToolResult(
        success: result.exitCode == 0,
        output: output,
        exitCode: result.exitCode,
      );
    } on TimeoutException {
      return HermesToolResult.error('Command timed out after 20 seconds.', exitCode: -1);
    } catch (e) {
      return HermesToolResult.error('Process execution error: $e', exitCode: -1);
    }
  }

  /// 2. `read_file`: Reads file lines with numbering (1-based) up to 32 KB.
  Future<HermesToolResult> readFile({
    required String path,
    int offset = 1,
    int limit = 200,
    String? defaultCwd,
  }) async {
    final normPath = normalizePath(path, defaultCwd: defaultCwd);
    final file = File(normPath);

    if (!file.existsSync()) {
      return HermesToolResult.error('File not found: $normPath');
    }

    try {
      final lines = await file.readAsLines();
      final start = max(1, offset);
      if (start > lines.length && lines.isNotEmpty) {
        return HermesToolResult.error('Offset $start exceeds file line count (${lines.length}).');
      }

      final end = min(start + max(1, limit) - 1, lines.length);
      final buffer = StringBuffer();
      buffer.writeln('=== File: $normPath (lines $start-$end of ${lines.length}) ===');

      for (var i = start - 1; i < end; i++) {
        buffer.writeln('${i + 1}: ${lines[i]}');
      }

      var output = buffer.toString();
      if (output.length > 32 * 1024) {
        output = '${output.substring(0, 32 * 1024)}\n[... file output truncated at 32KB ...]';
      }

      return HermesToolResult.success(output.trim());
    } catch (e) {
      return HermesToolResult.error('Failed to read file $normPath: $e');
    }
  }

  /// 3. `write_file`: Writes full content, creates parents, checks profile.
  Future<HermesToolResult> writeFile({
    required String path,
    required String content,
    String executionProfile = 'Full access',
    String? defaultCwd,
  }) async {
    if (executionProfile != 'Full access') {
      return HermesToolResult.error(
        'Blocked: write_file requires \'Full access\' profile. Current profile: $executionProfile.',
      );
    }

    final normPath = normalizePath(path, defaultCwd: defaultCwd);
    final file = File(normPath);

    try {
      if (!file.parent.existsSync()) {
        file.parent.createSync(recursive: true);
      }
      await file.writeAsString(content);
      onFileModified?.call(normPath);
      final lines = content.split('\n').length;
      return HermesToolResult.success(
        'Successfully wrote ${content.length} bytes ($lines lines) to $normPath.',
      );
    } catch (e) {
      return HermesToolResult.error('Failed to write file $normPath: $e');
    }
  }

  /// 4. `patch`: Replaces `old_text` with `new_text` in target file.
  Future<HermesToolResult> patchFile({
    required String path,
    required String oldText,
    required String newText,
    String executionProfile = 'Full access',
    String? defaultCwd,
  }) async {
    if (executionProfile != 'Full access') {
      return HermesToolResult.error(
        'Blocked: patch requires \'Full access\' profile. Current profile: $executionProfile.',
      );
    }

    final normPath = normalizePath(path, defaultCwd: defaultCwd);
    final file = File(normPath);

    if (!file.existsSync()) {
      return HermesToolResult.error('File not found: $normPath');
    }

    try {
      final content = await file.readAsString();
      if (!content.contains(oldText)) {
        return HermesToolResult.error(
          'Target old_text not found in $normPath. Ensure exact whitespace and content match.',
        );
      }

      final updatedContent = content.replaceFirst(oldText, newText);
      await file.writeAsString(updatedContent);
      onFileModified?.call(normPath);
      return HermesToolResult.success('Successfully patched $normPath.');
    } catch (e) {
      return HermesToolResult.error('Failed to patch file $normPath: $e');
    }
  }

  /// 5. `search_files`: Searches filenames and line contents excluding build/deps folders.
  Future<HermesToolResult> searchFiles({
    String? path,
    required String pattern,
    int maxMatches = 100,
    String? defaultCwd,
  }) async {
    final normPath = normalizePath(path ?? '', defaultCwd: defaultCwd);
    final dir = Directory(normPath);

    if (!dir.existsSync()) {
      return HermesToolResult.error('Directory not found: $normPath');
    }

    if (pattern.trim().isEmpty) {
      return HermesToolResult.error('Empty search pattern provided.');
    }

    final ignoredDirs = {
      '.git', 'node_modules', 'build', '.dart_tool', 'dist',
      'Pods', '.next', '.cache', '.wrangler', '.gradle', '.idea', '.vscode'
    };

    final results = <String>[];
    RegExp? regex;
    try {
      regex = RegExp(pattern, caseSensitive: false);
    } catch (_) {
      // Fallback to literal case-insensitive matching if invalid regex
    }

    try {
      final entities = dir.listSync(recursive: true, followLinks: false);
      for (final entity in entities) {
        if (results.length >= maxMatches) break;

        final p = entity.path;
        final segments = p.split('/');
        if (segments.any((seg) => ignoredDirs.contains(seg))) {
          continue;
        }

        final filename = segments.last;
        final isNameMatch = regex != null
            ? regex.hasMatch(filename)
            : filename.toLowerCase().contains(pattern.toLowerCase());

        if (isNameMatch) {
          results.add('[FILE MATCH] $p');
        }

        if (entity is File) {
          // Skip large files (> 1MB) or binary extensions
          if (_isBinaryOrLarge(entity)) continue;

          try {
            final lines = entity.readAsLinesSync();
            for (var lIdx = 0; lIdx < lines.length; lIdx++) {
              if (results.length >= maxMatches) break;
              final line = lines[lIdx];
              final isLineMatch = regex != null
                  ? regex.hasMatch(line)
                  : line.toLowerCase().contains(pattern.toLowerCase());
              if (isLineMatch) {
                final preview = line.trim();
                final shortPreview = preview.length > 120 ? '${preview.substring(0, 120)}...' : preview;
                results.add('$p:${lIdx + 1}: $shortPreview');
              }
            }
          } catch (_) {
            // Skip unreadable files
          }
        }
      }

      if (results.isEmpty) {
        return HermesToolResult.success('No matches found for pattern "$pattern" in $normPath.');
      }

      final buffer = StringBuffer();
      buffer.writeln('Found ${results.length} matches in $normPath for "$pattern":');
      for (final res in results) {
        buffer.writeln(res);
      }
      return HermesToolResult.success(buffer.toString().trim());
    } catch (e) {
      return HermesToolResult.error('Error during search: $e');
    }
  }

  /// 6. `list_dir`: Lists files and subdirectories with sizes up to `max_depth`.
  Future<HermesToolResult> listDir({
    String? path,
    int maxDepth = 2,
    int maxEntries = 150,
    String? defaultCwd,
  }) async {
    final normPath = normalizePath(path ?? '', defaultCwd: defaultCwd);
    final rootDir = Directory(normPath);

    if (!rootDir.existsSync()) {
      return HermesToolResult.error('Directory not found: $normPath');
    }

    final ignoredDirs = {
      '.git', 'node_modules', 'build', '.dart_tool', 'dist',
      'Pods', '.next', '.cache', '.wrangler', '.gradle'
    };

    final boundedDepth = max(1, min(4, maxDepth));
    final entries = <_DirEntry>[];

    void walk(Directory current, int currentDepth) {
      if (currentDepth > boundedDepth || entries.length >= maxEntries) return;

      try {
        final list = current.listSync(followLinks: false);
        for (final item in list) {
          if (entries.length >= maxEntries) break;
          final basename = item.path.split('/').where((s) => s.isNotEmpty).lastOrNull ?? '';
          if (ignoredDirs.contains(basename)) continue;

          String rel = item.path;
          if (rel.startsWith(normPath)) {
            rel = rel.substring(normPath.length);
            if (rel.startsWith('/')) rel = rel.substring(1);
          }

          if (item is Directory) {
            entries.add(_DirEntry(path: '$rel/', isDir: true, size: 0));
            walk(item, currentDepth + 1);
          } else if (item is File) {
            final size = item.lengthSync();
            entries.add(_DirEntry(path: rel, isDir: false, size: size));
          }
        }
      } catch (_) {
        // Skip unreadable subdirectories
      }
    }

    walk(rootDir, 1);

    // Sort: directories first alphabetically, then files alphabetically
    entries.sort((a, b) {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.path.compareTo(b.path);
    });

    final buffer = StringBuffer();
    buffer.writeln('=== Directory Listing: $normPath (${entries.length} items) ===');
    for (final e in entries) {
      if (e.isDir) {
        buffer.writeln('[DIR]  ${e.path}');
      } else {
        buffer.writeln('[FILE] ${e.path} (${_formatBytes(e.size)})');
      }
    }

    if (entries.length >= maxEntries) {
      buffer.writeln('[... truncated at $maxEntries entries ...]');
    }

    return HermesToolResult.success(buffer.toString().trim());
  }

  // Helpers
  static bool _isBinaryOrLarge(File file) {
    const binaryExts = {
      '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf',
      '.zip', '.tar', '.gz', '.dmg', '.iso', '.exe', '.so', '.dylib',
      '.dll', '.bin', '.wasm', '.woff', '.woff2', '.ttf', '.eot',
    };
    final lower = file.path.toLowerCase();
    if (binaryExts.any((ext) => lower.endsWith(ext))) return true;
    try {
      if (file.lengthSync() > 1024 * 1024) return true;
    } catch (_) {
      return true;
    }
    return false;
  }

  static String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  /// Parses Hermes XML `<tool_call>...</tool_call>` blocks.
  static List<ParsedToolCall> parseHermesXmlToolCalls(String text) {
    final calls = <ParsedToolCall>[];
    final regex = RegExp(r'<tool_call>([\s\S]*?)</tool_call>', caseSensitive: false);
    final matches = regex.allMatches(text);

    for (final match in matches) {
      final rawContent = match.group(1)?.trim();
      if (rawContent == null || rawContent.isEmpty) continue;

      try {
        final decoded = jsonDecode(rawContent);
        if (decoded is Map<String, dynamic>) {
          final name = decoded['name']?.toString() ?? '';
          final args = decoded['arguments'];
          Map<String, dynamic> parsedArgs = {};
          if (args is Map<String, dynamic>) {
            parsedArgs = args;
          } else if (args is String) {
            try {
              parsedArgs = jsonDecode(args) as Map<String, dynamic>;
            } catch (_) {}
          }
          if (name.isNotEmpty) {
            calls.add(ParsedToolCall(
              id: 'hermes_${DateTime.now().millisecondsSinceEpoch}_${calls.length}',
              name: name,
              arguments: parsedArgs,
              rawBlock: match.group(0)!,
            ));
          }
        }
      } catch (_) {
        // Fallback: regex name and arguments extraction
        final nameMatch = RegExp(r'"name"\s*:\s*"([^"]+)"').firstMatch(rawContent);
        if (nameMatch != null) {
          final name = nameMatch.group(1)!;
          calls.add(ParsedToolCall(
            id: 'hermes_${DateTime.now().millisecondsSinceEpoch}_${calls.length}',
            name: name,
            arguments: {},
            rawBlock: match.group(0)!,
          ));
        }
      }
    }

    return calls;
  }

  /// Self-Healing Bash Interceptor:
  /// Detects if the model claimed it cannot read filesystem or asked the user to paste output
  /// while outputting bash commands in code blocks (` ```bash ... ``` `).
  static List<ParsedToolCall> detectBashCommandsToIntercept(String text) {
    final calls = <ParsedToolCall>[];
    final lower = text.toLowerCase();
    final hasDenialOrInstruction =
        lower.contains('gak bisa baca') ||
        lower.contains('tidak bisa baca') ||
        lower.contains("can't read") ||
        lower.contains('cannot read') ||
        lower.contains('no filesystem') ||
        lower.contains('no web access') ||
        lower.contains('paste output') ||
        lower.contains('paste hasil') ||
        lower.contains('bisa run') ||
        lower.contains('run command') ||
        lower.contains('jalankan perintah') ||
        lower.contains('execute the following');

    if (hasDenialOrInstruction) {
      final codeBlockRegex = RegExp(r'```(?:bash|sh)?\r?\n([\s\S]*?)\r?\n```');
      final matches = codeBlockRegex.allMatches(text);
      for (final match in matches) {
        final block = match.group(1)?.trim();
        if (block == null || block.isEmpty) continue;

        final lines = block.split('\n').map((l) => l.trim()).where((l) => l.isNotEmpty && !l.startsWith('#'));
        for (final line in lines) {
          if (line.startsWith('find ') ||
              line.startsWith('ls ') ||
              line.startsWith('ls\t') ||
              line == 'ls' ||
              line.startsWith('cat ') ||
              line.startsWith('head ') ||
              line.startsWith('tail ') ||
              line.startsWith('grep ') ||
              line.startsWith('tree ') ||
              line.startsWith('git ')) {
            calls.add(ParsedToolCall(
              id: 'intercept_${DateTime.now().millisecondsSinceEpoch}_${calls.length}',
              name: 'terminal',
              arguments: {'command': line},
              rawBlock: match.group(0)!,
            ));
          }
        }
      }
    }

    return calls;
  }

  /// Strips raw `<tool_call>...</tool_call>` and `<tool_response>...</tool_response>` tags
  /// (including incomplete/unclosed tags while streaming) from text.
  static String cleanToolBlocksFromText(String text) {
    var cleaned = text;
    cleaned = cleaned.replaceAll(RegExp(r'<tool_call>[\s\S]*?(?:</tool_call>|$)', caseSensitive: false), '');
    cleaned = cleaned.replaceAll(RegExp(r'<tool_response>[\s\S]*?(?:</tool_response>|$)', caseSensitive: false), '');
    return cleaned.trim();
  }
}

class _DirEntry {
  final String path;
  final bool isDir;
  final int size;

  _DirEntry({required this.path, required this.isDir, required this.size});
}
