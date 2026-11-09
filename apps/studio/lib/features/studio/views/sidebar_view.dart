import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/aperture_emblem.dart';
import '../../../core/widgets/coreblow_icons.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';

class StudioSidebarView extends StatefulWidget {
  const StudioSidebarView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  State<StudioSidebarView> createState() => _StudioSidebarViewState();
}

class _StudioSidebarViewState extends State<StudioSidebarView> {
  bool _isNewChatHovered = false;
  bool _isStoreBtnHovered = false;
  late final TextEditingController _searchController;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: widget.viewModel.threadSearchQuery);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 196,
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Sidebar Header
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
            child: Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      // Lambang inti & orbit #D9FBF3 dengan titik inti #2DD4BF
                      const ApertureEmblem(size: 14, showOuterRing: false),
                      const SizedBox(width: 6),
                      // Nama "CoreBlow" #D9FBF3
                      const Flexible(
                        child: Text(
                          'CoreBlow',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: StudioColors.textPrimary, // #D9FBF3
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 5),
                      // Chip “v2.0”: latar #10261F, garis #1A3A33, teks #9CC4BA
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: StudioColors.bgChip, // #10261F
                          borderRadius: BorderRadius.circular(5),
                          border: Border.all(
                            color: StudioColors.borderChip, // #1A3A33
                            width: 0.8,
                          ),
                        ),
                        child: const Text(
                          'v2.0',
                          style: TextStyle(
                            color: StudioColors.textSecondary, // #9CC4BA
                            fontSize: 8.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                Tooltip(
                  message: 'Open folder',
                  child: InkWell(
                    onTap: widget.viewModel.pickProjectFolder,
                    child: const Icon(
                      Icons.create_new_folder_outlined,
                      size: 13,
                      color: StudioColors.textSecondary, // #9CC4BA
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Tombol New chat: latar #0D1F1B, garis #1A3A33, teks #D9FBF3, ikon aksen teal. Saat disorot jadi #12302A
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 2, 10, 8),
            child: MouseRegion(
              onEnter: (_) => setState(() => _isNewChatHovered = true),
              onExit: (_) => setState(() => _isNewChatHovered = false),
              child: InkWell(
                onTap: widget.viewModel.startNewChat,
                borderRadius: BorderRadius.circular(7),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6.5),
                  decoration: BoxDecoration(
                    color: _isNewChatHovered ? StudioColors.bgNewChatHover : StudioColors.bgNewChat, // #0D1F1B -> #12302A
                    borderRadius: BorderRadius.circular(7),
                    border: Border.all(
                      color: StudioColors.borderChip, // #1A3A33
                      width: 0.8,
                    ),
                  ),
                  child: Row(
                    children: [
                      const CoreBlowIcon.sparkle(
                        size: 13,
                        color: StudioColors.textPrimary,
                        accentColor: StudioColors.accentTeal,
                      ),
                      const SizedBox(width: 6),
                      const Text(
                        'New chat',
                        style: TextStyle(
                          color: StudioColors.textPrimary, // #D9FBF3
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const Spacer(),
                      const Text(
                        '⌘N',
                        style: TextStyle(
                          color: StudioColors.textMuted, // #7FA99F
                          fontSize: 9.5,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Quiet Instrument Search Field: height 26, #0A1815 bg, 0.8px #16322C border
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
            child: Container(
              height: 26,
              decoration: BoxDecoration(
                color: StudioColors.bgCard, // #0A1815
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: StudioColors.borderCard, // #16322C
                  width: 0.8,
                ),
              ),
              padding: const EdgeInsets.symmetric(horizontal: 7),
              child: Row(
                children: [
                  const Icon(
                    Icons.search_rounded,
                    size: 12,
                    color: StudioColors.textMuted,
                  ),
                  const SizedBox(width: 5),
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      onChanged: (val) {
                        setState(() {});
                        widget.viewModel.setThreadSearchQuery(val);
                      },
                      style: const TextStyle(
                        color: StudioColors.textPrimary,
                        fontSize: 11,
                      ),
                      cursorColor: StudioColors.accentTeal,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Search chats...',
                        hintStyle: TextStyle(
                          color: StudioColors.textMuted,
                          fontSize: 10.5,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                  if (_searchController.text.isNotEmpty)
                    InkWell(
                      onTap: () {
                        setState(() {
                          _searchController.clear();
                        });
                        widget.viewModel.setThreadSearchQuery('');
                      },
                      child: const Icon(
                        Icons.close_rounded,
                        size: 11,
                        color: StudioColors.textMuted,
                      ),
                    ),
                ],
              ),
            ),
          ),

          // Scrollable Sidebar Sections
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              children: [
                // Label seksi: #7FA99F
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
                  child: const Text(
                    'RECENT CHATS',
                    style: TextStyle(
                      color: StudioColors.textMuted, // #7FA99F
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),

                if (widget.viewModel.filteredThreads.isEmpty) ...[
                  if (widget.viewModel.threadSearchQuery.isNotEmpty) ...[
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
                      child: Text(
                        'No chats match "${widget.viewModel.threadSearchQuery}"',
                        style: const TextStyle(
                          color: StudioColors.textMuted,
                          fontSize: 10,
                          fontFamily: 'monospace',
                        ),
                      ),
                    ),
                  ] else ...[
                    // Kartu “Start a new chat”: latar #0A1815, garis #16322C, judul #D9FBF3, isi #8FB5AB
                    Container(
                      padding: const EdgeInsets.all(9),
                      decoration: BoxDecoration(
                        color: StudioColors.bgCard, // #0A1815
                        borderRadius: BorderRadius.circular(7),
                        border: Border.all(
                          color: StudioColors.borderCard, // #16322C
                          width: 0.8,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: const [
                              CoreBlowIcon.sparkle(
                                size: 12,
                                color: StudioColors.textPrimary,
                                accentColor: StudioColors.accentTeal,
                              ),
                              SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  'Start a new chat',
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: StudioColors.textPrimary, // #D9FBF3
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Type anything below to ask questions, summarize notes, or brainstorm.',
                            style: TextStyle(
                              color: StudioColors.textBody, // #8FB5AB
                              fontSize: 10.5,
                              height: 1.3,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ] else ...[
                  ...widget.viewModel.filteredThreads.map((thread) {
                    final isSelected = widget.viewModel.activeThreadId == thread.id;
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 3),
                      child: InkWell(
                        onTap: () => widget.viewModel.selectThread(thread.id),
                        borderRadius: BorderRadius.circular(6),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? StudioColors.bgNavActive : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                            border: isSelected
                                ? Border.all(color: StudioColors.borderNavActive, width: 0.8)
                                : null,
                          ),
                          child: Row(
                            children: [
                              Icon(
                                Icons.chat_bubble_outline_rounded,
                                size: 12,
                                color: isSelected ? StudioColors.accentTeal : StudioColors.textSecondary,
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  thread.title,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: isSelected ? StudioColors.textPrimary : StudioColors.textSecondary,
                                    fontSize: 11,
                                    fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                  ),
                                ),
                              ),
                              Tooltip(
                                message: 'Delete chat',
                                child: InkWell(
                                  onTap: () => widget.viewModel.deleteThread(thread.id),
                                  borderRadius: BorderRadius.circular(4),
                                  child: const Padding(
                                    padding: EdgeInsets.all(2),
                                    child: Icon(
                                      Icons.close_rounded,
                                      size: 11,
                                      color: StudioColors.textMuted,
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    );
                  }),
                ],

                const SizedBox(height: 14),

                // SECTION: PROJECTS (OPTIONAL)
                Padding(
                  padding: const EdgeInsets.fromLTRB(2, 0, 2, 4),
                  child: Row(
                    children: [
                      const Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 12,
                        color: StudioColors.textMuted, // #7FA99F
                      ),
                      const SizedBox(width: 2),
                      const Expanded(
                        child: Text(
                          'PROJECTS (OPTIONAL)',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: StudioColors.textMuted, // #7FA99F
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 0.5,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                      Tooltip(
                        message: 'Add project folder',
                        child: InkWell(
                          onTap: widget.viewModel.pickProjectFolder,
                          borderRadius: BorderRadius.circular(4),
                          child: const Icon(
                            Icons.add,
                            size: 12,
                            color: StudioColors.textSecondary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                // “Open repository folder...”: #9CC4BA
                InkWell(
                  onTap: widget.viewModel.pickProjectFolder,
                  borderRadius: BorderRadius.circular(6),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                    child: Row(
                      children: const [
                        Icon(
                          Icons.folder_open_rounded,
                          size: 13,
                          color: StudioColors.textSecondary, // #9CC4BA
                        ),
                        SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Open repository folder...',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: StudioColors.textSecondary, // #9CC4BA
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Render current projects
                if (widget.viewModel.projects.isNotEmpty) ...[
                  ...widget.viewModel.projects.map((proj) => InkWell(
                        onTap: () => widget.viewModel.selectProject(proj),
                        borderRadius: BorderRadius.circular(4),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                          child: Row(
                            children: [
                              const Icon(Icons.folder_outlined, size: 12, color: StudioColors.accentTeal),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  proj.split('/').last,
                                  overflow: TextOverflow.ellipsis,
                                  style: TextStyle(
                                    color: (widget.viewModel.currentProjectPath == proj ||
                                            widget.viewModel.currentProjectName == proj.split('/').last)
                                        ? StudioColors.accentTeal
                                        : StudioColors.textPrimary,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      )),
                ],
              ],
            ),
          ),

          // Tombol Feature & Plugin Store: latar #0A1815, garis #16322C, panah #7FA99F
          Padding(
            padding: const EdgeInsets.all(8),
            child: MouseRegion(
              onEnter: (_) => setState(() => _isStoreBtnHovered = true),
              onExit: (_) => setState(() => _isStoreBtnHovered = false),
              child: InkWell(
                onTap: () => widget.viewModel.setNavTab(StudioNavTab.coreHub),
                borderRadius: BorderRadius.circular(6),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                  decoration: BoxDecoration(
                    color: _isStoreBtnHovered ? StudioColors.bgNewChatHover : StudioColors.bgCard, // #0A1815
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                      color: StudioColors.borderCard, // #16322C
                      width: 0.8,
                    ),
                  ),
                  child: Row(
                    children: const [
                      CoreBlowIcon.package(
                        size: 13,
                        color: StudioColors.textSecondary,
                        accentColor: StudioColors.accentTeal,
                      ),
                      SizedBox(width: 6),
                      Expanded(
                        child: Text(
                          'Store & Plugins',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: StudioColors.textPrimary, // #D9FBF3
                            fontSize: 10.5,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                      Icon(
                        Icons.arrow_forward_ios_rounded,
                        size: 9.5,
                        color: StudioColors.textMuted, // #7FA99F
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
