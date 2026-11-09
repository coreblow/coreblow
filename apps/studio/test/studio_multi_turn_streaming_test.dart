import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';
import 'package:coreblow_studio/features/studio/views/canvas_view.dart';

void main() {
  group('Studio Multi-Turn & Real-Time Streaming Tests', () {
    test('buildConversationPayload creates multi-turn history with rich system context', () {
      final viewModel = StudioViewModel();

      // Initial empty payload only has system prompt
      final emptyPayload = viewModel.buildConversationPayload();
      expect(emptyPayload.length, 1);
      expect(emptyPayload.first['role'], 'system');
      expect(emptyPayload.first['content'], contains('CoreBlow Studio AI Assistant'));
      expect(emptyPayload.first['content'], contains('Active Language: EN'));
      expect(emptyPayload.first['content'], contains('Execution Profile: Full access'));
    });

    test('3-turn conversation sends full multi-turn history and streams tokens via SSE', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final receivedRequests = <Map<String, dynamic>>[];

      // Spin up local mock OpenAI-compatible SSE server
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        if (request.uri.path.endsWith('/chat/completions')) {
          final body = await utf8.decoder.bind(request).join();
          final jsonBody = jsonDecode(body) as Map<String, dynamic>;
          receivedRequests.add(jsonBody);

          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');

          final turnIndex = receivedRequests.length;
          String replyText;
          if (turnIndex == 1) {
            replyText = 'int add(int a, int b) => a + b;';
          } else if (turnIndex == 2) {
            replyText = 'int multiply(int a, int b) => a * b;';
          } else {
            replyText = 'Baris pertama mendefinisikan fungsi perkalian integer.';
          }

          // Stream reply in words
          final words = replyText.split(' ');
          for (int i = 0; i < words.length; i++) {
            final word = i == 0 ? words[i] : ' ${words[i]}';
            final chunk = {
              'id': 'chatcmpl-$turnIndex-$i',
              'object': 'chat.completion.chunk',
              'choices': [
                {
                  'index': 0,
                  'delta': {'content': word},
                  'finish_reason': null,
                }
              ]
            };
            request.response.write('data: ${jsonEncode(chunk)}\n\n');
            await request.response.flush();
            await Future.delayed(const Duration(milliseconds: 10));
          }

          request.response.write('data: [DONE]\n\n');
          await request.response.flush();
          await request.response.close();
        } else {
          request.response.statusCode = HttpStatus.notFound;
          await request.response.close();
        }
      });

      addTearDown(() async {
        await server.close(force: true);
      });

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://${server.address.host}:${server.port}/v1';
      viewModel.customApiKey = 'mock-api-key'; // pragma: allowlist secret

      // --- Turn 1 ---
      viewModel.inputController.text = 'Buat fungsi tambah di Dart';
      await viewModel.sendMessage();

      expect(receivedRequests.length, 1);
      final turn1Payload = receivedRequests[0]['messages'] as List<dynamic>;
      expect(turn1Payload.length, 2); // 1 system + 1 user
      expect(turn1Payload[0]['role'], 'system');
      expect(turn1Payload[0]['content'], contains('CoreBlow Studio AI Assistant'));
      expect(turn1Payload[1]['role'], 'user');
      expect(turn1Payload[1]['content'], 'Buat fungsi tambah di Dart');
      expect(receivedRequests[0]['stream'], isTrue);

      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[1].sender, 'assistant');
      expect(viewModel.messages[1].content, 'int add(int a, int b) => a + b;');
      expect(viewModel.messages[1].isStreaming, isFalse);
      expect(viewModel.messages[1].trace, contains('Custom Gateway · TTFT'));
      expect(viewModel.messages[1].trace, contains('Total'));

      // --- Turn 2 ---
      viewModel.inputController.text = 'Ubah kode yang kamu buat barusan jadi perkalian';
      await viewModel.sendMessage();

      expect(receivedRequests.length, 2);
      final turn2Payload = receivedRequests[1]['messages'] as List<dynamic>;
      expect(turn2Payload.length, 4); // system + user1 + assistant1 + user2
      expect(turn2Payload[0]['role'], 'system');
      expect(turn2Payload[1]['role'], 'user');
      expect(turn2Payload[1]['content'], 'Buat fungsi tambah di Dart');
      expect(turn2Payload[2]['role'], 'assistant');
      expect(turn2Payload[2]['content'], 'int add(int a, int b) => a + b;');
      expect(turn2Payload[3]['role'], 'user');
      expect(turn2Payload[3]['content'], 'Ubah kode yang kamu buat barusan jadi perkalian');

      expect(viewModel.messages.length, 4);
      expect(viewModel.messages[3].content, 'int multiply(int a, int b) => a * b;');

      // --- Turn 3 ---
      viewModel.inputController.text = 'Jelaskan baris pertamanya';
      await viewModel.sendMessage();

      expect(receivedRequests.length, 3);
      final turn3Payload = receivedRequests[2]['messages'] as List<dynamic>;
      expect(turn3Payload.length, 6); // system + user1 + asst1 + user2 + asst2 + user3
      expect(turn3Payload[0]['role'], 'system');
      expect(turn3Payload[1]['role'], 'user');
      expect(turn3Payload[1]['content'], 'Buat fungsi tambah di Dart');
      expect(turn3Payload[2]['role'], 'assistant');
      expect(turn3Payload[2]['content'], 'int add(int a, int b) => a + b;');
      expect(turn3Payload[3]['role'], 'user');
      expect(turn3Payload[3]['content'], 'Ubah kode yang kamu buat barusan jadi perkalian');
      expect(turn3Payload[4]['role'], 'assistant');
      expect(turn3Payload[4]['content'], 'int multiply(int a, int b) => a * b;');
      expect(turn3Payload[5]['role'], 'user');
      expect(turn3Payload[5]['content'], 'Jelaskan baris pertamanya');

      expect(viewModel.messages.length, 6);
      expect(viewModel.messages[5].content, 'Baris pertama mendefinisikan fungsi perkalian integer.');

      // Verify thread sync: active thread messages has all 6 messages, no duplicates, no '...'
      final activeThread = viewModel.recentThreads.firstWhere((t) => t.id == viewModel.activeThreadId);
      expect(activeThread.messages.length, 6);
      for (final msg in activeThread.messages) {
        expect(msg.content, isNot('...'));
        expect(msg.isStreaming, isFalse);
      }

      viewModel.dispose();
    });

    test('Non-SSE JSON response is correctly parsed as fallback', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = ContentType.json;
        final jsonResponse = {
          'id': 'chatcmpl-fallback',
          'choices': [
            {
              'message': {'role': 'assistant', 'content': 'Fallback normal response'}
            }
          ]
        };
        request.response.write(jsonEncode(jsonResponse));
        await request.response.close();
      });

      addTearDown(() async {
        await server.close(force: true);
      });

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://${server.address.host}:${server.port}/v1';
      viewModel.customApiKey = 'mock-api-key'; // pragma: allowlist secret

      viewModel.inputController.text = 'Halo test non-SSE';
      await viewModel.sendMessage();

      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[1].content, 'Fallback normal response');
      expect(viewModel.messages[1].isStreaming, isFalse);
      expect(viewModel.messages[1].trace, contains('Custom Gateway'));

      viewModel.dispose();
    });

    test('Thread switching retains full multi-turn context without duplicates', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        final body = await utf8.decoder.bind(request).join();
        final jsonBody = jsonDecode(body) as Map<String, dynamic>;
        final lastMsg = (jsonBody['messages'] as List<dynamic>).last['content'];

        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');
        request.response.write('data: {"choices":[{"delta":{"content":"Jawaban untuk $lastMsg"}}]}\n\n');
        request.response.write('data: [DONE]\n\n');
        await request.response.close();
      });

      addTearDown(() async {
        await server.close(force: true);
      });

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://${server.address.host}:${server.port}/v1';
      viewModel.customApiKey = 'mock-api-key'; // pragma: allowlist secret

      // Thread A: Turn 1
      viewModel.inputController.text = 'Pesan Thread A';
      await viewModel.sendMessage();
      final threadAId = viewModel.activeThreadId!;

      // Start New Chat (Thread B)
      viewModel.startNewChat();
      expect(viewModel.messages.isEmpty, isTrue);
      expect(viewModel.activeThreadId, isNull);

      // Thread B: Turn 1
      viewModel.inputController.text = 'Pesan Thread B';
      await viewModel.sendMessage();
      final threadBId = viewModel.activeThreadId!;

      expect(threadAId != threadBId, isTrue);
      expect(viewModel.recentThreads.length, 2);

      // Switch back to Thread A
      viewModel.selectThread(threadAId);
      expect(viewModel.activeThreadId, threadAId);
      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[0].content, 'Pesan Thread A');

      // Continue Thread A with Turn 2
      viewModel.inputController.text = 'Lanjutan Thread A';
      await viewModel.sendMessage();

      expect(viewModel.messages.length, 4);
      final threadA = viewModel.recentThreads.firstWhere((t) => t.id == threadAId);
      expect(threadA.messages.length, 4);

      // Switch to Thread B and verify it remains unaffected
      viewModel.selectThread(threadBId);
      expect(viewModel.activeThreadId, threadBId);
      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[0].content, 'Pesan Thread B');

      viewModel.dispose();
    });

    test('Thread switching during active stream updates background thread without losing messages or state', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final allowDoneCompleter = Completer<void>();

      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        await request.drain();
        request.response.statusCode = HttpStatus.ok;
        request.response.bufferOutput = false;
        request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');
        request.response.write('data: {"choices":[{"delta":{"content":"Chunk 1 "}}]}\n\n');
        await request.response.flush();

        await allowDoneCompleter.future;
        request.response.write('data: {"choices":[{"delta":{"content":"Chunk 2"}}]}\n\n');
        request.response.write('data: [DONE]\n\n');
        await request.response.close();
      });

      addTearDown(() async {
        await server.close(force: true);
      });

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://${server.address.host}:${server.port}/v1';
      viewModel.customApiKey = 'mock-api-key'; // pragma: allowlist secret

      final chunkCompleter = Completer<void>();
      void chunkListener() {
        if (viewModel.messages.isNotEmpty && viewModel.messages.last.content.contains('Chunk 1')) {
          if (!chunkCompleter.isCompleted) chunkCompleter.complete();
        }
      }
      viewModel.addListener(chunkListener);

      // Thread A: Start streaming
      viewModel.inputController.text = 'Task on Thread A';
      final sendFuture = viewModel.sendMessage();
      final threadAId = viewModel.activeThreadId!;

      // Wait until Chunk 1 actually arrived and updated the UI
      await chunkCompleter.future;
      viewModel.removeListener(chunkListener);

      expect(viewModel.messages.last.content, contains('Chunk 1'));
      expect(viewModel.messages.last.isStreaming, isTrue);

      // Now user switches to a brand new chat (Thread B) while Thread A is still streaming
      viewModel.startNewChat();
      expect(viewModel.activeThreadId, isNull);
      expect(viewModel.messages.isEmpty, isTrue);

      // Allow Thread A to complete in the background
      allowDoneCompleter.complete();
      await sendFuture;

      // Verify thread A in _recentThreads received the complete message and finalized
      final threadA = viewModel.recentThreads.firstWhere((t) => t.id == threadAId);
      expect(threadA.messages.length, 2);
      expect(threadA.messages[1].content, 'Chunk 1 Chunk 2');
      expect(threadA.messages[1].isStreaming, isFalse);
      expect(threadA.messages[1].trace, contains('Custom Gateway'));

      // Switch back to Thread A and verify all content is present
      viewModel.selectThread(threadAId);
      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[1].content, 'Chunk 1 Chunk 2');
      expect(viewModel.messages[1].isStreaming, isFalse);

      viewModel.dispose();
    });

    test('reasoning_content in SSE chunk is streamed and decoded', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        request.response.statusCode = HttpStatus.ok;
        request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');
        request.response.write('data: {"choices":[{"delta":{"reasoning_content":"Thinking steps..."}}]}\n\n');
        await request.response.flush();
        request.response.write('data: {"choices":[{"delta":{"content":" Final answer."}}]}\n\n');
        request.response.write('data: [DONE]\n\n');
        await request.response.close();
      });

      addTearDown(() async {
        await server.close(force: true);
      });

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://${server.address.host}:${server.port}/v1';
      viewModel.customApiKey = 'mock-api-key'; // pragma: allowlist secret

      viewModel.inputController.text = 'Solve puzzle';
      await viewModel.sendMessage();

      expect(viewModel.messages.length, 2);
      expect(viewModel.messages[1].content, 'Thinking steps... Final answer.');
      expect(viewModel.messages[1].isStreaming, isFalse);
      expect(viewModel.messages[1].trace, contains('TTFT'));

      viewModel.dispose();
    });

    testWidgets('StudioCanvasView auto-scrolls to bottom when messages update or stream', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(800, 600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final viewModel = StudioViewModel();

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioCanvasView(viewModel: viewModel),
          ),
        ),
      );

      expect(find.text('What should we build?'), findsOneWidget);

      final inputFinder = find.byType(TextField).first;
      await tester.enterText(inputFinder, 'Check gate status for repo');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pump();

      expect(find.text('Check gate status for repo'), findsOneWidget);

      // Allow fallback generation timer to tick
      await tester.pump(const Duration(milliseconds: 400));
      await tester.pumpAndSettle();

      expect(find.textContaining('CoreBlow Microkernel'), findsOneWidget);
      expect(find.textContaining('All 5 Pre-Flight Landing Gates are green'), findsOneWidget);

      // Add multiple messages to force ListView overflow and test scroll position
      for (int i = 0; i < 6; i++) {
        viewModel.inputController.text = 'Overflow message $i with plenty of extra descriptive text lines to force layout expansion and scrolling.';
        unawaited(viewModel.sendMessage());
        await tester.pump(const Duration(milliseconds: 350));
        await tester.pumpAndSettle();
      }

      final scrollableFinder = find.byType(Scrollable).first;
      final scrollableState = tester.state<ScrollableState>(scrollableFinder);
      expect(scrollableState.position.maxScrollExtent, greaterThan(0));
      expect(scrollableState.position.pixels, closeTo(scrollableState.position.maxScrollExtent, 2.0));

      viewModel.dispose();
    });
  });
}
