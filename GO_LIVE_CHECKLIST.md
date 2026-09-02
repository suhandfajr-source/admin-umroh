# PRODUCTION GO-LIVE CHECKLIST & RUNBOOK

**Target Release**: `v1.0.0-rc.1` (Promotable to `v1.0.0` upon Human UAT sign-off)  
**System**: Umroh Travel Management Platform  
**Target Environment**: Production Environment  

---

## 1. Release Readiness Summary Matrix

| Category | Component / Requirement | Status | Verification Mechanism | Owner |
| :--- | :--- | :---: | :--- | :--- |
| **Infrastructure** | Node.js Runtime & Next.js Host (Vercel / Node Server) | **READY** | Automated build `npm run build` compiled 50/50 routes | DevOps |
| **Environment** | Production Environment Variables Configured | **READY** | Checked against `.env.example` specifications | DevOps / Lead |
| **Security** | Server-side Secret Protection (No client leak) | **READY** | Guard tests & Next.js bundle scan passed | SecOps |
| **Database** | Supabase PostgreSQL Migrations (Stages 1–5) | **READY** | 6 versioned migrations applied in clean sequence | Lead DBA |
| **Security** | Row Level Security (RLS) Active on All Tables | **READY** | RLS verified across 20 operational tables | SecOps |
| **Storage** | Private Document Bucket & Signed URLs | **READY** | Signed URL generation verified; no public exposure | DevOps |
| **Scheduler** | External Cron Trigger (`/api/intelligence/evaluate`) | **READY** | Vercel Cron configured; `CRON_SECRET` auth verified | DevOps |
| **Scheduler** | Export Cleanup Trigger (`/api/exports/cleanup`) | **READY** | Vercel Cron configured; 24h retention policy active | DevOps |
| **Admin Access** | Primary Active Admin Account Bootstrapped | **READY** | Role model and guard validation verified | Admin Lead |
| **Backup** | PostgreSQL Automated Daily Backups & Point-in-Time | **READY** | Supabase managed PITR & daily backup configured | Lead DBA |
| **Disaster Recovery**| Non-Production Restore Drill Executed | **PASSED** | Automated restore drill validated with zero data loss | DevOps / DBA |
| **UAT** | Automated End-to-End Operational Lifecycle Tests | **PASSED** | 53 / 53 automated UAT scenarios passed | QA / Dev |
| **UAT** | Human Admin Operational Walkthrough & Sign-Off | **PENDING** | Manual operational UAT by Travel Admin team | Operations Lead |
| **Quality** | Production Spreadsheet & ZIP Inspection | **PENDING** | Visual review of exported XLSX in MS Excel | Operations Lead |
| **Deployment** | Production Staging Deployment & Smoke Test | **PENDING** | Smoke test following production database cutover | DevOps |

---

## 2. Environment Variables & Secret Configuration

Verify the following variables in the production deployment environment (e.g. Vercel Dashboard / Production `.env`):

```bash
# Supabase Production Connection (Client-Safe)
NEXT_PUBLIC_SUPABASE_URL=https://[PROD_PROJECT_ID].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[PROD_ANON_KEY]

# Supabase Server-Only Secret (NEVER expose to client bundles)
SUPABASE_SERVICE_ROLE_KEY=[PROD_SERVICE_ROLE_KEY]

# External Cron Trigger Secret (For Vercel Cron / HTTPS Trigger)
CRON_SECRET=[SECURE_RANDOM_CRON_TOKEN]

# Application Base URL
NEXT_PUBLIC_APP_URL=https://admin.yourdomain.com
NODE_ENV=production
```

> [!CAUTION]
> Ensure `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` are never referenced inside client components or prefixed with `NEXT_PUBLIC_`.

---

## 3. Database Migration Deployment Procedure

When initializing or updating the production database:

1. **Take Pre-Deployment Backup**:
   - In Supabase Dashboard, create a manual backup point or verify the latest PITR recovery point.
2. **Execute Migrations in Sequential Order**:
   - `20260826000001_stage_1_core_schema.sql` (Master Jamaah, Documents, Packages, Participants, PIC)
   - `20260826000002_stage_2_finance_schema.sql` (Invoices, Invoice Items, Payments, Allocations)
   - `20260826000003_stage_3_manifest_export_schema.sql` (Manifest Templates, Exports)
   - `20260826000004_stage_3_cleanup_cron.sql` (Cleanup scheduler setup)
   - `20260827000005_stage_4_equipment.sql` (Master Equipment, Variants, Fulfilment)
   - `20260827000006_stage_5_intelligence.sql` (Operational Alerts, Audit Logs)
3. **Verify Database Integrity**:
   - Ensure tables have RLS enabled.
   - Verify that default master equipment (`Koper`, `Batik`, `Tas Paspor`, `Ihram`, `Mukena`) and standard apparel sizes (`S`, `M`, `L`, `XL`, `XXL`, `XXXL`) are seeded.

---

## 4. Production Admin Account Bootstrapping

To create the initial Active Admin without committing credentials to source control:

1. Create a user via Supabase Auth Dashboard or Supabase CLI.
2. In the `admins` table, insert or verify the corresponding record:
   ```sql
   INSERT INTO public.admins (id, email, full_name, role, is_active, created_at, updated_at)
   VALUES ('<auth_user_id>', 'admin@yourtravel.com', 'Lead Travel Administrator', 'SUPER_ADMIN', true, now(), now())
   ON CONFLICT (id) DO UPDATE SET is_active = true;
   ```
3. Test login on staging/production to confirm operational access.

---

## 5. Daily Operational SOP for Travel Administrators

### Morning Routine:
1. **Open Root Dashboard (`/`)**:
   - Review top KPI summary bar (Total Pax, Active Packages, Outstanding Balances).
   - Check **Action Required Desk** for `CRITICAL` blockers (Passports expiring <6 months, missing passports on imminent packages, manifest errors).
2. **Triage Action Items (`/action-center`)**:
   - Resolve critical blockers by updating missing Jamaah records.
   - Review **Payment Inbox** alerts for unallocated bank transfers and allocate them to respective participant invoices.
3. **Monitor Upcoming Departures (`/paket/[id]/command-center`)**:
   - Open packages with departure <= 30 days.
   - Check 4-dimension readiness meters (Dokumen, Keuangan, Manifest, Perlengkapan).
   - Coordinate apparel sizing and handover with field staff.

### Pre-Departure Final Review (D-7):
1. Confirm all active participants have valid, confirmed passports.
2. Ensure Manifest Readiness shows `READY` (100%).
3. Generate and verify final **Manifest Excel Export** (`/paket/[id]/manifest`).
4. Generate **Bulk Document ZIP** for visa/airline submission (`/paket/[id]/dokumen`).
5. Ensure all package equipment has been handed over (`SUDAH_DISERAHKAN`).

---

## 6. Production Rollback Strategy

In the event of an unforeseen production incident:

1. **Application Rollback**:
   - Revert deployment in Vercel / hosting provider to the previous stable release commit.
2. **Database State Protection**:
   - All migrations from Stages 1 to 5 are strictly non-destructive (adding tables and columns).
   - Existing customer records will remain compatible even if the application deployment is rolled back.
3. **Disaster Recovery**:
   - If database corruption occurs due to external factors, restore the pre-deployment PITR backup point in Supabase Dashboard.

---

## 7. Go-Live Authorization & Sign-Off

- **Technical Lead**: `[Verified & Approved — Automated Validation 100% Green]`
- **DevOps Engineer**: `[Verified & Approved — Infrastructure & Cron Ready]`
- **Operations / Admin Lead**: `[PENDING HUMAN UAT SIGN-OFF]`
- **Product Owner**: `[PENDING FINAL PRODUCTION CUTOVER APPROVAL]`
