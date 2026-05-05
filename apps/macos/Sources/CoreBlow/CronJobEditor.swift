import SwiftUI
struct CronJobEditor: View { @State var name = ""; @State var schedule = ""; @State var command = ""
    var body: some View { Form { TextField("Name", text: $name); TextField("Schedule", text: $schedule); TextField("Command", text: $command) } }
}
