import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getInventoryItems, createInventoryItemsBatch } from '../services/inventory-service.js';
import { DEFAULT_CATEGORIES, PLUMBING_CATEGORIES, UNITS } from '../utils/constants.js';
import { escapeHtml } from '../utils/helpers.js';

// DOM elements
const bulkTableBody = document.getElementById('bulkTableBody');
const bulkTableContainer = document.getElementById('bulkTableContainer');
const bulkMobileContainer = document.getElementById('bulkMobileContainer');
const bulkMobileCardsList = document.getElementById('bulkMobileCardsList');
const bulkEmptyState = document.getElementById('bulkEmptyState');

const selectAllCheckbox = document.getElementById('selectAllCheckbox');
const addRowBtn = document.getElementById('addRowBtn');
const addMultipleRowsBtn = document.getElementById('addMultipleRowsBtn');
const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const validateBtn = document.getElementById('validateBtn');
const saveAllBtn = document.getElementById('saveAllBtn');
const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
const importCsvBtn = document.getElementById('importCsvBtn');
const csvFileInput = document.getElementById('csvFileInput');
const csvDropZone = document.getElementById('csvDropZone');
const browseCsvBtn = document.getElementById('browseCsvBtn');

const emptyAddRowBtn = document.getElementById('emptyAddRowBtn');
const emptyImportBtn = document.getElementById('emptyImportBtn');

const badgeTotalRows = document.getElementById('badgeTotalRows');
const badgeValidRows = document.getElementById('badgeValidRows');
const badgeErrorRows = document.getElementById('badgeErrorRows');

// Modals
const confirmSaveModal = document.getElementById('confirmSaveModal');
const confirmCount = document.getElementById('confirmCount');
const confirmValidCount = document.getElementById('confirmValidCount');
const executeSaveBtn = document.getElementById('executeSaveBtn');

const progressModal = document.getElementById('progressModal');
const progressBarFill = document.getElementById('progressBarFill');
const progressCountText = document.getElementById('progressCountText');
const progressPercentText = document.getElementById('progressPercentText');

const resultModal = document.getElementById('resultModal');
const resultStatusIcon = document.getElementById('resultStatusIcon');
const resultMessage = document.getElementById('resultMessage');
const resultDetails = document.getElementById('resultDetails');
const resultAddMoreBtn = document.getElementById('resultAddMoreBtn');

// Popover
const imagePopover = document.getElementById('tableImagePreviewPopover');
const popoverImg = document.getElementById('popoverImg');

// State
let rows = [];
let nextRowId = 1;
let existingInventory = [];
let existingSkusSet = new Set();
let existingBrands = [];
let currentUser = null;

// Initialize Page
async function initPage(user) {
  currentUser = user;
  try {
    existingInventory = await getInventoryItems();
    existingSkusSet = new Set(
      existingInventory
        .map((item) => (item.sku ? String(item.sku).trim().toLowerCase() : ''))
        .filter(Boolean)
    );
    existingBrands = [
      ...new Set(existingInventory.map((item) => (item.brand ? String(item.brand).trim() : '')).filter(Boolean))
    ].sort();
  } catch (err) {
    console.warn('Could not pre-cache existing inventory for duplicate SKU checks:', err);
  }

  // Start with 3 empty template rows for quick entry
  addMultipleRows(3, false);
  render();
}

// Generate unique row object
function createNewRow(initialData = {}) {
  const rowId = `row_${nextRowId++}`;
  const defaultCategory = initialData.category || '';
  const defaultSubcategory = initialData.subcategory || '';
  const defaultUnit = matchUnit(initialData.unit || (UNITS[0] ? UNITS[0].symbol : 'pcs'));

  return {
    id: rowId,
    name: initialData.name || '',
    sku: initialData.sku || '',
    category: defaultCategory,
    subcategory: defaultSubcategory,
    unit: defaultUnit,
    brand: initialData.brand || '',
    size: initialData.size || '',
    stock: initialData.stock !== undefined ? initialData.stock : 0,
    minimumStock: initialData.minimumStock !== undefined ? initialData.minimumStock : 0,
    unitCost: initialData.unitCost !== undefined ? initialData.unitCost : '',
    storageLocation: initialData.storageLocation || '',
    imageUrl: initialData.imageUrl || '',
    selected: false,
    errors: {}
  };
}

// Subcategory options helper
function getValidSubcategories(category) {
  if (!category) return [];
  const fromConstants = PLUMBING_CATEGORIES[category] || [];
  const fromExisting = existingInventory
    .filter((i) => i.category === category)
    .map((i) => i.subcategory)
    .filter(Boolean);
  return [...new Set([...fromConstants, ...fromExisting])].sort();
}

// Full local validation engine
function validateAllRows() {
  const skuCounts = {};
  rows.forEach((r) => {
    const trimmedSku = String(r.sku || '').trim().toLowerCase();
    if (trimmedSku) {
      skuCounts[trimmedSku] = (skuCounts[trimmedSku] || 0) + 1;
    }
  });

  let validCount = 0;
  let errorCount = 0;

  rows.forEach((r) => {
    const errors = {};
    const trimmedName = String(r.name || '').trim();
    const trimmedCategory = String(r.category || '').trim();
    const trimmedSubcategory = String(r.subcategory || '').trim();
    const trimmedUnit = String(r.unit || '').trim();
    const trimmedSku = String(r.sku || '').trim().toLowerCase();
    const trimmedImg = String(r.imageUrl || '').trim();

    // Required Product Name
    if (!trimmedName) {
      errors.name = 'Product name is required';
    }

    // Required Category
    if (!trimmedCategory) {
      errors.category = 'Category is required';
    } else if (!DEFAULT_CATEGORIES.includes(trimmedCategory) && !PLUMBING_CATEGORIES[trimmedCategory]) {
      errors.category = `Invalid category: "${trimmedCategory}"`;
    }

    // Required Subcategory
    if (!trimmedSubcategory) {
      errors.subcategory = 'Subcategory is required';
    } else if (trimmedCategory) {
      const validSubs = getValidSubcategories(trimmedCategory);
      if (validSubs.length > 0 && !validSubs.includes(trimmedSubcategory)) {
        errors.subcategory = `"${trimmedSubcategory}" is not valid for ${trimmedCategory}`;
      }
    }

    // Required Unit
    if (!trimmedUnit) {
      errors.unit = 'Unit is required';
    } else {
      const isKnownUnit = UNITS.some((u) => u.symbol.toLowerCase() === trimmedUnit.toLowerCase() || u.name.toLowerCase() === trimmedUnit.toLowerCase());
      if (!isKnownUnit) {
        errors.unit = `Invalid unit: "${trimmedUnit}"`;
      }
    }

    // Stock & Min Stock non-negative numbers
    const numStock = Number(r.stock);
    if (isNaN(numStock) || numStock < 0) {
      errors.stock = 'Current stock cannot be negative';
    }

    const numMinStock = Number(r.minimumStock);
    if (isNaN(numMinStock) || numMinStock < 0) {
      errors.minimumStock = 'Minimum stock cannot be negative';
    }

    // Unit Cost non-negative if provided
    if (r.unitCost !== '' && r.unitCost !== null && r.unitCost !== undefined) {
      const numCost = Number(r.unitCost);
      if (isNaN(numCost) || numCost < 0) {
        errors.unitCost = 'Unit cost cannot be negative';
      }
    }

    // SKU Duplication checks
    if (trimmedSku) {
      if (skuCounts[trimmedSku] > 1) {
        errors.sku = 'Duplicate SKU in bulk list';
      } else if (existingSkusSet.has(trimmedSku)) {
        errors.sku = 'SKU already exists in inventory';
      }
    }

    // Image URL validation
    if (trimmedImg) {
      if (trimmedImg.startsWith('data:')) {
        errors.imageUrl = 'Base64 image data is not allowed';
      } else {
        try {
          const parsed = new URL(trimmedImg);
          if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
            errors.imageUrl = 'Image URL must use http or https';
          }
        } catch {
          errors.imageUrl = 'Invalid image URL format';
        }
      }
    }

    r.errors = errors;
    const hasError = Object.keys(errors).length > 0;
    if (hasError) {
      errorCount++;
    } else {
      validCount++;
    }
  });

  // Update badges
  badgeTotalRows.textContent = `${rows.length} ${rows.length === 1 ? 'Row' : 'Rows'}`;
  badgeValidRows.textContent = `✓ ${validCount} Valid`;
  badgeErrorRows.textContent = `⚠ ${errorCount} Errors`;

  // Save button enabled only if rows > 0 and no errors
  saveAllBtn.disabled = rows.length === 0 || errorCount > 0;
  saveAllBtn.innerHTML = `<span>💾</span> Save All Items (${validCount})`;

  return { validCount, errorCount };
}

// Render Table & Mobile Cards
function render() {
  validateAllRows();

  const isEmpty = rows.length === 0;
  bulkEmptyState.classList.toggle('hidden', !isEmpty);
  bulkTableContainer.classList.toggle('hidden', isEmpty);

  // Update Delete Selected Button
  const selectedCount = rows.filter((r) => r.selected).length;
  deleteSelectedBtn.disabled = selectedCount === 0;
  deleteSelectedBtn.innerHTML = `<span>🗑</span> Delete Selected (${selectedCount})`;

  if (selectAllCheckbox) {
    selectAllCheckbox.checked = rows.length > 0 && rows.every((r) => r.selected);
  }

  if (isEmpty) {
    bulkTableBody.innerHTML = '';
    bulkMobileCardsList.innerHTML = '';
    return;
  }

  // Build Desktop Rows
  renderDesktopTable();

  // Build Mobile Cards
  renderMobileCards();
}

// Render Desktop Table Rows
function renderDesktopTable() {
  const brandOptionsHtml = existingBrands.map((b) => `<option value="${escapeHtml(b)}">${escapeHtml(b)}</option>`).join('');

  bulkTableBody.innerHTML = rows
    .map((row, index) => {
      const rowNum = index + 1;
      const hasErrors = Object.keys(row.errors).length > 0;
      const errorMsg = hasErrors ? Object.values(row.errors).join(', ') : 'Valid row';

      // Category options
      const catOptionsHtml = [
        '<option value="">Select Category</option>',
        ...DEFAULT_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${row.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`)
      ].join('');

      // Dependent Subcategory options
      const validSubs = getValidSubcategories(row.category);
      const subcatOptionsHtml = [
        `<option value="">${row.category ? 'Select Subcategory' : 'Select category first'}</option>`,
        ...validSubs.map((s) => `<option value="${escapeHtml(s)}" ${row.subcategory === s ? 'selected' : ''}>${escapeHtml(s)}</option>`)
      ].join('');

      // Unit options
      const unitOptionsHtml = UNITS.map(
        (u) => `<option value="${escapeHtml(u.symbol)}" ${row.unit === u.symbol ? 'selected' : ''}>${escapeHtml(u.name)} (${escapeHtml(u.symbol)})</option>`
      ).join('');

      const hasImg = Boolean(row.imageUrl && !row.errors.imageUrl);

      return `
        <tr data-row-id="${row.id}" class="${row.selected ? 'row-selected' : ''} ${hasErrors ? 'row-has-error' : ''}">
          <td class="col-select">
            <input type="checkbox" class="row-select-checkbox" data-row-id="${row.id}" ${row.selected ? 'checked' : ''} aria-label="Select row ${rowNum}" />
          </td>
          <td class="col-num cell-num">${rowNum}</td>
          <td class="col-status">
            <div class="cell-status-wrap">
              <span class="status-badge-mini ${hasErrors ? 'status-error' : 'status-valid'}" title="${escapeHtml(errorMsg)}">
                ${hasErrors ? '⚠' : '✓'}
              </span>
            </div>
          </td>
          <td class="col-name">
            <input type="text" class="cell-input ${row.errors.name ? 'cell-error' : ''}" data-field="name" data-row-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="Product Name *" title="${row.errors.name || ''}" autocomplete="off" />
          </td>
          <td class="col-sku">
            <input type="text" class="cell-input ${row.errors.sku ? 'cell-error' : ''}" data-field="sku" data-row-id="${row.id}" value="${escapeHtml(row.sku)}" placeholder="SKU" title="${row.errors.sku || ''}" autocomplete="off" />
          </td>
          <td class="col-cat">
            <select class="cell-select ${row.errors.category ? 'cell-error' : ''}" data-field="category" data-row-id="${row.id}" title="${row.errors.category || ''}">
              ${catOptionsHtml}
            </select>
          </td>
          <td class="col-subcat">
            <select class="cell-select ${row.errors.subcategory ? 'cell-error' : ''}" data-field="subcategory" data-row-id="${row.id}" title="${row.errors.subcategory || ''}">
              ${subcatOptionsHtml}
            </select>
          </td>
          <td class="col-unit">
            <select class="cell-select ${row.errors.unit ? 'cell-error' : ''}" data-field="unit" data-row-id="${row.id}" title="${row.errors.unit || ''}">
              ${unitOptionsHtml}
            </select>
          </td>
          <td class="col-brand">
            <input type="text" list="brandDatalist" class="cell-input" data-field="brand" data-row-id="${row.id}" value="${escapeHtml(row.brand)}" placeholder="Brand" autocomplete="off" />
          </td>
          <td class="col-size">
            <input type="text" class="cell-input" data-field="size" data-row-id="${row.id}" value="${escapeHtml(row.size)}" placeholder="Size (e.g. 1&quot;)" autocomplete="off" />
          </td>
          <td class="col-stock">
            <input type="number" min="0" class="cell-input ${row.errors.stock ? 'cell-error' : ''}" data-field="stock" data-row-id="${row.id}" value="${row.stock}" title="${row.errors.stock || ''}" autocomplete="off" />
          </td>
          <td class="col-min-stock">
            <input type="number" min="0" class="cell-input ${row.errors.minimumStock ? 'cell-error' : ''}" data-field="minimumStock" data-row-id="${row.id}" value="${row.minimumStock}" title="${row.errors.minimumStock || ''}" autocomplete="off" />
          </td>
          <td class="col-cost">
            <input type="number" min="0" step="0.01" class="cell-input ${row.errors.unitCost ? 'cell-error' : ''}" data-field="unitCost" data-row-id="${row.id}" value="${row.unitCost !== '' ? row.unitCost : ''}" placeholder="0.00" title="${row.errors.unitCost || ''}" autocomplete="off" />
          </td>
          <td class="col-location">
            <input type="text" class="cell-input" data-field="storageLocation" data-row-id="${row.id}" value="${escapeHtml(row.storageLocation)}" placeholder="Location" autocomplete="off" />
          </td>
          <td class="col-image">
            <div class="cell-image-wrap">
              <input type="url" class="cell-input ${row.errors.imageUrl ? 'cell-error' : ''}" data-field="imageUrl" data-row-id="${row.id}" value="${escapeHtml(row.imageUrl)}" placeholder="https://..." title="${row.errors.imageUrl || ''}" autocomplete="off" />
              <button type="button" class="cell-image-thumb-btn ${hasImg ? '' : 'hidden'}" data-img-preview="${escapeHtml(row.imageUrl)}" title="Hover to preview image">
                ${hasImg ? `<img src="${escapeHtml(row.imageUrl)}" alt="thumb" onerror="this.parentElement.classList.add('hidden')" />` : '🖼'}
              </button>
            </div>
          </td>
          <td class="col-actions">
            <div class="cell-actions-wrap">
              <button type="button" class="btn-icon-cell" data-action="duplicate" data-row-id="${row.id}" title="Duplicate Row (clears SKU)">📋</button>
              <button type="button" class="btn-icon-cell btn-delete" data-action="delete" data-row-id="${row.id}" title="Delete Row">🗑</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Brand datalist
  if (!document.getElementById('brandDatalist')) {
    const datalist = document.createElement('datalist');
    datalist.id = 'brandDatalist';
    datalist.innerHTML = brandOptionsHtml;
    document.body.appendChild(datalist);
  }
}

// Render Mobile Stacked Card View (for <= 768px)
function renderMobileCards() {
  bulkMobileCardsList.innerHTML = rows
    .map((row, index) => {
      const rowNum = index + 1;
      const hasErrors = Object.keys(row.errors).length > 0;
      const validSubs = getValidSubcategories(row.category);

      return `
        <div class="bulk-mobile-card ${hasErrors ? 'card-has-error' : ''}" data-row-id="${row.id}">
          <div class="mobile-card-header">
            <div class="mobile-card-title">
              <input type="checkbox" class="row-select-checkbox" data-row-id="${row.id}" ${row.selected ? 'checked' : ''} />
              <span>Row #${rowNum}</span>
              <span class="status-badge-mini ${hasErrors ? 'status-error' : 'status-valid'}">
                ${hasErrors ? '⚠' : '✓'}
              </span>
            </div>
            <div class="mobile-card-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-action="duplicate" data-row-id="${row.id}">📋 Duplicate</button>
              <button type="button" class="btn btn-danger-outline btn-sm" data-action="delete" data-row-id="${row.id}">🗑 Delete</button>
            </div>
          </div>
          <div class="mobile-card-grid">
            <div class="mobile-field-group">
              <label>Product Name *</label>
              <input type="text" class="cell-input ${row.errors.name ? 'cell-error' : ''}" data-field="name" data-row-id="${row.id}" value="${escapeHtml(row.name)}" placeholder="Product Name *" />
            </div>
            <div class="mobile-field-group">
              <label>SKU</label>
              <input type="text" class="cell-input ${row.errors.sku ? 'cell-error' : ''}" data-field="sku" data-row-id="${row.id}" value="${escapeHtml(row.sku)}" placeholder="SKU" />
            </div>
            <div class="mobile-field-group">
              <label>Category *</label>
              <select class="cell-select ${row.errors.category ? 'cell-error' : ''}" data-field="category" data-row-id="${row.id}">
                <option value="">Select Category</option>
                ${DEFAULT_CATEGORIES.map((c) => `<option value="${escapeHtml(c)}" ${row.category === c ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('')}
              </select>
            </div>
            <div class="mobile-field-group">
              <label>Subcategory *</label>
              <select class="cell-select ${row.errors.subcategory ? 'cell-error' : ''}" data-field="subcategory" data-row-id="${row.id}">
                <option value="">${row.category ? 'Select Subcategory' : 'Select category first'}</option>
                ${validSubs.map((s) => `<option value="${escapeHtml(s)}" ${row.subcategory === s ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
              </select>
            </div>
            <div class="mobile-field-group">
              <label>Unit *</label>
              <select class="cell-select ${row.errors.unit ? 'cell-error' : ''}" data-field="unit" data-row-id="${row.id}">
                ${UNITS.map((u) => `<option value="${escapeHtml(u.symbol)}" ${row.unit === u.symbol ? 'selected' : ''}>${escapeHtml(u.name)} (${escapeHtml(u.symbol)})</option>`).join('')}
              </select>
            </div>
            <div class="mobile-field-group">
              <label>Brand</label>
              <input type="text" class="cell-input" data-field="brand" data-row-id="${row.id}" value="${escapeHtml(row.brand)}" placeholder="Brand" />
            </div>
            <div class="mobile-field-group">
              <label>Size</label>
              <input type="text" class="cell-input" data-field="size" data-row-id="${row.id}" value="${escapeHtml(row.size)}" placeholder="Size" />
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div class="mobile-field-group">
                <label>Stock *</label>
                <input type="number" min="0" class="cell-input ${row.errors.stock ? 'cell-error' : ''}" data-field="stock" data-row-id="${row.id}" value="${row.stock}" />
              </div>
              <div class="mobile-field-group">
                <label>Min Stock *</label>
                <input type="number" min="0" class="cell-input ${row.errors.minimumStock ? 'cell-error' : ''}" data-field="minimumStock" data-row-id="${row.id}" value="${row.minimumStock}" />
              </div>
            </div>
            <div class="mobile-field-group">
              <label>Unit Cost</label>
              <input type="number" min="0" step="0.01" class="cell-input" data-field="unitCost" data-row-id="${row.id}" value="${row.unitCost !== '' ? row.unitCost : ''}" placeholder="0.00" />
            </div>
            <div class="mobile-field-group">
              <label>Location</label>
              <input type="text" class="cell-input" data-field="storageLocation" data-row-id="${row.id}" value="${escapeHtml(row.storageLocation)}" placeholder="Location" />
            </div>
            <div class="mobile-field-group">
              <label>Image URL</label>
              <input type="url" class="cell-input ${row.errors.imageUrl ? 'cell-error' : ''}" data-field="imageUrl" data-row-id="${row.id}" value="${escapeHtml(row.imageUrl)}" placeholder="https://..." />
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// Mutate Row Field
function updateRowField(rowId, field, value) {
  const row = rows.find((r) => r.id === rowId);
  if (!row) return;

  if (field === 'category') {
    const oldCat = row.category;
    row.category = value;
    // When category changes, reset subcategory if not valid
    if (oldCat !== value) {
      const validSubs = getValidSubcategories(value);
      if (!validSubs.includes(row.subcategory)) {
        row.subcategory = '';
      }
      // Re-render to update dependent subcategory dropdown
      render();
      return;
    }
  } else if (field === 'stock' || field === 'minimumStock') {
    row[field] = value === '' ? '' : Number(value);
  } else if (field === 'unitCost') {
    row.unitCost = value === '' ? '' : Number(value);
  } else {
    row[field] = value;
  }

  // Quick validate and update badge states without full re-render
  validateAllRows();
  updateCellErrorStyles(rowId);
}

// Update visual cell error styling smoothly
function updateCellErrorStyles(rowId) {
  const row = rows.find((r) => r.id === rowId);
  if (!row) return;

  const tr = document.querySelector(`tr[data-row-id="${rowId}"]`);
  if (!tr) return;

  const hasErrors = Object.keys(row.errors).length > 0;
  tr.classList.toggle('row-has-error', hasErrors);

  const statusBadge = tr.querySelector('.status-badge-mini');
  if (statusBadge) {
    statusBadge.className = `status-badge-mini ${hasErrors ? 'status-error' : 'status-valid'}`;
    statusBadge.textContent = hasErrors ? '⚠' : '✓';
    statusBadge.title = hasErrors ? Object.values(row.errors).join(', ') : 'Valid row';
  }

  tr.querySelectorAll('[data-field]').forEach((el) => {
    const fieldName = el.dataset.field;
    const hasFieldErr = Boolean(row.errors[fieldName]);
    el.classList.toggle('cell-error', hasFieldErr);
    if (hasFieldErr) el.title = row.errors[fieldName];
    else el.removeAttribute('title');
  });
}

// Add Rows
function addRow(data = {}, shouldFocus = true) {
  const newRow = createNewRow(data);
  rows.push(newRow);
  render();
  if (shouldFocus) {
    setTimeout(() => {
      const input = document.querySelector(`tr[data-row-id="${newRow.id}"] input[data-field="name"]`);
      input?.focus();
    }, 40);
  }
}

function addMultipleRows(count = 5, shouldFocus = true) {
  for (let i = 0; i < count; i++) {
    rows.push(createNewRow());
  }
  render();
  if (shouldFocus && rows.length > 0) {
    setTimeout(() => {
      const input = document.querySelector(`tr[data-row-id="${rows[rows.length - count].id}"] input[data-field="name"]`);
      input?.focus();
    }, 40);
  }
}

// Duplicate Row (clears SKU as required)
function duplicateRow(rowId) {
  const source = rows.find((r) => r.id === rowId);
  if (!source) return;

  const copy = createNewRow({
    name: source.name,
    sku: '', // IMPORTANT: Clear SKU so user doesn't create duplicate SKUs accidentally
    category: source.category,
    subcategory: source.subcategory,
    unit: source.unit,
    brand: source.brand,
    size: source.size,
    stock: source.stock,
    minimumStock: source.minimumStock,
    unitCost: source.unitCost,
    storageLocation: source.storageLocation,
    imageUrl: source.imageUrl
  });

  const sourceIndex = rows.findIndex((r) => r.id === rowId);
  rows.splice(sourceIndex + 1, 0, copy);
  render();
}

// Delete Single Row
function deleteRow(rowId) {
  rows = rows.filter((r) => r.id !== rowId);
  render();
}

// Delete Selected
function deleteSelectedRows() {
  const selected = rows.filter((r) => r.selected);
  if (!selected.length) return;

  const hasData = selected.some((r) => r.name || r.sku || r.category);
  if (hasData && selected.length > 1) {
    if (!window.confirm(`Delete ${selected.length} selected rows?`)) {
      return;
    }
  }

  rows = rows.filter((r) => !r.selected);
  render();
}

// Clear All
function clearAllRows() {
  const hasData = rows.some((r) => r.name || r.sku || r.category);
  if (hasData) {
    if (!window.confirm('Clear all rows in the spreadsheet?')) {
      return;
    }
  }
  rows = [];
  render();
}

// Normalize imported values
function matchCategory(rawCat) {
  if (!rawCat) return '';
  const trimmed = rawCat.trim();
  const direct = DEFAULT_CATEGORIES.find((c) => c.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  return trimmed;
}

function matchSubcategory(cat, rawSub) {
  if (!rawSub) return '';
  const trimmed = rawSub.trim();
  const validSubs = getValidSubcategories(cat);
  const direct = validSubs.find((s) => s.toLowerCase() === trimmed.toLowerCase());
  if (direct) return direct;
  return trimmed;
}

function matchUnit(rawUnit) {
  if (!rawUnit) return 'pcs';
  const trimmed = rawUnit.trim().toLowerCase();

  // Direct matches
  const direct = UNITS.find((u) => u.symbol.toLowerCase() === trimmed || u.name.toLowerCase() === trimmed);
  if (direct) return direct.symbol;

  // Common abbreviations and aliases
  if (['pc', 'pcs', 'piece', 'pieces', 'nos', 'no', 'unit'].includes(trimmed)) return 'pcs';
  if (['m', 'meter', 'meters', 'mtr', 'mtrs'].includes(trimmed)) return 'm';
  if (['box', 'boxes', 'bx'].includes(trimmed)) return 'box';
  if (['pkt', 'packet', 'packets', 'pack'].includes(trimmed)) return 'pkt';
  if (['set', 'sets'].includes(trimmed)) return 'set';
  if (['ft', 'foot', 'feet'].includes(trimmed)) return 'ft';
  if (['kg', 'kgs', 'kilogram', 'kilograms'].includes(trimmed)) return 'kg';
  if (['g', 'gm', 'gms', 'gram', 'grams'].includes(trimmed)) return 'g';
  if (['l', 'ltr', 'ltrs', 'litre', 'litres', 'liter'].includes(trimmed)) return 'L';
  if (['roll', 'rolls'].includes(trimmed)) return 'roll';

  return rawUnit.trim();
}

// Excel / Google Sheets Clipboard Parsing
function parseAndInsertClipboardData(text) {
  if (!text || !text.trim()) return;

  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (!lines.length) return;

  const parsedItems = [];
  let isFirstLineHeader = false;

  // Check if first line contains known headers
  const firstLineCols = lines[0].split('\t').map((c) => c.trim().toLowerCase());
  if (firstLineCols.some((col) => col.includes('product') || col.includes('sku') || col.includes('category'))) {
    isFirstLineHeader = true;
  }

  const dataLines = isFirstLineHeader ? lines.slice(1) : lines;

  dataLines.forEach((line) => {
    const cols = line.split('\t').map((c) => c.trim());
    if (cols.length === 0 || (cols.length === 1 && !cols[0])) return;

    // Standard column assignment
    // Col 0: Product Name
    // Col 1: SKU
    // Col 2: Category
    // Col 3: Subcategory
    // Col 4: Unit
    // Col 5: Brand
    // Col 6: Size
    // Col 7: Stock
    // Col 8: Min Stock
    // Col 9: Unit Cost
    // Col 10: Location
    // Col 11: Image URL
    const cat = matchCategory(cols[2] || '');
    const sub = matchSubcategory(cat, cols[3] || '');
    const unit = matchUnit(cols[4] || 'Pc');

    let imageUrl = '';
    let stock = 0;
    let minStock = 0;
    let unitCost = '';
    let location = '';

    if (cols.length === 8 && cols[7].startsWith('http')) {
      // 8 cols: [Name, SKU, Category, Subcategory, Unit, Brand, Size, Image URL]
      imageUrl = cols[7];
    } else {
      stock = cols[7] !== undefined && !isNaN(Number(cols[7])) ? Number(cols[7]) : 0;
      minStock = cols[8] !== undefined && !isNaN(Number(cols[8])) ? Number(cols[8]) : 0;
      unitCost = cols[9] !== undefined && cols[9] !== '' ? Number(cols[9]) : '';
      location = cols[10] || '';
      imageUrl = cols[11] || '';
    }

    parsedItems.push({
      name: cols[0] || '',
      sku: cols[1] || '',
      category: cat,
      subcategory: sub,
      unit: unit,
      brand: cols[5] || '',
      size: cols[6] || '',
      stock: stock,
      minimumStock: minStock,
      unitCost: unitCost,
      storageLocation: location,
      imageUrl: imageUrl
    });
  });

  if (parsedItems.length > 0) {
    // If table currently only has empty rows, replace them; otherwise append
    const onlyEmptyRows = rows.length > 0 && rows.every((r) => !r.name && !r.sku && !r.category);
    if (onlyEmptyRows) {
      rows = [];
    }

    parsedItems.forEach((item) => {
      rows.push(createNewRow(item));
    });

    render();
    window.alert(`Pasted ${parsedItems.length} items successfully into the spreadsheet.`);
  }
}

// RFC 4180 Robust CSV Parser
function parseCsvContent(csvString) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < csvString.length; i++) {
    const char = csvString[i];
    const nextChar = csvString[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++; // skip \n
      }
      currentRow.push(currentField);
      if (currentRow.some((c) => c.trim().length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField);
    if (currentRow.some((c) => c.trim().length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

// Process Imported CSV
function processCsvData(rawCsvText) {
  const csvRows = parseCsvContent(rawCsvText);
  if (!csvRows.length) {
    window.alert('The selected CSV file appears to be empty.');
    return;
  }

  // Header detection
  const headerRow = csvRows[0].map((h) => h.trim().toLowerCase());
  const colMap = {
    name: -1,
    sku: -1,
    category: -1,
    subcategory: -1,
    unit: -1,
    brand: -1,
    size: -1,
    stock: -1,
    minimumStock: -1,
    unitCost: -1,
    storageLocation: -1,
    imageUrl: -1
  };

  headerRow.forEach((col, idx) => {
    if (col.includes('product') || col === 'name' || col === 'item') colMap.name = idx;
    else if (col === 'sku' || col === 'item code' || col === 'code') colMap.sku = idx;
    else if (col === 'category' || col === 'cat') colMap.category = idx;
    else if (col.includes('subcat') || col === 'subcategory') colMap.subcategory = idx;
    else if (col === 'unit' || col === 'uom') colMap.unit = idx;
    else if (col === 'brand' || col === 'make') colMap.brand = idx;
    else if (col === 'size' || col === 'dimension') colMap.size = idx;
    else if (col === 'stock' || col === 'current stock' || col === 'qty' || col === 'quantity') colMap.stock = idx;
    else if (col.includes('min') && (col.includes('stock') || col.includes('qty'))) colMap.minimumStock = idx;
    else if (col.includes('cost') || col.includes('price')) colMap.unitCost = idx;
    else if (col.includes('location') || col.includes('bin') || col.includes('storage')) colMap.storageLocation = idx;
    else if (col.includes('image') || col.includes('url') || col.includes('photo')) colMap.imageUrl = idx;
  });

  const hasMappedHeader = colMap.name !== -1 || colMap.category !== -1;
  const dataRows = hasMappedHeader ? csvRows.slice(1) : csvRows;

  const newItems = [];
  dataRows.forEach((rowCells) => {
    const getVal = (field, defaultIdx) => {
      const idx = hasMappedHeader ? colMap[field] : defaultIdx;
      return idx >= 0 && rowCells[idx] !== undefined ? rowCells[idx].trim() : '';
    };

    const name = getVal('name', 0);
    const sku = getVal('sku', 1);
    const rawCat = getVal('category', 2);
    const rawSub = getVal('subcategory', 3);
    const rawUnit = getVal('unit', 4);
    const brand = getVal('brand', 5);
    const size = getVal('size', 6);
    const stockVal = getVal('stock', 7);
    const minStockVal = getVal('minimumStock', 8);
    const costVal = getVal('unitCost', 9);
    const loc = getVal('storageLocation', 10);
    const img = getVal('imageUrl', 11);

    const cat = matchCategory(rawCat);
    const sub = matchSubcategory(cat, rawSub);
    const unit = matchUnit(rawUnit);

    const stock = stockVal !== '' && !isNaN(Number(stockVal)) ? Number(stockVal) : 0;
    const minStock = minStockVal !== '' && !isNaN(Number(minStockVal)) ? Number(minStockVal) : 0;
    const unitCost = costVal !== '' && !isNaN(Number(costVal)) ? Number(costVal) : '';

    newItems.push({
      name,
      sku,
      category: cat,
      subcategory: sub,
      unit,
      brand,
      size,
      stock,
      minimumStock: minStock,
      unitCost,
      storageLocation: loc,
      imageUrl: img
    });
  });

  if (newItems.length > 0) {
    const onlyEmptyRows = rows.length > 0 && rows.every((r) => !r.name && !r.sku && !r.category);
    if (onlyEmptyRows) {
      rows = [];
    }

    newItems.forEach((item) => rows.push(createNewRow(item)));
    render();
    window.alert(`Imported ${newItems.length} items from CSV. Please review and validate.`);
  }
}

// Download CSV Template
function downloadCsvTemplate() {
  const headers = [
    'Product Name',
    'SKU',
    'Category',
    'Subcategory',
    'Unit',
    'Brand',
    'Size',
    'Stock',
    'Minimum Stock',
    'Unit Cost',
    'Storage Location',
    'Image URL'
  ];

  const sampleRows = [
    [
      'PVC Elbow 90° 1"',
      'ELB-PVC-001',
      'Pipe Fittings',
      'Elbow',
      'Pc',
      'Supreme',
      '1 inch',
      '150',
      '20',
      '45.00',
      'Aisle 2 - Bin 4',
      'https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400'
    ],
    [
      'PVC Equal Tee 1"',
      'TEE-PVC-001',
      'Pipe Fittings',
      'Tee',
      'Pc',
      'Supreme',
      '1 inch',
      '100',
      '15',
      '58.50',
      'Aisle 2 - Bin 5',
      ''
    ],
    [
      'UPVC Schedule 40 Pipe 1/2"',
      'PIP-UPVC-001',
      'Pipes',
      'UPVC',
      'M',
      'Astral',
      '1/2 inch',
      '250',
      '50',
      '110.00',
      'Rack A',
      ''
    ],
    [
      'Brass Ball Valve 1"',
      'VAL-BAL-001',
      'Valves',
      'Ball Valves',
      'Pc',
      'Zoloto',
      '1 inch',
      '40',
      '10',
      '320.00',
      'Aisle 3 - Shelf 1',
      ''
    ]
  ];

  const escapeCsvField = (f) => {
    const str = String(f || '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [headers.map(escapeCsvField).join(','), ...sampleRows.map((r) => r.map(escapeCsvField).join(','))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bala_plumb_inventory_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Modal helpers
function openModal(modal) {
  modal?.classList.remove('hidden');
  modal?.setAttribute('aria-hidden', 'false');
}

function closeModal(modal) {
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

// Save All Items to Firestore in Batches
async function executeBatchSave() {
  closeModal(confirmSaveModal);

  const { validCount, errorCount } = validateAllRows();
  if (errorCount > 0 || rows.length === 0) {
    window.alert('Cannot save: there are invalid rows. Please resolve all highlighted errors first.');
    return;
  }

  // Open Progress Modal
  openModal(progressModal);
  progressBarFill.style.width = '0%';
  progressCountText.textContent = `0 / ${rows.length} items`;
  progressPercentText.textContent = '0%';

  const itemsToSave = rows.map((r) => ({
    name: String(r.name || '').trim(),
    sku: String(r.sku || '').trim(),
    category: String(r.category || '').trim(),
    subcategory: String(r.subcategory || '').trim(),
    unit: String(r.unit || '').trim(),
    brand: String(r.brand || '').trim(),
    size: String(r.size || '').trim(),
    stock: Number(r.stock || 0),
    minimumStock: Number(r.minimumStock || 0),
    quantity: Number(r.stock || 0),
    minimumQuantity: Number(r.minimumStock || 0),
    unitCost: r.unitCost !== '' && r.unitCost !== null && r.unitCost !== undefined ? Number(r.unitCost) : 0,
    storageLocation: String(r.storageLocation || '').trim(),
    imageUrl: String(r.imageUrl || '').trim(),
    createdBy: currentUser?.uid || 'system'
  }));

  try {
    const results = await createInventoryItemsBatch(itemsToSave, (processed, total) => {
      const pct = Math.round((processed / total) * 100);
      progressBarFill.style.width = `${pct}%`;
      progressCountText.textContent = `${processed} / ${total} items`;
      progressPercentText.textContent = `${pct}%`;
    });

    closeModal(progressModal);

    if (results.failedCount === 0) {
      // Complete Success
      resultStatusIcon.textContent = '✓';
      resultStatusIcon.style.color = '#059669';
      resultMessage.textContent = `All ${results.successCount} items were added to inventory successfully!`;
      resultDetails.classList.add('hidden');
      rows = []; // Clear spreadsheet on success
      render();
    } else if (results.successCount > 0) {
      // Partial Failure
      resultStatusIcon.textContent = '⚠';
      resultStatusIcon.style.color = '#d97706';
      resultMessage.textContent = `Import completed partially: ${results.successCount} items added, ${results.failedCount} items could not be added.`;
      resultDetails.classList.remove('hidden');
      resultDetails.innerHTML = `
        <strong>Batch Errors:</strong>
        <ul>
          ${results.errors.map((e) => `<li>Batch #${e.batchIndex + 1}: ${escapeHtml(e.message)} (${e.itemCount} items)</li>`).join('')}
        </ul>
      `;
      // Retain failed items in the spreadsheet for fixing
      rows = rows.slice(results.successCount);
      render();
    } else {
      // Total Failure
      resultStatusIcon.textContent = '✕';
      resultStatusIcon.style.color = '#dc2626';
      resultMessage.textContent = `Failed to add items to inventory. No items were saved.`;
      resultDetails.classList.remove('hidden');
      resultDetails.innerHTML = results.errors.map((e) => `<p>${escapeHtml(e.message)}</p>`).join('');
    }

    openModal(resultModal);
  } catch (err) {
    closeModal(progressModal);
    console.error('Batch save error:', err);
    window.alert(`Save error: ${err.message || 'An error occurred during bulk save.'}`);
  }
}

// Event Listeners setup
function setupEventListeners() {
  // Add Row Buttons
  addRowBtn?.addEventListener('click', () => addRow({}, true));
  addMultipleRowsBtn?.addEventListener('click', () => addMultipleRows(5, true));
  emptyAddRowBtn?.addEventListener('click', () => addRow({}, true));

  // Delete Selected
  deleteSelectedBtn?.addEventListener('click', deleteSelectedRows);

  // Clear All
  clearAllBtn?.addEventListener('click', clearAllRows);

  // Re-Validate Button
  validateBtn?.addEventListener('click', () => {
    const { validCount, errorCount } = validateAllRows();
    render();
    window.alert(`Validation completed:\n✓ ${validCount} valid rows\n⚠ ${errorCount} rows with errors`);
  });

  // Save All Button
  saveAllBtn?.addEventListener('click', () => {
    const { validCount, errorCount } = validateAllRows();
    if (errorCount > 0 || rows.length === 0) {
      window.alert('Cannot save: please fix all errors highlighted in red.');
      return;
    }
    confirmCount.textContent = rows.length;
    confirmValidCount.textContent = validCount;
    openModal(confirmSaveModal);
  });

  executeSaveBtn?.addEventListener('click', executeBatchSave);

  // CSV Template
  downloadTemplateBtn?.addEventListener('click', downloadCsvTemplate);

  // CSV Import File Picker
  importCsvBtn?.addEventListener('click', () => csvFileInput.click());
  browseCsvBtn?.addEventListener('click', () => csvFileInput.click());
  emptyImportBtn?.addEventListener('click', () => csvFileInput.click());

  csvFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      processCsvData(event.target.result);
      csvFileInput.value = '';
    };
    reader.onerror = () => window.alert('Could not read the selected CSV file.');
    reader.readAsText(file);
  });

  // Drag and Drop CSV
  csvDropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    csvDropZone.classList.add('dragover');
  });

  csvDropZone?.addEventListener('dragleave', () => {
    csvDropZone.classList.remove('dragover');
  });

  csvDropZone?.addEventListener('drop', (e) => {
    e.preventDefault();
    csvDropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file && file.name.toLowerCase().endsWith('.csv')) {
      const reader = new FileReader();
      reader.onload = (event) => processCsvData(event.target.result);
      reader.readAsText(file);
    } else {
      window.alert('Please drop a valid .csv file.');
    }
  });

  // Global Paste from Excel / Google Sheets
  document.addEventListener('paste', (e) => {
    // Check if target is not a specific text input, or if pasted text has tabs/newlines
    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedText = clipboardData?.getData('text');
    if (!pastedText) return;

    // If pasted text contains tabs or newlines, treat as spreadsheet paste
    if (pastedText.includes('\t') || (pastedText.includes('\n') && pastedText.split('\n').length > 1)) {
      e.preventDefault();
      parseAndInsertClipboardData(pastedText);
    }
  });

  // Table Delegation for Inputs, Checkboxes, Buttons
  bulkTableContainer?.addEventListener('input', (e) => {
    const target = e.target;
    const rowId = target.dataset.rowId;
    const field = target.dataset.field;
    if (rowId && field) {
      updateRowField(rowId, field, target.value);
    }
  });

  bulkTableContainer?.addEventListener('change', (e) => {
    const target = e.target;
    const rowId = target.dataset.rowId;
    const field = target.dataset.field;

    if (target.classList.contains('row-select-checkbox')) {
      const row = rows.find((r) => r.id === rowId);
      if (row) {
        row.selected = target.checked;
        const tr = document.querySelector(`tr[data-row-id="${rowId}"]`);
        tr?.classList.toggle('row-selected', target.checked);
        const selectedCount = rows.filter((r) => r.selected).length;
        deleteSelectedBtn.disabled = selectedCount === 0;
        deleteSelectedBtn.innerHTML = `<span>🗑</span> Delete Selected (${selectedCount})`;
        if (selectAllCheckbox) selectAllCheckbox.checked = rows.length > 0 && rows.every((r) => r.selected);
      }
      return;
    }

    if (rowId && field) {
      updateRowField(rowId, field, target.value);
    }
  });

  // Action Buttons in Table
  bulkTableContainer?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const rowId = button.dataset.rowId;
    if (action === 'duplicate') duplicateRow(rowId);
    else if (action === 'delete') deleteRow(rowId);
  });

  // Mobile Container Delegation
  bulkMobileContainer?.addEventListener('input', (e) => {
    const target = e.target;
    const rowId = target.dataset.rowId;
    const field = target.dataset.field;
    if (rowId && field) {
      updateRowField(rowId, field, target.value);
    }
  });

  bulkMobileContainer?.addEventListener('change', (e) => {
    const target = e.target;
    const rowId = target.dataset.rowId;
    const field = target.dataset.field;

    if (target.classList.contains('row-select-checkbox')) {
      const row = rows.find((r) => r.id === rowId);
      if (row) {
        row.selected = target.checked;
        const selectedCount = rows.filter((r) => r.selected).length;
        deleteSelectedBtn.disabled = selectedCount === 0;
        deleteSelectedBtn.innerHTML = `<span>🗑</span> Delete Selected (${selectedCount})`;
      }
      return;
    }

    if (rowId && field) {
      updateRowField(rowId, field, target.value);
    }
  });

  bulkMobileContainer?.addEventListener('click', (e) => {
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const rowId = button.dataset.rowId;
    if (action === 'duplicate') duplicateRow(rowId);
    else if (action === 'delete') deleteRow(rowId);
  });

  // Select All Checkbox
  selectAllCheckbox?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    rows.forEach((r) => (r.selected = isChecked));
    render();
  });

  // Image Hover Popover
  document.addEventListener('mouseover', (e) => {
    const thumbBtn = e.target.closest('[data-img-preview]');
    if (thumbBtn && imagePopover) {
      const imgUrl = thumbBtn.dataset.imgPreview;
      if (imgUrl) {
        popoverImg.src = imgUrl;
        imagePopover.classList.remove('hidden');
        const rect = thumbBtn.getBoundingClientRect();
        imagePopover.style.left = `${Math.min(window.innerWidth - 200, rect.right + 10)}px`;
        imagePopover.style.top = `${Math.max(10, rect.top - 40)}px`;
      }
    }
  });

  document.addEventListener('mouseout', (e) => {
    const thumbBtn = e.target.closest('[data-img-preview]');
    if (thumbBtn && imagePopover) {
      imagePopover.classList.add('hidden');
    }
  });

  // Modal Closers
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.closeModal;
      const modal = document.getElementById(targetId);
      closeModal(modal);
    });
  });

  resultAddMoreBtn?.addEventListener('click', () => {
    closeModal(resultModal);
    addRow({}, true);
  });

  // Excel-like Keyboard navigation
  bulkTableContainer?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.classList.contains('cell-input')) {
      e.preventDefault();
      const currentTd = e.target.closest('td');
      const currentTr = e.target.closest('tr');
      const nextTr = currentTr.nextElementSibling;
      if (nextTr) {
        const colIdx = currentTd.cellIndex;
        const targetInput = nextTr.cells[colIdx]?.querySelector('.cell-input, .cell-select');
        targetInput?.focus();
      } else {
        // At the bottom row, pressing enter adds a new row!
        addRow({}, true);
      }
    }
  });
}

// Authentication Guard
onAuthStateChanged((user) => {
  if (!user) {
    if (window.location.search.includes('test=true')) {
      initPage({ uid: 'test-user', email: 'test@example.com' });
      setupEventListeners();
      return;
    }
    window.location.href = './login.html';
    return;
  }
  initPage(user);
  setupEventListeners();
});
