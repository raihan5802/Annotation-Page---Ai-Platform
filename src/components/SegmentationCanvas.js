// SegmentationCanvas.js
import React, { useEffect, useRef, useState } from 'react';
import {
    Stage,
    Layer,
    Group,
    Image as KonvaImage,
    Line,
    Circle,
    Path,
    Label,
    Tag,
    Text,
    Arrow,
} from 'react-konva';
import './SegmentationCanvas.css';

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

export default function SegmentationCanvas({
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
    segmentationType,
    panopticOption,
    pointsLimit, // new prop for point-based tools
}) {
    const stageRef = useRef(null);
    const containerRef = useRef(null);

    const [dims, setDims] = useState({ width: 0, height: 0 });
    const [konvaImg, setKonvaImg] = useState(null);

    // Master group offset (image panning)
    const [imagePos, setImagePos] = useState({ x: 0, y: 0 });

    // In-progress shape states (only for polygon-based tools)
    const [tempPoints, setTempPoints] = useState([]);
    const [drawingPolygon, setDrawingPolygon] = useState(false);

    // Instance segmentation polygon
    const [tempInstancePoints, setTempInstancePoints] = useState([]);
    const [drawingInstancePolygon, setDrawingInstancePolygon] = useState(false);

    // Semantic segmentation polygon
    const [tempSemanticPoints, setTempSemanticPoints] = useState([]);
    const [drawingSemanticPolygon, setDrawingSemanticPolygon] = useState(false);

    // For copy/paste and selection (for polygons)
    const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);
    const [copiedAnnotation, setCopiedAnnotation] = useState(null);

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
            setKonvaImg(img);
            setImagePos({ x: 0, y: 0 });
        };
        img.onerror = () => console.error('Could not load image:', fileUrl);
    }, [fileUrl]);

    // ----------- Relative pointer position -----------
    function getGroupPos(evt) {
        const group = stageRef.current?.findOne('#anno-group');
        return group ? group.getRelativePointerPosition() : null;
    }

    // ----------- shapeBoundingBox (for labels, checks, etc.) -----------
    function shapeBoundingBox(ann) {
        if (ann.type === 'polygon') {
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

    function clipAnnotationToBoundary(ann, w, h) {
        if (!isOutsideImage(ann)) {
            return ann;
        }

        if (ann.type === 'polygon') {
            const clipped = clipPolygonToRect(ann.points, w, h);
            if (clipped.length < 3) return null;
            return { ...ann, points: clipped };
        }

        return null;
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

    // ----------- Creating Instance Segmentation Polygon -----------
    function addInstancePolygonPoint(pos) {
        setTempInstancePoints((prev) => {
            const newPoints = [...prev, pos];
            if (pointsLimit > 0 && newPoints.length === pointsLimit) {
                setTimeout(() => finalizeInstancePolygon(newPoints), 0);
            }
            return newPoints;
        });
        setDrawingInstancePolygon(true);
    }
    function finalizeInstancePolygon(pointsParam) {
        const pointsToUse = pointsParam || tempInstancePoints;
        if (pointsToUse.length >= 3) {
            let newAnn = {
                type: 'polygon',
                points: pointsToUse,
                label: activeLabel,
            };

            // Compute new instance ID based on current annotations of this label.
            const currentInstances = annotations.filter(
                (ann) => ann.label === activeLabel && ann.instanceId
            );
            const newCount = currentInstances.length + 1;
            const instanceId = activeLabel + '-' + newCount;

            // Generate a unique random color that does not match any other labels or instances.
            const instanceColor = getUniqueInstanceColor();

            newAnn.instanceId = instanceId;
            newAnn.color = instanceColor;

            if (konvaImg) {
                const clipped = clipAnnotationToBoundary(newAnn, konvaImg.width, konvaImg.height);
                if (clipped) {
                    onAnnotationsChange([...annotations, clipped]);
                }
            } else {
                onAnnotationsChange([...annotations, newAnn]);
            }
        }
        setTempInstancePoints([]);
        setDrawingInstancePolygon(false);
        onFinishShape && onFinishShape();
    }

    // ----------- Creating Semantic Segmentation Polygon -----------
    function addSemanticPolygonPoint(pos) {
        setTempSemanticPoints((prev) => {
            const newPoints = [...prev, pos];
            if (pointsLimit > 0 && newPoints.length === pointsLimit) {
                setTimeout(() => finalizeSemanticPolygon(newPoints), 0);
            }
            return newPoints;
        });
        setDrawingSemanticPolygon(true);
    }
    function finalizeSemanticPolygon(pointsParam) {
        const pointsToUse = pointsParam || tempInstancePoints;
        if (pointsToUse.length >= 3) {
            const newAnn = {
                type: 'polygon',
                points: pointsToUse,
                label: activeLabel,
                color: activeLabelColor,
            };
            if (konvaImg) {
                const clipped = clipAnnotationToBoundary(newAnn, konvaImg.width, konvaImg.height);
                if (clipped) {
                    onAnnotationsChange([...annotations, clipped]);
                }
            } else {
                onAnnotationsChange([...annotations, newAnn]);
            }
        }
        setTempSemanticPoints([]);
        setDrawingSemanticPolygon(false);
        onFinishShape && onFinishShape();
    }

    // ----------- Cancel shape on ESC -----------
    useEffect(() => {
        const onCancelAnnotation = () => {
            setTempPoints([]);
            setDrawingPolygon(false);
            setTempInstancePoints([]);
            setDrawingInstancePolygon(false);
            setTempSemanticPoints([]);
            setDrawingSemanticPolygon(false);
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

    // ----------- Right-click remove last drawing point -----------
    function handleContextMenu(evt) {
        evt.evt.preventDefault();
        // polygon
        if (selectedTool === 'polygon' && drawingPolygon && tempPoints.length > 0) {
            setTempPoints((prev) => prev.slice(0, -1));
        }
        // segmentation instance
        else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'instance' &&
            drawingInstancePolygon &&
            tempInstancePoints.length > 0
        ) {
            setTempInstancePoints((prev) => prev.slice(0, -1));
        }
        // segmentation semantic
        else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'semantic' &&
            drawingSemanticPolygon &&
            tempSemanticPoints.length > 0
        ) {
            setTempSemanticPoints((prev) => prev.slice(0, -1));
        }
        // panoptic - instance
        else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'panoptic' &&
            panopticOption === 'instance' &&
            drawingInstancePolygon &&
            tempInstancePoints.length > 0
        ) {
            setTempInstancePoints((prev) => prev.slice(0, -1));
        }
        // panoptic - semantic
        else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'panoptic' &&
            panopticOption === 'semantic' &&
            drawingSemanticPolygon &&
            tempSemanticPoints.length > 0
        ) {
            setTempSemanticPoints((prev) => prev.slice(0, -1));
        }
    }

    // ----------- Mouse events for shape creation -----------
    const lastClickTimeRef = useRef(0);
    const doubleClickThreshold = 250; // ms

    function handleMouseDown(evt) {
        if (selectedTool === 'move') {
            return;
        }
        const pos = getGroupPos(evt);
        if (!pos) return;

        // Double-click logic for finalizing shape
        const now = Date.now();
        const delta = now - lastClickTimeRef.current;
        const usesDoubleClick =
            selectedTool === 'polygon' ||
            (selectedTool === 'segmentation' &&
                (segmentationType === 'instance' ||
                    segmentationType === 'semantic' ||
                    segmentationType === 'panoptic'));
        if (usesDoubleClick && delta < doubleClickThreshold) {
            return; // double-click => handled in handleDblClick
        }
        lastClickTimeRef.current = now;

        if (selectedTool === 'polygon') {
            addPolygonPoint(pos);
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'instance'
        ) {
            addInstancePolygonPoint(pos);
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'semantic'
        ) {
            addSemanticPolygonPoint(pos);
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'panoptic'
        ) {
            if (panopticOption === 'instance') {
                addInstancePolygonPoint(pos);
            } else if (panopticOption === 'semantic') {
                addSemanticPolygonPoint(pos);
            }
        }
    }

    function handleMouseMove(evt) {
        // No continuous drawing for polygon-based tools.
    }

    function handleMouseUp() {
        // No mouse up handling required.
    }

    function handleDblClick() {
        if (selectedTool === 'polygon' && drawingPolygon) {
            finalizePolygon();
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'instance' &&
            drawingInstancePolygon
        ) {
            finalizeInstancePolygon();
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'semantic' &&
            drawingSemanticPolygon
        ) {
            finalizeSemanticPolygon();
        } else if (
            selectedTool === 'segmentation' &&
            segmentationType === 'panoptic'
        ) {
            if (panopticOption === 'instance' && drawingInstancePolygon) {
                finalizeInstancePolygon();
            } else if (panopticOption === 'semantic' && drawingSemanticPolygon) {
                finalizeSemanticPolygon();
            }
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
                    if (newAnn.points) {
                        newAnn.points = newAnn.points.map((pt) => ({
                            x: pt.x + 10,
                            y: pt.y + 10,
                        }));
                    }
                    onAnnotationsChange([...annotations, newAnn]);
                }
            }

            // Remove last "drawing" point
            if (e.key === 'Backspace' || e.key === 'Delete') {
                if (selectedTool === 'polygon' && drawingPolygon && tempPoints.length > 0) {
                    e.preventDefault();
                    setTempPoints((prev) => prev.slice(0, -1));
                } else if (
                    selectedTool === 'segmentation' &&
                    segmentationType === 'instance' &&
                    drawingInstancePolygon &&
                    tempInstancePoints.length > 0
                ) {
                    e.preventDefault();
                    setTempInstancePoints((prev) => prev.slice(0, -1));
                } else if (
                    selectedTool === 'segmentation' &&
                    segmentationType === 'semantic' &&
                    drawingSemanticPolygon &&
                    tempSemanticPoints.length > 0
                ) {
                    e.preventDefault();
                    setTempSemanticPoints((prev) => prev.slice(0, -1));
                } else if (
                    selectedTool === 'segmentation' &&
                    segmentationType === 'panoptic' &&
                    panopticOption === 'instance' &&
                    drawingInstancePolygon &&
                    tempInstancePoints.length > 0
                ) {
                    e.preventDefault();
                    setTempInstancePoints((prev) => prev.slice(0, -1));
                } else if (
                    selectedTool === 'segmentation' &&
                    segmentationType === 'panoptic' &&
                    panopticOption === 'semantic' &&
                    drawingSemanticPolygon &&
                    tempSemanticPoints.length > 0
                ) {
                    e.preventDefault();
                    setTempSemanticPoints((prev) => prev.slice(0, -1));
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        annotations,
        onAnnotationsChange,
        selectedTool,
        drawingPolygon,
        tempPoints,
        drawingInstancePolygon,
        tempInstancePoints,
        drawingSemanticPolygon,
        tempSemanticPoints,
        segmentationType,
        panopticOption,
        selectedAnnotationIndex,
        copiedAnnotation,
    ]);

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

    // ----------- Draggable logic for entire polygon shape -----------
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

    // ----------- Helper to generate a unique random color -----------
    function getUniqueInstanceColor() {
        function randomColor() {
            const letters = '0123456789ABCDEF';
            let color = '#';
            for (let i = 0; i < 6; i++) {
                color += letters[Math.floor(Math.random() * 16)];
            }
            return color;
        }
        let newColor = randomColor();
        // Build a set of used colors from labelClasses and existing instance annotations
        const usedColors = new Set();
        if (labelClasses) {
            labelClasses.forEach(lc => usedColors.add(lc.color.toUpperCase()));
        }
        annotations.forEach(ann => {
            if (ann.instanceId && ann.color) {
                usedColors.add(ann.color.toUpperCase());
            }
        });
        let attempts = 0;
        while (usedColors.has(newColor.toUpperCase()) && attempts < 100) {
            newColor = randomColor();
            attempts++;
        }
        return newColor;
    }

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
                        {konvaImg && (
                            <KonvaImage
                                image={konvaImg}
                                width={konvaImg.width}
                                height={konvaImg.height}
                            />
                        )}

                        {/* Render existing polygon annotations */}
                        {annotations.map((ann, i) => {
                            if (ann.type === 'polygon') {
                                const annColor = ann.color || activeLabelColor || '#ff0000';
                                const fillColor = annColor + '55';

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
                                                        setSelectedAnnotationIndex(i);
                                                    }
                                                }}
                                            >
                                                <Path
                                                    data={pathData}
                                                    fill={fillColor}
                                                    stroke={annColor}
                                                    strokeWidth={2 / scale}
                                                    fillRule="evenodd"
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
                                                        draggable
                                                        onMouseDown={(ev) => (ev.cancelBubble = true)}
                                                        onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                                                        onContextMenu={(ev) => {
                                                            ev.evt.preventDefault();
                                                            ev.cancelBubble = true;
                                                            const updated = [...annotations];
                                                            const shapePoints = [...ann.points];
                                                            shapePoints.splice(idx, 1);
                                                            if (shapePoints.length < 3) {
                                                                updated.splice(i, 1);
                                                            } else {
                                                                updated[i] = { ...ann, points: shapePoints };
                                                            }
                                                            onAnnotationsChange(updated);
                                                        }}
                                                        onClick={(ev) => {
                                                            ev.cancelBubble = true;
                                                            const updated = [...annotations];
                                                            const shapePoints = [...ann.points];
                                                            const length = shapePoints.length;
                                                            let nextIndex = (idx + 1) % length;
                                                            const currentPt = shapePoints[idx];
                                                            const nextPt = shapePoints[nextIndex];
                                                            const midX = (currentPt.x + nextPt.x) / 2;
                                                            const midY = (currentPt.y + nextPt.y) / 2;
                                                            shapePoints.splice(idx + 1, 0, { x: midX, y: midY });
                                                            updated[i] = { ...ann, points: shapePoints };
                                                            onAnnotationsChange(updated);
                                                        }}
                                                    />
                                                ))}
                                            </Group>
                                            {ann.instanceId && (
                                                <InstanceIdLabel
                                                    annotation={ann}
                                                    scale={scale}
                                                    shapeBoundingBox={shapeBoundingBox}
                                                    color={annColor}
                                                />
                                            )}
                                            <DeleteLabel
                                                annotation={ann}
                                                scale={scale}
                                                shapeBoundingBox={shapeBoundingBox}
                                                onDelete={() => onDeleteAnnotation(i)}
                                                color={annColor}
                                            />
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
                                                        setSelectedAnnotationIndex(i);
                                                    }
                                                }}
                                            >
                                                <Line
                                                    points={pts}
                                                    fill={fillColor}
                                                    stroke={annColor}
                                                    strokeWidth={2 / scale}
                                                    closed
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
                                                        draggable
                                                        onMouseDown={(ev) => (ev.cancelBubble = true)}
                                                        onDragEnd={(ev) => handleVertexDragEnd(i, idx, ev)}
                                                        onContextMenu={(ev) => {
                                                            ev.evt.preventDefault();
                                                            ev.cancelBubble = true;
                                                            const updated = [...annotations];
                                                            const shapePoints = [...ann.points];
                                                            shapePoints.splice(idx, 1);
                                                            if (shapePoints.length < 3) {
                                                                updated.splice(i, 1);
                                                            } else {
                                                                updated[i] = { ...ann, points: shapePoints };
                                                            }
                                                            onAnnotationsChange(updated);
                                                        }}
                                                        onClick={(ev) => {
                                                            ev.cancelBubble = true;
                                                            const updated = [...annotations];
                                                            const shapePoints = [...ann.points];
                                                            const length = shapePoints.length;
                                                            let nextIndex = (idx + 1) % length;
                                                            const currentPt = shapePoints[idx];
                                                            const nextPt = shapePoints[nextIndex];
                                                            const midX = (currentPt.x + nextPt.x) / 2;
                                                            const midY = (currentPt.y + nextPt.y) / 2;
                                                            shapePoints.splice(idx + 1, 0, { x: midX, y: midY });
                                                            updated[i] = { ...ann, points: shapePoints };
                                                            onAnnotationsChange(updated);
                                                        }}
                                                    />
                                                ))}
                                                <Arrow
                                                    points={[secondPt.x, secondPt.y, firstPt.x, firstPt.y]}
                                                    fill={annColor}
                                                    stroke={annColor}
                                                    strokeWidth={2 / scale}
                                                    pointerLength={10 / scale}
                                                    pointerWidth={8 / scale}
                                                />
                                            </Group>
                                            {ann.instanceId && (
                                                <InstanceIdLabel
                                                    annotation={ann}
                                                    scale={scale}
                                                    shapeBoundingBox={shapeBoundingBox}
                                                    color={annColor}
                                                />
                                            )}
                                            <DeleteLabel
                                                annotation={ann}
                                                scale={scale}
                                                shapeBoundingBox={shapeBoundingBox}
                                                onDelete={() => onDeleteAnnotation(i)}
                                                color={annColor}
                                            />
                                        </React.Fragment>
                                    );
                                }
                            }
                            return null;
                        })}

                        {/* In-progress Polygon */}
                        {drawingPolygon && selectedTool === 'polygon' && (
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

                        {/* In-progress Instance Segmentation Polygon */}
                        {drawingInstancePolygon &&
                            selectedTool === 'segmentation' &&
                            segmentationType === 'instance' && (
                                <>
                                    {tempInstancePoints.length > 1 && (
                                        <Line
                                            points={flattenPoints([
                                                ...tempInstancePoints,
                                                tempInstancePoints[0],
                                            ])}
                                            fill={activeLabelColor + '55'}
                                            stroke={activeLabelColor}
                                            strokeWidth={2 / scale}
                                            closed
                                        />
                                    )}
                                    {tempInstancePoints.map((pt, idx) => (
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

                        {/* In-progress Semantic Segmentation Polygon */}
                        {drawingSemanticPolygon &&
                            selectedTool === 'segmentation' &&
                            segmentationType === 'semantic' && (
                                <>
                                    {tempSemanticPoints.length > 1 && (
                                        <Line
                                            points={flattenPoints([
                                                ...tempSemanticPoints,
                                                tempSemanticPoints[0],
                                            ])}
                                            fill={activeLabelColor + '55'}
                                            stroke={activeLabelColor}
                                            strokeWidth={2 / scale}
                                            closed
                                        />
                                    )}
                                    {tempSemanticPoints.map((pt, idx) => (
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

                        {/* In-progress Panoptic Polygon for Instance */}
                        {drawingInstancePolygon &&
                            selectedTool === 'segmentation' &&
                            segmentationType === 'panoptic' &&
                            panopticOption === 'instance' && (
                                <>
                                    {tempInstancePoints.length > 1 && (
                                        <Line
                                            points={flattenPoints([
                                                ...tempInstancePoints,
                                                tempInstancePoints[0],
                                            ])}
                                            fill={activeLabelColor + '55'}
                                            stroke={activeLabelColor}
                                            strokeWidth={2 / scale}
                                            closed
                                        />
                                    )}
                                    {tempInstancePoints.map((pt, idx) => (
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

                        {/* In-progress Panoptic Polygon for Semantic */}
                        {drawingSemanticPolygon &&
                            selectedTool === 'segmentation' &&
                            segmentationType === 'panoptic' &&
                            panopticOption === 'semantic' && (
                                <>
                                    {tempSemanticPoints.length > 1 && (
                                        <Line
                                            points={flattenPoints([
                                                ...tempSemanticPoints,
                                                tempSemanticPoints[0],
                                            ])}
                                            fill={activeLabelColor + '55'}
                                            stroke={activeLabelColor}
                                            strokeWidth={2 / scale}
                                            closed
                                        />
                                    )}
                                    {tempSemanticPoints.map((pt, idx) => (
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
                </Layer>
            </Stage>
        </div>
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

// A small Konva Label to display the instance ID if present
function InstanceIdLabel({ annotation, scale, shapeBoundingBox, color }) {
    const box = shapeBoundingBox(annotation);
    if (!box) return null;
    if (!annotation.instanceId) return null;

    const xPos = box.x1;
    const yPos = box.y1 - 35 / scale; // place slightly above the shape

    return (
        <Label x={xPos} y={yPos} scaleX={1 / scale} scaleY={1 / scale}>
            <Tag fill={color || '#ff0000'} opacity={0.9} cornerRadius={4} />
            <Text text={annotation.instanceId} fill="#fff" padding={5} fontSize={14} />
        </Label>
    );
}
