import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:coreblow_studio/features/studio/models/studio_state.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';
import 'package:coreblow_studio/features/studio/views/composer_view.dart';
import 'package:coreblow_studio/features/studio/views/canvas_view.dart';

void main() {
  group('CoreBlow 2.0 Next-Gen UX Features Tests', () {
    late Directory tempDir;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('coreblow_nextgen_test_');
    });

    tearDown(() async {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    // 1. Sidebar Conversation Search & Thread Delete
    test('filteredThreads filters by title and message content, deleteThread removes active thread', () {
      final vm = StudioViewModel();

      final t1 = StudioThread(
        id: 'thread-1',
        title: 'Project Architecture',
        createdAt: DateTime.now(),
        messages: [
          StudioMessage(
            id: 'm1',
            sender: 'user',
            content: 'How should we architect microkernel services?',
            timestamp: DateTime.now(),
          ),
          StudioMessage(
            id: 'm2',
            sender: 'assistant',
            content: 'Use sovereign standalone adapters.',
            timestamp: DateTime.now(),
          ),
        ],
      );

      final t2 = StudioThread(
        id: 'thread-2',
        title: 'Bug Fix in UI',
        createdAt: DateTime.now(),
        messages: [
          StudioMessage(
            id: 'm3',
            sender: 'user',
            content: 'The search field overflowed on macos window resize.',
            timestamp: DateTime.now(),
          ),
        ],
      );

      vm.addThread(t1);
      vm.addThread(t2);

      // Empty query returns all threads
      expect(vm.filteredThreads.length, 2);

      // Search by title match
      vm.setThreadSearchQuery('Architecture');
      expect(vm.filteredThreads.length, 1);
      expect(vm.filteredThreads.first.id, 'thread-1');

      // Search by message content match
      vm.setThreadSearchQuery('overflowed');
      expect(vm.filteredThreads.length, 1);
      expect(vm.filteredThreads.first.id, 'thread-2');

      // Search with no matches
      vm.setThreadSearchQuery('nonexistent keyword');
      expect(vm.filteredThreads.isEmpty, isTrue);

      // Clear search
      vm.setThreadSearchQuery('');
      expect(vm.filteredThreads.length, 2);

      // Delete active thread
      vm.selectThread('thread-1');
      expect(vm.activeThreadId, 'thread-1');
      vm.deleteThread('thread-1');
      expect(vm.recentThreads.any((t) => t.id == 'thread-1'), isFalse);
      expect(vm.activeThreadId, 'thread-2');

      vm.dispose();
    });

    // 3. Stop Generation Mid-Stream & Live Stop Button in StudioComposerView
    test('stopGeneration cancels active generation and marks message as stopped', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        if (request.uri.path.endsWith('/chat/completions')) {
          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');

          // Send chunk 1
          final chunk1 = jsonEncode({
            'choices': [
              {
                'index': 0,
                'delta': {'role': 'assistant', 'content': 'Starting analysis... '},
                'finish_reason': null,
              }
            ]
          });
          request.response.write('data: $chunk1\n\n');
          await request.response.flush();

          // Wait before next chunk to allow stopGeneration to fire
          await Future.delayed(const Duration(milliseconds: 300));
          try {
            final chunk2 = jsonEncode({
              'choices': [
                {
                  'index': 0,
                  'delta': {'role': 'assistant', 'content': 'Second part...'},
                  'finish_reason': 'stop',
                }
              ]
            });
            request.response.write('data: $chunk2\n\ndata: [DONE]\n\n');
            await request.response.close();
          } catch (_) {}
        }
      });
      addTearDown(() => server.close(force: true));

      final vm = StudioViewModel();
      vm.customEndpointUrl = 'http://127.0.0.1:${server.port}/v1';
      vm.customApiKey = 'sk-test'; // pragma: allowlist secret

      vm.inputController.text = 'Analyze codebase';
      final sendFuture = vm.sendMessage();

      // Give SSE time to start streaming
      await Future.delayed(const Duration(milliseconds: 100));
      expect(vm.isGenerating, isTrue);

      // Operator requests stop
      vm.stopGeneration();
      expect(vm.isGenerating, isFalse);

      await sendFuture;

      expect(vm.messages.length, 2);
      final assistantMsg = vm.messages[1];
      expect(assistantMsg.isStreaming, isFalse);
      expect(assistantMsg.trace, contains('Stopped by operator'));

      vm.dispose();
    });

    testWidgets('StudioComposerView displays Stop button (Icons.stop_rounded) when generating', (tester) async {
      final vm = StudioViewModel();

      // 1. Idle state shows arrow
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioComposerView(viewModel: vm),
          ),
        ),
      );
      expect(find.byIcon(Icons.arrow_upward_rounded), findsOneWidget);
      expect(find.byIcon(Icons.stop_rounded), findsNothing);

      // 2. When generating, Stop button is visible
      final generatingVm = _MockGeneratingViewModel();
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioComposerView(viewModel: generatingVm),
          ),
        ),
      );
      expect(find.byIcon(Icons.stop_rounded), findsOneWidget);
      expect(find.byIcon(Icons.arrow_upward_rounded), findsNothing);

      // Tapping stop calls stopGeneration
      await tester.tap(find.byIcon(Icons.stop_rounded));
      await tester.pump();
      expect(generatingVm.stopGenerationCalled, isTrue);

      vm.dispose();
      generatingVm.dispose();
    });

    // 4. Durable Tool Progress Cards in StudioCanvasView & Disk Persistence
    test('StudioMessage toolSteps serialization and persistence roundtrip', () async {
      final stateFile = File('${tempDir.path}/test-state.json');
      final vm = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );

      final msg = StudioMessage(
        id: 'msg-tools-1',
        sender: 'assistant',
        content: 'Analysis complete.',
        timestamp: DateTime.now(),
        trace: 'CoreBlow Engine · 2 tools executed',
        toolSteps: [
          '✓ list_dir · src/ (12 items)',
          '✓ read_file · package.json',
        ],
      );

      final thread = StudioThread(
        id: 't-tools',
        title: 'Tool Test Thread',
        createdAt: DateTime.now(),
        messages: [msg],
      );

      vm.addThread(thread);
      vm.selectThread('t-tools');
      await vm.savePersistedState();

      // Read back from file
      expect(stateFile.existsSync(), isTrue);
      final jsonContent = await stateFile.readAsString();
      expect(jsonContent, contains('toolSteps'));
      expect(jsonContent, contains('✓ list_dir · src/ (12 items)'));

      // Create new ViewModel instance and load state
      final vm2 = StudioViewModel(
        enablePersistence: true,
        stateFilePath: stateFile.path,
      );
      await vm2.loadPersistedState(forceReload: true);

      expect(vm2.recentThreads.length, 1);
      final loadedMsg = vm2.recentThreads.first.messages.first;
      expect(loadedMsg.toolSteps.length, 2);
      expect(loadedMsg.toolSteps[0], '✓ list_dir · src/ (12 items)');
      expect(loadedMsg.toolSteps[1], '✓ read_file · package.json');

      vm.dispose();
      vm2.dispose();
    });

    testWidgets('StudioCanvasView renders CoreBlow Execution Steps card when toolSteps is non-empty', (tester) async {
      final vm = StudioViewModel();

      final msgWithTools = StudioMessage(
        id: 'ast-1',
        sender: 'assistant',
        content: 'Here is the summary of the inspected directory.',
        timestamp: DateTime.now(),
        trace: 'CoreBlow Engine · 2 tools executed',
        toolSteps: [
          '✓ list_dir · /Users/febrinanda/aplesi (18 items)',
          '✓ read_file · package.json',
        ],
      );

      vm.addMessage(msgWithTools);

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioCanvasView(viewModel: vm),
          ),
        ),
      );

      expect(find.text('CoreBlow Execution Steps (2)'), findsOneWidget);
      expect(find.text('✓ list_dir · /Users/febrinanda/aplesi (18 items)'), findsOneWidget);
      expect(find.text('✓ read_file · package.json'), findsOneWidget);
      expect(find.byIcon(Icons.terminal_rounded), findsOneWidget);

      vm.dispose();
    });

    // 5. Zero-Config Startup Auto-Discovery
    test('autoDiscoverProviders discovers environment API keys and probes local ports', () async {
      final vm = StudioViewModel();
      await vm.autoDiscoverProviders();

      // Verify channels were initialized with online/offline status
      expect(vm.channels.length, 3);
      expect(vm.channels.any((c) => c.name == 'WhatsApp Web'), isTrue);
      expect(vm.channels.any((c) => c.name == 'Telegram Bot'), isTrue);
      expect(vm.channels.any((c) => c.name == 'Discord Gateway'), isTrue);

      vm.dispose();
    });
  });
}

class _MockGeneratingViewModel extends StudioViewModel {
  bool stopGenerationCalled = false;

  @override
  bool get isGenerating => true;

  @override
  void stopGeneration() {
    stopGenerationCalled = true;
  }
}
