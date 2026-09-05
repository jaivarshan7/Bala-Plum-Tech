import { signInWithEmail, signInWithGoogle, onAuthStateChanged } from './auth.js';

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
