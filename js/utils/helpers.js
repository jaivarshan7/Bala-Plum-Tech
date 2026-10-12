export function formatDate(dateValue) {
  if (!dateValue) return '—';
  const date = dateValue.toDate ? dateValue.toDate() : new Date(dateValue);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(date);
}

export function getInitials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export function getStatusFromQuantity(quantity, minimumQuantity) {
  if (quantity <= 0) return 'out-of-stock';
  if (quantity <= minimumQuantity) return 'low-stock';
  return 'in-stock';
}

export function toCurrency(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

export function safeText(value) {
  return value ?? '';
}

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function showToast(message, type = 'success', duration = 4000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

class AppInitCoordinator {
  constructor() {
    this.tasks = new Map();
    this.isReady = false;
    this.hasTimedOut = false;
    this.hasFailed = false;
    this.listeners = [];
  }

  register(taskKey, options = {}) {
    const isRequired = options.required !== false;
    const timeoutMs = options.timeoutMs || (isRequired ? 15000 : 8000);
    const description = options.description || taskKey;

    if (this.tasks.has(taskKey) && this.tasks.get(taskKey).status === 'pending') {
      const existing = this.tasks.get(taskKey);
      existing.required = isRequired;
      existing.description = description;
      return;
    }

    const existing = this.tasks.get(taskKey);
    if (existing?.timerId) {
      clearTimeout(existing.timerId);
    }

    if (this.isReady && isRequired) {
      this.isReady = false;
      showAppLoader('Loading Bala Plumb Tech...');
    }

    const taskInfo = {
      required: isRequired,
      status: 'pending',
      timeoutMs,
      description,
      timerId: null
    };

    taskInfo.timerId = setTimeout(() => {
      this._handleTaskTimeout(taskKey);
    }, timeoutMs);

    this.tasks.set(taskKey, taskInfo);
  }

  registerOptional(taskKey, options = {}) {
    this.register(taskKey, { ...options, required: false });
  }

  complete(taskKey) {
    const task = this.tasks.get(taskKey);
    if (!task) {
      this.tasks.set(taskKey, { required: false, status: 'completed', timerId: null, description: taskKey });
      this._checkAllDone();
      return;
    }

    if (task.timerId) {
      clearTimeout(task.timerId);
      task.timerId = null;
    }
    task.status = 'completed';
    this._checkAllDone();
  }

  fail(taskKey, error) {
    console.warn(`[AppInitCoordinator] Task failed: ${taskKey}`, error);
    const task = this.tasks.get(taskKey);
    if (!task) {
      this.tasks.set(taskKey, { required: false, status: 'failed', timerId: null, description: taskKey, error });
      this._checkAllDone();
      return;
    }

    if (task.timerId) {
      clearTimeout(task.timerId);
      task.timerId = null;
    }
    task.status = 'failed';
    task.error = error;

    // If a required task fails, do NOT mark ready or reveal an incomplete page!
    // Show the recoverable error screen with a Retry button.
    if (task.required) {
      this.hasFailed = true;
      this._showFailureError(taskKey, task, error);
      return;
    }

    this._checkAllDone();
  }

  cancel(taskKey) {
    const task = this.tasks.get(taskKey);
    if (task) {
      if (task.timerId) clearTimeout(task.timerId);
      this.tasks.delete(taskKey);
      this._checkAllDone();
    }
  }

  cancelAll() {
    for (const [, task] of this.tasks) {
      if (task.timerId) clearTimeout(task.timerId);
    }
    this.tasks.clear();
  }

  hasPendingTasks() {
    for (const [, task] of this.tasks) {
      if (task.status === 'pending') return true;
    }
    return false;
  }

  hasPendingRequiredTasks() {
    for (const [, task] of this.tasks) {
      if (task.required && task.status === 'pending') return true;
    }
    return false;
  }

  hasFailedRequiredTasks() {
    for (const [, task] of this.tasks) {
      if (task.required && task.status === 'failed') return true;
    }
    return false;
  }

  isInitialized() {
    return this.isReady;
  }

  onReady(callback) {
    if (this.isReady) {
      callback();
    } else {
      this.listeners.push(callback);
    }
  }

  _handleTaskTimeout(taskKey) {
    const task = this.tasks.get(taskKey);
    if (!task || task.status !== 'pending') return;

    if (!task.required) {
      console.warn(`[AppInitCoordinator] Optional task timed out: ${taskKey} (${task.description}). Continuing.`);
      task.status = 'failed';
      task.timerId = null;
      this._checkAllDone();
      return;
    }

    console.error(`[AppInitCoordinator] Required task timed out: ${taskKey} (${task.description}). Showing recoverable error.`);
    this.hasTimedOut = true;
    this._showTimeoutError(taskKey, task);
  }

  _showTimeoutError(taskKey, task) {
    let loader = document.getElementById('appLoader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'appLoader';
      loader.className = 'app-loader-overlay';
      document.body.prepend(loader);
    }

    loader.classList.remove('fade-out');
    loader.setAttribute('aria-busy', 'false');
    loader.innerHTML = `
      <div class="app-loader-error-box" role="alert" style="text-align: center; max-width: 440px; padding: 28px 24px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12); margin: 16px;">
        <div style="font-size: 2.8rem; margin-bottom: 12px; line-height: 1;" aria-hidden="true">⚠️</div>
        <div class="app-loader-brand" style="margin-bottom: 8px;">Bala Plumb Tech</div>
        <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.18rem; font-weight: 600;">Initialization Taking Longer Than Expected</h3>
        <p style="margin: 0 0 20px 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
          A required service (${escapeHtml(task.description || taskKey)}) is taking longer than usual to respond. Please check your internet connection and try again.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" id="appLoaderRetryBtn" class="btn btn-primary" style="min-width: 120px;">
            ↻ Retry
          </button>
          <a href="./login.html" class="btn btn-secondary" style="min-width: 120px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
            Go to Login
          </a>
        </div>
      </div>
    `;

    document.getElementById('appLoaderRetryBtn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  _showFailureError(taskKey, task, error) {
    let loader = document.getElementById('appLoader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'appLoader';
      loader.className = 'app-loader-overlay';
      document.body.prepend(loader);
    }

    loader.classList.remove('fade-out');
    loader.setAttribute('aria-busy', 'false');
    const detailMsg = error?.message ? `: ${error.message}` : '';
    loader.innerHTML = `
      <div class="app-loader-error-box" role="alert" style="text-align: center; max-width: 440px; padding: 28px 24px; background: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12); margin: 16px;">
        <div style="font-size: 2.8rem; margin-bottom: 12px; line-height: 1;" aria-hidden="true">⚠️</div>
        <div class="app-loader-brand" style="margin-bottom: 8px;">Bala Plumb Tech</div>
        <h3 style="margin: 0 0 10px 0; color: #1e293b; font-size: 1.18rem; font-weight: 600;">Unable to Complete Initialization</h3>
        <p style="margin: 0 0 20px 0; color: #64748b; font-size: 0.9rem; line-height: 1.5;">
          A required service (${escapeHtml(task.description || taskKey)}) could not be loaded${escapeHtml(detailMsg)}. Please check your internet connection and try again.
        </p>
        <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
          <button type="button" id="appLoaderRetryBtn" class="btn btn-primary" style="min-width: 120px;">
            ↻ Retry
          </button>
          <a href="./login.html" class="btn btn-secondary" style="min-width: 120px; text-decoration: none; display: inline-flex; align-items: center; justify-content: center;">
            Go to Login
          </a>
        </div>
      </div>
    `;

    document.getElementById('appLoaderRetryBtn')?.addEventListener('click', () => {
      window.location.reload();
    });
  }

  _checkAllDone() {
    if (this.hasTimedOut || this.hasFailed) return;

    if (this.hasPendingRequiredTasks() || this.hasFailedRequiredTasks()) {
      return;
    }

    if (this.tasks.size === 0) {
      return;
    }

    if (!this.isReady) {
      this.isReady = true;

      for (const [, task] of this.tasks) {
        if (task.timerId) {
          clearTimeout(task.timerId);
          task.timerId = null;
        }
      }

      hideAppLoader(true);
      const callbacks = [...this.listeners];
      this.listeners = [];
      callbacks.forEach((fn) => {
        try { fn(); } catch (e) { console.error(e); }
      });
    }
  }

  reset() {
    for (const [, task] of this.tasks) {
      if (task.timerId) clearTimeout(task.timerId);
    }
    this.tasks.clear();
    this.isReady = false;
    this.hasTimedOut = false;
    this.hasFailed = false;
    this.listeners = [];
  }
}

export const initCoordinator = new AppInitCoordinator();

export function showAppLoader(text = 'Loading Bala Plumb Tech...') {
  let loader = document.getElementById('appLoader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'appLoader';
    loader.className = 'app-loader-overlay';
    loader.setAttribute('aria-live', 'polite');
    loader.setAttribute('aria-busy', 'true');
    loader.innerHTML = `
      <div class="app-loader-spinner" aria-hidden="true"></div>
      <div class="app-loader-brand">Bala Plumb Tech</div>
      <div class="app-loader-text">${escapeHtml(text)}</div>
    `;
    document.body.prepend(loader);
  } else {
    loader.classList.remove('fade-out');
    loader.setAttribute('aria-busy', 'true');
    const textEl = loader.querySelector('.app-loader-text');
    if (textEl && text) {
      textEl.textContent = text;
    }
  }
}

export function hideAppLoader(force = false) {
  // If not forced and coordinator still has pending required tasks, do NOT hide yet!
  if (!force && (initCoordinator.hasPendingRequiredTasks() || initCoordinator.hasFailedRequiredTasks() || !initCoordinator.isInitialized())) {
    return;
  }

  const loader = document.getElementById('appLoader');
  if (loader) {
    loader.setAttribute('aria-busy', 'false');
    loader.classList.add('fade-out');
    setTimeout(() => {
      if (loader && loader.classList.contains('fade-out') && loader.parentNode) {
        loader.remove();
      }
    }, 280);
  }
}
