import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';

void main() {
  test('Live E2E CoreBlow ReAct against 127.0.0.1:20128 with user/febrinanda/aplesi', () async {
    HttpOverrides.global = null;

    try {
      final socket = await Socket.connect('127.0.0.1', 20128, timeout: const Duration(milliseconds: 500));
      await socket.close();
    } catch (_) {
      // Gateway not available in this environment
      return;
    }

    final viewModel = StudioViewModel();
    viewModel.customEndpointUrl = 'http://127.0.0.1:20128/v1';
    viewModel.customApiKey = 'sk-96b0ddd1aa0881dd-m93qzq-690585f1'; // pragma: allowlist secret

    // User sends prompt inquiring about user/febrinanda/aplesi
    viewModel.inputController.text = 'tolong cek struktur folder user/febrinanda/aplesi';
    await viewModel.sendMessage();

    expect(viewModel.messages.length, 2);
    final reply = viewModel.messages[1].content;

    // Verification:
    // 1. Must never say "Gak bisa baca filesystem langsung" or ask to paste find output
    expect(reply.toLowerCase(), isNot(contains('gak bisa baca filesystem')));
    expect(reply.toLowerCase(), isNot(contains('paste output')));

    // 2. Must contain real files from /Users/febrinanda/aplesi
    final mentionsRealFiles = reply.contains('app') ||
        reply.contains('components') ||
        reply.contains('package.json') ||
        reply.contains('next') ||
        reply.contains('aplesi');
    expect(mentionsRealFiles, isTrue, reason: 'Reply must reference real aplesi files');

    viewModel.dispose();
  }, timeout: const Timeout(Duration(seconds: 45)));

  test('Live E2E CoreBlow Brand Sovereignty inquiry against 127.0.0.1:20128', () async {
    HttpOverrides.global = null;

    try {
      final socket = await Socket.connect('127.0.0.1', 20128, timeout: const Duration(milliseconds: 500));
      await socket.close();
    } catch (_) {
      // Gateway not available in this environment
      return;
    }

    final viewModel = StudioViewModel();
    viewModel.customEndpointUrl = 'http://127.0.0.1:20128/v1';
    viewModel.customApiKey = 'sk-96b0ddd1aa0881dd-m93qzq-690585f1'; // pragma: allowlist secret

    viewModel.inputController.text = 'ini tools apa namanya dan pakai engine apa?';
    await viewModel.sendMessage();

    expect(viewModel.messages.length, 2);
    final reply = viewModel.messages[1].content;

    // Verification:
    // 1. Must identify as CoreBlow Native Tools / CoreBlow Engine
    expect(reply, contains('CoreBlow'));

    // 2. Must never mention legacy agent brands
    final forbiddenLower = [
      String.fromCharCodes([104, 101, 114, 109, 101, 115]),
      String.fromCharCodes([111, 112, 101, 110, 99, 108, 97, 119]),
    ];
    for (final forbidden in forbiddenLower) {
      expect(reply.toLowerCase().contains(forbidden), isFalse, reason: 'Must not contain $forbidden');
    }

    viewModel.dispose();
  }, timeout: const Timeout(Duration(seconds: 45)));
}
