import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/colors.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';
import 'canvas_view.dart';
import 'corehub_view.dart';
import 'inspector_view.dart';
import 'nav_rail_view.dart';
import 'profile_popover_card.dart';
import 'settings_view.dart';
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
        return CallbackShortcuts(
          bindings: <ShortcutActivator, VoidCallback>{
            const SingleActivator(LogicalKeyboardKey.keyN, meta: true): viewModel.startNewChat,
            const SingleActivator(LogicalKeyboardKey.keyO, meta: true): viewModel.pickProjectFolder,
            const SingleActivator(LogicalKeyboardKey.keyP, meta: true): () =>
                viewModel.setNavTab(StudioNavTab.coreHub),
            const SingleActivator(LogicalKeyboardKey.keyH, meta: true): () =>
                viewModel.setNavTab(StudioNavTab.home),
            const SingleActivator(LogicalKeyboardKey.keyI, meta: true): viewModel.toggleInspector,
            const SingleActivator(LogicalKeyboardKey.keyK, meta: true): () =>
                viewModel.openSettings(section: 'api_keys'),
            const SingleActivator(LogicalKeyboardKey.comma, meta: true): () =>
                viewModel.openSettings(section: 'general'),
            const SingleActivator(LogicalKeyboardKey.escape): () {
              if (viewModel.isSettingsOpen) {
                viewModel.closeSettings();
              } else if (viewModel.isProfileMenuPresented) {
                viewModel.closeProfileMenu();
              } else if (viewModel.isInspectorVisible) {
                viewModel.toggleInspector();
              }
            },
          },
          child: Focus(
            autofocus: true,
            child: Scaffold(
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

                                // 2. Nested Rounded Content Card (Sidebar + Canvas + Inspector)
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
                                      child: viewModel.isSettingsOpen
                                          ? StudioSettingsView(viewModel: viewModel)
                                          : (viewModel.activeNavTab == StudioNavTab.coreHub
                                              ? StudioCoreHubView(
                                                  viewModel: viewModel,
                                                  initialShowSpecSheet:
                                                      const bool.fromEnvironment('SHOW_SPEC', defaultValue: false),
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

                                                    // Right Inspector Panel (300px)
                                                    if (viewModel.isInspectorVisible) ...[
                                                      StudioInspectorView(viewModel: viewModel),
                                                    ],
                                                  ],
                                                )),
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
            ),
          ),
        );
      },
    );
  }
}
