import 'dart:io';
import 'package:flutter/material.dart';
import 'core/theme/colors.dart';
import 'features/studio/models/studio_state.dart';
import 'features/studio/view_models/studio_view_model.dart';
import 'features/studio/views/studio_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const CoreBlowFlutterApp());
}

class CoreBlowFlutterApp extends StatefulWidget {
  const CoreBlowFlutterApp({super.key, this.initialTab = StudioNavTab.home});

  final StudioNavTab initialTab;

  @override
  State<CoreBlowFlutterApp> createState() => _CoreBlowFlutterAppState();
}

class _CoreBlowFlutterAppState extends State<CoreBlowFlutterApp> {
  late final StudioViewModel _viewModel;

  @override
  void initState() {
    super.initState();
    _viewModel = StudioViewModel();
    final runtimeTab = Platform.environment['STUDIO_TAB'] ?? '';
    const envTab = String.fromEnvironment('STUDIO_TAB', defaultValue: 'home');
    if (runtimeTab == 'corehub' || envTab == 'corehub' || widget.initialTab == StudioNavTab.coreHub) {
      _viewModel.setNavTab(StudioNavTab.coreHub);
    }
  }

  @override
  void dispose() {
    _viewModel.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'CoreBlow Studio',
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      darkTheme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: StudioColors.bgWindow,
        fontFamily: '.AppleSystemUIFont',
        colorScheme: const ColorScheme.dark(
          primary: StudioColors.accentMint,
          surface: StudioColors.bgWindow,
        ),
      ),
      home: StudioScreen(viewModel: _viewModel),
    );
  }
}
