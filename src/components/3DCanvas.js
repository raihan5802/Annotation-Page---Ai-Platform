import React, { useEffect, useRef, useState } from 'react';
import {
    Stage,
    Layer,
    Group,
    Image as KonvaImage,
    Rect,
} from 'react-konva';
import * as THREE from 'three';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { PLYLoader } from 'three/examples/jsm/loaders/PLYLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './3DCanvas.css';

export default function ThreeDCanvas({
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
    initialPosition,
    externalSelectedIndex,
    onSelectAnnotation,
}) {
    const stageRef = useRef(null);
    const containerRef = useRef(null);

    const [dims, setDims] = useState({ width: 0, height: 0 });
    const [modelImg, setModelImg] = useState(null);
    const [imgDims, setImgDims] = useState({ width: 0, height: 0 });
    const [imageLoaded, setImageLoaded] = useState(false);

    // Master group offset (image panning)
    const [imagePos, setImagePos] = useState(initialPosition || { x: 0, y: 0 });

    // For selecting shape to transform
    const [selectedAnnotationIndex, setSelectedAnnotationIndex] = useState(null);
    const transformerRef = useRef(null);

    // Cursor style for annotation
    const crosshairCursor = `url('data:image/svg+xml;utf8,<svg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><line x1="50" y1="10" x2="50" y2="45" stroke="black" stroke-width="2"/><line x1="50" y1="55" x2="50" y2="90" stroke="black" stroke-width="2"/><line x1="10" y1="50" x2="45" y2="50" stroke="black" stroke-width="2"/><line x1="55" y1="50" x2="90" y2="50" stroke="black" stroke-width="2"/><circle cx="50" cy="50" r="1" fill="black"/></svg>') 50 50, crosshair`;

    const threeContainerRef = useRef(null);
    const rendererRef = useRef(null);
    const sceneRef = useRef(null);
    const cameraRef = useRef(null);
    const controlsRef = useRef(null);
    const modelRef = useRef(null);
    const animationFrameRef = useRef(null);

    const [useThreeRenderer, setUseThreeRenderer] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

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

    // ----------- Load 3D model or preview image -----------
    useEffect(() => {
        if (!fileUrl) return;

        const extension = fileUrl.split('.').pop().toLowerCase();
        // List of formats we support with Three.js
        const threeSupportedFormats = ['obj', 'gltf', 'glb', 'stl', 'ply', 'fbx'];

        if (threeSupportedFormats.includes(extension)) {
            setUseThreeRenderer(true);
        } else {
            setUseThreeRenderer(false);
        }
    }, [fileUrl]);

    // Apply custom initial position when provided or center on resize
    useEffect(() => {
        if (initialPosition && (initialPosition.x !== 0 || initialPosition.y !== 0)) {
            setImagePos(initialPosition);
        } else if (imageLoaded && modelImg && dims.width && dims.height) {
            // Center image
            const xPos = Math.max(0, (dims.width - imgDims.width) / 2);
            const yPos = Math.max(0, (dims.height - imgDims.height) / 2);
            setImagePos({ x: xPos, y: yPos });
        }
    }, [initialPosition, imageLoaded, modelImg, dims, imgDims]);

    //Three.js initialization 
    // Initialize Three.js scene for 3D model rendering
    useEffect(() => {
        // Make sure threeContainerRef exists and we should use Three.js renderer
        if (!threeContainerRef.current || !useThreeRenderer) return;

        // Clear any existing content
        while (threeContainerRef.current.firstChild) {
            threeContainerRef.current.removeChild(threeContainerRef.current.firstChild);
        }

        // Create scene with white background like 3dviewer.net
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0xffffff); // White background
        sceneRef.current = scene;

        // Better lighting setup similar to 3dviewer.net
        // Main light from top-right
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(10, 10, 10);
        mainLight.castShadow = true;
        scene.add(mainLight);

        // Fill light from left
        const fillLight = new THREE.DirectionalLight(0xffffff, 0.5);
        fillLight.position.set(-10, 5, -10);
        scene.add(fillLight);

        // Bottom light for soft shadows
        const bottomLight = new THREE.DirectionalLight(0xffffff, 0.3);
        bottomLight.position.set(0, -10, 0);
        scene.add(bottomLight);

        // Ambient light for general illumination
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        // Add axes helper for reference
        const axesHelper = new THREE.AxesHelper(2);
        scene.add(axesHelper);

        // Add a grid helper for reference
        const gridHelper = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
        gridHelper.position.y = -0.5;
        scene.add(gridHelper);

        // Create camera
        const width = threeContainerRef.current.offsetWidth;
        const height = threeContainerRef.current.offsetHeight;
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        camera.position.set(5, 3, 5);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        // Setup renderer with shadows
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        renderer.setSize(width, height);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.setPixelRatio(window.devicePixelRatio);

        // Use sRGBEncoding if available (depends on Three.js version)
        // Handle color output encoding based on Three.js version
        if (THREE.ColorManagement) {
            renderer.outputColorSpace = THREE.SRGBColorSpace;
        }

        threeContainerRef.current.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        // Add OrbitControls
        const controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
        controls.rotateSpeed = 0.7;
        controls.zoomSpeed = 1.2;
        controls.minDistance = 2;
        controls.maxDistance = 20;
        controls.enablePan = true;
        controls.target.set(0, 0, 0);
        controls.update();
        controlsRef.current = controls;

        // Animation loop
        const animate = () => {
            animationFrameRef.current = requestAnimationFrame(animate);
            if (controlsRef.current) {
                controlsRef.current.update();
            }
            if (rendererRef.current && sceneRef.current && cameraRef.current) {
                rendererRef.current.render(sceneRef.current, cameraRef.current);
            }
        };

        animate();

        // Cleanup
        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            if (rendererRef.current && threeContainerRef.current) {
                threeContainerRef.current.removeChild(rendererRef.current.domElement);
            }

            if (sceneRef.current) {
                sceneRef.current.clear();
            }

            // Clear references
            rendererRef.current = null;
            sceneRef.current = null;
            cameraRef.current = null;
            controlsRef.current = null;
            modelRef.current = null;
        };
    }, [useThreeRenderer]);

    //3D model loading code
    useEffect(() => {
        if (!fileUrl || !sceneRef.current || !useThreeRenderer) return;

        setIsLoading(true);
        const extension = fileUrl.split('.').pop().toLowerCase();

        // Clear any previous model
        if (modelRef.current) {
            sceneRef.current.remove(modelRef.current);
        }

        // Load based on file type with appropriate loader
        try {
            switch (extension) {
                case 'obj':
                    const objLoader = new OBJLoader();

                    console.log("File URL:", fileUrl);
                    console.log("File extension:", getFileExtension(fileUrl));
                    console.log("Three.js container dimensions:", threeContainerRef.current?.offsetWidth, threeContainerRef.current?.offsetHeight);

                    objLoader.load(fileUrl,
                        (object) => {
                            console.log("Model loaded:", object);

                            // Apply better materials to all meshes
                            object.traverse(function (child) {
                                if (child instanceof THREE.Mesh) {
                                    // Create a better material that works well with lighting
                                    child.material = new THREE.MeshStandardMaterial({
                                        color: 0xcccccc, // Light gray like in 3dviewer.net
                                        metalness: 0.2,
                                        roughness: 0.5,
                                        side: THREE.DoubleSide
                                    });

                                    // Enable shadows
                                    child.castShadow = true;
                                    child.receiveShadow = true;
                                }
                            });

                            // Get the bounding box
                            const box = new THREE.Box3().setFromObject(object);
                            const size = box.getSize(new THREE.Vector3());
                            const center = box.getCenter(new THREE.Vector3());

                            // Calculate appropriate scale to fit in view (like 3dviewer.net)
                            const maxDim = Math.max(size.x, size.y, size.z);
                            const scale = 5 / maxDim; // Smaller scale factor
                            object.scale.set(scale, scale, scale);

                            // Center object at origin
                            object.position.set(-center.x * scale, -center.y * scale, -center.z * scale);

                            // Add to scene
                            sceneRef.current.add(object);
                            modelRef.current = object;

                            // Position camera to view model properly (further away)
                            if (cameraRef.current && controlsRef.current) {
                                // Position camera for a 3/4 view like in 3dviewer.net
                                cameraRef.current.position.set(5, 3, 5);
                                cameraRef.current.lookAt(0, 0, 0);
                                controlsRef.current.target.set(0, 0, 0);
                                controlsRef.current.update();
                            }

                            setIsLoading(false);
                        },
                        (xhr) => {
                            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
                        },
                        (error) => {
                            console.error(error);
                            setError("Failed to load OBJ model");
                            setIsLoading(false);
                        }
                    );
                    break;
                // Add other format loaders
            }
        } catch (err) {
            setError("Error initializing loader");
            setIsLoading(false);
        }
    }, [fileUrl, useThreeRenderer]);

    // ----------- Relative pointer position -----------
    function getGroupPos(evt) {
        const group = stageRef.current?.findOne('#anno-group');
        return group ? group.getRelativePointerPosition() : null;
    }

    // ----------- Wheel Zoom -----------
    function handleWheel(evt) {
        evt.evt.preventDefault();
        onWheelZoom(evt.evt.deltaY);
    }

    // ----------- Handle file extension -----------
    const getFileExtension = (url) => {
        return url.split('.').pop().toLowerCase();
    };

    // ----------- Render placeholder for unsupported 3D format -----------
    const renderPlaceholder = () => {
        return (
            <div className="model-placeholder">
                <div className="model-info">
                    <h3>3D Model Viewer</h3>
                    <p>Format: {fileUrl ? getFileExtension(fileUrl) : 'Unknown'}</p>
                    <p>Full 3D viewer implementation coming soon</p>
                </div>
            </div>
        );
    };

    // ----------- Mouse events -----------
    function handleMouseDown(evt) {
        // If click is not on an annotation and not in draw mode, deselect the current annotation
        if (selectedTool === 'move' && evt.target.name() === 'background-image') {
            onSelectAnnotation(null);
        }
    }

    return (
        <div className="canvas-container" ref={containerRef}>
            {/* Original Konva renderer - only show when not using Three.js */}
            {!useThreeRenderer && (
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
                            {modelImg && (
                                <KonvaImage
                                    image={modelImg}
                                    width={modelImg.width}
                                    height={modelImg.height}
                                    name="background-image"
                                />
                            )}
                        </Group>
                    </Layer>
                </Stage>
            )}

            {/* Three.js container - only show when using Three.js */}
            {useThreeRenderer && (
                <div
                    ref={threeContainerRef}
                    className="three-container"
                    style={{
                        width: '100%',
                        height: '100%',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        border: '2px solid red' // Temporary border to visualize the container
                    }}
                ></div>
            )}

            {/* Loading and error overlays */}
            {isLoading && (
                <div className="model-placeholder">
                    <div className="model-info loading">
                        <h3>Loading 3D Model...</h3>
                        <div className="loading-spinner"></div>
                    </div>
                </div>
            )}

            {error && (
                <div className="model-placeholder">
                    <div className="model-info error">
                        <h3>Error Loading Model</h3>
                        <p>{error}</p>
                    </div>
                </div>
            )}
        </div>
    );
}