# Duale BuildLink web (company dashboard + platform admin)

React 18 + TypeScript + Vite. One app, two areas: `/companies/...` for company staff and `/admin/...` for platform staff
(shown only to users with platform permissions; the API enforces them regardless).

```
npm install
npm run dev      # http://localhost:5173, proxies /api -> http://localhost:8080
npm run build    # type-check + production bundle in dist/
```
In production serve `dist/` and the API behind one HTTPS reverse proxy, with the API under `/api`.

Covers: sign in (with authenticator code), register, password recovery, MFA setup, companies, branches (with staff assignment),
staff, customers and locations (with service area), technician invitations, jobs with explainable candidate list and explicit
offers, notifications, and for platform staff: company verification queue, technician document review (documents open through
short-lived signed links), catalog and service areas, MFA reset support.

Not built yet: reports, finance, job execution (Phases 3-5). Not type-checked or run in the environment that produced it; run `npm run build` first.
