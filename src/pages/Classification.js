import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeTopBar from '../components/HomeTopBar';
import './Classification.css';

export default function Classification() {
    const navigate = useNavigate();
    const location = useLocation();
    const folderInfo = location.state?.folderInfo;
    const fileInputRef = useRef(null);

    if (!folderInfo) {
        return (
            <div className="classification-container">
                <h2>No folder info found. Please create a task first.</h2>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    const { folderId, taskId, taskName, labelClasses } = folderInfo;

    // Use state for files list so we can update it when adding/deleting
    const [filesList, setFilesList] = useState(folderInfo.files || []);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);

    // Selected status per image (keyed by file URL)
    const [selected, setSelected] = useState({});
    const [localLabelClasses, setLocalLabelClasses] = useState(labelClasses);
    const [selectedClass, setSelectedClass] = useState(labelClasses[0]?.name || '');

    // Classification annotations: mapping file URL to assigned label
    const [annotations, setAnnotations] = useState(() => {
        if (folderInfo && folderInfo.annotations) {
            return folderInfo.annotations;
        }
        return {};
    });
    // Modal state for assigning a class
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showAddLabelModal, setShowAddLabelModal] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [statusMessage, setStatusMessage] = useState('');

    // Show status message
    const showMessage = (message) => {
        setStatusMessage(message);
        setTimeout(() => {
            setStatusMessage('');
        }, 3000);
    };

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

        const newLabel = { name: newLabelName.trim(), color: '#000000' };
        const updatedLabels = [...localLabelClasses, newLabel];

        try {
            // Update labels in tasks.csv
            const updateLabelsRes = await fetch(`http://localhost:4000/api/tasks/${folderInfo.taskId}/labels`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labelClasses: updatedLabels })
            });

            if (!updateLabelsRes.ok) {
                throw new Error('Failed to update labels in task');
            }

            // Update local state
            setLocalLabelClasses(updatedLabels);
            setSelectedClass(newLabel.name);
            setNewLabelName('');
            setShowAddLabelModal(false);
            showMessage('New label added successfully');
        } catch (error) {
            console.error('Error updating labels:', error);
            showMessage('Failed to add new label: ' + error.message);
        }
    };

    // Initialize selection when files load
    useEffect(() => {
        const initialSelection = {};
        filesList.forEach(file => {
            initialSelection[file.url] = false;
        });
        setSelected(initialSelection);
    }, [filesList]);

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

    // Handle adding images
    const handleAddImage = () => {
        fileInputRef.current.click();
    };

    const handleFileSelect = async (e) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        setIsUploading(true);
        showMessage('Uploading image(s)...');

        const formData = new FormData();
        for (let i = 0; i < selectedFiles.length; i++) {
            formData.append('files', selectedFiles[i]);
        }

        try {
            console.log("Uploading to folder:", folderId);
            const response = await fetch(`http://localhost:4000/api/images/${folderId}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload images');
            }

            const result = await response.json();
            console.log("Upload result:", result);

            if (result.files && result.files.length > 0) {
                // Create a new array with all existing files plus new ones
                const newFilesList = [...filesList, ...result.files];
                setFilesList(newFilesList);

                // Update selected state for new files
                const newSelection = { ...selected };
                result.files.forEach(file => {
                    newSelection[file.url] = false;
                });
                setSelected(newSelection);

                showMessage(`Added ${result.files.length} new image(s)`);
            } else {
                showMessage('No new images were added');
            }
        } catch (error) {
            console.error('Error uploading images:', error);
            showMessage('Error uploading image(s): ' + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    // Handle deleting selected images
    const handleDeleteImage = () => {
        // Check if any images are selected
        if (selectedCount === 0) {
            showMessage('No images selected for deletion');
            return;
        }

        setShowConfirmDeleteModal(true);
    };

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

        // Delete each selected image
        for (const url of selectedUrls) {
            try {
                // Extract filename from URL
                // URL format is typically: http://localhost:4000/uploads/FOLDER_ID/FILENAME
                const urlParts = url.split('/');
                const filename = urlParts[urlParts.length - 1];

                const response = await fetch(`http://localhost:4000/api/images/${folderId}/${filename}`, {
                    method: 'DELETE',
                });

                if (!response.ok) {
                    errorCount++;
                    console.error(`Failed to delete image: ${url}`);
                    continue;
                }

                successCount++;
            } catch (error) {
                console.error('Error deleting image:', error, url);
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

        // Clear selections
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
        // For classification, send an object mapping file URLs to their assigned label.
        const bodyData = {
            folderId,
            taskName,
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
            {/* Hidden file input for adding images */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept="image/*"
                multiple
            />

            <HomeTopBar
                taskName={taskName}
            />

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
                    onClick={handleDeleteImage}
                    disabled={isDeleting || selectedCount === 0}
                    className={selectedCount > 0 ? "delete-button" : ""}
                >
                    {isDeleting ? 'Deleting...' : 'Delete Selected'}
                </button>
                <button onClick={() => setShowAddLabelModal(true)}>Add Classes</button>
                <button onClick={() => setShowAssignModal(true)}>Assign Classes</button>
                <button onClick={handleSave}>Save</button>
            </div>

            {showAddLabelModal && (
                <div className="modal-backdrop" onClick={() => setShowAddLabelModal(false)}>
                    <div className="assign-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Add New Label</h3>
                        <input
                            type="text"
                            placeholder="Label Name"
                            value={newLabelName}
                            onChange={(e) => setNewLabelName(e.target.value)}
                        />
                        <div className="modal-buttons">
                            <button onClick={handleAddNewLabel}>Add</button>
                            <button onClick={() => setShowAddLabelModal(false)}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}

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