'use strict';

document.addEventListener('DOMContentLoaded', async () => {
    // Check auth
    try {
        const user = await window.authPromise;
        if (!user) { window.location.href = 'login.html'; return; }
        
        const displayName = user.name || user.username;
        document.getElementById('sidebar-name').textContent = displayName;
        document.getElementById('sidebar-email').textContent = user.email || '';
        document.getElementById('sidebar-avatar').textContent = displayName.charAt(0).toUpperCase();
    } catch (e) {
        window.location.href = 'login.html';
    }

    const form = document.getElementById('change-password-form');
    const msg = document.getElementById('password-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msg.style.display = 'none';

        const currentPassword = document.getElementById('current-password').value;
        const newPassword = document.getElementById('new-password').value;
        const confirmPassword = document.getElementById('confirm-password').value;

        if (newPassword.length < 5 || newPassword.length > 20) {
            msg.textContent = 'Password must be between 5 and 20 characters.';
            msg.style.color = 'var(--clr-danger)';
            msg.style.display = 'block';
            return;
        }

        if (newPassword !== confirmPassword) {
            msg.textContent = 'New passwords do not match.';
            msg.style.color = 'var(--clr-danger)';
            msg.style.display = 'block';
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/auth/change-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentPassword, newPassword })
            });

            const data = await res.json();
            
            if (res.ok) {
                msg.textContent = '✅ Password changed successfully.';
                msg.style.color = 'var(--clr-primary)';
                msg.style.display = 'block';
                form.reset();
            } else {
                msg.textContent = data.error || 'Failed to change password.';
                msg.style.color = 'var(--clr-danger)';
                msg.style.display = 'block';
            }
        } catch (err) {
            msg.textContent = 'Network error. Could not change password.';
            msg.style.color = 'var(--clr-danger)';
            msg.style.display = 'block';
        }
    });
});
