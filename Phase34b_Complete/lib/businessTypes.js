// Shared business-type list — used by both the Onboarding Wizard (first
// signup) and Settings (editing anytime after). One source of truth so
// the two never drift apart.

// Retail & Commerce — the specific sub-verticals a shop might be
export const RETAIL_TYPES = [
  { id:'mobile',      label:'Mobile & Electronics',    icon:'📱', cats:['Mobiles','Accessories','Chargers','Repairs'] },
  { id:'footwear',    label:'Footwear',                icon:'👟', cats:['Shoes','Sandals','Sports','Accessories'] },
  { id:'apparel',     label:'Fashion & Apparel',        icon:'👕', cats:['Shirts','Trousers','Sarees','Kids Wear','Innerwear'] },
  { id:'bags',        label:'Bags & Luggage',           icon:'👜', cats:['Handbags','Backpacks','Travel Bags','Wallets'] },
  { id:'furniture',   label:'Furniture',                icon:'🛋️', cats:['Living Room','Bedroom','Office','Outdoor'] },
  { id:'appliances',  label:'Home Appliances',          icon:'🏠', cats:['Kitchen','Cooling','Cleaning','Small Appliances'] },
  { id:'computers',   label:'Computers & IT',           icon:'💻', cats:['Laptops','Desktops','Peripherals','Networking'] },
  { id:'consumer_electronics', label:'Consumer Electronics', icon:'📺', cats:['TVs','Audio','Cameras','Wearables'] },
  { id:'grocery',     label:'Grocery & Supermarket',    icon:'🛒', cats:['Staples','Snacks','Beverages','Dairy','Household'] },
  { id:'jewellery',   label:'Jewellery',                icon:'💍', cats:['Gold','Silver','Diamond','Artificial'] },
  { id:'beauty',      label:'Beauty & Cosmetics',       icon:'💄', cats:['Skincare','Makeup','Haircare','Fragrance'] },
  { id:'pharmacy',    label:'Pharmacy',                 icon:'🏥', cats:['Prescription','OTC','Wellness','Baby Care'] },
  { id:'sports',      label:'Sports & Fitness',         icon:'🏋️', cats:['Equipment','Apparel','Supplements','Footwear'] },
  { id:'toys',        label:'Toys & Gifts',             icon:'🧸', cats:['Toys','Games','Gift Items','Party Supplies'] },
  { id:'hardware',    label:'Hardware',                 icon:'🛠️', cats:['Tools','Paint','Plumbing','Electrical','Fasteners'] },
  { id:'automobile',  label:'Automobile & Accessories', icon:'🚗', cats:['Parts','Accessories','Lubricants','Tyres'] },
  { id:'books',       label:'Books & Stationery',       icon:'📚', cats:['Books','Notebooks','Office Supplies','Art Supplies'] },
  { id:'pet',         label:'Pet Store',                icon:'🐶', cats:['Pet Food','Accessories','Grooming','Healthcare'] },
  { id:'watches',     label:'Watches & Accessories',    icon:'⌚', cats:['Watches','Straps','Sunglasses','Accessories'] },
  { id:'optical',     label:'Optical & Eyewear',        icon:'👓', cats:['Frames','Lenses','Sunglasses','Contact Lenses'] },
  { id:'baby',        label:'Baby & Kids Store',        icon:'🍼', cats:['Clothing','Feeding','Toys','Diapers'] },
  { id:'florist',     label:'Florist & Gift Shop',      icon:'🌸', cats:['Flowers','Bouquets','Gifts','Plants'] },
  { id:'meat',        label:'Meat, Fish & Poultry',     icon:'🐟', cats:['Meat','Fish','Poultry','Seafood'] },
  { id:'produce',     label:'Fruits & Vegetables',      icon:'🍎', cats:['Fruits','Vegetables','Organic'] },
  { id:'bakery',      label:'Bakery & Confectionery',   icon:'🍰', cats:['Bread','Cakes','Sweets','Snacks'] },
  { id:'liquor',      label:'Wine & Liquor Store',      icon:'🍷', cats:['Wine','Beer','Spirits','Mixers'] },
  { id:'bicycle',     label:'Bicycle & Motorcycle Store', icon:'🏍️', cats:['Bicycles','Motorcycles','Parts','Accessories'] },
  { id:'outdoor',     label:'Outdoor & Camping',        icon:'🏕️', cats:['Tents','Gear','Apparel','Accessories'] },
  { id:'gaming',      label:'Gaming & Entertainment',   icon:'🎮', cats:['Consoles','Games','Accessories','Merchandise'] },
  { id:'music',       label:'Musical Instruments',      icon:'🎵', cats:['Instruments','Accessories','Sheet Music'] },
  { id:'homedecor',   label:'Home Decor & Furnishings', icon:'🏡', cats:['Decor','Curtains','Lighting','Rugs'] },
  { id:'fabrics',     label:'Fabrics & Tailoring Materials', icon:'🧵', cats:['Fabric','Threads','Buttons','Trims'] },
  { id:'printing',    label:'Printing & Office Supplies', icon:'🖨️', cats:['Printing','Stationery','Office Supplies'] },
  { id:'department',  label:'Department Store',         icon:'🛒', cats:['General'] },
  { id:'multibrand',  label:'Multi-Brand Retail Store', icon:'🛍️', cats:['General'] },
];

// Everything that isn't a retail shop — services and other business models
export const OTHER_TYPES = [
  { id:'healthcare',  label:'Healthcare',              icon:'🏥', cats:['General'] },
  { id:'salon',       label:'Salon & Spa',             icon:'💇', cats:['Services'] },
  { id:'food',        label:'Food & Hospitality',      icon:'🍽️', cats:['Menu Items'] },
  { id:'hotel',       label:'Hotel & Hospitality',     icon:'🏨', cats:['Room Types','Services'] },
  { id:'education',   label:'Education',               icon:'🎓', cats:['Courses'] },
  { id:'fitness',     label:'Fitness & Wellness',      icon:'🏋️', cats:['Memberships','Sessions'] },
  { id:'professional',label:'Professional Services',   icon:'💼', cats:['Services'] },
  { id:'auto_service',label:'Automotive Services',     icon:'🚗', cats:['Services','Parts'] },
  { id:'home_service', label:'Home Services',          icon:'🏡', cats:['Services'] },
  { id:'tech_service', label:'Technology Services',    icon:'💻', cats:['Services'] },
  { id:'finance',     label:'Financial Services',      icon:'💰', cats:['Services'] },
  { id:'travel',      label:'Travel & Tourism',        icon:'✈️', cats:['Packages','Services'] },
  { id:'realestate',  label:'Real Estate',             icon:'🏢', cats:['Listings','Services'] },
  { id:'events',      label:'Event Management',        icon:'🎉', cats:['Services','Packages'] },
  { id:'logistics',   label:'Logistics & Delivery',    icon:'🚚', cats:['Services'] },
  { id:'manufacturing',label:'Manufacturing',          icon:'🏭', cats:['Raw Materials','Finished Goods'] },
  { id:'wholesale',   label:'Wholesale & Distribution',icon:'📦', cats:['General'] },
  { id:'agriculture', label:'Agriculture',             icon:'🌾', cats:['Produce','Supplies'] },
  { id:'nonprofit',   label:'Non-Profit & Government', icon:'🏛️', cats:['General'] },
];

export const ALL_TYPES = [...RETAIL_TYPES, ...OTHER_TYPES];