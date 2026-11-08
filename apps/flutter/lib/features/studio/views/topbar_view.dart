import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/coreblow_icons.dart';
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
          // Simulated macOS Window Controls (merah #FF5F57, kuning #FEBC2E, hijau #28C840)
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

          // Pil “12 Services”: latar #0A1815, garis #16322C, teks #C4E4DC, titik #2DD4BF
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
            decoration: BoxDecoration(
              color: StudioColors.bgCard, // #0A1815
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: StudioColors.borderCard, // #16322C
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
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
                const Text(
                  '12 Services',
                  style: TextStyle(
                    color: StudioColors.textChip, // #C4E4DC
                    fontSize: 10.5,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // Pil “PR Gates” (aktif): latar #0F2B26, garis #1F5148, teks #D9FBF3, ikon aksen teal
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
            decoration: BoxDecoration(
              color: StudioColors.bgNavActive, // #0F2B26
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: StudioColors.borderNavActive, // #1F5148
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: const [
                CoreBlowIcon.branch(
                  size: 11,
                  color: StudioColors.textPrimary,
                  accentColor: StudioColors.accentTeal,
                ),
                SizedBox(width: 4.5),
                Text(
                  'PR Gates',
                  style: TextStyle(
                    color: StudioColors.textPrimary, // #D9FBF3
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

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
