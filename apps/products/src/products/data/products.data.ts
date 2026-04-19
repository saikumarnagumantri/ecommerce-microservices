export const PRODUCTS = [
  {
    id: 101,
    name: "UltraBook Pro 15",
    description: "Professional grade laptop with 4K OLED display.",
    category: 1, // Electronics
    spec: {
      name: "UltraBook Pro 15-inch",
      brand: "TechNova",
      yearOfManufacture: new Date('2024-01-15'),
      material: "Aluminum"
    },
    originalPrice: 1500,
    discountPrice: 1350,
    offers: [{ bankCard: "HDFC", minPriceToApply: 1000, maxDiscount: 150, discountPercentage: 10 }],
    images: ["laptop1.jpg", "laptop2.jpg"]
  },
  {
    id: 202,
    name: "ErgoChair Executive",
    description: "High-back mesh chair with lumbar support.",
    category: 2, // Furniture
    spec: {
      name: "ErgoChair V2",
      brand: "ComfortPlus",
      yearOfManufacture: new Date('2023-11-20'),
      material: "Recycled Plastic & Mesh"
    },
    originalPrice: 450,
    discountPrice: 399,
    offers: [{ bankCard: "ICICI", minPriceToApply: 300, maxDiscount: 50, discountPercentage: 5 }],
    images: ["chair1.jpg"]
  },
  {
    id: 303,
    name: "NoiseCancel 700",
    description: "Wireless over-ear headphones with active noise cancelling.",
    category: 1, // Electronics
    spec: {
      name: "NC-700",
      brand: "AudioPure",
      yearOfManufacture: new Date('2024-02-01'),
      material: "Synthetic Leather"
    },
    originalPrice: 350,
    discountPrice: 299,
    offers: [],
    images: ["headphone.jpg"]
  },
  {
    id: 404,
    name: "SmartWatach Series 9",
    description: "Fitness tracker and smartwatch with heart rate monitor.",
    category: 1,
    spec: {
      name: "SW-9",
      brand: "TechNova",
      yearOfManufacture: new Date('2023-09-10'),
      material: "Titanium"
    },
    originalPrice: 500,
    discountPrice: 450,
    offers: [{ bankCard: "HDFC", minPriceToApply: 400, maxDiscount: 50, discountPercentage: 10 }],
    images: ["watch1.jpg", "watch2.jpg"]
  },
  {
    id: 505,
    name: "Gourmet Coffee Maker",
    description: "Automatic drip coffee machine with built-in grinder.",
    category: 3, // Home Appliances
    spec: {
      name: "BrewMaster 3000",
      brand: "HomeChef",
      yearOfManufacture: new Date('2023-05-15'),
      material: "Stainless Steel"
    },
    originalPrice: 250,
    discountPrice: 210,
    offers: [{ bankCard: "SBI", minPriceToApply: 100, maxDiscount: 20, discountPercentage: 10 }],
    images: ["coffee_machine.jpg"]
  }
];