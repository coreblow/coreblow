import Foundation; import Observation
@MainActor @Observable final class CronJobsStore {
    var jobs: [CronJob] = []
    func load() async { /* fetch from gateway */ }
    func toggle(id: String) { if let idx = jobs.firstIndex(where: { $0.id == id }) { jobs[idx].enabled.toggle() } }
    func delete(id: String) { jobs.removeAll { $0.id == id } }
}
