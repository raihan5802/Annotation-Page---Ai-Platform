// src/pages/Jobs.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Jobs.css';

export default function Jobs() {
    const navigate = useNavigate();
    const [jobs, setJobs] = useState([]);
    const [tasks, setTasks] = useState([]);
    const [projects, setProjects] = useState([]);

    useEffect(() => {
        // Fetch jobs
        const fetchJobs = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/jobs');
                if (res.ok) {
                    const data = await res.json();
                    setJobs(data);
                } else {
                    console.error('Failed to fetch jobs');
                }
            } catch (error) {
                console.error('Error fetching jobs:', error);
            }
        };

        // Fetch tasks
        const fetchTasks = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/tasks');
                if (res.ok) {
                    const data = await res.json();
                    setTasks(data);
                } else {
                    console.error('Failed to fetch tasks');
                }
            } catch (error) {
                console.error('Error fetching tasks:', error);
            }
        };

        // Fetch projects
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

        fetchJobs();
        fetchTasks();
        fetchProjects();
    }, []);

    // Combine job with its corresponding task and project info.
    // Also include annotation_type from task.
    const combinedJobs = jobs.map(job => {
        const task = tasks.find(t => t.task_id === job.task_id) || {};
        const project = projects.find(p => p.project_id === job.project_id) || {};
        return {
            ...job,
            taskName: task.task_name || '',
            projectName: project.project_name || '',
            projectType: project.project_type || '',
            annotation_type: task.annotation_type || ''
        };
    });

    const handleContinueAnnotating = (job) => {
        // Safely get annotation type and project type.
        const annType = job.annotation_type ? job.annotation_type.trim().toLowerCase() : '';
        const projType = job.projectType ? job.projectType.trim().toLowerCase() : '';

        let redirectPath = `/task-info/${job.task_id}`; // Default fallback

        if (annType === 'all') {
            if (projType === 'image detection') {
                redirectPath = '/detection';
            } else if (projType === 'image segmentation') {
                redirectPath = '/segmentation';
            } else if (projType === 'image classification') {
                redirectPath = '/classification';
            } else if (projType === '3d image annotation') {
                redirectPath = '/3d';
            }
        }
        navigate(redirectPath, { state: { taskId: job.task_id } });

    };

    return (
        <div className="jobs-page">
            <UserHomeTopBar />
            <div className="search-bar-container">
                <input type="text" placeholder="Search Jobs" className="search-input" />
            </div>
            <div className="jobs-list">
                {combinedJobs.length > 0 ? (
                    combinedJobs.map(job => (
                        <div key={job.job_id} className="job-card">
                            <div className="job-info">
                                <p><strong>Project:</strong> {job.projectName}</p>
                                <p><strong>Task:</strong> {job.taskName}</p>
                                <p><strong>Job ID:</strong> {job.job_id}</p>
                                <p><strong>Progress:</strong> {job.progress}%</p>
                            </div>
                            <button
                                className="continue-btn"
                                onClick={() => handleContinueAnnotating(job)}
                            >
                                Continue Annotating
                            </button>
                        </div>
                    ))
                ) : (
                    <p>No jobs found.</p>
                )}
            </div>
        </div>
    );
}
