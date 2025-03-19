// src/pages/ImageHome.js
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import UserHomeTopBar from '../components/UserHomeTopBar';
import './ProjectImageHome.css';

const COLOR_PALETTE = [
  '#e6194B', '#3cb44b', '#ffe119', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45', '#fabed4',
  '#469990', '#dcbeff', '#9A6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#a9a9a9'
];

export default function ProjectImageHome() {
  const navigate = useNavigate();
  const location = useLocation();

  // Mode detections
  const segmentationMode = location.state?.segmentationMode || false;
  const classificationMode = location.state?.classificationMode || false;
  const threeDMode = location.state?.threeDMode || false;
  const projectMode = location.state?.projectMode || false;

  // States for task mode
  const [taskName, setTaskName] = useState('');
  // States for project mode
  const [projectName, setProjectName] = useState('');
  // New state for project category (first-level selection)
  const [projectCategory, setProjectCategory] = useState('Image Annotation');
  // The projectType state now holds one of the allowed suboptions; default is set for Image Annotation.
  const [projectType, setProjectType] = useState('image detection');

  const [labelName, setLabelName] = useState('');
  const [labelColor, setLabelColor] = useState(COLOR_PALETTE[0]);
  const [colorIndex, setColorIndex] = useState(1);
  const [labelClasses, setLabelClasses] = useState([]);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [folderData, setFolderData] = useState(null);

  // Compute allowed file accept attribute based on project category when in project mode.
  const allowedAccept = projectMode
    ? projectCategory === 'Image Annotation'
      ? 'image/*'
      : projectCategory === 'Video Annotation'
        ? 'video/*'
        : projectCategory === 'Text Annotation'
          ? '.txt,.doc,.docx,.pdf'
          : ''
    : threeDMode
      ? ''
      : 'image/*';

  // Compute hint text to display under file/folder selection.
  const allowedFileTypesHint = projectMode
    ? projectCategory === 'Image Annotation'
      ? 'Allowed file types: Images (e.g. .jpg, .jpeg, .png, .gif, .bmp, .webp)'
      : projectCategory === 'Video Annotation'
        ? 'Allowed file types: Videos (e.g. .mp4, .avi, .mov, .mkv, .webm)'
        : projectCategory === 'Text Annotation'
          ? 'Allowed file types: Text/Documents (e.g. .txt, .doc, .docx, .pdf)'
          : ''
    : '';

  useEffect(() => {
    const userSession = localStorage.getItem('user');
    if (!userSession) {
      localStorage.setItem(
        'redirectAfterLogin',
        JSON.stringify({
          path: '/images',
          state: location.state
        })
      );
      navigate('/signin');
      return;
    }
    const limited = files.slice(0, 5).map(f => ({
      url: URL.createObjectURL(f),
      name: f.name
    }));
    setPreviews(limited);
    return () => {
      limited.forEach(p => URL.revokeObjectURL(p.url));
    };
  }, [files, navigate, location.state]);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (projectMode) {
      let allowedExtensions = [];
      if (projectCategory === 'Image Annotation') {
        allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      } else if (projectCategory === 'Video Annotation') {
        allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
      } else if (projectCategory === 'Text Annotation') {
        allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
      }
      const validFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
      });
      if (validFiles.length !== selectedFiles.length) {
        alert(
          `Only ${projectCategory === 'Image Annotation'
            ? 'image'
            : projectCategory === 'Video Annotation'
              ? 'video'
              : 'text/document'} files are allowed in ${projectCategory.toLowerCase()} mode (${allowedExtensions.join(
                ', '
              )})`
        );
        if (validFiles.length === 0) return;
      }
      setFiles(validFiles);
    } else if (threeDMode) {
      const allowed3DFormats = ['.obj', '.glb', '.gltf', '.ply', '.stl', '.3ds', '.fbx'];
      const valid3DFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowed3DFormats.includes(extension);
      });
      if (valid3DFiles.length !== selectedFiles.length) {
        alert(
          'Only 3D model files are allowed in 3D annotation mode (.obj, .glb, .gltf, .ply, .stl, .3ds, .fbx)'
        );
        if (valid3DFiles.length === 0) return;
      }
      setFiles(valid3DFiles);
    } else {
      setFiles(selectedFiles);
    }
  };

  const handleFolderUpload = async (e) => {
    let selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    if (projectMode) {
      let allowedExtensions = [];
      if (projectCategory === 'Image Annotation') {
        allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
      } else if (projectCategory === 'Video Annotation') {
        allowedExtensions = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];
      } else if (projectCategory === 'Text Annotation') {
        allowedExtensions = ['.txt', '.doc', '.docx', '.pdf'];
      }
      const validFiles = selectedFiles.filter(file => {
        const extension = '.' + file.name.split('.').pop().toLowerCase();
        return allowedExtensions.includes(extension);
      });
      if (validFiles.length !== selectedFiles.length) {
        alert(
          `Only ${projectCategory === 'Image Annotation'
            ? 'image'
            : projectCategory === 'Video Annotation'
              ? 'video'
              : 'text/document'} files are allowed in ${projectCategory.toLowerCase()} mode (${allowedExtensions.join(
                ', '
              )})`
        );
        if (validFiles.length === 0) return;
      }
      selectedFiles = validFiles;
    }

    // For preview, only show a few files from the root level
    const rootFolderName = selectedFiles[0].webkitRelativePath.split('/')[0];
    const rootLevelFiles = selectedFiles.filter(file => {
      const pathParts = file.webkitRelativePath.split('/');
      return pathParts.length === 2; // Only files directly in the root folder
    });

    const limited = rootLevelFiles.slice(0, 5).map(f => ({
      url: URL.createObjectURL(f),
      name: f.webkitRelativePath
    }));
    setPreviews(limited);
    setFiles(selectedFiles);
  };

  const getNextColor = () => {
    const col = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
    setColorIndex(colorIndex + 1);
    return col;
  };

  const handleAddLabel = async () => {
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
    const updatedLabels = [...labelClasses, newLabel];
    if (folderData?.taskId) {
      try {
        const updateLabelsRes = await fetch(`http://localhost:4000/api/tasks/${folderData.taskId}/labels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelClasses: updatedLabels })
        });
        if (!updateLabelsRes.ok) {
          throw new Error('Failed to update labels in task');
        }
        const annotationsRes = await fetch('http://localhost:4000/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folderData.folderId,
            taskName: taskName,
            labelClasses: updatedLabels,
            annotations: {}
          })
        });
        if (!annotationsRes.ok) {
          throw new Error('Failed to update annotations');
        }
      } catch (error) {
        console.error('Error updating labels:', error);
        alert('Failed to update labels: ' + error.message);
        return;
      }
    }
    setLabelClasses(updatedLabels);
    setLabelName('');
    setLabelColor(getNextColor());
  };

  const handleRemoveLabel = async (i) => {
    const updatedLabels = labelClasses.filter((_, idx) => idx !== i);
    if (folderData?.taskId) {
      try {
        const updateLabelsRes = await fetch(`http://localhost:4000/api/tasks/${folderData.taskId}/labels`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ labelClasses: updatedLabels })
        });
        if (!updateLabelsRes.ok) {
          throw new Error('Failed to update labels in task');
        }
        const annotationsRes = await fetch('http://localhost:4000/api/annotations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            folderId: folderData.folderId,
            taskName: taskName,
            labelClasses: updatedLabels,
            annotations: {}
          })
        });
        if (!annotationsRes.ok) {
          throw new Error('Failed to update annotations');
        }
      } catch (error) {
        console.error('Error updating labels:', error);
        alert('Failed to update labels: ' + error.message);
        return;
      }
    }
    setLabelClasses(updatedLabels);
  };

  // Function for task mode (existing)
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
    try {
      const formData = new FormData();
      formData.append('taskName', taskName);
      formData.append('labelClasses', JSON.stringify(labelClasses));
      files.forEach(f => formData.append('files', f));
      const uploadRes = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData
      });
      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }
      const uploadData = await uploadRes.json();
      const userSession = JSON.parse(localStorage.getItem('user'));
      const taskType = segmentationMode
        ? 'segmentation'
        : classificationMode
          ? 'classification'
          : threeDMode
            ? '3dannotation'
            : 'detection';
      const taskRes = await fetch('http://localhost:4000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userSession.id,
          taskName: taskName,
          folderId: uploadData.folderId,
          taskType: taskType,
          labelClasses: labelClasses
        })
      });
      if (!taskRes.ok) {
        throw new Error('Failed to create task');
      }
      const taskData = await taskRes.json();
      setFolderData({ ...uploadData, taskId: taskData.taskId });
      alert('Upload success!');
    } catch (err) {
      console.error('Error:', err);
      alert('Upload error: ' + err.message);
    }
  };

  const goAnnotate = () => {
    if (!folderData) return;
    if (segmentationMode) {
      navigate('/segmentation', { state: { folderInfo: folderData } });
    } else if (classificationMode) {
      navigate('/classification', { state: { folderInfo: folderData } });
    } else if (threeDMode) {
      navigate('/3d', { state: { folderInfo: folderData } });
    } else {
      navigate('/detection', { state: { folderInfo: folderData } });
    }
  };

  // Function for project mode
  const handleCreateProject = async () => {
    if (!projectName.trim()) {
      alert('Enter a project name');
      return;
    }
    try {
      const projectsRes = await fetch('http://localhost:4000/api/projects');
      if (projectsRes.ok) {
        const existingProjects = await projectsRes.json();
        const duplicate = existingProjects.some(
          (proj) => proj.project_name.toLowerCase() === projectName.trim().toLowerCase()
        );
        if (duplicate) {
          alert('A project with this name already exists. Please choose a different name.');
          return;
        }
      }
    } catch (err) {
      console.error('Error checking for duplicates:', err);
    }
    if (!files.length) {
      alert('Select files first');
      return;
    }
    if (!labelClasses.length) {
      alert('Add at least one label class');
      return;
    }
    try {
      const formData = new FormData();
      formData.append('projectName', projectName);
      formData.append('labelClasses', JSON.stringify(labelClasses));

      files.forEach(file => {
        if (file.webkitRelativePath) {
          formData.append('filePaths', file.webkitRelativePath);
        } else {
          formData.append('filePaths', file.name);
        }
        formData.append('files', file);
      });

      const uploadRes = await fetch('http://localhost:4000/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!uploadRes.ok) {
        throw new Error('Upload failed');
      }

      const uploadData = await uploadRes.json();
      const userSession = JSON.parse(localStorage.getItem('user'));

      const projectRes = await fetch('http://localhost:4000/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userSession.id,
          projectName: projectName,
          folderId: uploadData.folderId,
          projectType: projectType,
          labelClasses: labelClasses
        })
      });

      if (!projectRes.ok) {
        throw new Error('Failed to create project');
      }

      const projectData = await projectRes.json();
      setFolderData({ ...uploadData, projectId: projectData.projectId });
      alert('Project created successfully!');
      navigate('/projects');
    } catch (err) {
      console.error('Error:', err);
      alert('Project creation error: ' + err.message);
    }
  };

  return (
    <div className="parent-container">
      <UserHomeTopBar />
      <div className="image-home-container">
        {projectMode ? (
          <>
            <h2>Create a New Project</h2>
            <div className="form-area">
              <label>Project Name</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. My New Project"
              />
            </div>
            <div className="form-area">
              <label>Project Category</label>
              <div className="radio-group">
                <label>
                  <input
                    type="radio"
                    value="Image Annotation"
                    checked={projectCategory === 'Image Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('image detection');
                    }}
                  />
                  Image Annotation
                </label>
                <label>
                  <input
                    type="radio"
                    value="Video Annotation"
                    checked={projectCategory === 'Video Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('video detection');
                    }}
                  />
                  Video Annotation
                </label>
                <label>
                  <input
                    type="radio"
                    value="Text Annotation"
                    checked={projectCategory === 'Text Annotation'}
                    onChange={(e) => {
                      setProjectCategory(e.target.value);
                      setProjectType('Span annotation');
                    }}
                  />
                  Text Annotation
                </label>
              </div>
            </div>
            {projectCategory === 'Image Annotation' && (
              <div className="form-area">
                <label>Image Annotation Options</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="image detection"
                      checked={projectType === 'image detection'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Image Detection
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="image segmentation"
                      checked={projectType === 'image segmentation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Image Segmentation
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="image classification"
                      checked={projectType === 'image classification'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Image Classification
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="3d image annotation"
                      checked={projectType === '3d image annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    3D Image Annotation
                  </label>
                </div>
              </div>
            )}
            {projectCategory === 'Video Annotation' && (
              <div className="form-area">
                <label>Video Annotation Options</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="video detection"
                      checked={projectType === 'video detection'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Video Detection
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="video segmentation"
                      checked={projectType === 'video segmentation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Video Segmentation
                  </label>
                </div>
              </div>
            )}
            {projectCategory === 'Text Annotation' && (
              <div className="form-area">
                <label>Text Annotation Options</label>
                <div className="radio-group">
                  <label>
                    <input
                      type="radio"
                      value="Span annotation"
                      checked={projectType === 'Span annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Span Annotation
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="relation annotation"
                      checked={projectType === 'relation annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Relation Annotation
                  </label>
                  <label>
                    <input
                      type="radio"
                      value="document-level annotation"
                      checked={projectType === 'document-level annotation'}
                      onChange={(e) => setProjectType(e.target.value)}
                    />
                    Document-Level Annotation
                  </label>
                </div>
              </div>
            )}
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
              <label>Select Files or Folder</label>
              <div className="upload-controls">
                <label htmlFor="proj-file-input" className="upload-files-button">
                  Upload Files
                </label>
                <span className="divider"></span>
                <label htmlFor="folder-input" className="upload-folders-button">
                  Upload Folders
                </label>
                <input
                  id="proj-file-input"
                  type="file"
                  multiple
                  accept={allowedAccept}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <input
                  id="folder-input"
                  type="file"
                  webkitdirectory="true"
                  directory="true"
                  accept={allowedAccept}
                  onChange={handleFolderUpload}
                  style={{ display: 'none' }}
                />
              </div>
              <p className="file-hint">{allowedFileTypesHint}</p>
            </div>
            {previews.length > 0 && (
              <div className="preview-grid">
                {previews.map((p, i) => (
                  <div key={i} className="preview-item">
                    <img src={p.url} alt={p.name} />
                  </div>
                ))}
              </div>
            )}
            <div className="buttons-row">
              <button onClick={handleCreateProject}>Create Project</button>
            </div>
          </>
        ) : (
          null
        )}
      </div>
    </div>
  );
}
