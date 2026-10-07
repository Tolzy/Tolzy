import Foundation

/// Sample replies, used when Apple Intelligence isn't available (and in UI
/// tests). Clearly labelled as samples in the interface.
final class ScriptedTutor: TutorEngine {
    private let lines: [TutorReply]
    private var index = 0
    private var hasReplied = false
    var delay: Duration

    var isLive: Bool { false }

    init(scenario: PracticeScenario, delay: Duration = .milliseconds(450)) {
        self.delay = delay
        lines = Self.script(for: scenario)
    }

    func respond(
        to learnerText: String?,
        onPartial: @escaping @MainActor @Sendable (TutorReply) -> Void
    ) async throws -> TutorReply {
        let isFirst = !hasReplied
        hasReplied = true
        let reaction = learnerText.flatMap(Self.reaction(to:))
        // Don't ask "how are you?" right after being asked it.
        if reaction?.answeredHowAreYou == true, index < lines.count - 1,
           TutorReply.spokenForm(lines[index].french).contains("comment ca va") {
            index += 1
        }
        var reply = lines[min(index, lines.count - 1)]
        index = learnerText == nil ? 1 : min(index + 1, lines.count - 1)
        if !isFirst || reaction != nil {
            reply.french = ConversationFlow.removingGreeting(reply.french)
            reply.english = ConversationFlow.removingGreeting(reply.english, english: true)
        }
        if let reaction {
            reply.french = (isFirst ? "Salut ! " : "") + reaction.french + " " + reply.french
            reply.english = (isFirst ? "Hi! " : "") + reaction.english + " " + reply.english
        }
        if let learnerText, let fix = Self.correction(for: learnerText) {
            reply.correction = fix.corrected
            reply.tip = fix.tip
        }
        // Reveal the reply word by word, like a live model.
        let words = reply.french.split(separator: " ")
        for count in stride(from: 1, through: words.count, by: 2) {
            try await Task.sleep(for: delay / max(words.count / 2, 1))
            var partial = reply
            partial.french = words.prefix(count).joined(separator: " ")
            partial.english = ""
            await onPartial(partial)
        }
        await onPartial(reply)
        return reply
    }

    /// A natural first beat: welcome their name, answer "how are you?".
    static func reaction(to text: String) -> (french: String, english: String, answeredHowAreYou: Bool)? {
        var french: [String] = []
        var english: [String] = []
        if let name = ConversationFlow.name(in: text) {
            french.append("Enchantée, \(name) !")
            english.append("Nice to meet you, \(name)!")
        }
        let spoken = TutorReply.spokenForm(text)
        let asked = ["comment ca va", "comment vas tu", "comment allez vous", "ca va et toi", "et toi ca va", "ca va toi"]
            .contains { spoken.contains($0) }
        if asked {
            french.append("Ça va très bien, merci !")
            english.append("I'm very well, thanks!")
        }
        guard !french.isEmpty else { return nil }
        return (french.joined(separator: " "), english.joined(separator: " "), asked)
    }

    /// A few classic beginner slips, so corrections can be seen in samples.
    static func correction(for text: String) -> (corrected: String, tip: String)? {
        let fixes: [(wrong: String, right: String, tip: String)] = [
            ("je va ", "je vais ", "With je, aller is \"vais\": je vais."),
            ("je suis aller", "je suis allé", "In the passé composé, use the past participle: allé."),
            ("j'ai allé", "je suis allé", "Aller uses être in the passé composé: je suis allé."),
            ("je suis 20 ans", "j'ai 20 ans", "For age, French uses avoir: j'ai 20 ans."),
            ("je suis faim", "j'ai faim", "Being hungry uses avoir: j'ai faim."),
        ]
        let padded = text.replacingOccurrences(of: "’", with: "'") + " "
        for fix in fixes {
            guard let range = padded.range(of: fix.wrong, options: [.caseInsensitive, .diacriticInsensitive]) else { continue }
            let corrected = padded.replacingCharacters(in: range, with: fix.right)
                .trimmingCharacters(in: .whitespaces)
            return (corrected.prefix(1).uppercased() + corrected.dropFirst(), fix.tip)
        }
        return nil
    }

    static func script(for scenario: PracticeScenario) -> [TutorReply] {
        func r(_ fr: String, _ en: String) -> TutorReply { TutorReply(french: fr, english: en, correction: "", tip: "") }
        switch scenario.id {
        case "cafe":
            return [
                r("Bonjour ! Bienvenue au café. Qu'est-ce que je vous sers ?", "Hello! Welcome to the café. What can I get you?"),
                r("Très bien. Vous voulez aussi un croissant ?", "Very good. Would you also like a croissant?"),
                r("Parfait. Sur place ou à emporter ?", "Perfect. To have here or to take away?"),
                r("Voilà ! Ça fait six euros, s'il vous plaît. Vous payez par carte ?", "Here you go! That's six euros, please. Are you paying by card?"),
                r("Merci beaucoup ! Bonne journée !", "Thank you very much! Have a good day!"),
            ]
        case "intro":
            return [
                r("Salut ! Je m'appelle Camille. Et toi, comment tu t'appelles ?", "Hi! My name is Camille. And you, what's your name?"),
                r("Enchantée ! Tu habites où ?", "Nice to meet you! Where do you live?"),
                r("Super ! Qu'est-ce que tu fais dans la vie ?", "Great! What do you do for a living?"),
                r("C'est intéressant ! Qu'est-ce que tu aimes faire le week-end ?", "That's interesting! What do you like doing at the weekend?"),
            ]
        case "weekend":
            return [
                r("Salut ! Qu'est-ce que tu as fait le week-end dernier ?", "Hi! What did you do last weekend?"),
                r("Ah, sympa ! Et c'était comment ?", "Oh, nice! And how was it?"),
                r("Et le week-end prochain, qu'est-ce que tu vas faire ?", "And next weekend, what are you going to do?"),
                r("Ça a l'air génial ! Avec qui ?", "That sounds great! With whom?"),
            ]
        case "directions":
            return [
                r("Bonjour ! Vous avez l'air perdu. Je peux vous aider ?", "Hello! You look lost. Can I help you?"),
                r("La gare ? C'est facile. Allez tout droit, puis tournez à gauche. D'accord ?", "The station? It's easy. Go straight on, then turn left. OK?"),
                r("Oui, c'est à dix minutes à pied. Vous cherchez autre chose ?", "Yes, it's ten minutes on foot. Are you looking for anything else?"),
                r("Il y a une boulangerie juste à droite. Bonne journée !", "There's a bakery just on the right. Have a good day!"),
            ]
        default:
            return [
                r("Salut ! Comment ça va aujourd'hui ?", "Hi! How are you today?"),
                r("Ah, d'accord ! Qu'est-ce que tu as fait aujourd'hui ?", "Oh, I see! What did you do today?"),
                r("Intéressant ! Et qu'est-ce que tu aimes faire le soir ?", "Interesting! And what do you like doing in the evening?"),
                r("Moi aussi ! Tu apprends le français depuis combien de temps ?", "Me too! How long have you been learning French?"),
                r("Bravo, tu parles déjà bien ! Continue comme ça.", "Well done, you already speak well! Keep it up."),
            ]
        }
    }
}
