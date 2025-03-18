import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import FolderTree from '../components/FolderTree';
import './ProjectInfo.css';

// A set of candidate colors to choose from.
const candidateColors = [
    '#FF5733', '#33FF57', '#3357FF', '#F1C40F',
    '#8E44AD', '#1ABC9C', '#E74C3C', '#2ECC71',
    '#3498DB', '#9B59B6'
];

function hexToRgb(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(ch => ch + ch).join('');
    }
    const bigint = parseInt(hex, 16);
    return {
        r: (bigint >> 16) & 255,
        g: (bigint >> 8) & 255,
        b: bigint & 255
    };
}

function colorDistance(hex1, hex2) {
    const c1 = hexToRgb(hex1);
    const c2 = hexToRgb(hex2);
    return Math.sqrt(
        Math.pow(c1.r - c2.r, 2) +
        Math.pow(c1.g - c2.g, 2) +
        Math.pow(c1.b - c2.b, 2)
    );
}

function getSuggestedColor(existingColors) {
    // If there are no existing colors, return the first candidate.
    if (existingColors.length === 0) return candidateColors[0];

    let bestCandidate = candidateColors[0];
    let bestDistance = 0;
    candidateColors.forEach(candidate => {
        let minDistance = Infinity;
        existingColors.forEach(existing => {
            const d = colorDistance(candidate, existing);
            if (d < minDistance) {
                minDistance = d;
            }
        });
        if (minDistance > bestDistance) {
            bestDistance = minDistance;
            bestCandidate = candidate;
        }
    });
    return bestCandidate;
}

export default function ProjectInfo() {
    const { projectId } = useParams();
    const [project, setProject] = useState(null);
    const [folderTree, setFolderTree] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showAddLabelForm, setShowAddLabelForm] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [suggestedColor, setSuggestedColor] = useState('');

    // Fetch project details.
    useEffect(() => {
        const fetchProject = async () => {
            try {
                const res = await fetch('http://localhost:4000/api/projects');
                if (res.ok) {
                    const data = await res.json();
                    const found = data.find((proj) => proj.project_id === projectId);
                    setProject(found);
                } else {
                    console.error('Failed to fetch projects');
                }
            } catch (error) {
                console.error('Error fetching projects:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchProject();
    }, [projectId]);

    // Fetch folder tree once project is loaded.
    useEffect(() => {
        if (project) {
            const parts = project.folder_path.split('/');
            const folderId = parts[1];
            const fetchFolderTree = async () => {
                try {
                    const res = await fetch(`http://localhost:4000/api/folder-structure/${folderId}`);
                    if (res.ok) {
                        const treeData = await res.json();
                        setFolderTree(treeData);
                    } else {
                        console.error('Failed to fetch folder structure');
                    }
                } catch (error) {
                    console.error('Error fetching folder structure:', error);
                }
            };
            fetchFolderTree();
        }
    }, [project]);

    // When the add-label modal is shown, compute a suggested color that is different from existing ones.
    useEffect(() => {
        if (showAddLabelForm && project) {
            const usedColors = project.label_classes
                .filter(label => typeof label === 'object' && label.color)
                .map(label => label.color);
            const suggested = getSuggestedColor(usedColors);
            setSuggestedColor(suggested);
        }
    }, [showAddLabelForm, project]);

    // Handle adding a new label.
    const handleAddLabel = async () => {
        if (!newLabelName.trim()) return;
        const newLabel = { name: newLabelName.trim(), color: suggestedColor };
        const updatedLabels = [...(project.label_classes || []), newLabel];
        try {
            const res = await fetch(`http://localhost:4000/api/projects/${project.project_id}/labels`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ labelClasses: updatedLabels })
            });
            if (res.ok) {
                setProject({ ...project, label_classes: updatedLabels });
                setShowAddLabelForm(false);
                setNewLabelName('');
            } else {
                console.error('Failed to update labels');
            }
        } catch (error) {
            console.error('Error updating labels:', error);
        }
    };

    if (loading) {
        return <div>Loading...</div>;
    }
    if (!project) {
        return <div>Project not found.</div>;
    }

    return (
        <div className="project-info-page">
            <UserHomeTopBar />
            <div className="project-info-container">
                <h2>Project Information</h2>
                <p><strong>Project Name:</strong> {project.project_name}</p>
                <p><strong>Project Type:</strong> {project.project_type}</p>

                <div className="labels-section">
                    <span className="label-heading"><strong>Labels:</strong> </span>
                    <span className="label-values">
                        {project.label_classes.map((label, index) => (
                            <span key={index}>
                                {typeof label === 'object' ? label.name : label}
                                {index < project.label_classes.length - 1 ? ', ' : ''}
                            </span>
                        ))}
                    </span>
                </div>

                <button className="btn add-label-btn" onClick={() => setShowAddLabelForm(true)}>
                    + Add Label
                </button>

                {showAddLabelForm && (
                    <div className="modal-overlay">
                        <div className="modal-box">
                            <h3>Add New Label</h3>
                            <input
                                type="text"
                                placeholder="Enter label name"
                                value={newLabelName}
                                onChange={(e) => setNewLabelName(e.target.value)}
                            />
                            <div className="color-picker-container">
                                <label>Color:</label>
                                <input
                                    type="color"
                                    value={suggestedColor}
                                    onChange={(e) => setSuggestedColor(e.target.value)}
                                    className="color-input"
                                />
                            </div>
                            <div className="modal-buttons">
                                <button className="btn" onClick={handleAddLabel}>Add</button>
                                <button className="btn cancel-btn" onClick={() => setShowAddLabelForm(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="folder-structure-section">
                    <h3>Folder Structure</h3>
                    {folderTree ? (
                        <FolderTree node={folderTree} />
                    ) : (
                        <p>No folder structure available.</p>
                    )}
                </div>

                <div className="actions-section">
                    <button className="btn upload-more-btn">+ Upload More Data - later</button>
                    <button className="btn create-task-btn">+ Create New Task - later</button>
                </div>
            </div>
        </div>
    );
}
