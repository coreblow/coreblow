import 'package:flutter/foundation.dart';
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
      height: 36,
      decoration: const BoxDecoration(
        color: StudioColors.bgTopbar, // #08110F
        border: Border(
          bottom: BorderSide(
            color: StudioColors.borderNavRail, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          // macOS native window controls safe spacer / fallback simulated controls
          if (defaultTargetPlatform == TargetPlatform.macOS)
            const SizedBox(width: 78)
          else ...[
            const SizedBox(width: 12),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                _MacDot(color: StudioColors.macRed),
                SizedBox(width: 8),
                _MacDot(color: StudioColors.macYellow),
                SizedBox(width: 8),
                _MacDot(color: StudioColors.macGreen),
              ],
            ),
            const SizedBox(width: 18),
          ],

          // Back & Forward history buttons (saat nonaktif #3D5E56)
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              _TopbarIconButton(
                icon: Icons.arrow_back,
                onPressed: () {},
                tooltip: 'Back',
                isDisabled: true,
              ),
              const SizedBox(width: 2),
              _TopbarIconButton(
                icon: Icons.arrow_forward,
                onPressed: () {},
                tooltip: 'Forward',
                isDisabled: true,
              ),
            ],
          ),

          const SizedBox(width: 6),

          // Sidebar Toggle Button
          _TopbarIconButton(
            icon: Icons.view_sidebar_outlined,
            isActive: viewModel.isSidebarVisible,
            onPressed: viewModel.toggleSidebar,
            tooltip: 'Toggle Sidebar',
          ),

          const Spacer(),

          // Inspector Toggle Button
          _TopbarIconButton(
            icon: Icons.view_sidebar_outlined,
            isActive: viewModel.isInspectorVisible,
            isTrailing: true,
            onPressed: viewModel.toggleInspector,
            tooltip: 'Toggle Inspector',
          ),
          const SizedBox(width: 12),
        ],
      ),
    );
  }
}

class _MacDot extends StatelessWidget {
  const _MacDot({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 11,
      height: 11,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
      ),
    );
  }
}

class _TopbarIconButton extends StatefulWidget {
  const _TopbarIconButton({
    required this.icon,
    required this.onPressed,
    required this.tooltip,
    this.isActive = false,
    this.isDisabled = false,
    this.isTrailing = false,
  });

  final IconData icon;
  final VoidCallback onPressed;
  final String tooltip;
  final bool isActive;
  final bool isDisabled;
  final bool isTrailing;

  @override
  State<_TopbarIconButton> createState() => _TopbarIconButtonState();
}

class _TopbarIconButtonState extends State<_TopbarIconButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    // Tombol ikon #9CC4BA, saat disorot latar #0C201C, saat nonaktif (Back/Forward) #3D5E56
    Color iconColor;
    if (widget.isDisabled) {
      iconColor = StudioColors.iconDisabled; // #3D5E56
    } else if (widget.isActive) {
      iconColor = StudioColors.textPrimary; // #D9FBF3
    } else {
      iconColor = StudioColors.textSecondary; // #9CC4BA
    }

    Widget iconWidget = Icon(
      widget.icon,
      size: 13,
      color: iconColor,
    );

    if (widget.isTrailing) {
      iconWidget = Transform.scale(scaleX: -1, child: iconWidget);
    }

    return Tooltip(
      message: widget.tooltip,
      child: MouseRegion(
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: InkWell(
          onTap: widget.isDisabled ? null : widget.onPressed,
          borderRadius: BorderRadius.circular(5),
          child: Container(
            width: 24,
            height: 24,
            decoration: BoxDecoration(
              color: _isHovered && !widget.isDisabled
                  ? StudioColors.bgNavHover // #0C201C
                  : Colors.transparent,
              borderRadius: BorderRadius.circular(5),
            ),
            child: Center(child: iconWidget),
          ),
        ),
      ),
    );
  }
}
