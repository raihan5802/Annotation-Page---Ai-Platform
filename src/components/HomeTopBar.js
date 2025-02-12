import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './HomeTopBar.css';

function HomeTopBar() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setUser(storedUser);
        }

        // Add click outside listener
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSignOut = () => {
        localStorage.removeItem('user');
        setUser(null);
        setIsDropdownOpen(false);
        navigate('/');  // Navigate to home page instead of signin
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    return (
        <div className="home-topbar">
            <div className="logo">AI Platform</div>
            <div className="menu">
                <div className="menu-item">
                    <span>Product</span>
                </div>
                <div className="menu-item">
                    <span>Pricing</span>
                </div>
                <div className="menu-item">
                    <span>Resources</span>
                </div>
                <div className="menu-item">
                    <span>Company</span>
                </div>
            </div>
            <div className="user-section">
                {user ? (
                    <div
                        ref={dropdownRef}
                        className={`user-info ${isDropdownOpen ? 'active' : ''}`}
                    >
                        <span onClick={toggleDropdown}>{user.username}</span>
                        {isDropdownOpen && (
                            <div className="dropdown">
                                <div className="dropdown-item">Account</div>
                                <div className="dropdown-item" onClick={() => navigate('/tasks')}>Tasks</div>
                                <div className="dropdown-item" onClick={handleSignOut}>
                                    Logout
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <span onClick={() => navigate('/signin')}>Sign In</span>
                )}
            </div>
        </div>
    );
}

export default HomeTopBar;