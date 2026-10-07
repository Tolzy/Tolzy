import Foundation

/// The tutor's instructions and per-turn prompts. Kept separate from the
/// model so they can be tested and tuned.
enum TutorPrompt {
    static func instructions(level: CEFRLevel, scenario: PracticeScenario) -> String {
        let pace: String
        switch level {
        case .a1:
            pace = "The learner is a beginner (A1). Use very short, simple sentences (under 12 words), the present tense, and very common words. Speak slowly and clearly."
        case .a2:
            pace = "The learner is elementary (A2). Use short sentences, common words, and the present, passé composé and futur proche."
        case .b1:
            pace = "The learner is intermediate (B1). Use natural everyday French with some idioms, and a variety of tenses."
        case .b2:
            pace = "The learner is upper-intermediate (B2). Speak naturally, as with a French friend, including informal expressions."
        }
        let words = scenario.vocabulary.isEmpty ? "" : " Try to use, and get the learner to use: \(scenario.vocabulary.joined(separator: ", "))."
        return """
            You are Camille, a warm, encouraging French conversation partner helping an English \
            speaker practise speaking French. Situation: \(scenario.goal)\(words) \(pace) \
            Always reply in French with one to three short sentences, and end with a question \
            that keeps the conversation going. Stay in the situation. Never switch to English \
            in the French reply. If the learner writes in English, gently answer in French and \
            show how to say it in French. When the learner's French has a mistake or sounds \
            unnatural, give a corrected, natural version of their whole message and one very \
            short tip in English; if it is fine, leave the correction and tip empty. Do not \
            correct missing accents or capitals, since they are speaking aloud.
            """
    }

    static func opening(for scenario: PracticeScenario) -> String {
        "Start the conversation in French to fit the situation. Greet the learner and ask your first question. There is nothing to correct yet."
    }

    static func turn(_ learnerText: String) -> String {
        "The learner said: \"\(learnerText)\"\nReply as Camille."
    }

    /// When a long conversation fills the model's memory, a new session
    /// continues from the most recent exchanges.
    static func recap(_ history: [(learner: String, tutor: String)], keeping count: Int = 3) -> String {
        let recent = history.suffix(count)
        guard !recent.isEmpty else { return "" }
        let lines = recent.map { "Learner: \($0.learner)\nCamille: \($0.tutor)" }.joined(separator: "\n")
        return "\n\nThe conversation so far (most recent part):\n\(lines)"
    }
}
