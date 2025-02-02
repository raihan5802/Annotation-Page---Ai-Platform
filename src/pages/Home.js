import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const handleGoImages = () => {
    // Normal annotation flow
    navigate('/images', { state: { segmentationMode: false } });
  };

  const handleGoSegmentation = () => {
    // Pass a flag so that ImageHome knows we want segmentation mode.
    navigate('/images', { state: { segmentationMode: true } });
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
      </div>
    </div>
  );
}

export default Home;
