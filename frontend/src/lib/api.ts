export type AuthRole = "ADMIN" | "KITCHEN" | "DISPATCH" | "DRIVER";
export type StaffUser = {
  id: number;
  name: string;
  email: string;
  role: AuthRole;
  driver: { id: number; company: CompanySummary } | null;
};

export type AuthUser = {
  id: number;
  email: string;
  role: AuthRole;
};

export type LoginInput = {
  email: string;
  password: string;
};

export type OrderStatus =
  | "DRAFT"
  | "PLACED"
  | "CONFIRMED"
  | "CANCELLED"
  | "REJECTED"
  | "DELIVERED";
export type KitchenUnitStatus = "NOT_STARTED" | "STARTED" | "DONE";
export type KitchenStation = string;
export type KitchenStationReference = { id: number; name: KitchenStation; active: boolean };
export type PortionSizeReference = { id: number; name: string; active: boolean };
export type DropStatus =
  | "KITCHEN_READY"
  | "DISPATCH_READY"
  | "OUT_FOR_DELIVERY"
  | "DELIVERED";
export type InvoiceStatus = "ISSUED" | "PAID";

export type Person = { id: number; name: string; email: string };
export type CompanySummary = { id: number; name: string };
export type AddressSnapshot = {
  recipientName?: string;
  addressLine1?: string;
  addressLine2?: string | null;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
};

export type Order = {
  id: number;
  status: OrderStatus;
  employee: Person;
  company: CompanySummary;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: AddressSnapshot;
  packaging: string | null;
  cutoffAt: string | null;
  plannedDispatchReadyAt: string | null;
  plannedKitchenReadyAt: string | null;
  totalAmount: string;
  createdAt: string;
  invoice: {
    id: number;
    invoiceNumber: string;
    status: InvoiceStatus;
    issuedAt: string;
    paidAt: string | null;
  } | null;
  timeline: Array<{ status: OrderStatus; occurredAt: string }>;
  lines: Array<{
    id: number;
    dishId: number;
    dishName: string;
    dishSku: string;
    quantity: number;
    dishUnitPrice: string;
    lineTotal: string;
    combinations: Array<{
      id: number;
      quantity: number;
      unitPrice: string;
      totalPrice: string;
      options: Array<{
        id: number;
        optionId: number;
        optionGroupId: number | null;
        portionId: number | null;
        name: string;
        unitPrice: string;
        portionName: string | null;
        portionExtraPrice: string;
      }>;
    }>;
  }>;
};

export type KitchenOrder = {
  id: number;
  deliveryDate: string;
  deliveryTime: string;
  plannedKitchenReadyAt: string | null;
  kitchenStartedAt: string | null;
  kitchenReadyAt: string | null;
  employee: Person;
  company: CompanySummary;
  units: Array<{
    id: number;
    orderCombinationId: number;
    dishName: string;
    dishSku: string;
    quantity: number;
    station: KitchenStation;
    status: KitchenUnitStatus;
    startedAt: string | null;
    doneAt: string | null;
    selectedOptions: Array<{ id: number; name: string }>;
  }>;
  progress: { completedUnits: number; totalUnits: number };
  isAtRisk: boolean;
};

export type DispatchDrop = {
  id: number;
  company: CompanySummary;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: AddressSnapshot;
  status: DropStatus;
  orderCount: number;
  orders: Array<{
    id: number;
    status: OrderStatus;
    kitchenReadyAt: string | null;
    employee: Person;
    totalAmount: string;
  }>;
  driver: (Person & { id: number }) | null;
  defaultDriver: (Person & { id: number }) | null;
  allOrdersKitchenReady: boolean;
  canGoOutForDelivery: boolean;
  isOutForDelivery: boolean;
  isDelivered: boolean;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  onTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
};

export type DriverDrop = {
  id: number;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: AddressSnapshot;
  status: DropStatus;
  company: CompanySummary;
  orderCount: number;
  orders: Array<{ id: number; employeeName: string; employeeEmail: string }>;
};

export type DriverDropDetail = {
  id: number;
  company: CompanySummary;
  deliveryDate: string;
  deliveryTime: string;
  deliveryAddressSnapshot: AddressSnapshot;
  driverInstructions: string | null;
  status: DropStatus;
  orderCount: number;
  orders: Array<{
    id: number;
    status: OrderStatus;
    employee: Person;
    totalAmount: string;
    packaging: string;
  }>;
  driver: Person | null;
  outForDeliveryAt: string | null;
  deliveredAt: string | null;
  onTime: boolean | null;
  deliveryNote: string | null;
  deliveryPhotoUrl: string | null;
};

export type Invoice = {
  id: number;
  invoiceNumber: string;
  company: CompanySummary;
  status: InvoiceStatus;
  totalAmount: string;
  issuedAt: string;
  paidAt: string | null;
  orderCount: number;
  orders: Array<{ id: number; status: OrderStatus; totalAmount: string }>;
};

export type DashboardSummary = {
  deliveryDate: string;
  generatedAt: string;
  kitchen: { confirmedOrders: number; totalUnits: number; startedUnits: number; doneUnits: number; atRiskOrders: number };
  dispatch: { drops: number; unassignedDrops: number; outForDeliveryDrops: number; deliveredDrops: number; lateDrops: number };
  billing: { uninvoicedConfirmedOrders: number; uninvoicedConfirmedAmount: string };
  catalogue: { activeDishes: number; activeCategories: number };
};

export type UninvoicedOrder = {
  id: number;
  company: CompanySummary;
  employee: Person;
  status: OrderStatus;
  deliveryDate: string;
  deliveryTime: string;
  totalAmount: string;
};

export type PriceTier = {
  id: number;
  name: string;
  isDefault: boolean;
  pricingRuleType: string;
  baseTierId: number | null;
  multiplier: string | null;
  markupPercent: string | null;
};

export type Page<T> = { data: T[]; meta: { total: number; limit: number; offset: number } };
export type CompanyAddress = {
  id: number; label: string; recipientName: string; addressLine1: string;
  addressLine2: string | null; city: string; region: string; postalCode: string;
  country: string; isDefault: boolean;
};
export type Company = {
  id: number;
  name: string;
  billingContactName: string | null;
  billingContactEmail: string | null;
  emailDomains: string[];
  addresses: CompanyAddress[];
  deliveryMinutes: number;
  deliveryWorkingDays: string[];
  defaultDeliveryTime: string | null;
  defaultPackaging: string | null;
  driverInstructions: string | null;
  priceTierId: number | null;
  priceTier: { id: number; name: string } | null;
  owner: Person | null;
  defaultDriver: (Person & { id: number }) | null;
  hiddenCategories: Array<{ categoryId: number }>;
  hiddenDishes: Array<{ dishId: number }>;
  holidays: Array<{ id: number; date: string; description: string | null }>;
  employees: Array<Person & {
    canChooseDeliveryAddress: boolean;
    canChangeDeliveryTime: boolean;
    canChangePackaging: boolean;
  }>;
  _count: { orders: number; invoices: number };
};
export type Employee = Person & {
  companyId: number;
  company: CompanySummary;
  canChooseDeliveryAddress: boolean;
  canChangeDeliveryTime: boolean;
  canChangePackaging: boolean;
  allergens: Array<{ id: number; name: string }>;
  dietaryPreferences: Array<{ id: number; name: string }>;
  _count: { orders: number };
};
export type DriverProfile = { id: number; companyId: number; user: Person };
export type CatalogueCategory = {
  id: number; name: string; description: string | null; displayOrder: number;
  active: boolean; secret: boolean; _count: { dishes: number };
};
export type CatalogueOption = {
  id: number; name: string; costPrice: string; active: boolean;
  allergens: Array<{ id: number; name: string }>;
  dietaryTags: Array<{ id: number; name: string }>;
};
export type CatalogueDish = {
  id: number; categoryId: number; name: string; description: string | null;
  imageUrl: string | null; sku: string; temperature: string; costPrice: string;
  displayOrder: number; minimumOrderQuantity: number; active: boolean; kitchenStation: KitchenStation | null;
  category: { id: number; name: string };
  allergens: Array<{ id: number; name: string }>;
  dietaryTags: Array<{ id: number; name: string }>;
  optionGroups: Array<{
    id: number; name: string; required: boolean; usesPortions: boolean;
    minSelections: number; maxSelections: number | null; displayOrder: number;
    options: Array<CatalogueOption & {
      displayOrder: number;
      portions: Array<{ id: number; portionSizeId: number; name: string; active: boolean; extraPrice: string }>;
    }>;
  }>;
};
export type MenuPreview = {
  company: {
    id: number; name: string; defaultDeliveryTime: string | null;
    deliveryMinutes: number; defaultPackaging: string | null;
    driverInstructions: string | null; addresses: CompanyAddress[];
    priceTierId: number; canDeliverOnSelectedDate: boolean | null;
  };
  employee: {
    id: number; name: string; email: string; canChooseDeliveryAddress: boolean;
    canChangeDeliveryTime: boolean; canChangePackaging: boolean;
    allergens: string[]; dietaryPreferences: string[];
  };
  categories: Array<{
    id: number; name: string; description: string | null;
    dishes: Array<{
      id: number; name: string; description: string | null; imageUrl: string | null;
      sku: string; temperature: string; minimumOrderQuantity: number;
      kitchenStation: KitchenStation | null; price: string;
      allergens: string[]; dietaryTags: string[];
      optionGroups: Array<{
        id: number; name: string; required: boolean; minSelections: number;
        maxSelections: number | null; usesPortions: boolean;
        options: Array<{
          id: number; name: string; price: string; allergens: string[]; dietaryTags: string[];
          portions: Array<{ id: number; portionSizeId: number; name: string; extraPrice: string }>;
        }>;
      }>;
    }>;
  }>;
};
export type KitchenSettings = {
  id: number; cutoffWorkingDays: number; cutoffTime: string;
  workingDays: string[]; timezone: string;
  holidays: Array<{ id: number; date: string; description: string | null }>;
};
export type OrderInput = {
  employeeId: number; companyId: number; deliveryDate: string; deliveryTime: string;
  status: "DRAFT" | "PLACED"; overrideCutoff?: boolean;
  deliveryAddressId?: number; packaging?: string;
  deliveryAddressSnapshot?: AddressSnapshot;
  lines: Array<{
    dishId: number; quantity: number;
    combinations: Array<{
      quantity: number;
      selections: Array<{
        optionGroupId: number; optionIds: number[];
        portions?: Array<{ optionId: number; portionId: number }>;
      }>;
    }>;
  }>;
};
export type OrderQuote = {
  companyId: number; employeeId: number; status: OrderStatus;
  cutoffAt: string; plannedKitchenReadyAt: string; plannedDispatchReadyAt: string;
  totalAmount: string;
  lines: Array<{
    dishId: number; dishName: string; quantity: number;
    dishUnitPrice: string; lineTotal: string;
    combinations: Array<{
      quantity: number; unitPrice: string; totalPrice: string;
      options: Array<{ id: number; name: string; unitPrice: string; portionName: string | null }>;
    }>;
  }>;
};
export type ReferenceData = {
  allergens: Array<{ id: number; name: string }>;
  dietaryTags: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
  kitchenStations: KitchenStation[];
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001").replace(/\/$/, "");

type AuthUserWithToken = AuthUser & { accessToken: string };

let bearerToken: string | null = null;

export function setAccessToken(token: string | null) {
  bearerToken = token;
  if (typeof window !== "undefined") {
    if (token) {
      try {
        sessionStorage.setItem("auth_access_token", token);
      } catch {
        /* sessionStorage may be blocked in private mode */
      }
    } else {
      try {
        sessionStorage.removeItem("auth_access_token");
      } catch {
        /* ignore */
      }
    }
  }
}

function getAccessToken(): string | null {
  if (bearerToken) return bearerToken;
  if (typeof window !== "undefined") {
    try {
      const stored = sessionStorage.getItem("auth_access_token");
      if (stored) {
        bearerToken = stored;
        return stored;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

function errorMessage(payload: unknown, status: number): string {
  if (typeof payload === "object" && payload !== null && "message" in payload) {
    const message = payload.message;
    if (typeof message === "string") return message;
    if (Array.isArray(message) && message.every((part) => typeof part === "string")) {
      return message.join(". ");
    }
  }
  if (status === 401) return "Your session has expired. Please sign in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "The requested item could not be found.";
  if (status === 409) return "This item was updated by someone else. Refresh and try again.";
  if (status >= 500) return "The service encountered an error. Please try again.";
  return "The request could not be completed.";
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number | boolean | undefined>,
): Promise<T> {
  const url = new URL(`${API_BASE_URL}/api${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") url.searchParams.set(key, String(value));
  }
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status === 401) {
      setAccessToken(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
    throw new ApiError(errorMessage(payload, response.status), response.status);
  }
  return payload as T;
}

export async function login(input: LoginInput): Promise<AuthUser> {
  const result = await request<AuthUserWithToken>("/auth/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
  setAccessToken(result.accessToken ?? null);
  const { accessToken: _ignored, ...user } = result;
  void _ignored;
  return user;
}
export const getCurrentUser = () => request<AuthUser>("/auth/me");
export async function logout(): Promise<{ success: boolean }> {
  setAccessToken(null);
  return request<{ success: boolean }>("/auth/logout", { method: "POST" });
}
export const listStaffUsers = () => request<StaffUser[]>("/users");
export const createStaffUser = (input: {
  name: string;
  email: string;
  password: string;
  role: AuthRole;
  driverCompanyId?: number;
}) => request<StaffUser>("/users", { method: "POST", body: JSON.stringify(input) });

export const listOrders = (query: {
  companyId?: number;
  employeeId?: number;
  status?: OrderStatus;
  search?: string;
  deliveryDateFrom?: string;
  deliveryDateTo?: string;
  invoiced?: boolean;
  limit?: number;
  offset?: number;
}) => request<Order[]>("/orders", {}, query);
export const getOrder = (id: number) => request<Order>(`/orders/${id}`);
export const createOrderQuote = (input: OrderInput) =>
  request<OrderQuote>("/orders/quote", { method: "POST", body: JSON.stringify(input) });
export const createOrder = (input: OrderInput) =>
  request<Order>("/orders", { method: "POST", body: JSON.stringify(input) });
export const updatePendingOrder = (id: number, input: OrderInput) =>
  request<Order>(`/orders/${id}/edit`, { method: "PATCH", body: JSON.stringify(input) });
export const updateConfirmedOrder = (id: number, input: {
  deliveryTime?: string; deliveryAddressId?: number; packaging?: string;
}) => request<Order>(`/orders/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const processOrderCutoff = (deliveryDate: string) =>
  request<{ processedAt: string; cancelledDrafts: number; confirmedOrders: number }>(
    "/orders/process-cutoff",
    { method: "POST", body: JSON.stringify({ deliveryDate }) },
  );
export const cancelOrder = (id: number) =>
  request<{ id: number; status: OrderStatus; cancelledAt: string }>(`/orders/${id}/cancel`, {
    method: "POST",
  });
export const rejectOrder = (id: number) =>
  request<{ id: number; status: OrderStatus; rejectedAt: string }>(`/orders/${id}/reject`, {
    method: "POST",
  });

export const listTiers = () => request<PriceTier[]>("/admin/pricing/tiers");
export const getCompanyTier = (id: number) =>
  request<number>("/admin/pricing/companies/" + id + "/tier");
export type TierDishPrice = {
  id: number; name: string; sku: string; category: string; active: boolean;
  costPrice: string; overridePrice: string | null; effectivePrice: string | null;
  state: "OVERRIDE" | "DERIVED" | "MISSING";
};
export const getTierDishPrices = (id: number) =>
  request<{ tier: { id: number; name: string }; dishes: TierDishPrice[] }>(`/admin/pricing/tiers/${id}/dish-prices`);
export const saveTierDishPrices = (id: number, prices: Array<{ itemId: number; overridePrice?: string }>) =>
  request<{ tier: { id: number; name: string }; dishes: TierDishPrice[] }>(
    `/admin/pricing/tiers/${id}/dish-prices`,
    { method: "PUT", body: JSON.stringify({ prices }) },
  );
export type TierOptionPrice = {
  id: number; name: string; active: boolean; costPrice: string;
  overridePrice: string | null; effectivePrice: string | null;
  state: "OVERRIDE" | "DERIVED" | "MISSING";
};
export const getTierOptionPrices = (id: number) =>
  request<{ tier: { id: number; name: string }; options: TierOptionPrice[] }>(`/admin/pricing/tiers/${id}/option-prices`);
export const saveTierOptionPrices = (id: number, prices: Array<{ itemId: number; overridePrice?: string }>) =>
  request<{ tier: { id: number; name: string }; options: TierOptionPrice[] }>(
    `/admin/pricing/tiers/${id}/option-prices`,
    { method: "PUT", body: JSON.stringify({ prices }) },
  );

export const listCompanies = (query: { search?: string; limit?: number; offset?: number } = {}) =>
  request<Page<Company>>("/companies", {}, query);
export const getCompany = (id: number) => request<Company>(`/companies/${id}`);
export const createCompany = (input: CompanyInput) =>
  request<Company>("/companies", { method: "POST", body: JSON.stringify(input) });
export const updateCompany = (id: number, input: Partial<CompanyInput>) =>
  request<Company>(`/companies/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const addCompanyHoliday = (id: number, input: { date: string; description?: string }) =>
  request<unknown>(`/companies/${id}/holidays`, { method: "POST", body: JSON.stringify(input) });
export const removeCompanyHoliday = (companyId: number, holidayId: number) =>
  request<{ success: boolean }>(`/companies/${companyId}/holidays/${holidayId}`, { method: "DELETE" });
export const listDrivers = () => request<DriverProfile[]>("/companies/drivers");
export type DispatchDriver = {
  id: number; companyId: number; name: string; email: string; activeDropCount: number;
};
export const listDispatchDrivers = (companyId?: number) =>
  request<DispatchDriver[]>("/dispatch/drivers", {}, { companyId });

export type CompanyInput = {
  name: string; emailDomains: string[]; addresses: Array<Omit<CompanyAddress, "id">>;
  billingContactName?: string; billingContactEmail?: string; priceTierId?: number;
  ownerEmployeeId?: number | null; defaultDeliveryTime?: string; deliveryMinutes: number;
  deliveryWorkingDays: string[]; defaultPackaging?: string; driverInstructions?: string;
  defaultDriverId?: number | null; hiddenCategoryIds?: number[]; hiddenDishIds?: number[];
};

export const listEmployees = (query: { companyId?: number; search?: string; limit?: number; offset?: number } = {}) =>
  request<Page<Employee>>("/employees", {}, query);
export const getEmployee = (id: number) => request<Employee>(`/employees/${id}`);
export type EmployeeInput = {
  companyId: number; name: string; email: string;
  canChooseDeliveryAddress: boolean; canChangeDeliveryTime: boolean;
  canChangePackaging: boolean; allergenIds: number[]; dietaryTagIds: number[];
};
export const createEmployee = (input: EmployeeInput) =>
  request<Employee>("/employees", { method: "POST", body: JSON.stringify(input) });
export const updateEmployee = (id: number, input: Partial<EmployeeInput>) =>
  request<Employee>(`/employees/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export type EmployeeCsvImportResult = {
  imported: Array<{ row: number; id: number; name: string; email: string }>;
  errors: Array<{ row: number; message: string }>;
  importedCount: number;
  errorCount: number;
};
export const importEmployeesCsv = (companyId: number, csv: string) =>
  request<EmployeeCsvImportResult>("/employees/import", {
    method: "POST",
    body: JSON.stringify({ companyId, csv }),
  });
export const getEmployeeReferenceData = () =>
  request<{ allergens: ReferenceData["allergens"]; dietaryTags: ReferenceData["dietaryTags"] }>("/employees/reference-data");

export const getCatalogueReferenceData = () => request<ReferenceData>("/catalogue/reference-data");
export const createAllergen = (name: string) =>
  request<ReferenceData["allergens"][number]>("/catalogue/reference-data/allergens", { method: "POST", body: JSON.stringify({ name }) });
export const createDietaryTag = (name: string) =>
  request<ReferenceData["dietaryTags"][number]>("/catalogue/reference-data/dietary-tags", { method: "POST", body: JSON.stringify({ name }) });
export const listCategories = () => request<CatalogueCategory[]>("/catalogue/categories");
export type CategoryInput = { name: string; description?: string; displayOrder: number; active: boolean; secret: boolean };
export const createCategory = (input: CategoryInput) =>
  request<CatalogueCategory>("/catalogue/categories", { method: "POST", body: JSON.stringify(input) });
export const updateCategory = (id: number, input: CategoryInput) =>
  request<CatalogueCategory>(`/catalogue/categories/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const listDishes = (query: { categoryId?: number; search?: string; limit?: number; offset?: number } = {}) =>
  request<Page<CatalogueDish>>("/catalogue/dishes", {}, query);
export type DishInput = {
  categoryId: number; name: string; description?: string; imageUrl?: string;
  sku: string; temperature: string; costPrice: string; displayOrder: number; minimumOrderQuantity: number;
  active: boolean; kitchenStation?: KitchenStation; allergenIds: number[];
  dietaryTagIds: number[]; optionGroupIds: number[];
};
export const createDish = (input: DishInput) =>
  request<CatalogueDish>("/catalogue/dishes", { method: "POST", body: JSON.stringify(input) });
export const updateDish = (id: number, input: DishInput) =>
  request<CatalogueDish>(`/catalogue/dishes/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const listOptions = () => request<CatalogueOption[]>("/catalogue/options");
export type OptionInput = { name: string; costPrice: string; active: boolean; allergenIds: number[]; dietaryTagIds: number[] };
export const createOption = (input: OptionInput) =>
  request<CatalogueOption>("/catalogue/options", { method: "POST", body: JSON.stringify(input) });
export const updateOption = (id: number, input: OptionInput) =>
  request<CatalogueOption>(`/catalogue/options/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export type OptionGroup = {
  id: number; name: string; required: boolean; usesPortions: boolean;
  minSelections: number; maxSelections: number | null;
  options: Array<{ optionId: number; displayOrder: number; option: CatalogueOption; portions: Array<{ id: number; portionSizeId: number; name: string; active: boolean; extraPrice: string }> }>;
  dishes: Array<{ dishId: number; displayOrder: number; dish: { id: number; name: string } }>;
};
export type OptionGroupInput = {
  name: string; required: boolean; usesPortions: boolean; minSelections: number;
  maxSelections?: number; optionIds: number[]; dishIds: number[];
  portions: Array<{ optionId: number; portionSizeId: number; extraPrice: string }>;
};
export const listOptionGroups = () => request<OptionGroup[]>("/catalogue/option-groups");
export const createOptionGroup = (input: OptionGroupInput) =>
  request<OptionGroup>("/catalogue/option-groups", { method: "POST", body: JSON.stringify(input) });
export const updateOptionGroup = (id: number, input: OptionGroupInput) =>
  request<OptionGroup>(`/catalogue/option-groups/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const getMenuPreview = (
  companyId: number,
  employeeId: number,
  deliveryDate?: string,
  includeSecretCategories = false,
) => request<MenuPreview>("/catalogue/menu/preview", {}, {
  companyId, employeeId, deliveryDate, includeSecretCategories: includeSecretCategories || undefined,
});

export const getKitchenSettings = () => request<KitchenSettings>("/settings");
export const listPortionSizes = () => request<PortionSizeReference[]>("/settings/portion-sizes");
export const createPortionSize = (name: string) =>
  request<PortionSizeReference>("/settings/portion-sizes", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
export const updatePortionSize = (id: number, active: boolean) =>
  request<PortionSizeReference>(`/settings/portion-sizes/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
export const listKitchenStations = () => request<KitchenStationReference[]>("/settings/kitchen-stations");
export const createKitchenStation = (name: string) =>
  request<KitchenStationReference>("/settings/kitchen-stations", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
export const updateKitchenStation = (id: number, active: boolean) =>
  request<KitchenStationReference>(`/settings/kitchen-stations/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ active }),
  });
export const updateKitchenSettings = (input: {
  cutoffWorkingDays: number; cutoffTime: string; workingDays: string[];
}) => request<KitchenSettings>("/settings", { method: "PUT", body: JSON.stringify(input) });
export const addKitchenHoliday = (input: { date: string; description?: string }) =>
  request<unknown>("/settings/holidays", { method: "POST", body: JSON.stringify(input) });
export const removeKitchenHoliday = (id: number) =>
  request<{ success: boolean }>(`/settings/holidays/${id}`, { method: "DELETE" });

export const getKitchenOrders = (query: {
  deliveryDate?: string;
  kitchenStation?: KitchenStation;
  status?: KitchenUnitStatus;
}) => request<KitchenOrder[]>("/kitchen/orders", {}, query);
export const startKitchenUnit = (id: number) =>
  request<unknown>(`/kitchen/units/${id}/start`, { method: "POST" });
export const finishKitchenUnit = (id: number) =>
  request<unknown>(`/kitchen/units/${id}/done`, { method: "POST" });
export const forceCompleteKitchenOrder = (id: number) =>
  request<{ orderId: number; completedUnits: number; totalUnits: number; kitchenReadyAt: string }>(
    `/admin/kitchen/orders/${id}/force-complete`,
    { method: "POST" },
  );

export const groupReadyOrders = (deliveryDate: string) =>
  request<unknown>("/dispatch/drops/group", {
    method: "POST",
    body: JSON.stringify({ deliveryDate }),
  });
export const listDispatchDrops = (query: { deliveryDate?: string; status?: DropStatus }) =>
  request<DispatchDrop[]>("/dispatch/drops", {}, query);
export const assignDriver = (id: number, driverId: number) =>
  request<unknown>(`/dispatch/drops/${id}/assign-driver`, {
    method: "POST",
    body: JSON.stringify({ driverId }),
  });
export const markDropReady = (id: number) =>
  request<unknown>(`/dispatch/drops/${id}/ready`, { method: "POST" });
export const sendDropForDelivery = (id: number) =>
  request<unknown>(`/dispatch/drops/${id}/out-for-delivery`, { method: "POST" });

export const getDriverDrops = () => request<DriverDrop[]>("/driver/drops/today");
export const getDriverDrop = (id: number) =>
  request<DriverDropDetail>(`/driver/drops/${id}`);
export const deliverDrop = (id: number, note?: string, photoUrl?: string) =>
  request<unknown>(`/driver/drops/${id}/deliver`, {
    method: "POST",
    body: JSON.stringify({
      ...(note ? { note } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    }),
  });

export const getUninvoicedOrders = (companyId?: number) =>
  request<UninvoicedOrder[]>("/admin/billing/uninvoiced-orders", {}, { companyId });
export const getDashboardSummary = (deliveryDate?: string) =>
  request<DashboardSummary>("/admin/dashboard/summary", {}, { deliveryDate });
export const listInvoices = (query: {
  companyId?: number; status?: InvoiceStatus; issuedDateFrom?: string; issuedDateTo?: string;
  paidDateFrom?: string; paidDateTo?: string; limit?: number; offset?: number;
} = {}) => request<Page<Invoice>>("/admin/billing/invoices", {}, query);
export const getInvoice = (id: number) => request<Invoice & { orders: Invoice["orders"] }>(`/admin/billing/invoices/${id}`);
export const createInvoice = (companyId: number, orderIds: number[]) =>
  request<Invoice & { orderIds: number[] }>("/admin/billing/invoices", {
    method: "POST",
    body: JSON.stringify({ companyId, orderIds }),
  });
export const markInvoicePaid = (id: number) =>
  request<Invoice>(`/admin/billing/invoices/${id}/pay`, { method: "POST" });
