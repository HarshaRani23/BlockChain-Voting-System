// Check if user is already logged in
window.addEventListener('load', () => {
    const token = localStorage.getItem('voterToken');
    const isAdmin = localStorage.getItem('isAdmin') === 'true';

    if (token) {
        window.location.href = isAdmin ? '/admin.html' : '/voting.html';
    }
});

async function handleLogin(event) {
    event.preventDefault();

    const aadharNumber = document.getElementById('aadhar').value;
    const voterId = document.getElementById('voterId').value;
    const fullName = document.getElementById('fullName').value;

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                aadharNumber,
                voterId,
                fullName,
            }),
        });

        const data = await response.json();

        if (data.success) {
            localStorage.setItem('voterToken', data.token);
            localStorage.setItem('isAdmin', data.isAdmin);
            localStorage.setItem('aadharNumber', aadharNumber);

            window.location.href = data.isAdmin
                ? '/admin.html'
                : '/voting.html';
        } else {
            alert(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('Error during login. Please try again.');
    }
}

function logout() {
    localStorage.removeItem('voterToken');
    localStorage.removeItem('isAdmin');
    localStorage.removeItem('aadharNumber');
    window.location.href = '/';
}
