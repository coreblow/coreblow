import SwiftUI
struct SkillsSettings: View { @State private var skills: [Skill] = []
    var body: some View { List(skills) { skill in HStack { VStack(alignment: .leading) { Text(skill.name); Text(skill.description).font(.caption).foregroundStyle(.secondary) }; Spacer(); Toggle("", isOn: .constant(skill.isEnabled)) } }.navigationTitle("Skills") }
}
