import { cn } from "@/lib/utils";

export function Logo({ className, variant = "black" }: { className?: string; variant?: "black" | "white" }) {
  return (
    <img
      src={variant === "white" ? "/logo-white.png" : "/logo-black.png"}
      alt="fátima Leotta"
      className={cn("h-6 w-auto object-contain", className)}
    />
  );
}
