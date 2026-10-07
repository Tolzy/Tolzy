# FrenchLens

**Turn the French you scroll past into lessons.**

FrenchLens is an iOS prototype for French learners (CEFR A1–B2, tuned for A1/A2). You find a French Reel, TikTok or Short, tap **Share → FrenchLens**, and the app turns it into a lesson: what was said, what it means, and what's worth learning (vocabulary, verbs and their conjugations, expressions, grammar, pronunciation).

The core loop: **Find French video → Share → FrenchLens → Understand → Learn**

- Swift, SwiftUI, async/await, Observation (`@Observable`), iOS 17+
- A real Share Extension target (`NSExtensionContext` / `NSExtensionItem` / `NSItemProvider` / `UTType` / App Groups)
- Builds real lessons **on the iPhone**: Apple speech recognition (French) + Apple Intelligence (Foundation Models, iOS 26+). No server, no API keys
- Falls back to **sample lessons** (Demo) on older iOS or in UI tests

---

## 1. Architecture summary

```
┌──────────────────────────┐   App Group container    ┌──────────────────────────────┐
│ Share Extension          │   Inbox/<id>/payload.json │ FrenchLens app               │
│  ShareViewController     │ ───────────────────────▶ │  IngestCoordinator           │
│  ShareItemParser         │   Inbox/<id>/<media>      │   └ ContentResolver          │
│   (NSItemProvider → caps)│                           │   └ MediaProcessing          │
│  ShareInbox.save         │   local notification      │   └ AIService (Demo/Remote)  │
│  ShareNotifications      │ ──── (optional) ────────▶ │  LessonStore → Lesson UI     │
└──────────────────────────┘                           └──────────────────────────────┘
```

**Ingestion is built on capabilities, not on assumptions.** Each share is parsed into whatever was actually provided:

| Capability     | Model          | Notes                                                    |
| -------------- | -------------- | -------------------------------------------------------- |
| `video`        | `SharedVideo`  | File copied into the App Group inbox                     |
| `audio`        | `SharedAudio`  | File copied into the App Group inbox                     |
| `url`          | `SharedURL`    | Normalised (tracking params stripped). Provenance only.  |
| `text`         | `SharedText`   | Captions, copied French; links inside are extracted      |
| `image`        | `SharedImage`  | Recorded; not yet learnable                              |

`ContentResolver` picks the best input in the order **video › audio › URL › text › image**, keeping the link alongside media when both arrive. A link is never "upgraded" into media: if only a URL arrives, the app says so honestly (*"We received the Reel link, but couldn't access its audio."*) and offers **Add video** (PhotosPicker). An uploaded video is attached to the original link.

**Layers** (each folder has one job, so the UI can be rebuilt from Figma without touching logic):

| Layer | Location | Contents |
| --- | --- | --- |
| Design system | `Shared/DesignSystem` | Colour, typography, spacing, radius, motion, elevation tokens; brand primitives. Shared with the extension. |
| Components | `FrenchLens/Components` | `FrenchText`, `TranslationBlock`, `VocabularyRow`, `VerbCard`, `ExpressionCard`, `GrammarSection`, `LessonHeader`, `VideoHero`, `TranscriptView`, `WordPopover`, `PrimaryButton`, `SecondaryButton`, `BottomNavigation`, `LoadingView`, `EmptyState`, `ErrorStateView`, … — stateless, token-driven, 1:1 mappable to Figma components |
| Features | `FrenchLens/Features` | Home, Lesson, Library, Review, Settings, Ingest, Onboarding |
| Models | `FrenchLens/Models` | `LessonAnalysis` (transcript, translation, vocabulary, verbs, expressions, grammar, pronunciation, glossary, cefrLevel), `Lesson`, `CEFRLevel`, `LevelledText` |
| Services | `FrenchLens/Services` | `AIService`, `TranscriptionService`, `TranslationService`, `LanguageAnalysisService`, `TTSService`, `MediaProcessing`, `APIClient`, `LessonStore`, `AppSettings` |
| Share | `Shared/Share` | Capabilities, `ShareItemParser`, `ContentResolver`, `ShareInbox`, `URLExtractor`, `SupportedContent`, `DeepLink` |
| App | `FrenchLens/App` | `AppEnvironment` (dependency container), `AppRouter`, `RootView`, `AppDelegate` |

**AI is provider-agnostic.** The UI only knows `AIService.makeLesson(from:level:progress:)`. `AIServiceFactory` returns, per **Settings → Analysis**:
- **On this iPhone** (default): `PipelineAIService` with `SpeechTranscriptionService` (SFSpeechRecognizer, fr-FR, on-device when the French model is installed, timed sentences via `SentenceSplitter`) and `OnDeviceLanguageAnalysisService` (Foundation Models, three `@Generable` requests: overview + per-sentence translations, vocabulary + expressions, verbs + grammar). `LessonAssembler` then validates the draft against the transcript, dropping any verb, word or grammar excerpt that wasn't actually said, and links tappable words to glossary entries.
- **FrenchLens server**: the same pipeline with the remote services (when `FRENCHLENS_API_BASE_URL` is set).
- **Sample lessons**: `DemoAIService`.

Each step is a protocol and responses are strongly typed `LessonAnalysis`.

**CEFR adaptation.** Explanations are `LevelledText` (`a1` required, `a2`/`b1`/`b2` optional, falling back downward). The level picked in Settings (default A1) selects the text everywhere; B2 text is French-first. The remote analysis request includes the level so the backend generates for it.

**Interactive, synchronised transcript.** Words are laid out by a custom `FlowLayout` so each glossed word is tappable (dotted underline). Tapping opens `WordPopover` in place (spring, drag-to-dismiss, haptic) — e.g. **PRÉPARER · to prepare · je prépare / tu prépares / il/elle prépare · A1 · verb**. While a sentence plays, it lights up and the others recede; with TTS, the current word is tinted using `AVSpeechSynthesizer`'s word ranges. With video, the active sentence follows the player clock.

**Motion is a design-system layer.** Screens never pick curves: they state an intent (`tap`, `select`, `reveal`, `panel`, `swap`, `emphasis`, `ambient`) and use shared primitives — Reduce-Motion-aware transitions built on the iOS 17 `Transition` protocol, staggered entrances, `keyframeAnimator` pop/shake, a `PhaseAnimator` lens pulse, scroll-driven effects (stretchy/parallax hero, viewport focus, finger-locked collapsing titles), matched-geometry word highlights, iOS 18 zoom navigation, and semantic haptics. See [`docs/MOTION.md`](docs/MOTION.md) and **Settings → Motion** for a live lab.

**Listen while you watch.** Instagram only ever shares a Reel's *link*. A third target, `FrenchLensBroadcast` (a ReplayKit broadcast upload extension), solves this the Apple-supported way: the learner taps **Start listening** (an `RPSystemBroadcastPickerView` triggered from our own button), plays the Reel in Instagram, comes back and taps **Build my lesson**. The extension writes only the *app audio* to AAC (`ListenRecording`, plus one downscaled still frame for the poster), saves a `SharedPayload` to the App Group inbox and signals the app over Darwin notifications (`DarwinNotifier`); stopping from the status bar posts a local notification instead. Captures are capped at 3 minutes. Nothing leaves the iPhone.

**Speak (conversation practice).** A ChatGPT-style chat with "Camille", a French tutor, for practising out loud. Pick a situation (café, introductions, your weekend, directions, free chat) or **Practise speaking about this** from any lesson, which seeds the conversation with that video's words. Tap the mic and talk (`SpeakInput`: `AVAudioEngine` + `SFSpeechAudioBufferRecognitionRequest`, on-device French, live words and a level meter) or type. Replies stream in from Apple Intelligence (`OnDeviceTutor`: one `LanguageModelSession` per conversation, `streamResponse` into a `@Generable` turn whose correction is decided before the reply) and are read aloud. When something you said could be more natural, a **More natural** card appears under your message with a one-line tip; accent/punctuation-only differences are ignored. Long chats continue from a recap when the model's context fills. **Voice mode** (the waveform button, or **Talk with Camille**) is a hands-free, full-screen conversation like ChatGPT's or Siri's: a living cloud orb (`VoiceOrb`) grows from a dot, breathes with your voice and pulses with each word Camille speaks, with live French captions (and English) underneath. `VoiceSession` runs the turn-taking: listen → end the turn after a 1.4 s pause → think → speak → listen; the microphone is off while she speaks so she never hears herself; tap the orb to send early or interrupt her; mute and ✕ at the bottom. Everything said lands in the chat. Without Apple Intelligence (and in UI tests) `ScriptedTutor` gives clearly labelled sample replies.

**Hand-off.** iOS does not let a Share Extension open its containing app, so FrenchLens uses only supported paths: the extension queues the payload in the App Group, optionally posts a local "Ready to learn" notification (tap → `frenchlens://ingest?id=…`), and the app drains the inbox every time it becomes active.

## 2. Files created

```
Config/
  FrenchLens.xcconfig            bundle-ID prefix, App Group, backend URL
  Secrets.example.xcconfig       template for git-ignored overrides
  FrenchLens-Info.plist          URL scheme, App Group + backend keys
  ShareExtension-Info.plist      NSExtension + activation rules
  FrenchLens.entitlements        App Group
  ShareExtension.entitlements    App Group
FrenchLens.xcodeproj/            4 targets, shared schemes (Xcode 16 synchronized folders)
Shared/                          compiled into app AND extension
  Share/      AppGroup, SharedContent (capabilities + payload), SourcePlatform,
              URLExtractor, SupportedContent, ContentResolver, ShareInbox,
              ItemProviding, NSItemProvider+ItemProviding, ShareItemParser,
              DeepLink, ShareNotifications
  DesignSystem/  ColorTokens, Typography, Layout (spacing/radius/elevation),
                 BrandPrimitives (BrandMark, LensGlyph, ProgressLine)
    Motion/      MotionTokens (intents + Reduce Motion policy), MotionMath,
                 Transitions, Choreography (stagger, pop, shake),
                 ScrollEffects, Geometry (matched + zoom), Haptics,
                 Pressable, MotionPrimitives (LensPulse, DrawnCheckmark,
                 shimmer, toast)
BroadcastExtension/
  SampleHandler                  ReplayKit broadcast: app audio → inbox
  ListenRecording                AAC writer + poster frame
ShareExtension/
  ShareViewController            principal class; hosts SwiftUI
  ShareExtensionModel            parse → save to inbox → notify
  ShareExtensionView             "Understanding your French…"
FrenchLens/
  App/          FrenchLensApp, RootView, AppEnvironment, AppRouter, AppDelegate
  Models/       CEFRLevel (+ LevelledText), LessonAnalysis, Transcript,
                LearningItems (vocabulary, verbs, expressions, grammar,
                pronunciation, glossary), Lesson, DemoLesson
  Services/
    AI/               AIService, PipelineAIService, DemoAIService, DemoLibrary
      OnDevice/       OnDeviceCapability, OnDeviceLanguageAnalysisService,
                      LessonDraft, LessonAssembler
    Transcription/    TranscriptionService (+ remote)
    Translation/      TranslationService (+ remote)
    LanguageAnalysis/ LanguageAnalysisService (+ remote)
    Networking/       APIConfiguration, APIClient (+ multipart), AIServiceFactory
    Media/            MediaProcessing, MediaService, PlaybackController, PickedMovie
    TTS/              TTSService, SpeechSynthesizerTTSService
    Persistence/      LessonStore, AppSettings
  Features/
    Home/        HomeView, CaptureSheet
    Lesson/      LessonView, LessonSection
    Library/     LibraryView
    Review/      ReviewView, ReviewSession, ReviewExercise (+ generator)
    Settings/    SettingsView, MotionLabView
    Ingest/      IngestCoordinator, IngestError, ProcessingView
    Onboarding/  HowItWorksView
    Listen/      ListenSession, ListenView, BroadcastPicker
    Speak/       SpeakView, ConversationView, ConversationController,
                 SpeakInput (+ MicTranscriber), VoiceSession, VoiceModeView,
                 VoiceOrb, OnDeviceTutor, ScriptedTutor,
                 TutorPrompt, PracticeModels
  Components/    Buttons, FrenchText, TranslationBlock, AudioControls,
                 VocabularyRow, VerbCard, ExpressionCard, GrammarSection,
                 PronunciationRow, FlowLayout, TranscriptView, WordPopover,
                 LessonHeader (+ DemoBanner), VideoHero, LessonRow,
                 StateViews (LoadingView, EmptyState, ErrorStateView),
                 AddVideoButton, BottomNavigation, SegmentBar
  Resources/     Assets.xcassets (AppIcon, AccentColor),
                 DemoLessons/ demo_en_avoir_marre.json,
                              demo_futur_proche.json, demo_passe_compose.json
FrenchLensTests/     URL extraction, supported content, Share Extension parsing,
                     resolver, lesson/vocabulary/verb decoding, store,
                     ingestion state machine, review generator, deep links/inbox,
                     motion timing/scroll mapping, tutor corrections/prompts,
                     conversation controller
FrenchLensUITests/   launch, demo lesson, tap word, verbs, save, library, review,
                     listen, speak conversation, practise from a lesson
docs/BACKEND_API.md  the backend contract
docs/MOTION.md       the motion system: intents, primitives, choreography
```

## 3. How to run

Requirements: **Xcode 16+** (the project uses file-system-synchronized folders), iOS 17+ simulator or device.

1. Open `FrenchLens.xcodeproj`.
2. Select the **FrenchLens** scheme and an iPhone simulator → **Run**.

That's it: the app is seeded with three sample lessons (*J'en ai marre de travailler…*, a futur proche breakfast Reel, and a passé composé market TikTok). Try **Understand something → Try a demo lesson**, tap words in the transcript, open **Verbs**, save a lesson, then visit **Library** and **Review**.

For a device (or to exercise the Share Extension's App Group):

1. Set your team: copy `Config/Secrets.example.xcconfig` to `Config/Secrets.xcconfig` and set `DEVELOPMENT_TEAM`, or pick a team in *Signing & Capabilities* for both the **FrenchLens** and **FrenchLensShareExtension** targets.
2. Set `FRENCHLENS_BUNDLE_ID_PREFIX` to a prefix you own. The App Group (`group.<prefix>.frenchlens`) is derived from it; let Xcode register it for both targets.

Launch arguments: `-ui-testing` (isolated storage, fast demo pipeline, no animations), `-empty-library` (skip demo seeding to see empty states). **Settings → Reset library** also shows the empty states.

## 4. How to test the Share Extension

1. Run the **FrenchLens** scheme once on the simulator/device so both targets are installed.
2. (Optional) In FrenchLens, **Settings → Notify me when a share is ready**.
3. Open **Photos**, pick any video with speech → **Share** → scroll the app row → **More** → enable **FrenchLens** → tap it.
4. The sheet shows **FrenchLens · Understanding your French…**, then *"Video received. Open FrenchLens to see your lesson."* Tap **Done**.
5. Open FrenchLens (or tap the notification). It picks the share up from the App Group inbox and builds the lesson.

Other things worth sharing:
- **Safari** → Share on a page: a URL (and possibly text) arrives → the app shows the honest link-only state with **Add video**.
- **Notes** → select French text → Share: text arrives → a text lesson.
- To debug the extension: select the **FrenchLensShareExtension** scheme → Run → choose Photos (or Safari) as the host app; breakpoints in `ShareExtensionModel.receive` / `ShareItemParser.parse` show exactly which type identifiers the host registered (`SharedPayload.registeredTypeIdentifiers`).

## 5. How to test with Instagram

This needs a real device with Instagram installed and a signed build (step 3 above).

1. Find a French Reel → tap the **paper-plane / Share** icon → **Share to…** (or **More**) → **FrenchLens**.
   Enable FrenchLens in the system share sheet's **More** list the first time.
2. What happens depends entirely on what Instagram chooses to hand over, which varies by content, account and app version:
   - **Most common: a link only** (often with caption text). FrenchLens shows *"We received the Reel link, but couldn't access its audio. Try uploading the video instead."* — then **Add video** (and, when a caption came along, **Learn from the caption instead**).
   - **Sometimes: a video file.** The full pipeline runs.
3. Reliable path for Reels you're allowed to save: save the Reel to Photos (Instagram's own *Save/Download* where available, or a screen recording), then in FrenchLens tap **Understand something → Add video**. The uploaded video is linked to the Reel URL you shared earlier.

FrenchLens never scrapes Instagram, never calls private APIs, never bypasses authentication and never tries to turn a link into an MP4.

## 6. Known limitations

- **Not compiled in this environment.** The project was authored on Linux without Xcode. The platform-independent core (Share parsing, resolver, models, demo JSON, services, ingestion state machine, review generator, motion math — ~30 files) was compiled with Swift 6.0.3 and all 56 unit tests pass against it; the SwiftUI/UIKit/AVFoundation layers and the UI tests have not yet been built or run. Expect possible small compile fixes on first open in Xcode.
- **On-device analysis needs iOS 26+ and Apple Intelligence** (iPhone 15 Pro or later, turned on in Settings). Otherwise the app explains what to enable, or you can switch to sample lessons. The on-device model is smaller than cloud models, so lessons are simpler; long videos are analysed from their first ~320 words.
- **Sample lessons** (Settings → Analysis → Sample lessons) give any video one of three bundled analyses, clearly labelled.
- **No backend server is included** — only the client API layer and its contract (`docs/BACKEND_API.md`).
- **Hand-off requires opening the app.** iOS doesn't let share extensions launch their app; FrenchLens queues the share and (if allowed) posts a notification.
- **Images are recorded but not analysed** (no OCR yet).
- **Speak** needs Apple Intelligence for real conversations (otherwise sample replies). Voice mode ends your turn after a pause (no interrupting Camille by talking over her; tap the orb instead), and the on-device model's corrections are helpful but not infallible.
- Share Extensions have a ~120 MB memory limit; media is streamed to disk (`loadFileRepresentation` + copy), never loaded into memory, but very large files may still take time to copy.
- TTS uses the on-device `AVSpeechSynthesizer` French voice; quality depends on which voices are installed (Settings → Accessibility → Spoken Content → Voices → French → Enhanced/Premium).
- Persistence is a single JSON file — fine for a prototype, not for thousands of lessons.

## 7. Backend environment variables

The iOS client never holds AI provider keys. It only knows the FrenchLens backend URL.

| Variable | Where | Purpose |
| --- | --- | --- |
| `FRENCHLENS_API_BASE_URL` | Xcode scheme env var, or `Config/Secrets.xcconfig` (→ Info.plist `FLBackendBaseURL`) | Backend base URL. Empty → server mode unavailable. In xcconfig write `https:/$()/api.example.com` (`//` starts a comment). |
| `FRENCHLENS_BUNDLE_ID_PREFIX` | `Config/*.xcconfig` | Bundle IDs and App Group. |
| `FRENCHLENS_APP_GROUP` | `Config/FrenchLens.xcconfig` (derived) | Shared container for app ⇄ extension. |
| `DEVELOPMENT_TEAM` | `Config/Secrets.xcconfig` | Code signing. |

Suggested **server-side** variables (never in the app): `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `DEEPGRAM_API_KEY` (whichever providers you choose), `FRENCHLENS_TRANSCRIPTION_PROVIDER`, `FRENCHLENS_ANALYSIS_MODEL`, `FRENCHLENS_TTS_PROVIDER`, `FRENCHLENS_MAX_UPLOAD_MB`. Endpoints and JSON shapes are in [`docs/BACKEND_API.md`](docs/BACKEND_API.md).

When a backend URL is set, **Settings → Analysis → FrenchLens server** uses it.

## 8. Next steps for production

1. **Build & polish in Xcode**: fix any first-compile issues, run the UI tests, profile scrolling of long transcripts, check Dynamic Type at XXXL and VoiceOver on every screen.
2. **Backend**: implement `docs/BACKEND_API.md` (transcription with word timings, a structured-output analysis prompt validated against the `LessonAnalysis` schema, CEFR-aware generation, caching by media hash).
3. **Auth & abuse protection**: Sign in with Apple + short-lived tokens, App Attest/DeviceCheck, per-user quotas, upload size limits.
4. **On-device first pass**: `SFSpeechRecognizer` (fr-FR, on-device) for instant transcripts while the server analysis runs; stream partial lessons.
5. **Neural TTS** behind `TTSService`, with cached audio per sentence; use real word timings to sync highlighting to the original video.
6. **Persistence**: SwiftData with migrations; iCloud sync of saved items.
7. **Spaced repetition**: schedule Review from saved words/verbs (still without gamification).
8. **Share Extension hardening**: background `URLSession` upload directly from the extension for large files (Apple-supported shared-container pattern), more host apps tested, analytics on which capabilities each host provides.
9. **Figma**: map `Shared/DesignSystem` tokens to Figma variables and the `Components/` views to Figma components via Code Connect, then restyle without touching features or services.
10. **Privacy & compliance**: privacy manifest, data-retention policy for uploaded media, clear copy about what is sent to the server; respect platform terms for any shared content.
