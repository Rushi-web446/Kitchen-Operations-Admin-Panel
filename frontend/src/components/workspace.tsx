"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  assignDriver,
  addKitchenHoliday,
  createKitchenStation,
  createPortionSize,
  addCompanyHoliday,
  createCompany,
  createDish,
  createEmployee,
  createInvoice,
  createOrder,
  createOrderQuote,
  createStaffUser,
  createCategory,
  createAllergen,
  cancelOrder,
  createDietaryTag,
  createOption,
  createOptionGroup,
  getCatalogueReferenceData,
  deliverDrop,
  getKitchenSettings,
  getMenuPreview,
  finishKitchenUnit,
  forceCompleteKitchenOrder,
  getCompanyTier,
  getCompany,
  getCurrentUser,
  getEmployeeReferenceData,
  getDashboardSummary,
  importEmployeesCsv,
  getDriverDrop,
  getDriverDrops,
  getInvoice,
  getKitchenOrders,
  getOrder,
  getUninvoicedOrders,
  groupReadyOrders,
  listDispatchDrops,
  listCompanies,
  listCategories,
  listDishes,
  listDrivers,
  listEmployees,
  listOptions,
  listOptionGroups,
  listInvoices,
  listKitchenStations,
  listPortionSizes,
  listDispatchDrivers,
  listOrders,
  listStaffUsers,
  listTiers,
  logout,
  markDropReady,
  markInvoicePaid,
  processOrderCutoff,
  rejectOrder,
  removeKitchenHoliday,
  removeCompanyHoliday,
  saveTierDishPrices,
  saveTierOptionPrices,
  sendDropForDelivery,
  updateCompany,
  updateConfirmedOrder,
  updateCategory,
  updateDish,
  updateEmployee,
  updatePendingOrder,
  updateKitchenSettings,
  updateKitchenStation,
  updatePortionSize,
  updateOption,
  updateOptionGroup,
  getTierDishPrices,
  getTierOptionPrices,
  startKitchenUnit,
  type AddressSnapshot,
  type AuthRole,
  type AuthUser,
  type StaffUser,
  type CatalogueCategory,
  type CatalogueDish,
  type CatalogueOption,
  type Company,
  type CompanyInput,
  type DriverProfile,
  type DispatchDrop,
  type DispatchDriver,
  type Employee,
  type EmployeeCsvImportResult,
  type DriverDrop,
  type DishInput,
  type KitchenOrder,
  type MenuPreview,
  type OptionGroupInput,
  type OptionGroup,
  type OptionInput,
  type KitchenStation,
  type KitchenUnitStatus,
  type InvoiceStatus,
  type OrderInput,
  type OrderQuote,
  type OrderStatus,
} from "@/lib/api";

const roleHome: Record<AuthRole, string> = {
  ADMIN: "/admin",
  KITCHEN: "/kitchen",
  DISPATCH: "/dispatch",
  DRIVER: "/driver",
};
const roleName: Record<AuthRole, string> = {
  ADMIN: "Administrator",
  KITCHEN: "Kitchen",
  DISPATCH: "Dispatch",
  DRIVER: "Driver",
};

type NavItem = { label: string; href: string; glyph: string };
const navigation: Record<AuthRole, NavItem[]> = {
  ADMIN: [
    { label: "Overview", href: "/admin", glyph: "◫" },
    { label: "Orders", href: "/admin/orders", glyph: "▤" },
    { label: "Companies", href: "/admin/companies", glyph: "⌂" },
    { label: "Employees", href: "/admin/employees", glyph: "♙" },
    { label: "Staff accounts", href: "/admin/staff", glyph: "♧" },
    { label: "Catalogue", href: "/admin/catalogue", glyph: "▦" },
    { label: "Menu preview", href: "/admin/menu", glyph: "☷" },
    { label: "Pricing", href: "/admin/pricing", glyph: "₹" },
    { label: "Billing", href: "/admin/billing", glyph: "▣" },
    { label: "Settings", href: "/admin/settings", glyph: "⚙" },
  ],
  KITCHEN: [
    { label: "Kitchen board", href: "/kitchen", glyph: "▦" },
  ],
  DISPATCH: [
    { label: "Dispatch board", href: "/dispatch", glyph: "⇢" },
  ],
  DRIVER: [
    { label: "Today's deliveries", href: "/driver", glyph: "⌖" },
  ],
};

export function WorkspaceLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => {
    let active = true;
    const onSessionExpired = () => router.replace("/");
    window.addEventListener("auth:expired", onSessionExpired);
    getCurrentUser()
      .then((current) => {
        if (!active) return;
        setUser(current);
        const allowedPrefix = `/${current.role.toLowerCase()}`;
        if (pathname !== allowedPrefix && !pathname.startsWith(`${allowedPrefix}/`)) {
          router.replace(roleHome[current.role]);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setAuthError(messageOf(error));
        router.replace("/");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      window.removeEventListener("auth:expired", onSessionExpired);
    };
  }, [pathname, router]);

  async function signOut() {
    setSigningOut(true);
    try {
      await logout();
      setUser(null);
      router.replace("/");
    } catch (error) {
      setAuthError(messageOf(error));
    } finally {
      setSigningOut(false);
    }
  }

  const allowedPrefix = user ? `/${user.role.toLowerCase()}` : "";
  if (loading || !user || (pathname !== allowedPrefix && !pathname.startsWith(`${allowedPrefix}/`))) {
    return (
      <main className="portal-loading">
        <span className="loading-mark" />
        <p>{authError || "Loading your operations workspace…"}</p>
      </main>
    );
  }

  return (
    <div className="portal-shell">
      {mobileOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`portal-sidebar${mobileOpen ? " portal-sidebar-open" : ""}`}>
        <Link className="portal-brand" href={roleHome[user.role]} onClick={() => setMobileOpen(false)}>
          <span className="portal-brand-mark">F</span>
          <span>heizen <i>kitchen</i><small>OPERATIONS</small></span>
        </Link>
        <div className="portal-nav-label">WORKSPACE</div>
        <nav className="portal-nav" aria-label="Main navigation">
          {navigation[user.role].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`portal-nav-link${pathname === item.href ? " portal-nav-active" : ""}`}
              onClick={() => setMobileOpen(false)}
            >
              <span className="portal-nav-glyph" aria-hidden="true">{item.glyph}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="portal-sidebar-foot">
          <span className="online-dot" /> Connected to operations API
        </div>
      </aside>
      <div className="portal-main">
        <header className="portal-topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>☰</button>
          <span className="portal-breadcrumb">HEIZEN <span>/</span> {roleName[user.role].toUpperCase()}</span>
          <div className="portal-user">
            <span className="portal-user-avatar">{user.email.slice(0, 1).toUpperCase()}</span>
            <span className="portal-user-info"><b>{roleName[user.role]}</b><small>{user.email}</small></span>
            <button className="portal-logout" onClick={signOut} disabled={signingOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
          </div>
        </header>
        <main className="portal-content">{children}</main>
      </div>
    </div>
  );
}

export function WorkspacePage({ pathname }: { pathname: string }) {
  const parts = pathname.split("/").filter(Boolean);
  const role = parts[0];
  if (role === "kitchen") return <KitchenPage />;
  if (role === "dispatch") return <DispatchPage />;
  if (role === "driver") return parts[1] === "drops" && parts[2] ? <DriverDetailPage id={parts[2]} /> : <DriverPage />;
  if (role === "admin") {
    if (parts[1] === "orders") {
      if (parts[2] === "new") return <CreateOrderPage orderId={parts[3] === "edit" ? parts[4] : undefined} />;
      return parts[2] ? <OrderDetailPage id={parts[2]} /> : <OrdersPage />;
    }
    if (parts[1] === "billing") return parts[2] === "invoices" && parts[3] ? <InvoiceDetailPage id={parts[3]} /> : <BillingPage />;
    if (parts[1] === "pricing") return <PricingPage />;
    if (parts[1] === "companies") return <CompaniesPage />;
    if (parts[1] === "employees") return <EmployeesPage />;
    if (parts[1] === "staff") return <StaffAccountsPage />;
    if (parts[1] === "catalogue") return <CataloguePage />;
    if (parts[1] === "menu") return <MenuPreviewPage />;
    if (parts[1] === "settings") return <SettingsPage />;
    if (parts[1]) return <UnsupportedPage section={parts[1]} />;
    return <AdminDashboard />;
  }
  return <AdminDashboard />;
}

function PageHeading({ eyebrow, title, description, action }: {
  eyebrow: string; title: string; description: string; action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div><p className="page-eyebrow">{eyebrow}</p><h1>{title}</h1><p className="page-description">{description}</p></div>
      {action && <div className="page-heading-action">{action}</div>}
    </div>
  );
}

function Panel({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return <section className="portal-panel"><header className="panel-heading"><h2>{title}</h2>{action}</header>{children}</section>;
}

function ErrorNotice({ error, onDismiss }: { error: string; onDismiss?: () => void }) {
  if (!error) return null;
  return <div className="notice notice-error" role="alert"><span>{error}</span>{onDismiss && <button onClick={onDismiss} aria-label="Dismiss error">×</button>}</div>;
}

function LoadingBlock({ text = "Loading live data…" }: { text?: string }) {
  return <div className="loading-block"><span className="loading-mark" /><span>{text}</span></div>;
}

function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return <div className="empty-state"><span className="empty-state-mark">—</span><b>{title}</b>{detail && <p>{detail}</p>}</div>;
}

function StatusBadge({ value }: { value: string }) {
  const tone = value === "PAID" || value === "DELIVERED" || value === "DONE" || value === "CONFIRMED"
    ? "good" : value === "OUT_FOR_DELIVERY" || value === "STARTED" || value === "DISPATCH_READY"
      ? "active" : value === "CANCELLED" || value === "REJECTED" ? "danger" : "neutral";
  return <span className={`status-badge status-${tone}`}>{humanize(value)}</span>;
}

function humanize(value: string) {
  return value.toLowerCase().split("_").map((word) => word[0]?.toUpperCase() + word.slice(1)).join(" ");
}

function formatMoney(value: string) {
  return `₹${value}`;
}

function prettyDate(date: string) {
  if (!date) return "—";
  const [year, month, day] = date.slice(0, 10).split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })
    .format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function addressText(address: AddressSnapshot) {
  return [address.addressLine1, address.addressLine2, address.city, address.region, address.postalCode, address.country]
    .filter((part): part is string => Boolean(part)).join(", ") || "Address not provided";
}

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "The request could not be completed.";
}

function useData<T>(loader: () => Promise<T>, dependencies: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const refresh = () => setReloadKey((key) => key + 1);
  useEffect(() => {
    let active = true;
    loader()
      .then((result) => {
        if (active) {
          setData(result);
          setError("");
        }
      })
      .catch((reason: unknown) => { if (active) setError(messageOf(reason)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
    // Loader dependencies are declared by each screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, reloadKey]);
  return { data, loading, error, refresh, setError };
}

function AdminDashboard() {
  const orders = useData(() => listOrders({ limit: 8, offset: 0 }), []);
  const [deliveryDate, setDeliveryDate] = useState(calendarDateInIndia());
  const summary = useData(() => getDashboardSummary(deliveryDate), [deliveryDate]);
  return (
    <>
      <PageHeading eyebrow="ADMINISTRATION / OVERVIEW" title="Operations overview" description="Server-calculated operational summary for the selected kitchen delivery date." action={<label className="dashboard-date">Delivery date<input type="date" value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label>} />
      <ErrorNotice error={orders.error || summary.error} />
      <div className="metric-grid metric-grid-3">
        <Metric label="Kitchen prep complete" value={summary.loading ? "…" : `${summary.data?.kitchen.doneUnits ?? 0}/${summary.data?.kitchen.totalUnits ?? 0}`} note={`${summary.data?.kitchen.confirmedOrders ?? 0} confirmed orders`} />
        <Metric label="Kitchen at risk" value={summary.loading ? "…" : String(summary.data?.kitchen.atRiskOrders ?? 0)} note="Past planned kitchen-ready time" />
        <Metric label="Drops needing driver" value={summary.loading ? "…" : String(summary.data?.dispatch.unassignedDrops ?? 0)} note={`${summary.data?.dispatch.drops ?? 0} drops for selected date`} />
        <Metric label="Out for delivery" value={summary.loading ? "…" : String(summary.data?.dispatch.outForDeliveryDrops ?? 0)} note={`${summary.data?.dispatch.deliveredDrops ?? 0} delivered`} />
        <Metric label="Uninvoiced confirmed" value={summary.loading ? "…" : String(summary.data?.billing.uninvoicedConfirmedOrders ?? 0)} note={formatMoney(summary.data?.billing.uninvoicedConfirmedAmount ?? "0")} />
        <Metric label="Active menu catalogue" value={summary.loading ? "…" : String(summary.data?.catalogue.activeDishes ?? 0)} note={`${summary.data?.catalogue.activeCategories ?? 0} active categories`} />
      </div>
      <Panel title="Upcoming order queue" action={<Link className="text-link" href="/admin/orders">All orders →</Link>}>
        {orders.loading ? <LoadingBlock /> : orders.data?.length ? (
          <div className="table-wrap"><table><thead><tr><th>Order</th><th>Company</th><th>Employee</th><th>Delivery</th><th>Status</th><th>Total</th></tr></thead>
            <tbody>{orders.data.map((order) => <tr key={order.id}>
              <td><Link href={`/admin/orders/${order.id}`} className="table-link">#{order.id}</Link></td>
              <td>{order.company.name}</td><td>{order.employee.name}</td><td>{prettyDate(order.deliveryDate)} · {order.deliveryTime}</td>
              <td><StatusBadge value={order.status} /></td><td>{formatMoney(order.totalAmount)}</td>
            </tr>)}</tbody></table></div>
        ) : <EmptyState title="No orders returned" detail="The order service did not return records." />}
      </Panel>
      <div className="split-panels">
        <Panel title="Billing attention">
          {summary.loading ? <LoadingBlock /> : (summary.data?.billing.uninvoicedConfirmedOrders ?? 0) > 0
            ? <p className="panel-copy">{summary.data?.billing.uninvoicedConfirmedOrders} confirmed orders worth {formatMoney(summary.data?.billing.uninvoicedConfirmedAmount ?? "0")} are awaiting invoicing. <Link href="/admin/billing" className="text-link">Review billing →</Link></p>
            : <EmptyState title="No uninvoiced confirmed orders" />}
        </Panel>
        <Panel title="Workspace tools">
          <div className="quick-links"><Link href="/admin/pricing">Pricing tiers <span>View configured tiers →</span></Link><Link href="/admin/orders">Order records <span>Search supported filters →</span></Link></div>
        </Panel>
      </div>
    </>
  );
}

function StaffAccountsPage() {
  const users = useData(() => listStaffUsers(), []);
  const companies = useData(() => listCompanies({ limit: 100 }), []);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AuthRole>("KITCHEN");
  const [companyId, setCompanyId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const created = await createStaffUser({
        name,
        email,
        password,
        role,
        ...(role === "DRIVER" ? { driverCompanyId: Number(companyId) } : {}),
      });
      setName("");
      setEmail("");
      setPassword("");
      setCompanyId("");
      setNotice(`${created.name} was added with the ${humanize(created.role)} role.`);
      users.refresh();
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeading eyebrow="ADMINISTRATION / ACCESS" title="Staff accounts" description="Create one authenticated account per staff member and assign its role on the server." />
    <ErrorNotice error={error || users.error || companies.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <Panel title="Create staff account">
      <form className="management-form" onSubmit={submit}>
        <label>Full name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Work email<input type="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <label>Temporary password<input type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Role<select value={role} onChange={(event) => setRole(event.target.value as AuthRole)}>{(["ADMIN", "KITCHEN", "DISPATCH", "DRIVER"] as const).map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
        {role === "DRIVER" && <label>Driver company<select required value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Select company</option>{companies.data?.data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>}
        <button className="button button-primary" disabled={busy}>{busy ? "Creating account…" : "Create staff account"}</button>
      </form>
      <p className="filter-note">Passwords are stored as bcrypt hashes. Driver accounts must be assigned to exactly one company.</p>
    </Panel>
    <Panel title="Staff directory">
      {users.loading ? <LoadingBlock /> : users.data?.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Company</th></tr></thead><tbody>
        {users.data.map((account: StaffUser) => <tr key={account.id}><td>{account.name}</td><td>{account.email}</td><td><StatusBadge value={account.role} /></td><td>{account.driver?.company.name ?? "—"}</td></tr>)}
      </tbody></table></div> : <EmptyState title="No staff accounts found" />}
    </Panel>
  </>;
}

function Metric({ label, value, note }: { label: string; value: string; note: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong><small>{note}</small></article>;
}

function OrdersPage() {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [companyId, setCompanyId] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [invoiced, setInvoiced] = useState("");
  const [offset, setOffset] = useState(0);
  const [applied, setApplied] = useState<{ status?: OrderStatus; companyId?: number; search?: string; deliveryDateFrom?: string; deliveryDateTo?: string; invoiced?: boolean }>({});
  const [cutoffDate, setCutoffDate] = useState(calendarDateInIndia());
  const [showCutoffConfirm, setShowCutoffConfirm] = useState(false);
  const [cutoffBusy, setCutoffBusy] = useState(false);
  const [cutoffMessage, setCutoffMessage] = useState("");
  const [cutoffError, setCutoffError] = useState("");
  const { data, loading, error, refresh: refreshOrders } = useData(
    () => listOrders({ ...applied, limit: 50, offset }),
    [applied, offset],
  );
  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOffset(0);
    setApplied({
      status: status || undefined,
      companyId: companyId ? Number(companyId) : undefined,
      search: search.trim() || undefined,
      deliveryDateFrom: dateFrom || undefined,
      deliveryDateTo: dateTo || undefined,
      invoiced: invoiced === "" ? undefined : invoiced === "yes",
    });
  }
  async function runCutoff() {
    setCutoffBusy(true);
    setCutoffError("");
    setCutoffMessage("");
    try {
      const result = await processOrderCutoff(cutoffDate);
      setCutoffMessage(
        `Cut-off processed at ${new Date(result.processedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST. ${result.confirmedOrders} order(s) confirmed; ${result.cancelledDrafts} draft(s) cancelled.`,
      );
      setShowCutoffConfirm(false);
      refreshOrders();
    } catch (reason) {
      setCutoffError(messageOf(reason));
    } finally {
      setCutoffBusy(false);
    }
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / ORDERS" title="Orders" description="Search, filter, and inspect orders using server-side delivery, billing, and status criteria." action={<Link className="button button-primary" href="/admin/orders/new">Create order</Link>} />
    <ErrorNotice error={cutoffError || error} />
    {cutoffMessage && <div className="notice notice-success">{cutoffMessage}</div>}
    <Panel title="Manually process a cut-off">
      <form className="filter-form" onSubmit={(event) => { event.preventDefault(); setShowCutoffConfirm(true); }}>
        <label>Delivery date<input type="date" value={cutoffDate} onChange={(event) => setCutoffDate(event.target.value)} required /></label>
        <button className="button button-secondary" type="submit">Process cut-off</button>
      </form>
      <p className="filter-note">The backend processes only eligible draft and placed orders whose configured cut-off has passed. Repeating the operation is safe.</p>
    </Panel>
    <Panel title="Filter orders">
      <form className="filter-form" onSubmit={applyFilters}>
        <label>Status<select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | "")}><option value="">All statuses</option>{(["DRAFT", "PLACED", "CONFIRMED", "DELIVERED", "CANCELLED", "REJECTED"] as const).map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label>
        <label>Company ID<input type="number" min="1" value={companyId} onChange={(event) => setCompanyId(event.target.value)} placeholder="Optional" /></label>
        <label>Search<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order ID, company, employee" /></label>
        <label>Delivery from<input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} /></label>
        <label>Delivery to<input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} /></label>
        <label>Invoice status<select value={invoiced} onChange={(event) => setInvoiced(event.target.value)}><option value="">All</option><option value="yes">Invoiced</option><option value="no">Not invoiced</option></select></label>
        <button className="button button-primary" type="submit">Apply filters</button>
      </form>
      <p className="filter-note">Filters, sorting, and offset pagination are evaluated by the backend.</p>
    </Panel>
    <Panel title={`Orders · ${offset + 1}–${offset + (data?.length ?? 0)}`}>
      {loading ? <LoadingBlock /> : data?.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Order</th><th>Company</th><th>Employee</th><th>Delivery</th><th>Status</th><th>Total</th><th /></tr></thead>
          <tbody>{data.map((order) => <tr key={order.id}><td>#{order.id}</td><td>{order.company.name}</td><td>{order.employee.name}</td><td>{prettyDate(order.deliveryDate)} · {order.deliveryTime}</td><td><StatusBadge value={order.status} /></td><td>{formatMoney(order.totalAmount)}</td><td><button className="text-link-button" onClick={() => router.push(`/admin/orders/${order.id}`)}>Details →</button></td></tr>)}</tbody>
        </table></div>
        <div className="pagination"><button className="button button-secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>Previous</button><span>Page {offset / 50 + 1} · {data.length} records</span><button className="button button-secondary" disabled={data.length < 50} onClick={() => setOffset(offset + 50)}>Next</button></div>
      </> : <EmptyState title="No orders match these filters" detail="Try a different status or company ID." />}
    </Panel>
    {showCutoffConfirm && <ConfirmDialog title="Process order cut-off?" onCancel={() => setShowCutoffConfirm(false)} onConfirm={runCutoff} busy={cutoffBusy} confirmText="Process cut-off"><p>Run the backend cut-off processor for delivery date <b>{prettyDate(cutoffDate)}</b>. Eligible placed orders will be confirmed; eligible drafts will be cancelled.</p></ConfirmDialog>}
  </>;
}

function OrderDetailPage({ id }: { id: string }) {
  const numericId = Number(id);
  const { data, loading, error, refresh } = useData(() => getOrder(numericId), [numericId]);
  const companyDetail = useData(
    () => data ? getCompany(data.company.id) : Promise.resolve(null),
    [data?.company.id],
  );
  const [deliveryTime, setDeliveryTime] = useState("");
  const [packaging, setPackaging] = useState("");
  const [addressId, setAddressId] = useState("");
  const [saving, setSaving] = useState(false);
  const [forceCompleting, setForceCompleting] = useState(false);
  const [confirmForceComplete, setConfirmForceComplete] = useState(false);
  const [confirmCancellation, setConfirmCancellation] = useState(false);
  const [confirmRejection, setConfirmRejection] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  if (loading) return <LoadingBlock />;
  if (error || !data) return <><PageHeading eyebrow="ADMINISTRATION / ORDERS" title={`Order #${id}`} description="Order details from the backend." /><ErrorNotice error={error || "Order unavailable"} /></>;
  const order = data;
  const canOverride = order.status === "CONFIRMED" && order.invoice === null;
  const canCancel = ["DRAFT", "PLACED"].includes(order.status) ||
    (order.status === "CONFIRMED" && order.invoice === null);
  async function saveOverrides(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setActionError(""); setNotice("");
    try {
      await updateConfirmedOrder(order.id, {
        deliveryTime: deliveryTime && deliveryTime !== order.deliveryTime ? deliveryTime : undefined,
        packaging: packaging && packaging !== (order.packaging ?? "") ? packaging : undefined,
        deliveryAddressId: addressId ? Number(addressId) : undefined,
      });
      setNotice("Order overrides saved and returned to the dispatch workflow."); setAddressId(""); refresh();
    } catch (reason) { setActionError(messageOf(reason)); }
    finally { setSaving(false); }
  }
  async function forceCompleteOrder() {
    setForceCompleting(true);
    setActionError("");
    setNotice("");
    try {
      const result = await forceCompleteKitchenOrder(order.id);
      setNotice(`Kitchen force-completed ${result.completedUnits} prep unit(s).`);
      setConfirmForceComplete(false);
      refresh();
    } catch (reason) {
      setActionError(messageOf(reason));
    } finally {
      setForceCompleting(false);
    }
  }
  async function cancelCurrentOrder() {
    setCancelling(true); setActionError(""); setNotice("");
    try {
      await cancelOrder(order.id);
      setConfirmCancellation(false);
      setNotice("Order cancelled. Its order snapshot and status history were retained.");
      refresh();
    } catch (reason) { setActionError(messageOf(reason)); }
    finally { setCancelling(false); }
  }
  async function rejectCurrentOrder() {
    setRejecting(true); setActionError(""); setNotice("");
    try {
      await rejectOrder(order.id);
      setConfirmRejection(false);
      setNotice("Order rejected and its status history was retained.");
      refresh();
    } catch (reason) { setActionError(messageOf(reason)); }
    finally { setRejecting(false); }
  }
  return <>
    <PageHeading eyebrow={`ORDER #${order.id}`} title="Order details" description={`${order.company.name} · ${order.employee.name}`} action={<>{(order.status === "DRAFT" || order.status === "PLACED") && <Link className="button button-primary" href={`/admin/orders/new/edit/${order.id}`}>Edit order</Link>} <Link className="button button-secondary" href="/admin/orders">Back to orders</Link></>} />
    <ErrorNotice error={actionError || companyDetail.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <div className="detail-grid">
      <Panel title="Delivery & status"><Detail label="Status"><StatusBadge value={order.status} /></Detail><Detail label="Delivery date">{prettyDate(order.deliveryDate)}</Detail><Detail label="Delivery time">{order.deliveryTime} IST</Detail><Detail label="Address">{addressText(order.deliveryAddressSnapshot)}</Detail><Detail label="Recipient">{order.deliveryAddressSnapshot.recipientName || "—"}</Detail><Detail label="Packaging">{order.packaging || "—"}</Detail></Panel>
      <Panel title="People"><Detail label="Company">{order.company.name} · #{order.company.id}</Detail><Detail label="Employee">{order.employee.name}</Detail><Detail label="Email">{order.employee.email}</Detail><Detail label="Created">{new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</Detail></Panel>
    </div>
    <Panel title="Order lines">
      <div className="table-wrap"><table><thead><tr><th>Dish</th><th>Qty</th><th>Unit price</th><th>Combinations & options</th><th>Line total</th></tr></thead><tbody>
        {order.lines.map((line) => <tr key={line.id}><td><b>{line.dishName}</b><small className="cell-subtitle">{line.dishSku}</small></td><td>{line.quantity}</td><td>{formatMoney(line.dishUnitPrice)}</td><td>{line.combinations.map((combination) => <div className="combination-row" key={combination.id}><b>{combination.quantity} ×</b> {combination.options.map((option) => `${option.name} (${formatMoney(option.unitPrice)})`).join(", ") || "No option"}</div>)}</td><td>{formatMoney(line.lineTotal)}</td></tr>)}
      </tbody></table></div>
      <div className="order-total"><span>Order total (backend)</span><strong>{formatMoney(order.totalAmount)}</strong></div>
    </Panel>
    {order.status === "CONFIRMED" && <Panel title="Kitchen escalation">
      <p className="panel-copy">Use only when an administrator must close all remaining prep units. Every unit and the order’s kitchen timestamps are updated on the server.</p>
      <button className="button button-secondary" disabled={forceCompleting} onClick={() => setConfirmForceComplete(true)}>{forceCompleting ? "Completing kitchen work…" : "Force-complete kitchen order"}</button>
    </Panel>}
    <div className="split-panels">
      <Panel title="Workflow timing"><Detail label="Cutoff">{order.cutoffAt ? new Date(order.cutoffAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "—"}</Detail><Detail label="Planned kitchen ready">{order.plannedKitchenReadyAt ? new Date(order.plannedKitchenReadyAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "—"}</Detail><Detail label="Planned dispatch ready">{order.plannedDispatchReadyAt ? new Date(order.plannedDispatchReadyAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : "—"}</Detail><Detail label="Invoice">{order.invoice ? <Link href={`/admin/billing/invoices/${order.invoice.id}`} className="text-link">{order.invoice.invoiceNumber} · {humanize(order.invoice.status)}</Link> : "Not invoiced"}</Detail></Panel>
      <Panel title="Status timeline">{order.timeline.length ? <ol className="timeline-list">{order.timeline.map((event, index) => <li key={`${event.status}-${event.occurredAt}-${index}`}><b>{humanize(event.status)}</b><span>{new Date(event.occurredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</span></li>)}</ol> : <EmptyState title="No status events recorded" />}</Panel>
    </div>
    {canOverride &&     <Panel title="Confirmed-order overrides"><form className="management-form" onSubmit={saveOverrides}><label>Delivery time<input type="time" value={deliveryTime || order.deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} /></label><label>Packaging<input value={packaging || order.packaging || ""} onChange={(event) => setPackaging(event.target.value)} /></label><label>Delivery address<select value={addressId} onChange={(event) => setAddressId(event.target.value)}><option value="">Keep current address</option>{companyDetail.data?.addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.addressLine1}, {address.city}</option>)}</select></label><p className="filter-note">Invoiced orders and drops already out for delivery are locked by the backend. A successful delivery override returns the order to dispatch for re-planning.</p><button className="button button-primary" disabled={saving}>{saving ? "Saving…" : "Save override"}</button></form></Panel>}
    {canCancel && <Panel title="Order cancellation"><p className="panel-copy">Cancel this un-invoiced {humanize(order.status).toLowerCase()} order. An order cannot be cancelled after invoicing or after its delivery has started. Its order history is retained.</p><button className="button button-danger" disabled={cancelling} onClick={() => setConfirmCancellation(true)}>{cancelling ? "Cancelling…" : "Cancel order"}</button></Panel>}
    {order.status === "PLACED" && <Panel title="Reject order"><p className="panel-copy">Reject this placed order before it is confirmed. Rejection is recorded in its status history.</p><button className="button button-danger" disabled={rejecting} onClick={() => setConfirmRejection(true)}>{rejecting ? "Rejecting…" : "Reject order"}</button></Panel>}
    {confirmForceComplete && <ConfirmDialog title="Force-complete kitchen work?" onCancel={() => setConfirmForceComplete(false)} onConfirm={forceCompleteOrder} busy={forceCompleting} confirmText="Force-complete"><p>All unfinished prep units for order <b>#{order.id}</b> will be marked done, and its kitchen-ready time will be recorded. This action is intended for an administrator escalation.</p></ConfirmDialog>}
    {confirmCancellation && <ConfirmDialog title="Cancel this order?" onCancel={() => setConfirmCancellation(false)} onConfirm={cancelCurrentOrder} busy={cancelling} confirmText="Cancel order"><p>Order <b>#{order.id}</b> will be marked cancelled. Its delivery, pricing, and timeline snapshots remain available.</p></ConfirmDialog>}
    {confirmRejection && <ConfirmDialog title="Reject this order?" onCancel={() => setConfirmRejection(false)} onConfirm={rejectCurrentOrder} busy={rejecting} confirmText="Reject order"><p>Placed order <b>#{order.id}</b> will be marked rejected and retained in the order history.</p></ConfirmDialog>}
  </>;
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return <div className="detail-row"><span>{label}</span><b>{children}</b></div>;
}

function BillingPage() {
  const [companyId, setCompanyId] = useState("");
  const [invoiceCompanyId, setInvoiceCompanyId] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<InvoiceStatus | "">("");
  const [issuedDateFrom, setIssuedDateFrom] = useState("");
  const [issuedDateTo, setIssuedDateTo] = useState("");
  const [paidDateFrom, setPaidDateFrom] = useState("");
  const [paidDateTo, setPaidDateTo] = useState("");
  const [invoiceOffset, setInvoiceOffset] = useState(0);
  const [selected, setSelected] = useState<number[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  const [createdId, setCreatedId] = useState<number | null>(null);
  const orders = useData(() => getUninvoicedOrders(companyId ? Number(companyId) : undefined), [companyId]);
  const invoices = useData(() => listInvoices({
    companyId: invoiceCompanyId ? Number(invoiceCompanyId) : undefined,
    status: invoiceStatus || undefined,
    issuedDateFrom: issuedDateFrom || undefined, issuedDateTo: issuedDateTo || undefined,
    paidDateFrom: paidDateFrom || undefined, paidDateTo: paidDateTo || undefined,
    limit: 25, offset: invoiceOffset,
  }), [invoiceCompanyId, invoiceStatus, issuedDateFrom, issuedDateTo, paidDateFrom, paidDateTo, invoiceOffset]);
  const selectedOrders = (orders.data ?? []).filter((order) => selected.includes(order.id));
  const selectedCompanyId = selectedOrders[0]?.company.id;
  async function submitInvoice() {
    if (!selectedCompanyId || selectedOrders.length === 0 || selectedOrders.some((order) => order.company.id !== selectedCompanyId)) return;
    setBusy(true);
    setActionError("");
    try {
      const invoice = await createInvoice(selectedCompanyId, selected);
      setCreatedId(invoice.id);
      setSelected([]);
      setConfirm(false);
      orders.refresh();
      invoices.refresh();
    } catch (error) {
      setActionError(messageOf(error));
      orders.refresh();
    } finally {
      setBusy(false);
    }
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / BILLING" title="Billing & invoices" description="Create invoices from confirmed orders and review payment status." />
    <ErrorNotice error={actionError || orders.error || invoices.error} />
    {createdId && <div className="notice notice-success">Invoice created. <Link href={`/admin/billing/invoices/${createdId}`}>Open invoice →</Link></div>}
    <Panel title="Confirmed orders not yet invoiced">
      <div className="filter-form compact"><label>Company ID<input type="number" min="1" value={companyId} onChange={(event) => { setCompanyId(event.target.value); setSelected([]); }} placeholder="All companies" /></label></div>
      {orders.loading ? <LoadingBlock /> : orders.data?.length ? <>
        <div className="table-wrap"><table><thead><tr><th>Select</th><th>Order</th><th>Company</th><th>Employee</th><th>Delivery</th><th>Order total</th></tr></thead><tbody>
          {orders.data.map((order) => <tr key={order.id}><td><input aria-label={`Select order ${order.id}`} type="checkbox" checked={selected.includes(order.id)} disabled={Boolean(selectedCompanyId && selectedCompanyId !== order.company.id)} onChange={(event) => setSelected((items) => event.target.checked ? [...items, order.id] : items.filter((id) => id !== order.id))} /></td><td>#{order.id}</td><td>{order.company.name}</td><td>{order.employee.name}</td><td>{prettyDate(order.deliveryDate)} · {order.deliveryTime}</td><td>{formatMoney(order.totalAmount)}</td></tr>)}
        </tbody></table></div>
        <div className="panel-actions"><span>{selected.length} selected{selectedCompanyId ? ` · ${selectedOrders[0]?.company.name}` : ""}</span><button className="button button-primary" disabled={!selected.length} onClick={() => setConfirm(true)}>Create invoice</button></div>
      </> : <EmptyState title="No uninvoiced confirmed orders" detail="Orders must be confirmed and unattached to an invoice." />}
    </Panel>
    <Panel title="Invoices">
      <div className="filter-form compact"><label>Company ID<input type="number" min="1" value={invoiceCompanyId} onChange={(event) => { setInvoiceCompanyId(event.target.value); setInvoiceOffset(0); }} placeholder="All companies" /></label><label>Status<select value={invoiceStatus} onChange={(event) => { setInvoiceStatus(event.target.value as InvoiceStatus | ""); setInvoiceOffset(0); }}><option value="">All statuses</option><option value="ISSUED">Issued</option><option value="PAID">Paid</option></select></label><label>Issued from<input type="date" value={issuedDateFrom} onChange={(event) => { setIssuedDateFrom(event.target.value); setInvoiceOffset(0); }} /></label><label>Issued to<input type="date" value={issuedDateTo} onChange={(event) => { setIssuedDateTo(event.target.value); setInvoiceOffset(0); }} /></label><label>Paid from<input type="date" value={paidDateFrom} onChange={(event) => { setPaidDateFrom(event.target.value); setInvoiceOffset(0); }} /></label><label>Paid to<input type="date" value={paidDateTo} onChange={(event) => { setPaidDateTo(event.target.value); setInvoiceOffset(0); }} /></label></div>
      {invoices.loading ? <LoadingBlock /> : invoices.data?.data.length ? <><div className="table-wrap"><table><thead><tr><th>Invoice</th><th>Company</th><th>Orders</th><th>Status</th><th>Issued</th><th>Paid</th><th>Total</th><th /></tr></thead><tbody>
        {invoices.data.data.map((invoice) => <tr key={invoice.id}><td>{invoice.invoiceNumber}</td><td>{invoice.company.name}</td><td>{invoice.orderCount}</td><td><StatusBadge value={invoice.status} /></td><td>{new Date(invoice.issuedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</td><td>{invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" }) : "—"}</td><td>{formatMoney(invoice.totalAmount)}</td><td><Link className="text-link" href={`/admin/billing/invoices/${invoice.id}`}>Open →</Link></td></tr>)}
      </tbody></table></div><div className="pagination"><button className="button button-secondary" disabled={invoiceOffset === 0} onClick={() => setInvoiceOffset(Math.max(0, invoiceOffset - 25))}>Previous</button><span>{invoiceOffset + 1}–{Math.min(invoiceOffset + invoices.data.data.length, invoices.data.meta.total)} of {invoices.data.meta.total}</span><button className="button button-secondary" disabled={invoiceOffset + 25 >= invoices.data.meta.total} onClick={() => setInvoiceOffset(invoiceOffset + 25)}>Next</button></div></> : <EmptyState title="No invoices found" detail="Try changing or clearing the filters." />}
    </Panel>
    {confirm && <ConfirmDialog title="Create invoice?" onCancel={() => setConfirm(false)} onConfirm={submitInvoice} busy={busy} confirmText="Create invoice">
      <p>{selectedOrders.length} order(s) from <b>{selectedOrders[0]?.company.name}</b> will be submitted to the backend for validation and invoicing.</p>
      <ul>{selectedOrders.map((order) => <li key={order.id}>Order #{order.id} · {formatMoney(order.totalAmount)}</li>)}</ul>
      <p className="filter-note">The authoritative invoice total will be returned by the backend after creation.</p>
    </ConfirmDialog>}
  </>;
}

function InvoiceDetailPage({ id }: { id: string }) {
  const numericId = Number(id);
  const { data, loading, error, refresh, setError } = useData(() => getInvoice(numericId), [numericId]);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (loading) return <LoadingBlock />;
  if (!data || error) return <><PageHeading eyebrow="BILLING / INVOICE" title={`Invoice #${id}`} description="Invoice details." /><ErrorNotice error={error || "Invoice unavailable"} /></>;
  async function markPaid() {
    setBusy(true);
    setError("");
    try { await markInvoicePaid(numericId); refresh(); setConfirm(false); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / BILLING" title={data.invoiceNumber} description={`${data.company.name} · issued ${new Date(data.issuedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`} action={<Link className="button button-secondary" href="/admin/billing">Back to billing</Link>} />
    <ErrorNotice error={error} />
    <div className="metric-grid metric-grid-3"><Metric label="Status" value={humanize(data.status)} note={data.paidAt ? `Paid ${new Date(data.paidAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST` : "Payment pending"} /><Metric label="Company" value={data.company.name} note={`Company #${data.company.id}`} /><Metric label="Total" value={formatMoney(data.totalAmount)} note={`${data.orders.length} linked orders`} /></div>
    <Panel title="Included orders"><div className="table-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Delivery date</th><th>Total</th></tr></thead><tbody>{data.orders.map((order) => <tr key={order.id}><td><Link className="table-link" href={`/admin/orders/${order.id}`}>#{order.id}</Link></td><td><StatusBadge value={order.status} /></td><td>{"deliveryDate" in order ? prettyDate(String(order.deliveryDate)) : "—"}</td><td>{formatMoney(order.totalAmount)}</td></tr>)}</tbody></table></div></Panel>
    {data.status === "ISSUED" && <button className="button button-primary" onClick={() => setConfirm(true)}>Mark as paid</button>}
    {confirm && <ConfirmDialog title="Mark invoice paid?" onCancel={() => setConfirm(false)} onConfirm={markPaid} busy={busy} confirmText="Mark paid"><p>This records invoice <b>{data.invoiceNumber}</b> as paid. This transition cannot be repeated.</p></ConfirmDialog>}
  </>;
}

function ConfirmDialog({ title, children, onCancel, onConfirm, busy, confirmText }: {
  title: string; children: ReactNode; onCancel: () => void; onConfirm: () => void; busy: boolean; confirmText: string;
}) {
  return <div className="dialog-backdrop" role="presentation"><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">{title}</h2><div>{children}</div><footer><button className="button button-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="button button-primary" onClick={onConfirm} disabled={busy}>{busy ? "Working…" : confirmText}</button></footer></section></div>;
}

function PricingPage() {
  const [companyInput, setCompanyInput] = useState("");
  const [companyTier, setCompanyTier] = useState<number | null>(null);
  const [tierId, setTierId] = useState("");
  const [companyError, setCompanyError] = useState("");
  const [checking, setChecking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [dishDraft, setDishDraft] = useState<Record<number, string>>({});
  const [optionDraft, setOptionDraft] = useState<Record<number, string>>({});
  const { data, loading, error } = useData(() => listTiers(), []);
  const selectedTierId = tierId ? Number(tierId) : 0;
  const dishMatrix = useData(() => selectedTierId ? getTierDishPrices(selectedTierId) : Promise.resolve(null), [selectedTierId]);
  const optionMatrix = useData(() => selectedTierId ? getTierOptionPrices(selectedTierId) : Promise.resolve(null), [selectedTierId]);
  async function resolveTier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setChecking(true);
    setCompanyError("");
    try { setCompanyTier(await getCompanyTier(Number(companyInput))); }
    catch (reason) { setCompanyError(messageOf(reason)); setCompanyTier(null); }
    finally { setChecking(false); }
  }
  const resolvedTier = data?.find((tier) => tier.id === companyTier);
  async function savePrices() {
    if (!selectedTierId) return;
    setSaving(true); setActionError(""); setNotice("");
    try {
      const [dishes, options] = await Promise.all([
        dishMatrix.data?.dishes.length ? saveTierDishPrices(selectedTierId, dishMatrix.data.dishes.map(({ id, overridePrice }) => ({
          itemId: id, ...(id in dishDraft ? (dishDraft[id].trim() ? { overridePrice: dishDraft[id].trim() } : {}) : overridePrice ? { overridePrice } : {}),
        }))) : dishMatrix.data,
        optionMatrix.data?.options.length ? saveTierOptionPrices(selectedTierId, optionMatrix.data.options.map(({ id, overridePrice }) => ({
          itemId: id, ...(id in optionDraft ? (optionDraft[id].trim() ? { overridePrice: optionDraft[id].trim() } : {}) : overridePrice ? { overridePrice } : {}),
        }))) : optionMatrix.data,
      ]);
      if (dishes) { setDishDraft({}); dishMatrix.refresh(); }
      if (options) { setOptionDraft({}); optionMatrix.refresh(); }
      setNotice("Tier prices saved. Derived prices remain controlled by the tier rule.");
    } catch (reason) { setActionError(messageOf(reason)); }
    finally { setSaving(false); }
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / PRICING" title="Pricing tiers" description="Review tier rules, maintain item overrides, and resolve a company's effective tier." />
    <ErrorNotice error={error || companyError || actionError || dishMatrix.error || optionMatrix.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <Panel title="Configured tiers">
      {loading ? <LoadingBlock /> : data?.length ? <div className="table-wrap"><table><thead><tr><th>Tier</th><th>Rule</th><th>Default</th><th>Base tier</th><th>Multiplier</th><th>Markup</th></tr></thead><tbody>{data.map((tier) => <tr key={tier.id}><td><b>{tier.name}</b><small className="cell-subtitle">#{tier.id}</small></td><td>{humanize(tier.pricingRuleType)}</td><td>{tier.isDefault ? <StatusBadge value="DEFAULT" /> : "—"}</td><td>{tier.baseTierId ?? "—"}</td><td>{tier.multiplier ?? "—"}</td><td>{tier.markupPercent ? `${tier.markupPercent}%` : "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="No price tiers configured" />}
    </Panel>
    <Panel title="Tier price matrix"><div className="filter-form"><label>Price tier<select value={tierId} onChange={(event) => setTierId(event.target.value)}><option value="">Select tier</option>{data?.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>{tierId && <button className="button button-primary" disabled={saving || dishMatrix.loading || optionMatrix.loading} onClick={savePrices}>{saving ? "Saving…" : "Save all overrides"}</button>}</div>
      {tierId && (dishMatrix.loading || optionMatrix.loading) ? <LoadingBlock /> : tierId ? <>
        <h3 className="section-subheading">Dishes</h3>
        {dishMatrix.data?.dishes.length ? <div className="table-wrap"><table><thead><tr><th>Dish</th><th>Cost</th><th>Override price</th><th>Effective price</th><th>Rule</th></tr></thead><tbody>{dishMatrix.data.dishes.map((item) => <tr key={item.id}><td><b>{item.name}</b><small className="cell-subtitle">{item.sku} · {item.category}</small></td><td>{formatMoney(item.costPrice)}</td><td><input aria-label={`${item.name} override price`} className="table-input" inputMode="decimal" placeholder="Use tier rule" value={dishDraft[item.id] ?? item.overridePrice ?? ""} onChange={(event) => setDishDraft((rows) => ({ ...rows, [item.id]: event.target.value }))} /></td><td>{item.effectivePrice === null ? "Missing" : formatMoney(item.effectivePrice)}</td><td>{humanize(item.state)}</td></tr>)}</tbody></table></div> : <EmptyState title="No dishes to price" />}
        <h3 className="section-subheading">Options</h3>
        {optionMatrix.data?.options.length ? <div className="table-wrap"><table><thead><tr><th>Option</th><th>Cost</th><th>Override price</th><th>Effective price</th><th>Rule</th></tr></thead><tbody>{optionMatrix.data.options.map((item) => <tr key={item.id}><td>{item.name}</td><td>{formatMoney(item.costPrice)}</td><td><input aria-label={`${item.name} override price`} className="table-input" inputMode="decimal" placeholder="Use tier rule" value={optionDraft[item.id] ?? item.overridePrice ?? ""} onChange={(event) => setOptionDraft((rows) => ({ ...rows, [item.id]: event.target.value }))} /></td><td>{item.effectivePrice === null ? "Missing" : formatMoney(item.effectivePrice)}</td><td>{humanize(item.state)}</td></tr>)}</tbody></table></div> : <EmptyState title="No options to price" />}
        <p className="filter-note">Blank override clears an override and uses the configured tier rule. Prices submitted are validated by the backend.</p>
      </> : <p className="panel-copy">Select a tier to load its dish and option pricing matrices.</p>}
    </Panel>
    <Panel title="Resolve company tier"><form className="filter-form" onSubmit={resolveTier}><label>Company ID<input type="number" required min="1" value={companyInput} onChange={(event) => setCompanyInput(event.target.value)} /></label><button className="button button-primary" disabled={checking}>{checking ? "Checking…" : "Resolve tier"}</button></form>
      {resolvedTier && <p className="success-inline">Effective tier: <b>{resolvedTier.name}</b> (#{resolvedTier.id})</p>}
      {companyTier !== null && !resolvedTier && <p className="success-inline">Effective tier ID: {companyTier}</p>}
    </Panel>
  </>;
}

function KitchenPage() {
  const initialDate = useMemo(() => calendarDateInIndia(), []);
  const [date, setDate] = useState(initialDate);
  const [station, setStation] = useState<KitchenStation | "">("");
  const [status, setStatus] = useState<KitchenUnitStatus | "">("");
  const [mutationError, setMutationError] = useState("");
  const [busyUnit, setBusyUnit] = useState<number | null>(null);
  const stations = useData(() => listKitchenStations(), []);
  const board = useData(() => getKitchenOrders({ deliveryDate: date || undefined, kitchenStation: station || undefined, status: status || undefined }), [date, station, status]);
  async function transition(unitId: number, action: "start" | "done") {
    setBusyUnit(unitId);
    setMutationError("");
    try { if (action === "start") await startKitchenUnit(unitId); else await finishKitchenUnit(unitId); board.refresh(); }
    catch (error) { setMutationError(messageOf(error)); }
    finally { setBusyUnit(null); }
  }
  return <>
    <PageHeading eyebrow="KITCHEN / PRODUCTION" title="Kitchen board" description="Confirmed orders and their backend-defined prep units, ordered by planned ready time." />
    <ErrorNotice error={mutationError || board.error || stations.error} />
    <Panel title="Board filters"><div className="filter-form"><label>Delivery date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Station<select value={station} onChange={(event) => setStation(event.target.value)}><option value="">All stations</option>{(stations.data ?? []).filter((item) => item.active).map((item) => <option key={item.id} value={item.name}>{humanize(item.name)}</option>)}</select></label><label>Unit status<select value={status} onChange={(event) => setStatus(event.target.value as KitchenUnitStatus | "")}><option value="">All statuses</option>{(["NOT_STARTED", "STARTED", "DONE"] as const).map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label><button className="button button-secondary" onClick={board.refresh}>Refresh</button></div></Panel>
    {board.loading ? <LoadingBlock /> : board.data?.length ? <div className="kitchen-orders">{board.data.map((order) => <KitchenOrderCard key={order.id} order={order} busyUnit={busyUnit} onTransition={transition} />)}</div> : <EmptyState title="No kitchen work for this date" detail="Try another delivery date or clear the station/status filters." />}
  </>;
}

function KitchenOrderCard({ order, busyUnit, onTransition }: { order: KitchenOrder; busyUnit: number | null; onTransition: (id: number, action: "start" | "done") => void }) {
  return <Panel title={`Order #${order.id} · ${order.company.name}`} action={<StatusBadge value={`${order.progress.completedUnits}/${order.progress.totalUnits} complete`} />}>
    <div className="order-meta-strip"><span>{order.employee.name}</span><span>{prettyDate(order.deliveryDate)} · {order.deliveryTime} IST</span><span>Planned ready: {order.plannedKitchenReadyAt ? new Date(order.plannedKitchenReadyAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }) + " IST" : "—"}</span>{order.isAtRisk && <span className="risk-label">At risk</span>}</div>
    <div className="prep-units">{order.units.map((unit) => <article className="prep-unit" key={unit.id}><div className="prep-unit-info"><b>{unit.dishName}</b><span>{unit.quantity} servings · {humanize(unit.station)}</span><small>{unit.selectedOptions.map((option) => option.name).join(" · ") || "No selected options"}</small></div><StatusBadge value={unit.status} />{unit.status === "NOT_STARTED" && <button className="button button-primary button-small" disabled={busyUnit === unit.id} onClick={() => onTransition(unit.id, "start")}>{busyUnit === unit.id ? "Saving…" : "Start"}</button>}{unit.status === "STARTED" && <button className="button button-primary button-small" disabled={busyUnit === unit.id} onClick={() => onTransition(unit.id, "done")}>{busyUnit === unit.id ? "Saving…" : "Mark done"}</button>}</article>)}</div>
  </Panel>;
}

function DispatchPage() {
  const [date, setDate] = useState(calendarDateInIndia());
  const [status, setStatus] = useState("");
  const [mutationError, setMutationError] = useState("");
  const [grouping, setGrouping] = useState(false);
  const drops = useData(() => listDispatchDrops({ deliveryDate: date || undefined, status: status ? status as DispatchDrop["status"] : undefined }), [date, status]);
  const drivers = useData(() => listDispatchDrivers(), []);
  async function group() {
    setGrouping(true);
    setMutationError("");
    try { await groupReadyOrders(date); drops.refresh(); }
    catch (error) { setMutationError(messageOf(error)); }
    finally { setGrouping(false); }
  }
  return <>
    <PageHeading eyebrow="DISPATCH / DELIVERY" title="Dispatch board" description="Drops are grouped by the backend using company, address, and exact delivery time." action={<button className="button button-primary" onClick={group} disabled={grouping || !date}>{grouping ? "Grouping…" : "Group kitchen-ready orders"}</button>} />
    <ErrorNotice error={mutationError || drops.error || drivers.error} />
    <Panel title="Board filters"><div className="filter-form"><label>Delivery date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label>Drop status<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All statuses</option>{(["KITCHEN_READY", "DISPATCH_READY", "OUT_FOR_DELIVERY", "DELIVERED"] as const).map((item) => <option key={item} value={item}>{humanize(item)}</option>)}</select></label><button className="button button-secondary" onClick={drops.refresh}>Refresh</button></div></Panel>
    {drops.loading || drivers.loading ? <LoadingBlock /> : drops.data?.length ? <div className="dispatch-list">{drops.data.map((drop) => <DispatchDropCard key={drop.id} drop={drop} drivers={drivers.data ?? []} onError={setMutationError} onRefresh={() => { drops.refresh(); drivers.refresh(); }} />)}</div> : <EmptyState title="No dispatch drops for this date" detail="Group kitchen-ready orders or select another date." />}
  </>;
}

function DispatchDropCard({ drop, drivers, onError, onRefresh }: { drop: DispatchDrop; drivers: DispatchDriver[]; onError: (error: string) => void; onRefresh: () => void }) {
  const [driverId, setDriverId] = useState(String(drop.driver?.id ?? drop.defaultDriver?.id ?? ""));
  const [busy, setBusy] = useState(false);
  async function act(action: "assign" | "ready" | "dispatch") {
    setBusy(true); onError("");
    try {
      if (action === "assign") {
        if (!Number.isInteger(Number(driverId)) || Number(driverId) < 1) throw new Error("Enter a valid driver profile ID.");
        await assignDriver(drop.id, Number(driverId));
      } else if (action === "ready") await markDropReady(drop.id);
      else await sendDropForDelivery(drop.id);
      onRefresh();
    } catch (error) { onError(messageOf(error)); }
    finally { setBusy(false); }
  }
  return <Panel title={`Drop #${drop.id} · ${drop.company.name}`} action={<StatusBadge value={drop.status} />}>
    <div className="dispatch-drop-grid"><div><span className="detail-label">Delivery</span><b>{prettyDate(drop.deliveryDate)} · {drop.deliveryTime} IST</b><p>{addressText(drop.deliveryAddressSnapshot)}</p></div><div><span className="detail-label">Orders / driver</span><b>{drop.orderCount} order(s)</b><p>{drop.driver ? `${drop.driver.name} · ${drop.driver.email}` : drop.defaultDriver ? `Default: ${drop.defaultDriver.name}` : "No driver assigned"}</p></div><div><span className="detail-label">Kitchen readiness</span><b>{drop.allOrdersKitchenReady ? "All orders ready" : "Not all orders ready"}</b><p>{drop.orders.map((order) => `#${order.id}`).join(", ") || "No orders"}</p></div></div>
    <div className="dispatch-actions">
      <label>Driver<select value={driverId} onChange={(event) => setDriverId(event.target.value)} aria-label={`Driver for drop ${drop.id}`}><option value="">Unassigned</option>{drivers.filter((driver) => driver.companyId === drop.company.id).map((driver) => <option key={driver.id} value={driver.id}>{driver.name} · {driver.activeDropCount} active</option>)}</select></label>
      <button className="button button-secondary" disabled={busy || !driverId} onClick={() => act("assign")}>{busy ? "Saving…" : "Assign / reassign"}</button>
      {drop.status === "KITCHEN_READY" && <button className="button button-secondary" disabled={busy || !drop.allOrdersKitchenReady} onClick={() => act("ready")}>Mark dispatch ready</button>}
      {drop.canGoOutForDelivery && <button className="button button-primary" disabled={busy} onClick={() => act("dispatch")}>Out for delivery</button>}
      {drop.deliveredAt && <span className="filter-note">Delivered {new Date(drop.deliveredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST · {drop.onTime ? "On time" : "Late"}</span>}
    </div>
  </Panel>;
}

function DriverPage() {
  const { data, loading, error, refresh } = useData(() => getDriverDrops(), []);
  return <>
    <PageHeading eyebrow="DRIVER / TODAY" title="Today's deliveries" description="Only drops assigned to your authenticated driver profile are shown." action={<button className="button button-secondary" onClick={refresh}>Refresh</button>} />
    <ErrorNotice error={error} />
    {loading ? <LoadingBlock /> : data?.length ? <div className="driver-cards">{data.map((drop) => <DriverDropCard key={drop.id} drop={drop} />)}</div> : <EmptyState title="No deliveries assigned to you today" />}
  </>;
}

function DriverDropCard({ drop }: { drop: DriverDrop }) {
  return <Link className="driver-card" href={`/driver/drops/${drop.id}`}><div className="driver-card-top"><span className="driver-time">{drop.deliveryTime}</span><StatusBadge value={drop.status} /></div><h2>{drop.company.name}</h2><p>{addressText(drop.deliveryAddressSnapshot)}</p><div className="driver-card-bottom"><span>{drop.orderCount} order(s)</span><span>Open delivery →</span></div></Link>;
}

function DriverDetailPage({ id }: { id: string }) {
  const numericId = Number(id);
  const { data, loading, error, refresh, setError } = useData(() => getDriverDrop(numericId), [numericId]);
  const [note, setNote] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  if (loading) return <LoadingBlock />;
  if (!data || error) return <><PageHeading eyebrow="DRIVER / DELIVERY" title={`Drop #${id}`} description="Delivery details." /><ErrorNotice error={error || "Delivery unavailable"} /></>;
  async function complete() {
    setBusy(true); setError("");
    try { await deliverDrop(numericId, note.trim() || undefined, photoUrl.trim() || undefined); refresh(); setConfirm(false); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  return <>
    <PageHeading eyebrow="DRIVER / DELIVERY" title={`${data.company.name} · Drop #${data.id}`} description={`${prettyDate(data.deliveryDate)} · ${data.deliveryTime} IST`} action={<Link className="button button-secondary" href="/driver">Today&apos;s deliveries</Link>} />
    <ErrorNotice error={error} />
    <Panel title="Delivery address"><p className="driver-address">{addressText(data.deliveryAddressSnapshot)}</p><p>{data.deliveryAddressSnapshot.recipientName || ""}</p><p>{data.orderCount} order(s) in this drop</p>{data.driverInstructions && <p className="panel-copy"><b>Company instructions:</b> {data.driverInstructions}</p>}</Panel>
    <Panel title="Orders in this delivery"><div className="driver-order-list">{data.orders.map((order) => <article key={order.id}><div><b>Order #{order.id}</b><span>{order.employee.name} · {order.employee.email}</span><span>Packaging: {order.packaging || "—"}</span></div><strong>{formatMoney(order.totalAmount)}</strong></article>)}</div></Panel>
    {data.status === "OUT_FOR_DELIVERY" ? <Panel title="Complete delivery"><label className="full-label">Delivery note (optional)<textarea rows={4} maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add a delivery note" /></label><label className="full-label">Photo URL (optional)<input type="url" maxLength={2048} value={photoUrl} onChange={(event) => setPhotoUrl(event.target.value)} placeholder="https://…" /></label><p className="filter-note">The delivery record stores the URL; image storage and upload are not configured.</p><button className="button button-primary driver-complete" onClick={() => setConfirm(true)}>Mark delivered</button></Panel> : data.status === "DELIVERED" ? <Panel title="Delivery complete"><StatusBadge value="DELIVERED" /><p>{data.deliveredAt ? new Date(data.deliveredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) + " IST" : ""} · {data.onTime ? "On time" : "Late"}</p>{data.deliveryNote && <p>Note: {data.deliveryNote}</p>}{data.deliveryPhotoUrl && <p><a href={data.deliveryPhotoUrl} target="_blank" rel="noreferrer">View delivery photo →</a></p>}</Panel> : <Panel title="Delivery status"><StatusBadge value={data.status} /><p>Delivery can be completed after dispatch moves this drop to Out for Delivery.</p></Panel>}
    {confirm && <ConfirmDialog title="Mark drop delivered?" onCancel={() => setConfirm(false)} onConfirm={complete} busy={busy} confirmText="Mark delivered"><p>This will mark all <b>{data.orderCount} orders</b> in the drop as delivered.</p>{note.trim() && <p>Note: {note}</p>}{photoUrl.trim() && <p>Photo URL: {photoUrl}</p>}</ConfirmDialog>}
  </>;
}

function CompaniesPage() {
  const companies = useData(() => listCompanies({ limit: 100, offset: 0 }), []);
  const tiers = useData(() => listTiers(), []);
  const directoryEmployees = useData(() => listEmployees({ limit: 100 }), []);
  const drivers = useData(() => listDrivers(), []);
  const categories = useData(() => listCategories(), []);
  const dishes = useData(() => listDishes({ limit: 100 }), []);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = useData(() => selectedId === null ? Promise.resolve(null) : getCompany(selectedId), [selectedId]);
  const [form, setForm] = useState<CompanyInput>(emptyCompanyInput());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [holidayDate, setHolidayDate] = useState(calendarDateInIndia());
  const [holidayDescription, setHolidayDescription] = useState("");

  function beginEdit(company: Company) {
    setEditingId(company.id);
    setForm({
      name: company.name,
      emailDomains: company.emailDomains,
      addresses: company.addresses.map((address) => ({
        label: address.label, recipientName: address.recipientName,
        addressLine1: address.addressLine1, addressLine2: address.addressLine2,
        city: address.city, region: address.region, postalCode: address.postalCode,
        country: address.country, isDefault: address.isDefault,
      })),
      billingContactName: company.billingContactName ?? "",
      billingContactEmail: company.billingContactEmail ?? "",
      priceTierId: company.priceTierId ?? undefined,
      ownerEmployeeId: company.owner?.id,
      defaultDeliveryTime: company.defaultDeliveryTime ?? "",
      deliveryMinutes: company.deliveryMinutes,
      deliveryWorkingDays: company.deliveryWorkingDays,
      defaultPackaging: company.defaultPackaging ?? "",
      driverInstructions: company.driverInstructions ?? "",
      defaultDriverId: company.defaultDriver?.id,
      hiddenCategoryIds: company.hiddenCategories.map((entry) => entry.categoryId),
      hiddenDishIds: company.hiddenDishes.map((entry) => entry.dishId),
    });
    setSelectedId(company.id);
    setError("");
    setNotice("");
  }

  async function saveCompany(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = {
        ...form,
        billingContactName: form.billingContactName?.trim() || undefined,
        billingContactEmail: form.billingContactEmail?.trim() || undefined,
        defaultDeliveryTime: form.defaultDeliveryTime?.trim() || undefined,
        defaultPackaging: form.defaultPackaging?.trim() || undefined,
        driverInstructions: form.driverInstructions?.trim() || undefined,
        emailDomains: form.emailDomains.map((domain) => domain.trim()).filter(Boolean),
        addresses: form.addresses.map((address, index) => ({
          ...address,
          addressLine2: address.addressLine2?.trim() || null,
          country: address.country || "IN",
          isDefault: index === Math.max(0, form.addresses.findIndex((item) => item.isDefault)),
        })),
        deliveryWorkingDays: form.deliveryWorkingDays,
        ...(editingId !== null ? {
          ownerEmployeeId: form.ownerEmployeeId,
          defaultDriverId: form.defaultDriverId,
        } : {}),
      };
      if (editingId === null) {
        const company = await createCompany(payload);
        setSelectedId(company.id);
        setNotice(`Company ${company.name} created.`);
      } else {
        const company = await updateCompany(editingId, payload);
        setNotice(`Company ${company.name} saved.`);
        selected.refresh();
      }
      companies.refresh();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (selectedId === null) return;
    setBusy(true); setError("");
    try {
      await addCompanyHoliday(selectedId, { date: holidayDate, description: holidayDescription || undefined });
      setHolidayDescription(""); selected.refresh(); companies.refresh();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }

  async function removeHoliday(holidayId: number) {
    if (selectedId === null) return;
    setError("");
    try {
      await removeCompanyHoliday(selectedId, holidayId);
      selected.refresh(); companies.refresh();
    } catch (reason) { setError(messageOf(reason)); }
  }

  function updateAddress(index: number, patch: Partial<CompanyInput["addresses"][number]>) {
    setForm((current) => ({
      ...current,
      addresses: current.addresses.map((address, itemIndex) =>
        itemIndex === index ? { ...address, ...patch } : address,
      ),
    }));
  }

  function removeAddress(index: number) {
    setForm((current) => {
      const addresses = current.addresses.filter((_, itemIndex) => itemIndex !== index);
      if (addresses.length && !addresses.some((address) => address.isDefault)) {
        addresses[0] = { ...addresses[0], isDefault: true };
      }
      return { ...current, addresses };
    });
  }

  return <>
    <PageHeading eyebrow="ADMINISTRATION / DIRECTORY" title="Companies" description="Manage company accounts, registered email domains, delivery settings, and holidays." action={<button className="button button-primary" onClick={() => { setSelectedId(null); setEditingId(null); setForm(emptyCompanyInput()); }}>New company</button>} />
    <ErrorNotice error={error || companies.error || selected.error || tiers.error || directoryEmployees.error || drivers.error || categories.error || dishes.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <Panel title="Company directory">
      {companies.loading ? <LoadingBlock /> : companies.data?.data.length ? <div className="table-wrap"><table><thead><tr><th>Company</th><th>Domains</th><th>Employees</th><th>Orders</th><th>Price tier</th><th /></tr></thead><tbody>
        {companies.data.data.map((company) => <tr key={company.id}><td><b>{company.name}</b><small className="cell-subtitle">#{company.id}</small></td><td>{company.emailDomains.join(", ")}</td><td>{company.employees.length}</td><td>{company._count.orders}</td><td>{company.priceTier?.name ?? "Default tier"}</td><td><button className="text-link-button" onClick={() => beginEdit(company)}>Edit →</button></td></tr>)}
      </tbody></table></div> : <EmptyState title="No companies configured" detail="Create the first company below." />}
    </Panel>
    <Panel title={editingId === null ? "Create company" : `Edit company #${editingId}`}>
      <form className="management-form" onSubmit={saveCompany}>
        <label>Company name<input required maxLength={160} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Email domains (comma separated)<input required value={form.emailDomains.join(", ")} onChange={(event) => setForm({ ...form, emailDomains: event.target.value.split(",").map((value) => value.trim()) })} placeholder="example.com" /></label>
        <label>Billing contact name<input value={form.billingContactName ?? ""} onChange={(event) => setForm({ ...form, billingContactName: event.target.value })} /></label>
        <label>Billing contact email<input type="email" value={form.billingContactEmail ?? ""} onChange={(event) => setForm({ ...form, billingContactEmail: event.target.value })} /></label>
        <label>Default delivery time<input type="time" value={form.defaultDeliveryTime ?? ""} onChange={(event) => setForm({ ...form, defaultDeliveryTime: event.target.value })} /></label>
        <label>Delivery lead time (minutes)<input type="number" min="0" max="1440" required value={form.deliveryMinutes} onChange={(event) => setForm({ ...form, deliveryMinutes: Number(event.target.value) })} /></label>
        <label>Default packaging<input value={form.defaultPackaging ?? ""} onChange={(event) => setForm({ ...form, defaultPackaging: event.target.value })} /></label>
        <label>Price tier<select value={form.priceTierId ?? ""} onChange={(event) => setForm({ ...form, priceTierId: event.target.value ? Number(event.target.value) : undefined })}><option value="">Use default tier</option>{tiers.data?.map((tier) => <option key={tier.id} value={tier.id}>{tier.name}</option>)}</select></label>
        {editingId !== null && <label>Company owner<select value={form.ownerEmployeeId ?? ""} onChange={(event) => setForm({ ...form, ownerEmployeeId: event.target.value ? Number(event.target.value) : null })}><option value="">No owner selected</option>{directoryEmployees.data?.data.filter((employee) => employee.companyId === editingId).map((employee) => <option key={employee.id} value={employee.id}>{employee.name}</option>)}</select></label>}
        {editingId !== null && <label>Default driver<select value={form.defaultDriverId ?? ""} onChange={(event) => setForm({ ...form, defaultDriverId: event.target.value ? Number(event.target.value) : null })}><option value="">No default driver</option>{drivers.data?.filter((driver: DriverProfile) => driver.companyId === editingId).map((driver) => <option key={driver.id} value={driver.id}>{driver.user.name}</option>)}</select></label>}
        <div className="company-addresses">
          <div className="company-address-heading"><b>Delivery addresses</b><button type="button" className="button button-secondary button-small" onClick={() => setForm((current) => ({ ...current, addresses: [...current.addresses, { ...emptyAddress(), isDefault: current.addresses.length === 0 }] }))}>Add address</button></div>
          {form.addresses.map((address, index) => <fieldset className="company-address" key={index}>
            <legend>{address.label || `Address ${index + 1}`}</legend>
            <label>Address label<input required value={address.label} onChange={(event) => updateAddress(index, { label: event.target.value })} /></label>
            <label>Recipient<input required value={address.recipientName} onChange={(event) => updateAddress(index, { recipientName: event.target.value })} /></label>
            <label>Address line 1<input required value={address.addressLine1} onChange={(event) => updateAddress(index, { addressLine1: event.target.value })} /></label>
            <label>Address line 2<input value={address.addressLine2 ?? ""} onChange={(event) => updateAddress(index, { addressLine2: event.target.value })} /></label>
            <label>City<input required value={address.city} onChange={(event) => updateAddress(index, { city: event.target.value })} /></label>
            <label>Region / state<input required value={address.region} onChange={(event) => updateAddress(index, { region: event.target.value })} /></label>
            <label>Postal code<input required value={address.postalCode} onChange={(event) => updateAddress(index, { postalCode: event.target.value })} /></label>
            <label>Country code<input required minLength={2} maxLength={2} value={address.country || "IN"} onChange={(event) => updateAddress(index, { country: event.target.value.toUpperCase() })} /></label>
            <div className="company-address-actions">
              <label className="inline-check"><input type="radio" name="default-company-address" checked={Boolean(address.isDefault)} onChange={() => setForm((current) => ({ ...current, addresses: current.addresses.map((item, itemIndex) => ({ ...item, isDefault: itemIndex === index })) }))} /> Default address</label>
              {form.addresses.length > 1 && <button type="button" className="text-link-button" onClick={() => removeAddress(index)}>Remove address</button>}
            </div>
          </fieldset>)}
        </div>
        <label>Delivery weekdays<select multiple value={form.deliveryWorkingDays} onChange={(event) => setForm({ ...form, deliveryWorkingDays: Array.from(event.target.selectedOptions, (option) => option.value) })}>{WEEKDAYS.map((day) => <option key={day} value={day}>{humanize(day)}</option>)}</select></label>
        <label>Driver instructions<textarea rows={3} maxLength={1000} value={form.driverInstructions ?? ""} onChange={(event) => setForm({ ...form, driverInstructions: event.target.value })} /></label>
        <label>Hidden menu categories<select multiple value={(form.hiddenCategoryIds ?? []).map(String)} onChange={(event) => setForm({ ...form, hiddenCategoryIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{categories.data?.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Hidden menu dishes<select multiple value={(form.hiddenDishIds ?? []).map(String)} onChange={(event) => setForm({ ...form, hiddenDishIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{dishes.data?.data.map((dish) => <option key={dish.id} value={dish.id}>{dish.name}</option>)}</select></label>
        <div className="form-actions"><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : "Save company"}</button><button type="button" className="button button-secondary" onClick={() => { setEditingId(null); setSelectedId(null); setForm(emptyCompanyInput()); }}>Clear</button></div>
      </form>
    </Panel>
    {selectedId !== null && selected.data && <Panel title="Company holidays">
      <form className="filter-form" onSubmit={addHoliday}><label>Date<input type="date" required value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} /></label><label>Description<input value={holidayDescription} onChange={(event) => setHolidayDescription(event.target.value)} /></label><button className="button button-secondary" disabled={busy}>Add holiday</button></form>
      {selected.data.holidays.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th /></tr></thead><tbody>{selected.data.holidays.map((holiday) => <tr key={holiday.id}><td>{prettyDate(holiday.date)}</td><td>{holiday.description || "—"}</td><td><button className="text-link-button" onClick={() => removeHoliday(holiday.id)}>Remove</button></td></tr>)}</tbody></table></div> : <p className="panel-copy">No company holidays recorded.</p>}
    </Panel>}
  </>;
}

const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
function emptyAddress(): CompanyInput["addresses"][number] {
  return { label: "", recipientName: "", addressLine1: "", addressLine2: "", city: "", region: "", postalCode: "", country: "IN", isDefault: true };
}
function emptyCompanyInput(): CompanyInput {
  return { name: "", emailDomains: [""], addresses: [emptyAddress()], deliveryMinutes: 60, deliveryWorkingDays: WEEKDAYS.slice(0, 5) };
}

function EmployeesPage() {
  const companies = useData(() => listCompanies({ limit: 100 }), []);
  const employees = useData(() => listEmployees({ limit: 100 }), []);
  const refs = useData(() => getEmployeeReferenceData(), []);
  const [companyId, setCompanyId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState(false);
  const [time, setTime] = useState(false);
  const [packaging, setPackaging] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [allergens, setAllergens] = useState<number[]>([]);
  const [dietary, setDietary] = useState<number[]>([]);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvResult, setCsvResult] = useState<EmployeeCsvImportResult | null>(null);
  const rows = employees.data?.data.filter((employee) => !companyId || employee.companyId === Number(companyId)) ?? [];
  function beginEdit(employee: Employee) {
    setEditing(employee); setName(employee.name); setEmail(employee.email); setCompanyId(String(employee.companyId));
    setAddress(employee.canChooseDeliveryAddress); setTime(employee.canChangeDeliveryTime); setPackaging(employee.canChangePackaging);
    setAllergens(employee.allergens.map((item) => item.id)); setDietary(employee.dietaryPreferences.map((item) => item.id));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const input = { companyId: Number(companyId), name, email, canChooseDeliveryAddress: address, canChangeDeliveryTime: time, canChangePackaging: packaging, allergenIds: allergens, dietaryTagIds: dietary };
      if (editing) await updateEmployee(editing.id, input); else await createEmployee(input);
      setNotice(`Employee ${name} saved.`); setEditing(null); setName(""); setEmail(""); setAllergens([]); setDietary([]); employees.refresh();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function importCsv(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!companyId || !csvFile) return;
    const form = event.currentTarget;
    setCsvBusy(true);
    setError("");
    setNotice("");
    setCsvResult(null);
    try {
      const result = await importEmployeesCsv(Number(companyId), await csvFile.text());
      setCsvResult(result);
      setNotice(`${result.importedCount} employee(s) imported; ${result.errorCount} row(s) need attention.`);
      employees.refresh();
      form.reset();
      setCsvFile(null);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setCsvBusy(false);
    }
  }
  function toggle(id: number, selected: number[], setSelected: (ids: number[]) => void, checked: boolean) {
    setSelected(checked ? [...selected, id] : selected.filter((item) => item !== id));
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / DIRECTORY" title="Employees" description="Manage company-linked employees, email-domain validation, dietary requirements, and order permissions." />
    <ErrorNotice error={error || employees.error || companies.error || refs.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <Panel title="Import employees from CSV">
      <form className="filter-form" onSubmit={importCsv}>
        <label>Company<select required value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Select a company</option>{companies.data?.data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>CSV file<input required type="file" accept=".csv,text/csv" onChange={(event) => setCsvFile(event.target.files?.[0] ?? null)} /></label>
        <button className="button button-secondary" disabled={csvBusy || !csvFile}>{csvBusy ? "Importing…" : "Import employees"}</button>
      </form>
      <p className="filter-note">Required columns: name,email. Optional permission columns: canChooseDeliveryAddress, canChangeDeliveryTime, canChangePackaging (true/false). Invalid rows are reported individually; successful rows remain imported.</p>
      {csvResult?.errors.length ? <div className="table-wrap"><table><thead><tr><th>CSV row</th><th>Error</th></tr></thead><tbody>{csvResult.errors.map((row) => <tr key={row.row}><td>{row.row}</td><td>{row.message}</td></tr>)}</tbody></table></div> : null}
    </Panel>
    <Panel title={editing ? `Edit ${editing.name}` : "Create employee"}>
      <form className="management-form" onSubmit={save}>
        <label>Company<select required value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">Select a company</option>{companies.data?.data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label>
        <label>Name<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Company email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label>
        <div className="checkbox-list"><span>Order permissions</span><label><input type="checkbox" checked={address} onChange={(event) => setAddress(event.target.checked)} /> May choose delivery address</label><label><input type="checkbox" checked={time} onChange={(event) => setTime(event.target.checked)} /> May change delivery time</label><label><input type="checkbox" checked={packaging} onChange={(event) => setPackaging(event.target.checked)} /> May change packaging</label></div>
        <div className="checkbox-list"><span>Allergens</span>{refs.data?.allergens.map((item) => <label key={item.id}><input type="checkbox" checked={allergens.includes(item.id)} onChange={(event) => toggle(item.id, allergens, setAllergens, event.target.checked)} /> {item.name}</label>)}</div>
        <div className="checkbox-list"><span>Dietary preferences</span>{refs.data?.dietaryTags.map((item) => <label key={item.id}><input type="checkbox" checked={dietary.includes(item.id)} onChange={(event) => toggle(item.id, dietary, setDietary, event.target.checked)} /> {item.name}</label>)}</div>
        <div className="form-actions"><button className="button button-primary" disabled={busy || !companies.data?.data.length}>{busy ? "Saving…" : editing ? "Save employee" : "Create employee"}</button>{editing && <button type="button" className="button button-secondary" onClick={() => { setEditing(null); setName(""); setEmail(""); }}>Cancel edit</button>}</div>
      </form>
    </Panel>
    <Panel title="Employee directory">
      <div className="filter-form"><label>Company filter<select value={companyId} onChange={(event) => setCompanyId(event.target.value)}><option value="">All companies</option>{companies.data?.data.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}</select></label><button className="button button-secondary" onClick={employees.refresh}>Refresh</button></div>
      {employees.loading ? <LoadingBlock /> : rows.length ? <div className="table-wrap"><table><thead><tr><th>Employee</th><th>Company</th><th>Permissions</th><th>Orders</th><th /></tr></thead><tbody>{rows.map((employee) => <tr key={employee.id}><td><b>{employee.name}</b><small className="cell-subtitle">{employee.email}</small></td><td>{employee.company.name}</td><td>{[employee.canChooseDeliveryAddress && "Address", employee.canChangeDeliveryTime && "Time", employee.canChangePackaging && "Packaging"].filter(Boolean).join(", ") || "No overrides"}</td><td>{employee._count.orders}</td><td><button className="text-link-button" onClick={() => beginEdit(employee)}>Edit →</button></td></tr>)}</tbody></table></div> : <EmptyState title="No employees found" />}
    </Panel>
  </>;
}

function CataloguePage() {
  const refs = useData(() => getCatalogueReferenceData(), []);
  const portionSizes = useData(() => listPortionSizes(), []);
  const categories = useData(() => listCategories(), []);
  const dishes = useData(() => listDishes({ limit: 100 }), []);
  const options = useData(() => listOptions(), []);
  const groups = useData(() => listOptionGroups(), []);
  const [categoryName, setCategoryName] = useState("");
  const [categoryDescription, setCategoryDescription] = useState("");
  const [categoryActive, setCategoryActive] = useState(true);
  const [categorySecret, setCategorySecret] = useState(false);
  const [categoryOrder, setCategoryOrder] = useState(0);
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [dish, setDish] = useState<DishInput>(emptyDishInput());
  const [editingDish, setEditingDish] = useState<number | null>(null);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);
  const [option, setOption] = useState<OptionInput>({ name: "", costPrice: "0.00", active: true, allergenIds: [], dietaryTagIds: [] });
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null);
  const [groupName, setGroupName] = useState("");
  const [groupOptionIds, setGroupOptionIds] = useState<number[]>([]);
  const [groupDishIds, setGroupDishIds] = useState<number[]>([]);
  const [groupRequired, setGroupRequired] = useState(false);
  const [groupUsesPortions, setGroupUsesPortions] = useState(false);
  const [groupMinimum, setGroupMinimum] = useState(0);
  const [groupMaximum, setGroupMaximum] = useState("");
  const [groupPortionSizeIds, setGroupPortionSizeIds] = useState<number[]>([]);
  const [portionPrices, setPortionPrices] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [categoryId, setCategoryId] = useState("");

  async function saveCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const input = { name: categoryName, description: categoryDescription || undefined, displayOrder: categoryOrder, active: categoryActive, secret: categorySecret };
      if (editingCategoryId === null) await createCategory(input); else await updateCategory(editingCategoryId, input);
      setCategoryName(""); setCategoryDescription(""); setCategoryActive(true); setCategorySecret(false);
      setCategoryOrder(categories.data?.length ?? 0); setEditingCategoryId(null);
      categories.refresh(); refs.refresh(); setNotice(editingCategoryId === null ? "Category created." : "Category updated.");
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  function editDish(item: CatalogueDish) {
    setEditingDish(item.id);
    setDish({
      categoryId: item.categoryId, name: item.name, description: item.description ?? "",
      imageUrl: item.imageUrl ?? "", sku: item.sku, temperature: item.temperature,
      costPrice: item.costPrice, displayOrder: item.displayOrder, minimumOrderQuantity: item.minimumOrderQuantity,
      active: item.active, kitchenStation: item.kitchenStation ?? undefined,
      allergenIds: item.allergens.map((entry) => entry.id),
      dietaryTagIds: item.dietaryTags.map((entry) => entry.id),
      optionGroupIds: item.optionGroups.map((entry) => entry.id),
    });
  }
  function editCategory(item: CatalogueCategory) {
    setEditingCategoryId(item.id); setCategoryName(item.name); setCategoryDescription(item.description ?? "");
    setCategoryOrder(item.displayOrder); setCategoryActive(item.active); setCategorySecret(item.secret);
  }
  function editOption(item: CatalogueOption) {
    setEditingOptionId(item.id);
    setOption({
      name: item.name, costPrice: item.costPrice, active: item.active,
      allergenIds: item.allergens.map((value) => value.id),
      dietaryTagIds: item.dietaryTags.map((value) => value.id),
    });
  }
  function editGroup(item: OptionGroup) {
    setEditingGroupId(item.id); setGroupName(item.name); setGroupRequired(item.required);
    setGroupUsesPortions(item.usesPortions); setGroupMinimum(item.minSelections);
    setGroupMaximum(item.maxSelections === null ? "" : String(item.maxSelections));
    setGroupOptionIds(item.options.map((link) => link.optionId));
    setGroupDishIds(item.dishes.map((link) => link.dishId));
    const portionLinks = item.options.flatMap((link) => link.portions.map((portion) => ({
      optionId: link.optionId,
      portionSizeId: portion.portionSizeId,
      extraPrice: portion.extraPrice,
    })));
    setGroupPortionSizeIds([...new Set(portionLinks.map((portion) => portion.portionSizeId))]);
    setPortionPrices(Object.fromEntries(portionLinks.map((portion) => [
      `${portion.optionId}-${portion.portionSizeId}`,
      portion.extraPrice,
    ])));
  }
  async function saveDish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const input = {
        ...dish,
        categoryId: Number(dish.categoryId),
        costPrice: String(dish.costPrice),
        description: dish.description?.trim() || undefined,
        imageUrl: dish.imageUrl?.trim() || undefined,
      };
      if (editingDish === null) await createDish(input); else await updateDish(editingDish, input);
      setNotice(editingDish === null ? "Dish created." : "Dish updated.");
      setDish(emptyDishInput()); setEditingDish(null); dishes.refresh();
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function saveOption(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      if (editingOptionId === null) await createOption(option); else await updateOption(editingOptionId, option);
      setOption({ name: "", costPrice: "0.00", active: true, allergenIds: [], dietaryTagIds: [] }); setEditingOptionId(null);
      options.refresh(); groups.refresh(); setNotice(editingOptionId === null ? "Option created." : "Option updated.");
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const input: OptionGroupInput = {
        name: groupName, required: groupRequired, usesPortions: groupUsesPortions,
        minSelections: groupMinimum, maxSelections: groupMaximum ? Number(groupMaximum) : undefined,
        optionIds: groupOptionIds, dishIds: groupDishIds,
        portions: groupUsesPortions ? groupOptionIds.flatMap((optionId) =>
          groupPortionSizeIds.map((portionSizeId) => ({
            optionId,
            portionSizeId,
            extraPrice: portionPrices[`${optionId}-${portionSizeId}`] ?? "0.00",
          })),
        ) : [],
      };
      if (editingGroupId === null) await createOptionGroup(input); else await updateOptionGroup(editingGroupId, input);
      setGroupName(""); setGroupOptionIds([]); setGroupDishIds([]); setEditingGroupId(null); setGroupPortionSizeIds([]); setPortionPrices({});
      setGroupRequired(false); setGroupUsesPortions(false); setGroupMinimum(0); setGroupMaximum("");
      groups.refresh(); dishes.refresh(); setNotice(editingGroupId === null ? "Option group created." : "Option group updated.");
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function createReference(kind: "allergen" | "dietary") {
    const value = window.prompt(`Name of ${kind}:`);
    if (!value?.trim()) return;
    setBusy(true); setError("");
    try {
      if (kind === "allergen") await createAllergen(value.trim()); else await createDietaryTag(value.trim());
      refs.refresh(); setNotice(`${humanize(kind)} added.`);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  const filteredDishes = dishes.data?.data.filter((item) => !categoryId || item.categoryId === Number(categoryId)) ?? [];
  const dishStationOptions = [
    ...(refs.data?.kitchenStations ?? []),
    ...(dish.kitchenStation && !(refs.data?.kitchenStations ?? []).includes(dish.kitchenStation)
      ? [dish.kitchenStation]
      : []),
  ];
  return <>
    <PageHeading eyebrow="ADMINISTRATION / MENU" title="Catalogue" description="Manage categories, dishes, configurable options, dietary reference data, and dish option groups." />
    <ErrorNotice error={error || refs.error || categories.error || dishes.error || options.error || groups.error} />
    {notice && <div className="notice notice-success">{notice}</div>}
    <Panel title="Categories">
      <form className="management-form compact" onSubmit={saveCategory}><label>Name<input required maxLength={100} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} /></label><label>Description<input value={categoryDescription} onChange={(event) => setCategoryDescription(event.target.value)} /></label><label>Display order<input type="number" min="0" value={categoryOrder} onChange={(event) => setCategoryOrder(Number(event.target.value))} /></label><label className="inline-check"><input type="checkbox" checked={categoryActive} onChange={(event) => setCategoryActive(event.target.checked)} /> Active</label><label className="inline-check"><input type="checkbox" checked={categorySecret} onChange={(event) => setCategorySecret(event.target.checked)} /> Hide from public menu</label><div className="form-actions"><button className="button button-primary" disabled={busy}>{editingCategoryId === null ? "Add category" : "Save category"}</button>{editingCategoryId !== null && <button type="button" className="button button-secondary" onClick={() => { setEditingCategoryId(null); setCategoryName(""); setCategoryDescription(""); }}>Cancel edit</button>}</div></form>
      {categories.data?.length ? <div className="table-wrap"><table><thead><tr><th>Category</th><th>Visibility</th><th>Dishes</th><th /></tr></thead><tbody>{categories.data.map((category) => <tr key={category.id}><td>{category.name}</td><td>{category.active ? "Active" : "Inactive"}{category.secret ? " · Secret" : ""}</td><td>{category._count.dishes}</td><td><button className="text-link-button" onClick={() => editCategory(category)}>Edit →</button></td></tr>)}</tbody></table></div> : <EmptyState title="No categories configured" />}
    </Panel>
    <Panel title={editingDish ? `Edit dish #${editingDish}` : "Create dish"}>
      <form className="management-form" onSubmit={saveDish}>
        <label>Category<select required value={dish.categoryId || ""} onChange={(event) => setDish({ ...dish, categoryId: Number(event.target.value) })}><option value="">Select category</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Name<input required maxLength={160} value={dish.name} onChange={(event) => setDish({ ...dish, name: event.target.value })} /></label>
        <label>SKU<input required maxLength={80} value={dish.sku} onChange={(event) => setDish({ ...dish, sku: event.target.value })} /></label>
        <label>Description<input value={dish.description ?? ""} onChange={(event) => setDish({ ...dish, description: event.target.value })} /></label>
        <label>Image URL<input type="url" value={dish.imageUrl ?? ""} onChange={(event) => setDish({ ...dish, imageUrl: event.target.value })} /></label>
        <label>Temperature<input required maxLength={20} value={dish.temperature} onChange={(event) => setDish({ ...dish, temperature: event.target.value })} placeholder="HOT / COLD" /></label>
        <label>Cost price<input required inputMode="decimal" pattern="\\d+(\\.\\d{1,2})?" value={dish.costPrice} onChange={(event) => setDish({ ...dish, costPrice: event.target.value })} /></label>
        <label>Display order<input type="number" min="0" required value={dish.displayOrder} onChange={(event) => setDish({ ...dish, displayOrder: Number(event.target.value) })} /></label>
        <label>Minimum quantity<input type="number" min="1" max="10000" required value={dish.minimumOrderQuantity} onChange={(event) => setDish({ ...dish, minimumOrderQuantity: Number(event.target.value) })} /></label>
        <label>Kitchen station<select value={dish.kitchenStation ?? ""} onChange={(event) => setDish({ ...dish, kitchenStation: event.target.value || undefined })}><option value="">No station</option>{dishStationOptions.map((station) => <option key={station} value={station}>{humanize(station)}{refs.data?.kitchenStations.includes(station) ? "" : " (inactive)"}</option>)}</select></label>
        <label>Option groups<select multiple value={dish.optionGroupIds.map(String)} onChange={(event) => setDish({ ...dish, optionGroupIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{groups.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Allergens<select multiple value={dish.allergenIds.map(String)} onChange={(event) => setDish({ ...dish, allergenIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{refs.data?.allergens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Dietary tags<select multiple value={dish.dietaryTagIds.map(String)} onChange={(event) => setDish({ ...dish, dietaryTagIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{refs.data?.dietaryTags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="inline-check"><input type="checkbox" checked={dish.active} onChange={(event) => setDish({ ...dish, active: event.target.checked })} /> Active</label>
        <div className="form-actions"><button className="button button-primary" disabled={busy || !categories.data?.length}>{busy ? "Saving…" : editingDish ? "Save dish" : "Create dish"}</button>{editingDish !== null && <button type="button" className="button button-secondary" onClick={() => { setEditingDish(null); setDish(emptyDishInput()); }}>Cancel edit</button>}</div>
      </form>
    </Panel>
    <Panel title="Dishes"><div className="filter-form"><label>Category filter<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">All categories</option>{categories.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label></div>{filteredDishes.length ? <div className="table-wrap"><table><thead><tr><th>Dish</th><th>Category</th><th>Cost</th><th>Options</th><th>State</th><th /></tr></thead><tbody>{filteredDishes.map((item) => <tr key={item.id}><td><b>{item.name}</b><small className="cell-subtitle">{item.sku}</small></td><td>{item.category.name}</td><td>{formatMoney(item.costPrice)}</td><td>{item.optionGroups.map((group) => group.name).join(", ") || "—"}</td><td>{item.active ? "Active" : "Inactive"}</td><td><button className="text-link-button" onClick={() => editDish(item)}>Edit →</button></td></tr>)}</tbody></table></div> : <EmptyState title="No dishes found" />}</Panel>
    <div className="split-panels">
      <Panel title="Options"><form className="management-form compact" onSubmit={saveOption}><label>Option name<input required value={option.name} onChange={(event) => setOption({ ...option, name: event.target.value })} /></label><label>Cost price<input required inputMode="decimal" value={option.costPrice} onChange={(event) => setOption({ ...option, costPrice: event.target.value })} /></label><label>Allergens<select multiple value={option.allergenIds.map(String)} onChange={(event) => setOption({ ...option, allergenIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{refs.data?.allergens.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Dietary tags<select multiple value={option.dietaryTagIds.map(String)} onChange={(event) => setOption({ ...option, dietaryTagIds: Array.from(event.target.selectedOptions, (item) => Number(item.value)) })}>{refs.data?.dietaryTags.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="inline-check"><input type="checkbox" checked={option.active} onChange={(event) => setOption({ ...option, active: event.target.checked })} /> Active</label><div className="form-actions"><button className="button button-primary" disabled={busy}>{editingOptionId === null ? "Add option" : "Save option"}</button>{editingOptionId !== null && <button type="button" className="button button-secondary" onClick={() => { setEditingOptionId(null); setOption({ name: "", costPrice: "0.00", active: true, allergenIds: [], dietaryTagIds: [] }); }}>Cancel edit</button>}</div></form>{options.data?.length ? <div className="table-wrap"><table><thead><tr><th>Name</th><th>Cost</th><th>State</th><th /></tr></thead><tbody>{options.data.map((item) => <tr key={item.id}><td>{item.name}</td><td>{formatMoney(item.costPrice)}</td><td>{item.active ? "Active" : "Inactive"}</td><td><button className="text-link-button" onClick={() => editOption(item)}>Edit →</button></td></tr>)}</tbody></table></div> : <EmptyState title="No options configured" />}</Panel>
      <Panel title="Option groups"><form className="management-form compact" onSubmit={saveGroup}>
        <label>Group name<input required value={groupName} onChange={(event) => setGroupName(event.target.value)} /></label>
        <label>Options<select multiple value={groupOptionIds.map(String)} onChange={(event) => setGroupOptionIds(Array.from(event.target.selectedOptions, (item) => Number(item.value)))}>{options.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Apply to dishes<select multiple value={groupDishIds.map(String)} onChange={(event) => setGroupDishIds(Array.from(event.target.selectedOptions, (item) => Number(item.value)))}>{dishes.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Minimum selections<input type="number" min="0" value={groupMinimum} onChange={(event) => setGroupMinimum(Number(event.target.value))} /></label>
        <label>Maximum selections<input type="number" min="1" value={groupMaximum} onChange={(event) => setGroupMaximum(event.target.value)} /></label>
        <label className="inline-check"><input type="checkbox" checked={groupRequired} onChange={(event) => { setGroupRequired(event.target.checked); if (event.target.checked && groupMinimum === 0) setGroupMinimum(1); }} /> Required</label>
        <label className="inline-check"><input type="checkbox" checked={groupUsesPortions} onChange={(event) => setGroupUsesPortions(event.target.checked)} /> Require portion choices</label>
        {groupUsesPortions && <>
          <label>Available portion sizes<select multiple value={groupPortionSizeIds.map(String)} onChange={(event) => setGroupPortionSizeIds(Array.from(event.target.selectedOptions, (item) => Number(item.value)))}>{portionSizes.data?.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          {groupOptionIds.map((optionId) => {
            const optionName = options.data?.find((item) => item.id === optionId)?.name ?? `Option ${optionId}`;
            return <fieldset className="choice-group" key={optionId}><legend>{optionName} portion prices</legend>
              {groupPortionSizeIds.map((portionSizeId) => {
                const portionName = portionSizes.data?.find((item) => item.id === portionSizeId)?.name ?? `Size ${portionSizeId}`;
                const key = `${optionId}-${portionSizeId}`;
                return <label key={key}>{portionName} extra price<input required inputMode="decimal" pattern="\\d+(\\.\\d{1,2})?" value={portionPrices[key] ?? "0.00"} onChange={(event) => setPortionPrices({ ...portionPrices, [key]: event.target.value })} /></label>;
              })}
            </fieldset>;
          })}
        </>}
        <div className="form-actions"><button className="button button-primary" disabled={busy}>{editingGroupId === null ? "Add option group" : "Save option group"}</button>{editingGroupId !== null && <button type="button" className="button button-secondary" onClick={() => { setEditingGroupId(null); setGroupName(""); setGroupOptionIds([]); setGroupDishIds([]); setGroupRequired(false); setGroupUsesPortions(false); setGroupMinimum(0); setGroupMaximum(""); setGroupPortionSizeIds([]); setPortionPrices({}); }}>Cancel edit</button>}</div>
      </form>{groups.data?.length ? <div className="table-wrap"><table><thead><tr><th>Group</th><th>Options</th><th>Required</th><th>Portions</th><th /></tr></thead><tbody>{groups.data.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.options.length}</td><td>{item.required ? `${item.minSelections} minimum` : "No"}</td><td>{item.usesPortions ? "Yes" : "No"}</td><td><button className="text-link-button" onClick={() => editGroup(item)}>Edit →</button></td></tr>)}</tbody></table></div> : <EmptyState title="No groups configured" />}</Panel>
    </div>
    <Panel title="Dietary reference data"><div className="panel-actions"><button className="button button-secondary" disabled={busy} onClick={() => createReference("allergen")}>Add allergen</button><button className="button button-secondary" disabled={busy} onClick={() => createReference("dietary")}>Add dietary tag</button></div><p className="panel-copy">Allergens: {refs.data?.allergens.map((item) => item.name).join(", ") || "none"} · Dietary tags: {refs.data?.dietaryTags.map((item) => item.name).join(", ") || "none"}</p></Panel>
  </>;
}

function emptyDishInput(): DishInput {
  return { categoryId: 0, name: "", description: "", imageUrl: "", sku: "", temperature: "HOT", costPrice: "0.00", displayOrder: 0, minimumOrderQuantity: 1, active: true, allergenIds: [], dietaryTagIds: [], optionGroupIds: [] };
}

function MenuPreviewPage() {
  const companies = useData(() => listCompanies({ limit: 100 }), []);
  const employees = useData(() => listEmployees({ limit: 100 }), []);
  const [companyId, setCompanyId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(calendarDateInIndia());
  const [query, setQuery] = useState<{ companyId: number; employeeId: number; deliveryDate: string } | null>(null);
  const menu = useData(() => query ? getMenuPreview(query.companyId, query.employeeId, query.deliveryDate) : Promise.resolve(null), [query]);
  const companyEmployees = employees.data?.data.filter((employee) => !companyId || employee.companyId === Number(companyId)) ?? [];
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery({ companyId: Number(companyId), employeeId: Number(employeeId), deliveryDate });
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / MENU" title="Menu preview" description="Preview the live menu with company visibility, employee dietary requirements, and effective tier pricing." />
    <ErrorNotice error={companies.error || employees.error || menu.error} />
    <Panel title="Preview context"><form className="filter-form" onSubmit={submit}><label>Company<select required value={companyId} onChange={(event) => { setCompanyId(event.target.value); setEmployeeId(""); }}><option value="">Choose company</option>{companies.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Employee<select required value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}><option value="">Choose employee</option>{companyEmployees.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label><label>Delivery date<input type="date" required value={deliveryDate} onChange={(event) => setDeliveryDate(event.target.value)} /></label><button className="button button-primary">Preview menu</button></form></Panel>
    {menu.loading && query ? <LoadingBlock /> : menu.data && <MenuContent menu={menu.data} />}
  </>;
}

function MenuContent({ menu }: { menu: MenuPreview }) {
  return <><div className="notice notice-success"><b>{menu.company.name}</b> · Tier #{menu.company.priceTierId} · Employee: {menu.employee.name}{menu.company.canDeliverOnSelectedDate === false && <p>Delivery is not available on the selected date.</p>}</div>
    <Panel title="Employee requirements"><p className="panel-copy">Allergens: {menu.employee.allergens.join(", ") || "None recorded"} · Dietary preferences: {menu.employee.dietaryPreferences.join(", ") || "None recorded"}</p></Panel>
    {menu.categories.length ? menu.categories.map((category) => <Panel key={category.id} title={category.name}>{category.dishes.map((dish) => { const allergenConflict = dish.allergens.filter((allergen) => menu.employee.allergens.includes(allergen)); return <article className="menu-dish" key={dish.id}><div><h3>{dish.name}</h3><p>{dish.description || dish.sku} · {humanize(dish.temperature)} · Minimum {dish.minimumOrderQuantity}</p><small>Allergens: {dish.allergens.join(", ") || "none"} · Tags: {dish.dietaryTags.join(", ") || "none"}</small>{allergenConflict.length > 0 && <p className="risk-label">Allergy warning: contains {allergenConflict.join(", ")}</p>}{dish.optionGroups.map((group) => <p key={group.id}><b>{group.name}</b> · {group.required ? "Required" : "Optional"} · {group.options.map((option) => `${option.name} ${formatMoney(option.price)}`).join(", ")}</p>)}</div><strong>{formatMoney(dish.price)}</strong></article>})}</Panel>) : <EmptyState title="No menu items available" detail="No active, priced dishes are visible for this company." />}
  </>;
}

function SettingsPage() {
  const settings = useData(() => getKitchenSettings(), []);
  const stations = useData(() => listKitchenStations(), []);
  const portionSizes = useData(() => listPortionSizes(), []);
  const [cutoffDays, setCutoffDays] = useState(2);
  const [cutoffTime, setCutoffTime] = useState("12:00");
  const [workingDays, setWorkingDays] = useState<string[]>(WEEKDAYS.slice(0, 5));
  const [dirty, setDirty] = useState(false);
  const [holidayDate, setHolidayDate] = useState(calendarDateInIndia());
  const [holidayDescription, setHolidayDescription] = useState("");
  const [stationName, setStationName] = useState("");
  const [stationBusy, setStationBusy] = useState<number | "create" | null>(null);
  const [portionSizeName, setPortionSizeName] = useState("");
  const [portionSizeBusy, setPortionSizeBusy] = useState<number | "create" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const shownCutoffDays = dirty ? cutoffDays : settings.data?.cutoffWorkingDays ?? cutoffDays;
  const shownCutoffTime = dirty ? cutoffTime : settings.data?.cutoffTime ?? cutoffTime;
  const shownWorkingDays = dirty ? workingDays : settings.data?.workingDays ?? workingDays;
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try { await updateKitchenSettings({ cutoffWorkingDays: shownCutoffDays, cutoffTime: shownCutoffTime, workingDays: shownWorkingDays }); setDirty(false); settings.refresh(); setNotice("Kitchen calendar settings saved."); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function addHoliday(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try { await addKitchenHoliday({ date: holidayDate, description: holidayDescription || undefined }); setHolidayDescription(""); settings.refresh(); }
    catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function removeHoliday(id: number) {
    setError("");
    try { await removeKitchenHoliday(id); settings.refresh(); }
    catch (reason) { setError(messageOf(reason)); }
  }
  async function saveStation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStationBusy("create");
    setError("");
    try {
      await createKitchenStation(stationName);
      setStationName("");
      await stations.refresh();
      setNotice("Kitchen station added.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setStationBusy(null);
    }
  }
  async function toggleStation(id: number, active: boolean) {
    setStationBusy(id);
    setError("");
    try {
      await updateKitchenStation(id, active);
      await stations.refresh();
      setNotice(`Kitchen station ${active ? "activated" : "deactivated"}.`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setStationBusy(null);
    }
  }
  async function savePortionSize(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPortionSizeBusy("create");
    setError("");
    try {
      await createPortionSize(portionSizeName);
      setPortionSizeName("");
      await portionSizes.refresh();
      setNotice("Portion size added.");
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setPortionSizeBusy(null);
    }
  }
  async function togglePortionSize(id: number, active: boolean) {
    setPortionSizeBusy(id);
    setError("");
    try {
      await updatePortionSize(id, active);
      await portionSizes.refresh();
      setNotice(`Portion size ${active ? "activated" : "deactivated"}.`);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setPortionSizeBusy(null);
    }
  }
  function toggleDay(day: string, checked: boolean) {
    setDirty(true);
    setWorkingDays(checked ? [...shownWorkingDays, day] : shownWorkingDays.filter((value) => value !== day));
  }
  return <>
    <PageHeading eyebrow="ADMINISTRATION / CONFIGURATION" title="Kitchen settings" description="Configure cutoff rules, working days, and kitchen holidays. Calendar logic is evaluated in Asia/Kolkata." />
    <ErrorNotice error={error || settings.error || stations.error || portionSizes.error} />{notice && <div className="notice notice-success">{notice}</div>}
    {settings.loading ? <LoadingBlock /> : settings.data && <>
      <Panel title="Cutoff and working days"><form className="management-form" onSubmit={save}><label>Cutoff working days before delivery<input type="number" min="0" max="30" required value={shownCutoffDays} onChange={(event) => { setDirty(true); setCutoffDays(Number(event.target.value)); }} /></label><label>Cutoff time (IST)<input type="time" required value={shownCutoffTime} onChange={(event) => { setDirty(true); setCutoffTime(event.target.value); }} /></label><div className="checkbox-list"><span>Kitchen working days</span>{WEEKDAYS.map((day) => <label key={day}><input type="checkbox" checked={shownWorkingDays.includes(day)} onChange={(event) => toggleDay(day, event.target.checked)} /> {humanize(day)}</label>)}</div><button className="button button-primary" disabled={busy}>Save settings</button></form><p className="filter-note">Timezone: {settings.data.timezone}. Orders are quoted using these cutoff settings.</p></Panel>
      <Panel title="Kitchen holidays"><form className="filter-form" onSubmit={addHoliday}><label>Date<input type="date" required value={holidayDate} onChange={(event) => setHolidayDate(event.target.value)} /></label><label>Description<input value={holidayDescription} onChange={(event) => setHolidayDescription(event.target.value)} /></label><button className="button button-secondary" disabled={busy}>Add holiday</button></form>{settings.data.holidays.length ? <div className="table-wrap"><table><thead><tr><th>Date</th><th>Description</th><th /></tr></thead><tbody>{settings.data.holidays.map((holiday) => <tr key={holiday.id}><td>{prettyDate(holiday.date)}</td><td>{holiday.description || "—"}</td><td><button className="text-link-button" onClick={() => removeHoliday(holiday.id)}>Remove</button></td></tr>)}</tbody></table></div> : <EmptyState title="No kitchen holidays configured" />}</Panel>
      <Panel title="Kitchen stations"><form className="filter-form" onSubmit={saveStation}><label>New station<input required maxLength={60} pattern="[A-Za-z0-9][A-Za-z0-9 _-]*" value={stationName} onChange={(event) => setStationName(event.target.value)} placeholder="e.g. Bakery" /></label><button className="button button-secondary" disabled={stationBusy !== null}>{stationBusy === "create" ? "Adding…" : "Add station"}</button></form><p className="filter-note">Station names are normalized to uppercase codes. Active dishes and unfinished prep work must be reassigned or completed before a station can be deactivated.</p>{stations.data?.length ? <div className="table-wrap"><table><thead><tr><th>Station</th><th>Status</th><th /></tr></thead><tbody>{stations.data.map((item) => <tr key={item.id}><td>{humanize(item.name)}</td><td><StatusBadge value={item.active ? "ACTIVE" : "INACTIVE"} /></td><td><button className="text-link-button" disabled={stationBusy !== null} onClick={() => toggleStation(item.id, !item.active)}>{item.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No kitchen stations configured" />}</Panel>
      <Panel title="Portion sizes"><form className="filter-form" onSubmit={savePortionSize}><label>New portion size<input required maxLength={40} value={portionSizeName} onChange={(event) => setPortionSizeName(event.target.value)} placeholder="e.g. Regular" /></label><button className="button button-secondary" disabled={portionSizeBusy !== null}>{portionSizeBusy === "create" ? "Adding…" : "Add portion size"}</button></form><p className="filter-note">Portion names are reusable references. Configure the price for each portion and option in the catalogue’s option-group editor. A portion size in use must be removed from all groups before deactivation.</p>{portionSizes.data?.length ? <div className="table-wrap"><table><thead><tr><th>Portion size</th><th>Status</th><th /></tr></thead><tbody>{portionSizes.data.map((item) => <tr key={item.id}><td>{item.name}</td><td><StatusBadge value={item.active ? "ACTIVE" : "INACTIVE"} /></td><td><button className="text-link-button" disabled={portionSizeBusy !== null} onClick={() => togglePortionSize(item.id, !item.active)}>{item.active ? "Deactivate" : "Activate"}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No portion sizes configured" />}</Panel>
    </>}
  </>;
}

function CreateOrderPage({ orderId }: { orderId?: string }) {
  const editId = orderId ? Number(orderId) : 0;
  const companies = useData(() => listCompanies({ limit: 100 }), []);
  const employees = useData(() => listEmployees({ limit: 100 }), []);
  const existingOrder = useData(() => editId ? getOrder(editId) : Promise.resolve(null), [editId]);
  const [companyId, setCompanyId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [deliveryDate, setDeliveryDate] = useState(calendarDateInIndia());
  const [deliveryTime, setDeliveryTime] = useState("");
  const [addressId, setAddressId] = useState("");
  const [packaging, setPackaging] = useState("");
  const [status, setStatus] = useState<"DRAFT" | "PLACED">("DRAFT");
  const [overrideCutoff, setOverrideCutoff] = useState(false);
  const [includeSecretCategories, setIncludeSecretCategories] = useState(Boolean(editId));
  const [dishId, setDishId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number[]>>({});
  const [portions, setPortions] = useState<Record<string, number>>({});
  const [cart, setCart] = useState<OrderInput["lines"]>([]);
  const [quote, setQuote] = useState<OrderQuote | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null);
  const [hydratedOrderId, setHydratedOrderId] = useState<number | null>(null);
  const [hydratedCartOrderId, setHydratedCartOrderId] = useState<number | null>(null);
  const menu = useData(
    () => companyId && employeeId
      ? getMenuPreview(Number(companyId), Number(employeeId), deliveryDate, includeSecretCategories)
      : Promise.resolve(null),
    [companyId, employeeId, deliveryDate, includeSecretCategories],
  );
  const employee = employees.data?.data.find((item) => item.id === Number(employeeId));
  const company = companies.data?.data.find((item) => item.id === Number(companyId));
  const dish = menu.data?.categories.flatMap((category) => category.dishes).find((item) => item.id === Number(dishId));
  const address = company?.addresses.find((item) => item.id === Number(addressId));
  const editOrderNotEditable = Boolean(
    editId && existingOrder.data &&
    existingOrder.data.status !== "DRAFT" && existingOrder.data.status !== "PLACED",
  );

  useEffect(() => {
    const order = existingOrder.data;
    if (!editId || !order || !companies.data || !employees.data || hydratedOrderId === editId) return;
    if (order.status !== "DRAFT" && order.status !== "PLACED") return;
    const orderCompany = companies.data.data.find((item) => item.id === order.company.id);
    const matchingAddress = orderCompany?.addresses.find((item) =>
      item.recipientName === order.deliveryAddressSnapshot.recipientName &&
      item.addressLine1 === order.deliveryAddressSnapshot.addressLine1 &&
      item.addressLine2 === (order.deliveryAddressSnapshot.addressLine2 ?? null) &&
      item.city === order.deliveryAddressSnapshot.city &&
      item.region === order.deliveryAddressSnapshot.region &&
      item.postalCode === order.deliveryAddressSnapshot.postalCode &&
      item.country === order.deliveryAddressSnapshot.country,
    );
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setCompanyId(String(order.company.id));
      setEmployeeId(String(order.employee.id));
      setDeliveryDate(order.deliveryDate);
      setDeliveryTime(order.deliveryTime);
      setAddressId(matchingAddress ? String(matchingAddress.id) : "");
      setPackaging(order.packaging ?? "");
      setStatus(order.status as "DRAFT" | "PLACED");
      setHydratedOrderId(editId);
    });
    return () => { cancelled = true; };
  }, [editId, existingOrder.data, companies.data, employees.data, hydratedOrderId]);

  useEffect(() => {
    const order = existingOrder.data;
    if (!editId || !order || !menu.data || hydratedCartOrderId === editId) return;
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const lines: OrderInput["lines"] = order.lines.map((line) => {
        const menuDish = menu.data?.categories.flatMap((category) => category.dishes)
          .find((item) => item.id === line.dishId);
        const combinations = line.combinations.map((combination) => {
          const selections = menuDish?.optionGroups.map((group) => ({
            optionGroupId: group.id,
            optionIds: [] as number[],
            portions: [] as Array<{ optionId: number; portionId: number }>,
          })) ?? [];
          const assignedOptions = new Set<number>();
          for (const option of combination.options) {
            const groupIndex = selections.findIndex((_, index) => {
              const candidateGroup = menuDish?.optionGroups[index];
              return !assignedOptions.has(option.optionId) &&
              (option.optionGroupId === candidateGroup?.id ||
                (option.optionGroupId === null &&
                  candidateGroup?.options.some((candidate) => candidate.id === option.optionId)));
            });
            if (groupIndex < 0) continue;
            const group = menuDish?.optionGroups[groupIndex];
            selections[groupIndex].optionIds.push(option.optionId);
            assignedOptions.add(option.optionId);
            if (group?.usesPortions && option.portionName) {
              const portion = group.options.find((item) => item.id === option.optionId)?.portions
                .find((item) => item.name === option.portionName);
              if (portion) selections[groupIndex].portions.push({ optionId: option.optionId, portionId: portion.id });
            }
          }
          return {
            quantity: combination.quantity,
            selections: selections.map(({ optionGroupId, optionIds, portions }) => ({
              optionGroupId,
              optionIds,
              ...(portions.length ? { portions } : {}),
            })),
          };
        });
        return { dishId: line.dishId, quantity: line.quantity, combinations };
      });
      setCart(lines);
      setHydratedCartOrderId(editId);
    });
    return () => { cancelled = true; };
  }, [editId, existingOrder.data, menu.data, hydratedCartOrderId]);

  function buildOrderLine(): OrderInput["lines"][number] | null {
    if (!dish) return null;
    return {
      dishId: dish.id,
      quantity,
      combinations: [{
        quantity,
        selections: dish.optionGroups.map((group) => ({
          optionGroupId: group.id,
          optionIds: selectedOptions[group.id] ?? [],
          ...(group.usesPortions ? {
            portions: (selectedOptions[group.id] ?? []).map((optionId) => ({
              optionId,
              portionId: portions[`${group.id}-${optionId}`],
            })).filter((selection) => selection.portionId !== undefined),
          } : {}),
        })),
      }],
    };
  }

  function addDishToOrder() {
    const line = buildOrderLine();
    if (!line || !dish) return;
    const selections = line.combinations[0].selections;
    for (const group of dish.optionGroups) {
      const selectedCount = selections.find((selection) => selection.optionGroupId === group.id)?.optionIds.length ?? 0;
      const minimum = group.required ? Math.max(1, group.minSelections) : group.minSelections;
      if (selectedCount < minimum) {
        setError(`${group.name} needs at least ${minimum} selection(s).`);
        return;
      }
      if (group.maxSelections !== null && selectedCount > group.maxSelections) {
        setError(`${group.name} allows at most ${group.maxSelections} selection(s).`);
        return;
      }
      if (group.usesPortions && (selectedOptions[group.id] ?? []).some((optionId) => portions[`${group.id}-${optionId}`] === undefined)) {
        setError(`Choose a portion for every selected option in ${group.name}.`);
        return;
      }
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) {
      setError("Combination quantity must be a whole number between 1 and 10,000.");
      return;
    }
    setError("");
    setCart((current) => {
      const existing = current.find((item) => item.dishId === line.dishId);
      if (!existing) return [...current, line];
      return current.map((item) => item.dishId === line.dishId
        ? {
          ...item,
          quantity: item.quantity + line.quantity,
          combinations: [...item.combinations, ...line.combinations],
        }
        : item);
    });
    setDishId("");
    setQuantity(1);
    setSelectedOptions({});
    setPortions({});
    setQuote(null);
  }

  function orderInput(): OrderInput | null {
    if (!company || !employee || cart.length === 0) return null;
    return {
      companyId: company.id,
      employeeId: employee.id,
      deliveryDate,
      deliveryTime,
      status,
      ...(overrideCutoff ? { overrideCutoff: true } : {}),
      ...(employee.canChooseDeliveryAddress && addressId ? { deliveryAddressId: Number(addressId) } : {}),
      ...(employee.canChooseDeliveryAddress && !addressId && existingOrder.data
        ? { deliveryAddressSnapshot: existingOrder.data.deliveryAddressSnapshot }
        : {}),
      ...(packaging ? { packaging } : {}),
      lines: cart,
    };
  }

  async function requestQuote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setQuote(null); setCreatedOrderId(null);
    try {
      const input = orderInput();
      if (!input) throw new Error("Choose a company and employee, then add at least one dish to the order.");
      setQuote(await createOrderQuote(input));
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  async function submitOrder() {
    const input = orderInput();
    if (!input) return;
    setBusy(true); setError("");
    try {
      const created = editId
        ? await updatePendingOrder(editId, input)
        : await createOrder(input);
      setCreatedOrderId(created.id);
      setCart([]);
      setDishId("");
      setSelectedOptions({});
      setPortions({});
      setQuote(null);
    } catch (reason) { setError(messageOf(reason)); }
    finally { setBusy(false); }
  }
  function toggleOption(groupId: number, optionId: number, checked: boolean) {
    setSelectedOptions((current) => ({
      ...current,
      [groupId]: checked
        ? [...(current[groupId] ?? []), optionId]
        : (current[groupId] ?? []).filter((id) => id !== optionId),
    }));
    setQuote(null);
  }
  if (editId && existingOrder.loading) return <LoadingBlock text="Loading order for editing…" />;
  return <>
    <PageHeading eyebrow="ADMINISTRATION / ORDERS" title={editId ? `Edit order #${editId}` : "Create order"} description="Build the order from the selected employee's current company menu. Totals are quoted and calculated by the backend." action={<Link className="button button-secondary" href="/admin/orders">Back to orders</Link>} />
    <ErrorNotice error={error || (editOrderNotEditable ? "Only draft or placed orders can be edited." : "") || existingOrder.error || companies.error || employees.error || menu.error} />
    {createdOrderId && <div className="notice notice-success">Order {editId ? "updated" : "created"}. <Link href={`/admin/orders/${createdOrderId}`}>View order #{createdOrderId} →</Link></div>}
    <Panel title="1 · Delivery context">
      <div className="management-form">
        <label>Company<select required value={companyId} onChange={(event) => { const nextId = event.target.value; const nextCompany = companies.data?.data.find((item) => item.id === Number(nextId)); setCompanyId(nextId); setEmployeeId(""); setDeliveryTime(nextCompany?.defaultDeliveryTime ?? ""); setPackaging(nextCompany?.defaultPackaging ?? ""); setAddressId(String(nextCompany?.addresses.find((item) => item.isDefault)?.id ?? nextCompany?.addresses[0]?.id ?? "")); setDishId(""); setSelectedOptions({}); setPortions({}); setCart([]); setQuote(null); }}><option value="">Select company</option>{companies.data?.data.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label>Employee<select required value={employeeId} onChange={(event) => { setEmployeeId(event.target.value); setDishId(""); setSelectedOptions({}); setPortions({}); setCart([]); setQuote(null); }}><option value="">Select employee</option>{employees.data?.data.filter((item) => item.companyId === Number(companyId)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.email}</option>)}</select></label>
        <label>Delivery date<input type="date" required value={deliveryDate} onChange={(event) => { setDeliveryDate(event.target.value); setQuote(null); }} /></label>
        <label>Delivery time (IST)<input type="time" required value={deliveryTime} disabled={Boolean(employee && !employee.canChangeDeliveryTime)} onChange={(event) => { setDeliveryTime(event.target.value); setQuote(null); }} /></label>
        {company && <label>Delivery address<select value={addressId} disabled={Boolean(employee && !employee.canChooseDeliveryAddress)} onChange={(event) => { setAddressId(event.target.value); setQuote(null); }}><option value="">Choose address</option>{company.addresses.map((item) => <option key={item.id} value={item.id}>{item.label} · {item.addressLine1}, {item.city}</option>)}</select></label>}
        <label>Packaging<input required value={packaging} disabled={Boolean(employee && !employee.canChangePackaging)} onChange={(event) => { setPackaging(event.target.value); setQuote(null); }} /></label>
        <label>Order state<select value={status} onChange={(event) => { setStatus(event.target.value as "DRAFT" | "PLACED"); setQuote(null); }}><option value="DRAFT">Save as draft</option><option value="PLACED">Place order</option></select></label>
        <label className="inline-check"><input type="checkbox" checked={overrideCutoff} onChange={(event) => { setOverrideCutoff(event.target.checked); setQuote(null); }} /> Admin cutoff override (only valid after cutoff)</label>
        <label className="inline-check"><input type="checkbox" checked={includeSecretCategories} onChange={(event) => { setIncludeSecretCategories(event.target.checked); setDishId(""); setCart([]); setSelectedOptions({}); setPortions({}); setQuote(null); }} /> Include secret categories (direct staff access)</label>
      </div>
      {address && <p className="filter-note">Delivery to {address.recipientName}: {addressText(address)}.</p>}
    </Panel>
    <Panel title={`Order items · ${cart.length} dish line(s)`}>
      {cart.length ? <div className="cart-list">{cart.map((line, index) => {
        const item = menu.data?.categories.flatMap((category) => category.dishes).find((candidate) => candidate.id === line.dishId);
          return <div className="cart-item" key={`${line.dishId}-${index}`}>
            <div><b>{item?.name ?? `Dish #${line.dishId}`}</b> · {line.quantity} total (minimum {item?.minimumOrderQuantity ?? 1})
              {line.combinations.map((combination, combinationIndex) => {
                const selection = combination.selections.flatMap((groupSelection) => {
                  const group = item?.optionGroups.find((candidate) => candidate.id === groupSelection.optionGroupId);
                  return groupSelection.optionIds.map((optionId) => {
                    const option = group?.options.find((candidate) => candidate.id === optionId);
                    const portionId = groupSelection.portions?.find((portion) => portion.optionId === optionId)?.portionId;
                    const portion = option?.portions.find((candidate) => candidate.id === portionId);
                    return `${option?.name ?? `Option #${optionId}`}${portion ? ` (${portion.name})` : ""}`;
                  });
                }).join(", ");
                return <div className="cart-combination" key={`${line.dishId}-${combinationIndex}`}>
                  <span>Combination {combinationIndex + 1}: {combination.quantity} ×{selection ? ` · ${selection}` : " · No options"}</span>
                  <button type="button" className="text-link-button" onClick={() => {
                    setCart((current) => current.flatMap((cartLine) => {
                      if (cartLine.dishId !== line.dishId) return [cartLine];
                      const combinations = cartLine.combinations.filter((_, itemIndex) => itemIndex !== combinationIndex);
                      if (combinations.length === 0) return [];
                      return [{ ...cartLine, quantity: combinations.reduce((sum, item) => sum + item.quantity, 0), combinations }];
                    }));
                    setQuote(null);
                  }}>Remove</button>
                </div>;
              })}
            </div>
          </div>;
        })}</div> : <p className="panel-copy">Add one or more dishes below to build this order.</p>}
    </Panel>
    <Panel title="2 · Select a dish">
      {!companyId || !employeeId ? <p className="panel-copy">Choose a company and employee to load current menu availability.</p> : menu.loading ? <LoadingBlock text="Loading available menu…" /> : menu.data ? <>
        <div className="filter-form"><label>Menu item<select value={dishId} onChange={(event) => { setDishId(event.target.value); setQuantity(1); setSelectedOptions({}); setPortions({}); setQuote(null); }}><option value="">Select a dish</option>{menu.data.categories.flatMap((category) => category.dishes.map((item) => <option key={item.id} value={item.id}>{category.name} · {item.name} · {formatMoney(item.price)}</option>))}</select></label>{dish && <label>Combination quantity<input type="number" min="1" max="10000" required value={quantity} onChange={(event) => { setQuantity(Number(event.target.value)); setQuote(null); }} /></label>}</div>
        {dish?.imageUrl && <Image className="dish-preview-image" src={dish.imageUrl} alt={dish.name} width={480} height={300} unoptimized />}
        {dish?.optionGroups.map((group) => <fieldset className="choice-group" key={group.id}><legend>{group.name} {group.required && "· Required"}</legend><p>Select {group.minSelections}–{group.maxSelections ?? "any"} option(s){group.usesPortions ? " and a portion for each selected option" : ""}.</p>{group.options.map((option) => <div className="choice-row" key={option.id}><label><input type="checkbox" checked={(selectedOptions[group.id] ?? []).includes(option.id)} onChange={(event) => toggleOption(group.id, option.id, event.target.checked)} /> {option.name} · {formatMoney(option.price)}</label>{group.usesPortions && (selectedOptions[group.id] ?? []).includes(option.id) && <select required value={portions[`${group.id}-${option.id}`] ?? ""} onChange={(event) => { setPortions({ ...portions, [`${group.id}-${option.id}`]: Number(event.target.value) }); setQuote(null); }}><option value="">Select portion</option>{option.portions.map((portion) => <option key={portion.id} value={portion.id}>{portion.name} (+{formatMoney(portion.extraPrice)})</option>)}</select>}</div>)}</fieldset>)}
        {dish && <button type="button" className="button button-primary" onClick={addDishToOrder}>Add dish to order</button>}
      </> : <EmptyState title="Menu not available" />}
    </Panel>
    <Panel title="3 · Verify and submit">
      <form className="filter-form" onSubmit={requestQuote}><button className="button button-secondary" disabled={busy || cart.length === 0}>{busy ? "Working…" : "Get server quote"}</button></form>
      {quote && <><div className="notice notice-success"><b>Backend quote · {formatMoney(quote.totalAmount)}</b><p>Order state: {humanize(quote.status)} · Kitchen ready {new Date(quote.plannedKitchenReadyAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p>{quote.lines.map((line, index) => <p key={`${line.dishId}-${index}`}>{line.quantity} × {line.dishName} · {formatMoney(line.lineTotal)}{line.combinations.flatMap((combination) => combination.options.map((item) => ` ${item.name}${item.portionName ? ` (${item.portionName})` : ""}`)).join(", ")}</p>)}</div><div className="panel-actions"><span>Confirm the quote before creating this order.</span><button className="button button-primary" disabled={busy} onClick={submitOrder}>{busy ? "Submitting…" : status === "PLACED" ? "Place order" : "Save draft"}</button></div></>}
    </Panel>
  </>;
}

function UnsupportedPage({ section }: { section: string }) {
  const labels: Record<string, string> = {
    companies: "Companies", employees: "Employees", catalogue: "Catalogue", menu: "Menu preview", settings: "Settings",
    "new-order": "Create an order",
  };
  const title = labels[section] ?? humanize(section);
  const limitation = section === "new-order"
    ? "Order submission exists, but company, employee, and menu lookup APIs are missing. Creating an order safely requires those server-backed choices and current menu prices."
    : `The current NestJS controller for ${title.toLowerCase()} has no implemented routes.`;
  return <><PageHeading eyebrow="ADMINISTRATION" title={title} description="This workspace section is not yet wired to a backend API." /><div className="notice notice-warning"><div><b>{section === "new-order" ? "Required lookup APIs unavailable" : "Backend endpoint unavailable"}</b><p>{limitation} This frontend does not use mock data or pretend to save changes.</p></div></div><Panel title="What is needed"><p className="panel-copy">Implement authenticated backend endpoints and request/response DTOs for {title.toLowerCase()} before enabling this screen. The frontend can then integrate with the real API contract.</p></Panel></>;
}

function calendarDateInIndia() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
