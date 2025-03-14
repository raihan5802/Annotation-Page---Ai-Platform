// src/pages/Jobs.js
import React from 'react';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Jobs.css';

export default function Jobs() {
    return (
        <div className="jobs-page">
            <UserHomeTopBar />
            <div className="search-bar-container">
                <input type="text" placeholder="Search Jobs" className="search-input" />
                <button className="new-btn">+ New Jobs</button>
            </div>
            {/* Placeholder for jobs list */}
            <div className="content">
                <p>Jobs list goes here...</p>
            </div>
        </div>
    );
}
