/**
 * Mocked use case: three vertical SaaS products, each embedding Zernio Elements so their own
 * customers can publish from inside the product. All names are fictional.
 */
export interface Brand {
  id: "hostly" | "ferment" | "liftly";
  name: string;
  tagline: string;
  /** The SaaS's customer who is signed in. */
  customer: string;
  location: string;
  /** Shown as the author in previews. */
  author: { name: string; handle: string };
  /** Passed to Zernio's co-branded connect screen. */
  connectColor: string;
  /** The SaaS's own product navigation; "social" is where Zernio Elements lives. */
  nav: string[];
  socialLabel: string;
  draft: string;
  title: string;
  media: { url: string; width: number; height: number };
}

export const BRANDS: Brand[] = [
  {
    id: "hostly",
    name: "Hostly",
    tagline: "Property management for vacation rentals",
    customer: "Casa Azul",
    location: "Cartagena, Murcia",
    author: { name: "Casa Azul Cartagena", handle: "casaazulcartagena" },
    connectColor: "#c8502a",
    nav: ["Today", "Reservations", "Calendar", "Guests", "Cleaning", "Social", "Payouts"],
    socialLabel: "Social",
    title: "Casa Azul: sea views in Cartagena",
    draft:
      "August just opened up at Casa Azul. Two bedrooms, a terrace over the harbour and a 4 minute walk to the beach.\n\nWe repainted the whole flat this spring, added a proper coffee machine and blackout curtains in both bedrooms, so late mornings are back on the menu. Book direct on our site and skip the platform fees. #cartagena #vacationrental #murcia",
    media: { url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1080&h=1350&fit=crop", width: 1080, height: 1350 },
  },
  {
    id: "ferment",
    name: "Ferment",
    tagline: "POS and reservations for restaurants",
    customer: "Bodega Norte",
    location: "Bilbao",
    author: { name: "Bodega Norte", handle: "bodeganorte" },
    connectColor: "#b8924a",
    nav: ["Floor", "Reservations", "Menu", "Stock", "Marketing", "Reports"],
    socialLabel: "Marketing",
    title: "Tasting menu, autumn edition",
    draft:
      "The autumn tasting menu starts Thursday. Seven courses, all from producers within 80 km of the kitchen, paired with natural wines from our cellar.\n\nExpect wild mushrooms from Gorbeia, line-caught hake, and the last of the Getaria txakoli before the harvest closes. Only 24 seats a night, two sittings. Reservations open now.",
    media: { url: "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=1080&h=1350&fit=crop", width: 1080, height: 1350 },
  },
  {
    id: "liftly",
    name: "Liftly",
    tagline: "Gym and studio management",
    customer: "Iron Yard",
    location: "Valencia",
    author: { name: "Iron Yard Gym", handle: "ironyardvlc" },
    connectColor: "#0b0b0b",
    nav: ["Members", "Classes", "Check-ins", "Billing", "Social", "Staff"],
    socialLabel: "Social",
    title: "New 6am strength class",
    draft:
      "New 6am strength class from Monday. 45 minutes, max 10 people, always coached.\n\nWe built it for people who train before work: squat, press and pull, a short conditioning finisher, and you are out the door by 6:50. First week is free for members, and non-members can drop in for 8 euros. Grab your spot in the app before Friday.",
    media: { url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1080&h=1350&fit=crop", width: 1080, height: 1350 },
  },
];
