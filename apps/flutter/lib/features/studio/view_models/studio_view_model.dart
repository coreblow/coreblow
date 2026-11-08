import 'package:flutter/material.dart';
import '../models/studio_state.dart';

class StudioViewModel extends ChangeNotifier {
  StudioViewModel() {
    inputController.addListener(_onTextChanged);
  }

  final TextEditingController inputController = TextEditingController();

  bool _isSidebarVisible = true;
  bool get isSidebarVisible => _isSidebarVisible;

  bool _isInspectorVisible = false;
  bool get isInspectorVisible => _isInspectorVisible;

  bool _isProfileMenuPresented = false;
  bool get isProfileMenuPresented => _isProfileMenuPresented;

  StudioNavTab _activeNavTab = StudioNavTab.home;
  StudioNavTab get activeNavTab => _activeNavTab;

  String _currentProjectName = '';
  String get currentProjectName => _currentProjectName;

  String _currentBranch = '—';
  String get currentBranch => _currentBranch;

  String _executionProfile = 'Full access';
  String get executionProfile => _executionProfile;

  String _selectedModel = 'Coding';
  String get selectedModel => _selectedModel;

  String _language = 'EN';
  String get language => _language;

  final String _userInitials = 'FE';
  String get userInitials => _userInitials;

  final String _userName = 'febrinanda';
  String get userName => _userName;

  final List<StudioMessage> _messages = [];
  List<StudioMessage> get messages => List.unmodifiable(_messages);

  bool get canSendMessage => inputController.text.trim().isNotEmpty;

  void toggleSidebar() {
    _isSidebarVisible = !_isSidebarVisible;
    notifyListeners();
  }

  void toggleInspector() {
    _isInspectorVisible = !_isInspectorVisible;
    notifyListeners();
  }

  void toggleProfileMenu() {
    _isProfileMenuPresented = !_isProfileMenuPresented;
    notifyListeners();
  }

  void closeProfileMenu() {
    if (_isProfileMenuPresented) {
      _isProfileMenuPresented = false;
      notifyListeners();
    }
  }

  void setNavTab(StudioNavTab tab) {
    _activeNavTab = tab;
    notifyListeners();
  }

  void setExecutionProfile(String profile) {
    _executionProfile = profile;
    notifyListeners();
  }

  void setSelectedModel(String model) {
    _selectedModel = model;
    notifyListeners();
  }

  void setLanguage(String lang) {
    _language = lang;
    notifyListeners();
  }

  void selectProject(String name, {String branch = 'main'}) {
    _currentProjectName = name;
    _currentBranch = branch;
    notifyListeners();
  }

  void sendMessage() {
    final text = inputController.text.trim();
    if (text.isEmpty) return;

    _messages.add(
      StudioMessage(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        sender: 'user',
        content: text,
        timestamp: DateTime.now(),
      ),
    );
    inputController.clear();
    notifyListeners();
  }

  void _onTextChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    inputController.removeListener(_onTextChanged);
    inputController.dispose();
    super.dispose();
  }
}
