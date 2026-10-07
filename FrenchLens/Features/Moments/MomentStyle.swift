import SwiftUI

/// Each moment has its own palette, listed from the bottom of the screen
/// to the top: deep at the base, rising into light.
extension Milestone {
    var palette: [Color] {
        switch self {
        case .firstLesson: [.hex(0x1B1446), .hex(0x5B2BB5), .hex(0xF08A6B)]
        case .firstReel: [.hex(0x2A0B3D), .hex(0xC1356F), .hex(0xFFB15C)]
        case .firstChat: [.hex(0x071A3D), .hex(0x1E5BFF), .hex(0x7FE3FF)]
        case .firstVoiceChat: [.hex(0x140B33), .hex(0x7A3CFF), .hex(0xFF5FA2)]
        case .realConversation: [.hex(0x03241F), .hex(0x0F8F7A), .hex(0xB8F06A)]
        case .firstCorrection: [.hex(0x0B2A1A), .hex(0x1E9E5A), .hex(0xF7D774)]
        case .words25: [.hex(0x06213A), .hex(0x1C6FB8), .hex(0x9FD8F5)]
        case .words100: [.hex(0x120A33), .hex(0x3A2BB8), .hex(0xE2B8FF)]
        case .firstReview: [.hex(0x2B0F1E), .hex(0xD2486C), .hex(0xFFC28A)]
        case .perfectReview: [.hex(0x2A1A05), .hex(0xC98A16), .hex(0xFFF0A8)]
        case .levelUp: [.hex(0x061B2E), .hex(0x1F9D9B), .hex(0xC3F5A0)]
        case .sevenDays: [.hex(0x1A1238), .hex(0xE0607E), .hex(0xFFD7A0)]
        }
    }

    /// The brightest colour, for accents.
    var glow: Color { palette.last ?? .white }
}

extension Color {
    static func hex(_ value: UInt32) -> Color {
        Color(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

extension UnlockedMilestone {
    var formattedDate: String {
        date.formatted(.dateTime.day().month(.wide).year())
    }
}
