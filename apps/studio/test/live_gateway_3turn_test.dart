import 'dart:io';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';

void main() {
  test('Live 3-Turn Conversation Test against Local Gateway (port 18789)', () async {
    HttpOverrides.global = null;

    try {
      final socket = await Socket.connect('127.0.0.1', 18789, timeout: const Duration(milliseconds: 500));
      await socket.close();
    } catch (_) {
      // Gateway not active in this test runner environment
      return;
    }

    final viewModel = StudioViewModel();
    viewModel.customEndpointUrl = 'http://127.0.0.1:18789';
    viewModel.customApiKey = 'sk-96b0ddd1aa0881dd-m93qzq-690585f1'; // pragma: allowlist secret

    // Turn 1
    viewModel.inputController.text = 'Buat fungsi tambah di Dart';
    await viewModel.sendMessage();

    expect(viewModel.messages.length, 2);
    expect(viewModel.messages[1].content, isNot('...'));
    expect(viewModel.messages[1].isStreaming, isFalse);
    expect(viewModel.messages[1].trace, contains('TTFT'));

    // Turn 2
    viewModel.inputController.text = 'Ubah kode yang kamu buat barusan jadi perkalian';
    await viewModel.sendMessage();

    expect(viewModel.messages.length, 4);
    expect(viewModel.messages[3].content, isNot('...'));
    expect(viewModel.messages[3].isStreaming, isFalse);

    // Turn 3
    viewModel.inputController.text = 'Jelaskan baris pertamanya';
    await viewModel.sendMessage();

    expect(viewModel.messages.length, 6);
    expect(viewModel.messages[5].content, isNot('...'));
    expect(viewModel.messages[5].isStreaming, isFalse);

    viewModel.dispose();
  }, timeout: const Timeout(Duration(seconds: 45)));
}
