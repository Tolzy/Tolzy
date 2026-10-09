import type { User } from "@/lib/types";
import { cn } from "@/lib/utils";

export function Avatar({ user, size = 20, className, ring }: { user?: User | null; size?: number; className?: string; ring?: boolean }) {
  const initials = user ? user.name.split(" ").map((p) => p[0]).slice(0, 2).join("") : "?";
  const hue = user?.hue ?? 0;
  return (
    <span
      role="img"
      aria-label={user?.name ?? "Unknown author"}
      title={user?.name}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold",
        ring && "ring-2 ring-surface",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(8, size * 0.4),
        background: `oklch(0.9 0.05 ${hue})`,
        color: `oklch(0.38 0.09 ${hue})`,
      }}
    >
      {initials}
    </span>
  );
}

export function AvatarStack({ users, size = 20, max = 4 }: { users: (User | undefined)[]; size?: number; max?: number }) {
  const list = users.filter(Boolean) as User[];
  const shown = list.slice(0, max);
  return (
    <span className="flex items-center">
      {shown.map((u, i) => (
        <Avatar key={u.id} user={u} size={size} ring className={i > 0 ? "-ml-1.5" : undefined} />
      ))}
      {list.length > max && <span className="ml-1 text-2xs text-fg-subtle">+{list.length - max}</span>}
    </span>
  );
}
