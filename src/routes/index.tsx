import { createFileRoute, Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Adapter · Adaptá tu CV a cada rol" }] }),
  component: Landing,
});

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-card p-6">
      <span className="font-display text-3xl italic text-accent">{n}</span>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Logo className="h-5 text-foreground" />
        <Link to="/login" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">Ingresar</Link>
      </header>
      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 md:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-accent">Adapter</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-6xl">
            Adaptá tu CV a{" "}<span className="font-display italic text-primary">cada rol</span> que te interesa.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Volcá toda tu experiencia una sola vez. Después, para cada puesto, la herramienta prioriza lo que importa y arma tu CV. Directo y estratégico.</p>
        </section>
        <section className="grid gap-4 pb-16 md:grid-cols-3">
          <Step n="01" title="Hoja en blanco" text="Una entrevista guiada vuelca toda tu experiencia, formación e idiomas en tu hoja laboral, reutilizable siempre." />
          <Step n="02" title="Ahora el rol" text="Pegás el aviso del puesto y se extraen las variables que pide la empresa." />
          <Step n="03" title="El match" text="Obtenés un puntaje de coincidencia, una matriz comparativa y tu CV, exportables en Word." />
        </section>
      </main>
      <footer className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
        <Logo className="inline-block h-4 align-middle text-muted-foreground" /> · Adapter
      </footer>
    </div>
  );
}
