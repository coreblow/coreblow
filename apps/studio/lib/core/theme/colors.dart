import 'package:flutter/material.dart';

abstract final class StudioColors {
  // Latar (hijau hampir hitam, dari yang paling gelap ke yang sedikit lebih terang)
  // Window frame
  static const bgWindow = Color(0xFF08110F);
  static const borderWindow = Color(0xFF16322C);

  // Rail kiri (paling gelap)
  static const bgNavRail = Color(0xFF060E0C);
  static const borderNavRail = Color(0xFF12302A);
  static const bgNavHover = Color(0xFF0C201C);
  static const bgNavActive = Color(0xFF0F2B26);
  static const borderNavActive = Color(0xFF1F5148);

  // Bar atas (Topbar)
  static const bgTopbar = Color(0xFF08110F);
  static const iconDisabled = Color(0xFF3D5E56);

  // Sidebar
  static const bgSidebar = Color(0xFF09130F);
  static const borderSidebar = Color(0xFF12302A);
  static const bgChip = Color(0xFF10261F);
  static const borderChip = Color(0xFF1A3A33);
  static const bgNewChat = Color(0xFF0D1F1B);
  static const bgNewChatHover = Color(0xFF12302A);
  static const bgCard = Color(0xFF0A1815);
  static const borderCard = Color(0xFF16322C);

  // Area utama (Canvas)
  static const bgCanvas = Color(0xFF08110F);

  // Kotak ketik (Composer)
  static const bgComposer = Color(0xFF0B1916);
  static const borderComposer = Color(0xFF1A3A33);
  static const bgSendDisabled = Color(0xFF12302A);
  static const borderSendDisabled = Color(0xFF1F5148);
  static const arrowSendDisabled = Color(0xFF5E8F84);

  // Teks & Ikon (Tiga tingkat: Terang, Sedang, Redup)
  static const textPrimary = Color(0xFFD9FBF3);   // Terang
  static const textSecondary = Color(0xFF9CC4BA); // Sedang
  static const textMuted = Color(0xFF7FA99F);     // Redup
  static const textBody = Color(0xFF8FB5AB);      // Isi kartu & teks bantuan
  static const textChip = Color(0xFFC4E4DC);      // Teks chip (12 Services, Select folder)
  static const textDark = Color(0xFF04201B);      // Huruf avatar "FE"

  // Aksen Teal (hanya di satu titik per elemen)
  static const accentTeal = Color(0xFF2DD4BF);
  static const ringAvatar = Color(0xFF1F5148);

  // Tombol jendela macOS
  static const macRed = Color(0xFFFF5F57);
  static const macYellow = Color(0xFFFEBC2E);
  static const macGreen = Color(0xFF28C840);

  // Aliases for compatibility
  static const accentCyan = accentTeal;
  static const accentMint = textPrimary;
  static const accentEmerald = accentTeal;
  static const borderSubtle = borderSidebar;
  static const accentSend = arrowSendDisabled;
}
