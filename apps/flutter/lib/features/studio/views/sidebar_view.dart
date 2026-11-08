import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/aperture_emblem.dart';
import '../../../core/widgets/coreblow_icons.dart';
import '../view_models/studio_view_model.dart';

class StudioSidebarView extends StatelessWidget {
  const StudioSidebarView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 188,
      color: StudioColors.bgSidebar,
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
                      const ApertureEmblem(size: 14),
                      const SizedBox(width: 5),
                      const Flexible(
                        child: Text(
                          'CoreBlow',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 12.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: StudioColors.accentMint.withValues(alpha: 0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Text(
                          'v2.0',
                          style: TextStyle(
                            color: StudioColors.accentMint,
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
                    onTap: () {},
                    child: Icon(
                      Icons.create_new_folder_outlined,
                      size: 13,
                      color: Colors.white.withValues(alpha: 0.72),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // "New chat" button
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
            child: InkWell(
              onTap: () {},
              borderRadius: BorderRadius.circular(8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                decoration: BoxDecoration(
                  color: StudioColors.bgNewChat,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: StudioColors.accentMint.withValues(alpha: 0.15),
                    width: 0.5,
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.edit_note_rounded,
                      size: 14,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 6),
                    const Text(
                      'New chat',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '⌘N',
                      style: TextStyle(
                        color: Colors.white.withValues(alpha: 0.40),
                        fontSize: 10,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Scrollable Sidebar Sections
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              children: [
                // SECTION: RECENT CHATS
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
                  child: Text(
                    'RECENT CHATS',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.45),
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),

                // Card: Start a new chat
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.03),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          const CoreBlowIcon.sparkle(
                            size: 13,
                            color: StudioColors.accentMint,
                            accentColor: StudioColors.accentCyan,
                          ),
                          const SizedBox(width: 6),
                          Expanded(
                            child: Text(
                              'Start a new chat',
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.75),
                                fontSize: 11.5,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Type anything below to ask questions, summarize notes, or brainstorm.',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.45),
                          fontSize: 10.5,
                          height: 1.3,
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 14),

                // SECTION: PROJECTS (OPTIONAL)
                Padding(
                  padding: const EdgeInsets.fromLTRB(2, 0, 2, 4),
                  child: Row(
                    children: [
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 12,
                        color: Colors.white.withValues(alpha: 0.45),
                      ),
                      const SizedBox(width: 2),
                      Expanded(
                        child: Text(
                          'PROJECTS (OPTIONAL)',
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.45),
                            fontSize: 9.5,
                            fontWeight: FontWeight.bold,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                      Icon(
                        Icons.add,
                        size: 12,
                        color: Colors.white.withValues(alpha: 0.6),
                      ),
                    ],
                  ),
                ),

                // Open repository folder...
                InkWell(
                  onTap: () {},
                  borderRadius: BorderRadius.circular(6),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                    child: Row(
                      children: [
                        Icon(
                          Icons.folder_open_rounded,
                          size: 13,
                          color: Colors.white.withValues(alpha: 0.40),
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            'Open repository folder...',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.40),
                              fontSize: 11,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
