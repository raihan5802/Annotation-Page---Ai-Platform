// src/pages/Annotate.js

import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import AnnotationTopBar from '../components/AnnotationTopBar';
import AnnotationCanvas from '../components/AnnotationCanvas';
import AnnotationListSidebar from '../components/AnnotationListSidebar';
import './Annotate.css';

export default function Annotate() {
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

  const [annotations, setAnnotations] = useState({});
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  // Tools: move, bbox, polygon, polyline, point, ellipse
  const [selectedTool, setSelectedTool] = useState('move');
  const [selectedLabelClass, setSelectedLabelClass] = useState(
    labelClasses[0]?.name || ''
  );
  const [scale, setScale] = useState(1.0);

  const currentFileUrl = files[currentIndex]?.url;
  const currentShapes = annotations[currentFileUrl] || [];

  const handleAnnotationsChange = (newShapes) => {
    const updatedAnnotations = {
      ...annotations,
      [currentFileUrl]: newShapes,
    };
    setUndoStack([...undoStack, annotations]);
    setRedoStack([]);
    setAnnotations(updatedAnnotations);
  };

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

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const handleNext = () => {
    if (currentIndex < files.length - 1) setCurrentIndex((i) => i + 1);
  };

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.1, 5));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.1, 0.2));
  const handleWheelZoom = (deltaY) => {
    if (deltaY < 0) handleZoomIn();
    else handleZoomOut();
  };

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

  const undo = () => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack([...redoStack, annotations]);
    setUndoStack(undoStack.slice(0, -1));
    setAnnotations(previous);
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack([...undoStack, annotations]);
    setRedoStack(redoStack.slice(0, -1));
    setAnnotations(next);
  };

  useEffect(() => {
    const handleKey = (e) => {
      const key = e.key;
      if (key === 'm' || key === 'M') {
        setSelectedTool('move');
      } else if (key === 'b' || key === 'B') {
        setSelectedTool('bbox');
      } else if (key === 'p' || key === 'P') {
        setSelectedTool('polygon');
      } else if (key === 'l' || key === 'L') {
        setSelectedTool('polyline');
      } else if (key === 'o' || key === 'O') {
        setSelectedTool('point');
      } else if (key === 'e' || key === 'E') {
        setSelectedTool('ellipse');
      } else if (key === 's' || key === 'S') {
        e.preventDefault();
        handleSave();
      } else if (key === 'Escape') {
        const event = new CustomEvent('cancel-annotation');
        window.dispatchEvent(event);
      } else if (key === 'ArrowRight') {
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

  function getBBoxFromPoints(points) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    points.forEach((pt) => {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    });
    return [minX, minY, maxX - minX, maxY - minY];
  }

  function downloadFile(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCOCO() {
    let images = [];
    let annotationsList = [];
    let annId = 1,
      imgId = 1;

    for (const [imageUrl, shapes] of Object.entries(annotations)) {
      const fileObj = files.find((f) => f.url === imageUrl);
      const imageName = fileObj?.originalname || 'unknown.jpg';
      images.push({ id: imgId, file_name: imageName, width: 0, height: 0 });

      shapes.forEach((shape) => {
        const catIndex = labelClasses.findIndex((l) => l.name === shape.label);
        const categoryId = catIndex >= 0 ? catIndex + 1 : 1;

        if (shape.type === 'bbox') {
          annotationsList.push({
            id: annId++,
            image_id: imgId,
            category_id: categoryId,
            bbox: [shape.x, shape.y, shape.width, shape.height],
            segmentation: [],
            area: Math.abs(shape.width * shape.height),
            iscrowd: 0,
          });
        } else if (shape.type === 'polygon') {
          const polygonPts = shape.points.flatMap((pt) => [pt.x, pt.y]);
          annotationsList.push({
            id: annId++,
            image_id: imgId,
            category_id: categoryId,
            segmentation: [polygonPts],
            bbox: getBBoxFromPoints(shape.points),
            area: 0,
            iscrowd: 0,
          });
        } else if (shape.type === 'polyline') {
          const linePts = shape.points.flatMap((pt) => [pt.x, pt.y]);
          annotationsList.push({
            id: annId++,
            image_id: imgId,
            category_id: categoryId,
            segmentation: [linePts],
            bbox: getBBoxFromPoints(shape.points),
            area: 0,
            iscrowd: 0,
          });
        } else if (shape.type === 'point') {
          annotationsList.push({
            id: annId++,
            image_id: imgId,
            category_id: categoryId,
            bbox: [shape.x, shape.y, 1, 1],
            segmentation: [],
            area: 1,
            iscrowd: 0,
          });
        } else if (shape.type === 'ellipse') {
          // We'll approximate an ellipse with a bounding box in COCO
          const ellipseBBox = [
            shape.x - shape.radiusX,
            shape.y - shape.radiusY,
            shape.radiusX * 2,
            shape.radiusY * 2,
          ];
          annotationsList.push({
            id: annId++,
            image_id: imgId,
            category_id: categoryId,
            bbox: ellipseBBox,
            segmentation: [],
            area: Math.PI * shape.radiusX * shape.radiusY,
            iscrowd: 0,
          });
        }
      });
      imgId++;
    }

    const categories = labelClasses.map((lc, i) => ({
      id: i + 1,
      name: lc.name,
      supercategory: 'none',
    }));
    const coco = { images, annotations: annotationsList, categories };

    const blob = new Blob([JSON.stringify(coco, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'coco_annotations.json');
  }

  function downloadYOLO() {
    let lines = [];
    for (const [imageUrl, shapes] of Object.entries(annotations)) {
      const fileObj = files.find((f) => f.url === imageUrl);
      const imageName = fileObj?.originalname || 'unknown.jpg';
      lines.push(`# YOLO for ${imageName}`);

      shapes.forEach((shape) => {
        const catIndex = labelClasses.findIndex((l) => l.name === shape.label);
        const classId = catIndex >= 0 ? catIndex : 0;

        if (shape.type === 'bbox') {
          const bx = shape.x + shape.width / 2;
          const by = shape.y + shape.height / 2;
          const bw = shape.width;
          const bh = shape.height;
          lines.push(
            `${classId} ${bx.toFixed(2)} ${by.toFixed(2)} ${bw.toFixed(2)} ${bh.toFixed(2)}`
          );
        } else if (
          shape.type === 'polygon' ||
          shape.type === 'polyline'
        ) {
          const [x, y, w, h] = getBBoxFromPoints(shape.points);
          const bx = x + w / 2;
          const by = y + h / 2;
          lines.push(
            `${classId} ${bx.toFixed(2)} ${by.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
          );
        } else if (shape.type === 'point') {
          const bx = shape.x + 0.5;
          const by = shape.y + 0.5;
          const bw = 1;
          const bh = 1;
          lines.push(
            `${classId} ${bx.toFixed(2)} ${by.toFixed(2)} ${bw.toFixed(2)} ${bh.toFixed(2)}`
          );
        } else if (shape.type === 'ellipse') {
          // YOLO doesn't support ellipse natively, so approximate with bounding box
          const x = shape.x - shape.radiusX;
          const y = shape.y - shape.radiusY;
          const w = shape.radiusX * 2;
          const h = shape.radiusY * 2;
          const bx = x + w / 2;
          const by = y + h / 2;
          lines.push(
            `${classId} ${bx.toFixed(2)} ${by.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`
          );
        }
      });
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'yolo_annotations.txt');
  }

  function downloadPascal() {
    let output = [];
    output.push(`<pascal_voc_annotations>`);

    for (const [imageUrl, shapes] of Object.entries(annotations)) {
      const fileObj = files.find((f) => f.url === imageUrl);
      const imageName = fileObj?.originalname || 'unknown.jpg';
      output.push(`  <image file="${imageName}">`);

      shapes.forEach((shape) => {
        const label = shape.label || 'unknown';

        if (shape.type === 'bbox') {
          const xmin = shape.x,
            ymin = shape.y;
          const xmax = shape.x + shape.width,
            ymax = shape.y + shape.height;
          output.push(`    <object>`);
          output.push(`      <name>${label}</name>`);
          output.push(
            `      <bndbox><xmin>${xmin}</xmin><ymin>${ymin}</ymin><xmax>${xmax}</xmax><ymax>${ymax}</ymax></bndbox>`
          );
          output.push(`    </object>`);
        } else if (shape.type === 'polygon' || shape.type === 'polyline') {
          const [x, y, w, h] = getBBoxFromPoints(shape.points);
          const xmin = x,
            ymin = y;
          const xmax = x + w,
            ymax = y + h;
          output.push(`    <object>`);
          output.push(`      <name>${label}</name>`);
          output.push(
            `      <bndbox><xmin>${xmin}</xmin><ymin>${ymin}</ymin><xmax>${xmax}</xmax><ymax>${ymax}</ymax></bndbox>`
          );
          output.push(`    </object>`);
        } else if (shape.type === 'point') {
          const xmin = shape.x,
            ymin = shape.y;
          const xmax = shape.x + 1;
          const ymax = shape.y + 1;
          output.push(`    <object>`);
          output.push(`      <name>${label}</name>`);
          output.push(
            `      <bndbox><xmin>${xmin}</xmin><ymin>${ymin}</ymin><xmax>${xmax}</xmax><ymax>${ymax}</ymax></bndbox>`
          );
          output.push(`    </object>`);
        } else if (shape.type === 'ellipse') {
          // For Pascal, store the bounding box around the ellipse
          const xmin = shape.x - shape.radiusX;
          const ymin = shape.y - shape.radiusY;
          const xmax = shape.x + shape.radiusX;
          const ymax = shape.y + shape.radiusY;
          output.push(`    <object>`);
          output.push(`      <name>${label}</name>`);
          output.push(
            `      <bndbox><xmin>${xmin}</xmin><ymin>${ymin}</ymin><xmax>${xmax}</xmax><ymax>${ymax}</ymax></bndbox>`
          );
          output.push(`    </object>`);
        }
      });

      output.push(`  </image>`);
    }
    output.push(`</pascal_voc_annotations>`);
    const xmlStr = output.join('\n');
    const blob = new Blob([xmlStr], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    downloadFile(url, 'pascal_annotations.xml');
  }

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
      </div>

      <div className="annotate-main">
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
            Move (M)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="bbox"
              checked={selectedTool === 'bbox'}
              onChange={() => setSelectedTool('bbox')}
            />
            BBox (B)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="polygon"
              checked={selectedTool === 'polygon'}
              onChange={() => setSelectedTool('polygon')}
            />
            Polygon (P)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="polyline"
              checked={selectedTool === 'polyline'}
              onChange={() => setSelectedTool('polyline')}
            />
            Polyline (L)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="point"
              checked={selectedTool === 'point'}
              onChange={() => setSelectedTool('point')}
            />
            Point (O)
          </label>
          <label>
            <input
              type="radio"
              name="tool"
              value="ellipse"
              checked={selectedTool === 'ellipse'}
              onChange={() => setSelectedTool('ellipse')}
            />
            Ellipse (E)
          </label>

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
            <p><strong>Shortcuts:</strong></p>
            <ul>
              <li>M/B/P/L/O/E => Tools</li>
              <li>S => Save</li>
              <li>Esc => Cancel shape</li>
              <li>ArrowLeft => Prev image</li>
              <li>ArrowRight => Next image</li>
              <li>Ctrl+Z => Undo</li>
              <li>Ctrl+Y => Redo</li>
            </ul>
          </div>
        </div>

        <div className="canvas-area">
          {currentFileUrl ? (
            <AnnotationCanvas
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
