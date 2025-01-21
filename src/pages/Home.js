import React from 'react';
import { useNavigate } from 'react-router-dom';
import './Home.css';

function Home() {
  const navigate = useNavigate();

  const handleGo = () => {
    navigate('/images');
  };

  return (
    <div className="home-container">
      <div className="home-card">
        <h1>CVAT-like Annotation</h1>
        <p>Supports bounding box & polygon, multiple labels, and exports to COCO/YOLO/Pascal VOC.</p>
        <button onClick={handleGo}>Start with Images</button>
      </div>
    </div>
  );
}

export default Home;
