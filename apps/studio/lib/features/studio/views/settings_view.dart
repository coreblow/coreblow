import 'dart:async';
import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';

class StudioSettingsView extends StatefulWidget {
  const StudioSettingsView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  State<StudioSettingsView> createState() => _StudioSettingsViewState();
}

class _StudioSettingsViewState extends State<StudioSettingsView> {
  late TextEditingController _anthropicController;
  late TextEditingController _openAiController;
  late TextEditingController _geminiController;
  late TextEditingController _groqController;
  late TextEditingController _ollamaUrlController;
  late TextEditingController _routerUrlController;
  late TextEditingController _customApiKeyController;
  late TextEditingController _remoteHostController;
  late TextEditingController _remoteTokenController;
  String _searchQuery = '';
  bool _savedFeedback = false;
  Timer? _feedbackTimer;
  final Map<String, ConnectionTestResult> _testResults = {};
  bool _isTestingAll = false;

  @override
  void initState() {
    super.initState();
    _anthropicController = TextEditingController(text: widget.viewModel.anthropicApiKey);
    _openAiController = TextEditingController(text: widget.viewModel.openAiApiKey);
    _geminiController = TextEditingController(text: widget.viewModel.geminiApiKey);
    _groqController = TextEditingController(text: widget.viewModel.groqApiKey);
    _ollamaUrlController = TextEditingController(text: widget.viewModel.localOllamaUrl);
    _routerUrlController = TextEditingController(text: widget.viewModel.customEndpointUrl);
    _customApiKeyController = TextEditingController(text: widget.viewModel.customApiKey);
    _remoteHostController = TextEditingController(text: widget.viewModel.remoteNodeHost);
    _remoteTokenController = TextEditingController(text: widget.viewModel.remoteNodeAuthToken);
  }

  @override
  void dispose() {
    _feedbackTimer?.cancel();
    _anthropicController.dispose();
    _openAiController.dispose();
    _geminiController.dispose();
    _groqController.dispose();
    _ollamaUrlController.dispose();
    _routerUrlController.dispose();
    _customApiKeyController.dispose();
    _remoteHostController.dispose();
    _remoteTokenController.dispose();
    super.dispose();
  }

  void _saveApiKeys() {
    widget.viewModel.saveSettings(
      anthropic: _anthropicController.text,
      openAi: _openAiController.text,
      gemini: _geminiController.text,
      groq: _groqController.text,
      ollamaUrl: _ollamaUrlController.text,
      customUrl: _routerUrlController.text,
      customKey: _customApiKeyController.text,
      remoteHost: _remoteHostController.text,
      remoteToken: _remoteTokenController.text,
    );

    setState(() => _savedFeedback = true);
    _feedbackTimer?.cancel();
    _feedbackTimer = Timer(const Duration(milliseconds: 1400), () {
      if (mounted) setState(() => _savedFeedback = false);
    });
  }

  Future<void> _testSingle(String provider) async {
    setState(() {
      _testResults[provider] = const ConnectionTestResult(
        state: ConnectionTestState.testing,
        message: 'Testing...',
      );
    });

    String? key;
    String? url;

    switch (provider) {
      case 'anthropic':
        key = _anthropicController.text;
        break;
      case 'openai':
        key = _openAiController.text;
        break;
      case 'gemini':
        key = _geminiController.text;
        break;
      case 'groq':
        key = _groqController.text;
        break;
      case 'ollama':
        url = _ollamaUrlController.text;
        break;
      case 'custom_endpoint':
      case 'custom_key':
      case 'custom':
        url = _routerUrlController.text;
        key = _customApiKeyController.text;
        break;
    }

    final result = await widget.viewModel.testConnection(
      provider: provider,
      apiKey: key,
      endpointUrl: url,
    );

    if (mounted) {
      setState(() {
        _testResults[provider] = result;
        if (provider == 'custom' || provider == 'custom_endpoint' || provider == 'custom_key') {
          _testResults['custom_endpoint'] = result;
          _testResults['custom_key'] = result;
          _testResults['custom'] = result;
        }
      });
    }
  }

  Future<void> _testAllConnections() async {
    setState(() => _isTestingAll = true);

    final targets = <String>[];
    if (_anthropicController.text.trim().isNotEmpty) targets.add('anthropic');
    if (_openAiController.text.trim().isNotEmpty) targets.add('openai');
    if (_geminiController.text.trim().isNotEmpty) targets.add('gemini');
    if (_groqController.text.trim().isNotEmpty) targets.add('groq');
    if (_ollamaUrlController.text.trim().isNotEmpty) targets.add('ollama');
    if (_routerUrlController.text.trim().isNotEmpty || _customApiKeyController.text.trim().isNotEmpty) {
      targets.add('custom');
    }

    if (targets.isEmpty) {
      targets.add('custom');
    }

    await Future.wait(targets.map((p) => _testSingle(p)));

    if (mounted) {
      setState(() => _isTestingAll = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: StudioColors.bgCanvas, // #08110F
      child: Row(
        children: [
          // Left Sidebar: 210px #09130F
          _buildSettingsSidebar(),

          // Right Settings Canvas: #08110F
          Expanded(
            child: _buildSettingsContent(),
          ),
        ],
      ),
    );
  }

  // LEFT SIDEBAR (210px)
  Widget _buildSettingsSidebar() {
    return Container(
      width: 210,
      decoration: const BoxDecoration(
        color: StudioColors.bgSidebar, // #09130F
        border: Border(
          right: BorderSide(
            color: StudioColors.borderSidebar, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Settings Header + Close Button
          Padding(
            padding: const EdgeInsets.fromLTRB(14, 12, 10, 8),
            child: Row(
              children: [
                const Text(
                  'Settings',
                  style: TextStyle(
                    color: StudioColors.textPrimary, // #D9FBF3
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const Spacer(),
                Tooltip(
                  message: 'Close Settings (Esc)',
                  child: InkWell(
                    onTap: widget.viewModel.closeSettings,
                    borderRadius: BorderRadius.circular(4),
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      child: const Icon(
                        Icons.close_rounded,
                        size: 15,
                        color: StudioColors.textSecondary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Search Box
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
            child: Container(
              height: 28,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: StudioColors.bgCard, // #0A1815
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: StudioColors.borderCard, width: 0.8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.search_rounded, size: 13, color: StudioColors.textSecondary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: TextField(
                      onChanged: (val) => setState(() => _searchQuery = val.toLowerCase()),
                      style: const TextStyle(color: StudioColors.textPrimary, fontSize: 11),
                      cursorColor: StudioColors.accentTeal,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Search settings...',
                        hintStyle: TextStyle(color: StudioColors.textMuted, fontSize: 11),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Nav Sections
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              children: [
                // CLUSTER 1: PERSONAL
                _sectionHeader('PERSONAL'),
                _navItem(id: 'general', label: 'General & Appearance', icon: Icons.tune_rounded),
                _navItem(id: 'voice', label: 'Voice & Sound', icon: Icons.mic_none_rounded),
                _navItem(id: 'permissions', label: 'Permissions & Safety', icon: Icons.security_rounded),
                _navItem(id: 'storage', label: 'Storage & Sessions', icon: Icons.storage_rounded),

                const SizedBox(height: 10),

                // CLUSTER 2: INTEGRATIONS
                _sectionHeader('INTEGRATIONS'),
                _navItem(
                  id: 'api_keys',
                  label: 'API Keys & Models',
                  icon: Icons.key_rounded,
                  shortcut: '⌘K',
                ),
                _navItem(id: 'channels', label: 'Messaging Channels', icon: Icons.chat_bubble_outline_rounded),
                _navItem(id: 'remote_nodes', label: 'Remote Nodes', icon: Icons.dns_outlined),

                const SizedBox(height: 10),

                // CLUSTER 3: CODING & SYSTEM
                _sectionHeader('CODING & SYSTEM'),
                _navItem(id: 'skills', label: 'Skills & EvoLoop', icon: Icons.auto_awesome_outlined),
                _navItem(id: 'cron', label: 'Automations & Cron', icon: Icons.alarm_rounded),
                _navItem(id: 'about', label: 'About CoreBlow', icon: Icons.info_outline_rounded),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
      child: Text(
        title,
        style: const TextStyle(
          color: StudioColors.textMuted, // #7FA99F
          fontSize: 9.5,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.8,
          fontFamily: 'monospace',
        ),
      ),
    );
  }

  bool _matchesSearch(String label) {
    if (_searchQuery.isEmpty) return true;
    return label.toLowerCase().contains(_searchQuery);
  }

  Widget _navItem({
    required String id,
    required String label,
    required IconData icon,
    String? shortcut,
  }) {
    if (!_matchesSearch(label)) return const SizedBox.shrink();
    final isSelected = widget.viewModel.activeSettingsSection == id;
    return InkWell(
      onTap: () => widget.viewModel.openSettings(section: id),
      borderRadius: BorderRadius.circular(5),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? StudioColors.bgNavActive : Colors.transparent, // #0F2B26
          borderRadius: BorderRadius.circular(5),
          border: isSelected
              ? Border.all(color: StudioColors.borderNavActive, width: 0.8) // #1F5148
              : null,
        ),
        child: Row(
          children: [
            Icon(
              icon,
              size: 13,
              color: isSelected ? StudioColors.textPrimary : StudioColors.textSecondary,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isSelected ? StudioColors.textPrimary : StudioColors.textSecondary,
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (shortcut != null)
              Text(
                shortcut,
                style: const TextStyle(
                  color: StudioColors.textMuted,
                  fontSize: 9.5,
                  fontFamily: 'monospace',
                ),
              ),
          ],
        ),
      ),
    );
  }

  // RIGHT SETTINGS CANVAS
  Widget _buildSettingsContent() {
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        switch (widget.viewModel.activeSettingsSection) {
          'api_keys' => _buildApiKeysSection(),
          'channels' => _buildChannelsSection(),
          'remote_nodes' => _buildRemoteNodesSection(),
          'general' => _buildGeneralSection(),
          'voice' => _buildVoiceSection(),
          'permissions' => _buildPermissionsSection(),
          'storage' => _buildStorageSection(),
          'skills' => _buildSkillsSection(),
          'cron' => _buildCronSection(),
          'about' => _buildAboutSection(),
          _ => _buildGeneralSection(),
        },
      ],
    );
  }

  // 1. GENERAL & APPEARANCE
  Widget _buildGeneralSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('General & Appearance', 'Configure runtime defaults, permissions, and interface preferences.'),
        const SizedBox(height: 16),

        _settingsCard(
          title: 'Interface Preferences',
          children: [
            _toggleRow(
              title: 'Language / Bahasa',
              subtitle: 'Select application locale interface strings',
              trailing: Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  color: StudioColors.bgChip,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: StudioColors.borderChip, width: 0.8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _langBtn('English', widget.viewModel.language == 'EN', () => widget.viewModel.setLanguage('EN')),
                    _langBtn('Indonesia', widget.viewModel.language == 'ID', () => widget.viewModel.setLanguage('ID')),
                  ],
                ),
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Launch at login',
              subtitle: 'Start CoreBlow quietly in the background on system boot',
              trailing: Switch.adaptive(
                value: widget.viewModel.launchAtLogin,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() => widget.viewModel.launchAtLogin = val);
                },
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Default terminal position',
              subtitle: 'Where interactive dev shells appear in Studio workspace',
              trailing: DropdownButton<String>(
                value: widget.viewModel.defaultTerminalLocation,
                dropdownColor: StudioColors.bgCard,
                style: const TextStyle(color: StudioColors.textPrimary, fontSize: 11),
                underline: const SizedBox(),
                items: const [
                  DropdownMenuItem(value: 'Bottom', child: Text('Bottom Drawer')),
                  DropdownMenuItem(value: 'Right', child: Text('Right Inspector')),
                ],
                onChanged: (val) {
                  if (val != null) {
                    setState(() => widget.viewModel.defaultTerminalLocation = val);
                  }
                },
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        _settingsCard(
          title: 'Safety & Automation Permissions',
          children: [
            _toggleRow(
              title: 'Default to Full Access',
              subtitle: 'Allow assistant to execute git and shell commands without manual prompt confirmations',
              trailing: Switch.adaptive(
                value: widget.viewModel.defaultFullAccess,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() => widget.viewModel.defaultFullAccess = val);
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  // 2. API KEYS & MODELS (⌘K)
  Widget _buildApiKeysSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('API Keys & Models', 'Connect AI providers, local LLM servers (Ollama), or custom proxy gateways.'),
        const SizedBox(height: 16),

        _settingsCard(
          title: 'Cloud AI Providers',
          children: [
            _inputRow(
              'Anthropic Claude API Key',
              'sk-ant-api03-...',
              _anthropicController,
              onTest: () => _testSingle('anthropic'),
              status: _testResults['anthropic'],
            ),
            _divider(),
            _inputRow(
              'OpenAI API Key',
              'sk-proj-...',
              _openAiController,
              onTest: () => _testSingle('openai'),
              status: _testResults['openai'],
            ),
            _divider(),
            _inputRow(
              'Google Gemini API Key',
              'AIzaSy...',
              _geminiController,
              onTest: () => _testSingle('gemini'),
              status: _testResults['gemini'],
            ),
            _divider(),
            _inputRow(
              'Groq API Key',
              'gsk_...',
              _groqController,
              onTest: () => _testSingle('groq'),
              status: _testResults['groq'],
            ),
          ],
        ),

        const SizedBox(height: 16),

        _settingsCard(
          title: 'Local & Custom Endpoints',
          children: [
            _inputRow(
              'Local Ollama Base URL',
              'http://127.0.0.1:11434',
              _ollamaUrlController,
              isSecret: false,
              onTest: () => _testSingle('ollama'),
              status: _testResults['ollama'],
            ),
            _divider(),
            _inputRow(
              'Custom Base URL (OpenAI-Compatible)',
              'http://127.0.0.1:20128/v1 or https://...',
              _routerUrlController,
              isSecret: false,
              onTest: () => _testSingle('custom'),
              status: _testResults['custom_endpoint'] ?? _testResults['custom'],
            ),
            _divider(),
            _inputRow(
              'Custom API Key',
              'sk-... (optional for local proxy)',
              _customApiKeyController,
              isSecret: true,
              onTest: () => _testSingle('custom'),
              status: _testResults['custom_key'] ?? _testResults['custom'],
            ),
          ],
        ),

        const SizedBox(height: 16),

        Row(
          children: [
            OutlinedButton(
              onPressed: _isTestingAll ? null : _testAllConnections,
              style: OutlinedButton.styleFrom(
                foregroundColor: StudioColors.textPrimary,
                side: const BorderSide(color: StudioColors.borderCard, width: 0.8),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_isTestingAll)
                    const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: StudioColors.accentTeal),
                    )
                  else
                    const Icon(Icons.wifi_tethering_rounded, size: 14, color: StudioColors.accentTeal),
                  const SizedBox(width: 6),
                  Text(
                    _isTestingAll ? 'Testing...' : 'Test Connection',
                    style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
                  ),
                ],
              ),
            ),
            const Spacer(),
            ElevatedButton(
              onPressed: _saveApiKeys,
              style: ElevatedButton.styleFrom(
                backgroundColor: StudioColors.accentTeal,
                foregroundColor: StudioColors.textDark,
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _savedFeedback ? Icons.check_rounded : Icons.save_rounded,
                    size: 14,
                    color: StudioColors.textDark,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _savedFeedback ? 'Saved & Applied!' : 'Save & Apply',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
            ),
          ],
        ),
      ],
    );
  }

  // 3. MESSAGING CHANNELS
  Widget _buildChannelsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('Messaging Channels', 'Configure bidirectional paired gateway connectors for external chat platforms.'),
        const SizedBox(height: 16),

        _settingsCard(
          title: 'Configured Channels',
          children: widget.viewModel.channels.map((ch) {
            return Column(
              children: [
                _toggleRow(
                  title: ch.name,
                  subtitle: '${ch.protocol} · ${ch.status}',
                  trailing: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: ch.isOnline ? StudioColors.bgNavActive : StudioColors.bgChip,
                      borderRadius: BorderRadius.circular(5),
                      border: Border.all(
                        color: ch.isOnline ? StudioColors.borderNavActive : StudioColors.borderChip,
                        width: 0.8,
                      ),
                    ),
                    child: Text(
                      ch.isOnline ? 'Online' : 'Disconnected',
                      style: TextStyle(
                        color: ch.isOnline ? StudioColors.accentTeal : StudioColors.textMuted,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                if (ch != widget.viewModel.channels.last) _divider(),
              ],
            );
          }).toList(),
        ),
      ],
    );
  }

  // 4. VOICE, PERMISSIONS, STORAGE, SKILLS, ABOUT
  Widget _buildVoiceSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('Voice & Sound', 'Configure wake-words, text-to-speech engine, and audio chime feedback.'),
        const SizedBox(height: 16),
        _settingsCard(
          title: 'Audio Settings',
          children: [
            _toggleRow(
              title: 'Audio notification chimes',
              subtitle: 'Play quiet tonal bell upon long-running task completion',
              trailing: Switch.adaptive(
                value: true,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (_) {},
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPermissionsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('Permissions & Safety', 'Audit sandboxing boundaries and auto-approval policies.'),
        const SizedBox(height: 16),
        _settingsCard(
          title: 'Policy Enforcement',
          children: [
            _toggleRow(
              title: 'Prevent unapproved branch pushes',
              subtitle: 'Enforce local 5-Gate pre-flight verification before pushing to origin',
              trailing: Switch.adaptive(
                value: true,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (_) {},
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildStorageSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('Storage & Sessions', 'Local directory storage, session databases, and cache policies.'),
        const SizedBox(height: 16),
        _settingsCard(
          title: 'Local Paths',
          children: [
            _toggleRow(
              title: 'CoreBlow Home Path',
              subtitle: '~/.coreblow/ (14.2 MB)',
              trailing: const Text('Managed', style: TextStyle(color: StudioColors.textMuted, fontSize: 11)),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildSkillsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('Skills & EvoLoop', 'Autonomous skill synthesis, benchmark evaluation, and MCP bridges.'),
        const SizedBox(height: 16),
        _settingsCard(
          title: 'EvoLoop Engine',
          children: [
            _toggleRow(
              title: 'Auto-learn user workflows',
              subtitle: 'Synthesize repeatable macros when multi-step bash patterns repeat',
              trailing: Switch.adaptive(
                value: true,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (_) {},
              ),
            ),
          ],
        ),
      ],
    );
  }

  // 9. REMOTE NODES & TAILSCALE GATEWAYS
  Widget _buildRemoteNodesSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader(
          'Remote Nodes & Mesh Gateways',
          'Manage local daemon instance and remote headless SSH or Tailscale nodes.',
        ),
        const SizedBox(height: 16),

        _settingsCard(
          title: 'Active Nodes',
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: StudioColors.bgChip,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: StudioColors.borderChip, width: 0.8),
              ),
              child: Row(
                children: [
                  Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xFF28C840),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: const [
                        Text(
                          'MacBook Local Host · 127.0.0.1:18789 · Active',
                          style: TextStyle(
                            color: StudioColors.textPrimary,
                            fontSize: 11.5,
                            fontWeight: FontWeight.w600,
                            fontFamily: 'monospace',
                          ),
                        ),
                        SizedBox(height: 2),
                        Text(
                          'Primary Microkernel Daemon · Darwin arm64 · Latency < 1ms',
                          style: TextStyle(
                            color: StudioColors.textBody,
                            fontSize: 10.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F2B26),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: StudioColors.borderNavActive, width: 0.8),
                    ),
                    child: const Text(
                      'Primary',
                      style: TextStyle(
                        color: StudioColors.accentTeal,
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        _settingsCard(
          title: 'Remote SSH / Tailscale Gateway',
          children: [
            const Text(
              'Route execution and tool evaluations through a remote daemon via Tailscale MagicDNS or SSH tunnel.',
              style: TextStyle(
                color: StudioColors.textBody,
                fontSize: 11,
              ),
            ),
            const SizedBox(height: 12),
            _toggleRow(
              title: 'Remote Gateway Host',
              subtitle: 'Tailscale MagicDNS address or IP:port (e.g. 100.84.12.92:18789)',
              trailing: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 220),
                child: Container(
                  height: 28,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: StudioColors.bgComposer,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: StudioColors.borderComposer, width: 0.8),
                  ),
                  child: TextField(
                    controller: _remoteHostController,
                    style: const TextStyle(
                      color: StudioColors.textPrimary,
                      fontSize: 11,
                      fontFamily: 'monospace',
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.only(bottom: 4),
                    ),
                    onChanged: (val) {
                      widget.viewModel.remoteNodeHost = val;
                    },
                  ),
                ),
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Gateway Auth Token',
              subtitle: 'Pre-shared bearer token for remote daemon authentication',
              trailing: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 220),
                child: Container(
                  height: 28,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  decoration: BoxDecoration(
                    color: StudioColors.bgComposer,
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: StudioColors.borderComposer, width: 0.8),
                  ),
                  child: TextField(
                    controller: _remoteTokenController,
                    obscureText: true,
                    style: const TextStyle(
                      color: StudioColors.textPrimary,
                      fontSize: 11,
                      fontFamily: 'monospace',
                    ),
                    decoration: const InputDecoration(
                      isDense: true,
                      hintText: '••••••••',
                      hintStyle: TextStyle(color: StudioColors.textMuted),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.only(bottom: 4),
                    ),
                    onChanged: (val) {
                      widget.viewModel.remoteNodeAuthToken = val;
                    },
                  ),
                ),
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Auto-fallback to local daemon',
              subtitle: 'Silently fall back to 127.0.0.1:18789 if remote node is unreachable',
              trailing: Switch.adaptive(
                value: widget.viewModel.remoteNodeAutoFallback,
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() {
                    widget.viewModel.remoteNodeAutoFallback = val;
                  });
                },
              ),
            ),
          ],
        ),
      ],
    );
  }

  // 10. AUTOMATIONS & CRON
  Widget _buildCronSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader(
          'Automations & Scheduled Tasks',
          'Configure background daemon jobs, repository maintenance, and memory indexing.',
        ),
        const SizedBox(height: 16),

        _settingsCard(
          title: 'Scheduled Automation Tasks',
          children: [
            _toggleRow(
              title: 'Daily Repository Health Check',
              subtitle: 'Runs oxlint, test suite, and landing gates every midnight (00:00)',
              trailing: Switch.adaptive(
                value: widget.viewModel.isCronTaskEnabled('daily_health'),
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() {
                    widget.viewModel.setCronTaskEnabled('daily_health', val);
                  });
                },
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Cory Memory Compaction',
              subtitle: 'Vacuum SQLite WAL, re-index BM25 embeddings, and prune redundant semantic nodes every 6 hours',
              trailing: Switch.adaptive(
                value: widget.viewModel.isCronTaskEnabled('memory_compaction'),
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() {
                    widget.viewModel.setCronTaskEnabled('memory_compaction', val);
                  });
                },
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Weekly Log Pruning',
              subtitle: 'Archive gateway execution traces older than 14 days every Sunday at 02:00',
              trailing: Switch.adaptive(
                value: widget.viewModel.isCronTaskEnabled('log_pruning'),
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() {
                    widget.viewModel.setCronTaskEnabled('log_pruning', val);
                  });
                },
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Autonomous EvoLoop Synthesis',
              subtitle: 'Synthesize and evaluate new skills from conversation patterns twice weekly',
              trailing: Switch.adaptive(
                value: widget.viewModel.isCronTaskEnabled('evoloop_synthesis'),
                activeTrackColor: StudioColors.accentTeal,
                onChanged: (val) {
                  setState(() {
                    widget.viewModel.setCronTaskEnabled('evoloop_synthesis', val);
                  });
                },
              ),
            ),
          ],
        ),

        const SizedBox(height: 16),

        _settingsCard(
          title: 'Daemon Cron Runner Status',
          children: [
            _toggleRow(
              title: 'Cron Daemon Process',
              subtitle: 'CoreBlow background daemon scheduler (PID: 18790)',
              trailing: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: const Color(0xFF0F2B26),
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: StudioColors.borderNavActive, width: 0.8),
                ),
                child: const Text(
                  'Running · Active',
                  style: TextStyle(
                    color: StudioColors.accentTeal,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
            _divider(),
            _toggleRow(
              title: 'Next Scheduled Trigger',
              subtitle: 'Daily Repository Health Check',
              trailing: const Text(
                '00:00 (in 3h 14m)',
                style: TextStyle(
                  color: StudioColors.textPrimary,
                  fontSize: 11,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAboutSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _contentHeader('About CoreBlow Studio', 'Next-generation AI companion microkernel and developer workspace.'),
        const SizedBox(height: 16),
        _settingsCard(
          title: 'Build Specifications',
          children: [
            _toggleRow(
              title: 'CoreBlow Desktop',
              subtitle: 'v2.0.0-GA · Darwin arm64 / x86_64',
              trailing: const Text('Up to date', style: TextStyle(color: StudioColors.accentTeal, fontSize: 11)),
            ),
            _divider(),
            _toggleRow(
              title: 'Engine Architecture',
              subtitle: 'Native Desktop Engine + Bun TypeScript Microkernel',
              trailing: const Text('Green', style: TextStyle(color: Color(0xFF28C840), fontSize: 11)),
            ),
          ],
        ),
      ],
    );
  }

  // WIDGET HELPERS
  Widget _contentHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: const TextStyle(
            color: StudioColors.textPrimary,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: const TextStyle(
            color: StudioColors.textBody,
            fontSize: 11.5,
          ),
        ),
      ],
    );
  }

  Widget _settingsCard({required String title, required List<Widget> children}) {
    return Container(
      decoration: BoxDecoration(
        color: StudioColors.bgCard, // #0A1815
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: StudioColors.borderCard, width: 0.8), // #16322C
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              color: StudioColors.textPrimary,
              fontSize: 12.5,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 10),
          ...children,
        ],
      ),
    );
  }

  Widget _toggleRow({
    required String title,
    required String subtitle,
    required Widget trailing,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    color: StudioColors.textPrimary,
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: const TextStyle(
                    color: StudioColors.textBody,
                    fontSize: 10.5,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          trailing,
        ],
      ),
    );
  }

  Widget _buildStatusChip(ConnectionTestResult status) {
    final (Color bg, Color fg, IconData icon) = switch (status.state) {
      ConnectionTestState.success => (
        const Color(0x1F28C840),
        const Color(0xFF28C840),
        Icons.check_circle_outline_rounded,
      ),
      ConnectionTestState.failed => (
        const Color(0x1FFF453A),
        const Color(0xFFFF453A),
        Icons.error_outline_rounded,
      ),
      ConnectionTestState.testing => (
        const Color(0x1F2DD4BF),
        StudioColors.accentTeal,
        Icons.sync_rounded,
      ),
      ConnectionTestState.idle => (
        Colors.transparent,
        StudioColors.textMuted,
        Icons.circle_outlined,
      ),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 10, color: fg),
          const SizedBox(width: 4),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 160),
            child: Text(
              status.message,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: fg,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _inputRow(
    String label,
    String placeholder,
    TextEditingController controller, {
    bool isSecret = true,
    VoidCallback? onTest,
    ConnectionTestResult? status,
  }) {
    final isTesting = status?.state == ConnectionTestState.testing;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: StudioColors.textPrimary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              if (status != null && status.state != ConnectionTestState.idle) ...[
                _buildStatusChip(status),
                const SizedBox(width: 6),
              ],
              if (onTest != null)
                InkWell(
                  onTap: isTesting ? null : onTest,
                  borderRadius: BorderRadius.circular(4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: StudioColors.bgCard,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(
                        color: StudioColors.borderCard,
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (isTesting) ...[
                          const SizedBox(
                            width: 8,
                            height: 8,
                            child: CircularProgressIndicator(
                              strokeWidth: 1.2,
                              color: StudioColors.accentTeal,
                            ),
                          ),
                          const SizedBox(width: 4),
                        ],
                        Text(
                          isTesting ? 'Testing' : 'Test',
                          style: const TextStyle(
                            color: StudioColors.textSecondary,
                            fontSize: 10,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: StudioColors.bgComposer, // #0B1916
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: StudioColors.borderComposer, width: 0.8),
            ),
            child: TextField(
              controller: controller,
              obscureText: isSecret,
              style: const TextStyle(color: StudioColors.textPrimary, fontSize: 11.5, fontFamily: 'monospace'),
              cursorColor: StudioColors.accentTeal,
              decoration: InputDecoration(
                isDense: true,
                hintText: placeholder,
                hintStyle: const TextStyle(color: StudioColors.textMuted, fontSize: 11),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.only(bottom: 2),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _langBtn(String label, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        decoration: BoxDecoration(
          color: isSelected ? StudioColors.accentTeal : Colors.transparent,
          borderRadius: BorderRadius.circular(4),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? StudioColors.textDark : StudioColors.textSecondary,
            fontSize: 10.5,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  Widget _divider() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: Divider(color: StudioColors.borderSidebar, height: 0.5, thickness: 0.5),
    );
  }
}
