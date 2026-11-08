import SwiftUI
import OSLog
import CoreBlowKit

// MARK: - Sovereign Provider API Keys & Config View

@MainActor
struct StudioAPIKeysAndConfigView: View {
    @Bindable var store: ChannelsStore
    @AppStorage("coreblow.custom.url") private var customUrl: String = ""
    @AppStorage("coreblow.custom.key") private var customKey: String = ""
    @AppStorage("coreblow.anthropic.key") private var anthropicKey: String = ""
    @AppStorage("coreblow.openai.key") private var openaiKey: String = ""
    @AppStorage("coreblow.gemini.key") private var geminiKey: String = ""
    @AppStorage("coreblow.groq.key") private var groqKey: String = ""
    @AppStorage("coreblow.ollama.url") private var ollamaUrl: String = "http://127.0.0.1:11434"
    @AppStorage("coreblow.studio.language") private var studioLanguage: String = "ID"
    @State private var showAdvancedJson: Bool = false

    private var isID: Bool { self.studioLanguage == "ID" }

    init(store: ChannelsStore = .shared) {
        self.store = store
    }

    var body: some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 20) {
                // Card 1: PROVIDER API KEYS & LOCAL ENDPOINTS
                VStack(alignment: .leading, spacing: 6) {
                    StudioSettingsCardHeader(self.isID ? "KUNCI API PENYEDIA & ENDPOINT MODEL" : "PROVIDER API KEYS & ENDPOINTS")
                    StudioSettingsCard {
                        StudioSettingsRow(
                            title: "Custom Base URL / 9Router Proxy",
                            subtitle: self.isID ? "URL basis API kustom (OpenAI-compatible) atau endpoint proxy 9Router lokal." : "Custom OpenAI-compatible base URL or local 9Router proxy endpoint."
                        ) {
                            TextField("http://127.0.0.1:20128/v1", text: self.$customUrl)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "Custom API Key / Bearer Token",
                            subtitle: self.isID ? "Token autentikasi untuk base URL kustom atau endpoint proxy." : "Authorization token for custom base URL or proxy endpoint."
                        ) {
                            SecureField("sk-...", text: self.$customKey)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "Anthropic Claude API Key",
                            subtitle: self.isID ? "Digunakan untuk penalaran arsitektural Tier 1 (Claude 3.7 Sonnet / Opus)." : "Used for Tier 1 architectural reasoning (Claude 3.7 Sonnet / Opus)."
                        ) {
                            SecureField("sk-ant-...", text: self.$anthropicKey)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "OpenAI GPT-4o / o1 API Key",
                            subtitle: self.isID ? "Digunakan untuk Tier 2 coding dan penalaran logika." : "Used for Tier 2 coding and logic reasoning."
                        ) {
                            SecureField("sk-proj-...", text: self.$openaiKey)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "Google Gemini 2.0 API Key",
                            subtitle: self.isID ? "Digunakan untuk Tier 3 konteks panjang dan pemahaman multimodal." : "Used for Tier 3 long-context and multimodal understanding."
                        ) {
                            SecureField("AIzaSy...", text: self.$geminiKey)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "Groq (Llama 3.3) API Key",
                            subtitle: self.isID ? "Inference berkecepatan ultra-tinggi untuk respons cepat." : "Ultra fast inference for rapid micro-responses."
                        ) {
                            SecureField("gsk_...", text: self.$groqKey)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }

                        StudioSettingsDivider()

                        StudioSettingsRow(
                            title: "Ollama Local Engine URL",
                            subtitle: self.isID ? "Endpoint model lokal di mesin ini tanpa memerlukan koneksi internet." : "Local engine endpoint on this machine without internet."
                        ) {
                            TextField("http://127.0.0.1:11434", text: self.$ollamaUrl)
                                .textFieldStyle(.plain)
                                .font(.system(size: 11, design: .monospaced))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06)))
                                .frame(width: 260)
                        }
                    }
                }

                // Card 2: ADVANCED JSON CONFIG EDITOR
                VStack(alignment: .leading, spacing: 6) {
                    DisclosureGroup(isExpanded: self.$showAdvancedJson) {
                        ConfigSettings(store: self.store)
                            .frame(minHeight: 400)
                            .padding(.top, 6)
                    } label: {
                        Text(self.isID ? "EDITOR KONFIGURASI JSON TINGKAT LANJUT" : "ADVANCED JSON CONFIG EDITOR")
                            .font(.system(size: 10.5, weight: .bold, design: .monospaced))
                            .foregroundStyle(Color.white.opacity(0.42))
                    }
                }
            }
            .padding(.horizontal, 22)
            .padding(.vertical, 16)
        }
    }
}

// MARK: - Legacy ConfigSettings

@MainActor
struct ConfigSettings: View {
    private let isPreview = ProcessInfo.processInfo.isPreview
    private let isNixMode = ProcessInfo.processInfo.isNixMode
    @Bindable var store: ChannelsStore
    @State private var hasLoaded = false
    @State private var activeSectionKey: String?
    @State private var activeSubsection: SubsectionSelection?

    init(store: ChannelsStore = .shared) {
        self.store = store
    }

    var body: some View {
        HStack(spacing: 16) {
            self.sidebar
            self.detail
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .task {
            guard !self.hasLoaded else { return }
            guard !self.isPreview else { return }
            self.hasLoaded = true
            await self.store.loadConfigSchema()
            await self.store.loadConfig()
        }
        .onAppear { self.ensureSelection() }
        .onChange(of: self.store.configSchemaLoading) { _, loading in
            if !loading { self.ensureSelection() }
        }
    }
}

extension ConfigSettings {
    private enum SubsectionSelection: Hashable {
        case all
        case key(String)
    }

    private struct ConfigSection: Identifiable {
        let key: String
        let label: String
        let help: String?
        let node: ConfigSchemaNode

        var id: String {
            self.key
        }
    }

    private struct ConfigSubsection: Identifiable {
        let key: String
        let label: String
        let help: String?
        let node: ConfigSchemaNode
        let path: ConfigPath

        var id: String {
            self.key
        }
    }

    private var sections: [ConfigSection] {
        guard let schema = self.store.configSchema else { return [] }
        return self.resolveSections(schema)
    }

    private var activeSection: ConfigSection? {
        self.sections.first { $0.key == self.activeSectionKey }
    }

    private var sidebar: some View {
        SettingsSidebarScroll {
            LazyVStack(alignment: .leading, spacing: 4) {
                if self.sections.isEmpty {
                    Text("No config sections available.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 4)
                } else {
                    ForEach(self.sections) { section in
                        self.sidebarSection(section)
                    }
                }
            }
        }
    }

    private var detail: some View {
        VStack(alignment: .leading, spacing: 16) {
            if self.store.configSchemaLoading {
                ProgressView().controlSize(.small)
            } else if let section = self.activeSection {
                self.sectionDetail(section)
            } else if self.store.configSchema != nil {
                self.emptyDetail
            } else {
                Text("Schema unavailable.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(minWidth: 460, maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var emptyDetail: some View {
        VStack(alignment: .leading, spacing: 8) {
            self.header
            Text("Select a config section to view settings.")
                .font(.callout)
                .foregroundStyle(.secondary)
        }
        .padding(.horizontal, 24)
        .padding(.vertical, 18)
    }

    private func sectionDetail(_ section: ConfigSection) -> some View {
        ScrollView(.vertical) {
            VStack(alignment: .leading, spacing: 16) {
                self.header
                if let status = self.store.configStatus {
                    Text(status)
                        .font(.callout)
                        .foregroundStyle(.secondary)
                }
                self.actionRow
                self.sectionHeader(section)
                self.sectionForm(section)
                if self.store.configDirty, !self.isNixMode {
                    Text("Unsaved changes")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.horizontal, 24)
            .padding(.vertical, 18)
            .groupBoxStyle(PlainSettingsGroupBoxStyle())
        }
    }

    @ViewBuilder
    private var header: some View {
        Text("Config")
            .font(.title3.weight(.semibold))
        Text(self.isNixMode
            ? "This tab is read-only in Nix mode. Edit config via Nix and rebuild."
            : "Edit ~/.coreblow/coreblow.json using the schema-driven form.")
            .font(.callout)
            .foregroundStyle(.secondary)
    }

    private func sectionHeader(_ section: ConfigSection) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(section.label)
                .font(.title3.weight(.semibold))
            if let help = section.help {
                Text(help)
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }

    private var actionRow: some View {
        HStack(spacing: 10) {
            Button("Reload") {
                Task { await self.store.reloadConfigDraft() }
            }
            .disabled(!self.store.configLoaded)

            Button(self.store.isSavingConfig ? "Saving…" : "Save") {
                Task { await self.store.saveConfigDraft() }
            }
            .disabled(self.isNixMode || self.store.isSavingConfig || !self.store.configDirty)
        }
        .buttonStyle(.bordered)
    }

    private func sidebarSection(_ section: ConfigSection) -> some View {
        let isExpanded = self.activeSectionKey == section.key
        let subsections = isExpanded ? self.resolveSubsections(for: section) : []

        return VStack(alignment: .leading, spacing: 2) {
            Button {
                self.selectSection(section)
            } label: {
                HStack(spacing: 6) {
                    Image(systemName: "chevron.right")
                        .font(.caption2.weight(.semibold))
                        .foregroundStyle(.tertiary)
                        .rotationEffect(.degrees(isExpanded ? 90 : 0))
                    Text(section.label)
                        .lineLimit(1)
                }
                .padding(.vertical, 5)
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isExpanded && subsections.isEmpty
                    ? Color.accentColor.opacity(0.18)
                    : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .contentShape(Rectangle())

            if isExpanded, !subsections.isEmpty {
                VStack(alignment: .leading, spacing: 1) {
                    self.sidebarSubRow(title: "All", key: nil, sectionKey: section.key)
                    ForEach(subsections) { sub in
                        self.sidebarSubRow(title: sub.label, key: sub.key, sectionKey: section.key)
                    }
                }
                .padding(.leading, 20)
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .animation(.easeInOut(duration: 0.18), value: isExpanded)
    }

    private func sidebarSubRow(title: String, key: String?, sectionKey: String) -> some View {
        let isSelected: Bool = {
            guard self.activeSectionKey == sectionKey else { return false }
            if let key { return self.activeSubsection == .key(key) }
            return self.activeSubsection == .all
        }()

        return Button {
            if let key {
                self.activeSubsection = .key(key)
            } else {
                self.activeSubsection = .all
            }
        } label: {
            Text(title)
                .font(.callout)
                .lineLimit(1)
                .padding(.vertical, 4)
                .padding(.horizontal, 8)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(isSelected ? Color.accentColor.opacity(0.18) : Color.clear)
                .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .contentShape(Rectangle())
    }

    private func sectionForm(_ section: ConfigSection) -> some View {
        let subsection = self.activeSubsection
        let defaultPath: ConfigPath = [.key(section.key)]
        let subsections = self.resolveSubsections(for: section)
        let resolved: (ConfigSchemaNode, ConfigPath) = {
            if case let .key(key) = subsection,
               let match = subsections.first(where: { $0.key == key })
            {
                return (match.node, match.path)
            }
            return (self.resolvedSchemaNode(section.node), defaultPath)
        }()

        return ConfigSchemaForm(store: self.store, schema: resolved.0, path: resolved.1)
            .disabled(self.isNixMode)
    }

    private func ensureSelection() {
        guard let schema = self.store.configSchema else { return }
        let sections = self.resolveSections(schema)
        guard !sections.isEmpty else { return }

        let active = sections.first { $0.key == self.activeSectionKey } ?? sections[0]
        if self.activeSectionKey != active.key {
            self.activeSectionKey = active.key
        }
        self.ensureSubsection(for: active)
    }

    private func ensureSubsection(for section: ConfigSection) {
        let subsections = self.resolveSubsections(for: section)
        guard !subsections.isEmpty else {
            self.activeSubsection = nil
            return
        }

        switch self.activeSubsection {
        case .all:
            return
        case let .key(key):
            if subsections.contains(where: { $0.key == key }) { return }
        case .none:
            break
        }

        if let first = subsections.first {
            self.activeSubsection = .key(first.key)
        }
    }

    private func selectSection(_ section: ConfigSection) {
        guard self.activeSectionKey != section.key else { return }
        self.activeSectionKey = section.key
        let subsections = self.resolveSubsections(for: section)
        if let first = subsections.first {
            self.activeSubsection = .key(first.key)
        } else {
            self.activeSubsection = nil
        }
    }

    private func resolveSections(_ root: ConfigSchemaNode) -> [ConfigSection] {
        let node = self.resolvedSchemaNode(root)
        let hints = self.store.configUiHints
        let keys = node.properties.keys.sorted { lhs, rhs in
            let orderA = hintForPath([.key(lhs)], hints: hints)?.order ?? 0
            let orderB = hintForPath([.key(rhs)], hints: hints)?.order ?? 0
            if orderA != orderB { return orderA < orderB }
            return lhs < rhs
        }

        return keys.compactMap { key in
            guard let child = node.properties[key] else { return nil }
            let path: ConfigPath = [.key(key)]
            let hint = hintForPath(path, hints: hints)
            let label = hint?.label
                ?? child.title
                ?? self.humanize(key)
            let help = hint?.help ?? child.description
            return ConfigSection(key: key, label: label, help: help, node: child)
        }
    }

    private func resolveSubsections(for section: ConfigSection) -> [ConfigSubsection] {
        let node = self.resolvedSchemaNode(section.node)
        guard node.schemaType == "object" else { return [] }
        let hints = self.store.configUiHints
        let keys = node.properties.keys.sorted { lhs, rhs in
            let orderA = hintForPath([.key(section.key), .key(lhs)], hints: hints)?.order ?? 0
            let orderB = hintForPath([.key(section.key), .key(rhs)], hints: hints)?.order ?? 0
            if orderA != orderB { return orderA < orderB }
            return lhs < rhs
        }

        return keys.compactMap { key in
            guard let child = node.properties[key] else { return nil }
            let path: ConfigPath = [.key(section.key), .key(key)]
            let hint = hintForPath(path, hints: hints)
            let label = hint?.label
                ?? child.title
                ?? self.humanize(key)
            let help = hint?.help ?? child.description
            return ConfigSubsection(
                key: key,
                label: label,
                help: help,
                node: child,
                path: path)
        }
    }

    private func resolvedSchemaNode(_ node: ConfigSchemaNode) -> ConfigSchemaNode {
        let variants = node.anyOf.isEmpty ? node.oneOf : node.anyOf
        if !variants.isEmpty {
            let nonNull = variants.filter { !$0.isNullSchema }
            if nonNull.count == 1, let only = nonNull.first { return only }
        }
        return node
    }

    private func humanize(_ key: String) -> String {
        key.replacingOccurrences(of: "_", with: " ")
            .replacingOccurrences(of: "-", with: " ")
            .capitalized
    }
}

struct ConfigSettings_Previews: PreviewProvider {
    static var previews: some View {
        ConfigSettings()
    }
}
