import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../view_models/studio_view_model.dart';
import 'canvas_view.dart';
import 'nav_rail_view.dart';
import 'profile_popover_card.dart';
import 'sidebar_view.dart';
import 'topbar_view.dart';

class StudioScreen extends StatelessWidget {
  const StudioScreen({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: viewModel,
      builder: (context, _) {
        return Scaffold(
          backgroundColor: StudioColors.bgWindow,
          body: Stack(
            children: [
              // Main Window Layout
              Column(
                children: [
                  // Unified Window Topbar (height 32)
                  StudioTopbarView(viewModel: viewModel),

                  // Top hairline divider
                  Container(height: 0.5, color: StudioColors.borderSubtle),

                  // Main Columns
                  Expanded(
                    child: Row(
                      children: [
                        // 1. Far-left Nav Rail (40px)
                        StudioNavRailView(viewModel: viewModel),

                        // Hairline divider
                        Container(width: 0.5, color: StudioColors.borderSubtle),

                        // 2. Collapsible Sidebar (188px)
                        if (viewModel.isSidebarVisible) ...[
                          StudioSidebarView(viewModel: viewModel),
                          Container(width: 0.5, color: StudioColors.borderSubtle),
                        ],

                        // 3. Main Center Canvas
                        Expanded(
                          child: StudioCanvasView(viewModel: viewModel),
                        ),
                      ],
                    ),
                  ),
                ],
              ),

              // Bottom-Left Anchored Profile Popover
              if (viewModel.isProfileMenuPresented) ...[
                Positioned.fill(
                  child: GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: viewModel.closeProfileMenu,
                    child: const SizedBox.expand(),
                  ),
                ),
                Positioned(
                  left: 10,
                  bottom: 40,
                  child: StudioProfilePopoverCard(viewModel: viewModel),
                ),
              ],
            ],
          ),
        );
      },
    );
  }
}
