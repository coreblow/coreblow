import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:coreblow_studio/features/studio/services/hermes_tool_executor.dart';

void main() {
  group('HermesToolExecutor Unit Tests', () {
    late Directory tempDir;
    late HermesToolExecutor executor;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('hermes_test_');
      executor = HermesToolExecutor();
    });

    tearDown(() async {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('Path normalization handles user shorthand, tilde, and relative paths', () {
      final home = Platform.environment['HOME'] ?? '';

      expect(
        HermesToolExecutor.normalizePath('user/febrinanda/aplesi'),
        '/Users/febrinanda/aplesi',
      );
      expect(
        HermesToolExecutor.normalizePath('users/febrinanda/aplesi/'),
        '/Users/febrinanda/aplesi',
      );
      expect(
        HermesToolExecutor.normalizePath('~/projects'),
        '$home/projects',
      );
      expect(
        HermesToolExecutor.normalizePath('src/main.dart', defaultCwd: '/Users/test/repo'),
        '/Users/test/repo/src/main.dart',
      );
    });

    test('detectAndNormalizePath finds path in sentences', () {
      expect(
        HermesToolExecutor.detectAndNormalizePath('tolong cek folder user/febrinanda/aplesi sekarang'),
        '/Users/febrinanda/aplesi',
      );
      expect(
        HermesToolExecutor.detectAndNormalizePath('baca file /Users/febrinanda/aplesi/package.json'),
        '/Users/febrinanda/aplesi/package.json',
      );
      expect(
        HermesToolExecutor.detectAndNormalizePath('lihat ~/documents/notes.txt'),
        '${Platform.environment['HOME']}/documents/notes.txt',
      );
    });

    test('terminal tool execution safety rules', () {
      // Catastrophic commands blocked in all profiles
      expect(HermesToolExecutor.isCommandAllowed('rm -rf /', 'Full access'), isFalse);
      expect(HermesToolExecutor.isCommandAllowed('rm -rf /*', 'Full access'), isFalse);
      expect(HermesToolExecutor.isCommandAllowed('mkfs.ext4 /dev/sda1', 'Full access'), isFalse);

      // Read-only profile blocks mutating commands
      expect(HermesToolExecutor.isCommandAllowed('ls -la', 'Read-only'), isTrue);
      expect(HermesToolExecutor.isCommandAllowed('find . -type f', 'Read-only'), isTrue);
      expect(HermesToolExecutor.isCommandAllowed('cat package.json', 'Read-only'), isTrue);
      expect(HermesToolExecutor.isCommandAllowed('rm file.txt', 'Read-only'), isFalse);
      expect(HermesToolExecutor.isCommandAllowed('git push origin main', 'Read-only'), isFalse);
    });

    test('write_file and read_file roundtrip with line numbers', () async {
      final testFilePath = '${tempDir.path}/hello.txt';
      final writeRes = await executor.writeFile(
        path: testFilePath,
        content: 'line one\nline two\nline three',
        executionProfile: 'Full access',
      );
      expect(writeRes.success, isTrue);

      final readRes = await executor.readFile(path: testFilePath, offset: 1, limit: 10);
      expect(readRes.success, isTrue);
      expect(readRes.output, contains('1: line one'));
      expect(readRes.output, contains('2: line two'));
      expect(readRes.output, contains('3: line three'));
    });

    test('write_file is blocked when execution profile is not Full access', () async {
      final testFilePath = '${tempDir.path}/blocked.txt';
      final writeRes = await executor.writeFile(
        path: testFilePath,
        content: 'test',
        executionProfile: 'Read-only',
      );
      expect(writeRes.success, isFalse);
      expect(writeRes.output, contains('requires \'Full access\' profile'));
    });

    test('patch replaces old_text with new_text', () async {
      final testFilePath = '${tempDir.path}/patch_test.dart';
      await executor.writeFile(
        path: testFilePath,
        content: 'const version = "1.0.0";',
        executionProfile: 'Full access',
      );

      final patchRes = await executor.patchFile(
        path: testFilePath,
        oldText: '"1.0.0"',
        newText: '"2.0.0"',
        executionProfile: 'Full access',
      );
      expect(patchRes.success, isTrue);

      final readRes = await executor.readFile(path: testFilePath);
      expect(readRes.output, contains('"2.0.0"'));
    });

    test('list_dir lists directories and files with sizes', () async {
      Directory('${tempDir.path}/src').createSync();
      File('${tempDir.path}/src/app.dart').writeAsStringSync('void main() {}');
      File('${tempDir.path}/package.json').writeAsStringSync('{"name": "test"}');

      final listRes = await executor.listDir(path: tempDir.path, maxDepth: 2);
      expect(listRes.success, isTrue);
      expect(listRes.output, contains('[DIR]  src/'));
      expect(listRes.output, contains('[FILE] package.json'));
      expect(listRes.output, contains('[FILE] src/app.dart'));
    });

    test('search_files finds pattern in filenames and lines', () async {
      File('${tempDir.path}/config.yaml').writeAsStringSync('server:\n  port: 8080');
      File('${tempDir.path}/ignored.txt').writeAsStringSync('hello world');

      final searchRes = await executor.searchFiles(
        path: tempDir.path,
        pattern: 'port: 8080',
      );
      expect(searchRes.success, isTrue);
      expect(searchRes.output, contains('config.yaml:2: port: 8080'));
    });

    test('parseHermesXmlToolCalls parses <tool_call> tags', () {
      const xml = '''
Thinking about directory...
<tool_call>
{"name": "list_dir", "arguments": {"path": "/Users/febrinanda/aplesi"}}
</tool_call>
Done thinking.
''';
      final calls = HermesToolExecutor.parseHermesXmlToolCalls(xml);
      expect(calls.length, 1);
      expect(calls.first.name, 'list_dir');
      expect(calls.first.arguments['path'], '/Users/febrinanda/aplesi');
    });

    test('detectBashCommandsToIntercept intercepts find or ls when model denies filesystem', () {
      const denialText = '''
Gak bisa baca filesystem langsung. Paste output dari:

```bash
find /Users/febrinanda/aplesi -type f | head -100
```

atau

```bash
ls -la /Users/febrinanda/aplesi
```
''';
      final intercepted = HermesToolExecutor.detectBashCommandsToIntercept(denialText);
      expect(intercepted.isNotEmpty, isTrue);
      expect(intercepted.first.name, 'terminal');
      expect(intercepted.first.arguments['command'], contains('find /Users/febrinanda/aplesi'));
    });

    test('cleanToolBlocksFromText removes tool XML from user text', () {
      const raw = '''
Here is the result:
<tool_call>
{"name": "list_dir", "arguments": {}}
</tool_call>
<tool_response>
{"name": "list_dir", "output": "ok"}
</tool_response>
The directory contains 5 files.
''';
      final cleaned = HermesToolExecutor.cleanToolBlocksFromText(raw);
      expect(cleaned, contains('Here is the result:'));
      expect(cleaned, contains('The directory contains 5 files.'));
      expect(cleaned, isNot(contains('<tool_call>')));
      expect(cleaned, isNot(contains('<tool_response>')));
    });
  });
}
