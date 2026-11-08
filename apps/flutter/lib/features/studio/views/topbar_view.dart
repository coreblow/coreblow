import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../view_models/studio_view_model.dart';

class StudioTopbarView extends StatelessWidget {
  const StudioTopbarView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 35,
      color: StudioColors.bgTopbar,
      child: Row(
        children: [
          // Traffic lights space on macOS (68px)
          const SizedBox(width: 68),

          // Back & Forward history buttons
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _TopbarIconButton(
                icon: Icons.arrow_back,
                onPressed: () {},
                tooltip: 'Back',
              ),
              const SizedBox(width: 2),
              _TopbarIconButton(
                icon: Icons.arrow_forward,
                onPressed: () {},
                tooltip: 'Forward',
              ),
            ],
          ),

          const SizedBox(width: 8),

          // Sidebar Toggle Button
          _TopbarIconButton(
            icon: Icons.view_sidebar_outlined,
            isActive: viewModel.isSidebarVisible,
            onPressed: viewModel.toggleSidebar,
            tooltip: 'Toggle Sidebar',
          ),

          const Spacer(),

          // Status Badge (like ✦ Rejoin Plus in Image 2)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: StudioColors.accentMint.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.auto_awesome,
                  size: 11,
                  color: StudioColors.accentMint,
                ),
                const SizedBox(width: 4),
                Text(
                  'CoreBlow Plus',
                  style: TextStyle(
                    color: StudioColors.accentMint,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 10),

          // Inspector Toggle Button
          _TopbarIconButton(
            icon: Icons.view_sidebar_outlined,
            isActive: viewModel.isInspectorVisible,
            isTrailing: true,
            onPressed: viewModel.toggleInspector,
            tooltip: 'Toggle Inspector',
          ),
          const SizedBox(width: 14),
        ],
      ),
    );
  }
}

class _TopbarIconButton extends StatelessWidget {
  const _TopbarIconButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.isActive = false,
    this.isTrailing = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final bool isActive;
  final bool isTrailing;

  @override
  Widget build(BuildContext context) {
    Widget iconWidget = Icon(
      icon,
      size: 13,
      color: isActive ? Colors.white.withValues(alpha: 0.85) : Colors.white.withValues(alpha: 0.40),
    );

    if (isTrailing) {
      iconWidget = Transform.flip(flipX: true, child: iconWidget);
    }

    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(4),
        child: SizedBox(
          width: 22,
          height: 22,
          child: Center(child: iconWidget),
        ),
      ),
    );
  }
}
