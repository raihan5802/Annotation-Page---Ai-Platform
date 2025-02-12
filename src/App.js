import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import ImageHome from './pages/ImageHome';
import Detection from './pages/Detection';
import Segmentation from './pages/Segmentation';
import Classification from './pages/Classification';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/images" element={<ImageHome />} />
      <Route path="/detection" element={<Detection />} />
      <Route path="/segmentation" element={<Segmentation />} />
      <Route path="/classification" element={<Classification />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
    </Routes>
  );
}

export default App;

