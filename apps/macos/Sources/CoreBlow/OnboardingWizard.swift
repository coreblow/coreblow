import SwiftUI
struct OnboardingWizard: View { @State private var step = 0
    var body: some View { VStack { ProgressView(value: Double(step), total: 3); Group { switch step { case 0: Text("Step 1: Configure Gateway"); case 1: Text("Step 2: Set Permissions"); case 2: Text("Step 3: Test Connection"); default: Text("Complete!") } }.frame(maxWidth: .infinity, maxHeight: .infinity); Button("Continue") { step += 1 }.buttonStyle(.borderedProminent).disabled(step > 2) }.padding() }
}
