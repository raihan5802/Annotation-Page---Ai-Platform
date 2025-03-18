// src/pages/TaskInfo.js
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import SelectedFilesTree from '../components/SelectedFilesTree';
import './TaskInfo.css';

export default function TaskInfo() {
    const { taskId } = useParams();
    const navigate = useNavigate();
    const [task, setTask] = useState(null);

    // Fetch the task by ID
    useEffect(() => {
        fetch('http://localhost:4000/api/tasks')
            .then(res => res.json())
            .then(data => {
                const foundTask = data.find(t => t.task_id === taskId);
                setTask(foundTask);
            })
            .catch(err => console.error(err));
    }, [taskId]);

    // Helpers to build a tree structure from selected_files string
    const buildTreeFromPaths = (paths) => {
        const tree = {};
        paths.forEach((pathStr) => {
            const parts = pathStr.split('/');
            let currentLevel = tree;
            parts.forEach((part) => {
                if (!currentLevel[part]) {
                    currentLevel[part] = {};
                }
                currentLevel = currentLevel[part];
            });
        });
        return tree;
    };

    const convertToTreeNode = (obj, name = 'root') => {
        const children = Object.keys(obj).map((key) =>
            convertToTreeNode(obj[key], key)
        );
        return { name, children };
    };

    const treeData = useMemo(() => {
        if (!task || !task.selected_files) return null;
        const selectedFilesArray = task.selected_files.split(';').filter(Boolean);
        const treeObject = buildTreeFromPaths(selectedFilesArray);
        return convertToTreeNode(treeObject, 'Selected Files');
    }, [task]);

    // Function to create a new job
    const handleCreateJob = async () => {
        const userSession = JSON.parse(localStorage.getItem('user'));
        if (!userSession) {
            alert("User not logged in");
            return;
        }
        try {
            const res = await fetch('http://localhost:4000/api/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: userSession.id,
                    taskId: task.task_id,
                    projectId: task.project_id
                })
            });
            if (res.ok) {
                const data = await res.json();
                alert("Job created successfully with job id: " + data.jobId);
                navigate('/jobs');
            } else {
                const errorData = await res.json();
                alert("Error creating job: " + errorData.error);
            }
        } catch (err) {
            console.error(err);
            alert("Error creating job");
        }
    };

    if (!task) {
        return (
            <div>
                <UserHomeTopBar />
                <div>Loading...</div>
            </div>
        );
    }

    return (
        <div className="task-info-page">
            <UserHomeTopBar />
            <div className="task-info-container">
                <h2>Tasks Information</h2>
                <p><strong>Task Name:</strong> {task.task_name}</p>
                <p><strong>Selected Project:</strong> {task.project_name}</p>
                <p><strong>Annotation Type:</strong> {task.annotation_type}</p>
                <div className="selected-files-section">
                    <strong>Selected Files:</strong>
                    {treeData ? (
                        <SelectedFilesTree node={treeData} />
                    ) : (
                        <p>No selected files</p>
                    )}
                </div>
                <button className="create-job-btn" onClick={handleCreateJob}>
                    + create new job
                </button>
            </div>
        </div>
    );
}
