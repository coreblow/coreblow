import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/coreblow_icons.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';

class StudioNavRailView extends StatelessWidget {
  const StudioNavRailView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      decoration: const BoxDecoration(
        color: StudioColors.bgNavRail, // #060E0C
        border: Border(
          right: BorderSide(
            color: StudioColors.borderNavRail, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        children: [
          const SizedBox(height: 6),

          // 1. Chat (Home)
          _NavRailItem(
            icon: CoreBlowIcon.chat(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.home
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'Home & Chat',
            isSelected: viewModel.activeNavTab == StudioNavTab.home,
            onTap: () => viewModel.setNavTab(StudioNavTab.home),
          ),
          const SizedBox(height: 4),

          // 2. History
          _NavRailItem(
            icon: CoreBlowIcon.history(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.history
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'History',
            isSelected: viewModel.activeNavTab == StudioNavTab.history,
            onTap: () => viewModel.setNavTab(StudioNavTab.history),
          ),
          const SizedBox(height: 4),

          // 3. CoreHub Store
          _NavRailItem(
            icon: CoreBlowIcon.package(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.coreHub
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'CoreHub Store',
            isSelected: viewModel.activeNavTab == StudioNavTab.coreHub,
            onTap: () => viewModel.setNavTab(StudioNavTab.coreHub),
          ),
          const SizedBox(height: 4),

          // 4. Team
          _NavRailItem(
            icon: CoreBlowIcon.people(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.team
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'Team & Agents',
            isSelected: viewModel.activeNavTab == StudioNavTab.team,
            onTap: () => viewModel.setNavTab(StudioNavTab.team),
          ),
          const SizedBox(height: 4),

          // 5. Docs & Wiki
          _NavRailItem(
            icon: CoreBlowIcon.book(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.docs
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'Documentation & Wiki',
            isSelected: viewModel.activeNavTab == StudioNavTab.docs,
            onTap: () => viewModel.setNavTab(StudioNavTab.docs),
          ),
          const SizedBox(height: 4),

          // 6. Git
          _NavRailItem(
            icon: CoreBlowIcon.branch(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.git
                  ? StudioColors.textPrimary
                  : StudioColors.textSecondary,
              accentColor: StudioColors.accentTeal,
            ),
            tooltip: 'Git & Worktrees',
            isSelected: viewModel.activeNavTab == StudioNavTab.git,
            onTap: () => viewModel.setNavTab(StudioNavTab.git),
          ),

          const Spacer(),

          // Bottom Avatar "FE": latar #2DD4BF, huruf #04201B, cincin #1F5148
          Tooltip(
            message: 'Account & Settings',
            child: InkWell(
              onTap: viewModel.toggleProfileMenu,
              borderRadius: BorderRadius.circular(12),
              child: Container(
                width: 24,
                height: 24,
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
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}

class _NavRailItem extends StatefulWidget {
  const _NavRailItem({
    required this.icon,
    required this.tooltip,
    required this.isSelected,
    required this.onTap,
  });

  final Widget icon;
  final String tooltip;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  State<_NavRailItem> createState() => _NavRailItemState();
}

class _NavRailItemState extends State<_NavRailItem> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    Color bgColor = Colors.transparent;
    Border? border;

    if (widget.isSelected) {
      // Saat aktif: latar #0F2B26, garis #1F5148
      bgColor = StudioColors.bgNavActive;
      border = Border.all(color: StudioColors.borderNavActive, width: 0.8);
    } else if (_isHovered) {
      // Saat disorot: latar #0C201C
      bgColor = StudioColors.bgNavHover;
    }

    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: InkWell(
          onTap: widget.onTap,
          borderRadius: BorderRadius.circular(6),
          child: Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: bgColor,
              border: border,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Center(
              child: widget.icon,
            ),
          ),
        ),
      ),
    );
  }
}
