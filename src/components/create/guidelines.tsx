import { Contrast, Crosshair, Focus, Glasses, ScanFace, Smile, User } from "lucide-react";

const GUIDELINES = [
  { icon: <ScanFace />, title: "Face the camera", text: "Look straight into the lens, head level." },
  { icon: <Smile />, title: "Neutral expression", text: "Relaxed, mouth closed, eyes open." },
  { icon: <Contrast />, title: "Even lighting", text: "Soft light from the front — no harsh shadows or flash." },
  {
    icon: <Crosshair />,
    title: "Hairline and jawline visible",
    text: "Leave space around the head; hair off the face.",
  },
  {
    icon: <Glasses />,
    title: "No sunglasses or hats",
    text: "Nothing covering the eyes, hairline or ears, if you can.",
  },
  { icon: <User />, title: "One person in the frame", text: "Crop out anyone else." },
  { icon: <Focus />, title: "Sharp focus", text: "At least 1024 px on the short side; no blur." },
];

/** Head-and-shoulders framing guide: how the photo should be composed. */
function FramingGuide() {
  return (
    <figure className="bg-sunken ring-line flex items-center gap-4 rounded-lg p-3 ring-1">
      <svg viewBox="0 0 80 100" className="h-24 w-[76px] shrink-0" aria-hidden="true">
        <rect x="1" y="1" width="78" height="98" rx="6" className="fill-surface stroke-line-strong" strokeWidth="1.5" />
        {/* shoulders */}
        <path d="M12 99 C14 80 26 74 40 74 C54 74 66 80 68 99" className="fill-active" />
        {/* neck + head */}
        <rect x="34" y="58" width="12" height="18" rx="5" className="fill-active" />
        <ellipse cx="40" cy="42" rx="15" ry="19" className="fill-active" />
        {/* framing oval */}
        <ellipse
          cx="40"
          cy="42"
          rx="21"
          ry="26"
          fill="none"
          className="stroke-accent"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
        {/* eye line */}
        <line x1="22" y1="40" x2="58" y2="40" className="stroke-accent" strokeWidth="1" strokeDasharray="2 2" />
      </svg>
      <figcaption className="text-muted text-xs leading-5">
        <span className="text-fg block font-medium">Head and shoulders</span>
        Eyes level, face filling about a third of the photo, with space above the hair.
      </figcaption>
    </figure>
  );
}

export function PhotoGuidelines() {
  return (
    <section aria-labelledby="guidelines-heading">
      <h3 id="guidelines-heading" className="text-sm font-medium">
        What makes a good photo
      </h3>
      <div className="mt-4">
        <FramingGuide />
      </div>
      <ul className="mt-4 space-y-3">
        {GUIDELINES.map((g) => (
          <li key={g.title} className="flex gap-3">
            <span className="text-muted mt-0.5 [&_svg]:size-4" aria-hidden="true">
              {g.icon}
            </span>
            <span className="text-sm">
              <span className="text-fg block font-medium">{g.title}</span>
              <span className="text-muted">{g.text}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
