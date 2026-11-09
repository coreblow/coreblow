import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  int _lastMessageCount = 0;
  int _lastContentLength = 0;
  String? _lastThreadId;

  @override
  void initState() {
    super.initState();
    _lastThreadId = widget.viewModel.activeThreadId;
    _lastMessageCount = widget.viewModel.messages.length;
    _lastContentLength = widget.viewModel.messages.isNotEmpty
        ? widget.viewModel.messages.last.content.length
        : 0;
    widget.viewModel.addListener(_onViewModelChanged);
    if (widget.viewModel.messages.isNotEmpty) {
      _jumpToBottom();
    }
  }

  @override
  void didUpdateWidget(StudioCanvasView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.viewModel != oldWidget.viewModel) {
      oldWidget.viewModel.removeListener(_onViewModelChanged);
      widget.viewModel.addListener(_onViewModelChanged);
      _checkAndScroll();
    }
  }

  @override
  void dispose() {
    widget.viewModel.removeListener(_onViewModelChanged);
    _scrollController.dispose();
    super.dispose();
  }

  void _onViewModelChanged() {
    if (mounted) {
      setState(() {});
    }
    _checkAndScroll();
  }

  void _checkAndScroll() {
    final currentCount = widget.viewModel.messages.length;
    final currentContentLength = widget.viewModel.messages.isNotEmpty
        ? widget.viewModel.messages.last.content.length
        : 0;
    final currentThreadId = widget.viewModel.activeThreadId;

    final hasThreadSwitched = currentThreadId != _lastThreadId;
    final hasMessageCountChanged = currentCount != _lastMessageCount;
    final hasContentLengthChanged = currentContentLength != _lastContentLength;

    if (hasThreadSwitched || hasMessageCountChanged || hasContentLengthChanged) {
      _lastMessageCount = currentCount;
      _lastContentLength = currentContentLength;
      _lastThreadId = currentThreadId;

      if (hasThreadSwitched) {
        _jumpToBottom();
      } else {
        _scrollToBottom();
      }
    }
  }

  void _jumpToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_scrollController.hasClients) {
        _scrollController.jumpTo(_scrollController.position.maxScrollExtent);
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (_scrollController.hasClients) {
        final maxScroll = _scrollController.position.maxScrollExtent;
        if ((_scrollController.position.pixels - maxScroll).abs() > 1.0) {
          _scrollController.animateTo(
            maxScroll,
            duration: const Duration(milliseconds: 100),
            curve: Curves.easeOut,
          );
        }
      }
    });
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
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildMessageContent(message.content, isUser: true),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  timeStr,
                  style: const TextStyle(
                    color: StudioColors.textMuted, // #7FA99F
                    fontSize: 9.5,
                    fontFamily: 'monospace',
                  ),
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
                    if (message.toolSteps.isNotEmpty) ...[
                      Container(
                        margin: const EdgeInsets.only(bottom: 8),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF07100E),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(
                            color: StudioColors.borderCard, // #16322C
                            width: 0.8,
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(
                                  Icons.terminal_rounded,
                                  size: 11,
                                  color: StudioColors.accentTeal,
                                ),
                                const SizedBox(width: 5),
                                Text(
                                  'CoreBlow Execution Steps (${message.toolSteps.length})',
                                  style: const TextStyle(
                                    color: StudioColors.accentTeal,
                                    fontSize: 9.5,
                                    fontFamily: 'monospace',
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            for (final step in message.toolSteps) ...[
                              Padding(
                                padding: const EdgeInsets.symmetric(vertical: 1.5),
                                child: Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    const Icon(
                                      Icons.check_circle_rounded,
                                      size: 10,
                                      color: StudioColors.accentTeal,
                                    ),
                                    const SizedBox(width: 5),
                                    Expanded(
                                      child: Text(
                                        step,
                                        style: const TextStyle(
                                          color: StudioColors.textSecondary,
                                          fontSize: 9.5,
                                          fontFamily: 'monospace',
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                    ],
                    _buildMessageContent(message.content, isUser: false),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        Text(
                          timeStr,
                          style: const TextStyle(
                            color: StudioColors.textMuted, // #7FA99F
                            fontSize: 9.5,
                            fontFamily: 'monospace',
                          ),
                        ),
                        if (message.content.trim().isNotEmpty && message.content != '...') ...[
                          const Spacer(),
                          _AssistantCopyButton(text: message.content),
                        ],
                      ],
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

  Widget _buildMessageContent(String content, {required bool isUser}) {
    final segments = _parseMessageSegments(content);
    if (segments.isEmpty) {
      return const SizedBox.shrink();
    }

    final baseStyle = TextStyle(
      color: StudioColors.textPrimary,
      fontSize: 13,
      height: isUser ? 1.35 : 1.4,
    );

    if (segments.length == 1 && !segments.first.isCode) {
      final prose = segments.first.content;
      if (!prose.contains('`') && !prose.contains('**')) {
        return SelectableText(prose, style: baseStyle);
      }
      return SelectableText.rich(_buildProseSpan(prose, baseStyle));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        for (int i = 0; i < segments.length; i++) ...[
          if (i > 0) const SizedBox(height: 6),
          if (segments[i].isCode)
            _FencedCodeBlock(
              code: segments[i].content,
              language: segments[i].language,
            )
          else
            SelectableText.rich(
              _buildProseSpan(segments[i].content, baseStyle),
            ),
        ],
      ],
    );
  }
}

class _ContentSegment {
  const _ContentSegment.prose(this.content)
      : isCode = false,
        language = '';

  const _ContentSegment.code(this.content, {this.language = ''})
      : isCode = true;

  final bool isCode;
  final String content;
  final String language;
}

List<_ContentSegment> _parseMessageSegments(String text) {
  final segments = <_ContentSegment>[];
  if (text.isEmpty) return segments;

  final regex = RegExp(r'```([^\r\n]*)(?:\r?\n([\s\S]*?)(?:```|$)|$)');
  int lastEnd = 0;

  for (final match in regex.allMatches(text)) {
    if (match.start > lastEnd) {
      var prose = text.substring(lastEnd, match.start);
      if (prose.endsWith('\r\n')) {
        prose = prose.substring(0, prose.length - 2);
      } else if (prose.endsWith('\n')) {
        prose = prose.substring(0, prose.length - 1);
      }
      if (prose.trim().isNotEmpty) {
        segments.add(_ContentSegment.prose(prose));
      }
    }
    final lang = (match.group(1) ?? '').trim();
    var code = match.group(2) ?? '';
    if (code.endsWith('\r\n')) {
      code = code.substring(0, code.length - 2);
    } else if (code.endsWith('\n')) {
      code = code.substring(0, code.length - 1);
    }
    segments.add(_ContentSegment.code(code, language: lang));
    lastEnd = match.end;
  }

  if (lastEnd < text.length) {
    var remaining = text.substring(lastEnd);
    if (lastEnd > 0) {
      if (remaining.startsWith('\r\n')) {
        remaining = remaining.substring(2);
      } else if (remaining.startsWith('\n')) {
        remaining = remaining.substring(1);
      }
    }
    if (remaining.trim().isNotEmpty) {
      segments.add(_ContentSegment.prose(remaining));
    }
  }

  return segments;
}

TextSpan _buildProseSpan(String prose, TextStyle baseStyle) {
  final spans = <InlineSpan>[];
  final regex = RegExp(r'(`[^`]+`|\*\*[^*]+\*\*)');
  int lastEnd = 0;

  for (final match in regex.allMatches(prose)) {
    if (match.start > lastEnd) {
      spans.add(TextSpan(
        text: prose.substring(lastEnd, match.start),
        style: baseStyle,
      ));
    }

    final matched = match.group(0)!;
    if (matched.startsWith('`') && matched.endsWith('`') && matched.length >= 2) {
      final codeText = matched.substring(1, matched.length - 1);
      spans.add(TextSpan(
        text: codeText,
        style: baseStyle.copyWith(
          fontFamily: 'monospace',
          fontSize: (baseStyle.fontSize ?? 13) - 1,
          backgroundColor: const Color(0xFF10261F),
          color: StudioColors.accentMint,
        ),
      ));
    } else if (matched.startsWith('**') && matched.endsWith('**') && matched.length >= 4) {
      final boldText = matched.substring(2, matched.length - 2);
      spans.add(TextSpan(
        text: boldText,
        style: baseStyle.copyWith(
          fontWeight: FontWeight.bold,
          color: StudioColors.textPrimary,
        ),
      ));
    } else {
      spans.add(TextSpan(
        text: matched,
        style: baseStyle,
      ));
    }

    lastEnd = match.end;
  }

  if (lastEnd < prose.length) {
    spans.add(TextSpan(
      text: prose.substring(lastEnd),
      style: baseStyle,
    ));
  }

  return TextSpan(children: spans);
}

class _FencedCodeBlock extends StatefulWidget {
  const _FencedCodeBlock({
    required this.code,
    required this.language,
  });

  final String code;
  final String language;

  @override
  State<_FencedCodeBlock> createState() => _FencedCodeBlockState();
}

class _FencedCodeBlockState extends State<_FencedCodeBlock> {
  bool _copied = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.code));
    setState(() => _copied = true);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() => _copied = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final langTag = widget.language.trim().isNotEmpty ? widget.language.trim() : 'code';

    return Container(
      margin: const EdgeInsets.symmetric(vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF07100E),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(
          color: const Color(0xFF16322C),
          width: 0.8,
        ),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Header Bar
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: const BoxDecoration(
              color: Color(0xFF0A1815),
              border: Border(
                bottom: BorderSide(
                  color: Color(0xFF16322C),
                  width: 0.8,
                ),
              ),
            ),
            child: Row(
              children: [
                Text(
                  langTag,
                  style: const TextStyle(
                    fontFamily: 'monospace',
                    fontSize: 10.5,
                    color: StudioColors.accentTeal,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                InkWell(
                  onTap: _copy,
                  borderRadius: BorderRadius.circular(4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: _copied ? StudioColors.bgChip : Colors.transparent,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _copied ? Icons.check_rounded : Icons.copy_rounded,
                          size: 11,
                          color: _copied ? StudioColors.accentMint : StudioColors.textMuted,
                        ),
                        const SizedBox(width: 4),
                        Text(
                          _copied ? 'Copied ✓' : 'Copy',
                          style: TextStyle(
                            fontFamily: 'monospace',
                            fontSize: 10,
                            color: _copied ? StudioColors.accentMint : StudioColors.textMuted,
                            fontWeight: _copied ? FontWeight.bold : FontWeight.w500,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Code Text Area
          Padding(
            padding: const EdgeInsets.all(10),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: SelectableText(
                widget.code,
                style: const TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 12,
                  color: StudioColors.textPrimary,
                  height: 1.4,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AssistantCopyButton extends StatefulWidget {
  const _AssistantCopyButton({required this.text});

  final String text;

  @override
  State<_AssistantCopyButton> createState() => _AssistantCopyButtonState();
}

class _AssistantCopyButtonState extends State<_AssistantCopyButton> {
  bool _copied = false;
  Timer? _timer;

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _copy() {
    Clipboard.setData(ClipboardData(text: widget.text));
    setState(() => _copied = true);
    _timer?.cancel();
    _timer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() => _copied = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: _copy,
      borderRadius: BorderRadius.circular(4),
      child: Tooltip(
        message: _copied ? 'Copied to clipboard' : 'Copy response',
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 2),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                _copied ? Icons.check_rounded : Icons.copy_rounded,
                size: 11,
                color: _copied ? StudioColors.accentMint : StudioColors.textMuted,
              ),
              const SizedBox(width: 3),
              Text(
                _copied ? 'Copied ✓' : 'Copy',
                style: TextStyle(
                  fontFamily: 'monospace',
                  fontSize: 9.5,
                  color: _copied ? StudioColors.accentMint : StudioColors.textMuted,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
