import {
  DeliveryDropStatus,
  KitchenUnitStatus,
  OrderStatus,
  Prisma,
  PrismaClient,
  PricingRuleType,
  Role,
  Weekday,
} from '@prisma/client';
import { hash } from 'bcryptjs';
import { canonicalizeDeliveryAddress } from '../src/dispatch/delivery-address.util';

const prisma = new PrismaClient();
const seedPassword = process.env.SEED_PASSWORD ?? 'Test@1234';
const allWeekdays = Object.values(Weekday);

const companySeeds = [
  {
    name: 'Google',
    domain: 'google.demo.example',
    billingContact: 'Google Demo Accounts',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411001',
    addressLine1: '100 Market Street',
    time: '12:00',
    packaging: 'Reusable tray',
    instructions: 'Demo delivery: use the main reception.',
    tier: 'Standard',
    employees: [
      { name: 'Alex Morgan', email: 'alex@google.demo.example', legacyEmail: 'alex@fernleaftest.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Sam Patel', email: 'sam@google.demo.example', legacyEmail: 'sam@fernleaftest.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Jordan Lee', email: 'jordan@google.demo.example', legacyEmail: 'jordan@fernleaftest.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Avery Chen', email: 'avery@google.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Riley Shah', email: 'riley@google.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Microsoft',
    domain: 'microsoft.demo.example',
    billingContact: 'Microsoft Demo Accounts',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411002',
    addressLine1: '25 River Road',
    time: '13:00',
    packaging: 'Compostable box',
    instructions: 'Demo delivery: leave the order at the front desk.',
    tier: 'Partner',
    employees: [
      { name: 'Taylor Nguyen', email: 'taylor@microsoft.demo.example', legacyEmail: 'taylor@northstartest.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Morgan Shah', email: 'morgan@microsoft.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: true },
      { name: 'Casey Rao', email: 'casey@microsoft.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Jamie Wilson', email: 'jamie@microsoft.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Dev Patel', email: 'dev@microsoft.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Amazon',
    domain: 'amazon.demo.example',
    billingContact: 'Amazon Demo Accounts',
    city: 'Bengaluru',
    region: 'Karnataka',
    postalCode: '560001',
    addressLine1: '18 Residency Road',
    time: '12:30',
    packaging: 'Insulated meal box',
    instructions: 'Demo delivery: call the office reception on arrival.',
    tier: 'Standard',
    employees: [
      { name: 'Priya Nair', email: 'priya@amazon.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Arjun Mehta', email: 'arjun@amazon.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Neha Kapoor', email: 'neha@amazon.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Ira Bose', email: 'ira@amazon.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Vikram Rao', email: 'vikram@amazon.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Infosys',
    domain: 'infosys.demo.example',
    billingContact: 'Infosys Demo Accounts',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411045',
    addressLine1: '45 Hinjawadi Phase 1',
    time: '12:45',
    packaging: 'Compostable box',
    instructions: 'Demo delivery: use the visitor entrance.',
    tier: 'Partner',
    employees: [
      { name: 'Aarav Desai', email: 'aarav@infosys.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: true },
      { name: 'Ananya Iyer', email: 'ananya@infosys.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Rohan Kulkarni', email: 'rohan@infosys.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Diya Menon', email: 'diya@infosys.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Kunal Shah', email: 'kunal@infosys.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: true },
    ],
  },
  {
    name: 'Tata Consultancy Services',
    domain: 'tcs.demo.example',
    billingContact: 'TCS Demo Accounts',
    city: 'Mumbai',
    region: 'Maharashtra',
    postalCode: '400001',
    addressLine1: '9 Nariman Point',
    time: '13:15',
    packaging: 'Reusable tray',
    instructions: 'Demo delivery: report to the building security desk.',
    tier: 'Standard',
    employees: [
      { name: 'Ishaan Verma', email: 'ishaan@tcs.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Meera Joshi', email: 'meera@tcs.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: true },
      { name: 'Kabir Singh', email: 'kabir@tcs.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Sana Khan', email: 'sana@tcs.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Aditya Rao', email: 'aditya@tcs.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Apple',
    domain: 'apple.demo.example',
    billingContact: 'Apple Demo Accounts',
    city: 'Bengaluru',
    region: 'Karnataka',
    postalCode: '560038',
    addressLine1: '14 Innovation Park',
    time: '12:15',
    packaging: 'Compostable box',
    instructions: 'Demo delivery: check in at the visitor reception.',
    tier: 'Partner',
    employees: [
      { name: 'Maya Kapoor', email: 'maya@apple.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Noah Thomas', email: 'noah@apple.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Anika Shah', email: 'anika@apple.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Ethan Dutta', email: 'ethan@apple.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Zoya Mehta', email: 'zoya@apple.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Meta',
    domain: 'meta.demo.example',
    billingContact: 'Meta Demo Accounts',
    city: 'Hyderabad',
    region: 'Telangana',
    postalCode: '500081',
    addressLine1: '8 Knowledge City',
    time: '12:30',
    packaging: 'Reusable tray',
    instructions: 'Demo delivery: use the north lobby loading entrance.',
    tier: 'Standard',
    employees: [
      { name: 'Ishita Sen', email: 'ishita@meta.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Rahul Nair', email: 'rahul@meta.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Tara Iyer', email: 'tara@meta.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Kabir Das', email: 'kabir@meta.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Leah George', email: 'leah@meta.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Netflix',
    domain: 'netflix.demo.example',
    billingContact: 'Netflix Demo Accounts',
    city: 'Mumbai',
    region: 'Maharashtra',
    postalCode: '400013',
    addressLine1: '22 Studio Road',
    time: '12:45',
    packaging: 'Insulated meal box',
    instructions: 'Demo delivery: hand the order to the studio reception.',
    tier: 'Partner',
    employees: [
      { name: 'Aisha Roy', email: 'aisha@netflix.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Dev Malhotra', email: 'dev@netflix.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Nina Joseph', email: 'nina@netflix.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Omar Sheikh', email: 'omar@netflix.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Ira Fernandes', email: 'ira@netflix.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Adobe',
    domain: 'adobe.demo.example',
    billingContact: 'Adobe Demo Accounts',
    city: 'Noida',
    region: 'Uttar Pradesh',
    postalCode: '201301',
    addressLine1: '31 Sector 16',
    time: '13:00',
    packaging: 'Compostable box',
    instructions: 'Demo delivery: leave with the ground-floor security desk.',
    tier: 'Standard',
    employees: [
      { name: 'Rhea Sinha', email: 'rhea@adobe.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Arjun Gill', email: 'arjun@adobe.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Mira Bhat', email: 'mira@adobe.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Neil Kapoor', email: 'neil@adobe.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Sara Menon', email: 'sara@adobe.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
  {
    name: 'Wipro',
    domain: 'wipro.demo.example',
    billingContact: 'Wipro Demo Accounts',
    city: 'Pune',
    region: 'Maharashtra',
    postalCode: '411057',
    addressLine1: '6 Hinjawadi Business Park',
    time: '13:15',
    packaging: 'Reusable tray',
    instructions: 'Demo delivery: use the east gate and call reception.',
    tier: 'Partner',
    employees: [
      { name: 'Siddharth Rao', email: 'siddharth@wipro.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: true, canChangePackaging: true },
      { name: 'Pooja Kulkarni', email: 'pooja@wipro.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Varun Bose', email: 'varun@wipro.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: false },
      { name: 'Nisha Patel', email: 'nisha@wipro.demo.example', canChooseDeliveryAddress: true, canChangeDeliveryTime: false, canChangePackaging: false },
      { name: 'Aman Das', email: 'aman@wipro.demo.example', canChooseDeliveryAddress: false, canChangeDeliveryTime: true, canChangePackaging: true },
    ],
  },
] satisfies Array<{
  name: string;
  domain: string;
  billingContact: string;
  city: string;
  region: string;
  postalCode: string;
  addressLine1: string;
  time: string;
  packaging: string;
  instructions: string;
  tier: string;
  employees: Array<{
    name: string;
    email: string;
    legacyEmail?: string;
    canChooseDeliveryAddress: boolean;
    canChangeDeliveryTime: boolean;
    canChangePackaging: boolean;
  }>;
}>;

const dishSeeds = [
  { sku: 'HZ-RICE-001', name: 'Paneer Tikka Rice Bowl', category: 'Rice & Biryani', description: 'Tandoori paneer, fragrant basmati rice, mint chutney and salad.', cost: '110.00', price: '249.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-RICE-002', name: 'Hyderabadi Vegetable Biryani', category: 'Rice & Biryani', description: 'Dum-cooked basmati rice with vegetables, herbs, raita and salan.', cost: '95.00', price: '219.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-IND-003', name: 'Chicken Dum Biryani', category: 'Rice & Biryani', description: 'Aromatic basmati rice layered with spiced chicken and served with raita.', cost: '145.00', price: '319.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy'], dietaryTags: [] },
  { sku: 'HZ-IND-004', name: 'Dal Makhani with Jeera Rice', category: 'Indian Mains', description: 'Slow-cooked black lentils with a mild tomato-butter gravy and jeera rice.', cost: '100.00', price: '229.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-IND-005', name: 'Paneer Butter Masala Meal', category: 'Indian Mains', description: 'Paneer in a creamy tomato gravy with two rotis and seasonal salad.', cost: '125.00', price: '279.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy', 'Gluten'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-IND-006', name: 'Chole and Steamed Rice', category: 'Indian Mains', description: 'Punjabi chickpea curry with steamed basmati rice and pickled onion.', cost: '80.00', price: '189.00', station: 'GRILL', temperature: 'HOT', allergens: [], dietaryTags: ['Vegan', 'Vegetarian'] },
  { sku: 'HZ-MEAL-007', name: 'Classic Veg Thali', category: 'Meals & Wraps', description: 'Two seasonal sabzis, dal, rice, roti, salad and a small dessert.', cost: '135.00', price: '299.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy', 'Gluten'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-MEAL-008', name: 'Chicken Tikka Kathi Roll', category: 'Meals & Wraps', description: 'Tandoori chicken, onion and mint yogurt wrapped in a flaky paratha.', cost: '105.00', price: '239.00', station: 'GRILL', temperature: 'HOT', allergens: ['Dairy', 'Gluten'], dietaryTags: [] },
  { sku: 'HZ-SIDE-009', name: 'Masala Buttermilk', category: 'Sides & Desserts', description: 'Chilled spiced chaas with roasted cumin and fresh coriander.', cost: '20.00', price: '49.00', station: 'COLD', temperature: 'COLD', allergens: ['Dairy'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-SIDE-010', name: 'Gulab Jamun (2 pieces)', category: 'Sides & Desserts', description: 'Two warm milk-solid dumplings in cardamom and saffron syrup.', cost: '32.00', price: '79.00', station: 'PASTRY', temperature: 'HOT', allergens: ['Dairy', 'Gluten'], dietaryTags: ['Vegetarian'] },
  { sku: 'HZ-RICE-011', name: 'Lemon Rice with Peanuts', category: 'Rice & Biryani', description: 'South Indian rice tempered with curry leaves, mustard and roasted peanuts.', cost: '65.00', price: '159.00', station: 'GRILL', temperature: 'HOT', allergens: ['Peanuts'], dietaryTags: ['Vegan', 'Vegetarian'] },
  { sku: 'HZ-MEAL-012', name: 'Egg Bhurji Kathi Roll', category: 'Meals & Wraps', description: 'Spiced scrambled eggs, onion and coriander wrapped in a whole-wheat roll.', cost: '75.00', price: '179.00', station: 'GRILL', temperature: 'HOT', allergens: ['Egg', 'Gluten'], dietaryTags: [] },
  { sku: 'HZ-SIDE-013', name: 'Garden Chickpea Salad', category: 'Sides & Desserts', description: 'Chickpeas, cucumber, tomato and greens with a lemon dressing.', cost: '55.00', price: '139.00', station: 'COLD', temperature: 'COLD', allergens: [], dietaryTags: ['Vegan', 'Vegetarian'] },
  { sku: 'HZ-MEAL-014', name: 'Grilled Chicken Salad Bowl', category: 'Meals & Wraps', description: 'Grilled chicken with crisp greens, roasted vegetables and herb dressing.', cost: '125.00', price: '289.00', station: 'GRILL', temperature: 'HOT', allergens: [], dietaryTags: [] },
  { sku: 'HZ-SIDE-015', name: 'Chocolate Fudge Brownie', category: 'Sides & Desserts', description: 'A rich cocoa brownie baked in small batches and served individually.', cost: '40.00', price: '99.00', station: 'PASTRY', temperature: 'ROOM', allergens: ['Dairy', 'Egg', 'Gluten'], dietaryTags: ['Vegetarian'] },
] satisfies Array<{
  sku: string;
  name: string;
  category: string;
  description: string;
  cost: string;
  price: string;
  station: string;
  temperature: string;
  allergens: string[];
  dietaryTags: string[];
}>;

type SeedOrder = {
  companyIndex: number;
  employeeIndex: number;
  dateOffset: number;
  time: string;
  status: OrderStatus;
  dropStatus?: DeliveryDropStatus;
  kitchenUnitStatus?: KitchenUnitStatus;
  dishIndex: number;
  quantity: number;
};

const orderSeeds: SeedOrder[] = [
  { companyIndex: 0, employeeIndex: 0, dateOffset: 3, time: '12:00', status: OrderStatus.DRAFT, dishIndex: 0, quantity: 2 },
  { companyIndex: 0, employeeIndex: 1, dateOffset: 4, time: '12:00', status: OrderStatus.PLACED, dishIndex: 1, quantity: 1 },
  { companyIndex: 0, employeeIndex: 0, dateOffset: -1, time: '12:00', status: OrderStatus.CANCELLED, dishIndex: 3, quantity: 1 },
  { companyIndex: 0, employeeIndex: 1, dateOffset: -2, time: '12:00', status: OrderStatus.REJECTED, dishIndex: 4, quantity: 1 },
  { companyIndex: 0, employeeIndex: 2, dateOffset: 0, time: '12:00', status: OrderStatus.CONFIRMED, dropStatus: DeliveryDropStatus.KITCHEN_READY, kitchenUnitStatus: KitchenUnitStatus.DONE, dishIndex: 0, quantity: 2 },
  { companyIndex: 0, employeeIndex: 0, dateOffset: 0, time: '09:00', status: OrderStatus.CONFIRMED, kitchenUnitStatus: KitchenUnitStatus.STARTED, dishIndex: 4, quantity: 1 },
  { companyIndex: 0, employeeIndex: 1, dateOffset: 0, time: '11:00', status: OrderStatus.CONFIRMED, dropStatus: DeliveryDropStatus.DISPATCH_READY, kitchenUnitStatus: KitchenUnitStatus.DONE, dishIndex: 2, quantity: 1 },
  { companyIndex: 0, employeeIndex: 2, dateOffset: 0, time: '13:00', status: OrderStatus.CONFIRMED, dropStatus: DeliveryDropStatus.OUT_FOR_DELIVERY, kitchenUnitStatus: KitchenUnitStatus.DONE, dishIndex: 6, quantity: 1 },
  { companyIndex: 0, employeeIndex: 0, dateOffset: 0, time: '14:00', status: OrderStatus.PLACED, dishIndex: 9, quantity: 2 },
  { companyIndex: 1, employeeIndex: 0, dateOffset: -3, time: '12:00', status: OrderStatus.DELIVERED, dishIndex: 1, quantity: 1 },
  { companyIndex: 1, employeeIndex: 1, dateOffset: 0, time: '10:00', status: OrderStatus.DRAFT, dishIndex: 3, quantity: 1 },
  { companyIndex: 1, employeeIndex: 2, dateOffset: 0, time: '11:30', status: OrderStatus.PLACED, dishIndex: 5, quantity: 1 },
  { companyIndex: 1, employeeIndex: 0, dateOffset: 0, time: '13:30', status: OrderStatus.PLACED, dishIndex: 7, quantity: 1 },
  { companyIndex: 2, employeeIndex: 0, dateOffset: 0, time: '11:00', status: OrderStatus.DRAFT, dishIndex: 0, quantity: 1 },
  { companyIndex: 2, employeeIndex: 1, dateOffset: 0, time: '13:00', status: OrderStatus.PLACED, dishIndex: 2, quantity: 1 },
  { companyIndex: 2, employeeIndex: 2, dateOffset: 1, time: '14:00', status: OrderStatus.DRAFT, dishIndex: 8, quantity: 1 },
  { companyIndex: 3, employeeIndex: 0, dateOffset: 0, time: '11:15', status: OrderStatus.DRAFT, dishIndex: 4, quantity: 1 },
  { companyIndex: 3, employeeIndex: 1, dateOffset: 0, time: '13:15', status: OrderStatus.PLACED, dishIndex: 6, quantity: 1 },
  { companyIndex: 4, employeeIndex: 0, dateOffset: 0, time: '11:45', status: OrderStatus.DRAFT, dishIndex: 1, quantity: 1 },
  { companyIndex: 4, employeeIndex: 1, dateOffset: 0, time: '13:45', status: OrderStatus.PLACED, dishIndex: 7, quantity: 1 },
];

const rollingOrderSeeds: SeedOrder[] = Array.from({ length: 16 }, (_, dateOffset) =>
  Array.from({ length: 10 }, (_, companyIndex): SeedOrder => ({
    companyIndex,
    employeeIndex: (dateOffset + companyIndex) % 5,
    dateOffset,
    time: `${18}:${String(companyIndex * 5).padStart(2, '0')}`,
    status: OrderStatus.CONFIRMED,
    dropStatus: DeliveryDropStatus.KITCHEN_READY,
    kitchenUnitStatus: KitchenUnitStatus.DONE,
    dishIndex: (dateOffset * 10 + companyIndex) % dishSeeds.length,
    quantity: 1 + ((dateOffset + companyIndex) % 3),
  })),
).flat();

async function main() {
  const seedPasswordHash = await hash(seedPassword, 12);
  for (const name of ['GRILL', 'COLD', 'PASTRY', 'UNASSIGNED']) {
    await prisma.kitchenStationReference.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
  }
  for (const name of ['Regular', 'Large']) {
    await prisma.portionSizeReference.upsert({
      where: { name },
      update: { active: true },
      create: { name },
    });
  }
  await prisma.kitchenCalendarConfig.upsert({
    where: { id: 1 },
    update: {
      cutoffWorkingDays: 2,
      cutoffTime: databaseTime('16:00'),
      workingDays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY],
    },
    create: {
      id: 1,
      cutoffWorkingDays: 2,
      cutoffTime: databaseTime('16:00'),
      workingDays: [Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY],
    },
  });

  const roleUsers = [
    { email: 'admin@test.com', name: 'Demo Administrator', role: Role.ADMIN },
    { email: 'kitchen@test.com', name: 'Demo Kitchen Operator', role: Role.KITCHEN },
    { email: 'dispatch@test.com', name: 'Demo Dispatch Operator', role: Role.DISPATCH },
  ] satisfies Array<{ email: string; name: string; role: Role }>;
  for (const seedUser of roleUsers) {
    await prisma.user.upsert({
      where: { email: seedUser.email },
      update: { name: seedUser.name, role: seedUser.role, passwordHash: seedPasswordHash },
      create: { ...seedUser, passwordHash: seedPasswordHash },
    });
  }

  const standardTier = await ensurePriceTier({
    name: 'Standard',
    pricingRuleType: PricingRuleType.COST_MULTIPLIER,
    isDefault: true,
    multiplier: new Prisma.Decimal('2.4'),
  });
  const partnerTier = await ensurePriceTier({
    name: 'Partner',
    pricingRuleType: PricingRuleType.TIER_MARKUP,
    isDefault: false,
    baseTierId: standardTier.id,
    markupPercent: new Prisma.Decimal('15'),
  });
  const tiers = new Map([
    [standardTier.name, standardTier],
    [partnerTier.name, partnerTier],
  ]);

  const companies: Prisma.CompanyGetPayload<Record<string, never>>[] = [];
  const employees: Prisma.EmployeeGetPayload<Record<string, never>>[][] = [];
  const addresses: Array<Record<string, string>> = [];
  const drivers: Prisma.DriverGetPayload<Record<string, never>>[] = [];

  for (let companyIndex = 0; companyIndex < companySeeds.length; companyIndex += 1) {
    const seedCompany = companySeeds[companyIndex];
    const tier = tiers.get(seedCompany.tier);
    if (!tier) throw new Error(`Pricing tier "${seedCompany.tier}" was not created.`);

    const existingCompany = await prisma.company.findFirst({
      where: {
        OR: [
          { name: seedCompany.name },
          ...(companyIndex === 0 ? [{ name: 'Fernleaf Test Company' }] : []),
          ...(companyIndex === 1 ? [{ name: 'Northstar Test Company' }] : []),
        ],
      },
    });
    const companyData = {
      name: seedCompany.name,
      billingContactName: seedCompany.billingContact,
      billingContactEmail: `accounts@${seedCompany.domain}`,
      priceTierId: tier.id,
      defaultDeliveryTime: databaseTime(seedCompany.time),
      deliveryLeadTime: 1,
      deliveryMinutes: 60,
      deliveryWorkingDays: allWeekdays,
      defaultPackaging: seedCompany.packaging,
      driverInstructions: seedCompany.instructions,
    };
    const company = existingCompany
      ? await prisma.company.update({ where: { id: existingCompany.id }, data: companyData })
      : await prisma.company.create({ data: companyData });
    companies.push(company);

    await prisma.companyEmailDomain.upsert({
      where: { domain: seedCompany.domain },
      update: { companyId: company.id },
      create: { companyId: company.id, domain: seedCompany.domain },
    });

    const addressData = {
      recipientName: seedCompany.name,
      addressLine1: seedCompany.addressLine1,
      city: seedCompany.city,
      region: seedCompany.region,
      postalCode: seedCompany.postalCode,
      country: 'IN',
      label: 'Main office',
      isDefault: true,
    };
    const existingAddress = await prisma.companyAddress.findFirst({
      where: { companyId: company.id, label: 'Main office' },
      select: { id: true },
    });
    if (existingAddress) {
      await prisma.companyAddress.update({ where: { id: existingAddress.id }, data: addressData });
    } else {
      await prisma.companyAddress.create({ data: { ...addressData, companyId: company.id } });
    }
    addresses.push({
      recipientName: addressData.recipientName,
      addressLine1: addressData.addressLine1,
      city: addressData.city,
      region: addressData.region,
      postalCode: addressData.postalCode,
      country: addressData.country,
    });

    const companyEmployees: Prisma.EmployeeGetPayload<Record<string, never>>[] = [];
    for (const seedEmployee of seedCompany.employees) {
      const legacyEmail =
        'legacyEmail' in seedEmployee ? seedEmployee.legacyEmail : undefined;
      const matchingEmails = [
        seedEmployee.email,
        ...(legacyEmail ? [legacyEmail] : []),
      ];
      const existingEmployee = await prisma.employee.findFirst({
        where: { companyId: company.id, email: { in: matchingEmails } },
      });
      const employeeData = {
        companyId: company.id,
        name: seedEmployee.name,
        email: seedEmployee.email,
        canChooseDeliveryAddress: seedEmployee.canChooseDeliveryAddress,
        canChangeDeliveryTime: seedEmployee.canChangeDeliveryTime,
        canChangePackaging: seedEmployee.canChangePackaging,
      };
      const employee = existingEmployee
        ? await prisma.employee.update({ where: { id: existingEmployee.id }, data: employeeData })
        : await prisma.employee.create({ data: employeeData });
      companyEmployees.push(employee);
    }
    employees.push(companyEmployees);

    await prisma.company.update({
      where: { id: company.id },
      data: { ownerEmployeeId: companyEmployees[0].id },
    });

    const driverEmail = companyIndex === 0 ? 'driver@test.com' : `driver.${seedCompany.domain.split('.')[0]}@test.com`;
    const driverUser = await prisma.user.upsert({
      where: { email: driverEmail },
      update: { name: `${seedCompany.name} Demo Driver`, role: Role.DRIVER, passwordHash: seedPasswordHash },
      create: { email: driverEmail, name: `${seedCompany.name} Demo Driver`, role: Role.DRIVER, passwordHash: seedPasswordHash },
    });
    const driver = await prisma.driver.upsert({
      where: { userId: driverUser.id },
      update: { companyId: company.id },
      create: { userId: driverUser.id, companyId: company.id },
    });
    drivers.push(driver);
    await prisma.company.update({
      where: { id: company.id },
      data: { defaultDriverId: driver.id },
    });
  }

  await prisma.companyEmailDomain.deleteMany({
    where: {
      companyId: { in: companies.slice(0, 2).map(({ id }) => id) },
      domain: { in: ['fernleaftest.example', 'northstartest.example'] },
    },
  });

  const categories = new Map<string, Prisma.CategoryGetPayload<Record<string, never>>>();
  for (const [index, name] of ['Rice & Biryani', 'Indian Mains', 'Meals & Wraps', 'Sides & Desserts'].entries()) {
    const category = await prisma.category.findFirst({ where: { name } });
    const data = {
      name,
      description: `${name} prepared fresh for the demo menu.`,
      displayOrder: index + 1,
      active: true,
      secret: false,
    };
    const saved = category
      ? await prisma.category.update({ where: { id: category.id }, data })
      : await prisma.category.create({ data });
    categories.set(name, saved);
  }

  const dishes: Prisma.DishGetPayload<Record<string, never>>[] = [];
  for (const [displayOrder, seedDish] of dishSeeds.entries()) {
    const category = categories.get(seedDish.category);
    if (!category) throw new Error(`Category "${seedDish.category}" was not created.`);
    const dish = await prisma.dish.upsert({
      where: { sku: seedDish.sku },
      update: {
        categoryId: category.id,
        name: seedDish.name,
        description: seedDish.description,
        temperature: seedDish.temperature,
        costPrice: new Prisma.Decimal(seedDish.cost),
        displayOrder: displayOrder + 1,
        minimumOrderQuantity: 1,
        active: true,
        kitchenStation: seedDish.station,
      },
      create: {
        sku: seedDish.sku,
        categoryId: category.id,
        name: seedDish.name,
        description: seedDish.description,
        temperature: seedDish.temperature,
        costPrice: new Prisma.Decimal(seedDish.cost),
        displayOrder: displayOrder + 1,
        minimumOrderQuantity: 1,
        kitchenStation: seedDish.station,
      },
    });
    dishes.push(dish);
    await prisma.dishPrice.upsert({
      where: { dishId_priceTierId: { dishId: dish.id, priceTierId: standardTier.id } },
      update: { overridePrice: new Prisma.Decimal(seedDish.price) },
      create: { dishId: dish.id, priceTierId: standardTier.id, overridePrice: new Prisma.Decimal(seedDish.price) },
    });

    const allergenIds = await Promise.all(seedDish.allergens.map((name) => ensureAllergen(name)));
    const dietaryTagIds = await Promise.all(seedDish.dietaryTags.map((name) => ensureDietaryTag(name)));
    await prisma.dishAllergen.deleteMany({ where: { dishId: dish.id } });
    await prisma.dishDietaryTag.deleteMany({ where: { dishId: dish.id } });
    if (allergenIds.length > 0) {
      await prisma.dishAllergen.createMany({
        data: allergenIds.map((allergenId) => ({ dishId: dish.id, allergenId })),
        skipDuplicates: true,
      });
    }
    if (dietaryTagIds.length > 0) {
      await prisma.dishDietaryTag.createMany({
        data: dietaryTagIds.map((dietaryTagId) => ({ dishId: dish.id, dietaryTagId })),
        skipDuplicates: true,
      });
    }
  }

  await seedOptionalSides(dishes, standardTier.id);
  await seedEmployeePreferences(employees[0][0].id);

  const today = todayInIndia();
  await removeObsoleteRollingDemoOrders({
    companyId: companies[0].id,
    employeeIds: employees[0].map(({ id }) => id),
    today,
  });
  let orderCount = 0;
  for (const seedOrder of [...orderSeeds, ...rollingOrderSeeds]) {
    const company = companies[seedOrder.companyIndex];
    const employee = employees[seedOrder.companyIndex]?.[seedOrder.employeeIndex];
    const dish = dishes[seedOrder.dishIndex];
    const seedCompany = companySeeds[seedOrder.companyIndex];
    const address = addresses[seedOrder.companyIndex];
    const driver = drivers[seedOrder.companyIndex];
    if (!company || !employee || !dish || !address || !driver) {
      throw new Error(`Demo order seed references missing data: ${JSON.stringify(seedOrder)}`);
    }

    const deliveryDate = toUtcDate(addCalendarDays(today, seedOrder.dateOffset));
    const deliveryTime = databaseTime(seedOrder.time);
    const total = new Prisma.Decimal(dishSeeds[seedOrder.dishIndex].price).mul(seedOrder.quantity);
    let order = await prisma.order.findFirst({
      where: {
        companyId: company.id,
        employeeId: employee.id,
        deliveryDate,
        deliveryTime,
        packaging: seedCompany.packaging,
      },
    });
    if (order?.invoiceId !== null && order?.invoiceId !== undefined) {
      console.warn(`Skipping refresh of invoiced demo order #${order.id}.`);
      orderCount += 1;
      continue;
    }
    const previousDropId = order?.deliveryDropId ?? null;
    const orderData = {
      companyId: company.id,
      employeeId: employee.id,
      status: seedOrder.status,
      deliveryDate,
      deliveryTime,
      deliveryAddressSnapshot: address,
      packaging: seedCompany.packaging,
      driverInstructionsSnapshot: seedCompany.instructions,
      totalAmount: total,
      kitchenStartedAt: seedOrder.kitchenUnitStatus === KitchenUnitStatus.STARTED ? new Date() : null,
      kitchenReadyAt: seedOrder.dropStatus ? new Date() : null,
      outForDeliveryAt:
        seedOrder.dropStatus === DeliveryDropStatus.OUT_FOR_DELIVERY ||
        seedOrder.dropStatus === DeliveryDropStatus.DELIVERED
          ? new Date()
          : null,
      deliveredAt: seedOrder.status === OrderStatus.DELIVERED ? new Date() : null,
      plannedKitchenReadyAt: null,
      plannedDispatchReadyAt: null,
    };
    order = order
      ? await prisma.order.update({ where: { id: order.id }, data: orderData })
      : await prisma.order.create({ data: orderData });

    const lastHistory = await prisma.orderStatusHistory.findFirst({
      where: { orderId: order.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    if (!lastHistory || lastHistory.status !== seedOrder.status) {
      await prisma.orderStatusHistory.create({
        data: { orderId: order.id, status: seedOrder.status },
      });
    }

    let orderLine = await prisma.orderLine.findFirst({ where: { orderId: order.id } });
    const lineData = {
      orderId: order.id,
      dishId: dish.id,
      quantity: seedOrder.quantity,
      dishNameSnapshot: dish.name,
      dishSkuSnapshot: dish.sku,
      dishUnitPriceSnapshot: new Prisma.Decimal(dishSeeds[seedOrder.dishIndex].price),
      lineTotal: total,
    };
    orderLine = orderLine
      ? await prisma.orderLine.update({ where: { id: orderLine.id }, data: lineData })
      : await prisma.orderLine.create({ data: lineData });

    let combination = await prisma.orderCombination.findFirst({
      where: { orderLineId: orderLine.id },
    });
    const combinationData = {
      orderLineId: orderLine.id,
      quantity: seedOrder.quantity,
      unitPrice: new Prisma.Decimal(dishSeeds[seedOrder.dishIndex].price),
      totalPrice: total,
    };
    combination = combination
      ? await prisma.orderCombination.update({ where: { id: combination.id }, data: combinationData })
      : await prisma.orderCombination.create({ data: combinationData });

    await prisma.orderCombinationOption.deleteMany({ where: { combinationId: combination.id } });
    const unitStatus = seedOrder.kitchenUnitStatus;
    if (unitStatus) {
      await prisma.kitchenUnit.upsert({
        where: { orderCombinationId: combination.id },
        update: {
          kitchenStation: dish.kitchenStation ?? 'UNASSIGNED',
          status: unitStatus,
          startedAt: unitStatus === KitchenUnitStatus.STARTED || unitStatus === KitchenUnitStatus.DONE ? new Date() : null,
          doneAt: unitStatus === KitchenUnitStatus.DONE ? new Date() : null,
        },
        create: {
          orderCombinationId: combination.id,
          kitchenStation: dish.kitchenStation ?? 'UNASSIGNED',
          status: unitStatus,
          startedAt: unitStatus === KitchenUnitStatus.STARTED || unitStatus === KitchenUnitStatus.DONE ? new Date() : null,
          doneAt: unitStatus === KitchenUnitStatus.DONE ? new Date() : null,
        },
      });
    } else {
      await prisma.kitchenUnit.deleteMany({ where: { orderCombinationId: combination.id } });
    }

    if (seedOrder.dropStatus) {
      const { key: deliveryAddressKey } = canonicalizeDeliveryAddress(address);
      const drop = await prisma.deliveryDrop.upsert({
        where: {
          companyId_deliveryDate_deliveryAddressKey_deliveryTime: {
            companyId: company.id,
            deliveryDate,
            deliveryAddressKey,
            deliveryTime,
          },
        },
        update: {
          driverId: driver.id,
          status: seedOrder.dropStatus,
          outForDeliveryAt:
            seedOrder.dropStatus === DeliveryDropStatus.OUT_FOR_DELIVERY ||
            seedOrder.dropStatus === DeliveryDropStatus.DELIVERED
              ? new Date()
              : null,
          deliveredAt: seedOrder.dropStatus === DeliveryDropStatus.DELIVERED ? new Date() : null,
          deliveredOnTime: seedOrder.dropStatus === DeliveryDropStatus.DELIVERED ? true : null,
          deliveryAddressSnapshot: address,
        },
        create: {
          companyId: company.id,
          driverId: driver.id,
          deliveryDate,
          deliveryTime,
          deliveryAddressKey,
          deliveryAddressSnapshot: address,
          status: seedOrder.dropStatus,
          outForDeliveryAt:
            seedOrder.dropStatus === DeliveryDropStatus.OUT_FOR_DELIVERY ||
            seedOrder.dropStatus === DeliveryDropStatus.DELIVERED
              ? new Date()
              : null,
          deliveredAt: seedOrder.dropStatus === DeliveryDropStatus.DELIVERED ? new Date() : null,
          deliveredOnTime: seedOrder.dropStatus === DeliveryDropStatus.DELIVERED ? true : null,
        },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryDropId: drop.id },
      });
    } else {
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryDropId: null },
      });
      if (
        previousDropId !== null &&
        (await prisma.order.count({ where: { deliveryDropId: previousDropId } })) === 0
      ) {
        await prisma.deliveryDrop.delete({ where: { id: previousDropId } });
      }
    }

    orderCount += 1;
  }

  console.log(
    `Seed complete: ${companies.length} demo companies, ${employees.reduce((sum, group) => sum + group.length, 0)} employees, ${dishSeeds.length} priced dishes, ${orderSeeds.length} workflow examples, ${rollingOrderSeeds.length} rolling orders (${rollingOrderSeeds.length / 16} per day for today plus 15 days), ${orderCount} total seeded orders, and role accounts are ready.`,
  );
  console.log(`Demo account password: ${seedPassword}`);
  console.log('Role accounts: admin@test.com, kitchen@test.com, dispatch@test.com, and one driver account per demo company.');
}

async function ensurePriceTier(
  seed: {
    name: string;
    pricingRuleType: PricingRuleType;
    isDefault: boolean;
    multiplier?: Prisma.Decimal;
    baseTierId?: number;
    markupPercent?: Prisma.Decimal;
  },
) {
  const existing = await prisma.priceTier.findFirst({ where: { name: seed.name } });
  const data = {
    name: seed.name,
    isDefault: seed.isDefault,
    pricingRuleType: seed.pricingRuleType,
    multiplier: seed.multiplier ?? null,
    baseTierId: seed.baseTierId ?? null,
    markupPercent: seed.markupPercent ?? null,
  };
  return existing
    ? prisma.priceTier.update({ where: { id: existing.id }, data })
    : prisma.priceTier.create({ data });
}

async function ensureAllergen(name: string) {
  const existing = await prisma.allergen.findFirst({ where: { name } });
  return existing?.id ?? (await prisma.allergen.create({ data: { name } })).id;
}

async function ensureDietaryTag(name: string) {
  const existing = await prisma.dietaryTag.findFirst({ where: { name } });
  return existing?.id ?? (await prisma.dietaryTag.create({ data: { name } })).id;
}

async function seedOptionalSides(
  dishes: Prisma.DishGetPayload<Record<string, never>>[],
  standardTierId: number,
) {
  const existingGroups = await prisma.optionGroup.findMany({
    where: { name: { in: ['Choose your rice', 'Optional sides'] } },
    orderBy: { id: 'asc' },
  });
  const group = existingGroups[0]
    ? await prisma.optionGroup.update({
        where: { id: existingGroups[0].id },
        data: {
          name: 'Optional sides',
          required: false,
          minSelections: 0,
          maxSelections: 1,
          usesPortions: true,
        },
      })
    : await prisma.optionGroup.create({
        data: {
          name: 'Optional sides',
          required: false,
          minSelections: 0,
          maxSelections: 1,
          usesPortions: true,
        },
      });

  for (const duplicate of existingGroups.slice(1)) {
    const [optionLinks, dishLinks] = await Promise.all([
      prisma.optionGroupOption.findMany({ where: { optionGroupId: duplicate.id } }),
      prisma.dishOptionGroup.findMany({ where: { optionGroupId: duplicate.id } }),
    ]);
    for (const link of optionLinks) {
      await prisma.optionGroupOption.upsert({
        where: {
          optionGroupId_optionId: { optionGroupId: group.id, optionId: link.optionId },
        },
        update: { displayOrder: link.displayOrder },
        create: {
          optionGroupId: group.id,
          optionId: link.optionId,
          displayOrder: link.displayOrder,
        },
      });
    }
    for (const link of dishLinks) {
      await prisma.dishOptionGroup.upsert({
        where: {
          dishId_optionGroupId: { dishId: link.dishId, optionGroupId: group.id },
        },
        update: { displayOrder: link.displayOrder },
        create: {
          dishId: link.dishId,
          optionGroupId: group.id,
          displayOrder: link.displayOrder,
        },
      });
    }
    await prisma.optionPortion.deleteMany({ where: { optionGroupId: duplicate.id } });
    await prisma.optionGroupOption.deleteMany({ where: { optionGroupId: duplicate.id } });
    await prisma.dishOptionGroup.deleteMany({ where: { optionGroupId: duplicate.id } });
    await prisma.optionGroup.delete({ where: { id: duplicate.id } });
  }

  const optionSeeds = [
    { name: 'Masala Papad', cost: '10.00', price: '29.00', largeExtra: '10.00' },
    { name: 'Cucumber Raita', cost: '14.00', price: '39.00', largeExtra: '15.00' },
  ];
  const seededOptions: Array<{ id: number; largeExtra: string }> = [];
  for (const [index, seedOption] of optionSeeds.entries()) {
    const existingOption = await prisma.option.findFirst({ where: { name: seedOption.name } });
    const option = existingOption
      ? await prisma.option.update({
          where: { id: existingOption.id },
          data: { costPrice: new Prisma.Decimal(seedOption.cost), active: true },
        })
      : await prisma.option.create({
          data: { name: seedOption.name, costPrice: new Prisma.Decimal(seedOption.cost), active: true },
        });
    seededOptions.push({ id: option.id, largeExtra: seedOption.largeExtra });
    await prisma.optionPrice.upsert({
      where: {
        optionId_priceTierId: { optionId: option.id, priceTierId: standardTierId },
      },
      update: { overridePrice: new Prisma.Decimal(seedOption.price) },
      create: {
        optionId: option.id,
        priceTierId: standardTierId,
        overridePrice: new Prisma.Decimal(seedOption.price),
      },
    });
    await prisma.optionGroupOption.upsert({
      where: { optionGroupId_optionId: { optionGroupId: group.id, optionId: option.id } },
      update: { displayOrder: index },
      create: { optionGroupId: group.id, optionId: option.id, displayOrder: index },
    });
  }

  const portionSizes = await prisma.portionSizeReference.findMany({
    where: { name: { in: ['Regular', 'Large'] } },
    select: { id: true, name: true },
  });
  for (const option of seededOptions) {
    for (const portionSize of portionSizes) {
      const extraPrice = portionSize.name === 'Large' ? option.largeExtra : '0.00';
      await prisma.optionPortion.upsert({
        where: {
          optionGroupId_optionId_portionSizeId: {
            optionGroupId: group.id,
            optionId: option.id,
            portionSizeId: portionSize.id,
          },
        },
        update: { extraPrice: new Prisma.Decimal(extraPrice) },
        create: {
          optionGroupId: group.id,
          optionId: option.id,
          portionSizeId: portionSize.id,
          extraPrice: new Prisma.Decimal(extraPrice),
        },
      });
    }
  }

  for (const [displayOrder, dish] of dishes.entries()) {
    await prisma.dishOptionGroup.upsert({
      where: { dishId_optionGroupId: { dishId: dish.id, optionGroupId: group.id } },
      update: { displayOrder },
      create: { dishId: dish.id, optionGroupId: group.id, displayOrder },
    });
  }
}

async function seedEmployeePreferences(employeeId: number) {
  const dairyId = await ensureAllergen('Dairy');
  const vegetarianId = await ensureDietaryTag('Vegetarian');
  await prisma.employeeAllergen.upsert({
    where: { employeeId_allergenId: { employeeId, allergenId: dairyId } },
    update: {},
    create: { employeeId, allergenId: dairyId },
  });
  await prisma.employeeDietaryPreference.upsert({
    where: { employeeId_dietaryTagId: { employeeId, dietaryTagId: vegetarianId } },
    update: {},
    create: { employeeId, dietaryTagId: vegetarianId },
  });
}

async function removeObsoleteRollingDemoOrders({
  companyId,
  employeeIds,
  today,
}: {
  companyId: number;
  employeeIds: number[];
  today: string;
}) {
  const staleCutoff = toUtcDate(addCalendarDays(today, 5));
  const staleOrders = await prisma.order.findMany({
    where: {
      companyId,
      employeeId: { in: employeeIds },
      deliveryDate: { gt: staleCutoff },
      deliveryTime: databaseTime('12:00'),
      packaging: 'Reusable tray',
      invoiceId: null,
      status: { in: [OrderStatus.DRAFT, OrderStatus.PLACED, OrderStatus.CONFIRMED] },
      lines: {
        some: {
          dishSkuSnapshot: { in: ['HZ-RICE-001', 'HZ-RICE-002'] },
        },
      },
    },
    select: { id: true, deliveryDropId: true },
  });

  for (const staleOrder of staleOrders) {
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: staleOrder.id },
        data: { deliveryDropId: null },
      });
      const combinations = await tx.orderCombination.findMany({
        where: { orderLine: { orderId: staleOrder.id } },
        select: { id: true },
      });
      const combinationIds = combinations.map(({ id }) => id);
      if (combinationIds.length > 0) {
        await tx.kitchenUnit.deleteMany({
          where: { orderCombinationId: { in: combinationIds } },
        });
        await tx.orderCombinationOption.deleteMany({
          where: { combinationId: { in: combinationIds } },
        });
        await tx.orderCombination.deleteMany({
          where: { id: { in: combinationIds } },
        });
      }
      await tx.orderLine.deleteMany({ where: { orderId: staleOrder.id } });
      await tx.orderStatusHistory.deleteMany({ where: { orderId: staleOrder.id } });
      await tx.order.delete({ where: { id: staleOrder.id } });

      if (
        staleOrder.deliveryDropId !== null &&
        (await tx.order.count({ where: { deliveryDropId: staleOrder.deliveryDropId } })) === 0
      ) {
        await tx.deliveryDrop.delete({ where: { id: staleOrder.deliveryDropId } });
      }
    });
  }

  if (staleOrders.length > 0) {
    console.log(`Removed ${staleOrders.length} obsolete rolling demo order(s).`);
  }
}

function todayInIndia() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function addCalendarDays(value: string, amount: number) {
  const date = toUtcDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function toUtcDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function databaseTime(value: string) {
  return new Date(`1970-01-01T${value}:00.000Z`);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
