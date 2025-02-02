import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageHome from './pages/ImageHome';
import Detection from './pages/Detection';
import Segmentation from './pages/Segmentation';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/images" element={<ImageHome />} />
      <Route path="/detection" element={<Detection />} />
      <Route path="/segmentation" element={<Segmentation />} />
    </Routes>
  );
}

export default App;
