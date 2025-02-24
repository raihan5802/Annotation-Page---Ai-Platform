import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeTopBar from '../components/HomeTopBar';
import './Classification.css';

export default function Classification() {
    const navigate = useNavigate();
    const location = useLocation();
    const folderInfo = location.state?.folderInfo;

    if (!folderInfo) {
        return (
            <div className="classification-container">
                <h2>No folder info found. Please create a task first.</h2>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    const { folderId, taskName, labelClasses, files } = folderInfo;

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

    const handleAddNewLabel = async () => {
        if (!newLabelName.trim()) {
            alert('Label name cannot be empty');
            return;
        }
        const nameExists = localLabelClasses.some(
            (lc) => lc.name.toLowerCase() === newLabelName.trim().toLowerCase()
        );
        if (nameExists) {
            alert('Label already exists');
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
        } catch (error) {
            console.error('Error updating labels:', error);
            alert('Failed to add new label: ' + error.message);
        }
    };

    // Initialize selection when files load
    useEffect(() => {
        const initialSelection = {};
        files.forEach(file => {
            initialSelection[file.url] = false;
        });
        setSelected(initialSelection);
    }, [files]);

    // Count how many images are selected
    const selectedCount = Object.values(selected).filter(Boolean).length;

    const toggleSelect = (url) => {
        setSelected(prev => ({ ...prev, [url]: !prev[url] }));
    };

    const selectAll = () => {
        const newSelection = {};
        files.forEach(file => {
            newSelection[file.url] = true;
        });
        setSelected(newSelection);
    };

    const assignClass = () => {
        // For every selected image, assign the chosen label
        const newAnnotations = { ...annotations };
        files.forEach(file => {
            if (selected[file.url]) {
                newAnnotations[file.url] = selectedClass;
            }
        });
        setAnnotations(newAnnotations);
        setShowAssignModal(false);
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
            labelClasses,
            annotations,
        };
        try {
            const res = await fetch('http://localhost:4000/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });
            const data = await res.json();
            alert('Saved: ' + data.message);
        } catch (err) {
            console.error(err);
            alert('Error saving');
        }
    };

    return (
        <div className="classification-container">
            <HomeTopBar
                taskName={taskName}
            />

            <main className="classification-main">
                <div className="image-grid">
                    {files.map((file, index) => (
                        <div key={index} className="image-card">
                            <img src={file.url} alt={file.name} />
                            <label className="checkbox-label">
                                <input
                                    type="checkbox"
                                    checked={selected[file.url] || false}
                                    onChange={() => toggleSelect(file.url)}
                                    aria-label={`Select ${file.name}`}
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
                <button onClick={() => setShowAddLabelModal(true)}>Add Classes</button>
                <button onClick={() => setShowAssignModal(true)}>Assign Classes</button>
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
        </div>
    );
}
