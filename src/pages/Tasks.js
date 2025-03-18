// src/pages/Tasks.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Tasks.css';

function Tasks() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loadingThumbnails, setLoadingThumbnails] = useState(false);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/tasks');
                if (res.ok) {
                    const data = await res.json();
                    // For each task, use the first folder from selected_files to get a thumbnail.
                    setLoadingThumbnails(true);
                    const updatedTasks = await Promise.all(
                        data.map(async (task) => {
                            // Split the semicolon-separated selected_files and filter out any empty strings.
                            const folderPaths = task.selected_files.split(';').filter(Boolean);
                            if (folderPaths.length > 0) {
                                const chosenFolder = folderPaths[0]; // use the first folder
                                try {
                                    const imageRes = await fetch(
                                        `http://localhost:4000/api/first-image?folderPath=${encodeURIComponent(chosenFolder)}`
                                    );
                                    if (imageRes.ok) {
                                        const imageData = await imageRes.json();
                                        task.thumbnailUrl = `http://localhost:4000/${imageData.imageUrl}`;
                                    } else {
                                        task.thumbnailUrl = 'http://localhost:4000/default.jpg';
                                    }
                                } catch (error) {
                                    console.error('Error fetching thumbnail for task', task.task_id, error);
                                    task.thumbnailUrl = 'http://localhost:4000/default.jpg';
                                }
                            } else {
                                task.thumbnailUrl = 'http://localhost:4000/default.jpg';
                            }
                            return task;
                        })
                    );
                    setTasks(updatedTasks);
                    setLoadingThumbnails(false);
                } else {
                    console.error('Failed to fetch tasks');
                }
            } catch (error) {
                console.error('Error fetching tasks:', error);
            }
        };

        fetchTasks();
    }, []);

    if (loadingThumbnails) {
        return <div>Loading tasks...</div>;
    }

    return (
        <div className="tasks-container">
            <UserHomeTopBar />
            <div className="tasks-content">
                <div className="search-bar-container">
                    <input type="text" placeholder="Search Tasks" className="search-input" />
                    <button className="new-btn" onClick={() => navigate('/tasks-image-home')}>
                        + New Tasks
                    </button>
                </div>
                <div className="tasks-grid">
                    {tasks.map((task) => (
                        <div
                            key={task.task_id}
                            className="task-card"
                            onClick={() => navigate(`/task-info/${task.task_id}`)}
                        >
                            <div className="task-heading">{task.task_name}</div>
                            <div className="task-image">
                                <img src={task.thumbnailUrl} alt={task.task_name} />
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && (
                        <p>No tasks found. Create a new task to get started!</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default Tasks;
