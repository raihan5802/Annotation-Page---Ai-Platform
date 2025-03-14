import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './HomeTopBar.css';

function HomeTopBar({
    taskName,
    onPrev,
    onNext,
    onSave,
    onZoomIn,
    onZoomOut,
    onExport,
    currentIndex,
    total,
    showControls = false, // New prop to determine if we show the annotation controls
    isSaving = false
}) {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const storedUser = JSON.parse(localStorage.getItem('user'));
        if (storedUser) {
            setUser(storedUser);
        }

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
        navigate('/');
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
    };

    // Regular menu items for home/images pages
    const regularMenu = (
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
    );

    // Task name and controls for annotation pages
    const annotationMenu = (
        <div className="menu annotation-menu">
            {taskName && <div className="task-name">Task: {taskName}</div>}
        </div>
    );

    return (
        <div className="home-topbar">
            <div className="logo" onClick={() => navigate('/')}>AI Platform</div>

            {/* Show different menu based on page */}
            {showControls ? annotationMenu : regularMenu}

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