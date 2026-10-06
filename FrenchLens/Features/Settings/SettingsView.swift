import SwiftUI
import UserNotifications

struct SettingsView: View {
    @Environment(AppEnvironment.self) private var environment
    @Environment(AppSettings.self) private var settings
    @Environment(AppRouter.self) private var router

    @State private var notificationStatus: UNAuthorizationStatus = .notDetermined
    @State private var isConfirmingReset = false

    var body: some View {
        @Bindable var settings = settings

        NavigationStack {
            Form {
                Section {
                    Picker("Level", selection: $settings.level) {
                        ForEach(CEFRLevel.allCases) { level in
                            VStack(alignment: .leading, spacing: 2) {
                                Text("\(level.rawValue) · \(level.title)")
                                    .font(.body.weight(.medium))
                                Text(level.explanationStyle)
                                    .font(.footnote)
                                    .foregroundStyle(FLColor.textSecondary)
                            }
                            .tag(level)
                            .accessibilityIdentifier("level.\(level.rawValue)")
                        }
                    }
                    .pickerStyle(.inline)
                    .labelsHidden()
                } header: {
                    Text("Your level")
                } footer: {
                    Text("Every explanation adapts to this level.")
                }

                Section {
                    Toggle("Demo Mode", isOn: Binding(
                        get: { environment.aiFactory.isDemoMode },
                        set: { settings.demoModeEnabled = $0 }
                    ))
                    .disabled(!environment.apiConfiguration.isConfigured)
                    .accessibilityIdentifier("demoModeToggle")

                    LabeledContent("Backend") {
                        Text(environment.apiConfiguration.baseURL?.host ?? "Not configured")
                            .foregroundStyle(FLColor.textSecondary)
                    }
                } header: {
                    Text("Analysis")
                } footer: {
                    Text(environment.apiConfiguration.isConfigured
                         ? "Turn Demo Mode off to analyse your own videos with the FrenchLens backend."
                         : "No backend is configured, so FrenchLens uses built-in sample lessons. Set FRENCHLENS_API_BASE_URL to connect one.")
                }

                Section("Appearance") {
                    Picker("Appearance", selection: $settings.appearance) {
                        ForEach(Appearance.allCases) { appearance in
                            Text(appearance.title).tag(appearance)
                        }
                    }
                    .pickerStyle(.segmented)
                    .labelsHidden()
                }

                Section {
                    Button {
                        router.isShowingHowItWorks = true
                    } label: {
                        Label("How sharing works", systemImage: "square.and.arrow.up")
                    }
                    notificationRow
                } header: {
                    Text("Sharing")
                } footer: {
                    Text("iOS doesn't let share extensions open apps. With notifications on, FrenchLens can tap you on the shoulder when a shared video is ready.")
                }

                Section {
                    Button("Reset library", role: .destructive) {
                        isConfirmingReset = true
                    }
                    .confirmationDialog("Delete all lessons and media?", isPresented: $isConfirmingReset, titleVisibility: .visible) {
                        Button("Delete everything", role: .destructive) { environment.resetLibrary() }
                    }
                } footer: {
                    Text("FrenchLens \(Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "") · Lessons are stored on this iPhone.")
                }
            }
            .scrollContentBackground(.hidden)
            .background(FLColor.background.ignoresSafeArea())
            .navigationTitle("Settings")
            .task { await refreshNotificationStatus() }
        }
    }

    @ViewBuilder
    private var notificationRow: some View {
        switch notificationStatus {
        case .authorized, .provisional, .ephemeral:
            Label("Share notifications on", systemImage: "bell.badge")
                .foregroundStyle(FLColor.textSecondary)
        case .denied:
            Label("Notifications are off in iOS Settings", systemImage: "bell.slash")
                .foregroundStyle(FLColor.textSecondary)
        default:
            Button {
                Task {
                    _ = try? await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound])
                    await refreshNotificationStatus()
                }
            } label: {
                Label("Notify me when a share is ready", systemImage: "bell")
            }
        }
    }

    private func refreshNotificationStatus() async {
        notificationStatus = await UNUserNotificationCenter.current().notificationSettings().authorizationStatus
    }
}
