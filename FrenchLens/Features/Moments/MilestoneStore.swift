import Foundation
import Observation

/// An earned moment.
struct UnlockedMilestone: Codable, Equatable, Identifiable {
    var milestone: Milestone
    var date: Date
    /// The learner's own detail: what they said, the lesson's title…
    var detail: String

    var id: String { milestone.rawValue }
}

/// Records what the learner has earned and queues celebrations until a
/// natural pause: never mid-conversation or over the processing screen.
@MainActor
@Observable
final class MilestoneStore {
    private(set) var unlocked: [Milestone: UnlockedMilestone] = [:]
    /// Earned but not yet celebrated, oldest first.
    private(set) var pending: [UnlockedMilestone] = []
    /// Features that must not be interrupted (a conversation in progress).
    private(set) var holds: Set<String> = []

    /// Celebrations are off in UI tests unless asked for, so they never
    /// cover what a test is tapping.
    @ObservationIgnored let isEnabled: Bool
    @ObservationIgnored private let defaults: UserDefaults
    @ObservationIgnored private var activeDays: Set<String>

    private enum Keys {
        static let unlocked = "milestones.unlocked"
        static let activeDays = "milestones.activeDays"
    }

    init(defaults: UserDefaults = .standard, isEnabled: Bool = true) {
        self.defaults = defaults
        self.isEnabled = isEnabled
        if let data = defaults.data(forKey: Keys.unlocked),
           let saved = try? JSONDecoder().decode([UnlockedMilestone].self, from: data) {
            unlocked = Dictionary(saved.map { ($0.milestone, $0) }, uniquingKeysWith: { first, _ in first })
        }
        activeDays = Set(defaults.stringArray(forKey: Keys.activeDays) ?? [])
    }

    var isHeld: Bool { !holds.isEmpty }
    var next: UnlockedMilestone? { pending.first }

    /// In order of the milestone list, for the gallery.
    var all: [(milestone: Milestone, unlocked: UnlockedMilestone?)] {
        Milestone.allCases.map { ($0, unlocked[$0]) }
    }

    func record(_ event: MilestoneEvent, now: Date = Date()) {
        let earned = MilestoneRules.unlocks(for: event, alreadyUnlocked: Set(unlocked.keys))
        guard !earned.isEmpty else { return }
        for (milestone, detail) in earned {
            let moment = UnlockedMilestone(milestone: milestone, date: now, detail: detail)
            unlocked[milestone] = moment
            if isEnabled { pending.append(moment) }
        }
        save()
    }

    /// Counts the days FrenchLens was used (no streak to lose).
    func recordActiveDay(_ date: Date = Date(), calendar: Calendar = .current) {
        let parts = calendar.dateComponents([.year, .month, .day], from: date)
        let key = String(format: "%04d-%02d-%02d", parts.year ?? 0, parts.month ?? 0, parts.day ?? 0)
        guard !activeDays.contains(key) else { return }
        activeDays.insert(key)
        defaults.set(Array(activeDays.sorted().suffix(60)), forKey: Keys.activeDays)
        record(.activeDays(count: activeDays.count), now: date)
    }

    func dismissCurrent() {
        guard !pending.isEmpty else { return }
        pending.removeFirst()
    }

    func hold(_ key: String) { holds.insert(key) }
    func release(_ key: String) { holds.remove(key) }

    func reset() {
        unlocked = [:]
        pending = []
        activeDays = []
        defaults.removeObject(forKey: Keys.unlocked)
        defaults.removeObject(forKey: Keys.activeDays)
    }

    private func save() {
        let list = Array(unlocked.values).sorted { $0.date < $1.date }
        if let data = try? JSONEncoder().encode(list) {
            defaults.set(data, forKey: Keys.unlocked)
        }
    }
}
