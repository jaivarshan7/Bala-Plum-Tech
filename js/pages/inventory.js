import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { getFirebaseServices } from '../firebase/firebase-config.js';
import { getInventoryItems, getInventoryStatus, createInventoryItem, updateInventoryItem } from '../services/inventory-service.js';
import { DEFAULT_CATEGORIES, PLUMBING_CATEGORIES, UNITS } from '../utils/constants.js';
import { validateInventoryInput } from '../utils/validation.js';
import { escapeHtml } from '../utils/helpers.js';

const { db } = getFirebaseServices();
const inventoryTableBody = document.getElementById('inventoryTableBody');
const searchInput = document.getElementById('inventorySearch');
const categoryFilter = document.getElementById('categoryFilter');
const subcategoryFilter = document.getElementById('subcategoryFilter');
const brandFilter = document.getElementById('brandFilter');
const stockFilter = document.getElementById('stockFilter');
const addItemButton = document.getElementById('addItemButton');
const inventoryForm = document.getElementById('inventoryForm');
const itemModal = document.getElementById('itemModal');

const imageUrlInput = document.getElementById('imageUrlInput');
const removeImageBtn = document.getElementById('removeImageBtn');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreviewBox = document.getElementById('imagePreviewBox');
const previewTitle = document.getElementById('previewTitle');

let inventoryData = [];
let editingItemId = null;
let categorySelect;
let subcategorySelect;
let brandSelect;
let previewRequestId = 0;

function setPreviewState(state, payload = {}) {
  if (state === 'hidden') {
    imagePreviewContainer?.classList.add('hidden');
    if (imagePreviewBox) imagePreviewBox.innerHTML = '';
    removeImageBtn?.classList.add('hidden');
    return;
  }

  imagePreviewContainer?.classList.remove('hidden');
  removeImageBtn?.classList.remove('hidden');
  if (previewTitle) {
    previewTitle.textContent = editingItemId ? 'Current Preview' : 'Preview';
  }

  if (state === 'loading') {
    imagePreviewBox.innerHTML = `
      <div class="image-preview-status preview-loading">
        <span class="preview-spinner">⏳</span>
        <span>Loading image preview...</span>
      </div>
    `;
  } else if (state === 'loaded') {
    imagePreviewBox.innerHTML = '';
    const img = document.createElement('img');
    img.src = payload.url;
    img.alt = 'Product preview';
    img.className = 'modal-preview-img';
    img.loading = 'lazy';
    img.decoding = 'async';
    imagePreviewBox.appendChild(img);
  } else if (state === 'error') {
    imagePreviewBox.innerHTML = `
      <div class="image-preview-status preview-error">
        <span class="status-icon">⚠</span>
        <div>
          <strong>Image could not be loaded</strong>
          <p>Check that this is a direct image URL.</p>
        </div>
      </div>
    `;
  }
}

function handleImageUrlChange(url) {
  const rawUrl = (url || '').trim();
  const reqId = ++previewRequestId;

  if (!rawUrl) {
    setPreviewState('hidden');
    return;
  }

  let isValidHttpUrl = false;
  try {
    const parsed = new URL(rawUrl);
    isValidHttpUrl = (parsed.protocol === 'http:' || parsed.protocol === 'https:') && !rawUrl.startsWith('data:');
  } catch {
    isValidHttpUrl = false;
  }

  if (!isValidHttpUrl) {
    setPreviewState('error');
    return;
  }

  setPreviewState('loading');

  const imgTest = new Image();
  imgTest.onload = () => {
    if (reqId !== previewRequestId) return;
    setPreviewState('loaded', { url: rawUrl });
  };
  imgTest.onerror = () => {
    if (reqId !== previewRequestId) return;
    setPreviewState('error');
  };
  imgTest.src = rawUrl;
}

function renderCategoryOptions() {
  const options = DEFAULT_CATEGORIES;
  categoryFilter.innerHTML = '<option value="">All Categories</option>' + options.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  const categoryField = inventoryForm.elements.category;
  categoryField.innerHTML = '<option value="">Select category</option>' + options.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  const unitField = inventoryForm.elements.unit;
  unitField.innerHTML = '<option value="">Select unit</option>' + UNITS.map((unit) => `<option value="${unit.symbol}">${unit.name} (${unit.symbol})</option>`).join('');
  const brandField = inventoryForm.elements.brand;
  const brands = [...new Set(inventoryData.map((item) => item.brand).filter(Boolean))].sort();
  brandField.innerHTML = '<option value="">Select brand</option>' + brands.map((brand) => `<option value="${brand}">${brand}</option>`).join('');
  updateSubcategoryOptions('');
}

function updateSubcategoryOptions(category, selectedValue = '') {
  const subcategoryField = inventoryForm.elements.subcategory;
  const subcategories = PLUMBING_CATEGORIES[category] || [];
  const options = subcategories.map((item) => ({ value: item, text: item }));

  if (subcategorySelect) {
    subcategorySelect.clear(true);
    subcategorySelect.clearOptions();
    subcategorySelect.addOption(options);
    subcategorySelect.refreshOptions(false);
    if (selectedValue && subcategories.includes(selectedValue)) subcategorySelect.setValue(selectedValue, true);
    return;
  }

  subcategoryField.innerHTML = options.length
    ? '<option value="">Select subcategory</option>' + options.map((item) => `<option value="${item.value}">${item.text}</option>`).join('')
    : '<option value="">Select category first</option>';
}

function initializeProductSelects() {
  if (!window.TomSelect || categorySelect) return;

  categorySelect = new window.TomSelect(inventoryForm.elements.category, {
    valueField: 'value',
    labelField: 'text',
    searchField: ['text'],
    dropdownParent: 'body',
    allowEmptyOption: true,
    placeholder: 'Select category'
  });

  subcategorySelect = new window.TomSelect(inventoryForm.elements.subcategory, {
    valueField: 'value',
    labelField: 'text',
    searchField: ['text'],
    dropdownParent: 'body',
    allowEmptyOption: true,
    placeholder: 'Select subcategory'
  });

  brandSelect = new window.TomSelect(inventoryForm.elements.brand, {
    valueField: 'value',
    labelField: 'text',
    searchField: ['text'],
    dropdownParent: 'body',
    allowEmptyOption: true,
    placeholder: 'Select or type a brand',
    createOnBlur: true,
    create: (input) => {
      const brand = input.trim();
      return brand ? { value: brand, text: brand } : false;
    }
  });

  categorySelect.on('change', (category) => updateSubcategoryOptions(category));
}

function renderFilterOptions() {
  const categories = [...new Set(inventoryData.map((item) => item.category).filter(Boolean))];
  const subcategories = [...new Set(inventoryData.map((item) => item.subcategory).filter(Boolean))];
  const brands = [...new Set(inventoryData.map((item) => item.brand).filter(Boolean))];
  categoryFilter.innerHTML = '<option value="">All Categories</option>' + categories.map((cat) => `<option value="${cat}">${cat}</option>`).join('');
  subcategoryFilter.innerHTML = '<option value="">All Subcategories</option>' + subcategories.map((item) => `<option value="${item}">${item}</option>`).join('');
  brandFilter.innerHTML = '<option value="">All Brands</option>' + brands.map((item) => `<option value="${item}">${item}</option>`).join('');
}

function getFilteredInventory() {
  const query = searchInput.value.trim().toLowerCase();
  const categoryValue = categoryFilter.value;
  const subcategoryValue = subcategoryFilter.value;
  const brandValue = brandFilter.value;
  const stockValue = stockFilter.value;

  return inventoryData.filter((item) => {
    const text = [item.name, item.sku, item.brand, item.category, item.subcategory, item.size, item.description, item.storageLocation].join(' ').toLowerCase();
    const matchesSearch = !query || text.includes(query);
    const matchesCategory = !categoryValue || item.category === categoryValue;
    const matchesSubcategory = !subcategoryValue || item.subcategory === subcategoryValue;
    const matchesBrand = !brandValue || item.brand === brandValue;
    const status = getInventoryStatus(item).label;
    const matchesStock = !stockValue || (
      (stockValue === 'low' && status === 'Low Stock') ||
      (stockValue === 'in' && status === 'In Stock') ||
      (stockValue === 'out' && status === 'Out of Stock')
    );
    return matchesSearch && matchesCategory && matchesSubcategory && matchesBrand && matchesStock;
  });
}

function renderItemThumbnail(item) {
  const imageUrl = item.imageUrl && typeof item.imageUrl === 'string' ? item.imageUrl.trim() : '';
  if (!imageUrl) {
    return '<div class="item-thumb-placeholder" title="No image" aria-label="No image">—</div>';
  }

  const safeUrl = escapeHtml(imageUrl);
  const safeAlt = escapeHtml(item.name || 'Product');

  return `
    <div class="item-thumb-container">
      <img
        src="${safeUrl}"
        alt="${safeAlt}"
        class="item-image-thumb"
        width="48"
        height="48"
        loading="lazy"
        decoding="async"
        onerror="this.onerror=null; this.classList.add('hidden'); if(this.nextElementSibling) this.nextElementSibling.classList.remove('hidden');"
      />
      <div class="item-thumb-placeholder item-thumb-fallback hidden" title="Image unavailable" aria-label="Image unavailable">
        <span class="fallback-icon">⚠</span>
      </div>
    </div>
  `;
}

function renderInventoryTable() {
  const filtered = getFilteredInventory();
  if (!filtered.length) {
    inventoryTableBody.innerHTML = '<tr><td colspan="10"><div class="empty-state">No inventory records could be found.</div></td></tr>';
    return;
  }

  inventoryTableBody.innerHTML = filtered.map((item) => {
    const status = getInventoryStatus(item);
    return `
      <tr>
        <td class="col-thumb">${renderItemThumbnail(item)}</td>
        <td><a href="./item-details.html?id=${item.id}">${escapeHtml(item.name)}</a></td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.subcategory || '—')}</td>
        <td>${escapeHtml(item.brand || '—')}</td>
        <td>${escapeHtml(item.size || '—')}</td>
        <td>${getStock(item)}</td>
        <td>${escapeHtml(item.unit || '—')}</td>
        <td><span class="status-pill ${status.className}">${status.label}</span></td>
        <td>
          <div class="row-actions">
            <a href="./item-details.html?id=${item.id}" class="btn btn-secondary">View</a>
            <button class="btn btn-secondary" data-edit-item="${item.id}">Edit</button>
            <button class="btn btn-primary" data-stock-in="${item.id}">Stock In</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function getStock(item) {
  return Number(item.stock ?? item.quantity ?? 0);
}

function renderTableSkeletons() {
  inventoryTableBody.innerHTML = Array.from({ length: 6 }).map(() => `
    <tr>
      <td class="col-thumb"><span class="skeleton" style="width: 48px; height: 48px; border-radius: 10px; display: inline-block;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 140px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 80px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 80px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 70px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 50px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 40px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 40px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 70px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 120px;">&nbsp;</span></td>
    </tr>
  `).join('');
}

function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

async function loadInventoryPage(user) {
  renderTableSkeletons();
  try {
    inventoryData = await getInventoryItems();
  } catch (error) {
    console.error('Unable to load inventory:', error);
    inventoryData = [];
    inventoryTableBody.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state">
            <p>Unable to load inventory. Please check your network connection.</p>
            <button id="retryInventoryBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('retryInventoryBtn')?.addEventListener('click', () => loadInventoryPage(user));
    return;
  }

  renderCategoryOptions();
  initializeProductSelects();
  renderFilterOptions();
  renderInventoryTable();
}

searchInput.addEventListener('input', debounce(renderInventoryTable, 150));
categoryFilter.addEventListener('change', renderInventoryTable);
subcategoryFilter.addEventListener('change', renderInventoryTable);
brandFilter.addEventListener('change', renderInventoryTable);
stockFilter.addEventListener('change', renderInventoryTable);

const debouncedPreviewUpdate = debounce((val) => handleImageUrlChange(val), 250);

imageUrlInput?.addEventListener('input', (e) => {
  debouncedPreviewUpdate(e.target.value);
});

removeImageBtn?.addEventListener('click', () => {
  if (imageUrlInput) imageUrlInput.value = '';
  handleImageUrlChange('');
  imageUrlInput?.focus();
});

addItemButton.addEventListener('click', () => {
  editingItemId = null;
  document.getElementById('itemModalTitle').textContent = 'Add Inventory Item';
  inventoryForm.reset();
  if (imageUrlInput) imageUrlInput.value = '';
  handleImageUrlChange('');
  categorySelect?.clear(true);
  subcategorySelect?.clear(true);
  brandSelect?.clear(true);
  updateSubcategoryOptions('');
  itemModal.classList.remove('hidden');
  itemModal.setAttribute('aria-hidden', 'false');
});

inventoryTableBody.addEventListener('click', (event) => {
  const editButton = event.target.closest('[data-edit-item]');
  if (!editButton) return;
  const item = inventoryData.find((record) => record.id === editButton.dataset.editItem);
  if (!item) return;
  editingItemId = item.id;
  document.getElementById('itemModalTitle').textContent = 'Edit Inventory Item';
  Object.entries({
    name: item.name || '', sku: item.sku || '', category: item.category || '', subcategory: item.subcategory || '',
    unit: item.unit || '', size: item.size || '', stock: getStock(item),
    minimumStock: Number(item.minimumStock ?? item.minimumQuantity ?? 0), unitCost: item.unitCost ?? '', storageLocation: item.storageLocation || '', description: item.description || ''
  }).forEach(([field, value]) => { if (inventoryForm.elements[field]) inventoryForm.elements[field].value = value; });
  if (imageUrlInput) {
    imageUrlInput.value = item.imageUrl || '';
    handleImageUrlChange(item.imageUrl || '');
  }
  categorySelect?.setValue(item.category || '', true);
  updateSubcategoryOptions(item.category || '', item.subcategory || '');
  if (item.brand && brandSelect) {
    brandSelect.addOption({ value: item.brand, text: item.brand });
    brandSelect.setValue(item.brand, true);
  }
  itemModal.classList.remove('hidden');
  itemModal.setAttribute('aria-hidden', 'false');
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    const modalId = button.dataset.closeModal;
    const modalNode = document.getElementById(modalId);
    modalNode?.classList.add('hidden');
    modalNode?.setAttribute('aria-hidden', 'true');
  });
});

inventoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const submitButton = inventoryForm.querySelector('button[type="submit"]');
  const originalButtonText = submitButton ? submitButton.textContent : 'Save';

  const formData = new FormData(inventoryForm);
  const rawImageUrl = String(formData.get('imageUrl') || '').trim();
  const safeImageUrl = rawImageUrl.startsWith('data:') ? '' : rawImageUrl;

  const payload = {
    name: String(formData.get('name') || '').trim(),
    description: String(formData.get('description') || '').trim(),
    sku: String(formData.get('sku') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    subcategory: String(formData.get('subcategory') || '').trim(),
    brand: String(formData.get('brand') || '').trim(),
    size: String(formData.get('size') || '').trim(),
    unit: String(formData.get('unit') || '').trim(),
    imageUrl: safeImageUrl,
    stock: Number(formData.get('stock') || 0),
    minimumStock: Number(formData.get('minimumStock') || 0),
    quantity: Number(formData.get('stock') || 0),
    minimumQuantity: Number(formData.get('minimumStock') || 0),
    unitCost: Number(formData.get('unitCost') || 0),
    storageLocation: String(formData.get('storageLocation') || '').trim(),
  };

  const validationError = validateInventoryInput(payload);
  if (validationError) {
    window.alert(validationError);
    return;
  }

  try {
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';
    }

    payload.createdBy = getCurrentUser().uid;
    if (editingItemId) await updateInventoryItem(editingItemId, payload);
    else await createInventoryItem(payload);
    inventoryForm.reset();
    if (imageUrlInput) imageUrlInput.value = '';
    handleImageUrlChange('');
    categorySelect?.clear(true);
    subcategorySelect?.clear(true);
    brandSelect?.clear(true);
    editingItemId = null;
    itemModal.classList.add('hidden');
    inventoryData = await getInventoryItems(true);
    renderFilterOptions();
    renderInventoryTable();
  } catch (err) {
    console.error('Error saving inventory item:', err);
    window.alert(err.message || 'Unable to save item. Please try again.');
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = originalButtonText;
    }
  }
});

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  loadInventoryPage(user);
});
