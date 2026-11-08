import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/coreblow_icons.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';

class StudioProfilePopoverCard extends StatelessWidget {
  const StudioProfilePopoverCard({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 270,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: StudioColors.bgCard, // #0A1815
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: StudioColors.borderCard, // #16322C
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.55),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header: Avatar, Username, Online status
          Row(
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: StudioColors.accentTeal, // #2DD4BF
                  border: Border.all(
                    color: StudioColors.ringAvatar, // #1F5148
                    width: 1.5,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  viewModel.userInitials,
                  style: const TextStyle(
                    color: StudioColors.textDark, // #04201B
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      viewModel.userName,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: StudioColors.textPrimary, // #D9FBF3
                        fontSize: 13,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          width: 5,
                          height: 5,
                          decoration: const BoxDecoration(
                            shape: BoxShape.circle,
                            color: StudioColors.accentTeal, // #2DD4BF
                          ),
                        ),
                        const SizedBox(width: 5),
                        const Expanded(
                          child: Text(
                            'Online · Local Mode',
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: StudioColors.textSecondary, // #9CC4BA
                              fontSize: 10.5,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          _divider(),

          // SECTION: PREFERENCES & DISPLAY
          _sectionLabel('PREFERENCES & DISPLAY'),
          const SizedBox(height: 2),
          _menuRow(
            icon: Icons.tune_rounded,
            title: 'Settings...',
            shortcutKeys: ['⌘', ','],
            onTap: () => viewModel.openSettings(section: 'general'),
          ),
          const SizedBox(height: 2),

          // Language switcher row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Row(
              children: [
                const Icon(
                  Icons.language_rounded,
                  size: 13,
                  color: StudioColors.textSecondary,
                ),
                const SizedBox(width: 8),
                const Text(
                  'Language',
                  style: TextStyle(
                    color: StudioColors.textPrimary, // #D9FBF3
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: StudioColors.bgChip, // #10261F
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: StudioColors.borderChip, // #1A3A33
                      width: 0.8,
                    ),
                  ),
                  child: Row(
                    children: [
                      _langButton('EN', viewModel.language == 'EN', () => viewModel.setLanguage('EN')),
                      _langButton('ID', viewModel.language == 'ID', () => viewModel.setLanguage('ID')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 2),
          _menuRow(
            icon: Icons.help_outline_rounded,
            title: 'Guides & Help',
            shortcutKeys: ['↑', '⌘', '/'],
            onTap: () => viewModel.closeProfileMenu(),
          ),

          _divider(),

          // SECTION: EXTENSIONS & MODELS
          _sectionLabel('EXTENSIONS & MODELS'),
          const SizedBox(height: 2),
          _menuRow(
            iconWidget: const CoreBlowIcon.package(
              size: 14,
              color: StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            title: 'CoreHub Store',
            shortcutKeys: ['⌘', 'P'],
            onTap: () {
              viewModel.setNavTab(StudioNavTab.coreHub);
              viewModel.closeProfileMenu();
            },
          ),
          const SizedBox(height: 2),
          _menuRow(
            iconWidget: const CoreBlowIcon.code(
              size: 14,
              color: StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            title: 'AI Keys (Config)',
            shortcutKeys: ['⌘', 'K'],
            onTap: () => viewModel.openSettings(section: 'api_keys'),
          ),
        ],
      ),
    );
  }

  Widget _divider() {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Container(
        height: 0.5,
        color: StudioColors.borderSidebar, // #12302A
      ),
    );
  }

  Widget _sectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 2, 6, 2),
      child: Text(
        label,
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

  Widget _menuRow({
    IconData? icon,
    Widget? iconWidget,
    required String title,
    required List<String> shortcutKeys,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(6),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 5),
        child: Row(
          children: [
            if (iconWidget != null)
              iconWidget
            else
              Icon(icon, size: 13, color: StudioColors.textSecondary),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: StudioColors.textPrimary, // #D9FBF3
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
            Row(
              children: shortcutKeys.map((k) {
                return Container(
                  margin: const EdgeInsets.only(left: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
                  decoration: BoxDecoration(
                    color: StudioColors.bgChip, // #10261F
                    borderRadius: BorderRadius.circular(4),
                    border: Border.all(
                      color: StudioColors.borderChip, // #1A3A33
                      width: 0.8,
                    ),
                  ),
                  child: Text(
                    k,
                    style: const TextStyle(
                      color: StudioColors.textSecondary, // #9CC4BA
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      fontFamily: 'monospace',
                    ),
                  ),
                );
              }).toList(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _langButton(String text, bool isSelected, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
        decoration: BoxDecoration(
          color: isSelected ? StudioColors.accentTeal : Colors.transparent, // #2DD4BF
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          text,
          style: TextStyle(
            color: isSelected ? StudioColors.textDark : StudioColors.textSecondary, // #04201B / #9CC4BA
            fontSize: 9.5,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }
}
