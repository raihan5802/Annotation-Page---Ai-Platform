// src/pages/SignIn.js
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './SignIn.css';

function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate();

    const handleSignIn = async () => {
        if (email && password) {
            try {
                const res = await fetch('http://localhost:4000/api/signin', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });
                const data = await res.json();
                if (data.user) {
                    localStorage.setItem('user', JSON.stringify(data.user));

                    const redirectInfo = localStorage.getItem('redirectAfterLogin');
                    if (redirectInfo) {
                        const { path, state } = JSON.parse(redirectInfo);
                        localStorage.removeItem('redirectAfterLogin');
                        navigate(path, { state });
                    } else {
                        navigate('/userhome');
                    }
                } else {
                    alert('Invalid email or password');
                }
            } catch (err) {
                console.error('Error signing in:', err);
                alert('Error signing in. Please try again.');
            }
        } else {
            alert('Please enter a valid email and password.');
        }
    };

    return (
        <div className="signin-container">
            <h2>Sign In</h2>
            <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
            />
            <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <button onClick={handleSignIn}>Sign In</button>
            <p>
                Don't have an account?{' '}
                <span onClick={() => navigate('/signup')}>Sign Up</span>
            </p>
        </div>
    );
}

export default SignIn;