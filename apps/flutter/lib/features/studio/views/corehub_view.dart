import 'package:flutter/material.dart';
import '../../../core/theme/colors.dart';
import '../../../core/widgets/coreblow_icons.dart';
import '../view_models/studio_view_model.dart';

class CoreHubModuleItem {
  const CoreHubModuleItem({
    required this.id,
    required this.name,
    required this.slug,
    required this.description,
    required this.assetPng,
    required this.category,
    required this.tier,
    required this.statusText,
    required this.isInstalled,
    required this.hasUpdate,
    this.score,
  });

  final String id;
  final String name;
  final String slug;
  final String description;
  final String assetPng;
  final String category;
  final String tier;
  final String statusText;
  final bool isInstalled;
  final bool hasUpdate;
  final double? score;
}

const List<CoreHubModuleItem> kCoreHubModules = [
  CoreHubModuleItem(
    id: 'studio',
    name: 'CoreBlow Studio',
    slug: 'studio',
    description: 'Ruang kerja asisten AI interaktif dengan canvas visual, chat, dan kontrol berkas repo.',
    assetPng: 'assets/icons/png/coreblow-studio-1024.png',
    category: 'dev_tools',
    tier: 'Resmi',
    statusText: 'Terpasang • v2.0 GA',
    isInstalled: true,
    hasUpdate: false,
  ),
  CoreHubModuleItem(
    id: 'companion-bar',
    name: 'Companion Bar',
    slug: 'companion-bar',
    description: 'Bilah pintasan cepat sistem macOS (⌥Space) dengan deteksi konteks window aplikasi aktif.',
    assetPng: 'assets/icons/png/companion-bar-1024.png',
    category: 'dev_tools',
    tier: 'Resmi',
    statusText: 'Terpasang • ⌥Space',
    isInstalled: true,
    hasUpdate: false,
  ),
  CoreHubModuleItem(
    id: 'cory-memory',
    name: 'Cory 4-Layer Memory',
    slug: 'cory-memory',
    description: 'Kernel memori jangka panjang SQLite WAL + BM25 untuk mengingat instruksi dan konteks user.',
    assetPng: 'assets/icons/png/cory-memory-1024.png',
    category: 'memory_wiki',
    tier: 'Resmi',
    statusText: 'Pembaruan Siap • v2.0.1',
    isInstalled: true,
    hasUpdate: true,
  ),
  CoreHubModuleItem(
    id: 'evoloop',
    name: 'EvoLoop Synthesizer',
    slug: 'evoloop',
    description: 'Sintesis kemampuan otomatis berdasarkan hasil interaksi dan evaluasi loop tertutup.',
    assetPng: 'assets/icons/png/evoloop-1024.png',
    category: 'smart_skills',
    tier: 'Resmi',
    statusText: 'Terpasang • v2.0 GA',
    isInstalled: true,
    hasUpdate: false,
  ),
  CoreHubModuleItem(
    id: 'mcp-bridge',
    name: 'MCP Bridge',
    slug: 'mcp-bridge',
    description: 'Jembatan Model Context Protocol untuk menghubungkan tools, schema, dan servis eksternal.',
    assetPng: 'assets/icons/png/mcp-bridge-1024.png',
    category: 'bridges',
    tier: 'Resmi',
    statusText: 'Resmi • Siap Pasang',
    isInstalled: false,
    hasUpdate: false,
  ),
  CoreHubModuleItem(
    id: 'discord-bot',
    name: 'Discord Bot',
    slug: 'discord-bot',
    description: 'Integrasi bot percakapan untuk server Discord, channel suara, dan webhook otomatis.',
    assetPng: 'assets/icons/png/discord-bot-1024.png',
    category: 'bridges',
    tier: 'Resmi',
    statusText: 'Resmi • Siap Pasang',
    isInstalled: false,
    hasUpdate: false,
  ),
  CoreHubModuleItem(
    id: 'git-supercharged',
    name: 'Git Supercharged',
    slug: 'git-supercharged',
    description: 'Alur kerja git cerdas, resolusi konflik otomatis, dan manajemen branch super cepat.',
    assetPng: 'assets/icons/png/git-supercharged-1024.png',
    category: 'smart_skills',
    tier: 'Komunitas',
    statusText: 'Komunitas • Skor 0.98',
    isInstalled: false,
    hasUpdate: false,
    score: 0.98,
  ),
];

class StudioCoreHubView extends StatefulWidget {
  const StudioCoreHubView({
    super.key,
    required this.viewModel,
    this.initialShowSpecSheet = false,
  });

  final StudioViewModel viewModel;
  final bool initialShowSpecSheet;

  @override
  State<StudioCoreHubView> createState() => _StudioCoreHubViewState();
}

class _StudioCoreHubViewState extends State<StudioCoreHubView> {
  String _selectedCategory = 'all';
  String _searchQuery = '';
  late bool _showSpecSheet = widget.initialShowSpecSheet;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: StudioColors.bgCanvas, // #08110F
      child: Row(
        children: [
          // Left Sidebar: 11 Quiet Instrument Categories
          _buildSidebar(),

          // Center: Main Store Grid or Spec Sheet
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildHeader(),
                Expanded(
                  child: _showSpecSheet ? _buildSpecSheet() : _buildModulesList(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      width: 210,
      decoration: const BoxDecoration(
        color: StudioColors.bgSidebar, // #09130F
        border: Border(
          right: BorderSide(
            color: StudioColors.borderSidebar, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Column(
        children: [
          // Search Input
          Padding(
            padding: const EdgeInsets.fromLTRB(10, 10, 10, 8),
            child: Container(
              height: 30,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              decoration: BoxDecoration(
                color: StudioColors.bgCard, // #0A1815
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: StudioColors.borderCard, // #16322C
                  width: 0.8,
                ),
              ),
              child: Row(
                children: [
                  const CoreBlowIcon.search(
                    size: 14,
                    color: StudioColors.textSecondary,
                    accentColor: StudioColors.accentTeal,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      onChanged: (val) => setState(() => _searchQuery = val.toLowerCase()),
                      style: const TextStyle(color: StudioColors.textPrimary, fontSize: 11),
                      cursorColor: StudioColors.accentTeal,
                      decoration: const InputDecoration(
                        isDense: true,
                        hintText: 'Cari fitur & modul...',
                        hintStyle: TextStyle(
                          color: StudioColors.textMuted, // #7FA99F
                          fontSize: 11,
                        ),
                        border: InputBorder.none,
                        contentPadding: EdgeInsets.zero,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Category List (11 Quiet Instrument Icons)
          Expanded(
            child: ListView(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
              children: [
                _categoryItem(
                  id: 'all',
                  label: 'Semua Fitur',
                  icon: const CoreBlowIcon.grid(size: 14),
                  count: kCoreHubModules.length,
                ),
                _categoryItem(
                  id: 'updates',
                  label: 'Pembaruan',
                  icon: const CoreBlowIcon.refresh(size: 14),
                  badgeText: '1',
                  badgeColor: StudioColors.accentTeal,
                ),
                _categoryItem(
                  id: 'installed',
                  label: 'Terpasang di Mac',
                  icon: const CoreBlowIcon.shieldCheck(size: 14),
                  count: 4,
                ),
                const SizedBox(height: 6),
                const Padding(
                  padding: EdgeInsets.fromLTRB(8, 4, 8, 4),
                  child: Text(
                    'KATEGORI MODUL',
                    style: TextStyle(
                      color: StudioColors.textMuted, // #7FA99F
                      fontSize: 9.5,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.8,
                      fontFamily: 'monospace',
                    ),
                  ),
                ),
                _categoryItem(
                  id: 'agents',
                  label: 'Asisten & Agen AI',
                  icon: const CoreBlowIcon.bot(size: 14),
                ),
                _categoryItem(
                  id: 'smart_skills',
                  label: 'Kemampuan Pintar',
                  icon: const CoreBlowIcon.sparkle(size: 14),
                  count: 2,
                ),
                _categoryItem(
                  id: 'dev_tools',
                  label: 'Alat Pengembang',
                  icon: const CoreBlowIcon.code(size: 14),
                  count: 2,
                ),
                _categoryItem(
                  id: 'bridges',
                  label: 'Integrasi & Jembatan',
                  icon: const CoreBlowIcon.bridge(size: 14),
                  count: 2,
                ),
                _categoryItem(
                  id: 'memory_wiki',
                  label: 'Memori & Wiki',
                  icon: const CoreBlowIcon.layers(size: 14),
                  count: 1,
                ),
                _categoryItem(
                  id: 'docs_sdk',
                  label: 'Dokumentasi SDK',
                  icon: const CoreBlowIcon.fileText(size: 14),
                ),
              ],
            ),
          ),

          // Bottom Action: Buat Plugin Baru
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              border: Border(
                top: BorderSide(
                  color: StudioColors.borderSidebar, // #12302A
                  width: 0.5,
                ),
              ),
            ),
            child: InkWell(
              onTap: () {},
              borderRadius: BorderRadius.circular(6),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 7),
                child: Row(
                  children: const [
                    CoreBlowIcon.plusDashed(
                      size: 15,
                      color: StudioColors.textSecondary,
                      accentColor: StudioColors.accentTeal,
                    ),
                    SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Buat Plugin Baru',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: StudioColors.textPrimary, // #D9FBF3
                          fontSize: 11.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _categoryItem({
    required String id,
    required String label,
    required Widget icon,
    int? count,
    String? badgeText,
    Color? badgeColor,
  }) {
    final isSelected = _selectedCategory == id && !_showSpecSheet;
    return InkWell(
      onTap: () {
        setState(() {
          _selectedCategory = id;
          _showSpecSheet = false;
        });
      },
      borderRadius: BorderRadius.circular(6),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? StudioColors.bgNavActive : Colors.transparent, // #0F2B26
          borderRadius: BorderRadius.circular(6),
          border: isSelected ? Border.all(color: StudioColors.borderNavActive, width: 0.8) : null, // #1F5148
        ),
        child: Row(
          children: [
            icon,
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                label,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: isSelected ? StudioColors.textPrimary : StudioColors.textSecondary, // #D9FBF3 / #9CC4BA
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
            if (badgeText != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: (badgeColor ?? StudioColors.accentTeal).withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(
                    color: badgeColor ?? StudioColors.accentTeal,
                    fontSize: 9.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              )
            else if (count != null)
              Text(
                '$count',
                style: const TextStyle(
                  color: StudioColors.textMuted, // #7FA99F
                  fontSize: 10,
                  fontFamily: 'monospace',
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: const EdgeInsets.fromLTRB(16, 10, 16, 10),
      decoration: const BoxDecoration(
        color: StudioColors.bgCanvas, // #08110F
        border: Border(
          bottom: BorderSide(
            color: StudioColors.borderSidebar, // #12302A
            width: 0.5,
          ),
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    const Text(
                      'COREHUB STORE',
                      style: TextStyle(
                        color: StudioColors.accentTeal, // #2DD4BF
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                        fontFamily: 'monospace',
                      ),
                    ),
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 4.5, vertical: 1),
                      decoration: BoxDecoration(
                        color: StudioColors.bgChip, // #10261F
                        borderRadius: BorderRadius.circular(4),
                        border: Border.all(
                          color: StudioColors.borderChip, // #1A3A33
                          width: 0.8,
                        ),
                      ),
                      child: const Text(
                        'v2.0',
                        style: TextStyle(
                          color: StudioColors.textSecondary, // #9CC4BA
                          fontSize: 8.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                const Text(
                  'Ekosistem & Modul Aplikasi',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: StudioColors.textPrimary, // #D9FBF3
                    fontSize: 13.5,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),

          // System Specifications pill (compact)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: StudioColors.bgCard, // #0A1815
              borderRadius: BorderRadius.circular(5),
              border: Border.all(
                color: StudioColors.borderCard, // #16322C
                width: 0.8,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                _specBadge('24×24', ''),
                const SizedBox(width: 6),
                _specBadge('1.75', ''),
                const SizedBox(width: 6),
                _specBadge('#2DD4BF', '', color: StudioColors.accentTeal),
              ],
            ),
          ),
          const SizedBox(width: 8),

          // Toggle View Button (Store vs Spec Sheet)
          InkWell(
            onTap: () => setState(() => _showSpecSheet = !_showSpecSheet),
            borderRadius: BorderRadius.circular(6),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 5),
              decoration: BoxDecoration(
                color: _showSpecSheet ? StudioColors.bgNavActive : StudioColors.bgCard,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: _showSpecSheet ? StudioColors.borderNavActive : StudioColors.borderCard,
                  width: 0.8,
                ),
              ),
              child: Row(
                children: [
                  CoreBlowIcon.sparkle(
                    size: 13,
                    color: _showSpecSheet ? StudioColors.textPrimary : StudioColors.textSecondary,
                    accentColor: StudioColors.accentTeal,
                  ),
                  const SizedBox(width: 6),
                  Text(
                    _showSpecSheet ? 'Lihat Toko' : 'Sistem Ikon',
                    style: TextStyle(
                      color: _showSpecSheet ? StudioColors.textPrimary : StudioColors.textSecondary,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _specBadge(String label, String value, {Color? color}) {
    return Row(
      children: [
        Text(
          '$label ',
          style: const TextStyle(
            color: StudioColors.textMuted,
            fontSize: 9,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
        ),
        if (value.isNotEmpty)
          Text(
            value,
            style: TextStyle(
              color: color ?? StudioColors.textSecondary,
              fontSize: 9,
              fontWeight: FontWeight.bold,
              fontFamily: 'monospace',
            ),
          ),
      ],
    );
  }

  Widget _buildModulesList() {
    final filtered = kCoreHubModules.where((item) {
      if (_searchQuery.isNotEmpty) {
        return item.name.toLowerCase().contains(_searchQuery) ||
            item.description.toLowerCase().contains(_searchQuery) ||
            item.slug.toLowerCase().contains(_searchQuery);
      }
      if (_selectedCategory == 'installed') return item.isInstalled;
      if (_selectedCategory == 'updates') return item.hasUpdate;
      if (_selectedCategory == 'dev_tools') return item.category == 'dev_tools';
      if (_selectedCategory == 'smart_skills') return item.category == 'smart_skills';
      if (_selectedCategory == 'bridges') return item.category == 'bridges';
      if (_selectedCategory == 'memory_wiki') return item.category == 'memory_wiki';
      return true;
    }).toList();

    return ListView.separated(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
      itemCount: filtered.length,
      separatorBuilder: (context, index) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = filtered[index];
        return _HorizontalModuleRow(item: item);
      },
    );
  }

  Widget _buildSpecSheet() {
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        // Title & Philosophy
        const Text(
          'Sistem Ikon (Quiet Instrument)',
          style: TextStyle(
            color: StudioColors.textPrimary, // #D9FBF3
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        const Text(
          'Satu bahasa visual untuk seluruh aplikasi: garis 1.75 px, ujung membulat, dan satu aksen teal (#2DD4BF) per ikon.',
          style: TextStyle(
            color: StudioColors.textBody, // #8FB5AB
            fontSize: 11.5,
          ),
        ),
        const SizedBox(height: 18),

        // SECTION 1: RAIL NAVIGASI (6 IKON)
        _sectionHeader('RAIL NAVIGASI', '6 IKON'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: const [
            _IconSpecTile(icon: CoreBlowIcon.chat(size: 24), name: 'Obrolan', slug: 'chat'),
            _IconSpecTile(icon: CoreBlowIcon.history(size: 24), name: 'Riwayat', slug: 'history'),
            _IconSpecTile(icon: CoreBlowIcon.package(size: 24), name: 'Toko Ekosistem', slug: 'package'),
            _IconSpecTile(icon: CoreBlowIcon.people(size: 24), name: 'Orang', slug: 'people'),
            _IconSpecTile(icon: CoreBlowIcon.book(size: 24), name: 'Pustaka', slug: 'book'),
            _IconSpecTile(icon: CoreBlowIcon.branch(size: 24), name: 'Cabang Git', slug: 'branch'),
          ],
        ),

        const SizedBox(height: 24),

        // SECTION 2: SIDEBAR (11 IKON)
        _sectionHeader('SIDEBAR', '11 IKON'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: const [
            _IconSpecTile(icon: CoreBlowIcon.search(size: 24), name: 'Cari', slug: 'search'),
            _IconSpecTile(icon: CoreBlowIcon.grid(size: 24), name: 'Semua Fitur', slug: 'grid'),
            _IconSpecTile(icon: CoreBlowIcon.refresh(size: 24), name: 'Pembaruan', slug: 'refresh'),
            _IconSpecTile(icon: CoreBlowIcon.shieldCheck(size: 24), name: 'Terpasang di Mac', slug: 'shield-check'),
            _IconSpecTile(icon: CoreBlowIcon.bot(size: 24), name: 'Asisten & Agen AI', slug: 'bot'),
            _IconSpecTile(icon: CoreBlowIcon.sparkle(size: 24), name: 'Kemampuan Pintar', slug: 'sparkle'),
            _IconSpecTile(icon: CoreBlowIcon.code(size: 24), name: 'Alat Pengembang', slug: 'code'),
            _IconSpecTile(icon: CoreBlowIcon.bridge(size: 24), name: 'Integrasi & Jembatan', slug: 'bridge'),
            _IconSpecTile(icon: CoreBlowIcon.layers(size: 24), name: 'Memori & Wiki', slug: 'layers'),
            _IconSpecTile(icon: CoreBlowIcon.fileText(size: 24), name: 'Dokumentasi SDK', slug: 'file-text'),
            _IconSpecTile(icon: CoreBlowIcon.plusDashed(size: 24), name: 'Buat Plugin Baru', slug: 'plus-dashed'),
          ],
        ),

        const SizedBox(height: 24),

        // SECTION 3: MODUL APLIKASI (7 IKON)
        _sectionHeader('MODUL APLIKASI', '7 IKON'),
        const SizedBox(height: 10),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: kCoreHubModules.map((m) {
            return _AppModuleSpecTile(
              assetPng: m.assetPng,
              name: m.name,
              slug: m.slug,
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _sectionHeader(String title, String count) {
    return Row(
      children: [
        Text(
          title,
          style: const TextStyle(
            color: StudioColors.textPrimary, // #D9FBF3
            fontSize: 10.5,
            fontWeight: FontWeight.bold,
            letterSpacing: 1,
            fontFamily: 'monospace',
          ),
        ),
        const SizedBox(width: 8),
        Text(
          count,
          style: const TextStyle(
            color: StudioColors.textMuted, // #7FA99F
            fontSize: 10,
            fontFamily: 'monospace',
          ),
        ),
      ],
    );
  }
}

class _HorizontalModuleRow extends StatefulWidget {
  const _HorizontalModuleRow({required this.item});

  final CoreHubModuleItem item;

  @override
  State<_HorizontalModuleRow> createState() => _HorizontalModuleRowState();
}

class _HorizontalModuleRowState extends State<_HorizontalModuleRow> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 140),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: _isHovered
              ? const Color(0xFF0D1F1B)
              : StudioColors.bgCard, // #0A1815
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: _isHovered
                ? const Color(0xFF1F5148)
                : (item.hasUpdate
                    ? StudioColors.borderNavActive // #1F5148
                    : StudioColors.borderCard),     // #16322C
            width: 0.8,
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Left: 40x40 squircle module icon
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.asset(
                item.assetPng,
                width: 40,
                height: 40,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) => Container(
                  width: 40,
                  height: 40,
                  color: const Color(0xFF143F37),
                  child: const Icon(
                    Icons.apps_rounded,
                    color: StudioColors.accentTeal,
                    size: 20,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 14),

            // Middle: Name + Tier + Slug (top) and Description (bottom)
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          item.name,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: StudioColors.textPrimary, // #D9FBF3
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                        decoration: BoxDecoration(
                          color: StudioColors.bgChip, // #10261F
                          borderRadius: BorderRadius.circular(4),
                          border: Border.all(
                            color: StudioColors.borderChip, // #1A3A33
                            width: 0.8,
                          ),
                        ),
                        child: Text(
                          item.tier,
                          style: const TextStyle(
                            color: StudioColors.textSecondary, // #9CC4BA
                            fontSize: 8.5,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Flexible(
                        child: Text(
                          item.slug,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: StudioColors.accentTeal, // #2DD4BF
                            fontSize: 10,
                            fontFamily: 'monospace',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.description,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: StudioColors.textBody, // #8FB5AB
                      fontSize: 11,
                      height: 1.25,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 16),

            // Right: Status dot + status text, and Action Button
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: item.hasUpdate
                        ? StudioColors.accentTeal
                        : (item.isInstalled
                            ? const Color(0xFF28C840) // macOS green
                            : StudioColors.textMuted),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 6),
                Text(
                  item.statusText,
                  style: TextStyle(
                    color: item.hasUpdate
                        ? StudioColors.accentTeal
                        : StudioColors.textSecondary,
                    fontSize: 10.5,
                    fontWeight: item.hasUpdate ? FontWeight.bold : FontWeight.normal,
                  ),
                ),
                const SizedBox(width: 14),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                  decoration: BoxDecoration(
                    color: item.hasUpdate
                        ? StudioColors.accentTeal // #2DD4BF
                        : StudioColors.bgChip,    // #10261F
                    borderRadius: BorderRadius.circular(5),
                    border: Border.all(
                      color: item.hasUpdate
                          ? StudioColors.accentTeal
                          : StudioColors.borderChip, // #1A3A33
                      width: 0.8,
                    ),
                  ),
                  child: Text(
                    item.hasUpdate
                        ? 'Perbarui'
                        : (item.isInstalled ? 'Buka' : 'Pasang'),
                    style: TextStyle(
                      color: item.hasUpdate
                          ? StudioColors.textDark     // #04201B
                          : StudioColors.textPrimary, // #D9FBF3
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _IconSpecTile extends StatelessWidget {
  const _IconSpecTile({
    required this.icon,
    required this.name,
    required this.slug,
  });

  final Widget icon;
  final String name;
  final String slug;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 96,
      height: 104,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(
        color: StudioColors.bgCard, // #0A1815
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: StudioColors.borderCard, // #16322C
          width: 0.8,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          icon,
          const SizedBox(height: 6),
          Text(
            name,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: StudioColors.textPrimary, // #D9FBF3
              fontSize: 10,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            slug,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: StudioColors.textMuted, // #7FA99F
              fontSize: 8.5,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}

class _AppModuleSpecTile extends StatelessWidget {
  const _AppModuleSpecTile({
    required this.assetPng,
    required this.name,
    required this.slug,
  });

  final String assetPng;
  final String name;
  final String slug;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 110,
      height: 116,
      padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 6),
      decoration: BoxDecoration(
        color: StudioColors.bgCard, // #0A1815
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: StudioColors.borderCard, // #16322C
          width: 0.8,
        ),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: Image.asset(
              assetPng,
              width: 44,
              height: 44,
              fit: BoxFit.cover,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            name,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: StudioColors.textPrimary, // #D9FBF3
              fontSize: 10,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            slug,
            textAlign: TextAlign.center,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
              color: StudioColors.textMuted, // #7FA99F
              fontSize: 8.5,
              fontFamily: 'monospace',
            ),
          ),
        ],
      ),
    );
  }
}
