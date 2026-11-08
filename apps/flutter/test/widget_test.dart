// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

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
  });
}
