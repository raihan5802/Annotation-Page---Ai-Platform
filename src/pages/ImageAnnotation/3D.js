import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import HomeTopBar from '../../components/HomeTopBar';
import ThreeDCanvas from '../../components/3DCanvas';
import AnnotationListSidebar from '../../components/AnnotationListSidebar';
import './3D.css';

// SVG Icon Components
const UndoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 14L4 9l5-5" />
        <path d="M4 9h10c3 0 7 1 7 6v1" />
    </svg>
);

const RedoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 14l5-5-5-5" />
        <path d="M20 9H10C7 9 3 10 3 15v1" />
    </svg>
);

const SaveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
    </svg>
);

const MoveIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="5 9 2 12 5 15" />
        <polyline points="9 5 12 2 15 5" />
        <polyline points="15 19 12 22 9 19" />
        <polyline points="19 9 22 12 19 15" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <line x1="12" y1="2" x2="12" y2="22" />
    </svg>
);

const CuboidIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
        <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
        <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
);

const PlusIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const PaletteIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="13.5" cy="6.5" r="2.5" />
        <circle cx="17.5" cy="10.5" r="2.5" />
        <circle cx="8.5" cy="7.5" r="2.5" />
        <circle cx="6.5" cy="12.5" r="2.5" />
        <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.688h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
    </svg>
);

const ToolsIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
);

const CenterIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

const AddModelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
);

const DeleteModelIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
        <line x1="4" y1="19" x2="20" y2="19" stroke="#e74c3c" />
    </svg>
);

export default function ThreeD() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const folderInfo = state?.folderInfo;
    const canvasHelperRef = useRef(null);
    const canvasAreaRef = useRef(null);
    const fileInputRef = useRef(null);

    const [filesList, setFilesList] = useState(() => {
        return folderInfo?.files || [];
    });
    const [isDeleting, setIsDeleting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [showConfirmDeleteModal, setShowConfirmDeleteModal] = useState(false);
    const [showAddLabelModal, setShowAddLabelModal] = useState(false);
    const [newLabelName, setNewLabelName] = useState('');
    const [newLabelColor, setNewLabelColor] = useState('#ff0000');

    if (!folderInfo) {
        return (
            <div style={{ padding: 20 }}>
                <h2>No folder info found. Please create a task first.</h2>
                <button onClick={() => navigate('/')} className="primary">Go Home</button>
            </div>
        );
    }

    const { folderId, taskId, taskName, labelClasses, files } = folderInfo;

    // State for annotations and undo/redo
    const [annotations, setAnnotations] = useState(() => {
        if (folderInfo && folderInfo.annotations) {
            return folderInfo.annotations;
        }
        return {};
    });
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isSaving, setIsSaving] = useState(false);
    const [showHelperText, setShowHelperText] = useState(false);
    const [helperText, setHelperText] = useState('');

    // State for model position, tools, and labels
    const [modelPosition, setModelPosition] = useState({ x: 0, y: 0 });
    const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 });
    const [selectedTool, setSelectedTool] = useState('move');
    const [selectedLabelClass, setSelectedLabelClass] = useState(
        labelClasses[0]?.name || ''
    );
    const [localLabelClasses, setLocalLabelClasses] = useState(labelClasses);
    const [scale, setScale] = useState(1.0);

    const currentFileUrl = filesList[currentIndex]?.url;
    const currentShapes = annotations[currentFileUrl] || [];
    const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);

    // Candidate colors for auto-selection
    const CANDIDATE_COLORS = [
        '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
        '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
        '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
        '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
    ];

    // Update annotations
    const handleAnnotationsChange = (newShapes) => {
        const updated = {
            ...annotations,
            [currentFileUrl]: newShapes,
        };
        setUndoStack([...undoStack, annotations]);
        setRedoStack([]);
        setAnnotations(updated);
    };

    const handleUpdateAllAnnotations = (updatedAnnotations) => {
        const updated = {
            ...annotations,
            [currentFileUrl]: updatedAnnotations,
        };
        setUndoStack([...undoStack, annotations]);
        setRedoStack([]);
        setAnnotations(updated);
    };

    // Reset selection on model change
    useEffect(() => {
        setSelectedAnnotationIndex(null);
    }, [currentIndex, currentFileUrl]);

    // Show helper text when tool changes
    useEffect(() => {
        if (selectedTool === 'move') {
            showHelper('Move and select objects (M)');
        } else if (selectedTool === 'cuboid') {
            showHelper('Cuboid annotation tool - Coming Soon (C)');
        }
    }, [selectedTool]);

    // Calculate canvas dimensions
    useEffect(() => {
        if (canvasAreaRef.current) {
            setCanvasDimensions({
                width: canvasAreaRef.current.offsetWidth,
                height: canvasAreaRef.current.offsetHeight
            });
        }
    }, []);

    // When the add-label modal is opened, automatically select a new color
    useEffect(() => {
        if (showAddLabelModal) {
            // Find a color that isn't already used
            const usedColors = new Set(localLabelClasses.map(lc => lc.color.toLowerCase()));
            const availableColor = CANDIDATE_COLORS.find(color =>
                !usedColors.has(color.toLowerCase())
            ) || CANDIDATE_COLORS[0];

            setNewLabelColor(availableColor);
        }
    }, [showAddLabelModal, localLabelClasses]);

    // Helper functions
    const showHelper = (text) => {
        setHelperText(text);
        setShowHelperText(true);
        if (canvasHelperRef.current) {
            canvasHelperRef.current.classList.add('visible');
        }

        setTimeout(() => {
            if (canvasHelperRef.current) {
                canvasHelperRef.current.classList.remove('visible');
            }
            setTimeout(() => setShowHelperText(false), 300);
        }, 3000);
    };

    const handleCenterModel = () => {
        if (currentFileUrl && canvasAreaRef.current) {
            const canvasWidth = canvasAreaRef.current.offsetWidth;
            const canvasHeight = canvasAreaRef.current.offsetHeight;
            setModelPosition({
                x: canvasWidth / 2 - 200,
                y: canvasHeight / 2 - 200
            });
            showHelper('Model centered');
        }
    };

    // Undo/Redo
    const undo = () => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack([...redoStack, annotations]);
        setUndoStack(undoStack.slice(0, -1));
        setAnnotations(prev);
        showHelper('Undo successful');
    };

    const redo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack([...undoStack, annotations]);
        setRedoStack(redoStack.slice(0, -1));
        setAnnotations(next);
        showHelper('Redo successful');
    };

    // Annotation management
    const handleDeleteAnnotation = (index) => {
        const arr = [...currentShapes];
        arr.splice(index, 1);
        handleAnnotationsChange(arr);
        showHelper('Annotation deleted');

        if (selectedAnnotationIndex === index) {
            setSelectedAnnotationIndex(null);
        } else if (selectedAnnotationIndex > index) {
            setSelectedAnnotationIndex(selectedAnnotationIndex - 1);
        }
    };

    const handleUpdateAnnotation = (index, changes) => {
        const arr = [...currentShapes];
        arr[index] = { ...arr[index], ...changes };
        handleAnnotationsChange(arr);
    };

    // Navigation
    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    };

    const handleNext = () => {
        if (currentIndex < filesList.length - 1) setCurrentIndex((i) => i + 1);
    };

    // Zoom
    const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 5));

    const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));

    const handleWheelZoom = (deltaY) => {
        if (deltaY < 0) handleZoomIn();
        else handleZoomOut();
    };

    // Save annotations
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const bodyData = {
                folderId,
                taskName,
                labelClasses: localLabelClasses,
                annotations,
            };

            const res = await fetch('http://localhost:4000/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyData),
            });

            const data = await res.json();
            showHelper('Annotations saved successfully');
        } catch (err) {
            console.error(err);
            showHelper('Error saving annotations');
        } finally {
            setIsSaving(false);
        }
    };

    // Handle shape completion
    const handleFinishShape = () => {
        setSelectedTool('move');
        setSelectedAnnotationIndex(null);
        showHelper('Annotation completed');
    };

    // Add new label
    const handleAddNewLabel = async () => {
        if (!newLabelName.trim()) {
            showHelper('Label name cannot be empty');
            return;
        }

        const nameExists = localLabelClasses.some(
            (lc) => lc.name.toLowerCase() === newLabelName.trim().toLowerCase()
        );

        if (nameExists) {
            showHelper('Label already exists');
            return;
        }

        const colorExists = localLabelClasses.some(
            (lc) => lc.color.toLowerCase() === newLabelColor.trim().toLowerCase()
        );

        if (colorExists) {
            showHelper('Label color already used. Please choose a different color.');
            return;
        }

        const newLabel = { name: newLabelName.trim(), color: newLabelColor };
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

            // Update annotations.json with new labels
            const annotationsRes = await fetch('http://localhost:4000/api/annotations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    folderId: folderInfo.folderId,
                    taskName: taskName,
                    labelClasses: updatedLabels,
                    annotations: annotations
                })
            });

            if (!annotationsRes.ok) {
                throw new Error('Failed to update annotations');
            }

            // Update local state
            setLocalLabelClasses(updatedLabels);
            setSelectedLabelClass(newLabel.name);
            setNewLabelName('');
            setNewLabelColor('#ff0000');
            setShowAddLabelModal(false);
            showHelper(`Added new label: ${newLabel.name}`);
        } catch (error) {
            console.error('Error updating labels:', error);
            showHelper('Failed to add new label: ' + error.message);
        }
    };

    // File management
    const handleAddModel = () => {
        fileInputRef.current.click();
    };

    const handleFileSelect = async (e) => {
        const selectedFiles = e.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        // Filter for 3D file formats
        const allowed3DFormats = ['.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
        const valid3DFiles = Array.from(selectedFiles).filter(file => {
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            return allowed3DFormats.some(format =>
                format.toLowerCase() === extension.toLowerCase()
            );
        });

        if (valid3DFiles.length !== selectedFiles.length) {
            alert('Some files are not valid 3D models and will be skipped.');
            if (valid3DFiles.length === 0) {
                alert('No valid 3D models were selected.');
                return;
            }
        }

        setIsUploading(true);
        showHelper('Uploading 3D model(s)...');

        const formData = new FormData();
        valid3DFiles.forEach(file => formData.append('files', file));

        try {
            const response = await fetch(`http://localhost:4000/api/images/${folderId}`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload models');
            }

            const result = await response.json();

            if (result.files && result.files.length > 0) {
                const newFilesList = [...filesList, ...result.files];
                setFilesList(newFilesList);
                setCurrentIndex(filesList.length);
                showHelper(`Added ${result.files.length} new model(s)`);
            } else {
                showHelper('No new models were added');
            }
        } catch (error) {
            console.error('Error uploading models:', error);
            showHelper('Error uploading models: ' + error.message);
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handleDeleteModel = () => {
        if (!filesList.length || currentIndex < 0 || currentIndex >= filesList.length) {
            showHelper('No model to delete');
            return;
        }
        setShowConfirmDeleteModal(true);
    };

    const confirmDeleteModel = async () => {
        if (!filesList.length || currentIndex < 0 || currentIndex >= filesList.length) return;

        const currentFile = filesList[currentIndex];
        setIsDeleting(true);

        try {
            const urlParts = currentFile.url.split('/');
            const filename = urlParts[urlParts.length - 1];

            const response = await fetch(`http://localhost:4000/api/images/${folderId}/${filename}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete model');
            }

            // Remove deleted file from the list
            const updatedFiles = [...filesList];
            updatedFiles.splice(currentIndex, 1);

            // Remove annotations for this file
            const updatedAnnotations = { ...annotations };
            delete updatedAnnotations[currentFile.url];

            // Update state
            setFilesList(updatedFiles);
            setAnnotations(updatedAnnotations);

            // Adjust current index if needed
            if (currentIndex >= updatedFiles.length && updatedFiles.length > 0) {
                setCurrentIndex(updatedFiles.length - 1);
            } else if (updatedFiles.length === 0) {
                setCurrentIndex(0);
            }

            showHelper('Model deleted successfully');
        } catch (error) {
            console.error('Error deleting model:', error);
            showHelper('Error deleting model');
        } finally {
            setIsDeleting(false);
            setShowConfirmDeleteModal(false);
        }
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e) => {
            // Skip if inside input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

            if (e.key === 'm' || e.key === 'M') {
                setSelectedTool('move');
            } else if (e.key === 'c' || e.key === 'C') {
                setSelectedTool('cuboid');
            } else if ((e.key === 's' || e.key === 'S') && e.ctrlKey) {
                e.preventDefault();
                handleSave();
            } else if (e.key === 'Escape') {
                if (selectedAnnotationIndex !== null) {
                    setSelectedAnnotationIndex(null);
                } else {
                    const event = new CustomEvent('cancel-annotation');
                    window.dispatchEvent(event);
                }
            } else if (e.key === 'ArrowRight') {
                handleNext();
            } else if (e.key === 'ArrowLeft') {
                handlePrev();
            } else if (e.ctrlKey && (e.key === 'z' || e.key === 'Z')) {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
                e.preventDefault();
                redo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [annotations, undoStack, redoStack, selectedAnnotationIndex]);

    // Get active label color
    const activeLabelColor = localLabelClasses.find(
        (l) => l.name === selectedLabelClass
    )?.color || '#ff0000';

    return (
        <div className="annotate-container">
            {/* Hidden file input for adding models */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileSelect}
                accept=".obj,.glb,.gltf,.ply,.stl,.3ds,.fbx"
                multiple
            />

            <HomeTopBar
                taskName={taskName}
                showControls={true}
                isSaving={isSaving}
            />

            <div className="annotate-actions">
                <button onClick={undo} disabled={undoStack.length === 0} title="Undo (Ctrl+Z)">
                    <UndoIcon /> Undo
                </button>
                <button onClick={redo} disabled={redoStack.length === 0} title="Redo (Ctrl+Y)">
                    <RedoIcon /> Redo
                </button>
                <div className="divider"></div>
                <button onClick={handleSave} className="primary" disabled={isSaving} title="Save (Ctrl+S)">
                    <SaveIcon /> {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button onClick={handleCenterModel} title="Center Model (C)">
                    <CenterIcon /> Center
                </button>
                <div className="divider"></div>
                <button onClick={handlePrev} disabled={currentIndex <= 0}>
                    Prev
                </button>
                <button onClick={handleNext} disabled={currentIndex >= filesList.length - 1}>
                    Next
                </button>
                <button onClick={handleAddModel} disabled={isUploading} title="Add 3D Model">
                    <AddModelIcon /> Add Model
                </button>
                <button onClick={handleDeleteModel} disabled={isDeleting || filesList.length === 0} title="Delete Current Model">
                    <DeleteModelIcon /> Delete Model
                </button>
                <div className="divider"></div>
                <button onClick={handleZoomOut}>- Zoom</button>
                <button onClick={handleZoomIn}>+ Zoom</button>
                <span className="img-count">
                    {currentIndex + 1} / {filesList.length}
                </span>
            </div>

            <div className="annotate-main">
                {/* Tools Sidebar */}
                <div className="tools-sidebar">
                    <div className="sidebar-section">
                        <h3><ToolsIcon /> Tools</h3>
                        <div className="tool-grid">
                            <div
                                className={`tool-button ${selectedTool === 'move' ? 'active' : ''}`}
                                onClick={() => setSelectedTool('move')}
                                title="Move Tool (M)"
                            >
                                <div className="tool-icon"><MoveIcon /></div>
                                <div className="tool-name">Move</div>
                                <div className="keyboard-hint">M</div>
                            </div>
                            <div
                                className={`tool-button ${selectedTool === 'cuboid' ? 'active' : ''}`}
                                onClick={() => setSelectedTool('cuboid')}
                                title="Cuboid Tool (C) - Coming Soon"
                            >
                                <div className="tool-icon"><CuboidIcon /></div>
                                <div className="tool-name">Cuboid</div>
                                <div className="keyboard-hint">C</div>
                            </div>
                        </div>
                    </div>

                    <div className="sidebar-section">
                        <h3><PaletteIcon /> Active Label</h3>
                        <div className="label-selection">
                            <select
                                value={selectedLabelClass}
                                onChange={(e) => setSelectedLabelClass(e.target.value)}
                            >
                                {localLabelClasses.map((lc, i) => (
                                    <option key={i} value={lc.name}>
                                        {lc.name}
                                    </option>
                                ))}
                            </select>
                            <button onClick={() => setShowAddLabelModal(true)}>
                                <PlusIcon /> Add Label
                            </button>
                        </div>
                        <div className="label-preview">
                            <div
                                className="label-color"
                                style={{ backgroundColor: activeLabelColor }}
                            ></div>
                            <span>Current Label: {selectedLabelClass}</span>
                        </div>
                    </div>
                </div>

                {/* Canvas */}
                <div className="canvas-area" ref={canvasAreaRef}>
                    {currentFileUrl ? (
                        <>
                            <ThreeDCanvas
                                fileUrl={currentFileUrl}
                                annotations={currentShapes}
                                onAnnotationsChange={handleAnnotationsChange}
                                selectedTool={selectedTool}
                                scale={scale}
                                onWheelZoom={handleWheelZoom}
                                activeLabelColor={activeLabelColor}
                                onFinishShape={handleFinishShape}
                                onDeleteAnnotation={handleDeleteAnnotation}
                                activeLabel={selectedLabelClass}
                                labelClasses={localLabelClasses}
                                initialPosition={modelPosition}
                                externalSelectedIndex={selectedAnnotationIndex}
                                onSelectAnnotation={setSelectedAnnotationIndex}
                            />
                            {showHelperText && (
                                <div className="canvas-helper visible" ref={canvasHelperRef}>
                                    {helperText}
                                </div>
                            )}
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', margin: 'auto', padding: '40px' }}>
                            No 3D models found
                        </div>
                    )}
                </div>

                <AnnotationListSidebar
                    annotations={currentShapes}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onUpdateAnnotation={handleUpdateAnnotation}
                    labelClasses={localLabelClasses}
                    selectedAnnotationIndex={selectedAnnotationIndex}
                    setSelectedAnnotationIndex={setSelectedAnnotationIndex}
                    currentShapes={currentShapes}
                    onUpdateAllAnnotations={handleUpdateAllAnnotations}
                />
            </div>

            {/* Add Label Modal */}
            {showAddLabelModal && (
                <div className="modal-backdrop">
                    <div className="modal">
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
                            {CANDIDATE_COLORS.map((color, idx) => (
                                <div
                                    key={idx}
                                    className={`color-option ${newLabelColor === color ? 'selected' : ''}`}
                                    style={{ backgroundColor: color }}
                                    onClick={() => setNewLabelColor(color)}
                                />
                            ))}
                        </div>
                        <div>
                            <input
                                type="color"
                                value={newLabelColor}
                                onChange={(e) => setNewLabelColor(e.target.value)}
                            />
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

            {/* Confirmation modal for deleting models */}
            {showConfirmDeleteModal && (
                <div className="modal-backdrop">
                    <div className="modal">
                        <h3>Confirm Delete</h3>
                        <p>Are you sure you want to delete this 3D model? This action cannot be undone.</p>
                        <div className="modal-footer">
                            <button onClick={confirmDeleteModel} className="primary" disabled={isDeleting}>
                                {isDeleting ? 'Deleting...' : 'Delete'}
                            </button>
                            <button onClick={() => setShowConfirmDeleteModal(false)} className="secondary">
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}