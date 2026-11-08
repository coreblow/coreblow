import 'package:flutter/material.dart';

abstract final class StudioColors {
  // Unified Outer Shell (Topbar & Nav Rail form one seamless frame like Codex)
  static const bgWindow = Color(0xFF272929);
  static const bgTopbar = Color(0xFF272929);
  static const bgNavRail = Color(0xFF272929);

  // Inner Nested Surfaces (Card starts at x=40, y=35 with rounded top-left corner)
  static const bgSidebar = Color(0xFF09130F);
  static const bgCanvas = Color(0xFF09110F);
  static const bgComposer = Color(0xFF0B1916);
  static const bgNewChat = Color(0xFF0B1C18);

  static const borderComposer = Color(0x8C1A4138); // rgba(26, 65, 56, 0.55)
  static const borderCard = Color(0x2660D9CC);     // subtle cyan border
  static const borderSubtle = Color(0x1AFFFFFF);   // 10% white hairline

  static const accentMint = Color(0xFF60D9CC);
  static const accentEmerald = Color(0xFF10B981);
  static const accentCyan = Color(0xFF2ED4BF);
  static const accentSend = Color(0xFF168275);

  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0x8CFFFFFF); // 55%
  static const textMuted = Color(0x61FFFFFF);     // 38%
  static const textDark = Color(0xFF03080C);
}
