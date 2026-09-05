export const PLUMBING_CATEGORIES = {
  Pipes: ['PVC', 'CPVC', 'UPVC', 'HDPE', 'PPR', 'GI', 'Copper', 'Flexible / Hose'],
  'Pipe Fittings': ['Elbow', 'Tee', 'Coupler / Socket', 'Reducer', 'Union', 'Nipple', 'Adapter', 'Cross', 'End Cap', 'Bush'],
  Valves: ['Ball Valve', 'Gate Valve', 'Globe Valve', 'Check Valve', 'Foot Valve', 'Angle Valve', 'Float Valve', 'Solenoid Valve'],
  'Water Supply': ['Water Tap', 'Bib Cock', 'Pillar Cock', 'Mixer', 'Shower', 'Health Faucet', 'Flexible Connector'],
  'Sanitary Fittings': ['Wash Basin', 'Toilet / WC', 'Urinal', 'Flush Tank', 'Flush Valve', 'Sink', 'Basin Waste'],
  'Drainage & Sewer': ['Floor Trap', 'Gully Trap', 'Bottle Trap', 'P-Trap', 'S-Trap', 'Nahani Trap', 'Drain Pipe', 'Drain Fittings'],
  'Bathroom Accessories': ['Shower', 'Hand Shower', 'Health Faucet', 'Towel Rod', 'Soap Holder', 'Robe Hook', 'Toilet Paper Holder'],
  'Pipe Supports & Clamps': ['Pipe Clamp', 'U Clamp', 'Saddle Clamp', 'Hanger', 'Bracket', 'Pipe Support'],
  'Sealing & Consumables': ['PTFE Tape', 'Thread Sealant', 'PVC Solvent', 'PVC Cement', 'Silicone', 'O-Ring', 'Rubber Washer', 'Gasket'],
  'Fasteners & Hardware': ['Nut', 'Bolt', 'Screw', 'Washer', 'Anchor', 'Rawl Plug'],
  'Water Tanks & Storage': ['Water Tank', 'Tank Connector', 'Tank Nipple', 'Float Valve', 'Tank Cover'],
  Pumps: ['Water Pump', 'Booster Pump', 'Submersible Pump', 'Pump Accessories'],
  'Plumbing Tools': ['Pipe Wrench', 'Adjustable Wrench', 'Pipe Cutter', 'Threading Tool', 'Pliers', 'Hacksaw', 'Measuring Tape', 'Drilling Tools'],
  'Safety Equipment': ['Gloves', 'Safety Goggles', 'Safety Helmet', 'Safety Shoes', 'Mask'],
  Miscellaneous: ['Other Plumbing Materials', 'Spare Parts', 'Custom Items']
};

export const DEFAULT_CATEGORIES = Object.keys(PLUMBING_CATEGORIES);

export const UNITS = [
  { name: 'Piece', symbol: 'pcs' }, { name: 'Box', symbol: 'box' }, { name: 'Packet', symbol: 'pkt' },
  { name: 'Set', symbol: 'set' }, { name: 'Meter', symbol: 'm' }, { name: 'Foot', symbol: 'ft' },
  { name: 'Kilogram', symbol: 'kg' }, { name: 'Gram', symbol: 'g' }, { name: 'Litre', symbol: 'L' },
  { name: 'Millilitre', symbol: 'ml' }, { name: 'Roll', symbol: 'roll' }, { name: 'Coil', symbol: 'coil' },
  { name: 'Bundle', symbol: 'bundle' }, { name: 'Bag', symbol: 'bag' }, { name: 'Can', symbol: 'can' },
  { name: 'Bottle', symbol: 'bottle' }, { name: 'Tube', symbol: 'tube' }, { name: 'Pair', symbol: 'pair' }
];

export const DEFAULT_UNITS = UNITS.map((unit) => unit.symbol);

export const STOCK_REASONS = ['Used for Project', 'Taken to Job Site', 'Damaged', 'Other'];

export const ROLE_LABELS = {
  OWNER: 'Owner',
  EMPLOYEE: 'Employee'
};
