import React from 'react';
import { Routes, Route } from 'react-router-dom';

import Home from './pages/Home';
import ImageHome from './pages/ImageHome';
import Annotate from './pages/Annotate';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/images" element={<ImageHome />} />
      <Route path="/annotate" element={<Annotate />} />
    </Routes>
  );
}

export default App;
