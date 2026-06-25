# Adapter

Adaptá tu CV a cada rol que te interesa.

## Stack
- TanStack Start (SSR) + React 19
- Supabase (auth + base de datos)
- Tailwind CSS v4 + shadcn/ui
- Exportación a .docx (librería `docx`)
- IA: Claude (Anthropic) o Lovable AI Gateway

## Setup local

### 1. Cloná el repo
```bash
git clone https://github.com/TU_USUARIO/adapter.git
cd adapter
```

### 2. Instalá dependencias
```bash
npm install
```

### 3. Configurá las variables de entorno
```bash
cp .env.example .env
```
Completá en `.env`:
- `SUPABASE_URL` y `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_PUBLISHABLE_KEY` y `VITE_SUPABASE_PUBLISHABLE_KEY`: anon key de Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: service role key (solo server, para admin)
- `ANTHROPIC_API_KEY`: tu API key de Anthropic (reemplaza Lovable AI Gateway)

### 4. Instalá componentes de shadcn/ui
```bash
npx shadcn@latest add button input label textarea select checkbox sonner
```

### 5. Correlo localmente
```bash
npm run dev
```

## Deploy en Vercel

1. Subí el código a GitHub
2. En Vercel, importá el repositorio
3. Configurá las variables de entorno (las mismas que en `.env`)
4. En Settings > Build & Deployment:
   - Build Command: `NITRO_PRESET=vercel npm run build`
   - Output Directory: `.output`
5. Deploy ✓

## Variables de entorno requeridas en Vercel

| Variable | Descripción |
|---|---|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_PUBLISHABLE_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (admin) |
| `VITE_SUPABASE_URL` | Igual a SUPABASE_URL (para el cliente) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Igual a PUBLISHABLE_KEY (para el cliente) |
| `ANTHROPIC_API_KEY` | API key de Anthropic (reemplaza Lovable) |

## Desarrollo

Para hacer cambios, podés:
- Usar Claude Code en tu máquina
- O pedirle cambios a Claude en el chat, que los escribe directamente

## Supabase

El proyecto ya tiene las tablas creadas:
- `profiles` — datos de usuario
- `user_roles` — roles (admin / user)
- `work_sheets` — hojas laborales
- `target_roles` — avisos de roles analizados
- `cv_documents` — CVs generados

No necesitás migrar la base de datos — apunta al mismo proyecto Supabase que usaba en Lovable.
