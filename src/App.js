import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageHome from './pages/ImageHome';
import Annotate from './pages/Annotate';
import Segmentation from './pages/Segmentation';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/images" element={<ImageHome />} />
      <Route path="/annotate" element={<Annotate />} />
      <Route path="/segmentation" element={<Segmentation />} />
    </Routes>
  );
}

export default App;
