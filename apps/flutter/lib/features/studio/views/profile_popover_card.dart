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
      width: 268,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xF206151A), // #06151A with 95% opacity
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: StudioColors.accentMint.withValues(alpha: 0.25),
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.65),
            blurRadius: 24,
            offset: const Offset(0, 10),
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
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: StudioColors.accentEmerald,
                ),
                alignment: Alignment.center,
                child: Text(
                  viewModel.userInitials,
                  style: const TextStyle(
                    color: StudioColors.textDark,
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    viewModel.userName,
                    style: const TextStyle(
                      color: Colors.white,
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
                          color: StudioColors.accentCyan,
                        ),
                      ),
                      const SizedBox(width: 5),
                      Text(
                        'Online · Local Mode',
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.50),
                          fontSize: 10.5,
                        ),
                      ),
                    ],
                  ),
                ],
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
            onTap: () => viewModel.closeProfileMenu(),
          ),
          const SizedBox(height: 2),
          // Language switcher row
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
            child: Row(
              children: [
                Icon(
                  Icons.language_rounded,
                  size: 13,
                  color: Colors.white.withValues(alpha: 0.70),
                ),
                const SizedBox(width: 8),
                Text(
                  'Language',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.85),
                    fontSize: 12,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(12),
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
            iconWidget: const CoreBlowIcon.package(size: 14),
            title: 'CoreHub Store',
            shortcutKeys: ['⌘', 'P'],
            onTap: () {
              viewModel.setNavTab(StudioNavTab.coreHub);
              viewModel.closeProfileMenu();
            },
          ),
          const SizedBox(height: 2),
          _menuRow(
            iconWidget: const CoreBlowIcon.code(size: 14),
            title: 'AI Keys (Config)',
            shortcutKeys: ['⌘', 'K'],
            onTap: () {
              viewModel.closeProfileMenu();
            },
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
        color: Colors.white.withValues(alpha: 0.08),
      ),
    );
  }

  Widget _sectionLabel(String label) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(6, 2, 6, 2),
      child: Text(
        label,
        style: TextStyle(
          color: Colors.white.withValues(alpha: 0.40),
          fontSize: 9,
          fontWeight: FontWeight.bold,
          fontFamily: 'monospace',
        ),
      ),
    );
  }

  Widget _langButton(String text, bool active, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
        decoration: BoxDecoration(
          color: active ? StudioColors.accentCyan : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Text(
          text,
          style: TextStyle(
            color: active ? StudioColors.textDark : Colors.white.withValues(alpha: 0.60),
            fontSize: 9.5,
            fontWeight: FontWeight.bold,
          ),
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
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        child: Row(
          children: [
            iconWidget ??
                Icon(
                  icon,
                  size: 13,
                  color: Colors.white.withValues(alpha: 0.70),
                ),
            const SizedBox(width: 8),
            Text(
              title,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.85),
                fontSize: 12,
              ),
            ),
            const Spacer(),
            Row(
              children: shortcutKeys.map((k) {
                return Container(
                  margin: const EdgeInsets.only(left: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1.5),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    borderRadius: BorderRadius.circular(3),
                  ),
                  child: Text(
                    k,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.60),
                      fontSize: 9,
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
}
