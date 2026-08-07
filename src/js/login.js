document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    // Create the payload object
    const payload = { email, password };

    // LOG FRONTEND JSON TO CONSOLE
    console.log("1. Frontend Payload (JS Object):", payload);
    console.log("2. Frontend Payload (JSON String):", JSON.stringify(payload));

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify(payload)
      });

      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      console.log("3. Backend Response Received:", data);

      if (response.ok) {
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
        }
        window.location.href = '/dashboard.html';
      } else {
        alert(data.message || data.error || `Login failed (Status: ${response.status})`);
      }
    } catch (err) {
      console.error('Login error:', err);
      alert('An error occurred while connecting to the server.');
    }
  });
});