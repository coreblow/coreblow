import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_flutter/features/studio/models/studio_state.dart';
import 'package:coreblow_flutter/features/studio/view_models/studio_view_model.dart';
import 'package:coreblow_flutter/features/studio/views/corehub_view.dart';
import 'package:coreblow_flutter/features/studio/views/inspector_view.dart';
import 'package:coreblow_flutter/features/studio/views/settings_view.dart';
import 'package:coreblow_flutter/main.dart';

void main() {
  testWidgets('CoreBlow Studio Flutter comprehensive integration test', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1440, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(const CoreBlowFlutterApp());

    // 1. Initial Empty State Verification
    expect(find.text('What should we build?'), findsOneWidget);
    expect(find.text('CoreBlow'), findsOneWidget);

    // Verify clean topbar & header (no 12 Services, no PR Gates, no Sistem Ikon button)
    expect(find.text('12 Services'), findsNothing);
    expect(find.text('PR Gates'), findsNothing);
    expect(find.text('Sistem Ikon'), findsNothing);

    // 2. Chat Interaction Test
    final inputFinder = find.byType(TextField).first;
    await tester.enterText(inputFinder, 'Refactor git commit verification pipeline');
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pump();

    // Verify user message appears in canvas
    expect(find.text('Refactor git commit verification pipeline'), findsOneWidget);

    // Allow mock assistant reply timer to fire
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pumpAndSettle();

    // Verify assistant reply & trace chip appear
    expect(find.textContaining('CoreBlow Microkernel'), findsOneWidget);

    // 3. Right Inspector Test
    final inspectorToggle = find.byTooltip('Toggle Inspector');
    await tester.tap(inspectorToggle);
    await tester.pumpAndSettle();

    expect(find.byType(StudioInspectorView), findsOneWidget);
    expect(find.text('5-GATE PRE-FLIGHT'), findsOneWidget);
    expect(find.text('Oxlint & Oxfmt'), findsOneWidget);
    expect(find.text('TypeScript Checks'), findsOneWidget);

    // Switch Inspector to War Room tab
    await tester.tap(find.text('War Room'));
    await tester.pumpAndSettle();

    expect(find.text('CoreBlow Gateway Active'), findsOneWidget);
    expect(find.text('WhatsApp Web'), findsOneWidget);
    expect(find.text('Telegram Bot'), findsOneWidget);
    expect(find.text('Discord Gateway'), findsOneWidget);

    // Switch Inspector to Memory tab
    await tester.tap(find.text('Memory'));
    await tester.pumpAndSettle();
    expect(find.text('Cory 4-Layer Memory Kernel'), findsOneWidget);
    expect(find.text('SQLite WAL + BM25 Hybrid Ingestion'), findsOneWidget);

    // 4. CoreHub Store & Reactive Actions Test
    final packageFinder = find.byTooltip('CoreHub Store');
    await tester.tap(packageFinder);
    await tester.pumpAndSettle();

    expect(find.byType(StudioCoreHubView), findsOneWidget);
    expect(find.text('COREHUB STORE'), findsOneWidget);
    expect(find.text('CoreBlow Studio'), findsOneWidget);
    expect(find.text('Cory 4-Layer Memory'), findsOneWidget);

    // Find and tap 'Perbarui' for Cory 4-Layer Memory
    final updateButtonFinder = find.text('Perbarui');
    expect(updateButtonFinder, findsOneWidget);
    await tester.tap(updateButtonFinder);
    await tester.pumpAndSettle();

    // Verify reactive update: status changed and button is now 'Buka' (or 'Open')
    expect(find.text('Installed • v2.0.1'), findsOneWidget);

    // 5. Settings Modal (⌘,) Test
    final avatarFinder = find.byTooltip('Account & Settings');
    await tester.tap(avatarFinder);
    await tester.pumpAndSettle();

    // Click Settings... in profile popover
    await tester.tap(find.text('Settings...'));
    await tester.pumpAndSettle();

    // Verify 2-Column Settings View is open
    expect(find.byType(StudioSettingsView), findsOneWidget);
    expect(find.text('General & Appearance'), findsWidgets);
    expect(find.text('PERSONAL'), findsOneWidget);
    expect(find.text('INTEGRATIONS'), findsOneWidget);

    // Navigate to API Keys & Models
    await tester.tap(find.text('API Keys & Models'));
    await tester.pumpAndSettle();

    expect(find.text('Anthropic Claude API Key'), findsOneWidget);
    expect(find.text('Google Gemini API Key'), findsOneWidget);
    expect(find.text('Local Ollama Base URL'), findsOneWidget);
    expect(find.text('Custom Base URL (OpenAI-Compatible)'), findsOneWidget);
    expect(find.text('Custom API Key'), findsOneWidget);
    expect(find.textContaining('9Router'), findsNothing);

    // Test Connection Button Verification
    final testConnectionButton = find.text('Test Connection');
    expect(testConnectionButton, findsOneWidget);
    await tester.ensureVisible(testConnectionButton);
    await tester.tap(testConnectionButton);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    await tester.pumpAndSettle();

    // Verify Save API Keys
    final saveButton = find.text('Save & Apply');
    await tester.ensureVisible(saveButton);
    await tester.tap(saveButton);
    await tester.pump();
    expect(find.text('Saved & Applied!'), findsOneWidget);
    await tester.pump(const Duration(milliseconds: 1500));

    // Close Settings via close button
    await tester.tap(find.byTooltip('Close Settings (Esc)'));
    await tester.pumpAndSettle();

    expect(find.byType(StudioSettingsView), findsNothing);
  });

  test('StudioViewModel testConnection endpoint checks and overrides', () async {
    final viewModel = StudioViewModel();

    // 1. Anthropic empty key check
    viewModel.anthropicApiKey = '';
    final anthropicRes = await viewModel.testConnection(provider: 'anthropic');
    expect(anthropicRes.isFailed, isTrue);
    expect(anthropicRes.message, 'Key is empty');

    // 2. OpenAI empty key check
    viewModel.openAiApiKey = '';
    final openAiRes = await viewModel.testConnection(provider: 'openai');
    expect(openAiRes.isFailed, isTrue);
    expect(openAiRes.message, 'Key is empty');

    // 3. Override hook test for custom endpoint
    viewModel.testConnectionOverride = ({
      required String provider,
      String? apiKey,
      String? endpointUrl,
    }) async {
      return const ConnectionTestResult(
        state: ConnectionTestState.success,
        message: 'Active · 42ms',
        latencyMs: 42,
      );
    };

    final customRes = await viewModel.testConnection(
      provider: 'custom',
      endpointUrl: 'http://127.0.0.1:18789/v1',
      apiKey: 'sk-test',
    );
    expect(customRes.isSuccess, isTrue);
    expect(customRes.message, 'Active · 42ms');
    expect(customRes.latencyMs, 42);

    viewModel.dispose();
  });
}
