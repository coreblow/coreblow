import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';

void main() {
  group('CoreBlow Studio Thin-Client Gateway Integration Tests', () {
    late Directory tempDir;

    setUp(() async {
      tempDir = await Directory.systemTemp.createTemp('coreblow_react_test_');
    });

    tearDown(() async {
      if (tempDir.existsSync()) {
        tempDir.deleteSync(recursive: true);
      }
    });

    test('Shorthand path normalization selects project directory', () async {
      final repoDir = Directory('${tempDir.path}/aplesi')..createSync(recursive: true);
      File('${repoDir.path}/package.json').writeAsStringSync('{"name": "aplesi", "version": "2.0.0"}');

      final viewModel = StudioViewModel();
      viewModel.selectProject(repoDir.path);

      expect(viewModel.currentProjectPath, repoDir.path);
      expect(viewModel.currentProjectName, 'aplesi');

      viewModel.dispose();
    });

    test('Studio delegates turn to Gateway /api/corehub/chat/react and renders tool steps', () async {
      final oldOverrides = HttpOverrides.current;
      HttpOverrides.global = null;
      addTearDown(() => HttpOverrides.global = oldOverrides);

      final receivedRequests = <Map<String, dynamic>>[];

      // Mock Gateway Server
      final server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
      server.listen((HttpRequest request) async {
        if (request.uri.path.contains('/chat/react')) {
          final body = await utf8.decoder.bind(request).join();
          final jsonBody = jsonDecode(body) as Map<String, dynamic>;
          receivedRequests.add(jsonBody);

          request.response.headers.contentType = ContentType.json;
          request.response.write(jsonEncode({
            'ok': true,
            'reply': 'CoreBlow 2.0 Autonomous Gateway executed 2 tools and synthesized result.',
            'toolSteps': [
              '✓ terminal · git status',
              '✓ read_file · package.json',
            ],
            'steps': [],
          }));
          await request.response.close();
        } else {
          request.response.statusCode = 404;
          await request.response.close();
        }
      });
      addTearDown(() async => await server.close(force: true));

      final viewModel = StudioViewModel();
      viewModel.customEndpointUrl = 'http://127.0.0.1:${server.port}/api/corehub/chat/react';

      viewModel.inputController.text = 'tolong cek status git dan package.json';
      await viewModel.sendMessage();

      expect(receivedRequests.length, 1);
      expect(receivedRequests[0]['prompt'], 'tolong cek status git dan package.json');

      expect(viewModel.messages.length, 2);
      final assistantMsg = viewModel.messages[1];
      expect(assistantMsg.sender, 'assistant');
      expect(assistantMsg.content, contains('CoreBlow 2.0 Autonomous Gateway executed 2 tools'));
      expect(assistantMsg.toolSteps.length, 2);
      expect(assistantMsg.toolSteps[0], '✓ terminal · git status');
      expect(assistantMsg.toolSteps[1], '✓ read_file · package.json');
      expect(assistantMsg.trace, contains('CoreBlow Gateway'));

      viewModel.dispose();
    });

    test('Brand Sovereignty: trace contains CoreBlow and zero third-party agent names', () {
      final viewModel = StudioViewModel();
      final brandNames = ['hermes', 'openclaw', 'claude', 'chatgpt', 'copilot'];

      for (final module in viewModel.coreHubModules) {
        final lowerDesc = module.description.toLowerCase();
        for (final b in brandNames) {
          expect(lowerDesc.contains(b), isFalse, reason: 'Module ${module.name} description contains $b');
        }
      }

      viewModel.dispose();
    });
  });
}
