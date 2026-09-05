import { getAllUsers, getCurrentUserProfile, createEmployeeAccount } from '../services/user-service.js';
import { getCurrentUser, onAuthStateChanged } from '../auth/auth.js';
import { ROLE_LABELS } from '../utils/constants.js';
import { formatDate } from '../utils/helpers.js';

async function loadEmployees() {
  const user = getCurrentUser();
  if (!user) return;

  let list;
  try {
    list = await getAllUsers();
  } catch (error) {
    console.error('Unable to load employees:', error);
    document.getElementById('employeesTableBody').innerHTML = '<tr><td colspan="6"><div class="empty-state">Employees could not be loaded. Check Firestore rules.</div></td></tr>';
    return;
  }
  const rows = list.map((person) => `
    <tr>
      <td>${person.fullName || person.email}</td>
      <td>${person.email}</td>
      <td>${ROLE_LABELS[person.role] || person.role}</td>
      <td>${person.active === false ? 'Inactive' : 'Active'}</td>
      <td>${formatDate(person.createdAt)}</td>
      <td>${formatDate(person.updatedAt)}</td>
    </tr>
  `).join('');

  document.getElementById('employeesTableBody').innerHTML = rows || '<tr><td colspan="6"><div class="empty-state">No employees found.</div></td></tr>';
}

const employeeModal = document.getElementById('employeeModal');
const employeeForm = document.getElementById('employeeForm');
const employeeFormMessage = document.getElementById('employeeFormMessage');
const saveEmployeeButton = document.getElementById('saveEmployeeButton');

document.getElementById('addEmployeeButton')?.addEventListener('click', () => {
  employeeFormMessage.classList.add('hidden');
  employeeModal.classList.remove('hidden');
  employeeModal.setAttribute('aria-hidden', 'false');
});

document.querySelectorAll('[data-close-modal]').forEach((button) => {
  button.addEventListener('click', () => {
    const modal = document.getElementById(button.dataset.closeModal);
    modal?.classList.add('hidden');
    modal?.setAttribute('aria-hidden', 'true');
  });
});

employeeForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  employeeFormMessage.classList.add('hidden');
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
    employeeModal.classList.add('hidden');
    await loadEmployees();
  } catch (error) {
    employeeFormMessage.textContent = error.code === 'auth/email-already-in-use'
      ? 'That email already has a Firebase account.'
      : error.message || 'Unable to create the account.';
    employeeFormMessage.classList.remove('hidden');
  } finally {
    saveEmployeeButton.disabled = false;
    saveEmployeeButton.textContent = 'Create Account';
  }
});

onAuthStateChanged((user) => {
  if (!user) {
    window.location.href = './login.html';
    return;
  }
  getCurrentUserProfile(user.uid).then((profile) => {
    if (profile?.role !== 'OWNER') {
      window.location.href = './dashboard.html';
      return;
    }
    loadEmployees();
  }).catch((error) => {
    console.error('Unable to verify employee-management access:', error);
    window.location.href = './dashboard.html';
  });
});
