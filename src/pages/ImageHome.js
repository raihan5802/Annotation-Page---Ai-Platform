// ImageHome.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './ImageHome.css';

const COLOR_PALETTE = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
];

export default function ImageHome() {
  const navigate = useNavigate();
  const location = useLocation();
  const segmentationMode = location.state?.segmentationMode || false;

  const [taskName, setTaskName] = useState('');
  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(COLOR_PALETTE[0]);
  const [colorIndex, setColorIndex] = useState(1);
  const [labelClasses, setLabelClasses] = useState([]);

  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [folderData, setFolderData] = useState(null);

  useEffect(() => {
    const limited = files.slice(0, 5).map(f => ({
      url: URL.createObjectURL(f),
      name: f.name
    }));
    setPreviews(limited);
    return () => {
      limited.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [files]);

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
  };

  const getNextColor = () => {
    const col = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    setColorIndex(colorIndex + 1);
    return col;
  };

  const handleAddLabel = () => {
    if (!labelName.trim()) {
      alert('Label name is empty');
      return;
    }
    const nameExists = labelClasses.some(
      (lc) => lc.name.toLowerCase() === labelName.trim().toLowerCase()
    );
    if (nameExists) {
      alert('Label already exists');
      return;
    }
    const colorExists = labelClasses.some(
      (lc) => lc.color.toLowerCase() === labelColor.trim().toLowerCase()
    );
    if (colorExists) {
      alert('Label color already used. Please choose a different color.');
      return;
    }
    const newLabel = { name: labelName.trim(), color: labelColor };
    setLabelClasses([...labelClasses, newLabel]);
    setLabelName('');
    setLabelColor(getNextColor());
  };

  const handleRemoveLabel = (i) => {
    setLabelClasses(labelClasses.filter((_, idx) => idx !== i));
  };

  const handleUpload = async () => {
    if (!taskName.trim()) {
      alert('Enter a task name');
      return;
    }
    if (!files.length) {
      alert('Select images first');
      return;
    }
    if (!labelClasses.length) {
      alert('Add at least one label class');
      return;
    }

    const formData = new FormData();
    formData.append('taskName', taskName);
    formData.append('labelClasses', JSON.stringify(labelClasses));
    files.forEach(f => formData.append('files', f));

    try {
      const res = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      setFolderData(data);
      alert('Upload success!');
    } catch (err) {
      console.error(err);
      alert('Upload error');
    }
  };

  const goAnnotate = () => {
    if (!folderData) return;
    if (segmentationMode) {
      navigate('/segmentation', { state: { folderInfo: folderData } });
    } else {
      navigate('/annotate', { state: { folderInfo: folderData } });
    }
  };

  return (
    <div className="image-home-container">
      <h2>Create a New Image Annotation Task</h2>

      <div className="form-area">
        <label>Task Name</label>
        <input
          type="text"
          value={taskName}
          onChange={(e) => setTaskName(e.target.value)}
          placeholder="e.g. My Dataset"
        />
      </div>

      <div className="labels-section">
        <h3>Label Classes</h3>
        <div className="label-form">
          <input
            type="text"
            placeholder="e.g. Car"
            value={labelName}
            onChange={(e) => setLabelName(e.target.value)}
          />
          <input
            type="color"
            value={labelColor}
            onChange={(e) => setLabelColor(e.target.value)}
          />
          <button onClick={handleAddLabel}>Add</button>
        </div>
        <ul className="label-list">
          {labelClasses.map((lc, i) => (
            <li key={i}>
              <span className="color-box" style={{ background: lc.color }} />
              {lc.name}
              <button onClick={() => handleRemoveLabel(i)}>X</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="form-area">
        <label>Select Images</label>
        <input
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileChange}
        />
      </div>

      {previews.length > 0 && (
        <div className="preview-grid">
          {previews.map((p, i) => (
            <div key={i} className="preview-item">
              <img src={p.url} alt={p.name} />
              <p>{p.name}</p>
            </div>
          ))}
        </div>
      )}

      <div className="buttons-row">
        <button onClick={handleUpload}>Upload</button>
        <button onClick={goAnnotate} disabled={!folderData}>
          {segmentationMode ? 'Go to Segmentation' : 'Go to Annotate'}
        </button>
      </div>
    </div>
  );
}
