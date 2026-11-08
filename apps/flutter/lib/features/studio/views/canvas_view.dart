import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/aperture_emblem.dart';
import '../models/studio_state.dart';
import '../view_models/studio_view_model.dart';
import 'composer_view.dart';

class StudioCanvasView extends StatefulWidget {
  const StudioCanvasView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  State<StudioCanvasView> createState() => _StudioCanvasViewState();
}

class _StudioCanvasViewState extends State<StudioCanvasView> {
  final ScrollController _scrollController = ScrollController();

  @override
  void didUpdateWidget(StudioCanvasView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.viewModel.messages.length != oldWidget.viewModel.messages.length) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeOut,
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final viewModel = widget.viewModel;

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
                child: viewModel.messages.isEmpty
                    ? _buildEmptyState(viewModel)
                    : _buildConversationList(viewModel),
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

  Widget _buildEmptyState(StudioViewModel viewModel) {
    final title = viewModel.currentProjectName.isEmpty
        ? viewModel.tr('what_should_we_build')
        : viewModel.tr('what_should_we_build_in', params: {'project': viewModel.currentProjectName});

    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Lambang: ink #D9FBF3, inti dan cincin luar #2DD4BF (cincin luar dibuat samar 30%)
          const ApertureEmblem(size: 38, showOuterRing: true),
          const SizedBox(height: 18),

          // Judul “What should we build?”: #D9FBF3
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            child: Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: StudioColors.textPrimary, // #D9FBF3
                fontSize: 27,
                fontWeight: FontWeight.bold,
                letterSpacing: -0.4,
              ),
            ),
          ),
          const SizedBox(height: 10),

          // Teks bantuan: #8FB5AB, dengan chip ⌘O (latar #10261F, garis #1A3A33, teks #9CC4BA)
          Wrap(
            alignment: WrapAlignment.center,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                viewModel.tr('press_shortcut'),
                style: const TextStyle(
                  color: StudioColors.textBody, // #8FB5AB
                  fontSize: 12.5,
                ),
              ),
              InkWell(
                onTap: viewModel.pickProjectFolder,
                borderRadius: BorderRadius.circular(4),
                child: Container(
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
              ),
              Text(
                viewModel.tr('press_shortcut_hint'),
                style: const TextStyle(
                  color: StudioColors.textBody, // #8FB5AB
                  fontSize: 12.5,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildConversationList(StudioViewModel viewModel) {
    return ListView.builder(
      controller: _scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 20),
      itemCount: viewModel.messages.length,
      itemBuilder: (context, index) {
        final message = viewModel.messages[index];
        final isUser = message.sender == 'user';
        return Padding(
          padding: const EdgeInsets.only(bottom: 16),
          child: isUser ? _buildUserMessage(message) : _buildAssistantMessage(message),
        );
      },
    );
  }

  Widget _buildUserMessage(StudioMessage message) {
    final timeStr = '${message.timestamp.hour.toString().padLeft(2, '0')}:${message.timestamp.minute.toString().padLeft(2, '0')}';
    return Align(
      alignment: Alignment.centerRight,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 580),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: StudioColors.bgChip, // #10261F
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: StudioColors.borderChip, // #1A3A33
              width: 0.8,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                message.content,
                style: const TextStyle(
                  color: StudioColors.textPrimary, // #D9FBF3
                  fontSize: 13,
                  height: 1.35,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                timeStr,
                style: const TextStyle(
                  color: StudioColors.textMuted, // #7FA99F
                  fontSize: 9.5,
                  fontFamily: 'monospace',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAssistantMessage(StudioMessage message) {
    final timeStr = '${message.timestamp.hour.toString().padLeft(2, '0')}:${message.timestamp.minute.toString().padLeft(2, '0')}';
    return Align(
      alignment: Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 640),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 18px Aperture Emblem avatar
            Container(
              margin: const EdgeInsets.only(top: 2, right: 10),
              width: 24,
              height: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: StudioColors.bgCard, // #0A1815
                border: Border.all(
                  color: StudioColors.borderCard, // #16322C
                  width: 0.8,
                ),
              ),
              alignment: Alignment.center,
              child: const ApertureEmblem(size: 14, showOuterRing: false),
            ),

            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 11),
                decoration: BoxDecoration(
                  color: StudioColors.bgCard, // #0A1815
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: StudioColors.borderCard, // #16322C
                    width: 0.8,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (message.trace != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          color: StudioColors.bgChip, // #10261F
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: StudioColors.borderChip, // #1A3A33
                            width: 0.6,
                          ),
                        ),
                        child: Text(
                          message.trace!,
                          style: const TextStyle(
                            color: StudioColors.accentTeal, // #2DD4BF
                            fontSize: 9,
                            fontFamily: 'monospace',
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ],
                    Text(
                      message.content,
                      style: const TextStyle(
                        color: StudioColors.textPrimary, // #D9FBF3
                        fontSize: 13,
                        height: 1.4,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      timeStr,
                      style: const TextStyle(
                        color: StudioColors.textMuted, // #7FA99F
                        fontSize: 9.5,
                        fontFamily: 'monospace',
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
