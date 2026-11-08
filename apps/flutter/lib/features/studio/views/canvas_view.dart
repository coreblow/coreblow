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
      color: StudioColors.bgCanvas, // #08110F
      child: Stack(
        children: [
          // 1. Cahaya teal samar kanan (88% / 38%), 640×520 px, opasitas 10% (#2DD4BF)
          Positioned(
            right: -80,
            top: 60,
            width: 640,
            height: 520,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(0.76, -0.24),
                    radius: 0.85,
                    colors: [
                      StudioColors.accentTeal.withValues(alpha: 0.10), // 10%
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
          ),

          // 2. Cahaya teal samar kiri atas (14% / 6%), 520×420 px, opasitas 5% (#2DD4BF)
          Positioned(
            left: -40,
            top: -30,
            width: 520,
            height: 420,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    center: const Alignment(-0.72, -0.88),
                    radius: 0.8,
                    colors: [
                      StudioColors.accentTeal.withValues(alpha: 0.05), // 5%
                      Colors.transparent,
                    ],
                  ),
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
                      // Simbol: ink #D9FBF3, inti dan cincin luar #2DD4BF (cincin luar dibuat samar 30%)
                      const ApertureEmblem(size: 38, showOuterRing: true),
                      const SizedBox(height: 18),

                      // Judul “What should we build?”: #D9FBF3
                      Text(
                        viewModel.currentProjectName.isEmpty
                            ? 'What should we build?'
                            : 'What should we build in ${viewModel.currentProjectName}?',
                        style: const TextStyle(
                          color: StudioColors.textPrimary, // #D9FBF3
                          fontSize: 27,
                          fontWeight: FontWeight.bold,
                          letterSpacing: -0.4,
                        ),
                      ),
                      const SizedBox(height: 10),

                      // Teks bantuan: #8FB5AB, dengan chip ⌘O (latar #10261F, garis #1A3A33, teks #9CC4BA)
                      Wrap(
                        alignment: WrapAlignment.center,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        children: [
                          const Text(
                            'Press ',
                            style: TextStyle(
                              color: StudioColors.textBody, // #8FB5AB
                              fontSize: 12.5,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
                            decoration: BoxDecoration(
                              color: StudioColors.bgChip, // #10261F
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(
                                color: StudioColors.borderChip, // #1A3A33
                                width: 0.8,
                              ),
                            ),
                            child: const Text(
                              '⌘O',
                              style: TextStyle(
                                color: StudioColors.textSecondary, // #9CC4BA
                                fontSize: 9.5,
                                fontWeight: FontWeight.bold,
                                fontFamily: 'monospace',
                              ),
                            ),
                          ),
                          const Text(
                            ' to select a repository or type a command below',
                            style: TextStyle(
                              color: StudioColors.textBody, // #8FB5AB
                              fontSize: 12.5,
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
