const status = document.querySelector('#account-status');
const home = 'https://2000sretrochat.github.io/retrochat/';
async function loadAccount() {
  try {
    const response = await fetch('/api/me', { cache: 'no-store' });
    if (!response.ok) throw Error();
    const { name } = await response.json();
    if (!name) {
      status.textContent = 'Sign in or create a Razzle account to get started.';
      document.querySelector('#guest-actions').hidden = false;
      return;
    }
    document.querySelector('#account-title').textContent = '@' + name;
    status.textContent = 'You’re signed in. Use this account for Razzle Chat and Messenger.';
    document.querySelector('#profile-link').href = home + '?profile=' + encodeURIComponent(name.toLowerCase());
    document.querySelector('#account-actions').hidden = false;
  } catch { status.textContent = 'Account service is temporarily unavailable. Please refresh to try again.'; }
}
document.querySelector('#sign-out').addEventListener('click', async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (!response.ok) throw Error();
    location.replace(home);
  } catch { status.textContent = 'Could not sign out. Try again.'; button.disabled = false; }
});
loadAccount();