# SPARK — Spatial Planning AI for Resource & Knowledge (Sepang, Selangor)

## Original Problem Statement
An AI + GIS decision-support platform for urban planners (PBT) in Sepang. Positioned as
"ArcGIS × Bloomberg Terminal × smart-city AI" — not a recycling app. Three interfaces:
SPARK Citizen, SPARK Intelligence (8-screen planner dashboard), SPARK Simulator (What-If Future Lab).
Story: Community data → GIS patterns → AI projection → planner scenarios → planning recommendation.

## Architecture
- Backend: FastAPI + MongoDB (JWT Bearer auth, localStorage token). Claude Sonnet 4.6 via emergentintegrations (EMERGENT_LLM_KEY).
- Frontend: React 19 + react-leaflet (OpenStreetMap/CartoDB tiles) + recharts + framer-motion + Tailwind + shadcn.
- Data: realistic mock Sepang dataset in `backend/sepang_data.py` (8 zones, facilities, sites, routes, forecast).

## User Personas
- Planner / PBT officer: full SPARK Intelligence + Simulator access.
- Citizen / business: submit waste reports feeding the AI engine.

## Core Requirements (static)
- Login with Planner vs Citizen roles; role-guarded routes.
- 8 planner screens: Overview, Spatial Intelligence (GIS + layers), AI Analytics (copilot),
  Forecasting, Site Suitability, Logistics, Planning Simulator ★, Reports.
- Real interactive GIS map; real streaming AI copilot (Evidence→Analysis→Projection→Recommendation).
- What-if simulator with cascading impacts + AI recommendation.

## Implemented (2026-06 / first MVP)
- JWT auth (login/register/me), planner+citizen seed accounts.
- All 8 planner screens + Landing + Citizen reporting, all functional end-to-end.
- Real Claude Sonnet 4.6: streaming /api/ai/chat + /api/simulate recommendation.
- Leaflet GIS map with severity-colored hotspots, layer toggles, route polylines, site markers.
- Tested: 25/25 backend, 11/11 frontend flows passing.

## Backlog (P1/P2)
- P1: Persist citizen reports as new live hotspots feeding zone data.
- P1: Site comparison + conflict-analysis modals (currently buttons/stubs).
- P2: PDF export for reports (currently window.print).
- P2: Real Sepang dataset ingestion when user provides it.
- P2: Notification center wiring (bell icon).

## Next Tasks
- Await user's real Sepang dataset to replace mock data.

## Update — Citizen App Rebuild (Alam Flora style)
Replaced the simple citizen page with a full 6-module recycling app:
- Home Dashboard (recycling stats, points, e-wallet, CO₂, quick actions, campaign banners)
- Buy-Back Locator (Leaflet map of BBC / DTRC / 3R on Wheels + hours + accepted items + directions)
- Recycling Value Calculator (live buy-back rate estimator → RM + points, "Add to Wallet")
- Cashless Wallet & Rewards (balance/points, transaction history, QR check-in, convert to cash/reward)
- Collection Schedule & Reminders (municipal calendar + notification toggles)
- Public Reporting/Complaints (category, description, geolocation tag, camera photo upload)
Backend added: /api/recycling/{rates,centers,schedule}, /api/announcements, /api/wallet(+dropoff,+convert),
/api/upload + /api/files (Emergent object storage), /api/complaints. Tested 18/18 backend + 6/6 UI.
