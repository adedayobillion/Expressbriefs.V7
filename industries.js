// ────────────────────────────────────────────────────────────────────────
// INDUSTRY CONFIG
// One entry per vertical. Drives: the dynamic compose form (GET /api/industries),
// the AI prompt builder in server.js (buildPrompt), the generated marketing
// landing pages (scripts/build-landing-pages.js), and the generations log.
// To add a 12th industry: add one object below + run
// `node scripts/build-landing-pages.js`. No other file needs to change.
// ────────────────────────────────────────────────────────────────────────

const PLATFORMS = ['WhatsApp', 'Instagram', 'Facebook', 'Twitter', 'LinkedIn', 'TikTok', 'Snapchat', 'Reddit', 'Quora']

const TONES = [
  { key: 'Professional', label: 'Professional' },
  { key: 'Casual',       label: 'Casual' },
  { key: 'Urgent',       label: 'Urgent Sale' },
  { key: 'Luxury',       label: 'Luxury' },
  { key: 'Friendly',     label: 'Friendly' },
  { key: 'Bold',         label: 'Bold' }
]

const industries = {

  'real-estate': {
    slug: 'real-estate', name: 'Real Estate', tagline: 'Property Listing Generator',
    entityLabel: 'Property', heroVerb: 'listings',
    audience: 'real estate agents, Airbnb hosts and developers', icon: 'home',
    ctaAction: 'schedule a viewing',
    fields: [
      { key: 'propType',    label: 'Property Type',  type: 'select', required: true, options: ['Apartment / Flat','Duplex','Bungalow','Terrace House','Semi-detached','Detached House','Mansion / Villa','Studio','Short-let Apartment','Office Space','Shop / Retail','Warehouse','Land'] },
      { key: 'listingType', label: 'Listing Type',    type: 'select', required: true, options: ['For Sale','For Rent','Short Let','Lease','Joint Venture'] },
      { key: 'location',    label: 'Location',        type: 'text',   required: true, placeholder: 'e.g. Lekki Phase 1, Lagos' },
      { key: 'price',       label: 'Price',           type: 'text',   required: true, placeholder: 'e.g. ₦85,000,000' },
      { key: 'size',        label: 'Size / Rooms',    type: 'text',   required: false, placeholder: 'e.g. 3 bed, 2 bath, 180sqm' }
    ],
    features: ['Swimming Pool','24/7 Security','Gated Community','Fitted Kitchen','Concierge','Parking Space','Air Conditioning','Gym / Fitness','CCTV','Waterfront View','Smart Home','Rooftop Terrace'],
    exampleInput: '3-bed, 2-bath duplex, Lekki Phase 1, 180sqm, renovated kitchen, 24/7 power, gated estate, ₦85,000,000',
    exampleOutput: { whatsapp: "🏡 New Listing – Lekki Phase 1\n3 bed | 2 bath | 180sqm duplex\n✅ Renovated kitchen ✅ 24/7 power ✅ Gated estate\n₦85M — DM for a viewing this week!", instagram: "Power stays on. Kitchen's brand new. Lekki Phase 1 just got a serious upgrade ⚡🏡\n3bd • 2ba • 180sqm • Gated\n₦85M — link in bio to book a tour.\n#LekkiRealEstate #LagosHomes" }
  },

  'automotive': {
    slug: 'automotive', name: 'Automotive', tagline: 'AI Vehicle Listing Generator',
    entityLabel: 'Vehicle', heroVerb: 'listings',
    audience: 'used car dealers, private sellers and auto brokers', icon: 'car',
    ctaAction: 'book a test drive',
    fields: [
      { key: 'vehicleType', label: 'Vehicle Type',   type: 'select', required: true, options: ['Sedan','SUV','Truck','Coupe','Van / Minivan','Motorcycle','Hatchback','Convertible','Wagon'] },
      { key: 'condition',   label: 'Condition',      type: 'select', required: true, options: ['New','Used - Excellent','Used - Good','Used - Fair','Certified Pre-Owned','Salvage'] },
      { key: 'makeModel',   label: 'Make & Model',   type: 'text',   required: true, placeholder: 'e.g. 2019 Toyota Camry SE' },
      { key: 'mileage',     label: 'Mileage',        type: 'text',   required: false, placeholder: 'e.g. 42,000 miles' },
      { key: 'price',       label: 'Price',          type: 'text',   required: true, placeholder: 'e.g. $18,500' },
      { key: 'location',    label: 'Location',       type: 'text',   required: true, placeholder: 'e.g. Houston, TX' }
    ],
    features: ['Leather Seats','Sunroof','Backup Camera','Navigation','Bluetooth','Alloy Wheels','One Owner','Accident-Free','New Tires','Extended Warranty','AWD / 4WD','Low Mileage'],
    exampleInput: '2019 Toyota Camry SE, Used - Excellent, 42,000 miles, backup camera, one owner, accident-free, $18,500, Houston, TX',
    exampleOutput: { whatsapp: "🚗 2019 Toyota Camry SE — Excellent Condition\n42,000 miles | One Owner | Accident-Free\n$18,500 — Message to book a test drive!", instagram: "One owner. Zero accidents. This Camry SE has been babied 🚙✨\n2019 • 42K miles • Houston, TX\n$18,500 — DM to book a test drive.\n#HoustonCarsForSale #ToyotaCamry" }
  },

  'ecommerce': {
    slug: 'ecommerce', name: 'E-Commerce', tagline: 'AI Product Listing Generator',
    entityLabel: 'Product', heroVerb: 'product posts',
    audience: 'online sellers, Etsy shops and small brands', icon: 'shop',
    ctaAction: 'shop now',
    fields: [
      { key: 'productName', label: 'Product Name',   type: 'text',   required: true, placeholder: 'e.g. Handwoven Ankara Tote Bag' },
      { key: 'category',    label: 'Category',       type: 'select', required: true, options: ['Fashion & Apparel','Beauty & Skincare','Home & Decor','Jewelry & Accessories','Electronics','Handmade / Craft','Food & Beverage','Baby & Kids'] },
      { key: 'listingType', label: 'Listing Type',   type: 'select', required: true, options: ['New Arrival','Restock','Sale / Discount','Clearance','Limited Edition','Pre-Order'] },
      { key: 'price',       label: 'Price',          type: 'text',   required: true, placeholder: 'e.g. $34.99' },
      { key: 'specs',       label: 'Materials / Specs', type: 'text', required: false, placeholder: 'e.g. Genuine leather, hand-stitched' }
    ],
    features: ['Free Shipping','Handmade','Limited Stock','Eco-Friendly','Customizable','Gift-Ready','Bestseller','Award-Winning'],
    exampleInput: 'Handwoven Ankara Tote Bag, Fashion & Apparel, New Arrival, genuine leather straps, handmade, limited stock, $34.99',
    exampleOutput: { whatsapp: "🛍️ New Arrival: Handwoven Ankara Tote Bag\nGenuine leather straps | Handmade | Limited stock\n$34.99 — DM to order before they're gone!", instagram: "Handmade. Bold print. Only a few left 👜✨\nAnkara Tote • Leather straps • Limited stock\n$34.99 — link in bio to shop.\n#AnkaraFashion #HandmadeBags" }
  },

  'restaurants': {
    slug: 'restaurants', name: 'Restaurants & Food', tagline: 'AI Menu & Specials Generator',
    entityLabel: 'Dish / Special', heroVerb: 'specials posts',
    audience: 'restaurants, food trucks and home chefs', icon: 'food',
    ctaAction: 'order now',
    fields: [
      { key: 'itemType',  label: 'Post Type',   type: 'select', required: true, options: ['Daily Special','New Menu Item','Combo Deal','Happy Hour','Weekend Brunch','Catering Package'] },
      { key: 'dishName',  label: 'Dish Name',   type: 'text',   required: true, placeholder: 'e.g. Smoked Jollof Rice with Grilled Chicken' },
      { key: 'price',     label: 'Price',       type: 'text',   required: true, placeholder: 'e.g. $14.99' },
      { key: 'location',  label: 'Location',    type: 'text',   required: true, placeholder: 'e.g. Downtown Austin, TX' }
    ],
    features: ["Chef's Special", 'Vegan', 'Gluten-Free', 'Spicy', 'Limited Time', 'Family-Sized', 'Locally Sourced', 'Best Seller'],
    exampleInput: "Smoked Jollof Rice with Grilled Chicken, Daily Special, chef's special, spicy, limited time, $14.99, Downtown Austin, TX",
    exampleOutput: { whatsapp: "🔥 Today's Special: Smoked Jollof Rice + Grilled Chicken\nChef's special | Spicy | Limited time only\n$14.99 — order now before we sell out!", instagram: "Smoke. Spice. Sold out by 2pm most days 🔥🍚\nToday's special — $14.99\nOrder now, link in bio.\n#AustinEats #JollofRice" }
  },

  'fitness': {
    slug: 'fitness', name: 'Fitness & Wellness', tagline: 'AI Class & Program Generator',
    entityLabel: 'Class / Program', heroVerb: 'class posts',
    audience: 'gyms, studios and personal trainers', icon: 'dumbbell',
    ctaAction: 'book your spot',
    fields: [
      { key: 'offerType',  label: 'Offer Type',   type: 'select', required: true, options: ['Class Schedule','New Program','Membership Promo','Personal Training Package','Workshop / Bootcamp'] },
      { key: 'className',  label: 'Class / Program Name', type: 'text', required: true, placeholder: 'e.g. Sunrise HIIT Bootcamp' },
      { key: 'price',      label: 'Price',        type: 'text',   required: true, placeholder: 'e.g. $20/session' },
      { key: 'location',   label: 'Studio / Gym Location', type: 'text', required: true, placeholder: 'e.g. Miami Beach, FL' },
      { key: 'schedule',   label: 'Date & Time',  type: 'text',   required: false, placeholder: 'e.g. Mon/Wed/Fri, 6am' }
    ],
    features: ['Beginner Friendly','Small Group','All Levels','Limited Spots','Free Trial','Equipment Provided','Certified Trainer'],
    exampleInput: 'Sunrise HIIT Bootcamp, Class Schedule, Mon/Wed/Fri 6am, small group, limited spots, certified trainer, $20/session, Miami Beach, FL',
    exampleOutput: { whatsapp: "💪 Sunrise HIIT Bootcamp — Miami Beach\nMon/Wed/Fri, 6am | Small group | Certified trainer\n$20/session — spots are limited, book now!", instagram: "6am. Sweat. Sunrise over Miami Beach 🌅🔥\nHIIT Bootcamp • Small group • Limited spots\n$20/session — link in bio to book.\n#MiamiFitness #HIITWorkout" }
  },

  'recruitment': {
    slug: 'recruitment', name: 'Recruitment & Staffing', tagline: 'AI Job Posting Generator',
    entityLabel: 'Job Role', heroVerb: 'job posts',
    audience: 'recruiters, staffing agencies and hiring managers', icon: 'briefcase',
    ctaAction: 'apply now',
    fields: [
      { key: 'roleTitle',  label: 'Role Title',       type: 'text',   required: true, placeholder: 'e.g. Senior Backend Engineer' },
      { key: 'company',    label: 'Company',          type: 'text',   required: true, placeholder: 'e.g. Acme Logistics' },
      { key: 'employmentType', label: 'Employment Type', type: 'select', required: true, options: ['Full-Time','Part-Time','Contract','Remote','Hybrid','Internship'] },
      { key: 'experience', label: 'Experience Level', type: 'select', required: true, options: ['Entry-Level','Mid-Level','Senior','Executive'] },
      { key: 'salary',     label: 'Salary',           type: 'text',   required: false, placeholder: 'e.g. $95,000–$120,000' },
      { key: 'location',   label: 'Location',         type: 'text',   required: true, placeholder: 'e.g. Remote (US)' }
    ],
    features: ['Remote-Friendly','Health Benefits','Urgent Hire','Visa Sponsorship','Flexible Hours','Equity / Stock Options'],
    exampleInput: 'Senior Backend Engineer, Acme Logistics, Full-Time, Senior, remote-friendly, health benefits, $95,000-$120,000, Remote (US)',
    exampleOutput: { whatsapp: "💼 We're Hiring: Senior Backend Engineer\nAcme Logistics | Full-Time | Remote (US)\n$95K–$120K + health benefits\nApply now — link in comments!", instagram: "We're hiring: Senior Backend Engineer 💼\nAcme Logistics • Remote (US) • $95K-$120K\nFull health benefits included.\nApply today — link in bio.\n#NowHiring #RemoteJobs" }
  },

  'events': {
    slug: 'events', name: 'Events & Ticketing', tagline: 'AI Event Promo Generator',
    entityLabel: 'Event', heroVerb: 'event posts',
    audience: 'event promoters, venues and ticket sellers', icon: 'ticket',
    ctaAction: 'get your tickets',
    fields: [
      { key: 'eventType', label: 'Event Type', type: 'select', required: true, options: ['Concert','Conference','Party / Nightlife','Workshop','Festival','Fundraiser','Networking'] },
      { key: 'eventName', label: 'Event Name', type: 'text',   required: true, placeholder: 'e.g. Afrobeats Night Live' },
      { key: 'date',      label: 'Date',       type: 'text',   required: true, placeholder: 'e.g. Sat, Aug 15' },
      { key: 'venue',     label: 'Venue',      type: 'text',   required: true, placeholder: 'e.g. The Grand Hall, Atlanta' },
      { key: 'price',     label: 'Ticket Price', type: 'text', required: true, placeholder: 'e.g. $25 early bird' }
    ],
    features: ['Early Bird Pricing','VIP Available','Limited Tickets','Free Entry','Age Restriction','Live Performance'],
    exampleInput: 'Afrobeats Night Live, Concert, Sat Aug 15, The Grand Hall Atlanta, early bird pricing, VIP available, limited tickets, $25 early bird',
    exampleOutput: { whatsapp: "🎉 Afrobeats Night Live — Sat, Aug 15\nThe Grand Hall, Atlanta | VIP available\n$25 early bird — tickets are moving fast!", instagram: "Atlanta, mark your calendar 📅🔥\nAfrobeats Night Live — Sat, Aug 15\n$25 early bird • VIP available • Limited tickets\nLink in bio to grab yours.\n#AtlantaEvents #AfrobeatsNight" }
  },

  'local-services': {
    slug: 'local-services', name: 'Local Services', tagline: 'AI Service Listing Generator',
    entityLabel: 'Service', heroVerb: 'service posts',
    audience: 'cleaners, electricians, salons and independent artisans', icon: 'wrench',
    ctaAction: 'book now',
    fields: [
      { key: 'serviceType', label: 'Service Type', type: 'select', required: true, options: ['Cleaning','Plumbing','Electrical','Salon / Barber','Landscaping','Tutoring','Repair & Maintenance','Photography','Catering'] },
      { key: 'serviceName', label: 'Service Name', type: 'text',   required: true, placeholder: 'e.g. Full Home Deep Clean' },
      { key: 'price',       label: 'Price',        type: 'text',   required: true, placeholder: 'e.g. $80 flat rate' },
      { key: 'location',    label: 'Service Area', type: 'text',   required: true, placeholder: 'e.g. Brooklyn, NY' },
      { key: 'availability', label: 'Availability', type: 'text',  required: false, placeholder: 'e.g. Same-day slots open' }
    ],
    features: ['Same-Day Service','Free Quote','Licensed & Insured','Satisfaction Guaranteed','Emergency Service','Years of Experience'],
    exampleInput: 'Full Home Deep Clean, Cleaning, same-day service, licensed & insured, satisfaction guaranteed, $80 flat rate, Brooklyn, NY',
    exampleOutput: { whatsapp: "🧹 Full Home Deep Clean — Brooklyn, NY\nLicensed & insured | Same-day slots open\n$80 flat rate — message to book!", instagram: "Same-day slots. Spotless results. Guaranteed 🧼✨\nFull Home Deep Clean — $80 flat rate\nBrooklyn, NY — DM to book.\n#BrooklynCleaning #HomeServices" }
  },

  'hospitality': {
    slug: 'hospitality', name: 'Hospitality & Travel', tagline: 'AI Hotel & Package Generator',
    entityLabel: 'Stay / Package', heroVerb: 'booking posts',
    audience: 'hotels, resorts and tour operators', icon: 'suitcase',
    ctaAction: 'book your stay',
    fields: [
      { key: 'propType',  label: 'Type',        type: 'select', required: true, options: ['Hotel Room','Resort','Vacation Package','Guided Tour','Suite','Villa'] },
      { key: 'location',  label: 'Location',    type: 'text',   required: true, placeholder: 'e.g. Zanzibar, Tanzania' },
      { key: 'price',     label: 'Price',       type: 'text',   required: true, placeholder: 'e.g. $180/night' },
      { key: 'dates',     label: 'Available Dates', type: 'text', required: false, placeholder: 'e.g. Aug 1 - Sept 30' }
    ],
    features: ['Ocean View','All-Inclusive','Free Breakfast','Pool Access','Spa','Airport Pickup','Pet-Friendly','Free Cancellation'],
    exampleInput: 'Resort, Zanzibar Tanzania, ocean view, all-inclusive, free breakfast, spa, $180/night, Aug 1 - Sept 30',
    exampleOutput: { whatsapp: "🌊 Zanzibar Ocean-View Resort\nAll-inclusive | Free breakfast | Spa access\n$180/night — dates open Aug 1–Sept 30. Book now!", instagram: "Wake up to this view. Every. Single. Day 🌊🏝️\nOcean-view resort, Zanzibar\n$180/night, all-inclusive\nLink in bio to book.\n#Zanzibar #TravelGoals" }
  },

  'fashion-resale': {
    slug: 'fashion-resale', name: 'Fashion & Resale', tagline: 'AI Fashion Listing Generator',
    entityLabel: 'Item', heroVerb: 'listing posts',
    audience: 'boutiques, thrift resellers and stylists', icon: 'shirt',
    ctaAction: 'DM to purchase',
    fields: [
      { key: 'itemType',  label: 'Item Type',  type: 'select', required: true, options: ['Dress','Shoes','Handbag','Outerwear','Accessories','Menswear','Vintage','Streetwear'] },
      { key: 'brand',     label: 'Brand',      type: 'text',   required: false, placeholder: 'e.g. Zara, vintage, unbranded' },
      { key: 'size',      label: 'Size',       type: 'text',   required: false, placeholder: 'e.g. UK 10 / US 6' },
      { key: 'condition', label: 'Condition',  type: 'select', required: true, options: ['New with Tags','Like New','Gently Used','Vintage'] },
      { key: 'price',     label: 'Price',      type: 'text',   required: true, placeholder: 'e.g. $45' }
    ],
    features: ['Limited Edition','Designer','Authenticated','Rare Find','Trending','One of a Kind'],
    exampleInput: 'Vintage Denim Jacket, Outerwear, unbranded, Size M, Vintage condition, rare find, one of a kind, $45',
    exampleOutput: { whatsapp: "👖 Vintage Denim Jacket — Size M\nRare find | One of a kind\n$45 — DM to grab it before someone else does!", instagram: "One of one. Won't find this twice 👖✨\nVintage denim, Size M\n$45 — DM to purchase.\n#VintageFashion #ThriftFind" }
  },

  'wedding-vendors': {
    slug: 'wedding-vendors', name: 'Weddings & Event Vendors', tagline: 'AI Vendor Package Generator',
    entityLabel: 'Package', heroVerb: 'promo posts',
    audience: 'photographers, caterers, decorators and planners', icon: 'heart',
    ctaAction: 'book a consultation',
    fields: [
      { key: 'vendorType',   label: 'Vendor Type',  type: 'select', required: true, options: ['Photography','Catering','Decor & Florals','Venue','Makeup & Styling','DJ / Entertainment','Planning'] },
      { key: 'packageName',  label: 'Package Name', type: 'text',   required: true, placeholder: 'e.g. Full-Day Wedding Photography' },
      { key: 'price',        label: 'Price',        type: 'text',   required: true, placeholder: 'e.g. $2,500' },
      { key: 'location',     label: 'Service Area', type: 'text',   required: true, placeholder: 'e.g. Napa Valley, CA' },
      { key: 'availability', label: 'Availability', type: 'text',   required: false, placeholder: 'e.g. Booking for Fall 2026' }
    ],
    features: ['Custom Packages','Free Consultation','Award-Winning','Fully Insured','Destination-Ready','Payment Plans'],
    exampleInput: 'Full-Day Wedding Photography, Photography, custom packages, award-winning, payment plans, $2,500, Napa Valley, CA',
    exampleOutput: { whatsapp: "📸 Full-Day Wedding Photography — Napa Valley\nAward-winning | Payment plans available\n$2,500 — booking Fall 2026, DM to consult!", instagram: "Every glance, every tear, every first dance ✨📸\nFull-day wedding photography — Napa Valley\n$2,500 • Payment plans available\nLink in bio to book your consultation.\n#NapaWeddings #WeddingPhotography" }
  }

}

module.exports = { industries, PLATFORMS, TONES }
