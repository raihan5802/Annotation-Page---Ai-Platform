// src/pages/TasksImageHome.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import FolderTreeCheckbox from '../components/FolderTreeCheckbox';
import './TasksImageHome.css';

export default function TasksImageHome() {
    const navigate = useNavigate();
    const location = useLocation();
    const [userSession, setUserSession] = useState(null);
    const [projects, setProjects] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [taskName, setTaskName] = useState('');
    const [annotationType, setAnnotationType] = useState('all');
    const [annotationOptions, setAnnotationOptions] = useState([]);
    const [folderTree, setFolderTree] = useState(null);
    const [selectedFolders, setSelectedFolders] = useState({});

    // Check for user session (same as in ImageHome.js)
    useEffect(() => {
        const session = localStorage.getItem('user');
        if (!session) {
            localStorage.setItem('redirectAfterLogin', JSON.stringify({
                path: '/tasks-image-home',
                state: location.state
            }));
            navigate('/signin');
            return;
        }
        setUserSession(JSON.parse(session));
    }, [navigate, location.state]);

    // Fetch projects on mount
    useEffect(() => {
        fetch('http://localhost:4000/api/projects')
            .then((res) => res.json())
            .then((data) => {
                setProjects(data);
                if (data.length > 0) {
                    setSelectedProject(data[0].project_id);
                }
            })
            .catch((err) => console.error(err));
    }, []);

    // Set annotation options and fetch folder tree when selected project changes
    useEffect(() => {
        if (selectedProject) {
            const project = projects.find((p) => p.project_id === selectedProject);
            if (project) {
                // Normalize project type for comparison
                let normalizedType = project.project_type.trim().toLowerCase();
                let options = ["all"];
                if (normalizedType === "image detection") {
                    options = ["all", "bounding box", "polygon", "polyline", "points", "circle"];
                } else if (normalizedType === "image segmentation") {
                    options = ["all", "polygon", "instance segmentation", "semantics segmentation", "panoptic segmentation"];
                } else if (normalizedType === "image classification") {
                    options = ["all", "single class", "multi class"];
                } else if (normalizedType === "3d image annotation") {
                    options = ["all", "cuboid"];
                }
                setAnnotationOptions(options);
                setAnnotationType("all");

                // Fetch folder structure using folderId extracted from project.folder_path (assumed format: "uploads/{folderId}")
                const parts = project.folder_path.split('/');
                const folderId = parts[1];
                fetch(`http://localhost:4000/api/folder-structure/${folderId}`)
                    .then((res) => res.json())
                    .then((data) => {
                        setFolderTree(data);
                    })
                    .catch((err) => console.error(err));
            }
        }
    }, [selectedProject, projects]);

    // Handle checkbox changes from FolderTreeCheckbox component
    const handleFolderSelection = (folderPath, isSelected) => {
        setSelectedFolders((prev) => ({
            ...prev,
            [folderPath]: isSelected,
        }));
    };

    const handleNewTask = async () => {
        // Validate that none of the fields are empty
        if (!taskName.trim()) {
            alert("Task Name is required");
            return;
        }
        if (!selectedProject) {
            alert("Project selection is required");
            return;
        }
        if (!annotationType) {
            alert("Annotation Type is required");
            return;
        }
        // Ensure at least one folder is selected
        const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
        if (selectedFolderPaths.length === 0) {
            alert("At least one folder must be selected");
            return;
        }

        // Use the logged-in user from localStorage
        const userId = userSession.id;
        // Find project details to get the project name
        const project = projects.find(p => p.project_id === selectedProject);
        const projectName = project ? project.project_name : "";

        const payload = {
            userId,
            projectId: selectedProject,
            taskName: taskName.trim(),
            projectName,
            annotationType,
            selectedFolders
        };

        try {
            const res = await fetch('http://localhost:4000/api/tasks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                const data = await res.json();
                alert("Task created successfully with id: " + data.taskId);
                navigate('/tasks');
            } else {
                const errorData = await res.json();
                alert("Error creating task: " + errorData.error);
            }
        } catch (err) {
            console.error(err);
            alert("Error creating task");
        }
    };

    return (
        <div className="tasks-image-home-page">
            <UserHomeTopBar />
            <div className="tasks-image-home-container">
                <h2>Create New Task</h2>
                <div className="form-group">
                    <label>Task Name:</label>
                    <input
                        type="text"
                        placeholder="Enter task name"
                        value={taskName}
                        onChange={(e) => setTaskName(e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label>Select Project:</label>
                    <select
                        value={selectedProject}
                        onChange={(e) => setSelectedProject(e.target.value)}
                    >
                        {projects.map((project) => (
                            <option key={project.project_id} value={project.project_id}>
                                {project.project_name}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="form-group">
                    <label>Annotation Type:</label>
                    <select
                        value={annotationType}
                        onChange={(e) => setAnnotationType(e.target.value)}
                    >
                        {annotationOptions.map((option, index) => (
                            <option key={index} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="folder-tree-section">
                    <h3>Select Folders</h3>
                    {folderTree ? (
                        <FolderTreeCheckbox
                            node={folderTree}
                            onToggle={handleFolderSelection}
                        />
                    ) : (
                        <p>No folder structure available.</p>
                    )}
                </div>
                <button className="new-task-btn" onClick={handleNewTask}>
                    + create new task
                </button>
            </div>
        </div>
    );
}
