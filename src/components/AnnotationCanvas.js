// src/components/AnnotationCanvas.js

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
  Transformer
} from 'react-konva';
import './AnnotationCanvas.css';

export default function AnnotationCanvas({
  fileUrl,
  annotations,
  onAnnotationsChange,
  selectedTool, // move, bbox, polygon, polyline, point, ellipse
  scale,
  onWheelZoom,
  activeLabelColor
}) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  const rectRefs = useRef([]);
  const ellipseRefs = useRef([]);
  const transformerRef = useRef(null);

  const [selectedShapeIndex, setSelectedShapeIndex] = useState(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [konvaImg, setKonvaImg] = useState(null);
  const [imagePos, setImagePos] = useState({ x: 0, y: 0 });

  // BBox
  const [newBox, setNewBox] = useState(null);

  // Polygon
  const [tempPoints, setTempPoints] = useState([]);
  const [drawingPolygon, setDrawingPolygon] = useState(false);

  // Polyline
  const [tempPolyline, setTempPolyline] = useState([]);
  const [drawingPolyline, setDrawingPolyline] = useState(false);

  // Ellipse
  const [newEllipse, setNewEllipse] = useState(null);

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

  useEffect(() => {
    if (!fileUrl) return;
    const img = new Image();
    img.src = fileUrl;
    img.onload = () => {
      setKonvaImg(img);
      setImagePos({ x: 0, y: 0 });
    };
    img.onerror = () => console.error('Could not load image:', fileUrl);
  }, [fileUrl]);

  const flattenPoints = (pts) => pts.flatMap((p) => [p.x, p.y]);

  const getGroupPos = (evt) => {
    const group = stageRef.current?.findOne('#anno-group');
    return group ? group.getRelativePointerPosition() : null;
  };

  // BBox
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
    onAnnotationsChange([
      ...annotations,
      { type: 'bbox', ...newBox, label: '' },
    ]);
    setNewBox(null);
  };

  // Polygon
  const addPolygonPoint = (pos) => {
    setTempPoints((prev) => [...prev, pos]);
    setDrawingPolygon(true);
  };
  const removeLastPolygonPoint = () => {
    setTempPoints((prev) => prev.slice(0, -1));
  };
  const finalizePolygon = () => {
    if (tempPoints.length >= 3) {
      onAnnotationsChange([
        ...annotations,
        { type: 'polygon', points: tempPoints, label: '' },
      ]);
    }
    setTempPoints([]);
    setDrawingPolygon(false);
  };

  // Polyline
  const addPolylinePoint = (pos) => {
    setTempPolyline((prev) => [...prev, pos]);
    setDrawingPolyline(true);
  };
  const removeLastPolylinePoint = () => {
    setTempPolyline((prev) => prev.slice(0, -1));
  };
  const finalizePolyline = () => {
    if (tempPolyline.length >= 2) {
      onAnnotationsChange([
        ...annotations,
        { type: 'polyline', points: tempPolyline, label: '' },
      ]);
    }
    setTempPolyline([]);
    setDrawingPolyline(false);
  };

  // Point
  const addPoint = (pos) => {
    onAnnotationsChange([
      ...annotations,
      { type: 'point', x: pos.x, y: pos.y, label: '' },
    ]);
  };

  // Ellipse
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
    onAnnotationsChange([...annotations, { ...newEllipse }]);
    setNewEllipse(null);
  };

  // Mouse
  const handleMouseDown = (evt) => {
    if (selectedTool === 'move') return;
    const pos = getGroupPos(evt);
    if (!pos) return;
    setSelectedShapeIndex(null);

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

  const handleWheel = (evt) => {
    evt.evt.preventDefault();
    onWheelZoom(evt.evt.deltaY);
  };

  useEffect(() => {
    if (!transformerRef.current) return;
    const transformer = transformerRef.current;
    const shape = annotations[selectedShapeIndex];
    if (selectedShapeIndex == null || !shape) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    if (shape.type === 'bbox') {
      const rectNode = rectRefs.current[selectedShapeIndex];
      if (rectNode) {
        transformer.nodes([rectNode]);
        // no rotation for bounding boxes
        transformer.rotateEnabled(false);
        transformer.getLayer().batchDraw();
      }
    } else if (shape.type === 'ellipse') {
      const ellNode = ellipseRefs.current[selectedShapeIndex];
      if (ellNode) {
        transformer.nodes([ellNode]);
        // rotation allowed for ellipse
        transformer.rotateEnabled(true);
        transformer.getLayer().batchDraw();
      }
    } else {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedShapeIndex, annotations]);

  const handleRectDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y };
    onAnnotationsChange(updated);
  };
  const handleRectTransformEnd = (index, e) => {
    const node = e.target;
    const { x, y } = node.position();
    const width = node.width() * node.scaleX();
    const height = node.height() * node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y, width, height };
    onAnnotationsChange(updated);
  };

  const handleEllipseDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y };
    onAnnotationsChange(updated);
  };
  const handleEllipseTransformEnd = (index, e) => {
    const node = e.target;
    const { x, y } = node.position();
    // Konva Ellipse uses radius + scale
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const updated = [...annotations];
    updated[index] = {
      ...updated[index],
      x,
      y,
      radiusX: node.radiusX() * scaleX,
      radiusY: node.radiusY() * scaleY,
      rotation: node.rotation(),
    };
    node.scaleX(1);
    node.scaleY(1);
    onAnnotationsChange(updated);
  };

  function EditablePolygon({ ann, index, color, sc }) {
    const groupRef = useRef(null);

    const handleGroupDragEnd = (e) => {
      const { x, y } = e.target.position();
      const newPoints = ann.points.map((pt) => ({
        x: pt.x + x,
        y: pt.y + y,
      }));
      const updated = [...annotations];
      updated[index] = { ...ann, points: newPoints };
      onAnnotationsChange(updated);
      e.target.position({ x: 0, y: 0 });
    };

    const handleVertexDragMove = (ptIdx, e2) => {
      const { x, y } = e2.target.position();
      const newPoints = [...ann.points];
      newPoints[ptIdx] = { x, y };
      const updated = [...annotations];
      updated[index] = { ...ann, points: newPoints };
      onAnnotationsChange(updated);
    };

    const handleClick = (evt) => {
      evt.cancelBubble = true;
      setSelectedShapeIndex(null);
    };

    return (
      <Group
        ref={groupRef}
        draggable
        onDragEnd={handleGroupDragEnd}
        onClick={handleClick}
      >
        <Line
          points={flattenPoints(ann.points)}
          fill={color + '55'}
          stroke={color}
          strokeWidth={2 / sc}
          closed
        />
        {ann.points.map((pt, i) => (
          <Circle
            key={i}
            x={pt.x}
            y={pt.y}
            radius={6 / sc}
            fill="#ffffff"
            stroke={color}
            strokeWidth={2 / sc}
            draggable
            onDragMove={(evt) => handleVertexDragMove(i, evt)}
            onClick={(evt) => (evt.cancelBubble = true)}
          />
        ))}
      </Group>
    );
  }

  function EditablePolyline({ ann, index, color, sc }) {
    const groupRef = useRef(null);

    const handleGroupDragEnd = (e) => {
      const { x, y } = e.target.position();
      const newPoints = ann.points.map((pt) => ({
        x: pt.x + x,
        y: pt.y + y,
      }));
      const updated = [...annotations];
      updated[index] = { ...ann, points: newPoints };
      onAnnotationsChange(updated);
      e.target.position({ x: 0, y: 0 });
    };

    const handleVertexDragMove = (ptIdx, e2) => {
      const { x, y } = e2.target.position();
      const newPoints = [...ann.points];
      newPoints[ptIdx] = { x, y };
      const updated = [...annotations];
      updated[index] = { ...ann, points: newPoints };
      onAnnotationsChange(updated);
    };

    const handleClick = (evt) => {
      evt.cancelBubble = true;
      setSelectedShapeIndex(null);
    };

    return (
      <Group
        ref={groupRef}
        draggable
        onDragEnd={handleGroupDragEnd}
        onClick={handleClick}
      >
        <Line
          points={flattenPoints(ann.points)}
          stroke={color}
          strokeWidth={2 / sc}
          closed={false}
        />
        {ann.points.map((pt, i) => (
          <Circle
            key={i}
            x={pt.x}
            y={pt.y}
            radius={6 / sc}
            fill="#ffffff"
            stroke={color}
            strokeWidth={2 / sc}
            draggable
            onDragMove={(evt) => handleVertexDragMove(i, evt)}
            onClick={(evt) => (evt.cancelBubble = true)}
          />
        ))}
      </Group>
    );
  }

  function EditablePoint({ ann, index, color, sc }) {
    const circleRef = useRef(null);

    const handleDragEnd = (e) => {
      const { x, y } = e.target.position();
      const updated = [...annotations];
      updated[index] = { ...ann, x, y };
      onAnnotationsChange(updated);
    };

    const handleClick = (evt) => {
      evt.cancelBubble = true;
      setSelectedShapeIndex(null);
    };

    return (
      <Circle
        ref={circleRef}
        x={ann.x}
        y={ann.y}
        radius={6 / sc}
        fill={color}
        draggable
        onDragEnd={handleDragEnd}
        onClick={handleClick}
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
            draggable={selectedTool === 'move'}
            x={imagePos.x}
            y={imagePos.y}
            onDragEnd={(e) => {
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

            {annotations.map((ann, i) => {
              if (ann.type === 'bbox') {
                return (
                  <Rect
                    key={i}
                    ref={(node) => {
                      rectRefs.current[i] = node;
                    }}
                    x={ann.x}
                    y={ann.y}
                    width={ann.width}
                    height={ann.height}
                    fill={fillColor}
                    stroke={activeLabelColor}
                    strokeWidth={2 / scale}
                    draggable
                    onClick={(evt) => {
                      evt.cancelBubble = true;
                      setSelectedShapeIndex(i);
                    }}
                    onDragEnd={(evt) => handleRectDragEnd(i, evt)}
                    onTransformEnd={(evt) => handleRectTransformEnd(i, evt)}
                  />
                );
              } else if (ann.type === 'polygon') {
                return (
                  <EditablePolygon
                    key={i}
                    index={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'polyline') {
                return (
                  <EditablePolyline
                    key={i}
                    index={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'point') {
                return (
                  <EditablePoint
                    key={i}
                    index={i}
                    ann={ann}
                    color={activeLabelColor}
                    sc={scale}
                  />
                );
              } else if (ann.type === 'ellipse') {
                return (
                  <Ellipse
                    key={i}
                    ref={(node) => {
                      ellipseRefs.current[i] = node;
                    }}
                    x={ann.x}
                    y={ann.y}
                    radiusX={ann.radiusX}
                    radiusY={ann.radiusY}
                    rotation={ann.rotation || 0}
                    fill={fillColor}
                    stroke={activeLabelColor}
                    strokeWidth={2 / scale}
                    draggable
                    onClick={(evt) => {
                      evt.cancelBubble = true;
                      setSelectedShapeIndex(i);
                    }}
                    onDragEnd={(evt) => handleEllipseDragEnd(i, evt)}
                    onTransformEnd={(evt) => handleEllipseTransformEnd(i, evt)}
                  />
                );
              }
              return null;
            })}

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

            {drawingPolygon &&
              tempPoints.length > 1 &&
              selectedTool === 'polygon' && (
                <Line
                  points={flattenPoints([...tempPoints, tempPoints[0]])}
                  fill={fillColor}
                  stroke={activeLabelColor}
                  strokeWidth={2 / scale}
                  closed
                />
              )}

            {drawingPolyline &&
              tempPolyline.length > 1 &&
              selectedTool === 'polyline' && (
                <Line
                  points={flattenPoints(tempPolyline)}
                  stroke={activeLabelColor}
                  strokeWidth={2 / scale}
                  closed={false}
                />
              )}

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

          <Transformer
            ref={transformerRef}
            anchorCornerRadius={4}
            anchorStroke="#00BCD4"
            anchorFill="#00BCD4"
            borderStroke="#00BCD4"
          />
        </Layer>
      </Stage>
    </div>
  );
}
