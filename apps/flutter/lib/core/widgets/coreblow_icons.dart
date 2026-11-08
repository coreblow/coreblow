import 'package:flutter/material.dart';
import '../theme/colors.dart';

enum CoreBlowIconType {
  // Rail (6)
  chat,
  history,
  package,
  people,
  book,
  branch,

  // Sidebar (11)
  search,
  grid,
  refresh,
  shieldCheck,
  bot,
  sparkle,
  code,
  bridge,
  layers,
  fileText,
  plusDashed,
}

class CoreBlowIcon extends StatelessWidget {
  const CoreBlowIcon(
    this.type, {
    super.key,
    this.size = 24.0,
    this.color,
    this.accentColor,
    this.strokeWidth = 1.75,
  });

  final CoreBlowIconType type;
  final double size;
  final Color? color;
  final Color? accentColor;
  final double strokeWidth;

  // Convenient Factory Constructors for Rail
  const CoreBlowIcon.chat({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.chat;
  const CoreBlowIcon.history({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.history;
  const CoreBlowIcon.package({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.package;
  const CoreBlowIcon.people({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.people;
  const CoreBlowIcon.book({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.book;
  const CoreBlowIcon.branch({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.branch;

  // Sidebar Constructors
  const CoreBlowIcon.search({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.search;
  const CoreBlowIcon.grid({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.grid;
  const CoreBlowIcon.refresh({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.refresh;
  const CoreBlowIcon.shieldCheck({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.shieldCheck;
  const CoreBlowIcon.bot({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.bot;
  const CoreBlowIcon.sparkle({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.sparkle;
  const CoreBlowIcon.code({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.code;
  const CoreBlowIcon.bridge({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.bridge;
  const CoreBlowIcon.layers({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.layers;
  const CoreBlowIcon.fileText({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.fileText;
  const CoreBlowIcon.plusDashed({super.key, this.size = 24.0, this.color, this.accentColor, this.strokeWidth = 1.75})
      : type = CoreBlowIconType.plusDashed;

  @override
  Widget build(BuildContext context) {
    final baseColor = color ?? Colors.white.withValues(alpha: 0.92);
    final accent = accentColor ?? StudioColors.accentCyan; // #2DD4BF

    return SizedBox(
      width: size,
      height: size,
      child: CustomPaint(
        size: Size(size, size),
        painter: _CoreBlowIconPainter(
          type: type,
          baseColor: baseColor,
          accentColor: accent,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

class _CoreBlowIconPainter extends CustomPainter {
  _CoreBlowIconPainter({
    required this.type,
    required this.baseColor,
    required this.accentColor,
    required this.strokeWidth,
  });

  final CoreBlowIconType type;
  final Color baseColor;
  final Color accentColor;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    // Standard 24x24 scale
    final scale = size.width / 24.0;
    canvas.scale(scale, scale);

    final basePaint = Paint()
      ..color = baseColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final accentPaint = Paint()
      ..color = accentColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;

    final accentFill = Paint()
      ..color = accentColor
      ..style = PaintingStyle.fill;

    switch (type) {
      // ======================================================================
      // 1. RAIL NAVIGASI (6)
      // ======================================================================
      case CoreBlowIconType.chat:
        // Speech bubble
        final path = Path()
          ..moveTo(6, 4)
          ..lineTo(18, 4)
          ..arcToPoint(const Offset(20, 6), radius: const Radius.circular(2))
          ..lineTo(20, 15)
          ..arcToPoint(const Offset(18, 17), radius: const Radius.circular(2))
          ..lineTo(9, 17)
          ..lineTo(5, 20.5)
          ..lineTo(5.5, 17)
          ..lineTo(6, 17)
          ..arcToPoint(const Offset(4, 15), radius: const Radius.circular(2))
          ..lineTo(4, 6)
          ..arcToPoint(const Offset(6, 4), radius: const Radius.circular(2));
        canvas.drawPath(path, basePaint);

        // Teal accent: inner dash
        canvas.drawLine(const Offset(8, 10.5), const Offset(15, 10.5), accentPaint);
        break;

      case CoreBlowIconType.history:
        // Clock circle
        canvas.drawCircle(const Offset(12, 12), 8.5, basePaint);
        // Hour hand (white)
        canvas.drawLine(const Offset(12, 12), const Offset(12, 7.5), basePaint);
        // Teal accent: minute hand
        canvas.drawLine(const Offset(12, 12), const Offset(16.5, 12), accentPaint);
        // Center pivot
        canvas.drawCircle(const Offset(12, 12), 1.2, accentFill);
        break;

      case CoreBlowIconType.package:
        // Isometric box top face & vertical
        final topFace = Path()
          ..moveTo(12, 3.5)
          ..lineTo(19.5, 7.5)
          ..lineTo(12, 11.5)
          ..lineTo(4.5, 7.5)
          ..close();
        canvas.drawPath(topFace, basePaint);

        // Left & right downward edges
        canvas.drawLine(const Offset(4.5, 7.5), const Offset(4.5, 16.5), basePaint);
        canvas.drawLine(const Offset(19.5, 7.5), const Offset(19.5, 16.5), basePaint);
        canvas.drawLine(const Offset(4.5, 16.5), const Offset(12, 20.5), basePaint);
        canvas.drawLine(const Offset(19.5, 16.5), const Offset(12, 20.5), basePaint);

        // Teal accent: central vertical axis
        canvas.drawLine(const Offset(12, 11.5), const Offset(12, 20.5), accentPaint);
        break;

      case CoreBlowIconType.people:
        // Main user head
        canvas.drawCircle(const Offset(9.5, 7.5), 3.2, basePaint);
        // Main user shoulders
        final shoulders = Path()
          ..moveTo(4, 19.5)
          ..cubicTo(4, 15, 6, 14.5, 9.5, 14.5)
          ..cubicTo(13, 14.5, 15, 15, 15, 19.5);
        canvas.drawPath(shoulders, basePaint);

        // Teal accent: companion user
        canvas.drawCircle(const Offset(17, 8.5), 2.2, accentPaint);
        final compShoulder = Path()
          ..moveTo(15.5, 16.5)
          ..cubicTo(16.5, 14.5, 19, 14.5, 20, 16.5);
        canvas.drawPath(compShoulder, accentPaint);
        break;

      case CoreBlowIconType.book:
        // Notebook cover
        final book = Path()
          ..addRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(5, 3.5, 14, 17), const Radius.circular(2.5)));
        canvas.drawPath(book, basePaint);
        // Left spine
        canvas.drawLine(const Offset(8.5, 3.5), const Offset(8.5, 20.5), basePaint);

        // Teal accent: bookmark ribbon
        final ribbon = Path()
          ..moveTo(13, 3.5)
          ..lineTo(13, 11)
          ..lineTo(15, 9.5)
          ..lineTo(17, 11)
          ..lineTo(17, 3.5);
        canvas.drawPath(ribbon, accentPaint);
        break;

      case CoreBlowIconType.branch:
        // Main trunk line
        canvas.drawLine(const Offset(7, 5), const Offset(7, 19), basePaint);
        // Trunk nodes
        canvas.drawCircle(const Offset(7, 5), 2.0, basePaint);
        canvas.drawCircle(const Offset(7, 19), 2.0, basePaint);

        // Branch curve
        final fork = Path()
          ..moveTo(7, 15)
          ..cubicTo(7, 10, 16.5, 14, 16.5, 8.5);
        canvas.drawPath(fork, basePaint);

        // Teal accent: branch commit node
        canvas.drawCircle(const Offset(16.5, 8.5), 2.2, accentFill);
        break;

      // ======================================================================
      // 2. SIDEBAR (11)
      // ======================================================================
      case CoreBlowIconType.search:
        canvas.drawCircle(const Offset(10.5, 10.5), 6.0, basePaint);
        // Teal accent: handle
        canvas.drawLine(const Offset(15, 15), const Offset(20, 20), accentPaint);
        break;

      case CoreBlowIconType.grid:
        // 4 modules
        canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(4.5, 4.5, 6.5, 6.5), const Radius.circular(2)), basePaint);
        canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(13, 4.5, 6.5, 6.5), const Radius.circular(2)), basePaint);
        canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(13, 13, 6.5, 6.5), const Radius.circular(2)), basePaint);
        // Teal accent: bottom-left module
        canvas.drawRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(4.5, 13, 6.5, 6.5), const Radius.circular(2)), accentPaint);
        break;

      case CoreBlowIconType.refresh:
        final rect = const Rect.fromLTWH(4.5, 4.5, 15, 15);
        canvas.drawArc(rect, 0.4, 4.8, false, basePaint);
        // Teal accent: arrow head
        final arrow = Path()
          ..moveTo(19, 7)
          ..lineTo(19.5, 12)
          ..lineTo(14.5, 11.5);
        canvas.drawPath(arrow, accentPaint);
        break;

      case CoreBlowIconType.shieldCheck:
        final shield = Path()
          ..moveTo(12, 3.5)
          ..lineTo(19, 6.5)
          ..lineTo(19, 12)
          ..cubicTo(19, 17, 15, 19.5, 12, 20.5)
          ..cubicTo(9, 19.5, 5, 17, 5, 12)
          ..lineTo(5, 6.5)
          ..close();
        canvas.drawPath(shield, basePaint);

        // Teal accent: checkmark
        final check = Path()
          ..moveTo(9, 12)
          ..lineTo(11.5, 14.5)
          ..lineTo(15.5, 9.5);
        canvas.drawPath(check, accentPaint);
        break;

      case CoreBlowIconType.bot:
        final head = Path()
          ..addRRect(RRect.fromRectAndRadius(const Rect.fromLTWH(5, 8, 14, 11), const Radius.circular(3)));
        canvas.drawPath(head, basePaint);

        // Ears
        canvas.drawLine(const Offset(3.5, 12), const Offset(5, 12), basePaint);
        canvas.drawLine(const Offset(19, 12), const Offset(20.5, 12), basePaint);

        // Teal accent: antenna & eyes
        canvas.drawLine(const Offset(12, 8), const Offset(12, 4.5), accentPaint);
        canvas.drawCircle(const Offset(12, 4), 1.2, accentFill);
        canvas.drawCircle(const Offset(9.5, 13.5), 1.2, accentFill);
        canvas.drawCircle(const Offset(14.5, 13.5), 1.2, accentFill);
        break;

      case CoreBlowIconType.sparkle:
        final mainSparkle = Path()
          ..moveTo(11, 4)
          ..cubicTo(11, 9, 7, 13, 3, 13)
          ..cubicTo(7, 13, 11, 17, 11, 21)
          ..cubicTo(11, 17, 15, 13, 19, 13)
          ..cubicTo(15, 13, 11, 9, 11, 4)
          ..close();
        canvas.drawPath(mainSparkle, basePaint);

        // Teal accent: mini star
        canvas.drawLine(const Offset(18.5, 4), const Offset(18.5, 8), accentPaint);
        canvas.drawLine(const Offset(16.5, 6), const Offset(20.5, 6), accentPaint);
        break;

      case CoreBlowIconType.code:
        // Left bracket <
        final leftBracket = Path()
          ..moveTo(8.5, 7.5)
          ..lineTo(4.5, 12)
          ..lineTo(8.5, 16.5);
        canvas.drawPath(leftBracket, basePaint);

        // Right bracket >
        final rightBracket = Path()
          ..moveTo(15.5, 7.5)
          ..lineTo(19.5, 12)
          ..lineTo(15.5, 16.5);
        canvas.drawPath(rightBracket, basePaint);

        // Teal accent: slash /
        canvas.drawLine(const Offset(13.5, 6), const Offset(10.5, 18), accentPaint);
        break;

      case CoreBlowIconType.bridge:
        // Bridge arch
        final arch = Path()
          ..moveTo(4, 18)
          ..lineTo(4, 9)
          ..cubicTo(4, 9, 12, 4, 20, 9)
          ..lineTo(20, 18);
        canvas.drawPath(arch, basePaint);

        // Teal accent: horizontal span
        canvas.drawLine(const Offset(3.5, 13), const Offset(20.5, 13), accentPaint);
        break;

      case CoreBlowIconType.layers:
        // Bottom layer
        final l3 = Path()
          ..moveTo(4, 16)
          ..lineTo(12, 20)
          ..lineTo(20, 16);
        canvas.drawPath(l3, basePaint);

        // Middle layer
        final l2 = Path()
          ..moveTo(4, 12)
          ..lineTo(12, 16)
          ..lineTo(20, 12);
        canvas.drawPath(l2, basePaint);

        // Teal accent: top diamond layer
        final l1 = Path()
          ..moveTo(12, 4)
          ..lineTo(20, 8)
          ..lineTo(12, 12)
          ..lineTo(4, 8)
          ..close();
        canvas.drawPath(l1, accentPaint);
        break;

      case CoreBlowIconType.fileText:
        final doc = Path()
          ..moveTo(6, 3.5)
          ..lineTo(14, 3.5)
          ..lineTo(18, 7.5)
          ..lineTo(18, 20.5)
          ..lineTo(6, 20.5)
          ..close();
        canvas.drawPath(doc, basePaint);
        // Fold
        canvas.drawLine(const Offset(14, 3.5), const Offset(14, 7.5), basePaint);
        canvas.drawLine(const Offset(14, 7.5), const Offset(18, 7.5), basePaint);

        // Teal accent: content lines
        canvas.drawLine(const Offset(9, 12), const Offset(15, 12), accentPaint);
        canvas.drawLine(const Offset(9, 16), const Offset(13, 16), accentPaint);
        break;

      case CoreBlowIconType.plusDashed:
        // Dashed frame
        final rect = const Rect.fromLTWH(4.5, 4.5, 15, 15);
        canvas.drawRRect(RRect.fromRectAndRadius(rect, const Radius.circular(3)), basePaint);

        // Teal accent: plus
        canvas.drawLine(const Offset(12, 8.5), const Offset(12, 15.5), accentPaint);
        canvas.drawLine(const Offset(8.5, 12), const Offset(15.5, 12), accentPaint);
        break;
    }
  }

  @override
  bool shouldRepaint(covariant _CoreBlowIconPainter oldDelegate) {
    return oldDelegate.type != type ||
        oldDelegate.baseColor != baseColor ||
        oldDelegate.accentColor != accentColor ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}
