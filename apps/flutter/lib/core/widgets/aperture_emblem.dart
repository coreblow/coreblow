import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/colors.dart';

class ApertureEmblem extends StatelessWidget {
  const ApertureEmblem({
    super.key,
    this.size = 38.0,
    this.showOuterRing = true,
  });

  final double size;
  final bool showOuterRing;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Cincin luar samar 30% (#2DD4BF)
          if (showOuterRing)
            Container(
              width: size * 1.15,
              height: size * 1.15,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: StudioColors.accentTeal.withValues(alpha: 0.30),
                  width: math.max(1.0, size * 0.03),
                ),
              ),
            ),

          // Split Cybernetic Arcs / Ink: #D9FBF3
          CustomPaint(
            size: Size(size, size),
            painter: _ApertureArcsPainter(
              strokeWidth: math.max(2.4, size * 0.085),
            ),
          ),

          // Glowing Center Dot / Inti: #2DD4BF
          Container(
            width: math.max(7.0, size * 0.22),
            height: math.max(7.0, size * 0.22),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: StudioColors.accentTeal,
              boxShadow: [
                BoxShadow(
                  color: StudioColors.accentTeal.withValues(alpha: 0.65),
                  blurRadius: 5,
                  spreadRadius: 1,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ApertureArcsPainter extends CustomPainter {
  _ApertureArcsPainter({required this.strokeWidth});

  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    final paint = Paint()
      ..color = StudioColors.textPrimary // #D9FBF3
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round;

    final rect = Rect.fromCircle(center: center, radius: radius);

    // Rotation offset -25 degrees
    const rotation = -25.0 * math.pi / 180.0;
    const start1 = rotation + (0.06 * 2 * math.pi);
    const sweep1 = (0.44 - 0.06) * 2 * math.pi;

    const start2 = rotation + (0.56 * 2 * math.pi);
    const sweep2 = (0.94 - 0.56) * 2 * math.pi;

    canvas.drawArc(rect, start1, sweep1, false, paint);
    canvas.drawArc(rect, start2, sweep2, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ApertureArcsPainter oldDelegate) {
    return oldDelegate.strokeWidth != strokeWidth;
  }
}
