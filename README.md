# Asaan Khata Book

## Setup
1. Install dependencies: `npm install`
2. Run app: `npm run dev`

## Build
- Web build: `npm run build`
- Electron build: `npm run electron:build`

## Important Migration Note
Dashboard and Reports depend on latest Supabase RPC migrations. Apply all migrations before deploy, especially:
- `20260523110000_dashboard_reports_rpc.sql`

If migrations are missing, dashboard/report aggregates may be incomplete.
