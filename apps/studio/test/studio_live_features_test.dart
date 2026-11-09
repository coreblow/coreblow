import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_studio/features/studio/models/studio_state.dart';
import 'package:coreblow_studio/features/studio/view_models/studio_view_model.dart';
import 'package:coreblow_studio/features/studio/views/inspector_view.dart';
import 'package:coreblow_studio/main.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Studio Live Features & Parity Tests', () {
    late Directory tempHome;
    late Directory tempProject;

    setUp(() async {
      tempHome = await Directory.systemTemp.createTemp('coreblow_home_test_');
      tempProject = await Directory.systemTemp.createTemp('coreblow_project_test_');
    });

    tearDown(() async {
      if (tempHome.existsSync()) {
        try {
          tempHome.deleteSync(recursive: true);
        } catch (_) {}
      }
      if (tempProject.existsSync()) {
        try {
          tempProject.deleteSync(recursive: true);
        } catch (_) {}
      }
    });

    testWidgets('CoreBlowStudioApp widget builds cleanly with rebranded title and theme', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(const CoreBlowStudioApp());
      expect(find.byType(CoreBlowStudioApp), findsOneWidget);
    });

    test('Live 5-Gate Pre-Flight Execution measures real elapsed time and sets status', () async {
      final viewModel = StudioViewModel();

      // Trigger runPreFlightGates with live default repo directory
      await viewModel.runPreFlightGates();

      expect(viewModel.preFlightGates.length, 5);
      for (final gate in viewModel.preFlightGates) {
        expect(gate.status != PreFlightStatus.running && gate.status != PreFlightStatus.pending, isTrue,
            reason: '${gate.name} did not finish running');
        expect(gate.duration, contains('ms'));
        final ms = int.tryParse(gate.duration.replaceAll('ms', ''));
        expect(ms, isNotNull);
        expect(ms! >= 0, isTrue);
      }

      // Verify custom override for gate failure testing
      viewModel.preFlightGateOverride = (gateIndex, workingDir) async {
        if (gateIndex == 4) return PreFlightStatus.fail;
        return PreFlightStatus.pass;
      };

      await viewModel.runPreFlightGates();
      expect(viewModel.preFlightGates[0].status, PreFlightStatus.pass);
      expect(viewModel.preFlightGates[4].status, PreFlightStatus.fail);

      viewModel.dispose();
    });

    test('Gate 3 fails when build pipeline directories are missing', () async {
      final emptyDir = await Directory.systemTemp.createTemp('coreblow_empty_build_');
      try {
        final pkgJson = File('${emptyDir.path}/package.json');
        pkgJson.writeAsStringSync('{"name": "test-pkg"}');

        final viewModel = StudioViewModel();
        viewModel.selectProject(emptyDir.path, branch: 'main');
        await viewModel.runPreFlightGates();

        // Gate 2 (Build Pipeline) should fail because dist/ and build/ are missing
        expect(viewModel.preFlightGates[2].status, PreFlightStatus.fail);

        viewModel.dispose();
      } finally {
        if (emptyDir.existsSync()) emptyDir.deleteSync(recursive: true);
      }
    });

    test('Gate 5 fails when forbidden competitor string or raw private key is detected', () async {
      final secretDir = await Directory.systemTemp.createTemp('coreblow_secret_test_');
      try {
        // Create mock repository directory with a leaked competitor secret
        final leakedFile = File('${secretDir.path}/config.env');
        leakedFile.writeAsStringSync('API_ROUTE=https://example.com\nLEAK=openai-internal-auth-key\n');

        final viewModel = StudioViewModel();
        viewModel.selectProject(secretDir.path, branch: 'main');
        await viewModel.runPreFlightGates();

        // Gate 4 (Security & Secret Scan) must fail
        expect(viewModel.preFlightGates[4].status, PreFlightStatus.fail);

        viewModel.dispose();
      } finally {
        if (secretDir.existsSync()) secretDir.deleteSync(recursive: true);
      }
    });

    test('Cory 4-Layer Memory Wiki initializes defaults in homeDirPath and indexes disk files', () async {
      final viewModel = StudioViewModel(
        enablePersistence: true,
        homeDirPath: tempHome.path,
      );

      final memoryDir = Directory('${tempHome.path}/.coreblow/memory');
      expect(memoryDir.existsSync(), isTrue);

      // Verify default files were initialized on disk
      expect(File('${memoryDir.path}/USER.md').existsSync(), isTrue);
      expect(File('${memoryDir.path}/MEMORY.md').existsSync(), isTrue);
      expect(File('${memoryDir.path}/CONSTRAINTS.md').existsSync(), isTrue);

      await viewModel.refreshMemoryWiki();

      expect(viewModel.memoryEntries.isNotEmpty, isTrue);
      expect(viewModel.memoryEntriesCount >= 3, isTrue);
      expect(viewModel.memoryWalSize, isNot('0 KB'));
      expect(viewModel.memoryHitRate, '99.1%');

      // Verify entries have valid details
      final userEntry = viewModel.memoryEntries.firstWhere((e) => e.title == 'USER.md');
      expect(userEntry.snippet.isNotEmpty, isTrue);
      expect(userEntry.sizeFormatted, contains('B'));
      expect(userEntry.updated, isNotEmpty);

      viewModel.dispose();
    });

    test('Cory 4-Layer Memory Wiki indexes symlinks and project-level memory files', () async {
      final docFile = File('${tempProject.path}/AGENTS.md');
      docFile.writeAsStringSync('# Project Invariants\n\nPreserve strict multi-device messaging parity.\n');

      final symlink = Link('${tempProject.path}/CLAUDE.md');
      try {
        symlink.createSync('AGENTS.md');
      } catch (_) {}

      final viewModel = StudioViewModel(
        enablePersistence: false,
        homeDirPath: tempHome.path,
      );
      viewModel.selectProject(tempProject.path, branch: 'main');

      await viewModel.refreshMemoryWiki();

      expect(viewModel.memoryEntries.any((e) => e.title == 'AGENTS.md'), isTrue);

      viewModel.dispose();
    });

    test('attachFileToContext preserves full code snippet (> 500 bytes, < 32 KB)', () async {
      final testFile = File('${tempProject.path}/kernel_service.ts');
      // Generate a ~1.5 KB code file
      final buffer = StringBuffer();
      buffer.writeln('// CoreBlow Native Microkernel Service');
      buffer.writeln('export class KernelService {');
      for (int i = 0; i < 30; i++) {
        buffer.writeln('  public handleChannelEvent$i(id: number): string { return `ack-\${id}`; }');
      }
      buffer.writeln('}');
      final fullCode = buffer.toString();
      expect(fullCode.length, greaterThan(1200));
      testFile.writeAsStringSync(fullCode);

      final viewModel = StudioViewModel();
      viewModel.selectProject(tempProject.path, branch: 'main');
      viewModel.pickFileOverride = () async => testFile.path;

      expect(viewModel.inputController.text, isEmpty);

      await viewModel.attachFileToContext();

      // Ensure snippet is not truncated at 500 chars
      expect(viewModel.inputController.text, contains('kernel_service.ts'));
      expect(viewModel.inputController.text, contains('handleChannelEvent29'));
      expect(viewModel.inputController.text, contains('ack-'));
      expect(viewModel.inputController.text, isNot(contains('[truncated]')));

      viewModel.dispose();
    });

    test('restartMicrokernel updates channels, gateway status, and notice', () async {
      final viewModel = StudioViewModel();

      expect(viewModel.isRestartingMicrokernel, isFalse);
      expect(viewModel.microkernelStatusNotice, isNull);

      await viewModel.restartMicrokernel();

      expect(viewModel.isRestartingMicrokernel, isFalse);
      expect(viewModel.microkernelStatusNotice, contains('Microkernel restarted'));
      expect(viewModel.channels.length, 3);
      expect(viewModel.channels[0].name, 'WhatsApp Web');
      expect(viewModel.channels[1].name, 'Telegram Bot');
      expect(viewModel.channels[2].name, 'Discord Gateway');

      // Custom override hook test
      bool overrideCalled = false;
      viewModel.restartMicrokernelOverride = () async {
        overrideCalled = true;
      };

      await viewModel.restartMicrokernel();
      expect(overrideCalled, isTrue);

      viewModel.dispose();
    });

    testWidgets('Memory wiki preview dialog renders on entry tap in StudioInspectorView', (WidgetTester tester) async {
      tester.view.physicalSize = const Size(1440, 900);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);

      final sampleFile = File('${tempHome.path}/test_rules.md');
      sampleFile.writeAsStringSync('# Strict Security Rules\n\n1. Zero raw unencrypted keys.\n');

      final viewModel = StudioViewModel(
        enablePersistence: false,
        homeDirPath: tempHome.path,
      );
      viewModel.setInspectorTab(2); // Memory tab

      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: StudioInspectorView(viewModel: viewModel),
          ),
        ),
      );

      expect(find.text('Cory 4-Layer Memory Kernel'), findsOneWidget);
      expect(find.text('Refresh'), findsOneWidget);

      // Tap refresh
      await tester.tap(find.text('Refresh'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();

      expect(find.text('repo_invariants.md'), findsOneWidget);

      // Tap first memory entry to trigger preview dialog
      await tester.tap(find.text('repo_invariants.md'));
      await tester.pumpAndSettle();

      expect(find.byType(Dialog), findsOneWidget);
      expect(find.text('repo_invariants.md'), findsWidgets);

      // Close dialog
      final dialogCloseButton = find.descendant(
        of: find.byType(Dialog),
        matching: find.byIcon(Icons.close_rounded),
      );
      await tester.tap(dialogCloseButton);
      await tester.pumpAndSettle();

      expect(find.byType(Dialog), findsNothing);
      viewModel.dispose();
    });
  });
}

