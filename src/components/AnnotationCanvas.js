import React, { useEffect, useRef, useState } from 'react';
import {
  Stage,
  Layer,
  Group,
  Image as KonvaImage,
  Rect,
  Line,
  Circle,
  Ellipse,
  Arrow,
  // REMOVED Transformer,
} from 'react-konva';
import './AnnotationCanvas.css';

export default function AnnotationCanvas({
  fileUrl,
  annotations,
  onAnnotationsChange,
  selectedTool, // 'move', 'bbox', 'polygon', 'polyline', 'point', 'ellipse'
  scale,
  onWheelZoom,
  activeLabelColor,
  onFinishShape,
}) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  // REMOVED references for bounding box / ellipse transforms
  // const rectRefs = useRef([]);
  // const ellipseRefs = useRef([]);
  // const transformerRef = useRef(null);

  // REMOVED selectedShapeIndex
  // const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);

  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [konvaImg, setKonvaImg] = useState(null);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });

  // In-progress shapes
  const [newBox, setNewBox] = useState(null);
  const [tempPoints, setTempPoints] = useState([]);
  const [drawingPolygon, setDrawingPolygon] = useState(false);
  const [tempPolyline, setTempPolyline] = useState([]);
  const [drawingPolyline, setDrawingPolyline] = useState(false);
  const [newEllipse, setNewEllipse] = useState(null);

  // ------------------ Setup/Resize the Canvas ------------------
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setDims({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ------------------ Load the Image ------------------
  useEffect(() => {
    if (!fileUrl) return;
    const img = new Image();
    img.src = fileUrl;
    img.onload = () => {
      setKonvaImg(img);
      setImagePos({ x: 0, y: 0 }); // reset
    };
    img.onerror = () => console.error('Could not load image:', fileUrl);
  }, [fileUrl]);

  // Flatten array of {x,y} => [x,y,x,y,...]
  const flattenPoints = (pts) => pts.flatMap((p) => [p.x, p.y]);

  // Return { x1, y1, x2, y2 } bounding box for a shape
  const shapeBoundingBox = (ann) => {
    if (ann.type === 'bbox') {
      return {
        x1: ann.x,
        y1: ann.y,
        x2: ann.x + ann.width,
        y2: ann.y + ann.height,
      };
    } else if (ann.type === 'ellipse') {
      return {
        x1: ann.x - ann.radiusX,
        y1: ann.y - ann.radiusY,
        x2: ann.x + ann.radiusX,
        y2: ann.y + ann.radiusY,
      };
    } else if (ann.type === 'polygon' || ann.type === 'polyline') {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      ann.points.forEach((pt) => {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });
      return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    } else if (ann.type === 'point') {
      return {
        x1: ann.x,
        y1: ann.y,
        x2: ann.x,
        y2: ann.y,
      };
    }
    return null;
  };

  const isOutsideImage = (ann) => {
    if (!konvaImg) return false;
    const { x1, y1, x2, y2 } = shapeBoundingBox(ann);
    if (x2 < 0 || x1 > konvaImg.width || y2 < 0 || y1 > konvaImg.height) {
      return true;
    }
    return false;
  };

  const getGroupPos = (evt) => {
    const group = stageRef.current?.findOne('#anno-group');
    return group ? group.getRelativePointerPosition() : null;
  };

  // ------------------ BBox ------------------
  const startBox = (pos) => {
    setNewBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };
  const updateBox = (pos) => {
    if (!newBox) return;
    setNewBox({
      ...newBox,
      width: pos.x - newBox.x,
      height: pos.y - newBox.y,
    });
  };
  const finalizeBox = () => {
    if (!newBox) return;
    const newAnn = { type: 'bbox', ...newBox, label: '' };
    if (!isOutsideImage(newAnn)) {
      onAnnotationsChange([...annotations, newAnn]);
    }
    setNewBox(null);
    onFinishShape && onFinishShape();
  };

  // ------------------ Polygon ------------------
  const addPolygonPoint = (pos) => {
    setTempPoints((prev) => [...prev, pos]);
    setDrawingPolygon(true);
  };
  const removeLastPolygonPoint = () => {
    setTempPoints((prev) => prev.slice(0, -1));
  };
  const finalizePolygon = () => {
    if (tempPoints.length >= 3) {
      const newAnn = { type: 'polygon', points: tempPoints, label: '' };
      if (!isOutsideImage(newAnn)) {
        onAnnotationsChange([...annotations, newAnn]);
      }
    }
    setTempPoints([]);
    setDrawingPolygon(false);
    onFinishShape && onFinishShape();
  };

  // ------------------ Polyline ------------------
  const addPolylinePoint = (pos) => {
    setTempPolyline((prev) => [...prev, pos]);
    setDrawingPolyline(true);
  };
  const removeLastPolylinePoint = () => {
    setTempPolyline((prev) => prev.slice(0, -1));
  };
  const finalizePolyline = () => {
    if (tempPolyline.length >= 2) {
      const newAnn = { type: 'polyline', points: tempPolyline, label: '' };
      if (!isOutsideImage(newAnn)) {
        onAnnotationsChange([...annotations, newAnn]);
      }
    }
    setTempPolyline([]);
    setDrawingPolyline(false);
    onFinishShape && onFinishShape();
  };

  // ------------------ Point ------------------
  const addPoint = (pos) => {
    const newAnn = { type: 'point', x: pos.x, y: pos.y, label: '' };
    if (!isOutsideImage(newAnn)) {
      onAnnotationsChange([...annotations, newAnn]);
    }
    onFinishShape && onFinishShape();
  };

  // ------------------ Ellipse ------------------
  const startEllipse = (pos) => {
    setNewEllipse({
      type: 'ellipse',
      x: pos.x,
      y: pos.y,
      radiusX: 0,
      radiusY: 0,
      rotation: 0,
      label: '',
    });
  };
  const updateEllipse = (pos) => {
    if (!newEllipse) return;
    const rx = Math.abs(pos.x - newEllipse.x);
    const ry = Math.abs(pos.y - newEllipse.y);
    setNewEllipse({
      ...newEllipse,
      radiusX: rx,
      radiusY: ry,
    });
  };
  const finalizeEllipse = () => {
    if (!newEllipse) return;
    if (!isOutsideImage(newEllipse)) {
      onAnnotationsChange([...annotations, { ...newEllipse }]);
    }
    setNewEllipse(null);
    onFinishShape && onFinishShape();
  };

  // ------------------ Mouse Events ------------------
  const handleMouseDown = (evt) => {
    if (selectedTool === 'move') {
      // Still allow panning the background if in 'move' mode
      return;
    }
    const pos = getGroupPos(evt);
    if (!pos) return;

    // We no longer do shape selection => removing setSelectedShapeIndex(null);

    if (selectedTool === 'bbox') {
      startBox(pos);
    } else if (selectedTool === 'polygon') {
      addPolygonPoint(pos);
    } else if (selectedTool === 'polyline') {
      addPolylinePoint(pos);
    } else if (selectedTool === 'point') {
      addPoint(pos);
    } else if (selectedTool === 'ellipse') {
      startEllipse(pos);
    }
  };

  const handleMouseMove = (evt) => {
    if (selectedTool === 'bbox' && newBox) {
      const pos = getGroupPos(evt);
      if (pos) updateBox(pos);
    } else if (selectedTool === 'ellipse' && newEllipse) {
      const pos = getGroupPos(evt);
      if (pos) updateEllipse(pos);
    }
  };

  const handleMouseUp = () => {
    if (selectedTool === 'bbox' && newBox) {
      finalizeBox();
    } else if (selectedTool === 'ellipse' && newEllipse) {
      finalizeEllipse();
    }
  };

  const handleDblClick = () => {
    if (selectedTool === 'polygon' && drawingPolygon) {
      finalizePolygon();
    } else if (selectedTool === 'polyline' && drawingPolyline) {
      finalizePolyline();
    }
  };

  // -------------- ESC = Cancel shape --------------
  useEffect(() => {
    const onCancelAnnotation = () => {
      setNewBox(null);
      setTempPoints([]);
      setDrawingPolygon(false);
      setTempPolyline([]);
      setDrawingPolyline(false);
      setNewEllipse(null);
    };
    window.addEventListener('cancel-annotation', onCancelAnnotation);
    return () => window.removeEventListener('cancel-annotation', onCancelAnnotation);
  }, []);

  // -------------- Wheel Zoom --------------
  const handleWheel = (evt) => {
    evt.evt.preventDefault();
    onWheelZoom(evt.evt.deltaY);
  };

  // REMOVED entire Transformer logic
  // (no selection, no shape transform)

  // -------------- Polygon / Polyline (No vertex dragging) --------------
  // Instead of making each vertex draggable, we'll just display them.

  function NonEditablePolygon({ ann, color, sc }) {
    // We don't make it draggable; we only draw it.
    const firstPt = ann.points[0];
    const secondPt = ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };

    return (
      <Group>
        <Line
          points={flattenPoints(ann.points)}
          fill={color + '55'}
          stroke={color}
          strokeWidth={2 / sc}
          closed
        />
        {/* Arrow to show start */}
        <Arrow
          points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
          fill={color}
          stroke={color}
          strokeWidth={2 / sc}
          pointerLength={10 / sc}
          pointerWidth={8 / sc}
        />
      </Group>
    );
  }

  function NonEditablePolyline({ ann, color, sc }) {
    const firstPt = ann.points[0];
    const secondPt = ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };

    return (
      <Group>
        <Line
          points={flattenPoints(ann.points)}
          stroke={color}
          strokeWidth={2 / sc}
          closed={false}
        />
        <Arrow
          points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
          fill={color}
          stroke={color}
          strokeWidth={2 / sc}
          pointerLength={10 / sc}
          pointerWidth={8 / sc}
        />
      </Group>
    );
  }

  function NonEditablePoint({ ann, color, sc }) {
    return (
      <Circle
        x={ann.x}
        y={ann.y}
        radius={6 / sc}
        fill={color}
      />
    );
  }

  const fillColor = activeLabelColor + '55';

  return (
    <div className="canvas-container" ref={containerRef}>
      <Stage
        ref={stageRef}
        width={dims.width}
        height={dims.height}
        scaleX={scale}
        scaleY={scale}
        style={{ background: '#dfe6e9' }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onDblClick={handleDblClick}
      >
        <Layer>
          <Group
            id="anno-group"
            draggable={selectedTool === 'move'} // allow panning if in move mode
            x={imagePos.x}
            y={imagePos.y}
            onDragEnd={(e) => {
              // user moved the background image only
              setImagePos({ x: e.target.x(), y: e.target.y() });
            }}
          >
            {konvaImg && (
              <KonvaImage
                image={konvaImg}
                width={konvaImg.width}
                height={konvaImg.height}
              />
            )}

            {/* Render existing shapes (non-movable) */}
            {annotations.map((ann, i) => {
              if (ann.type === 'bbox') {
                return (
                  <Rect
                    key={i}
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    fill={fillColor}
                    stroke={activeLabelColor}
                    strokeWidth={2 / scale}
                  />
                );
              } else if (ann.type === 'polygon') {
                return (
                  <NonEditablePolygon
                    key={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'polyline') {
                return (
                  <NonEditablePolyline
                    key={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'point') {
                return (
                  <NonEditablePoint
                    key={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'ellipse') {
                return (
                  <Ellipse
                    key={i}
                    x={ann.x}
                    y={ann.y}
                    radiusX={ann.radiusX}
                    radiusY={ann.radiusY}
                    rotation={ann.rotation || 0}
                    fill={fillColor}
                    stroke={activeLabelColor}
                    strokeWidth={2 / scale}
                  />
                );
              }
              return null;
            })}

            {/* In-progress BBox */}
            {newBox && selectedTool === 'bbox' && (
              <Rect
                x={newBox.x}
                y={newBox.y}
                width={newBox.width}
                height={newBox.height}
                fill={fillColor}
                stroke={activeLabelColor}
                strokeWidth={2 / scale}
              />
            )}

            {/* In-progress Polygon */}
            {drawingPolygon && tempPoints.length > 1 && selectedTool === 'polygon' && (
              <Line
                points={flattenPoints([...tempPoints, tempPoints[0]])}
                fill={fillColor}
                stroke={activeLabelColor}
                strokeWidth={2 / scale}
                closed
              />
            )}

            {/* In-progress Polyline */}
            {drawingPolyline && tempPolyline.length > 1 && selectedTool === 'polyline' && (
              <Line
                points={flattenPoints(tempPolyline)}
                stroke={activeLabelColor}
                strokeWidth={2 / scale}
                closed={false}
              />
            )}

            {/* In-progress Ellipse */}
            {newEllipse && selectedTool === 'ellipse' && (
              <Ellipse
                x={newEllipse.x}
                y={newEllipse.y}
                radiusX={newEllipse.radiusX}
                radiusY={newEllipse.radiusY}
                rotation={0}
                fill={fillColor}
                stroke={activeLabelColor}
                strokeWidth={2 / scale}
              />
            )}
          </Group>

          {/* REMOVED Transformer entirely */}
        </Layer>
      </Stage>
    </div>
  );
}
