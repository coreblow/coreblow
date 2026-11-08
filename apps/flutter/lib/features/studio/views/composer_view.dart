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
      height: 72,
      decoration: BoxDecoration(
        color: StudioColors.bgComposer, // #0B1916
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: StudioColors.borderComposer, // #1A3A33
          width: 0.8,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.35), // bayangan hitam 35%
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
                  color: StudioColors.textPrimary, // teks yang diketik #D9FBF3
                  fontSize: 13.5,
                ),
                cursorColor: StudioColors.accentTeal,
                decoration: const InputDecoration(
                  hintText: 'Do anything',
                  hintStyle: TextStyle(
                    color: StudioColors.textMuted, // placeholder #7FA99F
                    fontSize: 13.5,
                  ),
                  border: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.only(top: 9, bottom: 2),
                ),
                onSubmitted: (_) => viewModel.sendMessage(),
              ),
            ),
          ),

          // Tier 2: Context Bar & Action Buttons
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 0, 10, 7),
            child: Row(
              children: [
                // Chip “Select folder...”: latar #10261F, garis #1A3A33, teks #C4E4DC
                InkWell(
                  onTap: () {},
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: StudioColors.bgChip, // #10261F
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(
                        color: StudioColors.borderChip, // #1A3A33
                        width: 0.8,
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Icon(
                          Icons.folder_outlined,
                          size: 11,
                          color: StudioColors.textChip, // #C4E4DC
                        ),
                        const SizedBox(width: 5),
                        Text(
                          viewModel.currentProjectName.isEmpty
                              ? 'Select folder...'
                              : viewModel.currentProjectName,
                          style: const TextStyle(
                            color: StudioColors.textChip, // #C4E4DC
                            fontSize: 11,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                const SizedBox(width: 8),

                // Chip “Full access” (tanpa latar, saat disorot #10261F)
                _HoverChipButton(
                  icon: Icons.shield_outlined,
                  label: viewModel.executionProfile,
                  onSelected: viewModel.setExecutionProfile,
                  options: const ['Full access', 'Review required', 'Strict sandbox'],
                ),

                const Spacer(),

                // Chip “Coding” (tanpa latar, saat disorot #10261F)
                _HoverChipButton(
                  label: viewModel.selectedModel,
                  onSelected: viewModel.setSelectedModel,
                  options: const ['Coding', 'Deep Reasoning', 'Auto'],
                ),

                const SizedBox(width: 8),

                // Mic icon
                InkWell(
                  onTap: () {},
                  borderRadius: BorderRadius.circular(11),
                  child: const SizedBox(
                    width: 22,
                    height: 22,
                    child: Center(
                      child: Icon(
                        Icons.mic_none_rounded,
                        size: 13,
                        color: StudioColors.textSecondary, // #9CC4BA
                      ),
                    ),
                  ),
                ),

                const SizedBox(width: 6),

                // Tombol kirim (nonaktif): latar #12302A, garis #1F5148, panah #5E8F84
                // Tombol kirim (aktif): latar #2DD4BF, huruf #04201B
                _SendButton(
                  canSend: viewModel.canSendMessage,
                  onTap: viewModel.sendMessage,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HoverChipButton extends StatefulWidget {
  const _HoverChipButton({
    this.icon,
    required this.label,
    required this.onSelected,
    required this.options,
  });

  final IconData? icon;
  final String label;
  final ValueChanged<String> onSelected;
  final List<String> options;

  @override
  State<_HoverChipButton> createState() => _HoverChipButtonState();
}

class _HoverChipButtonState extends State<_HoverChipButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: PopupMenuButton<String>(
        onSelected: widget.onSelected,
        color: StudioColors.bgComposer,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: const BorderSide(
            color: StudioColors.borderComposer,
            width: 0.8,
          ),
        ),
        itemBuilder: (context) => widget.options.map((opt) {
          return PopupMenuItem(
            value: opt,
            child: Text(
              opt,
              style: const TextStyle(
                color: StudioColors.textPrimary,
                fontSize: 12,
              ),
            ),
          );
        }).toList(),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
          decoration: BoxDecoration(
            color: _isHovered ? StudioColors.bgChip : Colors.transparent, // saat disorot #10261F
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.icon != null) ...[
                Icon(
                  widget.icon,
                  size: 11,
                  color: StudioColors.textSecondary,
                ),
                const SizedBox(width: 4),
              ],
              Text(
                widget.label,
                style: const TextStyle(
                  color: StudioColors.textSecondary, // #9CC4BA
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(width: 2),
              const Icon(
                Icons.keyboard_arrow_down_rounded,
                size: 10,
                color: StudioColors.textMuted, // #7FA99F
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SendButton extends StatelessWidget {
  const _SendButton({
    required this.canSend,
    required this.onTap,
  });

  final bool canSend;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    if (canSend) {
      return InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 24,
          height: 24,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: StudioColors.accentTeal, // #2DD4BF
          ),
          alignment: Alignment.center,
          child: const Icon(
            Icons.arrow_upward_rounded,
            size: 12,
            color: StudioColors.textDark, // #04201B
          ),
        ),
      );
    }

    // Tombol kirim (nonaktif): latar #12302A, garis #1F5148, panah #5E8F84
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: StudioColors.bgSendDisabled, // #12302A
        border: Border.all(
          color: StudioColors.borderSendDisabled, // #1F5148
          width: 0.8,
        ),
      ),
      alignment: Alignment.center,
      child: const Icon(
        Icons.arrow_upward_rounded,
        size: 12,
        color: StudioColors.arrowSendDisabled, // #5E8F84
      ),
    );
  }
}
