import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn("inline-flex items-baseline gap-1 whitespace-nowrap text-base font-medium tracking-tight text-foreground", className)}
      aria-label="fátima LEOTTA"
    >
      <span className="text-muted-foreground">&lt;</span>
      <span className="font-display italic">fátima</span>
      <span className="font-semibold uppercase tracking-wide">Leotta</span>
      <span className="text-muted-foreground">&gt;</span>
    </span>
  );
}
