import { signInWithEmail, signInWithGoogle, onAuthStateChanged, sendUserPasswordReset } from './auth.js';
import { isValidEmail } from '../utils/validation.js';

const loginForm = document.getElementById('loginForm');
const loginButton = document.getElementById('loginButton');
const loginError = document.getElementById('loginError');
const togglePassword = document.getElementById('togglePassword');
const passwordInput = document.getElementById('password');
const emailInput = document.getElementById('email');
const googleLoginButton = document.getElementById('googleLoginButton');
let isSigningIn = false;

function updateLoginButton() {
  loginButton.disabled = !emailInput.value.trim() || !passwordInput.value;
}

emailInput.addEventListener('input', updateLoginButton);
passwordInput.addEventListener('input', updateLoginButton);
updateLoginButton();

onAuthStateChanged((user) => {
  if (user && !isSigningIn) {
    window.location.href = './dashboard.html';
  }
});

function setLoading(isLoading) {
  loginButton.disabled = isLoading;
  const buttonText = loginButton.querySelector('.button-text');
  const spinner = loginButton.querySelector('.spinner');
  buttonText.textContent = isLoading ? 'Signing In...' : 'Login';
  spinner.classList.toggle('hidden', !isLoading);
}

function showError(message) {
  loginError.textContent = message;
  loginError.classList.remove('hidden');
}

function clearError() {
  loginError.textContent = '';
  loginError.classList.add('hidden');
}

function setGoogleLoading(isLoading) {
  googleLoginButton.disabled = isLoading;
  googleLoginButton.textContent = isLoading ? 'Opening Google...' : 'Continue with Google';
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    showError('Please enter both email and password.');
    return;
  }

  setLoading(true);
  isSigningIn = true;

  try {
    await signInWithEmail(email, password);
    window.location.href = './dashboard.html';
  } catch (error) {
    showError(error?.message || 'Unable to sign in. Please check your credentials.');
  } finally {
    setLoading(false);
    isSigningIn = false;
    updateLoginButton();
  }
});

googleLoginButton.addEventListener('click', async () => {
  clearError();
  setGoogleLoading(true);
  isSigningIn = true;

  try {
    await signInWithGoogle();
    window.location.href = './dashboard.html';
  } catch (error) {
    showError(error?.code === 'auth/popup-closed-by-user'
      ? 'Google sign-in was cancelled.'
      : error?.message || 'Unable to sign in with Google.');
  } finally {
    setGoogleLoading(false);
    isSigningIn = false;
  }
});

togglePassword.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePassword.textContent = isPassword ? 'Hide' : 'Show';
});

// Forgot Password Modal
const forgotPasswordBtn = document.getElementById('forgotPasswordBtn');
const forgotPasswordModal = document.getElementById('forgotPasswordModal');
const forgotPasswordForm = document.getElementById('forgotPasswordForm');
const resetEmailInput = document.getElementById('resetEmailInput');
const resetMessage = document.getElementById('resetMessage');
const sendResetLinkBtn = document.getElementById('sendResetLinkBtn');

function closeForgotModal() {
  forgotPasswordModal?.classList.add('hidden');
  forgotPasswordModal?.setAttribute('aria-hidden', 'true');
  forgotPasswordForm?.reset();
  if (resetMessage) {
    resetMessage.classList.add('hidden');
    resetMessage.textContent = '';
  }
}

forgotPasswordBtn?.addEventListener('click', () => {
  clearError();
  if (emailInput.value.trim() && resetEmailInput) {
    resetEmailInput.value = emailInput.value.trim();
  }
  if (resetMessage) {
    resetMessage.classList.add('hidden');
    resetMessage.textContent = '';
  }
  forgotPasswordModal?.classList.remove('hidden');
  forgotPasswordModal?.setAttribute('aria-hidden', 'false');
  setTimeout(() => resetEmailInput?.focus(), 50);
});

document.querySelectorAll('[data-close-modal="forgotPasswordModal"]').forEach((btn) => {
  btn.addEventListener('click', closeForgotModal);
});

forgotPasswordModal?.addEventListener('click', (e) => {
  if (e.target === forgotPasswordModal) closeForgotModal();
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && forgotPasswordModal && !forgotPasswordModal.classList.contains('hidden')) {
    closeForgotModal();
  }
});

forgotPasswordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = (resetEmailInput?.value || '').trim();

  if (!email || !isValidEmail(email)) {
    if (resetMessage) {
      resetMessage.textContent = 'Please enter a valid work email address.';
      resetMessage.style.background = '#fef2f2';
      resetMessage.style.color = 'var(--danger)';
      resetMessage.classList.remove('hidden');
    }
    resetEmailInput?.focus();
    return;
  }

  const originalText = sendResetLinkBtn?.textContent || 'Send Reset Link';
  if (sendResetLinkBtn) {
    sendResetLinkBtn.disabled = true;
    sendResetLinkBtn.textContent = 'Sending...';
  }

  try {
    await sendUserPasswordReset(email);
    if (resetMessage) {
      // Safe generic message to avoid email enumeration
      resetMessage.textContent = `If an account is associated with ${email}, a password reset link has been dispatched. Please check your inbox (and spam folder) within the next few minutes.`;
      resetMessage.style.background = '#f0fdf4';
      resetMessage.style.color = 'var(--success)';
      resetMessage.classList.remove('hidden');
    }
    if (resetEmailInput) resetEmailInput.value = '';
  } catch (err) {
    console.error('Password reset request error:', err);
    if (resetMessage) {
      if (err.code === 'auth/too-many-requests') {
        resetMessage.textContent = 'Too many requests. Please wait a few minutes before trying again.';
      } else {
        // Safe generic message for user security
        resetMessage.textContent = `If an account is associated with ${email}, a password reset link has been dispatched. Please check your inbox.`;
        resetMessage.style.background = '#f0fdf4';
        resetMessage.style.color = 'var(--success)';
      }
      resetMessage.classList.remove('hidden');
    }
  } finally {
    if (sendResetLinkBtn) {
      sendResetLinkBtn.disabled = false;
      sendResetLinkBtn.textContent = originalText;
    }
  }
});
