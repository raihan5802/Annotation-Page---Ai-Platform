import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import UserHome from './pages/UserHome';
import ImageHome from './pages/ImageHome';
import Detection from './pages/Detection';
import Segmentation from './pages/Segmentation';
import Classification from './pages/Classification';
import ThreeD from './pages/3D';
import SignIn from './pages/SignIn';
import SignUp from './pages/SignUp';
import Tasks from './pages/Tasks';
import Projects from './pages/Projects';
import Jobs from './pages/Jobs';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/userhome" element={<UserHome />} />
      <Route path="/images" element={<ImageHome />} />
      <Route path="/detection" element={<Detection />} />
      <Route path="/segmentation" element={<Segmentation />} />
      <Route path="/classification" element={<Classification />} />
      <Route path="/3d" element={<ThreeD />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/projects" element={<Projects />} />
      <Route path="/tasks" element={<Tasks />} />
      <Route path="/jobs" element={<Jobs />} />
    </Routes>
  );
}

export default App;