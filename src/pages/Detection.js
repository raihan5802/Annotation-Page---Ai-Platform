import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AnnotationTopBar from '../components/AnnotationTopBar';
import DetectionCanvas from '../components/DetectionCanvas';
import AnnotationListSidebar from '../components/AnnotationListSidebar';
import './Detection.css';

export default function Detection() {
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

  // Tools: move, bbox, polygon, polyline, point, ellipse
  const [selectedTool, setSelectedTool] = useState('move');

  // Active label state – we now use a local labelClasses list for modification
  const [selectedLabelClass, setSelectedLabelClass] = useState(
    labelClasses[0]?.name || ''
  );
  const [localLabelClasses, setLocalLabelClasses] = useState(labelClasses);

  const [scale, setScale] = useState(1.0);
  const currentFileUrl = files[currentIndex]?.url;
  const currentShapes = annotations[currentFileUrl] || [];

  // New state for points‐limit modal for polygon, polyline, and point tools
  const [showPointsLimitModal, setShowPointsLimitModal] = useState(false);
  const [pointsLimitInput, setPointsLimitInput] = useState('');
  const [pendingTool, setPendingTool] = useState('');
  const [currentPointsLimit, setCurrentPointsLimit] = useState(0);

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
      const bgAnn = computeBackgroundPolygon(width, height, currentShapes, localLabelClasses);
      // Remove any existing background annotation (by label)
      const newShapes = currentShapes.filter(
        (ann) => ann.label.toLowerCase() !== 'background'
      );
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
      if (ann.type === 'bbox') {
        const hole = [
          { x: ann.x, y: ann.y },
          { x: ann.x + ann.width, y: ann.y },
          { x: ann.x + ann.width, y: ann.y + ann.height },
          { x: ann.x, y: ann.y + ann.height },
        ];
        holes.push(hole);
      } else if (ann.type === 'polygon') {
        if (ann.label.toLowerCase() !== 'background') {
          holes.push(ann.points);
        }
      } else if (ann.type === 'ellipse') {
        const hole = [];
        const numPoints = 20;
        for (let i = 0; i < numPoints; i++) {
          const angle = (2 * Math.PI * i) / numPoints;
          const x = ann.x + ann.radiusX * Math.cos(angle);
          const y = ann.y + ann.radiusY * Math.sin(angle);
          hole.push({ x, y });
        }
        holes.push(hole);
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

      if (key === 'm' || key === 'M') {
        handleToolChange('move');
      } else if (key === 'b' || key === 'B') {
        handleToolChange('bbox');
      } else if (key === 'p' || key === 'P') {
        handleToolChange('polygon');
      } else if (key === 'l' || key === 'L') {
        handleToolChange('polyline');
      } else if (key === 'o' || key === 'O') {
        handleToolChange('point');
      } else if (key === 'e' || key === 'E') {
        handleToolChange('ellipse');
      } else if ((key === 's' || key === 'S') && e.ctrlKey) {
        e.preventDefault();
        handleSave();
      }

      if (key === 'Escape') {
        const event = new CustomEvent('cancel-annotation');
        window.dispatchEvent(event);
      }
      if (key === 'ArrowRight') {
        handleNext();
      } else if (key === 'ArrowLeft') {
        handlePrev();
      }
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
  }, [annotations, undoStack, redoStack]);

  // -------------- Add Label Modal --------------
  const [showAddLabelModal, setShowAddLabelModal] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#ff0000');

  // Candidate colors for auto-selection
  const CANDIDATE_COLORS = [
    '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
    '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
    '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
    '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
  ];

  // Helper: shadeColor (same as used elsewhere)
  function shadeColor(col, amt) {
    let usePound = false;
    let color = col;
    if (color[0] === '#') {
      color = color.slice(1);
      usePound = true;
    }
    let R = parseInt(color.substring(0, 2), 16);
    let G = parseInt(color.substring(2, 4), 16);
    let B = parseInt(color.substring(4, 6), 16);

    R = Math.min(255, Math.max(0, R + amt));
    G = Math.min(255, Math.max(0, G + amt));
    B = Math.min(255, Math.max(0, B + amt));

    const RR = R.toString(16).padStart(2, '0');
    const GG = G.toString(16).padStart(2, '0');
    const BB = B.toString(16).padStart(2, '0');

    return (usePound ? '#' : '') + RR + GG + BB;
  }

  // Compute the next available color (checking both label colors and their instance variations)
  function getNextAvailableColor() {
    const usedColors = new Set();
    const offsets = [0, -50, -100, -150, -200];
    localLabelClasses.forEach((lc) => {
      usedColors.add(lc.color.toLowerCase());
      offsets.forEach((offset) => {
        usedColors.add(shadeColor(lc.color, offset).toLowerCase());
      });
    });
    for (let color of CANDIDATE_COLORS) {
      if (!usedColors.has(color.toLowerCase())) {
        return color;
      }
    }
    return CANDIDATE_COLORS[0];
  }

  // When the add-label modal is opened, automatically select a new color
  useEffect(() => {
    if (showAddLabelModal) {
      setNewLabelColor(getNextAvailableColor());
    }
  }, [showAddLabelModal, localLabelClasses]);

  const handleAddNewLabel = () => {
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
    const colorExists = localLabelClasses.some(
      (lc) => lc.color.toLowerCase() === newLabelColor.trim().toLowerCase()
    );
    if (colorExists) {
      alert('Label color already used. Please choose a different color.');
      return;
    }
    const newLabel = { name: newLabelName.trim(), color: newLabelColor };
    setLocalLabelClasses([...localLabelClasses, newLabel]);
    setSelectedLabelClass(newLabel.name);
    setNewLabelName('');
    setNewLabelColor('#ff0000');
    setShowAddLabelModal(false);
  };

  // -------------- When annotation finishes => switch to move --------------
  const handleFinishShape = () => {
    setSelectedTool('move');
  };

  // Function to handle tool changes so that for polygon, polyline, and point a modal is shown
  const handleToolChange = (tool) => {
    if (['polygon', 'polyline', 'point'].includes(tool)) {
      setPendingTool(tool);
      setShowPointsLimitModal(true);
    } else {
      setSelectedTool(tool);
    }
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
        onExport={() => { }}
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
              onChange={() => handleToolChange('move')}
            />
            <span className="tool-icon">👆</span> Move (M)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="bbox"
              checked={selectedTool === 'bbox'}
              onChange={() => handleToolChange('bbox')}
            />
            <span className="tool-icon">⬛</span> BBox (B)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="polygon"
              checked={selectedTool === 'polygon'}
              onChange={() => handleToolChange('polygon')}
            />
            <span className="tool-icon">🔺</span> Polygon (P)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="polyline"
              checked={selectedTool === 'polyline'}
              onChange={() => handleToolChange('polyline')}
            />
            <span className="tool-icon">📈</span> Polyline (L)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="point"
              checked={selectedTool === 'point'}
              onChange={() => handleToolChange('point')}
            />
            <span className="tool-icon">📍</span> Point (O)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="ellipse"
              checked={selectedTool === 'ellipse'}
              onChange={() => handleToolChange('ellipse')}
            />
            <span className="tool-icon">⬭</span> Ellipse (E)
          </label>

          <h3 style={{ marginTop: 16 }}>Active Label</h3>
          <div style={{ display: 'flex', alignItems: 'center' }}>
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
            <button onClick={() => setShowAddLabelModal(true)} style={{ marginLeft: '8px' }}>
              Add Label
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="canvas-area">
          {currentFileUrl ? (
            <DetectionCanvas
              fileUrl={currentFileUrl}
              annotations={currentShapes}
              onAnnotationsChange={handleAnnotationsChange}
              selectedTool={selectedTool}
              scale={scale}
              onWheelZoom={handleWheelZoom}
              activeLabelColor={
                localLabelClasses.find((l) => l.name === selectedLabelClass)?.color ||
                '#ff0000'
              }
              onFinishShape={handleFinishShape}
              onDeleteAnnotation={handleDeleteAnnotation}
              activeLabel={selectedLabelClass}
              labelClasses={localLabelClasses}
              pointsLimit={currentPointsLimit}
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
          labelClasses={localLabelClasses}
        />
      </div>

      {showAddLabelModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '300px'
            }}
          >
            <h3>Add New Label</h3>
            <div>
              <input
                type="text"
                placeholder="Label Name"
                value={newLabelName}
                onChange={(e) => setNewLabelName(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              />
            </div>
            <div>
              <input
                type="color"
                value={newLabelColor}
                onChange={(e) => setNewLabelColor(e.target.value)}
                style={{ marginBottom: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleAddNewLabel} style={{ marginRight: '8px' }}>
                Add
              </button>
              <button onClick={() => setShowAddLabelModal(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showPointsLimitModal && (
        <div
          className="modal-backdrop"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            className="modal"
            style={{
              background: '#fff',
              padding: '20px',
              borderRadius: '8px',
              minWidth: '300px'
            }}
          >
            <h3>
              {pendingTool.charAt(0).toUpperCase() + pendingTool.slice(1)} Annotation Points Limit
            </h3>
            <div>
              <input
                type="number"
                placeholder="Number of points (0 for unlimited)"
                value={pointsLimitInput}
                onChange={(e) => setPointsLimitInput(e.target.value)}
                style={{ width: '100%', marginBottom: '10px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const limit = parseInt(pointsLimitInput);
                  setCurrentPointsLimit(isNaN(limit) ? 0 : limit);
                  setSelectedTool(pendingTool);
                  setShowPointsLimitModal(false);
                  setPointsLimitInput('');
                }}
                style={{ marginRight: '8px' }}
              >
                Shape
              </button>
              <button
                onClick={() => {
                  setShowPointsLimitModal(false);
                  setPointsLimitInput('');
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
