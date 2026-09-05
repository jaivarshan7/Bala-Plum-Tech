export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateInventoryInput(data) {
  const requiredFields = ['name', 'category', 'subcategory', 'unit'];

  for (const field of requiredFields) {
    if (!String(data[field] ?? '').trim()) {
      return `${field.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())} is required.`;
    }
  }

  if (Number(data.stock) < 0) {
    return 'Current stock cannot be negative.';
  }

  if (Number(data.minimumStock) < 0) {
    return 'Minimum stock cannot be negative.';
  }

  return null;
}

export function validateStockQuantity(value) {
  if (!Number.isFinite(Number(value)) || Number(value) <= 0) {
    return 'Quantity must be greater than zero.';
  }
  return null;
}
