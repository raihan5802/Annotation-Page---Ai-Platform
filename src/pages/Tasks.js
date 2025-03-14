import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './Tasks.css';

function Tasks() {
    const navigate = useNavigate();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadTasks = async () => {
            const userSession = localStorage.getItem('user');
            if (!userSession) {
                navigate('/signin');
                return;
            }

            const user = JSON.parse(userSession);
            try {
                const response = await fetch(`http://localhost:4000/api/tasks/${user.id}`);
                const data = await response.json();
                setTasks(data);
            } catch (error) {
                console.error('Error loading tasks:', error);
            } finally {
                setLoading(false);
            }
        };

        loadTasks();
    }, [navigate]);

    const handleContinueTask = async (task) => {
        try {
            // Load task files and annotations
            const filesResponse = await fetch(`http://localhost:4000/api/tasks/${task.task_id}/files`);
            if (!filesResponse.ok) {
                throw new Error('Failed to load task files');
            }
            const { files, annotations, labelClasses } = await filesResponse.json();

            // Ensure we have label classes, even if they're empty
            const validLabelClasses = labelClasses || [];

            // If there are no label classes but we need them for this task type, show a warning
            if (validLabelClasses.length === 0 &&
                (task.task_type === 'detection' ||
                    task.task_type === 'segmentation' ||
                    task.task_type === 'classification')) {
                console.warn('No label classes found for this task. You may need to add labels.');
            }

            const folderInfo = {
                taskId: task.task_id,
                folderId: task.folder_path.split('/').pop(),
                taskName: task.task_name,
                labelClasses: validLabelClasses,
                files: files,
                annotations: annotations  // Add this
            };

            // Determine which page to navigate to based on task_type
            if (task.task_type === 'segmentation') {
                navigate('/segmentation', { state: { folderInfo } });
            } else if (task.task_type === 'classification') {
                navigate('/classification', { state: { folderInfo } });
            } else {
                navigate('/detection', { state: { folderInfo } });
            }
        } catch (error) {
            console.error('Error continuing task:', error);
            alert('Failed to load task files. Please try again.');
        }
    };

    if (loading) {
        return <div>Loading tasks...</div>;
    }

    return (
        <div className="tasks-container">
            <UserHomeTopBar />
            <div className="tasks-content">
                <div className="search-bar-container">
                    <input type="text" placeholder="Search Tasks" className="search-input" />
                    <button className="new-btn">+ New Tasks</button>
                </div>
                <div className="tasks-grid">
                    {tasks.map((task) => (
                        <div key={task.task_id} className="task-card">
                            <h3>{task.task_name}</h3>
                            <p>Created: {new Date(task.created_at).toLocaleDateString()}</p>
                            <p>Status: {task.status}</p>
                            <button onClick={() => handleContinueTask(task)}>
                                Continue Task
                            </button>
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