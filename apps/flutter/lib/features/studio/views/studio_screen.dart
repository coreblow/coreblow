import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';
import 'canvas_view.dart';
import 'corehub_view.dart';
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
          backgroundColor: StudioColors.bgWindow, // #08110F
          body: Container(
            decoration: BoxDecoration(
              color: StudioColors.bgWindow, // #08110F
              borderRadius: BorderRadius.circular(14), // Sudut membulat 14 px
              border: Border.all(
                color: StudioColors.borderWindow, // Garis tepi #16322C
                width: 1.0,
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(14),
              child: Stack(
                children: [
                  // Main Window Layout
                  Column(
                    children: [
                      // Unified Window Topbar
                      StudioTopbarView(viewModel: viewModel),

                      // Main Body: Nav Rail (left) + Nested Rounded Content Card (right)
                      Expanded(
                        child: Row(
                          children: [
                            // 1. Far-left Nav Rail (40px)
                            StudioNavRailView(viewModel: viewModel),

                            // 2. Nested Rounded Content Card (Sidebar + Canvas)
                            Expanded(
                              child: ClipRRect(
                                borderRadius: const BorderRadius.only(
                                  topLeft: Radius.circular(8),
                                ),
                                child: Container(
                                  decoration: const BoxDecoration(
                                    color: StudioColors.bgCanvas,
                                    border: Border(
                                      top: BorderSide(
                                        color: StudioColors.borderSidebar, // #12302A
                                        width: 0.5,
                                      ),
                                      left: BorderSide(
                                        color: StudioColors.borderSidebar, // #12302A
                                        width: 0.5,
                                      ),
                                    ),
                                  ),
                                  child: viewModel.activeNavTab == StudioNavTab.coreHub
                                      ? StudioCoreHubView(
                                          viewModel: viewModel,
                                          initialShowSpecSheet: const bool.fromEnvironment('SHOW_SPEC', defaultValue: false),
                                        )
                                      : Row(
                                          children: [
                                            // Collapsible Sidebar (196px)
                                            if (viewModel.isSidebarVisible) ...[
                                              StudioSidebarView(viewModel: viewModel),
                                            ],

                                            // Main Center Canvas
                                            Expanded(
                                              child: StudioCanvasView(viewModel: viewModel),
                                            ),
                                          ],
                                        ),
                                ),
                              ),
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
            ),
          ),
        );
      },
    );
  }
}
