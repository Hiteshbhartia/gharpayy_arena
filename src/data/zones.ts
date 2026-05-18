// Core Arena — Zones & Properties model.
// Zones are operational regions. Each property belongs to one zone and one partner.

export type Zone = {
  id: string;
  name: string;
  city: string;
  leaderId: string; // employeeId of Zone Leader
  pods: number;
  properties: number;
};

export type Property = {
  id: string;
  name: string;
  zoneId: string;
  partnerId: string; // employeeId of Property Partner
  beds: number;
  occupied: number;
  monthlyRevenue: number; // INR
  rating: number; // 0..5
  address: string;
  type: "Boys" | "Girls" | "Co-living";
};

export type PartnerTicket = {
  id: string;
  propertyId: string;
  openedBy: string; // partnerId or staffId
  title: string;
  category: "Maintenance" | "Billing" | "Tenant" | "Compliance" | "Other";
  status: "Open" | "In Progress" | "Resolved";
  priority: "Low" | "Med" | "High";
  ts: number;
  assigneeId?: string;
  lastUpdate?: string;
};

export type PartnerPayout = {
  id: string;
  partnerId: string;
  propertyId: string;
  month: string; // "Apr 2026"
  gross: number;
  deductions: number;
  net: number;
  status: "Scheduled" | "Paid" | "On Hold";
  paidAt?: number;
};

const D = 24 * 60 * 60 * 1000;
const now = Date.now();

export const ZONES: Zone[] = [
  { id: "z1", name: "Whitefield", city: "Bangalore", leaderId: "e20", pods: 3, properties: 4 },
  { id: "z2", name: "HSR Layout", city: "Bangalore", leaderId: "e21", pods: 2, properties: 3 },
  { id: "z3", name: "Bandra West", city: "Mumbai", leaderId: "e22", pods: 2, properties: 3 },
  { id: "z4", name: "Andheri East", city: "Mumbai", leaderId: "e23", pods: 2, properties: 3 },
];

export const PROPERTIES: Property[] = [
  // Whitefield
  {
    id: "p1",
    name: "Brook Luxe",
    zoneId: "z1",
    partnerId: "e10",
    beds: 64,
    occupied: 58,
    monthlyRevenue: 928000,
    rating: 4.6,
    address: "Whitefield Main Rd",
    type: "Co-living",
  },
  {
    id: "p2",
    name: "Aeris Boys",
    zoneId: "z1",
    partnerId: "e10",
    beds: 48,
    occupied: 39,
    monthlyRevenue: 624000,
    rating: 4.3,
    address: "ITPL Rd",
    type: "Boys",
  },
  {
    id: "p3",
    name: "Oryn Girls",
    zoneId: "z1",
    partnerId: "e30",
    beds: 36,
    occupied: 34,
    monthlyRevenue: 578000,
    rating: 4.7,
    address: "Hope Farm Junction",
    type: "Girls",
  },
  {
    id: "p4",
    name: "Verde Stays",
    zoneId: "z1",
    partnerId: "e30",
    beds: 28,
    occupied: 19,
    monthlyRevenue: 304000,
    rating: 4.1,
    address: "Varthur Rd",
    type: "Co-living",
  },
  // HSR
  {
    id: "p5",
    name: "Helix HSR",
    zoneId: "z2",
    partnerId: "e30",
    beds: 52,
    occupied: 47,
    monthlyRevenue: 799000,
    rating: 4.5,
    address: "HSR Sector 2",
    type: "Co-living",
  },
  {
    id: "p6",
    name: "Crest Boys",
    zoneId: "z2",
    partnerId: "e10",
    beds: 40,
    occupied: 28,
    monthlyRevenue: 448000,
    rating: 4.0,
    address: "HSR Sector 7",
    type: "Boys",
  },
  {
    id: "p7",
    name: "Lumen Girls",
    zoneId: "z2",
    partnerId: "e30",
    beds: 32,
    occupied: 30,
    monthlyRevenue: 540000,
    rating: 4.8,
    address: "HSR 27th Main",
    type: "Girls",
  },
  // Bandra
  {
    id: "p8",
    name: "Marine Heights",
    zoneId: "z3",
    partnerId: "e10",
    beds: 24,
    occupied: 22,
    monthlyRevenue: 660000,
    rating: 4.6,
    address: "Carter Rd",
    type: "Co-living",
  },
  {
    id: "p9",
    name: "Bandra A-12",
    zoneId: "z3",
    partnerId: "e10",
    beds: 20,
    occupied: 17,
    monthlyRevenue: 510000,
    rating: 4.4,
    address: "Linking Rd",
    type: "Co-living",
  },
  {
    id: "p10",
    name: "Versova B-204",
    zoneId: "z3",
    partnerId: "e30",
    beds: 16,
    occupied: 12,
    monthlyRevenue: 360000,
    rating: 4.2,
    address: "Versova",
    type: "Girls",
  },
  // Andheri
  {
    id: "p11",
    name: "Bellandur Hub",
    zoneId: "z4",
    partnerId: "e10",
    beds: 44,
    occupied: 33,
    monthlyRevenue: 528000,
    rating: 4.0,
    address: "Andheri E",
    type: "Co-living",
  },
  {
    id: "p12",
    name: "Skyline Boys",
    zoneId: "z4",
    partnerId: "e30",
    beds: 30,
    occupied: 24,
    monthlyRevenue: 384000,
    rating: 4.1,
    address: "Marol",
    type: "Boys",
  },
  {
    id: "p13",
    name: "Echo Girls",
    zoneId: "z4",
    partnerId: "e30",
    beds: 24,
    occupied: 23,
    monthlyRevenue: 414000,
    rating: 4.7,
    address: "JB Nagar",
    type: "Girls",
  },
];

export const PARTNER_TICKETS: PartnerTicket[] = [
  {
    id: "tk1",
    propertyId: "p2",
    openedBy: "e10",
    title: "WiFi flaky in Block B",
    category: "Maintenance",
    status: "In Progress",
    priority: "High",
    ts: now - 2 * D,
    assigneeId: "e4",
    lastUpdate: "Vendor visit booked for tomorrow 11 AM.",
  },
  {
    id: "tk2",
    propertyId: "p10",
    openedBy: "e30",
    title: "Geyser dead — Room 304",
    category: "Maintenance",
    status: "Open",
    priority: "Med",
    ts: now - 1 * D,
    lastUpdate: "Awaiting plumber slot.",
  },
  {
    id: "tk3",
    propertyId: "p1",
    openedBy: "e10",
    title: "May payout reconciliation",
    category: "Billing",
    status: "Resolved",
    priority: "Low",
    ts: now - 6 * D,
    assigneeId: "e1",
    lastUpdate: "Resolved — paid ₹8.4L on 12th.",
  },
  {
    id: "tk4",
    propertyId: "p8",
    openedBy: "e10",
    title: "Fire safety NOC renewal",
    category: "Compliance",
    status: "Open",
    priority: "High",
    ts: now - 3 * D,
    lastUpdate: "Documents collected, application drafting.",
  },
  {
    id: "tk5",
    propertyId: "p11",
    openedBy: "e10",
    title: "Tenant dispute — refund request",
    category: "Tenant",
    status: "In Progress",
    priority: "Med",
    ts: now - 4 * D,
    assigneeId: "e8",
  },
];

export const PARTNER_PAYOUTS: PartnerPayout[] = [
  {
    id: "py1",
    partnerId: "e10",
    propertyId: "p1",
    month: "Apr 2026",
    gross: 928000,
    deductions: 92800,
    net: 835200,
    status: "Paid",
    paidAt: now - 12 * D,
  },
  {
    id: "py2",
    partnerId: "e10",
    propertyId: "p2",
    month: "Apr 2026",
    gross: 624000,
    deductions: 62400,
    net: 561600,
    status: "Paid",
    paidAt: now - 12 * D,
  },
  {
    id: "py3",
    partnerId: "e10",
    propertyId: "p8",
    month: "Apr 2026",
    gross: 660000,
    deductions: 66000,
    net: 594000,
    status: "Paid",
    paidAt: now - 12 * D,
  },
  {
    id: "py4",
    partnerId: "e10",
    propertyId: "p9",
    month: "Apr 2026",
    gross: 510000,
    deductions: 51000,
    net: 459000,
    status: "Paid",
    paidAt: now - 12 * D,
  },
  {
    id: "py5",
    partnerId: "e10",
    propertyId: "p1",
    month: "May 2026",
    gross: 928000,
    deductions: 92800,
    net: 835200,
    status: "Scheduled",
  },
  {
    id: "py6",
    partnerId: "e10",
    propertyId: "p2",
    month: "May 2026",
    gross: 624000,
    deductions: 62400,
    net: 561600,
    status: "Scheduled",
  },
  {
    id: "py7",
    partnerId: "e10",
    propertyId: "p8",
    month: "May 2026",
    gross: 660000,
    deductions: 0,
    net: 660000,
    status: "On Hold",
  },
  {
    id: "py8",
    partnerId: "e30",
    propertyId: "p3",
    month: "Apr 2026",
    gross: 578000,
    deductions: 57800,
    net: 520200,
    status: "Paid",
    paidAt: now - 12 * D,
  },
  {
    id: "py9",
    partnerId: "e30",
    propertyId: "p5",
    month: "Apr 2026",
    gross: 799000,
    deductions: 79900,
    net: 719100,
    status: "Paid",
    paidAt: now - 12 * D,
  },
];

export function zoneOf(id: string): Zone | undefined {
  return ZONES.find((z) => z.id === id);
}
export function propertiesOfZone(zoneId: string): Property[] {
  return PROPERTIES.filter((p) => p.zoneId === zoneId);
}
export function propertiesOfPartner(partnerId: string): Property[] {
  return PROPERTIES.filter((p) => p.partnerId === partnerId);
}
export function payoutsOfPartner(partnerId: string): PartnerPayout[] {
  return PARTNER_PAYOUTS.filter((p) => p.partnerId === partnerId);
}
export function ticketsOfPartner(partnerId: string): PartnerTicket[] {
  const props = new Set(propertiesOfPartner(partnerId).map((p) => p.id));
  return PARTNER_TICKETS.filter((t) => props.has(t.propertyId));
}
export function ticketsOfZone(zoneId: string): PartnerTicket[] {
  const props = new Set(propertiesOfZone(zoneId).map((p) => p.id));
  return PARTNER_TICKETS.filter((t) => props.has(t.propertyId));
}

export const inr = (n: number) =>
  "₹" +
  (n >= 10000000
    ? (n / 10000000).toFixed(2) + " Cr"
    : n >= 100000
      ? (n / 100000).toFixed(1) + " L"
      : n.toLocaleString("en-IN"));

export const occPct = (p: Property) => Math.round((p.occupied / p.beds) * 100);
