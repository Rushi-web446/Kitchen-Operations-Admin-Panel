# Fernleaf Kitchen — Operations Admin Panel

A real-world kitchen-operations admin panel for **Fernleaf Kitchen**, a fictional commercial meal-program caterer.
Kitchen staff, dispatchers, drivers, and admins all use the same panel; each role sees only the data and actions they are allowed to perform, **enforced on the server**.

- **Frontend:** Next.js 16 App Router · React 19 · TypeScript · Tailwind v4
- **Backend:** NestJS 12 · TypeScript · JWT auth · Prisma ORM
- **Database:** PostgreSQL (any Prisma-compatible Postgres)
- **Auth:** JWT in `Authorization: Bearer <token>` body, plus HTTP-only cookie as a secondary transport (see [auth.controller.ts](file:///d:/Kitchen_Admin/backend/src/auth/auth.controller.ts) and [jwt.strategy.ts](file:///d:/Kitchen_Admin/backend/src/auth/strategies/jwt.strategy.ts))
- **Kitchen time zone:** `Asia/Kolkata` (IST, UTC+05:30). Every calendar date, "today", cut-off, delivery plan, and driver dashboard is computed in IST regardless of the server or browser locale (see [calendar-time.ts](file:///d:/Kitchen_Admin/backend/src/orders/calendar-time.ts#L4-L5)).

---


---

## Table of contents

1. [Local setup](#1-local-setup)
2. [Architecture overview](#2-architecture-overview)
3. [Data model](#3-data-model)
4. [Key decisions & trade-offs](#4-key-decisions--trade-offs)
5. [Dashboard definitions (§4.11)](#5-dashboard-definitions-411)
6. [Prioritisation (§6)](#6-prioritisation-section-6)
7. [Non-functional correctness](#7-non-functional-correctness)
8. [Tests](#8-tests)
9. [Next steps with more time](#9-next-steps-with-more-time)

---

## 1. Local setup

### Requirements

- Node.js **20.18+** (Next.js 16 requirement, also enforced via `engines` in the frontend [package.json](file:///d:/Kitchen_Admin/frontend/package.json))
- npm ≥ 10
- A PostgreSQL 14+ database (any host — e.g. `postgres://user:pw@localhost:5432/fernleaf`)

### Clone & install

```bash
git clone <your-repo-url>
cd Kitchen_Admin

# Backend
cd backend
npm install
cp .env.example .env             # edit DATABASE_URL + JWT_SECRET inside
npx prisma generate
npx prisma migrate deploy        # runs backend/prisma/migrations/* in order
npm run prisma:seed              # seeds accounts, companies, menu, realistic orders

# Frontend (new terminal)
cd ../frontend
npm install
# Create .env.local (create if it doesn't exist) with exactly one line:
#   NEXT_PUBLIC_API_URL=http://localhost:3001
```

Minimal `.env` for the backend — see [.env.example](file:///d:/Kitchen_Admin/backend/.env.example) for full options:

```
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/fernleaf"
JWT_SECRET="change-me-please-32-random-chars"
JWT_EXPIRES_IN="1d"
FRONTEND_URLS="http://localhost:3000,http://127.0.0.1:3000"
NODE_ENV="development"
COOKIE_SECURE="false"
COOKIE_SAME_SITE="lax"
```

### Run

```bash
# Terminal 1 — backend on :3001
cd backend
npm run start:dev

# Terminal 2 — frontend on :3000
cd frontend
npm run dev
```

Open `http://localhost:3000`. Seeded accounts listed above (`admin@test.com` / `Test@1234` etc.) all work.

### Validation

```bash
# Frontend
cd frontend && npm run lint && npm run typecheck && npm run build

# Backend
cd backend && npx prisma validate && npm run build && npx vitest run
```

---

## 2. Architecture overview

### High-level shape

```
┌───────────────────────────────────────────────────────────┐
│  Browser (Next.js App Router — no Server Actions for     │
│  business flows). Centralized typed HTTP client:         │
│  frontend/src/lib/api.ts                                 │
│     └─► Authorization: Bearer <token>   (primary)        │
│         + Cookie access_token fallback                    │
└──────────────────────────┬────────────────────────────────┘
                           │ HTTPS, CORS credentials: true
                           ▼
┌───────────────────────────────────────────────────────────┐
│  NestJS on Node                                           │
│  ├─ main.ts           CORS, cookie parser, global pipes   │
│  ├─ auth/*            JWT strategy, Roles decorator/guard │
│  ├─ controllers       HTTP transport, DTO validation,     │
│  │                    role-based authorization            │
│  ├─ services          Pure business logic, no req/res     │
│  │                    (cutoff math, pricing, workflows)   │
│  ├─ PrismaService     Transactions + row-locking          │
│  └─ Domain modules    orders · kitchen · dispatch ·       │
│       + files         driver · billing · pricing ·        │
│       per domain      catalogue · companies · employees · │
│                       settings · dashboard · users · health
└──────────────────────────┬────────────────────────────────┘
                           ▼
                    PostgreSQL 14+
```

Every workflow follows **3 layers**:

1. **Controller** — HTTP concern only. Auth guard → DTO-validate → call service → 200/201 + JSON.
2. **Service** — pure business rules. Takes domain inputs (date strings, ids, dto fields, `now = new Date()` for test clock injection), returns plain objects.
3. **Prisma transaction** — concurrency handled inside the service with `$transaction` + row locks where required (see [dispatch-workflow.service.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/dispatch-workflow.service.ts#L119-L138) for the advisory-lock pattern used on drops/orders/units).

### Domain modules and what each owns

| Nest module | Owns | Source |
|---|---|---|
| `auth` | JWT issuance, login/me, `@Roles()` + `RolesGuard` | [auth/](file:///d:/Kitchen_Admin/backend/src/auth) |
| `orders` | Order creation quoting/validation, cut-off math, cut-off processing (idempotent), kitchen/dispatch ready-time planning, list/detail queries | [orders/](file:///d:/Kitchen_Admin/backend/src/orders) |
| `kitchen` | Kitchen board query, unit provisioning, unit start/done, admin force-complete, optimistic-concurrency-safe transitions | [kitchen/](file:///d:/Kitchen_Admin/backend/src/kitchen) |
| `dispatch` | Drop grouping (by company+canonical-addr+date+time), driver assignment, K→DR→O→D machine, driver workload listing | [dispatch/](file:///d:/Kitchen_Admin/backend/src/dispatch) |
| `driver` | Authenticated driver's today drops, drop detail, on-time delivery completion, optional note + photo URL | [driver/](file:///d:/Kitchen_Admin/backend/src/driver) |
| `billing` | Uninvoiced-candidates list, invoice grouping/creation, payment marking, paginated invoice list with filters | [billing/](file:///d:/Kitchen_Admin/backend/src/billing) |
| `pricing` | Tier listing, dish/option price matrix, per-item overrides, calls into OrderPricing for effective-price resolution | [pricing/](file:///d:/Kitchen_Admin/backend/src/pricing) |
| `catalogue` | Dishes, categories, allergens, dietary tags, option groups, options, reference kitchen stations + portion sizes, menu preview as a given employee | [catalogue/](file:///d:/Kitchen_Admin/backend/src/catalogue) |
| `companies` | Companies, domains, addresses, holidays, hidden categories/dishes, default driver, default delivery times, CSV employee import | [companies/](file:///d:/Kitchen_Admin/backend/src/companies) + [employees/](file:///d:/Kitchen_Admin/backend/src/employees) |
| `users` | Admin staff account CRUD with role assignment | [users/](file:///d:/Kitchen_Admin/backend/src/users) |
| `settings` | Kitchen working days, kitchen holidays, cut-off day-count + clock, reference kitchen stations/portion sizes | [settings/](file:///d:/Kitchen_Admin/backend/src/settings) |
| `dashboard` | Single `GET /admin/dashboard/summary` for the Admin landing page (other dashboards query their domain boards) | [dashboard/](file:///d:/Kitchen_Admin/backend/src/dashboard) |

Authorization is **not UI-level**. Every route has `@UseGuards(JwtAuthGuard, RolesGuard) @Roles(...)` on the controller; the browser hides buttons purely for UX. See every controller in the table above — all have the guard+roles decoration (e.g. [kitchen.controller.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen.controller.ts#L17-L47)).

---

## 3. Data model

### Prisma schema location

Full schema: [`backend/prisma/schema.prisma`](file:///d:/Kitchen_Admin/backend/prisma/schema.prisma). Migrations in [`backend/prisma/migrations`](file:///d:/Kitchen_Admin/backend/prisma/migrations) — linearised SQL per change, numbered, never hand-edited.

### Core relationships

```mermaid
erDiagram
    COMPANY }o--o| PRICE_TIER : "price tier"
    COMPANY ||--o{ COMPANY_EMAIL_DOMAIN : owns
    COMPANY ||--o{ COMPANY_ADDRESS : has
    COMPANY ||--o{ EMPLOYEE : employs
    COMPANY ||--o{ INVOICE : billed
    COMPANY ||--o{ DELIVERY_DROP : drops
    COMPANY ||--o{ COMPANY_HOLIDAY : closes
    EMPLOYEE }o--o| COMPANY : "owner"
    EMPLOYEE ||--o{ ORDER : places_for
    EMPLOYEE }o--o{ ALLERGEN : "allergens via EmployeeAllergen"
    EMPLOYEE }o--o{ DIETARY_TAG : "pref via EmployeeDietaryPreference"

    CATEGORY ||--o{ DISH : contains
    DISH ||--o{ DISH_ALLERGEN : tagged
    DISH ||--o{ DISH_DIETARY_TAG : tagged
    DISH }o--|| KITCHEN_STATION_REF : routed
    DISH }o--o{ OPTION_GROUP : via DishOptionGroup
    OPTION_GROUP }o--o{ OPTION : via OptionGroupOption
    OPTION_GROUP ||--o{ OPTION_PORTION : sizes
    OPTION_PORTION }o--|| PORTION_SIZE_REF : reference

    PRICE_TIER ||--o{ DISH_PRICE : prices_dish
    PRICE_TIER ||--o{ OPTION_PRICE : prices_option
    PRICE_TIER }o--o| PRICE_TIER : "derive via baseTierId"

    ORDER }o--|| COMPANY : billed_to
    ORDER }o--|| DELIVERY_DROP : assigned
    ORDER }o--|| INVOICE : billed_on
    ORDER ||--|{ ORDER_LINE : has_lines
    ORDER_LINE }o--|| DISH : snapshot_of
    ORDER_LINE ||--|{ ORDER_COMBINATION : splits_into
    ORDER_COMBINATION ||--|{ ORDER_COMBINATION_OPTION : selects
    ORDER_COMBINATION ||--|| KITCHEN_UNIT : one_prep_unit
    KITCHEN_UNIT }o--|| KITCHEN_STATION_REF : routed_to

    USER ||--o| DRIVER : "staff account link"
    DRIVER }o--|| COMPANY : employed_by
    DRIVER ||--o{ DELIVERY_DROP : assigned
```

### Design notes — why these tables

1. **Snapshots everywhere on write, never join Dish/Category live into an Order** — [`OrderLine.dishNameSnapshot`](file:///d:/Kitchen_Admin/backend/prisma/schema.prisma#L366-L370) stores the name/sku/unit-price of the dish, [`OrderCombinationOption`](file:///d:/Kitchen_Admin/backend/prisma/schema.prisma#L411-L426) stores option name + price + portion size + extra price *at order time*. Changing a catalogue price later never edits a past order (§4.1).

2. **One `KitchenUnit` per combination** (unique constraint `@@unique([orderCombinationId])` on `KitchenUnit` in schema) — satisfies §4.7 "each distinct combination on an order line is one unit". Provisioning happens exactly once at order-creation time via [kitchen-unit-provisioning.service.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen-unit-provisioning.service.ts).

3. **One `DeliveryDrop` per (company, date, canonical-addr, exact delivery time)** (unique constraint on `DeliveryDrop`) — satisfies §4.8 "same company + same address + same exact time = one drop". Keyed via a canonical address hash in [delivery-address.util.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/delivery-address.util.ts).

4. **Roles are enum `Role`** and matched by `RolesGuard` (string set membership), but adding a new role only requires adding one `Role.X` enum value, adding it to endpoints that should permit it, and updating the frontend role→navigation map. No per-role `if (role==='ADMIN')` is sprinkled into services (all service checks are capability-oriented: order-edit-lock check, driver-company check, etc.).

5. **Money** is stored as `@db.Decimal(10, 2)` everywhere and manipulated in-memory with `Prisma.Decimal` or string arithmetic *only*. No `number`. No floats. Totals reconcile transactionally (see §7).

6. **Deactivation over deletion** for dishes (`active: Boolean`), options, categories, stations, portion sizes. Historical FKs live on.

---

## 4. Key decisions & trade-offs

### 4.1 Auth transport: Bearer first, cookie second (why)
Cross-origin deployments (Vercel frontend + Render backend) cause `SameSite=None + Secure` cookie **silent drops** when the caller site is HTTP (localhost) or when certain browsers treat the cookie scheme-mismatch as unsafe. Bearer tokens in the body (`/auth/login` returns `accessToken`) are immune to this. We keep cookies too because future same-frontend-origin deployments *benefit* from HttpOnly cookies. This is belt + suspenders, not redundancy: [jwt.strategy.ts](file:///d:/Kitchen_Admin/backend/src/auth/strategies/jwt.strategy.ts#L17-L32) tries Bearer → cookie → `X-Access-Token`.

### 4.2 `Asia/Kolkata` as a compile-time constant
The spec says "the kitchen operates in one time zone". We chose India Standard Time (UTC+05:30) and made it a single source of truth in `calendar-time.ts`, then used a `DATE + HH:MM → "1970 day trick"` for `deliveryTime` storage + a `toIstDateTime(dateStr, clockStr)` function. **All math is done with the offset, never the server's system clock**: cut-offs, today, invoice date ranges, kitchen/driver "now" comparisons.

If we later serve multiple kitchens, we move the tz to a `Kitchen` table and parameterize the services.

### 4.3 Pricing derivation: COST_MULTIPLIER / TIER_MARKUP / MANUAL
Three `PricingRuleType`s stored in `PriceTier` (no complex tables for rules):
- `COST_MULTIPLIER` → effectivePrice = `ceil05(cost * multiplier)`
- `TIER_MARKUP` → effectivePrice = `ceil05(baseTierPrice * (1 + markupPercent/100))`
- `MANUAL` → effectivePrice = `overridePrice`, which must be set explicitly

`ceil05` = always rounds **up** to the next 5 cents (`$2.11 → $2.15`) — matches §4.3 #6. Individual dish/option overrides take precedence over derivation.

See the effective-price logic used throughout: [order-pricing.service.ts](file:///d:/Kitchen_Admin/backend/src/orders/order-pricing.service.ts) (tested in [order-pricing.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/order-pricing.service.spec.ts)).

### 4.4 Transactions + row-version-ish compare-and-swap for concurrency
For the two hot workflows — drop transitions & unit transitions — we:
1. `$queryRaw` a Postgres advisory lock on the table+id inside a `$transaction` (see [dispatch-workflow.service.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/dispatch-workflow.service.ts#L119-L138)), OR
2. Use an `updateMany` with `where` that includes the *expected current state* and assert `updated.count === 1`. Two concurrent "mark done" on the same unit → one wins cleanly, the other gets `ConflictException('Drop state changed; reload and retry')`.

No explicit version column needed yet; `status + id` predicate is enough because we have strict state machines.

### 4.5 Frontend fetcher with typed endpoints
The frontend has a single typed [api.ts](file:///d:/Kitchen_Admin/frontend/src/lib/api.ts) — `request<T>()`, `login()`, `getMe()`, plus `admin / kitchen / dispatch / driver` namespaces. We did not add TanStack Query/Redux because:
- screens are small,
- mutations do the refetch explicitly (simpler, less state to reconcile),
- scope is large and we wanted to spend engineering tokens on **backend correctness**, not fetch cache.

### 4.6 No photo binary storage, only photo URLs
The spec allows us to "simulate" out-of-scope subsystems. We accept an externally-hosted HTTPS `deliveryPhotoUrl` string from the driver (validated as URL). Binary S3/R2/Cloudinary upload + ACL + signed URL lifecycle is deliberately cut (see §6 — skipped items).

### 4.7 "Invoiced orders" policy (§4.9 ambiguity)
We interpreted:
- Once an invoice is `ISSUED`, **the orders on it are frozen** from the invoice's perspective: their order rows can still mutate (admin override time, address, packaging, cancellation, a delivered order that later is marked short), but **we do not auto-adjust the invoice total nor create credit notes**.
- Documented rule for reviewers: *"If an order changes after invoicing, the invoice stays as-issued; a new invoice/credit-note endpoint will be added in a follow-up. To reconcile, cancel the order (via admin) and create a new invoice."*

Pragmatic choice: keeps a clean `Invoice.totalAmount = SUM(Order.totalAmount) WHERE invoiceId = x` invariant while still letting admin override orders.

---

## 5. Dashboard definitions (§4.11)

Four landing dashboards — one per role. All numbers are **server-calculated**; the frontend only renders.

### 5.1 Admin dashboard — `GET /admin/dashboard/summary`

Called from the ADMIN landing, defaulting to today in IST. Supports `?deliveryDate=YYYY-MM-DD`.

Source: [dashboard.service.ts](file:///d:/Kitchen_Admin/backend/src/dashboard/dashboard.service.ts#L10-L55).

| Tile | Shown value | Exact calculation | Date grouping | Orders counted / excluded |
|---|---|---|---|---|
| `kitchen.confirmedOrders` | Orders in the kitchen for the chosen date | `COUNT(order)` where `status = CONFIRMED AND deliveryDate = chosenDate` | `deliveryDate` date-only in IST `Asia/Kolkata`; date stored as Postgres `DATE`. | Only confirmed. DRAFT/PLACED/REJECTED/CANCELLED/DELIVERED excluded. |
| `kitchen.totalUnits` | Prep units to cook today | `COUNT(kitchenUnit)` where order = confirmed & chosen date | same as above | Unit not started / started / done all counted. Cancelled orders excluded. |
| `kitchen.startedUnits` | Units in progress now | same COUNT with `status = STARTED` | same |  |
| `kitchen.doneUnits` | Units cooked | same COUNT with `status = DONE` | same |  |
| `kitchen.atRiskOrders` | Confirmed orders at risk of late prep | `COUNT(order)` with status CONFIRMED, chosen date, `plannedKitchenReadyAt < summary.generatedAt AND kitchenReadyAt IS NULL` | chosen delivery date; "at time of request" comparison uses server `now`. | Any confirmed order whose planned kitchen-ready time *already passed* without any ready timestamp — even if still early by clock but late by plan. |
| `dispatch.drops` | Delivery drops scheduled today | `COUNT(DeliveryDrop)` where `deliveryDate = chosenDate` | chosen `deliveryDate` | Cancelled orders never form a drop (drop created for confirmed orders only; cancelled → removed from drop). |
| `dispatch.unassignedDrops` | Drops with no driver yet | `COUNT(DeliveryDrop)` where chosen date AND `driverId IS NULL` | same |  |
| `dispatch.outForDeliveryDrops` | Drops on the road | same with `status = OUT_FOR_DELIVERY` | same |  |
| `dispatch.deliveredDrops` | Completed drops | same with `status = DELIVERED` | same |  |
| `dispatch.lateDrops` | Delivered drops that were late | same with `status = DELIVERED AND deliveredOnTime = false` | same | Late is *strictly* any drop whose `deliveredAt` > `deliveryTime` for that IST date (0 grace minutes). |
| `billing.uninvoicedConfirmedOrders` | Number of orders to invoice | `COUNT(order)` where `status = CONFIRMED AND invoiceId IS NULL` | **NOT grouped by delivery date** (operational attention: "what needs billing now"). | Drawn from *all dates*. Delivered / rejected / draft / cancelled excluded. |
| `billing.uninvoicedConfirmedAmount` | Amount owed | `SUM(order.totalAmount)` where `status = CONFIRMED AND invoiceId IS NULL` | same | Stored Decimal sum, returned as a 2-decimal string to avoid float display. Empty set → `0.00`. |
| `catalogue.activeDishes` | Active dishes count | `COUNT(dish) WHERE active = TRUE` | Not date-grouped. |  |
| `catalogue.activeCategories` | Active categories count | `COUNT(category) WHERE active = TRUE` | same |  |

What the admin dashboard does **NOT** show (intentional omission):
- Revenue by time (nice-to-have, not operational; admin first needs cut-off/burn-down visibility).
- Employee-level activity; kept on Employee detail page.
- Charts — tiles + lists win because this is an operations morning dashboard, not a BI tool.

### 5.2 Kitchen board — Kitchen role landing

This *is* the dashboard: a date-picker, per-station filter, per-status filter, and card grid of **orders** with **prep units** inside each.

Source: [kitchen-board.service.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen-board.service.ts#L47-L124). The UI (frontend workspace `Kitchen`) renders exactly this data — no derived math in the browser.

What's shown:
- A card per **confirmed** order for the chosen delivery date (default: today IST). Sorted `plannedKitchenReadyAt ASC, id ASC` (earliest planned prep is top).
- Each card shows: company, employee, planned kitchen-ready time, planned dispatch-ready time, aggregate progress (started/done units).
- Inside each card, one "prep line" per combination → `unit` (1:1). Each line has station, quantity, dish, chosen options, status chip, start button, done button.
- A progress-percentage per order: `completed / total * 100` where completed = `KitchenUnit.status = DONE`, total = all units for the order *respecting the applied station/status filters* (UI-level only for tiles, backend returns unfiltered totals too).

Calculations (server-side):
- `isAtRisk` on an order line is emitted by the backend iff `plannedKitchenReadyAt < NOW AND kitchenReadyAt IS NULL`. (Same definition as admin dashboard; one source of truth.)
- `plannedKitchenReadyAt = plannedDispatchReadyAt - 30 min`.
- `plannedDispatchReadyAt = deliveryTime - company.deliveryMinutes` (default `60 min`).
Both are set at order creation and re-computed when admin changes delivery time.

What we chose **not** to show:
- Daily totals in quantities by dish (nice aggregation for the lead; board stays scannable for 400 order days).
- Export/prep sheet (explicitly out of scope per spec §5).

### 5.3 Dispatch board — Dispatch role landing

Source of truth: the drops table + driver workload API. See [dispatch-board.service.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/dispatch-board.service.ts) / [dispatch-workflow.service.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/dispatch-workflow.service.ts).

What's shown, per chosen date (default today IST):
- A **drop list** card per `(company, canonical address, exact time)` bucket.
- Each drop card: status chip (KITCHEN_READY / DISPATCH_READY / OUT_FOR_DELIVERY / DELIVERED), driver selector defaulting to company default driver, `Assign`, `Mark dispatch-ready`, `Start delivery` buttons, count of orders in the drop.
- Driver workload sidebar: per-driver count of *undelivered* drops for today or later (so dispatchers avoid piling 12 drops on 1 driver).

Calculations:
- `onTime` = if `deliveredAt <= deliveryTime (as DateTime in IST on delivery date)`, else late. Recomputed on every status change.
- Driver "capacity numbers" = `COUNT(DeliveryDrop) WHERE driverId = X AND status IN (READY, DISPATCH_READY, OUT_FOR_DELIVERY) AND deliveryDate >= TODAY IST`.

Omissions (intentional):
- Route optimisation / ETA maps — out of scope per problem (no geocoding, no app with maps).
- Per-order view on dispatch page; they click through to the order page for detail.

### 5.4 Driver today view — Driver role landing

Mobile-first. Source: [driver-drop.service.ts](file:///d:/Kitchen_Admin/backend/src/driver/driver-drop.service.ts#L22-L68). Scope is hardened server-side: driver can see only drops whose `driverId == authenticatedDriverId AND deliveryDate == TODAY_IST`. No way to sneak another driver's drop via the id detail endpoint either (we check driverId again there).

Shown per drop, sorted by delivery time ASC, id ASC:
- Drop card: company name, delivery address snapshotted, delivery time, status chip, order count.
- Drop detail: list of orders (employee names + emails), packaging snapshotted, driver instructions (first non-null across orders).
- Delivery panel: text note input, photo URL input, Mark delivered button.

Calculations:
- On-time flag stored at delivery: `deliveredAt <= drop.deliveryTime combined with deliveryDate` → `true`, else → `false`. No grace minutes. If the clock on the driver's phone is wrong, server time rules.
- Drop status machine enforced server-side: drop must be `OUT_FOR_DELIVERY` and owned by that driver.

What we did **not** show:
- Past dates. Driver view is "today's work list"; history is on the dispatch/admin pages.
- Chat / phone with dispatcher (not in scope).

---

## 6. Prioritisation (section 6)

**The rule I used**: every `[Must]` passes server-side validation/auth first; UI is second. `[Should]` is implemented only after every `[Must]` has a happy-path e2e flow and at least one unit test. `[Could]` gets nothing.

### 6.1 `[Must]` — status per requirement

| Req | Built? | Notes & honest status |
|---|---|---|
| 4.1 Catalogue Dishes (name/desc/img/SKU/temp/cost/allergens/dietary/station/MOQ, deactivate not delete) | ✅ | Dish + DishAllergen + DishDietaryTag + KitchenStationReference; soft delete via `Dish.active`. Seeded. |
| 4.1 Options & OptionGroups, required/optional/order, ordering in group | ✅ | Option + OptionGroup + OptionGroupOption.displayOrder + DishOptionGroup |
| 4.1 Reference data (allergens, dietary tags, stations, portions) | ✅ | Settings module endpoints + `KitchenStationReference`, `PortionSizeReference`, `Allergen`, `DietaryTag` tables |
| 4.1 Combinations sum exactly to dish qty, required groups satisfied | ✅ | Server validation in OrderCreationService (throws 400 with details). Unit-tested. |
| 4.1 Price of a combination, line total, order total reconciled | ✅ | Prisma.Decimal math everywhere. See `order-creation.service.spec.ts` + `order-pricing.service.spec.ts`. |
| 4.1 Order stores immutable snapshots | ✅ | OrderLine / OrderCombinationOption snapshots for every priced / named thing. |
| 4.2 Menu categories + items, ordered, activate/deactivate | ✅ | Category + Dish. Both have active/displayOrder. |
| 4.2 Category / Dish hidden per company + secret categories | ✅ | `CompanyCategoryRestriction`, `CompanyDishRestriction`, `Category.secret` boolean. Menu preview endpoint filters them. |
| 4.2 Staff preview menu **as employee X** (applies pricing + hiding rules) | ✅ | `GET /catalogue/menu-preview?employeeId=` returns priced dishes. |
| 4.3 #1–6 Tier pricing — named tiers, one default, per-company tier, employee resolves to company-tier else default, missing-price dish hidden, derivation with round-up 5c | ✅ | PriceTier `{ MANUAL, COST_MULTIPLIER, TIER_MARKUP }`. Effective prices computed by a single service. Missing dish → null → filtered out of employee menu preview. |
| 4.3 #7 Fast tier editor + missing-price spotting | ✅ | `GET /pricing/tier/{id}/dishes` returns each row's `state ∈ { MISSING, DERIVED, OVERRIDE }` + `effectivePrice`. |
| 4.3 #8 Price edits → new orders only | ✅ | Historical orders have snapshots, never re-resolved on edit. |
| 4.4 Companies (domains, addresses, billing, owner, working days, holidays, delivery defaults, default driver, standing instructions, hidden menu, tier) | ✅ | Company + CompanyEmailDomain + CompanyAddress + CompanyHoliday. |
| 4.5 Employees (one company, can change addr/time/pack, allergens, dietary pref, move between companies) | ✅ | Employee model has 3 permission flags + FK companyId; move = just update FK. |
| 4.6 Cut-off calculation by N kitchen working days + configured clock time | ✅ | [cutoff-calculator.service.ts](file:///d:/Kitchen_Admin/backend/src/orders/cutoff-calculator.service.ts#L13-L42). Skips kitchen non-working days + holidays. IST clock. Unit tested. |
| 4.6 Create order flow (date → menu → option combinations → per-line price breakdown → total) | ✅ | OrderCreationService with dry-run / quoteBeforeSubmit switch; frontend shows quote before POST to place. |
| 4.6 Drafts allowed, server-side validation for all rules | ✅ | Order.status default DRAFT; draft/placed can be edited pre-cutoff except by admin post-cutoff. |
| 4.6 Statuses Draft → Placed → Confirmed → Delivered, plus Cancelled, Rejected | ✅ | OrderStatus enum, transitions guarded in OrdersService. |
| 4.6 Cut-off processing: drafts cancelled, placed confirmed, idempotent + manually triggerable | ✅ | [cutoff-processor.service.ts](file:///d:/Kitchen_Admin/backend/src/orders/cutoff-processor.service.ts). Only rows whose `status` *still* can transition are touched (SQL `where includes status predicate` → idempotent). Scheduler runs each minute + admin endpoint. |
| 4.6 Order list (searchable, paginated, filter: date range, status, company, invoiced) + detail with lines + timeline | ✅ | GET /orders (pagination with limit/offset, filters). Detail with lines/combos/options/money/delivery + statusHistory timeline. |
| 4.6 Admin can override delivery time/address/packaging after confirm | ✅ | PATCH /orders/:id with Admin-only role. Re-plans kitchen/dispatch ready. |
| 4.7 Kitchen board by date, per combination = 1 unit, routed by station, filter by station/status; start/done with no-repeat; allow direct done; first-start/kitchen-ready timestamps; planned times; risk; admin force-complete | ✅ | KitchenBoardService + KitchenUnitWorkflowService. Everything required by the must-clauses; unit & e2e tests. |
| 4.8 Drop grouping by company+addr+time, dispatch driver-per-drop, K→DR→O→D state machine, driver assignment, on-time flag | ✅ | [drop-grouping.service.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/drop-grouping.service.ts) + workflow service + driver-drop service. |
| 4.8 Driver mobile view for today, only own drops, note + optional photo URL, on-time record | ✅ |  |
| 4.9 Confirmed is billed per company, list uninvoiced → group into invoice, mark paid. Order on ≤1 invoice | ✅ | Order.invoiceId nullable + unique on (invoiceId, orderId) implicit via relation. Invoice status ISUED/PAID. |
| 4.9 Order changes after invoicing handling (documented) | ⚠️ (Policy, not code) | Documented in §4.7 of this README: invoice totals frozen; no auto adjustment. Admin action: create new invoice if needed. |
| 4.10 Settings (kitchen working days, holidays, cut-off day+time) | ✅ | KitchenCalendarConfig + admin endpoints. Kitchen station & portion-size refs also settings |
| 4.11 Dashboards per role | ✅ | 4 dashboards defined + calculated server-side (see §5) |
| 2 Staff accounts + 4 roles with exact credentials | ✅ | Seed creates admin/kitchen/dispatch; driver linked to a company |
| 2 Realistic data on live | ✅ | Seed: several companies with employees, 15 dishes across tiers, orders DRAFT/PLACED/CONFIRMED/DELIVERED across past 5 days → +15 days, driver drops for today pre-assigned to driver@test.com |

### 6.2 `[Should]` — status

| Req | Built? | Notes |
|---|---|---|
| 4.1 Portions (Regular/Large, per option-portion extra price, per group on/off) | ✅ | PortionSizeReference + OptionPortion + `usesPortions` boolean on OptionGroup |
| 4.5 CSV employee bulk import with row-level errors, no total reject | ✅ | `parseCsvRecords` + EmployeesService CSV import; returns `{ created, rowErrors }`. |

### 6.3 `[Could]`

Nothing explicitly implemented (as planned).

### 6.4 Ambiguous requirements — how I interpreted them

- **"Dish temperatures (hot/cold)"** — stored as free-form String `temperature` on Dish (UI dropdown uses Hot/Cold values; allows future Frozen/Ambient without a schema change).
- **"Cut-off day counter — kitchen calendar vs company calendar"** (4.4 vs 4.6). 4.4 says company non-working days **prevent delivery that day**, and 4.6 says **only kitchen calendar** moves the cut-off. So we implemented: company blocks delivery on non-working days (validation at order create), but cut-off N-working-days count is based solely on **kitchen** working days + holidays, as per the line "Only the kitchen calendar does" in §4.4. Both behaviors are tested.
- **"On-time delivery definition" (4.8)** — strict: delivery completed timestamp greater than drop's delivery time (on that date in IST) is late. No 1-minute/5-minute grace.
- **"Order changes after invoicing" (4.9)** — Policy above. Invoice totals are snapshotted & immutable; no auto-adjust.
- **"Derive prices from another value — Standard price + 15% or cost × 2.4"** (4.3 #6) — exactly two derivation rule types implemented (`COST_MULTIPLIER` and `TIER_MARKUP`), R5 cent rounding, per-item override escape hatch.

### 6.5 What I explicitly skipped + why

- **Binary photo upload (S3/R2 presigned URLs, bucket, ACL)** — not needed for review (driver stores a URL). Would add infra config + signed-URL rotation complexity beyond 48h.
- **Audit log** for every mutation — out of §5 scope.
- **Export CSVs / reports (prep sheets, delivery labels)** — out of §5 scope.
- **Server-actions-freeze / API routes in Next.js** — no server actions for business (as per spec). All mutations go through NestJS via `api.ts`.
- **Email/notifications** — per §5, log to console.
- **UI unit/E2E tests (Playwright)** — budget went into backend domain tests where the math lives; 50+ unit tests across pricing/cutoff/orders/kitchen/dispatch/driver.

---

## 7. Non-functional correctness

### 7.1 Money accuracy
- Stored as `Decimal(10,2)` in Prisma/Postgres.
- In memory: `Prisma.Decimal` for all arithmetic (`*`, `+`, `/`).
- No `Number` casts anywhere in the pricing path.
- Two invariants **transactionally enforced**:
  1. `OrderLine.lineTotal = SUM(OrderCombination.totalPrice)` for the line.
  2. `Order.totalAmount = SUM(OrderLine.lineTotal)` for the order.
  3. `Invoice.totalAmount = SUM(Order.totalAmount WHERE invoiceId = x)`.

### 7.2 Time zones
- One constant, `APPLICATION_TIME_ZONE = 'Asia/Kolkata'` (see [calendar-time.ts](file:///d:/Kitchen_Admin/backend/src/orders/calendar-time.ts#L4-L5)).
- Every `YYYY-MM-DD` date string is treated as a wall-calendar date in IST and converted to a Postgres `DATE`.
- Cut-off `HH:MM` is interpreted as an IST clock. No usage of `new Date()` without adding the offset first.

### 7.3 Concurrency
- Every drop transition + kitchen unit transition + order status transition runs inside a **Prisma `$transaction`** with a status-aware `updateMany` predicate (`where` clause includes the *expected current status*) + count assert. Two concurrent requests → exactly one row updated; second throws `ConflictException: state changed; reload and retry`.
- For drops we additionally take a Postgres advisory lock.
- Order creation is fully transactional: if any combination/line/unit insertion fails, the whole order rolls back.

### 7.4 Validation
- Every controller uses Nest global `ValidationPipe({ whitelist: true, transform: true })` and class-validator DTOs.
- Business-level validation in services (e.g. "the combination quantities sum to `line.quantity`", "required groups are satisfied", "delivery day is a company working day and is not a holiday", "employee can change delivery time").
- Errors returned with structured messages (not `500`) so the form can highlight the field.

### 7.5 Performance / pagination
- Order list: `limit / offset`.
- Invoice list: `limit / offset`.
- Kitchen board: DB-side filtering on `status`, `deliveryDate`, nested `kitchenUnits.station`.
- Target: 400 orders on a day → 400 `Order` rows with `lines.combinations.kitchenUnits` — acceptable with the current indexes (see `@@index` annotations in schema).

---

## 8. Tests

### Backend unit tests (Vitest) — **50+ cases**

Run: `cd backend && npx vitest run`

| File | Coverage focus |
|---|---|
| [cutoff-calculator.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/cutoff-calculator.service.spec.ts) | Working-day counting back, kitchen holidays skip, weekend skip, arbitrary calendars, IST clock independence. |
| [cutoff-processor.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/cutoff-processor.service.spec.ts) | Idempotency: running twice for same date produces same final DB state; draft→cancelled, placed→confirmed transition only. |
| [order-creation.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/order-creation.service.spec.ts) | 12 cases: combination math, combination-sum validation, employee-delivery-permission enforcement, missing price rejection, total override rejection, company-holiday + non-working day rejection, late-order requires admin override flag, transaction rollback. |
| [order-pricing.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/order-pricing.service.spec.ts) | Cost-multiplier with 5c ceiling, explicit override wins, tier markup, base-tier markup propagation. |
| [order-planning.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/orders/order-planning.service.spec.ts) | Kitchen/dispatch ready-time math in IST, invalid lead-time rejection. |
| [kitchen-unit-provisioning.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen-unit-provisioning.service.ts) | 1 unit per combination with station; zero-combination orders → no units. |
| [kitchen-unit-workflow.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen-unit-workflow.service.spec.ts) | Start/Done/Done-directly/first-start-timestamp/kitchen-ready-after-last/serialized concurrent final completion/force-complete/invalid transitions. |
| [kitchen-board.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/kitchen/kitchen-board.service.spec.ts) | Filters, progress, station mapping. |
| [dispatch-workflow.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/dispatch-workflow.service.spec.ts) | Driver must match company, assign/dispatch-ready → out-for-delivery atomically, transitions only from expected previous, order kitchen-readiness guard. |
| [delivery-address.util.spec.ts](file:///d:/Kitchen_Admin/backend/src/dispatch/delivery-address.util.spec.ts) | Address canonicalization, same-company/date/time group; differing street → different groups. |
| [driver-drop.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/driver/driver-drop.service.spec.ts) | Only today + only that driver, on-time = strict <= scheduled, other-driver access forbidden, duplicate delivery forbidden. |
| [csv-parser.spec.ts](file:///d:/Kitchen_Admin/backend/src/employees/csv-parser.spec.ts) | Commas in quotes, escaped quotes, multi-line values, malformed input. |
| [settings.service.spec.ts](file:///d:/Kitchen_Admin/backend/src/settings/settings.service.spec.ts) | Station normalization, station deactivation blocks if active dish or unfinished unit references it, same protections for portion size. |

### Backend e2e tests (supertest, vitest, in-memory-ish Postgres)

Run: `cd backend && npx vitest run --config vitest.config.e2e.ts`

- `test/auth.e2e-spec.ts` — login + me
- `test/kitchen*.e2e-spec.ts` — kitchen board and workflow over HTTP
- `test/dispatch-driver-*.e2e-spec.ts` — drop lifecycle + driver auth
- `test/order-transaction.e2e-spec.ts` — concurrency + rollback

### Frontend validation
- `npm run lint` (eslint config from Next)
- `npm run typecheck` (strict TS)
- `npm run build`

---

## 9. Next steps with more time

Ranked in expected ROI, given the current feature set:

1. **Photo upload endpoint** — R2 bucket, worker upload-signed URL, server-validated image mime-type, delete-old-photo hook at upload time. Today we only accept URLs.
2. **Invoice adjustments / credit notes** — formalize the documented policy into an endpoint so post-invoice edits have explicit accounting records.
3. **Better pagination (cursors + totals)** — current lists use `limit/offset` without total-count metadata in most cases; add `X-Total-Count` or wrap responses in `{ data, meta: { total } }` for bigger datasets.
4. **Driver geolocation & basic route ordering** — even without maps, accept driver GPS pings, store ETA per drop.
5. **Role-based row-level security policies generalized** — today roles guard endpoints (good enough), but if we add a "manager" or "viewer" role, create a capability matrix table and remove `@Roles(X,Y)` in favor of `@RequirePermissions('orders.edit')`.
6. **Scheduled task runner** — replace the 1-minute loop scheduler with an idempotent cron (Render cron, Temporal) so cut-offs run even if only one instance lives.
7. **UI end-to-end tests** — Playwright for happy paths (login, create order, mark unit done, assign driver, deliver drop) so UI regressions don't ship.
8. **Soft-delete for companies + employees** (not deletion today either; just no explicit deleted flag yet).
