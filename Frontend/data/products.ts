import type { Product } from "@/lib/types";

export const products: Product[] = [
  {
    id: "dawn-cleanse",
    name: "Dawn Cleanse",
    category: "Cleanser",
    tagline: "A quiet start.",
    description:
      "Cream-gel cleanser that lifts residue without stripping. Rinses clean, leaves nothing behind.",
    price: 28,
    specs: ["Cleanser", "150ml", "All skin types"],
    color: "#E8C4B8",
  },
  {
    id: "golden-hour-serum",
    name: "Golden Hour Serum",
    category: "Serum",
    tagline: "The one that started it.",
    description:
      "Ten actives, one bottle. Formulated to brighten, plump, and even tone — without the nine-step routine.",
    price: 58,
    specs: ["Serum", "30ml", "All skin types"],
    color: "#C9A876",
    isHero: true,
  },
  {
    id: "second-skin-cream",
    name: "Second Skin Cream",
    category: "Moisturizer",
    tagline: "Weightless, not empty.",
    description:
      "A barrier cream that disappears on contact. Locks in moisture for twenty-four hours without sitting heavy.",
    price: 42,
    specs: ["Moisturizer", "50ml", "All skin types"],
    color: "#EDE0D4",
  },
  {
    id: "veil-spf",
    name: "Veil SPF",
    category: "SPF",
    tagline: "No white cast. No excuses.",
    description:
      "Broad-spectrum SPF 50 that wears like nothing. Sits under makeup, holds up in the sun.",
    price: 36,
    specs: ["SPF 50", "40ml", "All skin types"],
    color: "#F4E9DD",
  },
  {
    id: "freyya-balm",
    name: "Freyya Balm",
    category: "Lip Balm",
    tagline: "Color, barely there.",
    description:
      "A balm first, a tint second. Buildable color that feels like nothing on.",
    price: 24,
    specs: ["Lip Balm", "4.5g", "4 shades"],
    color: "#B97572",
    variants: [
      { id: "bare", name: "Bare", hex: "#D8A798", undertone: "neutral" },
      { id: "petal", name: "Petal", hex: "#E8B4B8", undertone: "cool" },
      { id: "rosewood", name: "Rosewood", hex: "#B97572", undertone: "cool" },
      { id: "terracotta", name: "Terracotta", hex: "#C1694F", undertone: "warm" },
    ],
  },
  {
    id: "dew-drops",
    name: "Dew Drops",
    category: "Highlighter",
    tagline: "Light, not glitter.",
    description:
      "Liquid drops that melt into skin for a lit-from-within finish. Wear alone or mixed into moisturizer.",
    price: 32,
    specs: ["Highlighter", "15ml", "4 shades"],
    color: "#D4B483",
    variants: [
      { id: "moonlight", name: "Moonlight", hex: "#F0EAE2", undertone: "cool" },
      { id: "champagne", name: "Champagne", hex: "#D4B483", undertone: "warm" },
      { id: "rose-gold", name: "Rose Gold", hex: "#D9A996", undertone: "neutral" },
      { id: "bronze", name: "Bronze", hex: "#A97452", undertone: "warm" },
    ],
  },
];
