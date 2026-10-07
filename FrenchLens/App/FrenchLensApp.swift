import SwiftUI

@main
struct FrenchLensApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @State private var environment: AppEnvironment

    init() {
        _environment = State(initialValue: AppEnvironment.makeDefault())
    }

    var body: some Scene {
        WindowGroup {
            RootView()
                .environment(environment)
                .environment(environment.settings)
                .environment(environment.store)
                .environment(environment.router)
                .environment(environment.ingest)
                .environment(environment.listen)
                .environment(\.tts, environment.tts)
                .preferredColorScheme(environment.settings.appearance.colorScheme)
                .tint(FLColor.accent)
                .motionEnvironment()
                .onOpenURL { environment.handle(url: $0) }
        }
    }
}
