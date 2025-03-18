// src/pages/Projects.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Projects.css';

export default function Projects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        const fetchProjects = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/projects');
                if (res.ok) {
                    const data = await res.json();
                    setProjects(data);
                } else {
                    console.error('Failed to fetch projects');
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            }
        };
        fetchProjects();
    }, []);

    const filteredProjects = projects.filter(proj =>
        proj.project_name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="projects-page">
            <UserHomeTopBar />
            <div className="search-bar-container">
                <input
                    type="text"
                    placeholder="Search Projects"
                    className="search-input"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
                <button
                    className="new-btn"
                    onClick={() => navigate('/images', { state: { projectMode: true } })}
                >
                    + New Project
                </button>
            </div>
            <div className="projects-grid">
                {filteredProjects.map((proj) => (
                    <div
                        key={proj.project_id}
                        className="project-card"
                        onClick={() => navigate(`/project-info/${proj.project_id}`)}
                    >
                        <div className="project-heading">
                            {proj.project_name}
                        </div>
                        <div className="project-image">
                            <img
                                src={proj.thumbnailImage || `http://localhost:4000/${proj.folder_path}/default.jpg`}
                                alt={proj.project_name}
                            />
                        </div>
                    </div>
                ))}
                {filteredProjects.length === 0 && (
                    <p>No projects found. Create a new project to get started!</p>
                )}
            </div>
        </div>
    );
}
