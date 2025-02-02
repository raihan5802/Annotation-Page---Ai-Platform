import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const handleGoImages = () => {
    // Normal detection flow
    navigate('/images', { state: { segmentationMode: false, classificationMode: false } });
  };

  const handleGoSegmentation = () => {
    // For segmentation tasks
    navigate('/images', { state: { segmentationMode: true, classificationMode: false } });
  };

  // New function for classification mode
  const handleGoClassification = () => {
    navigate('/images', { state: { segmentationMode: false, classificationMode: true } });
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>CVAT-like Annotation</h1>
        <p>
          Supports bounding box &amp; polygon, multiple labels, and exports to COCO/YOLO/Pascal VOC.
        </p>
        <button onClick={handleGoImages}>Image Detection</button>
        <button onClick={handleGoSegmentation} style={{ marginTop: '10px' }}>
          Image Segmentation
        </button>
        <button onClick={handleGoClassification} style={{ marginTop: '10px' }}>
          Image Classification
        </button>
      </div>
    </div>
  );
}

export default Home;
