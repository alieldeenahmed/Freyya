import type { Review } from "@/lib/types";

export const reviews: Review[] = [
  // Dawn Cleanse
  { id: "dc-1", productId: "dawn-cleanse", author: "Amira K.", rating: 5, title: "Finally, no tightness", body: "My skin used to feel stretched after every wash. This rinses clean and leaves it soft. I have not changed my cleanser since.", date: "2026-08-12", verified: true },
  { id: "dc-2", productId: "dawn-cleanse", author: "Lena M.", rating: 5, title: "Gentle and effective", body: "Takes off sunscreen without a second cleanse. The texture is lovely and it does not foam up into nothing.", date: "2026-07-03", verified: true },
  { id: "dc-3", productId: "dawn-cleanse", author: "Sofia R.", rating: 4, title: "Very good, slightly light on scent", body: "Works beautifully on my sensitive skin. I would love a touch more of a fresh feel, but no redness at all, which is a first.", date: "2026-06-21", verified: true },
  { id: "dc-4", productId: "dawn-cleanse", author: "Noor A.", rating: 5, title: "Morning essential", body: "Two pumps, thirty seconds, done. It has replaced three products on my shelf.", date: "2026-05-30", verified: true },
  { id: "dc-5", productId: "dawn-cleanse", author: "Priya S.", rating: 3, title: "Good, not a game changer", body: "Nice and mild. My oily skin wanted a bit more deep-cleaning power by evening, so I pair it with a weekly exfoliant.", date: "2026-04-17", verified: false },

  // Golden Hour Serum
  { id: "gh-1", productId: "golden-hour-serum", author: "Camille D.", rating: 5, title: "My skin looks lit from within", body: "Three weeks in and my friends keep asking what I changed. Tone is more even and the glow is real without any shimmer.", date: "2026-09-02", verified: true },
  { id: "gh-2", productId: "golden-hour-serum", author: "Hana T.", rating: 5, title: "Worth every dollar", body: "Absorbs in seconds and sits well under moisturizer and SPF. The dropper gives exactly the right amount.", date: "2026-08-19", verified: true },
  { id: "gh-3", productId: "golden-hour-serum", author: "Isabelle W.", rating: 5, title: "The only serum I need", body: "I used to layer four steps. This does the work of all of them, and my skin has never been calmer.", date: "2026-07-28", verified: true },
  { id: "gh-4", productId: "golden-hour-serum", author: "Zara B.", rating: 4, title: "Beautiful results, small bottle", body: "Dark spots are visibly fainter after a month. I only wish 30ml lasted longer, though a little goes far.", date: "2026-06-09", verified: true },
  { id: "gh-5", productId: "golden-hour-serum", author: "Mei L.", rating: 5, title: "Glow without the grease", body: "Plumper, brighter, never sticky. It sold out the first time I tried to order, so buy while you can.", date: "2026-05-14", verified: true },
  { id: "gh-6", productId: "golden-hour-serum", author: "Eleni P.", rating: 4, title: "Lovely, gave me a tingle at first", body: "A mild tingle the first two nights, then nothing. Results are worth it. Patch test if you are sensitive.", date: "2026-03-22", verified: false },

  // Second Skin Cream
  { id: "ss-1", productId: "second-skin-cream", author: "Yasmin H.", rating: 5, title: "Comfort in a jar", body: "Cold weather usually wrecks my cheeks. This kept them calm all winter and never felt heavy.", date: "2026-08-25", verified: true },
  { id: "ss-2", productId: "second-skin-cream", author: "Clara N.", rating: 5, title: "Disappears into skin", body: "No residue and no greasy finish. Makeup sits on top of it perfectly.", date: "2026-07-15", verified: true },
  { id: "ss-3", productId: "second-skin-cream", author: "Dana F.", rating: 4, title: "Great barrier support", body: "My irritated patches settled within a week. The jar is pretty enough to leave out.", date: "2026-06-02", verified: true },
  { id: "ss-4", productId: "second-skin-cream", author: "Rosa V.", rating: 5, title: "Soft all day", body: "I put it on at seven and my skin still feels cushioned at night. Very impressed.", date: "2026-04-28", verified: true },
  { id: "ss-5", productId: "second-skin-cream", author: "Tara G.", rating: 3, title: "Nice, but not for very dry skin alone", body: "Lovely texture. In deep winter I needed an oil over the top, but for the rest of the year it is perfect.", date: "2026-02-11", verified: false },

  // Veil SPF
  { id: "vs-1", productId: "veil-spf", author: "Nadia J.", rating: 5, title: "No white cast on deep skin", body: "I have avoided sunscreen for years because of the ash. This blends in completely. I actually enjoy wearing it.", date: "2026-08-30", verified: true },
  { id: "vs-2", productId: "veil-spf", author: "Leah C.", rating: 5, title: "Sits perfectly under makeup", body: "No pilling, no shine. I wear it every single day now.", date: "2026-07-22", verified: true },
  { id: "vs-3", productId: "veil-spf", author: "Ines O.", rating: 5, title: "Beach approved", body: "Held up through a full day in the sun and a swim. No stinging in my eyes either.", date: "2026-06-18", verified: true },
  { id: "vs-4", productId: "veil-spf", author: "Maya E.", rating: 4, title: "Light and comfortable", body: "Feels like moisturizer. I do wish there were a larger size, since I go through it quickly.", date: "2026-05-05", verified: true },
  { id: "vs-5", productId: "veil-spf", author: "Sana Q.", rating: 4, title: "Great daily SPF", body: "Easy to reapply over makeup with a light hand. Skin stayed clear.", date: "2026-03-09", verified: false },
  { id: "vs-6", productId: "veil-spf", author: "Greta L.", rating: 3, title: "Effective, a little dewy for me", body: "Protects well and has no cast, but my oily T-zone was shinier by afternoon. A powder solved it.", date: "2026-02-20", verified: true },

  // Freyya Balm
  { id: "fb-1", productId: "freyya-balm", author: "Alina R.", rating: 5, title: "Petal is everything", body: "A soft flush that looks like my own lips, only better. It has not dried out even in the wind.", date: "2026-09-05", verified: true, variant: "Petal" },
  { id: "fb-2", productId: "freyya-balm", author: "Jade M.", rating: 5, title: "Rosewood, endlessly wearable", body: "Builds from sheer to rich in two swipes. Gorgeous with a bare face.", date: "2026-08-08", verified: true, variant: "Rosewood" },
  { id: "fb-3", productId: "freyya-balm", author: "Sara W.", rating: 4, title: "Comfortable and pretty", body: "Bare disappears into my lips in the nicest way. Wish it lasted a bit longer between reapplications.", date: "2026-07-01", verified: true, variant: "Bare" },
  { id: "fb-4", productId: "freyya-balm", author: "Tamsin B.", rating: 5, title: "Terracotta warms my whole face", body: "Deeper than I expected, but sheer enough to feel effortless. I get compliments every time.", date: "2026-05-26", verified: true, variant: "Terracotta" },
  { id: "fb-5", productId: "freyya-balm", author: "Oona K.", rating: 4, title: "Lovely balm first", body: "It genuinely treats dry lips. The tint is a bonus. The packaging feels expensive.", date: "2026-04-10", verified: false },

  // Dew Drops
  { id: "dd-1", productId: "dew-drops", author: "Farah T.", rating: 5, title: "Champagne looks like skin", body: "A glow, not glitter. One drop on the cheekbones and I am done. It melts in.", date: "2026-08-27", verified: true, variant: "Champagne" },
  { id: "dd-2", productId: "dew-drops", author: "Beatrice A.", rating: 5, title: "Moonlight on fair skin", body: "Perfect cool pearl. I mix a drop into my moisturizer for an all-over glow.", date: "2026-07-19", verified: true, variant: "Moonlight" },
  { id: "dd-3", productId: "dew-drops", author: "Kiara P.", rating: 5, title: "Bronze is stunning", body: "The warmth on deeper skin is unreal. Wears beautifully all day and never looks patchy.", date: "2026-06-24", verified: true, variant: "Bronze" },
  { id: "dd-4", productId: "dew-drops", author: "Yuna S.", rating: 4, title: "Elegant and easy to blend", body: "Rose Gold is a lovely in-between shade. The dropper takes a moment to get used to.", date: "2026-05-12", verified: true, variant: "Rose Gold" },
  { id: "dd-5", productId: "dew-drops", author: "Emilia D.", rating: 3, title: "Pretty, but I wanted more intensity", body: "Very subtle on me. Layering helps, so I would suggest starting with two drops.", date: "2026-03-30", verified: false, variant: "Moonlight" },
];
