import { getAllUsers, getCurrentUserProfile, createEmployeeAccount, setEmployeeActiveStatus, setEmployeeRole, sendEmployeePasswordReset } from '../services/user-service.js';
import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { ROLE_LABELS } from '../utils/constants.js';
import { formatDate, escapeHtml, showToast, showAppLoader, hideAppLoader, initCoordinator } from '../utils/helpers.js';
import { initializeRouteGuard } from '../auth/route-guard.js';

let employeesList = [];
let pendingConfirmAction = null;

function renderEmployeeSkeletons() {
  const tbody = document.getElementById('employeesTableBody');
  if (!tbody) return;
  tbody.innerHTML = Array.from({ length: 4 }).map(() => `
    <tr>
      <td><span class="skeleton skeleton-text" style="width: 140px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 180px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 80px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 60px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 100px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 100px;">&nbsp;</span></td>
      <td><span class="skeleton skeleton-text" style="width: 120px;">&nbsp;</span></td>
    </tr>
  `).join('');
}

async function loadEmployees() {
  const user = getCurrentUser();
  if (!user) return;

  renderEmployeeSkeletons();

  try {
    employeesList = await getAllUsers();
  } catch (error) {
    console.error('Unable to load employees:', error);
    document.getElementById('employeesTableBody').innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <p>Employees could not be loaded. Check connection or Firestore rules.</p>
            <button id="retryEmployeesBtn" class="btn btn-secondary" style="margin-top: 8px;">Try Again</button>
          </div>
        </td>
      </tr>
    `;
    document.getElementById('retryEmployeesBtn')?.addEventListener('click', loadEmployees);
    return;
  }

  const currentUid = user.uid;
  const rows = employeesList.map((person) => {
    const isSelf = (person.id === currentUid || person.uid === currentUid);
    const isActive = person.active !== false;
    const displayName = escapeHtml(person.fullName || person.email || 'Unnamed');
    const safeEmail = escapeHtml(person.email || '');

    return `
      <tr>
        <td><strong>${displayName}</strong></td>
        <td>${safeEmail}</td>
        <td><span class="value-tag" style="font-size: 0.82rem; padding: 3px 8px;">${ROLE_LABELS[person.role] || person.role}</span></td>
        <td>
          <span class="status-pill ${isActive ? 'in-stock' : 'out-of-stock'}">
            ${isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td>${formatDate(person.createdAt)}</td>
        <td>${formatDate(person.updatedAt)}</td>
        <td>
          <div class="row-actions" style="display: flex; gap: 6px; flex-wrap: wrap;">
            ${isSelf ? `
              <span class="small-muted" style="font-weight: 500; padding: 4px 6px;">(Current User)</span>
            ` : `
              ${isActive ? `
                <button type="button" class="btn btn-secondary btn-sm" style="color: var(--danger);" data-deactivate-user="${person.id}" data-user-name="${displayName}">Deactivate</button>
              ` : `
                <button type="button" class="btn btn-secondary btn-sm" style="color: var(--success);" data-activate-user="${person.id}" data-user-name="${displayName}">Activate</button>
              `}
              <button type="button" class="btn btn-secondary btn-sm" data-edit-role="${person.id}" data-user-name="${displayName}" data-current-role="${person.role}">Role</button>
              <button type="button" class="btn btn-secondary btn-sm" data-reset-pw="${safeEmail}" data-user-name="${displayName}" title="Send Password Reset Email">Reset PW</button>
            `}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  document.getElementById('employeesTableBody').innerHTML = rows || '<tr><td colspan="7"><div class="empty-state">No employees found.</div></td></tr>';
}

// Modal handling
const employeeModal = document.getElementById('employeeModal');
const employeeForm = document.getElementById('employeeForm');
const employeeFormMessage = document.getElementById('employeeFormMessage');
const saveEmployeeButton = document.getElementById('saveEmployeeButton');

const confirmModal = document.getElementById('confirmModal');
const confirmModalMessage = document.getElementById('confirmModalMessage');
const confirmModalWarning = document.getElementById('confirmModalWarning');
const confirmActionBtn = document.getElementById('confirmActionBtn');

const roleModal = document.getElementById('roleModal');
const roleForm = document.getElementById('roleForm');
const roleUserIdInput = document.getElementById('roleUserId');
const roleUserSummary = document.getElementById('roleUserSummary');
const changeRoleSelect = document.getElementById('changeRoleSelect');
const roleFormError = document.getElementById('roleFormError');
const saveRoleBtn = document.getElementById('saveRoleBtn');

document.getElementById('addEmployeeButton')?.addEventListener('click', () => {
  employeeFormMessage?.classList.add('hidden');
  employeeModal?.classList.remove('hidden');
  employeeModal?.setAttribute('aria-hidden', 'false');
});

function closeAnyModal(modalId) {
  const modal = document.getElementById(modalId);
  modal?.classList.add('hidden');
  modal?.setAttribute('aria-hidden', 'true');
}

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    closeAnyModal(button.dataset.closeModal);
  });
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeAnyModal('employeeModal');
    closeAnyModal('confirmModal');
    closeAnyModal('roleModal');
  }
});

[employeeModal, confirmModal, roleModal].forEach((modal) => {
  modal?.addEventListener('click', (event) => {
    if (event.target === modal) closeAnyModal(modal.id);
  });
});

// Employee Table Actions Delegation
const tbody = document.getElementById('employeesTableBody');
tbody?.addEventListener('click', async (event) => {
  // Deactivate
  const deactBtn = event.target.closest('[data-deactivate-user]');
  if (deactBtn) {
    const userId = deactBtn.dataset.deactivateUser;
    const userName = deactBtn.dataset.userName;
    openConfirmDialog({
      title: 'Deactivate Employee',
      message: `Are you sure you want to deactivate <strong>${userName}</strong>? They will immediately lose access to the system and be blocked from reading or writing inventory data.`,
      confirmButtonText: 'Deactivate Account',
      confirmButtonClass: 'btn btn-danger',
      onConfirm: async () => {
        await setEmployeeActiveStatus(userId, false);
        showToast(`Account for ${userName} has been deactivated.`, 'info');
        await loadEmployees();
      }
    });
    return;
  }

  // Activate
  const actBtn = event.target.closest('[data-activate-user]');
  if (actBtn) {
    const userId = actBtn.dataset.activateUser;
    const userName = actBtn.dataset.userName;
    openConfirmDialog({
      title: 'Activate Employee',
      message: `Are you sure you want to activate <strong>${userName}</strong>? They will be granted access to log in and manage inventory according to their assigned role.`,
      confirmButtonText: 'Activate Account',
      confirmButtonClass: 'btn btn-primary',
      onConfirm: async () => {
        await setEmployeeActiveStatus(userId, true);
        showToast(`Account for ${userName} has been activated.`, 'success');
        await loadEmployees();
      }
    });
    return;
  }

  // Edit Role
  const roleBtn = event.target.closest('[data-edit-role]');
  if (roleBtn) {
    const userId = roleBtn.dataset.editRole;
    const userName = roleBtn.dataset.userName;
    const currentRole = roleBtn.dataset.currentRole || 'EMPLOYEE';

    roleUserIdInput.value = userId;
    roleUserSummary.textContent = `Editing role for: ${userName}`;
    changeRoleSelect.value = currentRole;
    roleFormError?.classList.add('hidden');
    if (roleFormError) roleFormError.textContent = '';

    roleModal?.classList.remove('hidden');
    roleModal?.setAttribute('aria-hidden', 'false');
    return;
  }

  // Reset Password
  const resetBtn = event.target.closest('[data-reset-pw]');
  if (resetBtn) {
    const email = resetBtn.dataset.resetPw;
    const userName = resetBtn.dataset.userName;
    if (!email) {
      showToast('No email address available for this user.', 'error');
      return;
    }

    openConfirmDialog({
      title: 'Send Password Reset Email',
      message: `Send an official Firebase password reset link to <strong>${email}</strong> (${userName})?`,
      confirmButtonText: 'Send Reset Email',
      confirmButtonClass: 'btn btn-primary',
      onConfirm: async () => {
        await sendEmployeePasswordReset(email);
        showToast(`Password reset link sent to ${email}.`, 'success');
      }
    });
    return;
  }
});

function openConfirmDialog({ title, message, confirmButtonText, confirmButtonClass, onConfirm }) {
  const titleNode = document.getElementById('confirmModalTitle');
  if (titleNode) titleNode.textContent = title;
  if (confirmModalMessage) confirmModalMessage.innerHTML = message;
  if (confirmModalWarning) confirmModalWarning.classList.add('hidden');
  if (confirmActionBtn) {
    confirmActionBtn.textContent = confirmButtonText || 'Confirm';
    confirmActionBtn.className = confirmButtonClass || 'btn btn-danger';
    confirmActionBtn.disabled = false;
  }

  pendingConfirmAction = onConfirm;
  confirmModal?.classList.remove('hidden');
  confirmModal?.setAttribute('aria-hidden', 'false');
}

confirmActionBtn?.addEventListener('click', async () => {
  if (!pendingConfirmAction) return;

  const originalText = confirmActionBtn.textContent;
  confirmActionBtn.disabled = true;
  confirmActionBtn.textContent = 'Processing...';
  if (confirmModalWarning) confirmModalWarning.classList.add('hidden');

  try {
    await pendingConfirmAction();
    closeAnyModal('confirmModal');
    pendingConfirmAction = null;
  } catch (err) {
    console.error('Action error:', err);
    if (confirmModalWarning) {
      confirmModalWarning.textContent = err.message || 'Operation failed. Please try again.';
      confirmModalWarning.classList.remove('hidden');
    }
  } finally {
    confirmActionBtn.disabled = false;
    confirmActionBtn.textContent = originalText;
  }
});

// Role form submission
roleForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const userId = roleUserIdInput.value;
  const newRole = changeRoleSelect.value;

  roleFormError?.classList.add('hidden');
  if (roleFormError) roleFormError.textContent = '';
  saveRoleBtn.disabled = true;
  saveRoleBtn.textContent = 'Updating...';

  try {
    await setEmployeeRole(userId, newRole);
    closeAnyModal('roleModal');
    showToast(`Role updated to ${newRole}.`, 'success');
    await loadEmployees();
  } catch (err) {
    console.error('Role update error:', err);
    if (roleFormError) {
      roleFormError.textContent = err.message || 'Unable to update role.';
      roleFormError.classList.remove('hidden');
    }
  } finally {
    saveRoleBtn.disabled = false;
    saveRoleBtn.textContent = 'Update Role';
  }
});

// Add Employee form submission
employeeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  employeeFormMessage?.classList.add('hidden');
  saveEmployeeButton.disabled = true;
  saveEmployeeButton.textContent = 'Creating...';

  const formData = new FormData(employeeForm);
  try {
    await createEmployeeAccount({
      fullName: String(formData.get('fullName')).trim(),
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password')),
      role: String(formData.get('role'))
    });
    employeeForm.reset();
    closeAnyModal('employeeModal');
    showToast('Employee account created successfully.', 'success');
    await loadEmployees();
  } catch (error) {
    if (employeeFormMessage) {
      employeeFormMessage.textContent = error.code === 'auth/email-already-in-use'
        ? 'That email already has a Firebase account.'
        : error.message || 'Unable to create the account.';
      employeeFormMessage.classList.remove('hidden');
    }
  } finally {
    saveEmployeeButton.disabled = false;
    saveEmployeeButton.textContent = 'Create Account';
  }
});

initCoordinator.register('pageData', { required: true, description: 'Employee management data' });

initializeRouteGuard({ allowedRoles: ['OWNER'] })
  .then(async (auth) => {
    if (!auth) {
      initCoordinator.cancel('pageData');
      return;
    }
    try {
      showAppLoader('Verifying owner access & loading employees...');
      await loadEmployees();
    } catch (error) {
      console.error('Unable to load employees:', error);
    } finally {
      initCoordinator.complete('pageData');
    }
  })
  .catch((error) => {
    console.error('Employees initialization error:', error);
    initCoordinator.fail('pageData', error);
  });
