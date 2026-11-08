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
      color: StudioColors.bgNavRail,
      child: Column(
        children: [
          const SizedBox(height: 6),

          // Nav tabs with Quiet Instrument Icon System (#2DD4BF accent)
          _NavRailItem(
            icon: CoreBlowIcon.chat(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.home ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
            tooltip: 'Home & Chat',
            isSelected: viewModel.activeNavTab == StudioNavTab.home,
            onTap: () => viewModel.setNavTab(StudioNavTab.home),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: CoreBlowIcon.history(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.history ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
            tooltip: 'History',
            isSelected: viewModel.activeNavTab == StudioNavTab.history,
            onTap: () => viewModel.setNavTab(StudioNavTab.history),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: CoreBlowIcon.package(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.coreHub ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
            tooltip: 'CoreHub Store',
            isSelected: viewModel.activeNavTab == StudioNavTab.coreHub,
            onTap: () => viewModel.setNavTab(StudioNavTab.coreHub),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: CoreBlowIcon.people(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.team ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
            tooltip: 'Team & Agents',
            isSelected: viewModel.activeNavTab == StudioNavTab.team,
            onTap: () => viewModel.setNavTab(StudioNavTab.team),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: CoreBlowIcon.book(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.docs ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
            tooltip: 'Documentation & Wiki',
            isSelected: viewModel.activeNavTab == StudioNavTab.docs,
            onTap: () => viewModel.setNavTab(StudioNavTab.docs),
          ),
          const SizedBox(height: 4),
          _NavRailItem(
            icon: CoreBlowIcon.branch(
              size: 16,
              color: viewModel.activeNavTab == StudioNavTab.git ? Colors.white : Colors.white.withValues(alpha: 0.55),
            ),
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

  final Widget icon;
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
            child: icon,
          ),
        ),
      ),
    );
  }
}
