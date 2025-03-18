// DetectionCanvas.js
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
  Transformer,
  Label,
  Tag,
  Text,
  Path,
} from 'react-konva';
import './DetectionCanvas.css';

// Helper function to flatten points
function flattenPoints(pts) {
  return pts.flatMap((p) => [p.x, p.y]);
}

// Helper function to create an SVG path for a polygon with holes.
function polygonToPath(outer, holes) {
  let path = 'M ' + outer[0].x + ' ' + outer[0].y + ' ';
  for (let i = 1; i < outer.length; i++) {
    path += 'L ' + outer[i].x + ' ' + outer[i].y + ' ';
  }
  path += 'Z ';
  if (holes && holes.length > 0) {
    holes.forEach((hole) => {
      if (hole.length > 0) {
        path += 'M ' + hole[0].x + ' ' + hole[0].y + ' ';
        for (let i = 1; i < hole.length; i++) {
          path += 'L ' + hole[i].x + ' ' + hole[i].y + ' ';
        }
        path += 'Z ';
      }
    });
  }
  return path;
}

export default function DetectionCanvas({
  fileUrl,
  annotations,
  onAnnotationsChange,
  selectedTool,
  scale,
  onWheelZoom,
  activeLabelColor,
  labelClasses,
  onFinishShape,
  onDeleteAnnotation,
  activeLabel,
  pointsLimit, // new prop for point-based tools
  initialPosition, // new prop for initial positioning
  externalSelectedIndex,  // ← New name
  onSelectAnnotation,     // ← New name
}) {
  const stageRef = useRef(null);
  const containerRef = useRef(null);

  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [konvaImg, setKonvaImg] = useState(null);
  const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);

  // Master group offset (image panning)
  const [imagePos, setImagePos] = useState(initialPosition || { x: 0, y: 0 });

  // In-progress shapes (while drawing)
  const [newBox, setNewBox] = useState(null);
  const [tempPoints, setTempPoints] = useState([]);
  const [drawingPolygon, setDrawingPolygon] = useState(false);
  const [tempPolyline, setTempPolyline] = useState([]);
  const [drawingPolyline, setDrawingPolyline] = useState(false);
  const [newEllipse, setNewEllipse] = useState(null);

  // Points annotation
  const [tempPointPoints, setTempPointPoints] = useState([]);
  const [drawingPoint, setDrawingPoint] = useState(false);

  // For selecting shape to transform (only for bbox, ellipse)
  const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);
  const transformerRef = useRef(null);

  // We'll store refs only for shapes that can be transformed: bbox, ellipse
  const shapeRefs = useRef([]);

  // Track last click time for double-click (finish polygon/polyline)
  const lastClickTimeRef = useRef(0);
  const doubleClickThreshold = 250; // ms

  // For copy/paste
  const [copiedAnnotation, setCopiedAnnotation] = useState(null);

  // For Ctrl+Click dragging feature for automatic annotation
  const [isDraggingWithCtrl, setIsDraggingWithCtrl] = useState(false);
  const [lastDragPoint, setLastDragPoint] = useState(null);
  const minDistanceBetweenPoints = 10; // Minimum pixel distance between points when dragging
  // For point reduction panel
  const [showPointReductionPanel, setShowPointReductionPanel] = useState(false);
  const [currentAnnotationPoints, setCurrentAnnotationPoints] = useState([]);
  const [currentAnnotationType, setCurrentAnnotationType] = useState('');
  const [distanceThreshold, setDistanceThreshold] = useState(10); // Default threshold
  const [originalPoints, setOriginalPoints] = useState([]); // Store original points for cancellation

  const [isShowingReducedPreview, setIsShowingReducedPreview] = useState(false);

  //For icon-change during annotation
  const crosshairCursor = `url('data:image/svg+xml;utf8,<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="10" x2="50" y2="45" stroke="black" stroke-width="2"/><line x1="50" y1="55" x2="50" y2="90" stroke="black" stroke-width="2"/><line x1="10" y1="50" x2="45" y2="50" stroke="black" stroke-width="2"/><line x1="55" y1="50" x2="90" y2="50" stroke="black" stroke-width="2"/><circle cx="50" cy="50" r="1" fill="black"/></svg>') 50 50, crosshair`;

  // Synchronize the internal state with the external one
  useEffect(() => {
    setSelectedAnnotationIndex(externalSelectedIndex);
  }, [externalSelectedIndex]);

  // ----------- Window / container sizing -----------
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current) return;
      setDims({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ----------- Load image -----------
  useEffect(() => {
    if (!fileUrl) return;
    const img = new window.Image();
    img.src = fileUrl;
    img.onload = () => {
      if (img.width === 0 || img.height === 0) {
        console.error("Loaded image has zero width or height:", fileUrl);
        return;
      }
      setKonvaImg(img);
      setImgDims({ width: img.width, height: img.height });
      setImageLoaded(true);

      // Center the image when it loads
      if (containerRef.current) {
        const canvasWidth = containerRef.current.offsetWidth;
        const canvasHeight = containerRef.current.offsetHeight;
        const xPos = Math.max(0, (canvasWidth - img.width) / 2);
        const yPos = Math.max(0, (canvasHeight - img.height) / 2);
        setImagePos({ x: xPos, y: yPos });
      }
    };
    img.onerror = () => console.error("Could not load image:", fileUrl);
  }, [fileUrl]);



  // Apply custom initial position when provided or center on resize
  useEffect(() => {
    if (initialPosition && (initialPosition.x !== 0 || initialPosition.y !== 0)) {
      setImagePos(initialPosition);
    } else if (imageLoaded && konvaImg && dims.width && dims.height) {
      // Center image
      const xPos = Math.max(0, (dims.width - imgDims.width) / 2);
      const yPos = Math.max(0, (dims.height - imgDims.height) / 2);
      setImagePos({ x: xPos, y: yPos });
    }
  }, [initialPosition, imageLoaded, konvaImg, dims, imgDims]);

  // ----------- Color shading for instance polygons -----------
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

    const RR =
      R.toString(16).length === 1 ? '0' + R.toString(16) : R.toString(16);
    const GG =
      G.toString(16).length === 1 ? '0' + G.toString(16) : G.toString(16);
    const BB =
      B.toString(16).length === 1 ? '0' + B.toString(16) : B.toString(16);

    return (usePound ? '#' : '') + RR + GG + BB;
  }

  // ----------- Relative pointer position -----------
  function getGroupPos(evt) {
    const group = stageRef.current?.findOne('#anno-group');
    return group ? group.getRelativePointerPosition() : null;
  }

  // ----------- shapeBoundingBox (for labels, checks, etc.) -----------
  function shapeBoundingBox(ann) {
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
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
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
    } else if (ann.type === 'points') {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      ann.points.forEach((pt) => {
        if (pt.x < minX) minX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y > maxY) maxY = pt.y;
      });
      return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    }
    return null;
  }

  // -------------- Clipping / bounding helpers --------------
  function isOutsideImage(ann) {
    if (!konvaImg) return false;
    const box = shapeBoundingBox(ann);
    if (!box) return false;
    const { x1, y1, x2, y2 } = box;
    if (x2 < 0 || x1 > konvaImg.width || y2 < 0 || y1 > konvaImg.height) {
      return true;
    }
    return false;
  }

  function clipPolygonToRect(points, w, h) {
    const clipRectEdges = [
      { side: 'left', x: 0 },
      { side: 'right', x: w },
      { side: 'top', y: 0 },
      { side: 'bottom', y: h },
    ];

    let outputList = points;

    clipRectEdges.forEach((edge) => {
      const inputList = outputList;
      outputList = [];
      if (inputList.length === 0) return;

      for (let i = 0; i < inputList.length; i++) {
        const current = inputList[i];
        const prev = inputList[(i + inputList.length - 1) % inputList.length];

        const currentInside = isInside(current, edge);
        const prevInside = isInside(prev, edge);

        if (prevInside && currentInside) {
          outputList.push(current);
        } else if (prevInside && !currentInside) {
          const inter = computeIntersection(prev, current, edge);
          if (inter) outputList.push(inter);
        } else if (!prevInside && currentInside) {
          const inter = computeIntersection(prev, current, edge);
          if (inter) outputList.push(inter);
          outputList.push(current);
        }
      }
    });

    return outputList;

    function isInside(pt, edge) {
      if (edge.side === 'left') return pt.x >= edge.x;
      if (edge.side === 'right') return pt.x <= edge.x;
      if (edge.side === 'top') return pt.y >= edge.y;
      if (edge.side === 'bottom') return pt.y <= edge.y;
      return true;
    }

    function computeIntersection(a, b, edge) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      let t;
      if (edge.side === 'left' || edge.side === 'right') {
        if (Math.abs(dx) < 1e-8) return null;
        t = (edge.x - a.x) / dx;
        const y = a.y + t * dy;
        return { x: edge.x, y };
      } else {
        if (Math.abs(dy) < 1e-8) return null;
        t = (edge.y - a.y) / dy;
        const x = a.x + t * dx;
        return { x, y: edge.y };
      }
    }
  }

  function clipPolylineToRect(points, w, h) {
    const resultSegments = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const clippedSeg = clipSegmentToRect(p1, p2, w, h);
      if (clippedSeg && clippedSeg.length === 2) {
        if (
          resultSegments.length > 0 &&
          samePoint(resultSegments[resultSegments.length - 1], clippedSeg[0])
        ) {
          resultSegments.push(clippedSeg[1]);
        } else {
          resultSegments.push(clippedSeg[0], clippedSeg[1]);
        }
      }
    }
    const cleaned = [];
    for (let i = 0; i < resultSegments.length; i++) {
      if (i === 0 || !samePoint(resultSegments[i], resultSegments[i - 1])) {
        cleaned.push(resultSegments[i]);
      }
    }
    return cleaned;

    function samePoint(a, b) {
      return Math.abs(a.x - b.x) < 1e-8 && Math.abs(a.y - b.y) < 1e-8;
    }
  }

  function clipSegmentToRect(p1, p2, w, h) {
    let [x1, y1, x2, y2] = [p1.x, p1.y, p2.x, p2.y];
    let t0 = 0;
    let t1 = 1;
    const dx = x2 - x1;
    const dy = y2 - y1;

    function clip(p, q) {
      if (Math.abs(p) < 1e-8) {
        if (q < 0) return false;
        return true;
      }
      const r = q / p;
      if (p < 0) {
        if (r > t1) return false;
        if (r > t0) t0 = r;
      } else if (p > 0) {
        if (r < t0) return false;
        if (r < t1) t1 = r;
      }
      return true;
    }

    if (!clip(-dx, x1)) return null;
    if (!clip(dx, w - x1)) return null;
    if (!clip(-dy, y1)) return null;
    if (!clip(dy, h - y1)) return null;

    if (t1 < t0) return null;

    const nx1 = x1 + t0 * dx;
    const ny1 = y1 + t0 * dy;
    const nx2 = x1 + t1 * dx;
    const ny2 = y1 + t1 * dy;

    return [
      { x: nx1, y: ny1 },
      { x: nx2, y: ny2 },
    ];
  }

  function clampPointToRect(pt, w, h) {
    return {
      x: Math.max(0, Math.min(w, pt.x)),
      y: Math.max(0, Math.min(h, pt.y)),
    };
  }

  function clampBoundingBox(bbox, w, h) {
    let { x, y, width, height } = bbox;

    if (width < 0) {
      x = x + width;
      width = Math.abs(width);
    }
    if (height < 0) {
      y = y + height;
      height = Math.abs(height);
    }

    if (x < 0) {
      width += x;
      x = 0;
    }
    if (y < 0) {
      height += y;
      y = 0;
    }
    if (x + width > w) {
      width = w - x;
    }
    if (y + height > h) {
      height = h - y;
    }

    if (width <= 0 || height <= 0) return null;
    return { ...bbox, x, y, width, height };
  }

  function clampEllipse(ellipse, w, h) {
    const { x, y, radiusX, radiusY } = ellipse;
    let newRx = Math.abs(radiusX);
    let newRy = Math.abs(radiusY);

    const left = x - newRx;
    if (left < 0) {
      const exceed = -left;
      newRx = newRx - exceed;
      if (newRx < 0) newRx = 0;
    }
    const right = x + newRx;
    if (right > w) {
      const exceed = right - w;
      newRx = newRx - exceed;
      if (newRx < 0) newRx = 0;
    }
    const top = y - newRy;
    if (top < 0) {
      const exceed = -top;
      newRy = newRy - exceed;
      if (newRy < 0) newRy = 0;
    }
    const bottom = y + newRy;
    if (bottom > h) {
      const exceed = bottom - h;
      newRy = newRy - exceed;
      if (newRy < 0) newRy = 0;
    }

    if (newRx < 1 || newRy < 1) {
      return null;
    }

    return {
      ...ellipse,
      radiusX: newRx,
      radiusY: newRy,
    };
  }

  function isPartiallyOutside(ann, w, h) {
    const box = shapeBoundingBox(ann);
    if (!box) return false;
    const { x1, y1, x2, y2 } = box;
    if (
      x2 < 0 ||
      x1 > w ||
      y2 < 0 ||
      y1 > h ||
      x1 < 0 ||
      x2 > w ||
      y1 < 0 ||
      y2 > h
    ) {
      return true;
    }
    return false;
  }

  function clipAnnotationToBoundary(ann, w, h) {
    if (!isPartiallyOutside(ann, w, h)) {
      return ann;
    }

    if (ann.type === 'bbox') {
      const clamped = clampBoundingBox(ann, w, h);
      return clamped;
    }

    if (ann.type === 'polygon') {
      const clipped = clipPolygonToRect(ann.points, w, h);
      if (clipped.length < 3) return null;
      return { ...ann, points: clipped };
    }

    if (ann.type === 'polyline') {
      const clippedLine = clipPolylineToRect(ann.points, w, h);
      if (clippedLine.length < 2) return null;
      return { ...ann, points: clippedLine };
    }

    if (ann.type === 'points') {
      const newPts = ann.points.map((p) => clampPointToRect(p, w, h));
      return { ...ann, points: newPts };
    }

    if (ann.type === 'point') {
      const clamped = clampPointToRect({ x: ann.x, y: ann.y }, w, h);
      return { ...ann, x: clamped.x, y: clamped.y };
    }

    if (ann.type === 'ellipse') {
      const clamped = clampEllipse(ann, w, h);
      return clamped;
    }

    return null;
  }

  // ----------- Creating BBox -----------
  function startBox(pos) {
    setNewBox({
      x: pos.x,
      y: pos.y,
      width: 0,
      height: 0,
      opacity: 1.0 // Default opacity
    });
  }
  function updateBox(pos) {
    if (!newBox) return;
    setNewBox({
      ...newBox,
      width: pos.x - newBox.x,
      height: pos.y - newBox.y,
    });
  }
  function finalizeBox() {
    if (!newBox) return;
    const newAnn = {
      type: 'bbox',
      ...newBox,
      label: activeLabel,
      color: activeLabelColor,
      opacity: 0.55, // Default opacity
    };

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        newAnn,
        konvaImg.width,
        konvaImg.height
      );
      if (clipped) {
        onAnnotationsChange([...annotations, clipped]);
      }
    } else {
      onAnnotationsChange([...annotations, newAnn]);
    }
    setNewBox(null);
    onFinishShape && onFinishShape();
  }

  // ----------- Creating Polygon -----------
  function addPolygonPoint(pos) {
    setTempPoints((prev) => {
      const newPoints = [...prev, pos];
      if (pointsLimit > 0 && newPoints.length === pointsLimit) {
        setTimeout(() => finalizePolygon(newPoints), 0);
      }
      return newPoints;
    });
    setDrawingPolygon(true);
  }
  function finalizePolygon(pointsParam) {
    const pointsToUse = pointsParam || tempPoints;
    if (pointsToUse.length >= 3) {
      const newAnn = {
        type: 'polygon',
        points: pointsToUse,
        label: activeLabel,
        color: activeLabelColor,
        opacity: 0.55, // Default opacity
      };
      if (konvaImg) {
        const clipped = clipAnnotationToBoundary(
          newAnn,
          konvaImg.width,
          konvaImg.height
        );
        if (clipped) {
          onAnnotationsChange([...annotations, clipped]);
        }
      } else {
        onAnnotationsChange([...annotations, newAnn]);
      }
    }
    setTempPoints([]);
    setDrawingPolygon(false);
    onFinishShape && onFinishShape();
  }

  // ----------- Creating Polyline -----------
  function addPolylinePoint(pos) {
    setTempPolyline((prev) => {
      const newPoints = [...prev, pos];
      if (pointsLimit > 0 && newPoints.length === pointsLimit) {
        setTimeout(() => finalizePolyline(newPoints), 0);
      }
      return newPoints;
    });
    setDrawingPolyline(true);
  }
  function finalizePolyline(pointsParam) {
    const pointsToUse = pointsParam || tempPolyline;
    if (pointsToUse.length >= 2) {
      const newAnn = {
        type: 'polyline',
        points: pointsToUse,
        label: activeLabel,
        color: activeLabelColor,
        opacity: 0.55, // Default opacity
      };
      if (konvaImg) {
        const clipped = clipAnnotationToBoundary(
          newAnn,
          konvaImg.width,
          konvaImg.height
        );
        if (clipped) {
          onAnnotationsChange([...annotations, clipped]);
        }
      } else {
        onAnnotationsChange([...annotations, newAnn]);
      }
    }
    setTempPolyline([]);
    setDrawingPolyline(false);
    onFinishShape && onFinishShape();
  }

  // ----------- Creating Points (multiple point tool) -----------
  function addPointToPoints(pos) {
    setTempPointPoints((prev) => {
      const newPoints = [...prev, pos];
      if (pointsLimit > 0 && newPoints.length === pointsLimit) {
        setTimeout(() => finalizePoint(newPoints), 0);
      }
      return newPoints;
    });
    setDrawingPoint(true);
  }
  function finalizePoint(pointsParam) {
    const pointsToUse = pointsParam || tempPointPoints;
    if (pointsToUse.length > 0) {
      const newAnn = {
        type: 'points',
        points: pointsToUse,
        label: activeLabel,
        color: activeLabelColor,
        opacity: 0.55, // Default opacity
      };
      if (konvaImg) {
        const clipped = clipAnnotationToBoundary(
          newAnn,
          konvaImg.width,
          konvaImg.height
        );
        if (clipped) {
          onAnnotationsChange([...annotations, clipped]);
        }
      } else {
        onAnnotationsChange([...annotations, newAnn]);
      }
    }
    setTempPointPoints([]);
    setDrawingPoint(false);
    onFinishShape && onFinishShape();
  }

  // ----------- Creating Ellipse -----------
  function startEllipse(pos) {
    setNewEllipse({
      type: 'ellipse',
      x: pos.x,
      y: pos.y,
      radiusX: 0,
      radiusY: 0,
      rotation: 0,
      label: activeLabel,
      color: activeLabelColor,
      opacity: 0.55, // Default opacity
    });
  }
  function updateEllipse(pos) {
    if (!newEllipse) return;
    const rx = Math.abs(pos.x - newEllipse.x);
    const ry = Math.abs(pos.y - newEllipse.y);
    setNewEllipse({
      ...newEllipse,
      radiusX: rx,
      radiusY: ry,
    });
  }
  function finalizeEllipse() {
    if (!newEllipse) return;
    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        newEllipse,
        konvaImg.width,
        konvaImg.height
      );
      if (clipped) {
        onAnnotationsChange([...annotations, clipped]);
      }
    } else {
      onAnnotationsChange([...annotations, { ...newEllipse }]);
    }
    setNewEllipse(null);
    onFinishShape && onFinishShape();
  }

  // ----------- Cancel shape on ESC -----------
  useEffect(() => {
    const onCancelAnnotation = () => {
      setNewBox(null);
      setTempPoints([]);
      setDrawingPolygon(false);
      setTempPolyline([]);
      setDrawingPolyline(false);
      setNewEllipse(null);
      setTempPointPoints([]);
      setDrawingPoint(false);
      setIsDraggingWithCtrl(false);
      setLastDragPoint(null);
    };
    window.addEventListener('cancel-annotation', onCancelAnnotation);
    return () =>
      window.removeEventListener('cancel-annotation', onCancelAnnotation);
  }, []);

  // ----------- Wheel Zoom -----------
  function handleWheel(evt) {
    evt.evt.preventDefault();
    onWheelZoom(evt.evt.deltaY);
  }

  // ----------- Right-click remove last *drawing* point -----------
  function handleContextMenu(evt) {
    evt.evt.preventDefault();
    // polygon
    if (selectedTool === 'polygon' && drawingPolygon && tempPoints.length > 0) {
      setTempPoints((prev) => prev.slice(0, -1));
    }
    // polyline
    else if (
      selectedTool === 'polyline' &&
      drawingPolyline &&
      tempPolyline.length > 0
    ) {
      setTempPolyline((prev) => prev.slice(0, -1));
    }
    // point
    else if (
      selectedTool === 'point' &&
      drawingPoint &&
      tempPointPoints.length > 0
    ) {
      setTempPointPoints((prev) => prev.slice(0, -1));
    }
  }

  // ----------- Mouse events for shape creation -----------
  function handleMouseDown(evt) {

    // If click is not on an annotation and not in draw mode, deselect the current annotation
    if (selectedTool === 'move' && evt.target.name() === 'background-image') {
      onSelectAnnotation(null);
    }

    if (selectedTool === 'move') {
      return;
    }
    const pos = getGroupPos(evt);
    if (!pos) return;

    // Check if Ctrl key is pressed for automatic annotation
    const isCtrlPressed = evt.evt.ctrlKey;

    // For tools that support Ctrl+drag automatic annotation
    if (isCtrlPressed && (selectedTool === 'polygon')) {
      setIsDraggingWithCtrl(true);
      setLastDragPoint(pos);

      // Add first point
      if (selectedTool === 'polygon') {
        addPolygonPoint(pos);
      }
      return;
    }

    const now = Date.now();
    const delta = now - lastClickTimeRef.current;
    // Tools that use double-click to finalize
    const usesDoubleClick =
      selectedTool === 'polygon' ||
      selectedTool === 'polyline' ||
      selectedTool === 'point';

    if (usesDoubleClick && delta < doubleClickThreshold) {
      return; // double-click => handled in handleDblClick
    }
    lastClickTimeRef.current = now;

    if (selectedTool === 'bbox') {
      startBox(pos);
    } else if (selectedTool === 'polygon') {
      addPolygonPoint(pos);
    } else if (selectedTool === 'polyline') {
      addPolylinePoint(pos);
    } else if (selectedTool === 'point') {
      addPointToPoints(pos);
    } else if (selectedTool === 'ellipse') {
      startEllipse(pos);
    }
  }

  function handleMouseMove(evt) {
    if (selectedTool === 'bbox' && newBox) {
      const pos = getGroupPos(evt);
      if (pos) updateBox(pos);
    } else if (selectedTool === 'ellipse' && newEllipse) {
      const pos = getGroupPos(evt);
      if (pos) updateEllipse(pos);
    }
    // Handle Ctrl+drag for continuous annotation
    if (isDraggingWithCtrl) {
      const pos = getGroupPos(evt);
      if (!pos || !lastDragPoint) return;

      // Only add new point if we've moved far enough from the last point
      const distance = getDistance(lastDragPoint, pos);
      if (distance >= minDistanceBetweenPoints) {
        // Add a point based on the tool
        if (selectedTool === 'polygon' && drawingPolygon) {
          // Check point limit before adding
          if (pointsLimit === 0 || tempPoints.length < pointsLimit) {
            addPolygonPoint(pos);
          } else if (tempPoints.length >= pointsLimit) {
            setIsDraggingWithCtrl(false);
            finalizePolygon();
            return;
          }
        }
        setLastDragPoint(pos);
      }
    }
  }

  // Function to calculate distance between two points for automatic annotation
  function getDistance(p1, p2) {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  function handleMouseUp() {
    if (selectedTool === 'bbox' && newBox) {
      finalizeBox();
    } else if (selectedTool === 'ellipse' && newEllipse) {
      finalizeEllipse();
    }
    // Handle end of Ctrl+drag annotation - finalize when mouse is released
    if (isDraggingWithCtrl) {
      setIsDraggingWithCtrl(false);
      setLastDragPoint(null);

      // Reset isShowingReducedPreview to ensure original points are shown initially
      setIsShowingReducedPreview(false);

      // Save original points before showing reduction panel
      let points = [];
      let annotationType = '';

      // Finalize the shape when user releases Ctrl+click
      if (selectedTool === 'polygon' && drawingPolygon && tempPoints.length >= 3) {
        //finalizePolygon();
        points = [...tempPoints];
        annotationType = 'polygon';
        setOriginalPoints([...tempPoints]);
        setCurrentAnnotationPoints([...tempPoints]);
        setCurrentAnnotationType('polygon');
        setShowPointReductionPanel(true);
      }
    }
  }

  // function to reduce points based on the distance threshold:
  function reducePoints(points, threshold) {
    if (points.length <= 3) return points; // Minimum 3 points for polygon

    const result = [points[0]]; // Always keep the first point

    for (let i = 1; i < points.length; i++) {
      const prevPoint = result[result.length - 1];
      const currentPoint = points[i];

      if (getDistance(prevPoint, currentPoint) >= threshold) {
        result.push(currentPoint);
      }
    }

    // Ensure at least 3 points
    if (result.length < 3) {
      return points.filter((_, index) => index % Math.floor(points.length / 3) === 0);
    }

    return result;
  }

  // functions to apply or cancel point reduction:
  function applyPointReduction() {
    // Apply the reduced points based on current annotation type
    if (currentAnnotationType === 'polygon') {
      finalizePolygon(currentAnnotationPoints);
    }

    // Reset and hide the panel
    setIsShowingReducedPreview(false);
    setShowPointReductionPanel(false);
    setCurrentAnnotationPoints([]);
    setCurrentAnnotationType('');
  }

  function cancelPointReduction() {
    // Use original points for finalization
    if (currentAnnotationType === 'polygon') {
      finalizePolygon(originalPoints);
    }

    // Reset and hide the panel
    setIsShowingReducedPreview(false);
    setShowPointReductionPanel(false);
    setCurrentAnnotationPoints([]);
    setCurrentAnnotationType('');
  }

  // function to handle slider changes:
  function handleDistanceChange(e) {
    const newThreshold = parseInt(e.target.value);
    setDistanceThreshold(newThreshold);

    // Update points in real time
    const reducedPoints = reducePoints(originalPoints, newThreshold);
    setCurrentAnnotationPoints(reducedPoints);

    // Set preview flag to true so we know to render the preview
    setIsShowingReducedPreview(true);
  }

  function handleDblClick() {
    if (selectedTool === 'polygon' && drawingPolygon) {
      finalizePolygon();
    } else if (selectedTool === 'polyline' && drawingPolyline) {
      finalizePolyline();
    } else if (selectedTool === 'point' && drawingPoint) {
      finalizePoint();
    }
  }

  // ----------- Copy/Paste Keyboard Listener -----------
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Copy
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        if (selectedAnnotationIndex !== null) {
          e.preventDefault();
          setCopiedAnnotation(annotations[selectedAnnotationIndex]);
        }
      }
      // Paste
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        if (copiedAnnotation) {
          e.preventDefault();
          const newAnn = JSON.parse(JSON.stringify(copiedAnnotation));
          // Shift it slightly
          if (newAnn.x !== undefined && newAnn.y !== undefined) {
            newAnn.x += 10;
            newAnn.y += 10;
          } else if (newAnn.points) {
            newAnn.points = newAnn.points.map((pt) => ({
              x: pt.x + 10,
              y: pt.y + 10,
            }));
          }
          onAnnotationsChange([...annotations, newAnn]);
        }
      }

      // Remove last "drawing" point if user is in the middle of creating polygon, etc.
      if (e.key === 'Backspace' || e.key === 'Delete') {
        // Polygon
        if (selectedTool === 'polygon' && drawingPolygon && tempPoints.length > 0) {
          e.preventDefault();
          setTempPoints((prev) => prev.slice(0, -1));
        }
        // Polyline
        else if (
          selectedTool === 'polyline' &&
          drawingPolyline &&
          tempPolyline.length > 0
        ) {
          e.preventDefault();
          setTempPolyline((prev) => prev.slice(0, -1));
        }
        // Point
        else if (
          selectedTool === 'point' &&
          drawingPoint &&
          tempPointPoints.length > 0
        ) {
          e.preventDefault();
          setTempPointPoints((prev) => prev.slice(0, -1));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    annotations,
    onAnnotationsChange,
    selectedAnnotationIndex,
    copiedAnnotation,
    selectedTool,
    drawingPolygon,
    drawingPolyline,
    drawingPoint,
    tempPoints,
    tempPolyline,
    tempPointPoints,
  ]);

  // ----------- Draggable logic for entire shapes -----------
  const handleBBoxDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y };

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updated[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(index, 1);
      } else {
        updated[index] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  const handleEllipseDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y };

    if (
      konvaImg &&
      isPartiallyOutside(updated[index], konvaImg.width, konvaImg.height)
    ) {
      const clipped = clipAnnotationToBoundary(
        updated[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(index, 1);
      } else {
        updated[index] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  const handlePointDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const updated = [...annotations];
    updated[index] = { ...updated[index], x, y };

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updated[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(index, 1);
      } else {
        updated[index] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  const handlePolylineDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const ann = annotations[index];
    const newPoints = ann.points.map((pt) => ({
      x: pt.x + x,
      y: pt.y + y,
    }));
    const updated = [...annotations];
    updated[index] = { ...ann, points: newPoints };
    e.target.position({ x: 0, y: 0 });

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updated[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(index, 1);
      } else {
        updated[index] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  const handlePolygonDragEnd = (index, e) => {
    const { x, y } = e.target.position();
    const ann = annotations[index];
    const newPoints = ann.points.map((pt) => ({
      x: pt.x + x,
      y: pt.y + y,
    }));
    const updated = [...annotations];
    updated[index] = { ...ann, points: newPoints };
    e.target.position({ x: 0, y: 0 });

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updated[index],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(index, 1);
      } else {
        updated[index] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  // ----------- Remove an individual vertex -----------
  function handleRemoveVertex(annIndex, vertexIndex) {
    const updated = [...annotations];
    const ann = { ...updated[annIndex] };
    const shapePoints = [...ann.points];
    shapePoints.splice(vertexIndex, 1);

    if (ann.type === 'polygon' && shapePoints.length < 3) {
      updated.splice(annIndex, 1);
    } else if (ann.type === 'polyline' && shapePoints.length < 2) {
      updated.splice(annIndex, 1);
    } else if (ann.type === 'points' && shapePoints.length < 1) {
      updated.splice(annIndex, 1);
    } else {
      ann.points = shapePoints;
      updated[annIndex] = ann;
    }

    onAnnotationsChange(updated);
  }

  // ----------- Insert a new vertex between current vertex and next -----------
  function handleInsertVertex(annIndex, vertexIndex) {
    const updated = [...annotations];
    const ann = { ...updated[annIndex] };

    if (ann.type !== 'polygon' && ann.type !== 'polyline') return;

    const shapePoints = [...ann.points];
    const length = shapePoints.length;
    if (length < 2) return;

    let nextIndex;
    if (ann.type === 'polygon') {
      nextIndex = (vertexIndex + 1) % length;
    } else {
      if (vertexIndex === length - 1) {
        return;
      }
      nextIndex = vertexIndex + 1;
    }

    const currentPt = shapePoints[vertexIndex];
    const nextPt = shapePoints[nextIndex];

    const midX = (currentPt.x + nextPt.x) / 2;
    const midY = (currentPt.y + nextPt.y) / 2;

    shapePoints.splice(vertexIndex + 1, 0, { x: midX, y: midY });

    ann.points = shapePoints;
    updated[annIndex] = ann;
    onAnnotationsChange(updated);
  }

  // ----------- Draggable logic for each vertex -----------
  const handleVertexDragEnd = (annIndex, vertexIndex, e) => {
    e.cancelBubble = true;
    const { x, y } = e.target.position();
    const updated = [...annotations];
    const shapePoints = [...updated[annIndex].points];
    shapePoints[vertexIndex] = { x, y };
    updated[annIndex] = { ...updated[annIndex], points: shapePoints };

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updated[annIndex],
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updated.splice(annIndex, 1);
      } else {
        updated[annIndex] = clipped;
      }
    }
    onAnnotationsChange(updated);
  };

  // ----------- Transformer logic (for bbox & ellipse) -----------
  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;

    if (selectedAnnotationIndex == null) {
      tr.nodes([]);
      return;
    }
    const node = shapeRefs.current[selectedAnnotationIndex];
    if (node) {
      tr.nodes([node]);
      tr.getLayer().batchDraw();
    } else {
      tr.nodes([]);
    }
  }, [selectedAnnotationIndex, annotations]);

  const handleTransformEnd = () => {
    if (selectedAnnotationIndex == null) return;
    const shapeNode = shapeRefs.current[selectedAnnotationIndex];
    if (!shapeNode) return;

    const ann = annotations[selectedAnnotationIndex];
    const scaleX = shapeNode.scaleX();
    const scaleY = shapeNode.scaleY();
    const offsetX = shapeNode.x();
    const offsetY = shapeNode.y();

    let updatedAnn = { ...ann };

    switch (ann.type) {
      case 'bbox': {
        const newWidth = shapeNode.width() * scaleX;
        const newHeight = shapeNode.height() * scaleY;
        updatedAnn.x = offsetX;
        updatedAnn.y = offsetY;
        updatedAnn.width = newWidth;
        updatedAnn.height = newHeight;
        break;
      }
      case 'ellipse': {
        const newRadiusX = (shapeNode.width() / 2) * scaleX;
        const newRadiusY = (shapeNode.height() / 2) * scaleY;
        updatedAnn.x = offsetX;
        updatedAnn.y = offsetY;
        updatedAnn.radiusX = newRadiusX;
        updatedAnn.radiusY = newRadiusY;
        break;
      }
      default:
        break;
    }

    shapeNode.scaleX(1);
    shapeNode.scaleY(1);
    shapeNode.x(0);
    shapeNode.y(0);

    const updatedAll = [...annotations];
    updatedAll[selectedAnnotationIndex] = updatedAnn;

    if (konvaImg) {
      const clipped = clipAnnotationToBoundary(
        updatedAnn,
        konvaImg.width,
        konvaImg.height
      );
      if (!clipped) {
        updatedAll.splice(selectedAnnotationIndex, 1);
      } else {
        updatedAll[selectedAnnotationIndex] = clipped;
      }
    }

    onAnnotationsChange(updatedAll);
  };

  return (
    <div className="canvas-container" ref={containerRef}>
      {dims.width > 0 && dims.height > 0 && konvaImg && konvaImg.width > 0 && konvaImg.height > 0 ? (
        <Stage
          ref={stageRef}
          width={dims.width}
          height={dims.height}
          scaleX={scale}
          scaleY={scale}
          style={{
            background: '#dfe6e9',
            cursor: selectedTool === 'move' ? 'grab' : crosshairCursor
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onDblClick={handleDblClick}
          onContextMenu={handleContextMenu}
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
              {/* Background image */}
              {konvaImg && konvaImg.width > 0 && konvaImg.height > 0 && (
                <KonvaImage
                  image={konvaImg}
                  width={konvaImg.width}
                  height={konvaImg.height}
                  name="background-image"
                />
              )}

              {/* Render existing annotations */}
              {annotations.map((ann, i) => {
                const annColor = ann.color || activeLabelColor || '#ff0000';
                const fillColor = annColor + '55';
                const opacity = ann.opacity !== undefined ? ann.opacity : 1.0;

                if (ann.type === 'bbox') {
                  return (
                    <React.Fragment key={i}>
                      <Rect
                        ref={(node) => (shapeRefs.current[i] = node)}
                        x={ann.x}
                        y={ann.y}
                        width={ann.width}
                        height={ann.height}
                        fill={annColor}
                        stroke={annColor}
                        strokeWidth={2 / scale}
                        opacity={ann.opacity !== undefined ? ann.opacity : 1.0}
                        draggable
                        onMouseDown={(e) => (e.cancelBubble = true)}
                        onDragStart={(e) => (e.cancelBubble = true)}
                        onDragMove={(e) => (e.cancelBubble = true)}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handleBBoxDragEnd(i, e);
                        }}
                        onClick={(e) => {
                          if (selectedTool === 'move') {
                            e.cancelBubble = true;
                            onSelectAnnotation(i);
                          }
                        }}
                      />
                      {selectedAnnotationIndex === i && (
                        <DeleteLabel
                          annotation={ann}
                          scale={scale}
                          shapeBoundingBox={shapeBoundingBox}
                          onDelete={() => onDeleteAnnotation(i)}
                          color={annColor}
                        />
                      )}
                    </React.Fragment>
                  );
                } else if (ann.type === 'ellipse') {
                  return (
                    <React.Fragment key={i}>
                      <Ellipse
                        ref={(node) => (shapeRefs.current[i] = node)}
                        x={ann.x}
                        y={ann.y}
                        radiusX={ann.radiusX}
                        radiusY={ann.radiusY}
                        rotation={ann.rotation || 0}
                        fill={annColor}
                        stroke={annColor}
                        strokeWidth={2 / scale}
                        opacity={opacity}
                        draggable
                        onMouseDown={(e) => (e.cancelBubble = true)}
                        onDragStart={(e) => (e.cancelBubble = true)}
                        onDragMove={(e) => (e.cancelBubble = true)}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handleEllipseDragEnd(i, e);
                        }}
                        onClick={(e) => {
                          if (selectedTool === 'move') {
                            e.cancelBubble = true;
                            onSelectAnnotation(i);
                          }
                        }}
                      />
                      {selectedAnnotationIndex === i && (
                        <DeleteLabel
                          annotation={ann}
                          scale={scale}
                          shapeBoundingBox={shapeBoundingBox}
                          onDelete={() => onDeleteAnnotation(i)}
                          color={annColor}
                        />
                      )}
                    </React.Fragment>
                  );
                } else if (ann.type === 'point') {
                  return (
                    <React.Fragment key={i}>
                      <Circle
                        x={ann.x}
                        y={ann.y}
                        radius={6 / scale}
                        fill="#fff"
                        opacity={opacity}
                        draggable
                        onMouseDown={(e) => (e.cancelBubble = true)}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handlePointDragEnd(i, e);
                        }}
                        onClick={(e) => {
                          if (selectedTool === 'move') {
                            e.cancelBubble = true;
                            onSelectAnnotation(i);
                          }
                        }}
                      />
                      {selectedAnnotationIndex === i && (
                        <DeleteLabel
                          annotation={ann}
                          scale={scale}
                          shapeBoundingBox={shapeBoundingBox}
                          onDelete={() => onDeleteAnnotation(i)}
                          color={annColor}
                        />
                      )}
                    </React.Fragment>
                  );
                } else if (ann.type === 'polyline') {
                  const pts = flattenPoints(ann.points);
                  const firstPt = ann.points[0];
                  const secondPt =
                    ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };
                  return (
                    <React.Fragment key={i}>
                      <Group
                        draggable
                        onMouseDown={(e) => (e.cancelBubble = true)}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handlePolylineDragEnd(i, e);
                        }}
                        onClick={(e) => {
                          if (selectedTool === 'move') {
                            e.cancelBubble = true;
                            onSelectAnnotation(i);
                          }
                        }}
                      >
                        <Line
                          points={pts}
                          stroke={annColor}
                          strokeWidth={2 / scale}
                          closed={false}
                          opacity={opacity}
                        />
                        {ann.points.map((pt, idx) => (
                          <Circle
                            key={idx}
                            x={pt.x}
                            y={pt.y}
                            radius={4 / scale}
                            fill="#fff"
                            stroke={annColor}
                            strokeWidth={1 / scale}
                            opacity={opacity}
                            draggable
                            onMouseDown={(ev) => (ev.cancelBubble = true)}
                            onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                            onContextMenu={(ev) => {
                              ev.evt.preventDefault();
                              ev.cancelBubble = true;
                              handleRemoveVertex(i, idx);
                            }}
                            onClick={(ev) => {
                              ev.cancelBubble = true;
                              handleInsertVertex(i, idx);
                            }}
                          />
                        ))}
                        <Arrow
                          points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
                          fill={annColor}
                          stroke={annColor}
                          strokeWidth={2 / scale}
                          opacity={opacity}
                          pointerLength={10 / scale}
                          pointerWidth={8 / scale}
                        />
                      </Group>
                      {selectedAnnotationIndex === i && (
                        <DeleteLabel
                          annotation={ann}
                          scale={scale}
                          shapeBoundingBox={shapeBoundingBox}
                          onDelete={() => onDeleteAnnotation(i)}
                          color={annColor}
                        />
                      )}
                    </React.Fragment>
                  );
                } else if (ann.type === 'polygon') {
                  if (ann.holes && ann.holes.length > 0) {
                    const pathData = polygonToPath(ann.points, ann.holes);
                    return (
                      <React.Fragment key={i}>
                        <Group
                          draggable
                          onMouseDown={(e) => (e.cancelBubble = true)}
                          onDragEnd={(e) => {
                            e.cancelBubble = true;
                            handlePolygonDragEnd(i, e);
                          }}
                          onClick={(e) => {
                            if (selectedTool === 'move') {
                              e.cancelBubble = true;
                              onSelectAnnotation(i);
                            }
                          }}
                        >
                          <Path
                            data={pathData}
                            fill={annColor}
                            stroke={annColor}
                            strokeWidth={2 / scale}
                            fillRule="evenodd"
                            opacity={opacity}
                          />
                          {ann.points.map((pt, idx) => (
                            <Circle
                              key={idx}
                              x={pt.x}
                              y={pt.y}
                              radius={4 / scale}
                              fill="#fff"
                              stroke={annColor}
                              strokeWidth={1 / scale}
                              opacity={opacity}
                              draggable
                              onMouseDown={(ev) => (ev.cancelBubble = true)}
                              onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                              onContextMenu={(ev) => {
                                ev.evt.preventDefault();
                                ev.cancelBubble = true;
                                handleRemoveVertex(i, idx);
                              }}
                              onClick={(ev) => {
                                ev.cancelBubble = true;
                                handleInsertVertex(i, idx);
                              }}
                            />
                          ))}
                        </Group>
                        {selectedAnnotationIndex === i && (
                          <DeleteLabel
                            annotation={ann}
                            scale={scale}
                            shapeBoundingBox={shapeBoundingBox}
                            onDelete={() => onDeleteAnnotation(i)}
                            color={annColor}
                          />
                        )}
                      </React.Fragment>
                    );
                  } else {
                    const pts = flattenPoints(ann.points);
                    const firstPt = ann.points[0];
                    const secondPt =
                      ann.points[1] || { x: firstPt.x + 10, y: firstPt.y };
                    return (
                      <React.Fragment key={i}>
                        <Group
                          draggable
                          onMouseDown={(e) => (e.cancelBubble = true)}
                          onDragEnd={(e) => {
                            e.cancelBubble = true;
                            handlePolygonDragEnd(i, e);
                          }}
                          onClick={(e) => {
                            if (selectedTool === 'move') {
                              e.cancelBubble = true;
                              onSelectAnnotation(i);
                            }
                          }}
                        >
                          <Line
                            points={pts}
                            fill={annColor}
                            stroke={annColor}
                            strokeWidth={2 / scale}
                            closed
                            opacity={opacity}
                          />
                          {ann.points.map((pt, idx) => (
                            <Circle
                              key={idx}
                              x={pt.x}
                              y={pt.y}
                              radius={4 / scale}
                              fill="#fff"
                              stroke={annColor}
                              strokeWidth={1 / scale}
                              opacity={opacity}
                              draggable
                              onMouseDown={(ev) => (ev.cancelBubble = true)}
                              onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                              onContextMenu={(ev) => {
                                ev.evt.preventDefault();
                                ev.cancelBubble = true;
                                handleRemoveVertex(i, idx);
                              }}
                              onClick={(ev) => {
                                ev.cancelBubble = true;
                                handleInsertVertex(i, idx);
                              }}
                            />
                          ))}
                          <Arrow
                            points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
                            fill={annColor}
                            stroke={annColor}
                            strokeWidth={2 / scale}
                            opacity={opacity}
                            pointerLength={10 / scale}
                            pointerWidth={8 / scale}
                          />
                        </Group>
                        {selectedAnnotationIndex === i && (
                          <DeleteLabel
                            annotation={ann}
                            scale={scale}
                            shapeBoundingBox={shapeBoundingBox}
                            onDelete={() => onDeleteAnnotation(i)}
                            color={annColor}
                          />
                        )}
                      </React.Fragment>
                    );
                  }
                } else if (ann.type === 'points') {
                  return (
                    <React.Fragment key={i}>
                      <Group
                        draggable
                        onMouseDown={(e) => (e.cancelBubble = true)}
                        onDragEnd={(e) => {
                          e.cancelBubble = true;
                          handlePolylineDragEnd(i, e);
                        }}
                        onClick={(e) => {
                          if (selectedTool === 'move') {
                            e.cancelBubble = true;
                            onSelectAnnotation(i);
                          }
                        }}
                      >
                        {ann.points.map((pt, idx) => (
                          <Circle
                            key={idx}
                            x={pt.x}
                            y={pt.y}
                            radius={6 / scale}
                            fill={annColor}
                            opacity={opacity}
                            draggable
                            onMouseDown={(ev) => (ev.cancelBubble = true)}
                            onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                            onContextMenu={(ev) => {
                              ev.evt.preventDefault();
                              ev.cancelBubble = true;
                              handleRemoveVertex(i, idx);
                            }}
                          />
                        ))}
                      </Group>
                      {selectedAnnotationIndex === i && (
                        <DeleteLabel
                          annotation={ann}
                          scale={scale}
                          shapeBoundingBox={shapeBoundingBox}
                          onDelete={() => onDeleteAnnotation(i)}
                          color={annColor}
                        />
                      )}
                    </React.Fragment>
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
                  fill={activeLabelColor + '55'}
                  stroke={activeLabelColor}
                  strokeWidth={2 / scale}
                />
              )}

              {/* Dynamic Point Reduction Preview */}
              {showPointReductionPanel && (
                <>
                  {(isShowingReducedPreview ? currentAnnotationPoints : originalPoints).length > 1 && (
                    <Line
                      points={flattenPoints([
                        ...(isShowingReducedPreview ? currentAnnotationPoints : originalPoints),
                        (isShowingReducedPreview ? currentAnnotationPoints : originalPoints)[0]
                      ])}
                      fill={activeLabelColor + '55'}
                      stroke={activeLabelColor}
                      strokeWidth={2 / scale}
                      closed
                    />
                  )}
                  {(isShowingReducedPreview ? currentAnnotationPoints : originalPoints).map((pt, idx) => (
                    <Circle
                      key={idx}
                      x={pt.x}
                      y={pt.y}
                      radius={4 / scale}
                      fill="#fff"
                      stroke={activeLabelColor}
                      strokeWidth={1 / scale}
                    />
                  ))}
                </>
              )}

              {/* In-progress Polygon - Only show if NOT in point reduction mode */}
              {!showPointReductionPanel && drawingPolygon && selectedTool === 'polygon' && (
                <>
                  {tempPoints.length > 1 && (
                    <Line
                      points={flattenPoints([...tempPoints, tempPoints[0]])}
                      fill={activeLabelColor + '55'}
                      stroke={activeLabelColor}
                      strokeWidth={2 / scale}
                      closed
                    />
                  )}
                  {tempPoints.map((pt, idx) => (
                    <Circle
                      key={idx}
                      x={pt.x}
                      y={pt.y}
                      radius={4 / scale}
                      fill="#fff"
                      stroke={activeLabelColor}
                      strokeWidth={1 / scale}
                    />
                  ))}
                </>
              )}

              {/* In-progress Polyline */}
              {drawingPolyline && selectedTool === 'polyline' && (
                <>
                  {tempPolyline.length > 1 && (
                    <Line
                      points={flattenPoints(tempPolyline)}
                      stroke={activeLabelColor}
                      strokeWidth={2 / scale}
                      closed={false}
                    />
                  )}
                  {tempPolyline.map((pt, idx) => (
                    <Circle
                      key={idx}
                      x={pt.x}
                      y={pt.y}
                      radius={4 / scale}
                      fill="#fff"
                      stroke={activeLabelColor}
                      strokeWidth={1 / scale}
                    />
                  ))}
                </>
              )}

              {/* In-progress Ellipse */}
              {newEllipse && selectedTool === 'ellipse' && (
                <Ellipse
                  x={newEllipse.x}
                  y={newEllipse.y}
                  radiusX={newEllipse.radiusX}
                  radiusY={newEllipse.radiusY}
                  rotation={newEllipse.rotation}
                  fill={activeLabelColor + '55'}
                  stroke={activeLabelColor}
                  strokeWidth={2 / scale}
                />
              )}

              {/* In-progress Points */}
              {drawingPoint && selectedTool === 'point' && (
                <>
                  {tempPointPoints.map((pt, idx) => (
                    <Circle
                      key={idx}
                      x={pt.x}
                      y={pt.y}
                      radius={4 / scale}
                      fill="#fff"
                      stroke={activeLabelColor}
                      strokeWidth={1 / scale}
                    />
                  ))}
                </>
              )}
            </Group>

            {/* Transformer (only for bbox & ellipse) */}
            <Transformer
              ref={transformerRef}
              rotateEnabled={false}
              anchorSize={8}
              borderDash={[6, 2]}
              onTransformEnd={handleTransformEnd}
              onDragEnd={handleTransformEnd}
            />
          </Layer>
        </Stage>
      ) : (
        <div>Loading image...</div>
      )}

      {/* Point Reduction Panel */}
      {
        showPointReductionPanel && (
          <div
            className="point-reduction-panel"
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '5px',
              padding: '10px',
              zIndex: 1000,
              color: 'white',
              width: '300px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>
                Reduce Points: {originalPoints.length} →
                <span style={{ color: originalPoints.length !== currentAnnotationPoints.length ? '#FFC107' : 'white' }}>
                  {currentAnnotationPoints.length}
                </span>
              </span>
              <button
                onClick={cancelPointReduction}
                style={{
                  backgroundColor: '#f44336',
                  border: 'none',
                  color: 'white',
                  padding: '5px 10px',
                  borderRadius: '3px',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </div>
            <div>
              <input
                type="range"
                min="5"
                max="100"
                value={distanceThreshold}
                onChange={handleDistanceChange}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Less Points</span>
                <span>More Points</span>
              </div>
            </div>
            <button
              onClick={applyPointReduction}
              style={{
                backgroundColor: '#4CAF50',
                border: 'none',
                color: 'white',
                padding: '8px',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Apply
            </button>
          </div>
        )
      }
    </div >
  );
}

// A small Konva Label to let user delete a selected annotation
function DeleteLabel({ annotation, scale, shapeBoundingBox, onDelete, color }) {
  const box = shapeBoundingBox(annotation);
  if (!box) return null;

  const xPos = box.x1;
  const yPos = box.y1 - 20 / scale; // 20 px above, scaled

  return (
    <Label
      x={xPos}
      y={yPos}
      onClick={(e) => {
        e.cancelBubble = true;
        onDelete();
      }}
      scaleX={1 / scale}
      scaleY={1 / scale}
    >
      <Tag fill={color || 'red'} opacity={0.8} cornerRadius={4} />
      <Text text="Delete" fill="#fff" padding={5} fontSize={14} />
    </Label>
  );
}