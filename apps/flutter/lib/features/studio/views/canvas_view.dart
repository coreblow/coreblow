import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/aperture_emblem.dart';
import '../view_models/studio_view_model.dart';
import 'composer_view.dart';

class StudioCanvasView extends StatelessWidget {
  const StudioCanvasView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: StudioColors.bgCanvas,
      child: Stack(
        children: [
          // Subtle top-right ambient teal glow
          Positioned(
            top: 0,
            right: 0,
            width: 450,
            height: 450,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  center: Alignment.topRight,
                  radius: 0.9,
                  colors: [
                    const Color(0xFF0E3730).withValues(alpha: 0.45),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),

          // Main Center Content & Bottom Composer
          Column(
            children: [
              Expanded(
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const ApertureEmblem(size: 38),
                      const SizedBox(height: 18),
                      Text(
                        viewModel.currentProjectName.isEmpty
                            ? 'What should we build?'
                            : 'What should we build in ${viewModel.currentProjectName}?',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.5,
                        ),
                      ),
                      const SizedBox(height: 10),
                      Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          Text(
                            'Press ',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.45),
                              fontSize: 13,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: Colors.white.withValues(alpha: 0.14),
                                width: 0.5,
                              ),
                            ),
                            child: Text(
                              '⌘O',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.85),
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                          Text(
                            ' to select a repository or type a command below',
                            style: TextStyle(
                              color: Colors.white.withValues(alpha: 0.45),
                              fontSize: 13,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),

              // Floating Composer Bar (683x70 with 22px bottom margin)
              StudioComposerView(viewModel: viewModel),
              const SizedBox(height: 22),
            ],
          ),
        ],
      ),
    );
  }
}
