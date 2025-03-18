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
    initialPosition = { x: 0, y: 0 }, // Position for image centering
    externalSelectedIndex, // For syncing selection with sidebar
    onSelectAnnotation, // Callback to notify parent of selection change
}) {
    const stageRef = useRef(null);
    const containerRef = useRef(null);

    const [dims, setDims] = useState({ width: 0, height: 0 });
    const [konvaImg, setKonvaImg] = useState(null);

    // Master group offset (image panning)
    const [imagePos, setImagePos] = useState(initialPosition);

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

    const [previewPoints, setPreviewPoints] = useState([]);
    const [isShowingReducedPreview, setIsShowingReducedPreview] = useState(false); // Track if showing preview



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
            setKonvaImg(img);
            setImagePos(initialPosition);
        };
        img.onerror = () => console.error('Could not load image:', fileUrl);
    }, [fileUrl, initialPosition]);

    // Apply custom initial position when provided
    useEffect(() => {
        if (initialPosition && (initialPosition.x !== 0 || initialPosition.y !== 0)) {
            setImagePos(initialPosition);
        }
    }, [initialPosition]);

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
                opacity: 0.55, // Default opacity
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
        const pointsToUse = pointsParam || tempSemanticPoints;
        if (pointsToUse.length >= 3) {
            const newAnn = {
                type: 'polygon',
                points: pointsToUse,
                label: activeLabel,
                color: activeLabelColor,
                opacity: 0.55, // Default opacity
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
        // If click is not on an annotation and not in draw mode, deselect the current annotation
        if (selectedTool === 'move' && evt.target.name() === 'background-image') {
            onSelectAnnotation(null);
        }

        if (selectedTool === 'move') {
            return;
        }
        const pos = getGroupPos(evt);
        if (!pos) return;

        // Check if Ctrl key is pressed for continuous annotation
        const isCtrlPressed = evt.evt.ctrlKey;

        // For tools that support Ctrl+drag continuous annotation
        if (isCtrlPressed && (selectedTool === 'polygon' || selectedTool === 'instance' || selectedTool === 'semantic' || selectedTool === 'panoptic')) {
            setIsDraggingWithCtrl(true);
            setLastDragPoint(pos);

            // Add first point
            if (selectedTool === 'polygon') {
                addPolygonPoint(pos);
            } else if (selectedTool === 'instance') {
                addInstancePolygonPoint(pos);
            } else if (selectedTool === 'semantic') {
                addSemanticPolygonPoint(pos);
            } else if (selectedTool === 'panoptic') {
                if (panopticOption === 'instance') {
                    addInstancePolygonPoint(pos);
                } else if (panopticOption === 'semantic') {
                    addSemanticPolygonPoint(pos);
                }
            }
            return;
        }

        // Double-click logic for finalizing shape
        const now = Date.now();
        const delta = now - lastClickTimeRef.current;
        const usesDoubleClick = ['polygon', 'instance', 'semantic', 'panoptic'].includes(selectedTool);

        if (usesDoubleClick && delta < doubleClickThreshold) {
            return; // double-click => handled in handleDblClick
        }
        lastClickTimeRef.current = now;

        // Add points based on selected tool
        if (selectedTool === 'polygon') {
            addPolygonPoint(pos);
        } else if (selectedTool === 'instance') {
            addInstancePolygonPoint(pos);
        } else if (selectedTool === 'semantic') {
            addSemanticPolygonPoint(pos);
        } else if (selectedTool === 'panoptic') {
            if (panopticOption === 'instance') {
                addInstancePolygonPoint(pos);
            } else if (panopticOption === 'semantic') {
                addSemanticPolygonPoint(pos);
            }
        }
    }

    function handleMouseMove(evt) {
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
                } else if (selectedTool === 'instance' && drawingInstancePolygon) {
                    if (pointsLimit === 0 || tempInstancePoints.length < pointsLimit) {
                        addInstancePolygonPoint(pos);
                    } else if (tempInstancePoints.length >= pointsLimit) {
                        setIsDraggingWithCtrl(false);
                        finalizeInstancePolygon();
                        return;
                    }
                } else if (selectedTool === 'semantic' && drawingSemanticPolygon) {
                    if (pointsLimit === 0 || tempSemanticPoints.length < pointsLimit) {
                        addSemanticPolygonPoint(pos);
                    } else if (tempSemanticPoints.length >= pointsLimit) {
                        setIsDraggingWithCtrl(false);
                        finalizeSemanticPolygon();
                        return;
                    }
                } else if (selectedTool === 'panoptic') {
                    if (panopticOption === 'instance' && drawingInstancePolygon) {
                        if (pointsLimit === 0 || tempInstancePoints.length < pointsLimit) {
                            addInstancePolygonPoint(pos);
                        } else if (tempInstancePoints.length >= pointsLimit) {
                            setIsDraggingWithCtrl(false);
                            finalizeInstancePolygon();
                            return;
                        }
                    } else if (panopticOption === 'semantic' && drawingSemanticPolygon) {
                        if (pointsLimit === 0 || tempSemanticPoints.length < pointsLimit) {
                            addSemanticPolygonPoint(pos);
                        } else if (tempSemanticPoints.length >= pointsLimit) {
                            setIsDraggingWithCtrl(false);
                            finalizeSemanticPolygon();
                            return;
                        }
                    }
                }

                setLastDragPoint(pos);
            }
        }
    }

    // Function to calculate distance between two points
    function getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    }

    function handleMouseUp() {
        // Handle end of Ctrl+drag annotation - finalize when mouse is released
        if (isDraggingWithCtrl) {
            setIsDraggingWithCtrl(false);
            setLastDragPoint(null);

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

            } else if (selectedTool === 'instance' && drawingInstancePolygon && tempInstancePoints.length >= 3) {
                //finalizeInstancePolygon();
                points = [...tempInstancePoints];
                annotationType = 'instance';
                setOriginalPoints([...tempInstancePoints]);
                setCurrentAnnotationPoints([...tempInstancePoints]);
                setCurrentAnnotationType('instance');
                setShowPointReductionPanel(true);

            } else if (selectedTool === 'semantic' && drawingSemanticPolygon && tempSemanticPoints.length >= 3) {
                //finalizeSemanticPolygon();
                points = [...tempSemanticPoints];
                annotationType = 'semantic';
                setOriginalPoints([...tempSemanticPoints]);
                setCurrentAnnotationPoints([...tempSemanticPoints]);
                setCurrentAnnotationType('semantic');
                setShowPointReductionPanel(true);

            } else if (selectedTool === 'panoptic') {
                if (panopticOption === 'instance' && drawingInstancePolygon && tempInstancePoints.length >= 3) {
                    //finalizeInstancePolygon();
                    points = [...tempInstancePoints];
                    annotationType = 'panoptic-instance';
                    setOriginalPoints([...tempInstancePoints]);
                    setCurrentAnnotationPoints([...tempInstancePoints]);
                    setCurrentAnnotationType('panoptic-instance');
                    setShowPointReductionPanel(true);

                } else if (panopticOption === 'semantic' && drawingSemanticPolygon && tempSemanticPoints.length >= 3) {
                    //finalizeSemanticPolygon();
                    points = [...tempSemanticPoints];
                    annotationType = 'panoptic-semantic';
                    setOriginalPoints([...tempSemanticPoints]);
                    setCurrentAnnotationPoints([...tempSemanticPoints]);
                    setCurrentAnnotationType('panoptic-semantic');
                    setShowPointReductionPanel(true);

                }
            }
        }
    }

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

    // function to reduce points based on the distance threshold:
    function applyPointReduction() {
        // Apply the reduced points based on current annotation type
        if (currentAnnotationType === 'polygon') {
            finalizePolygon(currentAnnotationPoints);
        } else if (currentAnnotationType === 'instance') {
            finalizeInstancePolygon(currentAnnotationPoints);
        } else if (currentAnnotationType === 'semantic') {
            finalizeSemanticPolygon(currentAnnotationPoints);
        } else if (currentAnnotationType === 'panoptic-instance') {
            finalizeInstancePolygon(currentAnnotationPoints);
        } else if (currentAnnotationType === 'panoptic-semantic') {
            finalizeSemanticPolygon(currentAnnotationPoints);
        }

        // Reset and hide the panel
        setIsShowingReducedPreview(false);
        setShowPointReductionPanel(false);
        setCurrentAnnotationPoints([]);
        setCurrentAnnotationType('');
    }

    // functions to apply or cancel point reduction:
    function cancelPointReduction() {
        // Use original points for finalization
        if (currentAnnotationType === 'polygon') {
            finalizePolygon(originalPoints);
        } else if (currentAnnotationType === 'instance') {
            finalizeInstancePolygon(originalPoints);
        } else if (currentAnnotationType === 'semantic') {
            finalizeSemanticPolygon(originalPoints);
        } else if (currentAnnotationType === 'panoptic-instance') {
            finalizeInstancePolygon(originalPoints);
        } else if (currentAnnotationType === 'panoptic-semantic') {
            finalizeSemanticPolygon(originalPoints);
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

    // helper function to render the appropriate in-progress shape based on reduction state
    function renderInProgressShape() {
        const pointsToShow = isShowingReducedPreview ? currentAnnotationPoints : originalPoints;

        if (currentAnnotationType === 'polygon' ||
            currentAnnotationType === 'instance' ||
            currentAnnotationType === 'semantic' ||
            currentAnnotationType === 'panoptic-instance' ||
            currentAnnotationType === 'panoptic-semantic') {

            // Only render if we have points
            if (pointsToShow.length <= 0) return null;

            return (
                <>
                    {pointsToShow.length > 1 && (
                        <Line
                            points={flattenPoints([...pointsToShow, pointsToShow[0]])}
                            fill={activeLabelColor + '55'}
                            stroke={activeLabelColor}
                            strokeWidth={2 / scale}
                            closed
                        />
                    )}
                    {pointsToShow.map((pt, idx) => (
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
            );
        }

        return null;
    }

    function handleDblClick() {
        if (selectedTool === 'polygon' && drawingPolygon) {
            finalizePolygon();
        } else if (selectedTool === 'instance' && drawingInstancePolygon) {
            finalizeInstancePolygon();
        } else if (selectedTool === 'semantic' && drawingSemanticPolygon) {
            finalizeSemanticPolygon();
        } else if (selectedTool === 'panoptic') {
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
                            {konvaImg && (
                                <KonvaImage
                                    image={konvaImg}
                                    width={konvaImg.width}
                                    height={konvaImg.height}
                                    name="background-image"
                                />
                            )}

                            {/* Render existing polygon annotations */}
                            {annotations.map((ann, i) => {
                                if (ann.type === 'polygon') {
                                    const annColor = ann.color || activeLabelColor || '#ff0000';
                                    const fillColor = annColor + '55';
                                    const opacity = ann.opacity !== undefined ? ann.opacity : 1.0; // Support opacity

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
                                                            onSelectAnnotation(i);
                                                        }
                                                    }}
                                                >
                                                    <Line
                                                        points={pts}
                                                        fill={annColor}
                                                        stroke={annColor}
                                                        strokeWidth={2 / scale}
                                                        opacity={opacity}
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
                                                            opacity={opacity}
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
                                                        opacity={opacity}
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

                            {/* Dynamic Preview of Point Reduction */}
                            {showPointReductionPanel && (
                                <>
                                    {/* Use currentAnnotationPoints if preview is enabled, otherwise use originalPoints */}
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

                            {/* When not in point reduction mode, show original in-progress shapes */}
                            {!showPointReductionPanel && (
                                <>
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
                                    {drawingInstancePolygon && selectedTool === 'instance' && (
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
                                    {drawingSemanticPolygon && selectedTool === 'semantic' && (
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
                                        selectedTool === 'panoptic' &&
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
                                        selectedTool === 'panoptic' &&
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
                                </>
                            )}
                        </Group>
                    </Layer>
                </Stage>
            ) : (
                <div>Loading image...</div>
            )}

            {/* Point Reduction Panel */}
            {showPointReductionPanel && (
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
            )}
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