import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../view_models/studio_view_model.dart';

class StudioComposerView extends StatelessWidget {
  const StudioComposerView({
    super.key,
    required this.viewModel,
  });

  final StudioViewModel viewModel;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(maxWidth: 683),
      margin: const EdgeInsets.symmetric(horizontal: 16),
      height: 70,
      decoration: BoxDecoration(
        color: StudioColors.bgComposer,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: StudioColors.borderComposer,
          width: 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          // Tier 1: Input text field
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14),
              child: TextField(
                controller: viewModel.inputController,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13.5,
                ),
                cursorColor: StudioColors.accentMint,
                decoration: const InputDecoration(
                  hintText: 'Do anything',
                  hintStyle: TextStyle(
                    color: Color(0xFF667A74),
                    fontSize: 13.5,
                  ),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.only(top: 8, bottom: 2),
                ),
                onSubmitted: (_) => viewModel.sendMessage(),
              ),
            ),
          ),

          // Tier 2: Context Bar & Action Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 6),
            child: Row(
              children: [
                // [📁 Select folder...]
                InkWell(
                  onTap: () {},
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: Colors.white.withValues(alpha: 0.10),
                        width: 0.5,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.folder_outlined,
                          size: 11,
                          color: Colors.white.withValues(alpha: 0.85),
                        ),
                        const SizedBox(width: 5),
                        Text(
                          viewModel.currentProjectName.isEmpty
                              ? 'Select folder...'
                              : viewModel.currentProjectName,
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.85),
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // [🛡️ Full access ⌄]
                PopupMenuButton<String>(
                  onSelected: viewModel.setExecutionProfile,
                  color: const Color(0xFF0F2620),
                  shape: RoundedRectangleFramework(),
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'Full access', child: Text('Full access', style: TextStyle(color: Colors.white, fontSize: 12))),
                    const PopupMenuItem(value: 'Review required', child: Text('Review required', style: TextStyle(color: Colors.white, fontSize: 12))),
                    const PopupMenuItem(value: 'Strict sandbox', child: Text('Strict sandbox', style: TextStyle(color: Colors.white, fontSize: 12))),
                  ],
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.shield_outlined,
                        size: 11,
                        color: Colors.white.withValues(alpha: 0.75),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        viewModel.executionProfile,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.75),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 10,
                        color: Colors.white.withValues(alpha: 0.40),
                      ),
                    ],
                  ),
                ),

                const Spacer(),

                // Coding ⌄
                PopupMenuButton<String>(
                  onSelected: viewModel.setSelectedModel,
                  color: const Color(0xFF0F2620),
                  shape: RoundedRectangleFramework(),
                  itemBuilder: (context) => [
                    const PopupMenuItem(value: 'Coding', child: Text('Coding', style: TextStyle(color: Colors.white, fontSize: 12))),
                    const PopupMenuItem(value: 'Deep Reasoning', child: Text('Deep Reasoning', style: TextStyle(color: Colors.white, fontSize: 12))),
                    const PopupMenuItem(value: 'Auto', child: Text('Auto', style: TextStyle(color: Colors.white, fontSize: 12))),
                  ],
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        viewModel.selectedModel,
                        style: TextStyle(
                          color: Colors.white.withValues(alpha: 0.72),
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(width: 2),
                      Icon(
                        Icons.keyboard_arrow_down_rounded,
                        size: 10,
                        color: Colors.white.withValues(alpha: 0.40),
                      ),
                    ],
                  ),
                ),

                const SizedBox(width: 8),

                // mic
                InkWell(
                  onTap: () {},
                  borderRadius: BorderRadius.circular(11),
                  child: SizedBox(
                    width: 22,
                    height: 22,
                    child: Center(
                      child: Icon(
                        Icons.mic_none_rounded,
                        size: 13,
                        color: Colors.white.withValues(alpha: 0.60),
                      ),
                    ),
                  ),
                ),

                const SizedBox(width: 4),

                // Teal circular send button
                InkWell(
                  onTap: viewModel.canSendMessage ? viewModel.sendMessage : null,
                  borderRadius: BorderRadius.circular(12),
                  child: AnimatedOpacity(
                    duration: const Duration(milliseconds: 150),
                    opacity: viewModel.canSendMessage ? 1.0 : 0.45,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: StudioColors.accentSend,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.arrow_upward_rounded,
                        size: 12,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class RoundedRectangleFramework extends RoundedRectangleBorder {
  RoundedRectangleFramework()
      : super(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: StudioColors.accentMint.withValues(alpha: 0.20),
            width: 0.5,
          ),
        );
}
