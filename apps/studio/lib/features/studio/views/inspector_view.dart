import 'dart:io';
import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';

class StudioInspectorView extends StatelessWidget {
  const StudioInspectorView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 300,
      decoration: const BoxDecoration(
        color: StudioColors.bgSidebar, // #09130F
        border: Border(
          left: BorderSide(
            color: StudioColors.borderNavRail, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Inspector Header with 3 Tabs and Close Button
          _buildHeader(),

          // Active Tab Content
          Expanded(
            child: switch (viewModel.inspectorActiveTabIndex) {
              0 => _buildGitAndGatesTab(),
              1 => _buildWarRoomTab(),
              2 => _buildMemoryWikiTab(context),
              _ => _buildGitAndGatesTab(),
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      height: 38,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: const BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: StudioColors.borderNavRail, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          // 3 Compact Tabs
          Expanded(
            child: Row(
              children: [
                Expanded(child: _tabItem(index: 0, label: 'Git & Gates')),
                const SizedBox(width: 2),
                Expanded(child: _tabItem(index: 1, label: 'War Room')),
                const SizedBox(width: 2),
                Expanded(child: _tabItem(index: 2, label: 'Memory')),
              ],
            ),
          ),
          const SizedBox(width: 6),

          // Close Button
          Tooltip(
            message: 'Close Inspector',
            child: InkWell(
              onTap: viewModel.toggleInspector,
              borderRadius: BorderRadius.circular(4),
              child: Container(
                padding: const EdgeInsets.all(4),
                child: const Icon(
                  Icons.close_rounded,
                  size: 14,
                  color: StudioColors.textSecondary,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _tabItem({required int index, required String label}) {
    final isSelected = viewModel.inspectorActiveTabIndex == index;
    return InkWell(
      onTap: () => viewModel.setInspectorTab(index),
      borderRadius: BorderRadius.circular(5),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: isSelected ? StudioColors.bgNavActive : Colors.transparent, // #0F2B26
          borderRadius: BorderRadius.circular(5),
          border: isSelected
              ? Border.all(color: StudioColors.borderNavActive, width: 0.8) // #1F5148
              : null,
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: isSelected ? StudioColors.textPrimary : StudioColors.textSecondary,
            fontSize: 10.5,
            fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
          ),
        ),
      ),
    );
  }

  // TAB 0: GIT & 5-GATES
  Widget _buildGitAndGatesTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Repository & Branch Info
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: StudioColors.bgCard, // #0A1815
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: StudioColors.borderCard, width: 0.8), // #16322C
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.folder_outlined,
                    size: 13,
                    color: StudioColors.accentTeal,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      viewModel.currentProjectName.isEmpty
                          ? 'No Folder Selected'
                          : viewModel.currentProjectName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: StudioColors.textPrimary,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: StudioColors.bgChip,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: StudioColors.borderChip, width: 0.8),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(Icons.fork_right, size: 10, color: StudioColors.accentTeal),
                        const SizedBox(width: 3),
                        Text(
                          viewModel.currentBranch,
                          style: const TextStyle(
                            color: StudioColors.accentTeal,
                            fontSize: 10,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                viewModel.changedFiles.isEmpty
                    ? 'Working tree clean · 0 uncommitted changes'
                    : '${viewModel.changedFiles.length} modified files in working directory',
                style: const TextStyle(
                  color: StudioColors.textBody,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        // 5-Gates Pre-Flight Section
        Row(
          children: [
            const Text(
              '5-GATE PRE-FLIGHT',
              style: TextStyle(
                color: StudioColors.textMuted,
                fontSize: 9.5,
                fontWeight: FontWeight.bold,
                letterSpacing: 0.8,
                fontFamily: 'monospace',
              ),
            ),
            const Spacer(),
            InkWell(
              onTap: viewModel.runPreFlightGates,
              borderRadius: BorderRadius.circular(4),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: StudioColors.bgChip,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: StudioColors.borderChip, width: 0.8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: const [
                    Icon(Icons.play_arrow_rounded, size: 11, color: StudioColors.accentTeal),
                    SizedBox(width: 3),
                    Text(
                      'Run All',
                      style: TextStyle(
                        color: StudioColors.accentTeal,
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 8),

        // List of 5 Gates
        ...viewModel.preFlightGates.map((gate) => _buildGateItem(gate)),

        const SizedBox(height: 14),

        // Changed Files List
        if (viewModel.changedFiles.isNotEmpty) ...[
          const Text(
            'STAGED & MODIFIED',
            style: TextStyle(
              color: StudioColors.textMuted,
              fontSize: 9.5,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.8,
              fontFamily: 'monospace',
            ),
          ),
          const SizedBox(height: 6),
          ...viewModel.changedFiles.map((file) => Padding(
                padding: const EdgeInsets.symmetric(vertical: 3),
                child: Row(
                  children: [
                    const Icon(Icons.insert_drive_file_outlined,
                        size: 11, color: StudioColors.textSecondary),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        file,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: StudioColors.textPrimary,
                          fontSize: 10.5,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ],
    );
  }

  Widget _buildGateItem(PreFlightGate gate) {
    Color statusColor;
    IconData statusIcon;

    switch (gate.status) {
      case PreFlightStatus.pass:
        statusColor = const Color(0xFF28C840);
        statusIcon = Icons.check_circle_outline_rounded;
      case PreFlightStatus.running:
        statusColor = StudioColors.accentTeal;
        statusIcon = Icons.sync_rounded;
      case PreFlightStatus.fail:
        statusColor = const Color(0xFFFF453A);
        statusIcon = Icons.error_outline_rounded;
      case PreFlightStatus.pending:
        statusColor = StudioColors.textMuted;
        statusIcon = Icons.schedule_rounded;
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        color: StudioColors.bgCard,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: StudioColors.borderCard, width: 0.8),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(statusIcon, size: 14, color: statusColor),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        gate.name,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          color: StudioColors.textPrimary,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    Text(
                      gate.duration,
                      style: const TextStyle(
                        color: StudioColors.textMuted,
                        fontSize: 9.5,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  gate.command,
                  style: const TextStyle(
                    color: StudioColors.accentTeal,
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  gate.description,
                  style: const TextStyle(
                    color: StudioColors.textBody,
                    fontSize: 10,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // TAB 1: WAR ROOM
  Widget _buildWarRoomTab() {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Gateway Status Header Card
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: StudioColors.bgCard,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: StudioColors.borderCard, width: 0.8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 7,
                    height: 7,
                    decoration: const BoxDecoration(
                      color: Color(0xFF28C840),
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text(
                      'CoreBlow Gateway Active',
                      style: TextStyle(
                        color: StudioColors.textPrimary,
                        fontSize: 11.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  const Text(
                    '12ms',
                    style: TextStyle(
                      color: StudioColors.accentTeal,
                      fontSize: 10,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 4),
              const Text(
                'http://127.0.0.1:18789 · Darwin x86_64/arm64',
                style: TextStyle(
                  color: StudioColors.textBody,
                  fontSize: 10,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        const Text(
          'MESSAGING CHANNELS',
          style: TextStyle(
            color: StudioColors.textMuted,
            fontSize: 9.5,
            fontWeight: FontWeight.bold,
            letterSpacing: 0.8,
            fontFamily: 'monospace',
          ),
        ),

        const SizedBox(height: 8),

        // 5 Active Channels
        ...viewModel.channels.map((ch) => Container(
              margin: const EdgeInsets.only(bottom: 6),
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: StudioColors.bgCard,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: StudioColors.borderCard, width: 0.8),
              ),
              child: Row(
                children: [
                  Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: ch.isOnline ? const Color(0xFF28C840) : StudioColors.textMuted,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          ch.name,
                          style: const TextStyle(
                            color: StudioColors.textPrimary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                        Text(
                          ch.status,
                          style: const TextStyle(
                            color: StudioColors.textBody,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (ch.unread > 0)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                      decoration: BoxDecoration(
                        color: StudioColors.accentTeal,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        '${ch.unread}',
                        style: const TextStyle(
                          color: StudioColors.textDark,
                          fontSize: 9,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                ],
              ),
            )),
      ],
    );
  }

  // TAB 2: MEMORY WIKI
  Widget _buildMemoryWikiTab(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(12),
      children: [
        // Kernel Stats Card
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: StudioColors.bgCard,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: StudioColors.borderCard, width: 0.8),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Cory 4-Layer Memory Kernel',
                style: TextStyle(
                  color: StudioColors.textPrimary,
                  fontSize: 11.5,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'SQLite WAL + BM25 Hybrid Ingestion',
                style: TextStyle(
                  color: StudioColors.accentTeal,
                  fontSize: 10,
                  fontFamily: 'monospace',
                ),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _MemoryStat(label: 'Entries', value: '${viewModel.memoryEntriesCount}'),
                  _MemoryStat(label: 'WAL Size', value: viewModel.memoryWalSize),
                  _MemoryStat(label: 'Hit Rate', value: viewModel.memoryHitRate),
                ],
              ),
            ],
          ),
        ),

        const SizedBox(height: 14),

        Row(
          children: [
            const Expanded(
              child: Text(
                'INDEXED CONTEXT & WIKI',
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: StudioColors.textMuted,
                  fontSize: 9.5,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 0.5,
                  fontFamily: 'monospace',
                ),
              ),
            ),
            const SizedBox(width: 6),
            InkWell(
              onTap: viewModel.refreshMemoryWiki,
              borderRadius: BorderRadius.circular(4),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: StudioColors.bgChip,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: StudioColors.borderChip, width: 0.8),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.refresh_rounded,
                      size: 11,
                      color: viewModel.isRefreshingMemory
                          ? StudioColors.textMuted
                          : StudioColors.accentTeal,
                    ),
                    const SizedBox(width: 3),
                    const Text(
                      'Refresh',
                      style: TextStyle(
                        color: StudioColors.accentTeal,
                        fontSize: 9.5,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),

        const SizedBox(height: 8),

        if (viewModel.memoryEntries.isEmpty)
          Container(
            padding: const EdgeInsets.all(12),
            alignment: Alignment.center,
            child: const Text(
              'No memory entries indexed yet',
              style: TextStyle(color: StudioColors.textMuted, fontSize: 11),
            ),
          )
        else
          ...viewModel.memoryEntries.map((entry) => _memoryEntry(context, entry)),
      ],
    );
  }

  Widget _memoryEntry(BuildContext context, MemoryWikiEntry entry) {
    return InkWell(
      onTap: () => _showMemoryPreviewDialog(context, entry),
      borderRadius: BorderRadius.circular(6),
      child: Container(
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: StudioColors.bgCard,
          borderRadius: BorderRadius.circular(6),
          border: Border.all(color: StudioColors.borderCard, width: 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.description_outlined, size: 11, color: StudioColors.accentTeal),
                const SizedBox(width: 5),
                Expanded(
                  child: Text(
                    entry.title,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: StudioColors.textPrimary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  entry.updated,
                  style: const TextStyle(
                    color: StudioColors.textMuted,
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              entry.snippet,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                color: StudioColors.textBody,
                fontSize: 10,
                height: 1.25,
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showMemoryPreviewDialog(BuildContext context, MemoryWikiEntry entry) {
    String fileContents = '';
    final file = File(entry.path);
    if (file.existsSync()) {
      try {
        fileContents = file.readAsStringSync();
      } catch (_) {
        fileContents = '[Binary or Encrypted Content: ${entry.sizeFormatted}]';
      }
    } else {
      fileContents = entry.snippet;
    }

    showDialog(
      context: context,
      builder: (ctx) {
        return Dialog(
          backgroundColor: StudioColors.bgCard,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: const BorderSide(color: StudioColors.borderCard, width: 0.8),
          ),
          child: Container(
            width: 560,
            constraints: const BoxConstraints(maxHeight: 500),
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.description_outlined, size: 14, color: StudioColors.accentTeal),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        entry.title,
                        style: const TextStyle(
                          color: StudioColors.textPrimary,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: StudioColors.bgChip,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Text(
                        '${entry.sizeFormatted} · ${entry.updated}',
                        style: const TextStyle(
                          color: StudioColors.accentTeal,
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, size: 16, color: StudioColors.textMuted),
                      padding: EdgeInsets.zero,
                      constraints: const BoxConstraints(),
                      onPressed: () => Navigator.of(ctx).pop(),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  entry.path,
                  style: const TextStyle(
                    color: StudioColors.textMuted,
                    fontSize: 10,
                    fontFamily: 'monospace',
                  ),
                ),
                const SizedBox(height: 12),
                const Divider(height: 1, color: StudioColors.borderCard),
                const SizedBox(height: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: StudioColors.bgComposer,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: StudioColors.borderChip, width: 0.8),
                    ),
                    child: SingleChildScrollView(
                      child: SelectableText(
                        fileContents,
                        style: const TextStyle(
                          color: StudioColors.textPrimary,
                          fontSize: 11.5,
                          fontFamily: 'monospace',
                          height: 1.4,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _MemoryStat extends StatelessWidget {
  const _MemoryStat({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(color: StudioColors.textMuted, fontSize: 9),
        ),
        Text(
          value,
          style: const TextStyle(
            color: StudioColors.textPrimary,
            fontSize: 11,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }
}
