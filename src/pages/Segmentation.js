// Segmentation.js
import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AnnotationTopBar from '../components/AnnotationTopBar';
import SegmentationCanvas from '../components/SegmentationCanvas';
import AnnotationListSidebar from '../components/AnnotationListSidebar';
import './Segmentation.css';

export default function Segmentation() {
    const navigate = useNavigate();
    const { state } = useLocation();
    const folderInfo = state?.folderInfo;

    if (!folderInfo) {
        return (
            <div style={{ padding: 20 }}>
                <h2>No folder info found. Please create a task first.</h2>
                <button onClick={() => navigate('/')}>Go Home</button>
            </div>
        );
    }

    const { folderId, taskName, labelClasses, files } = folderInfo;

    // -------------- Annotations for each image --------------
    const [annotations, setAnnotations] = useState({});
    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // Tools: move, polygon, segmentation
    // default to 'move'
    const [selectedTool, setSelectedTool] = useState('move');

    // For “segmentation” specifically, we have a small dropdown (Instance, Semantic, Panoptic)
    const [segmentationType, setSegmentationType] = useState('instance');

    // New state for panoptic segmentation option
    const [panopticOption, setPanopticOption] = useState('instance');

    const [selectedLabelClass, setSelectedLabelClass] = useState(
        labelClasses[0]?.name || ''
    );
    const [scale, setScale] = useState(1.0);

    const currentFileUrl = files[currentIndex]?.url;
    const currentShapes = annotations[currentFileUrl] || [];

    // Whenever shapes change, store old state in undoStack
    const handleAnnotationsChange = (newShapes) => {
        const updated = {
            ...annotations,
            [currentFileUrl]: newShapes,
        };
        setUndoStack([...undoStack, annotations]);
        setRedoStack([]);
        setAnnotations(updated);
    };

    // -------------- Undo / Redo --------------
    const undo = () => {
        if (undoStack.length === 0) return;
        const prev = undoStack[undoStack.length - 1];
        setRedoStack([...redoStack, annotations]);
        setUndoStack(undoStack.slice(0, -1));
        setAnnotations(prev);
    };

    const redo = () => {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setUndoStack([...undoStack, annotations]);
        setRedoStack(redoStack.slice(0, -1));
        setAnnotations(next);
    };

    // -------------- Deletion & Update --------------
    const handleDeleteAnnotation = (index) => {
        const arr = [...currentShapes];
        arr.splice(index, 1);
        handleAnnotationsChange(arr);
    };

    const handleUpdateAnnotation = (index, changes) => {
        const arr = [...currentShapes];
        arr[index] = { ...arr[index], ...changes };
        handleAnnotationsChange(arr);
    };

    // -------------- Navigation --------------
    const handlePrev = () => {
        if (currentIndex > 0) setCurrentIndex((i) => i - 1);
    };
    const handleNext = () => {
        if (currentIndex < files.length - 1) setCurrentIndex((i) => i + 1);
    };

    // -------------- Zoom --------------
    const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 5));
    const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));
    const handleWheelZoom = (deltaY) => {
        if (deltaY < 0) handleZoomIn();
        else handleZoomOut();
    };

    // -------------- Save --------------
    const handleSave = async () => {
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

    // -------------- Fill Background Button --------------
    const handleFillBackground = () => {
        if (!currentFileUrl) return;
        const img = new window.Image();
        img.src = currentFileUrl;
        img.onload = () => {
            const width = img.width;
            const height = img.height;
            const bgAnn = computeBackgroundPolygon(width, height, currentShapes, labelClasses);
            // Remove any existing background annotation (by label)
            const newShapes = currentShapes.filter((ann) => ann.label.toLowerCase() !== 'background');
            newShapes.push(bgAnn);
            handleAnnotationsChange(newShapes);
        };
    };

    function computeBackgroundPolygon(imageWidth, imageHeight, shapes, labelClasses) {
        const outer = [
            { x: 0, y: 0 },
            { x: imageWidth, y: 0 },
            { x: imageWidth, y: imageHeight },
            { x: 0, y: imageHeight },
        ];
        const holes = [];
        shapes.forEach((ann) => {
            // Only use polygon holes (bbox and ellipse logic removed)
            if (ann.type === 'polygon') {
                if (ann.label.toLowerCase() !== 'background') {
                    holes.push(ann.points);
                }
            }
        });
        let bgColor = '#000000';
        if (
            labelClasses &&
            labelClasses.some(
                (lc) =>
                    lc.color.toLowerCase() === '#000000' &&
                    lc.name.toLowerCase() !== 'background'
            )
        ) {
            bgColor = '#010101';
        }
        return {
            type: 'polygon',
            points: outer,
            holes: holes,
            label: 'background',
            color: bgColor,
        };
    }

    // -------------- Keyboard Shortcuts --------------
    useEffect(() => {
        const handleKey = (e) => {
            const key = e.key;

            // Only support move, polygon, and segmentation
            if (key === 'm' || key === 'M') {
                setSelectedTool('move');
            } else if (key === 'p' || key === 'P') {
                setSelectedTool('polygon');
            }
            // Segmentation on plain "S"
            else if ((key === 's' || key === 'S') && e.ctrlKey) {
                // Ctrl+S => Save
                e.preventDefault();
                handleSave();
            } else if (key === 's' || key === 'S') {
                // Just S => Segmentation
                setSelectedTool('segmentation');
            }

            // Esc => cancel shape
            if (key === 'Escape') {
                const event = new CustomEvent('cancel-annotation');
                window.dispatchEvent(event);
            }
            // Next / Prev
            if (key === 'ArrowRight') {
                handleNext();
            } else if (key === 'ArrowLeft') {
                handlePrev();
            }

            // Undo / Redo
            if (e.ctrlKey && (key === 'z' || key === 'Z')) {
                e.preventDefault();
                undo();
            } else if (e.ctrlKey && (key === 'y' || key === 'Y')) {
                e.preventDefault();
                redo();
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
        // eslint-disable-next-line
    }, [annotations, undoStack, redoStack]);

    // -------------- Export Logic --------------
    const [exportOpen, setExportOpen] = useState(false);
    const openExport = () => setExportOpen(true);
    const closeExport = () => setExportOpen(false);

    const exportAnnotations = (format) => {
        if (format === 'coco') {
            downloadCOCO();
        } else if (format === 'yolo') {
            downloadYOLO();
        } else if (format === 'pascal') {
            downloadPascal();
        }
        closeExport();
    };

    function downloadFile(url, filename) {
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    function downloadCOCO() {
        alert('COCO export not yet implemented!');
    }
    function downloadYOLO() {
        alert('YOLO export not yet implemented!');
    }
    function downloadPascal() {
        alert('Pascal VOC export not yet implemented!');
    }

    // -------------- When annotation finishes => switch to move --------------
    const handleFinishShape = () => {
        setSelectedTool('move');
    };

    return (
        <div className="annotate-container">
            <AnnotationTopBar
                onHome={() => navigate('/')}
                onPrev={handlePrev}
                onNext={handleNext}
                onSave={handleSave}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onExport={openExport}
                currentIndex={currentIndex}
                total={files.length}
                taskName={taskName}
            />

            <div style={{ padding: '8px', background: '#eee' }}>
                <button onClick={undo} style={{ marginRight: '8px' }}>
                    Undo (Ctrl+Z)
                </button>
                <button onClick={redo} style={{ marginRight: '8px' }}>
                    Redo (Ctrl+Y)
                </button>
                <button onClick={handleFillBackground} style={{ marginRight: '8px' }}>
                    Fill Background
                </button>
            </div>

            <div className="annotate-main">
                {/* Tools Sidebar */}
                <div className="tools-sidebar">
                    <h3>Tools</h3>
                    <label>
                        <input
                            type="radio"
                            name="tool"
                            value="move"
                            checked={selectedTool === 'move'}
                            onChange={() => setSelectedTool('move')}
                        />
                        <span className="tool-icon">👆</span> Move (M)
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="tool"
                            value="polygon"
                            checked={selectedTool === 'polygon'}
                            onChange={() => setSelectedTool('polygon')}
                        />
                        <span className="tool-icon">🔺</span> Polygon (P)
                    </label>
                    <label>
                        <input
                            type="radio"
                            name="tool"
                            value="segmentation"
                            checked={selectedTool === 'segmentation'}
                            onChange={() => setSelectedTool('segmentation')}
                        />
                        <span className="tool-icon">🎨</span> Segmentation (S)
                    </label>
                    {selectedTool === 'segmentation' && (
                        <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                            <label style={{ display: 'block', marginBottom: '4px' }}>
                                Type:
                            </label>
                            <select
                                value={segmentationType}
                                onChange={(e) => setSegmentationType(e.target.value)}
                            >
                                <option value="instance">Instance</option>
                                <option value="semantic">Semantic</option>
                                <option value="panoptic">Panoptic</option>
                            </select>
                        </div>
                    )}
                    {selectedTool === 'segmentation' && segmentationType === 'panoptic' && (
                        <div style={{ marginLeft: '20px', marginBottom: '8px' }}>
                            <label>
                                <input
                                    type="radio"
                                    name="panopticOption"
                                    value="instance"
                                    checked={panopticOption === 'instance'}
                                    onChange={() => setPanopticOption('instance')}
                                />
                                Instance
                            </label>
                            <label style={{ marginLeft: '8px' }}>
                                <input
                                    type="radio"
                                    name="panopticOption"
                                    value="semantic"
                                    checked={panopticOption === 'semantic'}
                                    onChange={() => setPanopticOption('semantic')}
                                />
                                Semantic
                            </label>
                        </div>
                    )}

                    <h3 style={{ marginTop: 16 }}>Active Label</h3>
                    <select
                        value={selectedLabelClass}
                        onChange={(e) => setSelectedLabelClass(e.target.value)}
                    >
                        {labelClasses.map((lc, i) => (
                            <option key={i} value={lc.name}>
                                {lc.name}
                            </option>
                        ))}
                    </select>

                    <div className="note-area">
                        <p>
                            <strong>Shortcuts:</strong>
                        </p>
                        <ul>
                            <li>M/P/S => Tools</li>
                            <li>S => Segmentation</li>
                            <li>Ctrl+S => Save</li>
                            <li>Esc => Cancel shape</li>
                            <li>ArrowLeft => Prev image</li>
                            <li>ArrowRight => Next image</li>
                            <li>Ctrl+Z => Undo</li>
                            <li>Ctrl+Y => Redo</li>
                            <li>Ctrl+C => Copy selected</li>
                            <li>Ctrl+V => Paste annotation</li>
                        </ul>
                    </div>
                </div>

                {/* Canvas */}
                <div className="canvas-area">
                    {currentFileUrl ? (
                        <SegmentationCanvas
                            fileUrl={currentFileUrl}
                            annotations={currentShapes}
                            onAnnotationsChange={handleAnnotationsChange}
                            selectedTool={selectedTool}
                            scale={scale}
                            onWheelZoom={handleWheelZoom}
                            activeLabelColor={
                                labelClasses.find((l) => l.name === selectedLabelClass)?.color ||
                                '#ff0000'
                            }
                            onFinishShape={handleFinishShape}
                            onDeleteAnnotation={handleDeleteAnnotation}
                            activeLabel={selectedLabelClass}
                            labelClasses={labelClasses}
                            // Pass segmentationType and panopticOption to the canvas
                            segmentationType={segmentationType}
                            panopticOption={panopticOption}
                        />
                    ) : (
                        <div style={{ textAlign: 'center', margin: 'auto' }}>
                            No images found
                        </div>
                    )}
                </div>

                <AnnotationListSidebar
                    annotations={currentShapes}
                    onDeleteAnnotation={handleDeleteAnnotation}
                    onUpdateAnnotation={handleUpdateAnnotation}
                    labelClasses={labelClasses}
                />
            </div>

            {exportOpen && (
                <div className="export-modal-backdrop">
                    <div className="export-modal">
                        <h2>Export Annotations</h2>
                        <p>Select format:</p>
                        <div className="export-buttons">
                            <button onClick={() => exportAnnotations('coco')}>COCO</button>
                            <button onClick={() => exportAnnotations('yolo')}>YOLO</button>
                            <button onClick={() => exportAnnotations('pascal')}>Pascal VOC</button>
                        </div>
                        <button className="close-btn" onClick={closeExport}>
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
