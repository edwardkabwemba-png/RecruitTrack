document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ email, password })
      });

      // Safely check for empty response bodies
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (response.ok) {
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = '/dashboard.html';
      } else {
        alert(data.message || data.error || `Login failed (Status Code: ${response.status})`);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred while parsing the server response.');
    }
  });
});