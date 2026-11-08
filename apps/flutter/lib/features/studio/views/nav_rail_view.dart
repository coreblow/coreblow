import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
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
      color: StudioColors.bgNavRail,
      child: Column(
        children: [
          const SizedBox(height: 6),

          // Nav tabs
          _NavRailItem(
            icon: Icons.chat_bubble_outline_rounded,
            tooltip: 'Home & Chat',
            isSelected: viewModel.activeNavTab == StudioNavTab.home,
            onTap: () => viewModel.setNavTab(StudioNavTab.home),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: Icons.access_time_rounded,
            tooltip: 'History',
            isSelected: viewModel.activeNavTab == StudioNavTab.history,
            onTap: () => viewModel.setNavTab(StudioNavTab.history),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: Icons.view_in_ar_rounded,
            tooltip: 'CoreHub Store',
            isSelected: viewModel.activeNavTab == StudioNavTab.coreHub,
            onTap: () => viewModel.setNavTab(StudioNavTab.coreHub),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: Icons.people_outline_rounded,
            tooltip: 'Team & Agents',
            isSelected: viewModel.activeNavTab == StudioNavTab.team,
            onTap: () => viewModel.setNavTab(StudioNavTab.team),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: Icons.book_outlined,
            tooltip: 'Documentation & Wiki',
            isSelected: viewModel.activeNavTab == StudioNavTab.docs,
            onTap: () => viewModel.setNavTab(StudioNavTab.docs),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: Icons.account_tree_outlined,
            tooltip: 'Git & Worktrees',
            isSelected: viewModel.activeNavTab == StudioNavTab.git,
            onTap: () => viewModel.setNavTab(StudioNavTab.git),
          ),

          const Spacer(),

          // Bottom Avatar (FE)
          Tooltip(
            message: 'Account & Settings',
            child: InkWell(
              onTap: viewModel.toggleProfileMenu,
              borderRadius: BorderRadius.circular(11),
              child: Container(
                width: 22,
                height: 22,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  color: StudioColors.accentEmerald,
                ),
                alignment: Alignment.center,
                child: Text(
                  viewModel.userInitials,
                  style: const TextStyle(
                    color: StudioColors.textDark,
                    fontSize: 9,
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

class _NavRailItem extends StatelessWidget {
  const _NavRailItem({
    required this.icon,
    required this.tooltip,
    required this.isSelected,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final bool isSelected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: isSelected ? Colors.white.withValues(alpha: 0.12) : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Center(
            child: Icon(
              icon,
              size: 13,
              color: isSelected ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
          ),
        ),
      ),
    );
  }
}
