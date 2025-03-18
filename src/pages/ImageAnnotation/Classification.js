// src/pages/Classification.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../../components/UserHomeTopBar';
import './Classification.css';

export default function Classification() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const taskId = state?.taskId;

    if (!taskId) {
        return (
            <div className="classification-container">
                <h2>No task id provided. Please create a task first.</h2>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    // State for task and project data, file list and folder paths
    const [taskData, setTaskData] = useState(null);
    const [projectData, setProjectData] = useState(null);
    const [filesList, setFilesList] = useState([]);
    const [taskFolderPaths, setTaskFolderPaths] = useState([]);

    // Other states (deleting/uploading, selection, annotations, etc.)
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

    // Selected status per image (keyed by file URL)
    const [selected, setSelected] = useState({});
    const [localLabelClasses, setLocalLabelClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState('');

    // Classification annotations: mapping file URL to assigned label
    const [annotations, setAnnotations] = useState({});

    // Modal state for assigning a class and for adding a new label
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showAddLabelModal, setShowAddLabelModal] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#ff0000');
    const [statusMessage, setStatusMessage] = useState('');

    // NEW: Modal state for uploading new image(s)
    const [showAddImageModal, setShowAddImageModal] = useState(false);
    const [newFiles, setNewFiles] = useState(null);
    const [selectedAddFolder, setSelectedAddFolder] = useState("");

    const fileInputRef = useRef(null);

    // Helper: show status message
    const showMessage = (message) => {
        setStatusMessage(message);
        setTimeout(() => {
            setStatusMessage('');
        }, 3000);
    };

    // Helper: extract files from folder tree recursively
    const extractFilesFromTree = (node, basePath) => {
        let files = [];
        if (node.type === 'file') {
            const url = `http://localhost:4000/uploads/${basePath}/${node.name}`;
            files.push({ originalname: node.name, url });
        } else if (node.type === 'folder' && node.children) {
            const baseParts = basePath.split('/');
            const lastSegment = baseParts[baseParts.length - 1];
            const newBasePath = (node.name === lastSegment) ? basePath : basePath + '/' + node.name;
            node.children.forEach(child => {
                files = files.concat(extractFilesFromTree(child, newBasePath));
            });
        }
        return files;
    };

    // Fetch task and project data based on taskId
    useEffect(() => {
        fetch('http://localhost:4000/api/tasks')
            .then(res => res.json())
            .then(tasks => {
                const task = tasks.find(t => t.task_id === taskId);
                if (!task) {
                    alert("Task not found.");
                    navigate('/userhome');
                    return;
                }
                setTaskData(task);
                const folderPaths = task.selected_files.split(';').filter(x => x);
                setTaskFolderPaths(folderPaths);
                fetch('http://localhost:4000/api/projects')
                    .then(res => res.json())
                    .then(projects => {
                        const project = projects.find(p => p.project_id === task.project_id);
                        if (!project) {
                            alert("Project not found.");
                            navigate('/userhome');
                            return;
                        }
                        setProjectData(project);
                        setLocalLabelClasses(project.label_classes || []);
                        if (project.label_classes && project.label_classes.length > 0) {
                            setSelectedClass(project.label_classes[0].name);
                        }
                        // Fetch files from each folder structure
                        const fetchFolderPromises = folderPaths.map(folderPath =>
                            fetch(`http://localhost:4000/api/folder-structure/${encodeURIComponent(folderPath)}`)
                                .then(res => res.json())
                        );
                        Promise.all(fetchFolderPromises)
                            .then(results => {
                                let allFiles = [];
                                results.forEach((tree, idx) => {
                                    const filesFromTree = extractFilesFromTree(tree, folderPaths[idx]);
                                    allFiles = allFiles.concat(filesFromTree);
                                });
                                setFilesList(allFiles);
                            })
                            .catch(err => console.error("Error fetching folder structures", err));
                    });
            })
            .catch(err => console.error("Error fetching tasks", err));
    }, [taskId, navigate]);

    // Initialize selection when filesList changes
    useEffect(() => {
        const initialSelection = {};
        filesList.forEach(file => {
            initialSelection[file.url] = false;
        });
        setSelected(initialSelection);
    }, [filesList]);

    // NEW: Load annotations from the backend (annotation.json)
    useEffect(() => {
        if (projectData) {
            const folderId = projectData.folder_path.split('/')[1];
            fetch(`http://localhost:4000/api/annotations/${folderId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.annotations) {
                        setAnnotations(data.annotations);
                    }
                })
                .catch(err => console.error("Error fetching annotations", err));
        }
    }, [projectData]);

    // Count how many images are selected
    const selectedCount = Object.values(selected).filter(Boolean).length;

    const toggleSelect = (url) => {
        setSelected(prev => ({ ...prev, [url]: !prev[url] }));
    };

    const selectAll = () => {
        const newSelection = {};
        filesList.forEach(file => {
            newSelection[file.url] = true;
        });
        setSelected(newSelection);
    };

    const clearSelection = () => {
        const newSelection = {};
        filesList.forEach(file => {
            newSelection[file.url] = false;
        });
        setSelected(newSelection);
    };

    const assignClass = () => {
        // For every selected image, assign the chosen label
        const newAnnotations = { ...annotations };
        filesList.forEach(file => {
            if (selected[file.url]) {
                newAnnotations[file.url] = selectedClass;
            }
        });
        setAnnotations(newAnnotations);
        setShowAssignModal(false);
        showMessage('Class assigned to selected images');
    };

    // Updated Add Label function to mimic Detection.js
    const handleAddNewLabel = async () => {
        if (!newLabelName.trim()) {
            showMessage('Label name cannot be empty');
            return;
        }
        const nameExists = localLabelClasses.some(
            (lc) => lc.name.toLowerCase() === newLabelName.trim().toLowerCase()
        );
        if (nameExists) {
            showMessage('Label already exists');
            return;
        }
        const colorExists = localLabelClasses.some(
            (lc) => lc.color.toLowerCase() === newLabelColor.trim().toLowerCase()
        );
        if (colorExists) {
            showMessage('Label color already used. Please choose a different color.');
            return;
        }
        const newLabel = { name: newLabelName.trim(), color: newLabelColor };
        const updatedLabels = [...localLabelClasses, newLabel];
        try {
            await fetch(`http://localhost:4000/api/projects/${projectData.project_id}/labels`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labelClasses: updatedLabels })
            });
            await fetch('http://localhost:4000/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderId: projectData ? projectData.folder_path.split('/')[1] : '',
                    taskName: taskData ? taskData.task_name : '',
                    labelClasses: updatedLabels,
                    annotations
                })
            });
            setLocalLabelClasses(updatedLabels);
            setSelectedClass(newLabel.name);
            setNewLabelName('');
            setNewLabelColor('#ff0000');
            setShowAddLabelModal(false);
            showMessage(`Added new label: ${newLabel.name}`);
        } catch (error) {
            console.error('Error updating labels:', error);
            showMessage('Failed to add new label: ' + error.message);
        }
    };

    // UPDATED: Handle adding images using modal (similar to Detection.js)
    const handleAddImage = () => {
        setShowAddImageModal(true);
    };

    const handleFileSelect = async (e) => {
        // This function is kept for backward compatibility if needed.
    };

    // UPDATED: Handle deleting selected images using same logic as Detection.js
    const confirmDeleteImage = async () => {
        // Get all selected image URLs
        const selectedUrls = Object.entries(selected)
            .filter(([url, isSelected]) => isSelected)
            .map(([url]) => url);

        if (selectedUrls.length === 0) return;

        setIsDeleting(true);
        showMessage(`Deleting ${selectedUrls.length} image(s)...`);

        let successCount = 0;
        let errorCount = 0;

        for (const url of selectedUrls) {
            try {
                // Extract full relative path from URL (after '/uploads/')
                const relativePathFull = url.split('/uploads/')[1];
                const parts = relativePathFull.split('/');
                const folderId = parts.shift();
                const relativePath = parts.join('/');
                const response = await fetch(`http://localhost:4000/api/images/${folderId}/${relativePath}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    errorCount++;
                    continue;
                }
                successCount++;
            } catch (error) {
                errorCount++;
            }
        }

        // Update file list by removing deleted files
        const updatedFiles = filesList.filter(file => !selected[file.url]);
        setFilesList(updatedFiles);

        // Remove annotations for deleted files
        const updatedAnnotations = { ...annotations };
        selectedUrls.forEach(url => {
            delete updatedAnnotations[url];
        });
        setAnnotations(updatedAnnotations);

        clearSelection();

        showMessage(`Deleted ${successCount} image(s)${errorCount > 0 ? `, ${errorCount} failed` : ''}`);
        setIsDeleting(false);
        setShowConfirmDeleteModal(false);
    };

    // Save annotations on Ctrl+S
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.ctrlKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [annotations]);

    const handleSave = async () => {
        const folderId = projectData ? projectData.folder_path.split('/')[1] : '';
        const bodyData = {
            folderId,
            taskName: taskData ? taskData.task_name : '',
            labelClasses: localLabelClasses,
            annotations,
        };
        try {
            const res = await fetch('http://localhost:4000/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });
            const data = await res.json();
            showMessage('Saved: ' + data.message);
        } catch (err) {
            console.error(err);
            showMessage('Error saving');
        }
    };

    return (
        <div className="classification-container">
            {/* Hidden file input kept for backward compatibility */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
            />

            <UserHomeTopBar taskName={taskData ? taskData.task_name : ''} />

            {statusMessage && (
                <div className="status-message">
                    {statusMessage}
                </div>
            )}

            <main className="classification-main">
                <div className="image-grid">
                    {filesList.map((file, index) => (
                        <div key={index} className="image-card">
                            <img src={file.url} alt={file.originalname} />
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selected[file.url] || false}
                                    onChange={() => toggleSelect(file.url)}
                                    aria-label={`Select ${file.originalname}`}
                                />
                            </label>
                            {annotations[file.url] && (
                                <div className="assigned-label">
                                    {annotations[file.url]}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </main>
            <div className="floating-bottom">
                <span>{selectedCount} image{selectedCount !== 1 ? 's' : ''} selected</span>
                <button onClick={selectAll}>Select All</button>
                <button onClick={clearSelection}>Clear Selection</button>
                <button onClick={handleAddImage} disabled={isUploading}>
                    {isUploading ? 'Uploading...' : 'Add Image'}
                </button>
                <button
                    onClick={() => setShowConfirmDeleteModal(true)}
                    disabled={isDeleting || selectedCount === 0}
                    className={selectedCount > 0 ? "delete-button" : ""}
                >
                    {isDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
                <button onClick={() => setShowAddLabelModal(true)}>Add Classes</button>
                <button onClick={() => setShowAssignModal(true)}>Assign Classes</button>
                <button onClick={handleSave}>Save</button>
            </div>

            {/* Modal for uploading new image(s) */}
            {showAddImageModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Upload New Image</h3>
                        <div className="modal-section">
                            <h4>Select File(s)</h4>
                            <input
                                type="file"
                                multiple
                                accept="image/*"
                                onChange={(e) => setNewFiles(e.target.files)}
                            />
                        </div>
                        <div className="modal-section">
                            <h4>Select Target Folder</h4>
                            <select
                                value={selectedAddFolder}
                                onChange={(e) => setSelectedAddFolder(e.target.value)}
                            >
                                <option value="">Select a folder</option>
                                {taskFolderPaths.map((fp, idx) => (
                                    <option key={idx} value={fp}>{fp}</option>
                                ))}
                            </select>
                        </div>
                        <div className="modal-footer">
                            <button className="primary" onClick={async () => {
                                if (!newFiles || newFiles.length === 0 || !selectedAddFolder) {
                                    showMessage("Please select file(s) and a target folder.");
                                    return;
                                }
                                setIsUploading(true);
                                showMessage("Uploading image(s)...");
                                const formData = new FormData();
                                for (let i = 0; i < newFiles.length; i++) {
                                    formData.append('files', newFiles[i]);
                                }
                                try {
                                    const response = await fetch(`http://localhost:4000/api/images/${encodeURIComponent(selectedAddFolder)}`, {
                                        method: 'POST',
                                        body: formData
                                    });
                                    if (!response.ok) {
                                        throw new Error("Failed to upload image(s)");
                                    }
                                    const result = await response.json();
                                    if (result.files && result.files.length > 0) {
                                        const newFilesList = [...filesList, ...result.files];
                                        setFilesList(newFilesList);
                                        showMessage(`Uploaded ${result.files.length} image(s) successfully`);
                                    } else {
                                        showMessage("No new images were uploaded");
                                    }
                                } catch (error) {
                                    console.error("Error uploading images:", error);
                                    showMessage("Error uploading image(s): " + error.message);
                                } finally {
                                    setIsUploading(false);
                                    setShowAddImageModal(false);
                                    setNewFiles(null);
                                    setSelectedAddFolder("");
                                }
                            }}>
                                Upload
                            </button>
                            <button className="secondary" onClick={() => {
                                setShowAddImageModal(false);
                                setNewFiles(null);
                                setSelectedAddFolder("");
                            }}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for adding a new label (classes) */}
            {showAddLabelModal && (
                <div className="modal-backdrop" onClick={() => setShowAddLabelModal(false)}>
                    <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Add New Label</h3>
                        <div>
                            <input
                                type="text"
                                placeholder="Label Name"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                            />
                        </div>
                        <div className="color-palette">
                            {[
                                '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
                                '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
                                '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
                                '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
                            ].map((color, idx) => (
                                <div
                                    key={idx}
                                    className={`color-option ${newLabelColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setNewLabelColor(color)}
                                />
                            ))}
                        </div>
                        <div>
                            <input type="color" value={newLabelColor} onChange={(e) => setNewLabelColor(e.target.value)} />
                        </div>
                        <div className="modal-footer">
                            <button onClick={handleAddNewLabel} className="primary">
                                Add
                            </button>
                            <button onClick={() => setShowAddLabelModal(false)} className="secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for assigning class */}
            {showAssignModal && (
                <div className="modal-backdrop" onClick={() => setShowAssignModal(false)}>
                    <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Assign Class</h3>
                        <select value={selectedClass} onChange={(e) => setSelectedClass(e.target.value)}>
                            {localLabelClasses.map((lc, idx) => (
                                <option key={idx} value={lc.name}>{lc.name}</option>
                            ))}
                        </select>
                        <div className="modal-buttons">
                            <button onClick={assignClass}>Assign</button>
                            <button onClick={() => setShowAssignModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal for confirming deletion */}
            {showConfirmDeleteModal && (
                <div className="modal-backdrop">
                    <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete {selectedCount} selected image{selectedCount !== 1 ? 's' : ''}? This action cannot be undone.</p>
                        <div className="modal-buttons">
                            <button
                                onClick={confirmDeleteImage}
                                className="delete-button"
                                disabled={isDeleting}
                            >
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button onClick={() => setShowConfirmDeleteModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
