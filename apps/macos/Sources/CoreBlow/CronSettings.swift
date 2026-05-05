import SwiftUI
struct CronSettings: View { @State private var store = CronJobsStore()
    var body: some View { List(store.jobs) { job in HStack { Toggle(job.name, isOn: Binding(get: { job.enabled }, set: { _ in store.toggle(id: job.id) })); Spacer(); Text(job.schedule).font(.caption.monospaced()) } }.navigationTitle("Cron Jobs").task { await store.load() } }
}
