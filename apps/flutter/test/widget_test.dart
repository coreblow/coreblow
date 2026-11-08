// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:coreblow_flutter/features/studio/views/corehub_view.dart';
import 'package:coreblow_flutter/main.dart';

void main() {
  testWidgets('CoreBlow Studio Flutter smoke test', (WidgetTester tester) async {
    tester.view.physicalSize = const Size(1024, 638);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(const CoreBlowFlutterApp());

    // Verify heading text is rendered
    expect(find.text('What should we build?'), findsOneWidget);
    expect(find.text('CoreBlow'), findsOneWidget);

    // Switch to CoreHub Store via NavRail package icon tooltip
    final packageFinder = find.byTooltip('CoreHub Store');
    await tester.tap(packageFinder);
    await tester.pumpAndSettle();

    // Verify CoreHub view is now displayed
    expect(find.byType(StudioCoreHubView), findsOneWidget);
    expect(find.text('COREHUB STORE'), findsOneWidget);
    expect(find.text('CoreBlow Studio'), findsOneWidget);
    expect(find.text('Companion Bar'), findsOneWidget);
    expect(find.text('Cory 4-Layer Memory'), findsOneWidget);
    expect(find.text('EvoLoop Synthesizer'), findsOneWidget);
    expect(find.text('MCP Bridge'), findsOneWidget);
    expect(find.text('Discord Bot'), findsOneWidget);
    expect(find.text('Git Supercharged'), findsOneWidget);

    // Toggle Spec Sheet
    final toggleSpecBtn = find.text('Sistem Ikon');
    expect(toggleSpecBtn, findsOneWidget);
    await tester.tap(toggleSpecBtn);
    await tester.pumpAndSettle();

    expect(find.text('Sistem Ikon (Quiet Instrument)'), findsOneWidget);
    expect(find.text('RAIL NAVIGASI'), findsOneWidget);
    expect(find.text('SIDEBAR'), findsOneWidget);
    expect(find.text('MODUL APLIKASI'), findsOneWidget);
  });
}
