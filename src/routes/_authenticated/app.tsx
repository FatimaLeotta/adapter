import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app")({ component: Inicio });

function Card({ to, step, title, text }: { to: "/hoja" | "/rol" | "/documentos"; step: string; title: string; text: string }) {
  return (
    <Link to={to} className="group rounded-lg border bg-card p-6 transition-colors hover:border-accent">
      <span className="font-display text-3xl italic text-accent">{step}</span>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </Link>
  );
}

function Inicio() {
  return (
    <div>
      <p className="text-sm font-medium uppercase tracking-widest text-accent">El ejercicio</p>
      <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        Volcá tu experiencia una vez y armá un CV{" "}<span className="font-display italic text-primary">a medida</span> para cada rol.
      </h1>
      <p className="mt-4 max-w-2xl text-muted-foreground">Tu hoja laboral se reutiliza para tantos roles y CVs como necesites.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card to="/hoja" step="01" title="Hoja en blanco" text="Una entrevista guiada vuelca tu experiencia, formación e idiomas. Editable y descargable en Word." />
        <Card to="/rol" step="02" title="Ahora el rol" text="Pegás el aviso del puesto y se extraen las variables que pide la empresa." />
        <Card to="/documentos" step="03" title="El match" text="Puntaje de coincidencia, matriz comparativa y tu CV en primera persona." />
      </div>
    </div>
  );
}
