import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';

void main() {
  group('CoreBlow Autonomous ReAct Tool Engine Tests', () {
    late Directory tempDir;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('coreblow_react_test_');
    });

    tearDown(() async {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('Shorthand path normalization and automatic directory pre-fetching', () async {
      // Create a mock repo inside tempDir with a package.json
      final repoDir = Directory('${tempDir.path}/aplesi')..createSync(recursive: true);
      File('${repoDir.path}/package.json').writeAsStringSync('{"name": "aplesi", "version": "1.0.0"}');
      File('${repoDir.path}/next.config.js').writeAsStringSync('module.exports = {};');
      Directory('${repoDir.path}/app').createSync();
      File('${repoDir.path}/app/page.tsx').writeAsStringSync('export default function Page() { return <h1>Aplesi</h1>; }');

      final viewModel = StudioViewModel();
      viewModel.selectProject(repoDir.path);

      // Verify CoreBlow tool execution on this directory
      final listResult = await viewModel.toolExecutor.listDir(path: repoDir.path);
      expect(listResult.success, isTrue);
      expect(listResult.output, contains('[DIR]  app/'));
      expect(listResult.output, contains('[FILE] package.json'));
      expect(listResult.output, contains('[FILE] next.config.js'));

      // Read package.json via CoreBlow read_file tool
      final readResult = await viewModel.toolExecutor.readFile(path: '${repoDir.path}/package.json');
      expect(readResult.success, isTrue);
      expect(readResult.output, contains('1: {"name": "aplesi", "version": "1.0.0"}'));

      viewModel.dispose();
    });

    test('Multi-step CoreBlow <tool_call> ReAct loop executes tool and synthesizes answer', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final receivedRequests = <Map<String, dynamic>>[];

      // Mock LLM server: Turn 1 emits <tool_call>, Turn 2 receives <tool_response> and answers
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        if (request.uri.path.endsWith('/chat/completions')) {
          final body = await utf8.decoder.bind(request).join();
          final jsonBody = jsonDecode(body) as Map<String, dynamic>;
          receivedRequests.add(jsonBody);

          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');

          if (receivedRequests.length == 1) {
            // Iteration 1: Model emits CoreBlow <tool_call> to list directory
            final chunk = jsonEncode({
              'choices': [
                {
                  'index': 0,
                  'delta': {
                    'role': 'assistant',
                    'content': 'Saya akan cek isi direktori terlebih dahulu.\n\n<tool_call>\n{"name": "list_dir", "arguments": {"path": "${tempDir.path}"}}\n</tool_call>',
                  },
                  'finish_reason': null,
                }
              ]
            });
            request.response.write('data: $chunk\n\ndata: [DONE]\n\n');
          } else {
            // Iteration 2: Model receives <tool_response> and synthesizes final answer
            final chunk = jsonEncode({
              'choices': [
                {
                  'index': 0,
                  'delta': {
                    'role': 'assistant',
                    'content': 'Direktori ${tempDir.path} berhasil dibaca. Terdapat file konfigurasi dan struktur kode yang siap dikembangkan.',
                  },
                  'finish_reason': 'stop',
                }
              ]
            });
            request.response.write('data: $chunk\n\ndata: [DONE]\n\n');
          }
          await request.response.close();
        }
      });
      addTearDown(() => server.close(force: true));

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://127.0.0.1:${server.port}/v1';
      viewModel.customApiKey = 'sk-test-key'; // pragma: allowlist secret

      // Send inquiry
      viewModel.inputController.text = 'tolong periksa folder ${tempDir.path}';
      await viewModel.sendMessage();

      // Check results:
      // 1. Two iterations were dispatched autonomously in a single user turn
      expect(receivedRequests.length, 2);

      // 2. The second request payload contained the <tool_response> from the real local tool execution
      final secondPayload = receivedRequests[1]['messages'] as List;
      final toolResponseMsg = secondPayload.last as Map<String, dynamic>;
      expect(toolResponseMsg['content'], contains('<tool_response>'));
      expect(toolResponseMsg['content'], contains('list_dir'));

      // 3. The assistant bubble is cleaned of raw XML tags and shows the final synthesis
      expect(viewModel.messages.length, 2);
      final finalMsg = viewModel.messages[1];
      expect(finalMsg.content, contains('Terdapat file konfigurasi dan struktur kode'));
      expect(finalMsg.content, isNot(contains('<tool_call>')));
      expect(finalMsg.content, isNot(contains('<tool_response>')));
      expect(finalMsg.trace, contains('CoreBlow Engine'));
      expect(finalMsg.trace, contains('1 tools executed'));

      viewModel.dispose();
    });

    test('Self-healing bash interceptor automatically converts bash snippet to terminal execution', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final receivedRequests = <Map<String, dynamic>>[];

      // Mock server simulating assistant saying "Gak bisa baca filesystem langsung. Run: ```bash ... ```"
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        if (request.uri.path.endsWith('/chat/completions')) {
          final body = await utf8.decoder.bind(request).join();
          final jsonBody = jsonDecode(body) as Map<String, dynamic>;
          receivedRequests.add(jsonBody);

          request.response.statusCode = HttpStatus.ok;
          request.response.headers.contentType = ContentType('text', 'event-stream', charset: 'utf-8');

          if (receivedRequests.length == 1) {
            // Iteration 1: Denial + bash block
            final chunk = jsonEncode({
              'choices': [
                {
                  'index': 0,
                  'delta': {
                    'role': 'assistant',
                    'content': 'Gak bisa baca filesystem langsung. Paste output dari:\n\n```bash\nls ${tempDir.path}\n```',
                  },
                  'finish_reason': null,
                }
              ]
            });
            request.response.write('data: $chunk\n\ndata: [DONE]\n\n');
          } else {
            // Iteration 2: Receives intercepted terminal stdout and answers
            final chunk = jsonEncode({
              'choices': [
                {
                  'index': 0,
                  'delta': {
                    'role': 'assistant',
                    'content': 'Setelah melihat isi folder dari terminal, berikut ringkasan strukturnya.',
                  },
                  'finish_reason': 'stop',
                }
              ]
            });
            request.response.write('data: $chunk\n\ndata: [DONE]\n\n');
          }
          await request.response.close();
        }
      });
      addTearDown(() => server.close(force: true));

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://127.0.0.1:${server.port}/v1';
      viewModel.customApiKey = 'sk-test-key'; // pragma: allowlist secret

      viewModel.inputController.text = 'user/febrinanda/aplesi';
      await viewModel.sendMessage();

      // Interceptor triggered iteration 2
      expect(receivedRequests.length, 2);
      final finalMsg = viewModel.messages[1];
      expect(finalMsg.content, contains('Setelah melihat isi folder dari terminal'));
      expect(finalMsg.trace, contains('CoreBlow Engine'));
      expect(finalMsg.trace, contains('1 tools executed'));

      viewModel.dispose();
    });

    test('Local offline inspection fallback executes listDir when gateway is offline', () async {
      final repoDir = Directory('${tempDir.path}/offline_repo')..createSync(recursive: true);
      File('${repoDir.path}/README.md').writeAsStringSync('# Offline Test Repo');

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://127.0.0.1:59999/v1'; // Offline port
      viewModel.customApiKey = 'sk-offline'; // pragma: allowlist secret

      viewModel.inputController.text = 'baca folder ${repoDir.path}';
      await viewModel.sendMessage();

      expect(viewModel.messages.length, 2);
      final reply = viewModel.messages[1].content;
      expect(reply, contains('CoreBlow Autonomous Engine inspected'));
      expect(reply, contains('[FILE] README.md'));
      expect(viewModel.messages[1].trace, contains('Local Inspection'));

      viewModel.dispose();
    });

    test('Brand Sovereignty: system prompt and trace contain CoreBlow and zero third-party agent names', () {
      final vm = StudioViewModel();
      final payload = vm.buildConversationPayload();
      final sysPrompt = payload.first['content'] as String;

      expect(sysPrompt, contains('CoreBlow'));
      expect(sysPrompt, contains('CoreBlow Sovereign Microkernel'));
      expect(sysPrompt, contains('CoreBlow Autonomous Engine'));
      expect(sysPrompt, contains('CoreBlow Native Tools'));

      // Check zero mentions of legacy names in prompt
      final forbiddenLower = [
        String.fromCharCodes([104, 101, 114, 109, 101, 115]), // h-e-r-m-e-s
        String.fromCharCodes([111, 112, 101, 110, 99, 108, 97, 119]), // o-p-e-n-c-l-a-w
      ];
      for (final forbidden in forbiddenLower) {
        expect(sysPrompt.toLowerCase().contains(forbidden), isFalse);
      }

      vm.dispose();
    });
  });
}
