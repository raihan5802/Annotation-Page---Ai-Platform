// src/pages/Home.js
import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import HomeTopBar from '../components/HomeTopBar';
import './Home.css';

function Home() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const userSession = localStorage.getItem('user');
    setIsAuthenticated(!!userSession);
  }, []);

  const handleNavigation = (path, state) => {
    if (!isAuthenticated) {
      localStorage.setItem('redirectAfterLogin', JSON.stringify({
        path,
        state
      }));
      navigate('/signin');
    } else {
      navigate(path, { state });
    }
  };

  const handleGoImages = () => {
    handleNavigation('/images', {
      segmentationMode: false,
      classificationMode: false
    });
  };

  const handleGoSegmentation = () => {
    handleNavigation('/images', {
      segmentationMode: true,
      classificationMode: false
    });
  };

  const handleGoClassification = () => {
    handleNavigation('/images', {
      segmentationMode: false,
      classificationMode: true
    });
  };

  const handleGo3DAnnotation = () => {
    handleNavigation('/images', {
      segmentationMode: false,
      classificationMode: false,
      threeDMode: true
    });
  };

  return (
    <div className="home-container">
      <HomeTopBar />
      <div className="home-content">
        <video
          src="/background.mp4"
          autoPlay
          loop
          muted
          className="background-video"
          onLoadStart={() => console.log('Video load started')}
          onLoadedData={() => console.log('Video data loaded')}
          onPlay={() => console.log('Video started playing')}
        ></video>
        <div className="annotation-box">
          <h2>Image Annotation</h2>
          <div className="card-container">
            <div className="card">
              <video src="/detection.mp4" autoPlay loop muted playbackrate='100'></video>
              <div className="card-text">
                <h3>Image Detection</h3>
                <p>Contains tools like bounding box, polygon, polyline, point, and ellipse.</p>
              </div>
              <button onClick={handleGoImages}>Image Detection</button>
            </div>
            <div className="card">
              <video src="/segmentation.mp4" autoPlay loop muted playbackrate='20000'></video>
              <div className="card-text">
                <h3>Image Segmentation</h3>
                <p>Supports instance segmentation, semantic segmentation, and panoptic segmentation.</p>
              </div>
              <button onClick={handleGoSegmentation}>Image Segmentation</button>
            </div>
            <div className="card">
              <video src="/classification.mp4" autoPlay loop muted></video>
              <div className="card-text">
                <h3>Image Classification</h3>
                <p>Assign labels to entire images rather than specific regions within the images.</p>
              </div>
              <button onClick={handleGoClassification}>Image Classification</button>
            </div>
            <div className="card">
              <video src="/classification.mp4" autoPlay loop muted></video>
              <div className="card-text">
                <h3>3D Image Annotation</h3>
                <p>Annotate 3D images with specialized tools for depth and volumetric data.</p>
              </div>
              <button onClick={handleGo3DAnnotation}>3D Image Annotation</button>
            </div>
          </div>
          <div className="get-started-container">
            <button
              className="get-started-btn"
              onClick={() => navigate('/signin')}
            >
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;