import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.png"
      alt="fátima Leotta"
      className={cn("h-10 w-auto object-contain", className)}
    />
  );
}
