import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_studio/features/studio/models/studio_state.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';
import 'package:coreblow_studio/features/studio/views/canvas_view.dart';
import 'package:coreblow_studio/features/studio/views/settings_view.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('StudioViewModel State Persistence', () {
    late Directory tempDir;
    late File stateFile;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('coreblow_studio_test_');
      stateFile = File('${tempDir.path}/studio-state.json');
    });

    tearDown(() async {
      if (await tempDir.exists()) {
        await tempDir.delete(recursive: true);
      }
    });

    test('Isolated mode (enablePersistence: false) does not touch disk', () async {
      final vm = StudioViewModel(
        enablePersistence: false,
        stateFilePath: stateFile.path,
      );

      vm.setLanguage('ID');
      vm.setSelectedModel('Reasoning');
      await vm.savePersistedState();

      expect(await stateFile.exists(), isFalse);
      vm.dispose();
    });

    test('Saves and restores settings, projects, credentials, cron tasks, and chat history', () async {
      final vm1 = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );

      // 1. Configure settings
      vm1.setLanguage('ID');
      vm1.setSelectedModel('Reasoning');
      vm1.setExecutionProfile('Terminal only');
      vm1.selectProject('coreblow-core', branch: 'feat/parity-tests');
      vm1.setCronTaskEnabled('daily_health', false);
      vm1.setCronTaskEnabled('log_pruning', true);
      vm1.remoteNodeHost = '100.112.44.88:18789';
      vm1.remoteNodeAuthToken = 'secret-token-xyz';
      vm1.remoteNodeAutoFallback = false;

      await vm1.saveSettings(
        anthropic: 'sk-ant-test-123',
        openAi: 'sk-proj-test-456',
        gemini: 'AIzaSyTest789',
        groq: 'gsk-test-groq',
        ollamaUrl: 'http://192.168.1.100:11434',
        customUrl: 'http://127.0.0.1:20128/v1',
        customKey: 'sk-custom-abc',
      );

      // 2. Add chat threads & messages
      final thread1 = StudioThread(
        id: 'thread-001',
        title: 'Refactor microkernel IPC',
        createdAt: DateTime(2026, 11, 8, 14, 30),
        messages: [
          StudioMessage(
            id: 'm1',
            sender: 'user',
            content: 'How do we optimize Darwin domain sockets?',
            timestamp: DateTime(2026, 11, 8, 14, 30),
          ),
          StudioMessage(
            id: 'm2',
            sender: 'assistant',
            content: 'Use zero-copy memory buffers and kqueue event loops.',
            timestamp: DateTime(2026, 11, 8, 14, 31),
            trace: 'Microkernel Gateway · 14ms',
          ),
        ],
      );

      vm1.addThread(thread1);
      vm1.selectThread('thread-001');

      await vm1.savePersistedState();
      vm1.dispose();

      // 3. Verify file exists on disk and is well-formed JSON
      expect(await stateFile.exists(), isTrue);
      final rawContent = await stateFile.readAsString();
      final decoded = jsonDecode(rawContent) as Map<String, dynamic>;

      expect(decoded['version'], 1);
      expect(decoded['language'], 'ID');
      expect(decoded['selectedModel'], 'Reasoning');
      expect(decoded['executionProfile'], 'Terminal only');
      expect(decoded['currentProjectName'], 'coreblow-core');
      expect(decoded['currentBranch'], 'feat/parity-tests');
      expect(decoded['anthropicApiKey'], 'sk-ant-test-123');
      expect(decoded['openAiApiKey'], 'sk-proj-test-456');
      expect(decoded['geminiApiKey'], 'AIzaSyTest789');
      expect(decoded['groqApiKey'], 'gsk-test-groq');
      expect(decoded['localOllamaUrl'], 'http://192.168.1.100:11434');
      expect(decoded['customEndpointUrl'], 'http://127.0.0.1:20128/v1');
      expect(decoded['customApiKey'], 'sk-custom-abc');
      expect(decoded['remoteNodeHost'], '100.112.44.88:18789');
      expect(decoded['remoteNodeAuthToken'], 'secret-token-xyz');
      expect(decoded['remoteNodeAutoFallback'], isFalse);
      expect(decoded['cronTasks']['daily_health'], isFalse);
      expect(decoded['cronTasks']['log_pruning'], isTrue);
      expect(decoded['recentThreads'], isNotEmpty);

      // 4. Restore state in a fresh ViewModel
      final vm2 = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );
      await vm2.loadPersistedState();

      expect(vm2.language, 'ID');
      expect(vm2.selectedModel, 'Reasoning');
      expect(vm2.executionProfile, 'Terminal only');
      expect(vm2.currentProjectName, 'coreblow-core');
      expect(vm2.currentBranch, 'feat/parity-tests');
      expect(vm2.anthropicApiKey, 'sk-ant-test-123');
      expect(vm2.openAiApiKey, 'sk-proj-test-456');
      expect(vm2.geminiApiKey, 'AIzaSyTest789');
      expect(vm2.groqApiKey, 'gsk-test-groq');
      expect(vm2.localOllamaUrl, 'http://192.168.1.100:11434');
      expect(vm2.customEndpointUrl, 'http://127.0.0.1:20128/v1');
      expect(vm2.customApiKey, 'sk-custom-abc');
      expect(vm2.remoteNodeHost, '100.112.44.88:18789');
      expect(vm2.remoteNodeAuthToken, 'secret-token-xyz');
      expect(vm2.remoteNodeAutoFallback, isFalse);
      expect(vm2.isCronTaskEnabled('daily_health'), isFalse);
      expect(vm2.isCronTaskEnabled('log_pruning'), isTrue);
      expect(vm2.recentThreads.length, 1);
      expect(vm2.recentThreads.first.title, 'Refactor microkernel IPC');
      expect(vm2.messages.length, 2);
      expect(vm2.messages.first.content, 'How do we optimize Darwin domain sockets?');
      expect(vm2.messages.last.content, 'Use zero-copy memory buffers and kqueue event loops.');
      expect(vm2.messages.last.trace, 'Microkernel Gateway · 14ms');

      vm2.dispose();
    });

    test('Rapid concurrent state saves do not corrupt disk state', () async {
      final vm = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );

      // Trigger multiple rapid asynchronous mutations concurrently
      await Future.wait([
        Future(() => vm.setLanguage('ID')),
        Future(() => vm.setSelectedModel('Reasoning')),
        Future(() => vm.setExecutionProfile('Terminal only')),
        Future(() => vm.setCronTaskEnabled('daily_health', false)),
        Future(() => vm.setCronTaskEnabled('log_pruning', true)),
        Future(() => vm.remoteNodeHost = '100.99.88.77:18789'),
      ]);

      // Wait a tick for serialized write queue to finish
      await vm.savePersistedState();

      expect(await stateFile.exists(), isTrue);
      final decoded = jsonDecode(await stateFile.readAsString()) as Map<String, dynamic>;
      expect(decoded['language'], 'ID');
      expect(decoded['selectedModel'], 'Reasoning');
      expect(decoded['executionProfile'], 'Terminal only');
      expect(decoded['remoteNodeHost'], '100.99.88.77:18789');
      expect(decoded['cronTasks']['daily_health'], isFalse);
      expect(decoded['cronTasks']['log_pruning'], isTrue);

      vm.dispose();
    });

    test('selectThread and startNewChat persist activeThreadId changes', () async {
      final vm = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );

      final thread = StudioThread(
        id: 'thread-persisted-1',
        title: 'Thread 1',
        createdAt: DateTime.now(),
        messages: [
          StudioMessage(
            id: 'm1',
            sender: 'user',
            content: 'Hello',
            timestamp: DateTime.now(),
          ),
        ],
      );

      vm.addThread(thread);
      vm.selectThread('thread-persisted-1');
      await vm.savePersistedState();

      var decoded = jsonDecode(await stateFile.readAsString()) as Map<String, dynamic>;
      expect(decoded['activeThreadId'], 'thread-persisted-1');

      vm.startNewChat();
      await vm.savePersistedState();

      decoded = jsonDecode(await stateFile.readAsString()) as Map<String, dynamic>;
      expect(decoded['activeThreadId'], isNull);

      vm.dispose();
    });

    test('selectProject with path updates currentProjectPath and projects list', () async {
      final vm = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );

      vm.selectProject('/Users/test/workspace/my-coreblow-module');
      await vm.savePersistedState();

      expect(vm.currentProjectPath, '/Users/test/workspace/my-coreblow-module');
      expect(vm.currentProjectName, 'my-coreblow-module');
      expect(vm.projects.contains('/Users/test/workspace/my-coreblow-module'), isTrue);

      final decoded = jsonDecode(await stateFile.readAsString()) as Map<String, dynamic>;
      expect(decoded['currentProjectPath'], '/Users/test/workspace/my-coreblow-module');
      expect(decoded['currentProjectName'], 'my-coreblow-module');

      vm.dispose();
    });

    test('Gate 5 uses Sovereign Security & Secret Scan (zero competitor strings)', () {
      final vm = StudioViewModel();
      final gate5 = vm.preFlightGates.last;
      expect(gate5.name, 'Sovereign Security & Secret Scan');
      expect(gate5.command, 'pnpm security:audit');
      expect(gate5.description, 'Zero raw API keys or forbidden paths in worktree');
      expect(gate5.name.toLowerCase().contains('open' 'claw'), isFalse);
      vm.dispose();
    });
  });

  group('Fenced Code Blocks & Copy Action (canvas_view.dart)', () {
    testWidgets('Renders fenced code block with Quiet Instrument style and interactive Copy button',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      // Track clipboard writes
      String? clipboardContent;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (MethodCall methodCall) async {
          if (methodCall.method == 'Clipboard.setData') {
            clipboardContent = (methodCall.arguments as Map)['text'] as String?;
            return null;
          } else if (methodCall.method == 'Clipboard.getData') {
            return <String, dynamic>{'text': clipboardContent};
          }
          return null;
        },
      );

      final vm = StudioViewModel();
      const codeSnippet = "void main() {\n  print('Hello from CoreBlow Studio!');\n}";
      const rawMsg = "Here is the implementation:\n```dart\n$codeSnippet\n```\nHope that helps!";

      // Inject assistant message
      vm.addMessage(
        StudioMessage(
          id: 'test-assistant-1',
          sender: 'assistant',
          content: rawMsg,
          timestamp: DateTime.now(),
          trace: 'Microkernel Gateway · 42ms',
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioCanvasView(viewModel: vm),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // 1. Verify prose and code parts are rendered
      expect(find.textContaining('Here is the implementation:'), findsOneWidget);
      expect(find.text('dart'), findsOneWidget);
      expect(find.text(codeSnippet), findsOneWidget);
      expect(find.textContaining('Hope that helps!'), findsOneWidget);

      // 2. Verify code block copy button
      // Find copy button inside code block
      final copyCodeFinder = find.widgetWithText(InkWell, 'Copy').first;
      expect(copyCodeFinder, findsOneWidget);

      await tester.tap(copyCodeFinder);
      await tester.pump();

      // Verify copied to clipboard
      expect(clipboardContent, codeSnippet);
      expect(find.text('Copied ✓'), findsAtLeastNWidgets(1));

      // After 1.5 seconds, it should revert back to 'Copy'
      await tester.pump(const Duration(milliseconds: 1600));
      expect(find.text('Copied ✓'), findsNothing);

      // 3. Test assistant bubble bottom meta row Copy button
      final metaCopyFinder = find.byTooltip('Copy response');
      expect(metaCopyFinder, findsOneWidget);

      await tester.tap(metaCopyFinder);
      await tester.pump();

      expect(clipboardContent, rawMsg);
      expect(find.text('Copied ✓'), findsAtLeastNWidgets(1));

      await tester.pump(const Duration(milliseconds: 1600));
      expect(find.text('Copied ✓'), findsNothing);

      vm.dispose();
    });

    testWidgets('Fenced code blocks handle trailing fence whitespace, CRLF, and consecutive blocks',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final vm = StudioViewModel();
      const rawMsg = "First snippet:\n```dart  \nvoid foo() {}\n```\r\n```json\r\n{\"key\": 1}\r\n```\nAll done.";

      vm.addMessage(
        StudioMessage(
          id: 'test-code-blocks',
          sender: 'assistant',
          content: rawMsg,
          timestamp: DateTime.now(),
        ),
      );

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioCanvasView(viewModel: vm),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('dart'), findsOneWidget);
      expect(find.text('void foo() {}'), findsOneWidget);
      expect(find.text('json'), findsOneWidget);
      expect(find.text('{"key": 1}'), findsOneWidget);
      expect(find.textContaining('First snippet:'), findsOneWidget);
      expect(find.textContaining('All done.'), findsOneWidget);

      vm.dispose();
    });
  });

  group('Settings View: Remote Nodes and Automations & Cron', () {
    testWidgets('Switching to remote_nodes section displays active local node and SSH/Tailscale gateway',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final vm = StudioViewModel();
      vm.openSettings(section: 'remote_nodes');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioSettingsView(viewModel: vm),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify section header and cards
      expect(find.text('Remote Nodes & Mesh Gateways'), findsOneWidget);
      expect(find.text('Active Nodes'), findsOneWidget);
      expect(find.text('MacBook Local Host · 127.0.0.1:18789 · Active'), findsOneWidget);
      expect(find.text('Primary'), findsOneWidget);

      expect(find.text('Remote SSH / Tailscale Gateway'), findsOneWidget);
      expect(find.text('Remote Gateway Host'), findsOneWidget);
      expect(find.text('Gateway Auth Token'), findsOneWidget);
      expect(find.text('Auto-fallback to local daemon'), findsOneWidget);

      // Test editing remote host
      final hostField = find.widgetWithText(TextField, vm.remoteNodeHost);
      expect(hostField, findsOneWidget);
      await tester.enterText(hostField, '100.99.11.22:18789');
      expect(vm.remoteNodeHost, '100.99.11.22:18789');

      vm.dispose();
    });

    testWidgets('Switching to cron section displays scheduled automation tasks and interactive toggles',
        (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1200, 800);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final vm = StudioViewModel();
      vm.openSettings(section: 'cron');

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioSettingsView(viewModel: vm),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Verify section header and task titles
      expect(find.text('Automations & Scheduled Tasks'), findsOneWidget);
      expect(find.text('Scheduled Automation Tasks'), findsOneWidget);
      expect(find.text('Daily Repository Health Check'), findsWidgets);
      expect(find.text('Cory Memory Compaction'), findsOneWidget);
      expect(find.text('Weekly Log Pruning'), findsOneWidget);
      expect(find.text('Autonomous EvoLoop Synthesis'), findsOneWidget);

      // Verify Daemon status card
      expect(find.text('Daemon Cron Runner Status'), findsOneWidget);
      expect(find.text('Cron Daemon Process'), findsOneWidget);
      expect(find.text('Running · Active'), findsOneWidget);

      // Test toggle interaction on Weekly Log Pruning (initially false)
      expect(vm.isCronTaskEnabled('log_pruning'), isFalse);

      final switches = find.byType(Switch);
      expect(switches, findsAtLeastNWidgets(4));

      // Tap Weekly Log Pruning switch (index 2)
      await tester.tap(switches.at(2));
      await tester.pumpAndSettle();

      expect(vm.isCronTaskEnabled('log_pruning'), isTrue);

      vm.dispose();
    });
  });
}
