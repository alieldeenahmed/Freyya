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
    image: "/products/dawn-cleanse.jpg",
    showcase: [
      "/showcase/dawn-cleanse-1.jpg",
      "/products/dawn-cleanse.jpg",
      "/showcase/dawn-cleanse-3.jpg",
    ],
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
    image: "/products/golden-hour-serum.jpg",
    showcase: [
      "/showcase/golden-hour-serum-1.jpg",
      "/products/golden-hour-serum.jpg",
      "/showcase/golden-hour-serum-3.jpg",
    ],
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
    image: "/products/second-skin-cream.jpg",
    showcase: [
      "/showcase/second-skin-cream-1.jpg",
      "/products/second-skin-cream.jpg",
      "/showcase/second-skin-cream-3.jpg",
    ],
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
    image: "/products/veil-spf.jpg",
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
    image: "/products/freyya-balm-bare.jpg",
    variants: [
      { id: "bare", name: "Bare", hex: "#D8A798", image: "/products/freyya-balm-bare.jpg", undertone: "neutral", intensity: "subtle" },
      { id: "petal", name: "Petal", hex: "#E8B4B8", image: "/products/freyya-balm-petal.jpg", undertone: "cool", intensity: "subtle" },
      { id: "rosewood", name: "Rosewood", hex: "#B97572", image: "/products/freyya-balm-rosewood.jpg", undertone: "cool", intensity: "bold" },
      { id: "terracotta", name: "Terracotta", hex: "#C1694F", image: "/products/freyya-balm-terracotta.jpg", undertone: "warm", intensity: "bold" },
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
    image: "/products/dew-drops-moonlight.jpg",
    variants: [
      { id: "moonlight", name: "Moonlight", hex: "#F0EAE2", image: "/products/dew-drops-moonlight.jpg", undertone: "cool", intensity: "subtle" },
      { id: "champagne", name: "Champagne", hex: "#D4B483", image: "/products/dew-drops-champagne.jpg", undertone: "warm", intensity: "subtle" },
      { id: "rose-gold", name: "Rose Gold", hex: "#D9A996", image: "/products/dew-drops-rose-gold.jpg", undertone: "neutral", intensity: "bold" },
      { id: "bronze", name: "Bronze", hex: "#A97452", image: "/products/dew-drops-bronze.jpg", undertone: "warm", intensity: "bold" },
    ],
  },
];
