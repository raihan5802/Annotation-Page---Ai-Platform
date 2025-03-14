const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json());

// Serve /uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const projectsFilePath = path.join(__dirname, 'projects.csv');
if (!fs.existsSync(projectsFilePath)) {
  fs.writeFileSync(projectsFilePath, 'project_id,user_id,project_name,project_type,label_classes,folder_path,created_at\n');
}

// Initialize tasks.csv if it doesn't exist
const tasksFilePath = path.join(__dirname, 'tasks.csv');
// Modify the tasks.csv header in server.js
if (!fs.existsSync(tasksFilePath)) {
  fs.writeFileSync(tasksFilePath, 'task_id,user_id,task_name,folder_path,task_type,label_classes,created_at\n');
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folderId = req.params.folderId || req.body.folderId;
    if (!folderId) {
      folderId = uuidv4();
      req.body.folderId = folderId;
    }
    const uploadPath = path.join(__dirname, 'uploads', folderId);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage });

// File upload endpoint
app.post('/api/upload', upload.array('files'), (req, res) => {
  const folderId = req.body.folderId;
  const taskName = req.body.taskName || '';
  let labelClasses = [];
  try {
    labelClasses = JSON.parse(req.body.labelClasses);
  } catch (e) {
    labelClasses = [];
  }
  const uploadedFiles = req.files.map((f) => ({
    originalname: f.originalname,
    url: `http://localhost:${PORT}/uploads/${folderId}/${f.originalname}`
  }));
  res.json({
    folderId,
    taskName,
    labelClasses,
    files: uploadedFiles,
    message: 'Upload success'
  });
});

// New endpoint to create a project
app.post('/api/projects', (req, res) => {
  try {
    const { userId, projectName, folderId, projectType, labelClasses } = req.body;
    const projectId = uuidv4();
    const folderPath = path.join('uploads', folderId);
    const createdAt = new Date().toISOString();

    const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');
    const projectLine = `${projectId},${userId},${projectName},${projectType},${escapedLabelClasses},${folderPath},${createdAt}\n`;

    fs.appendFileSync(projectsFilePath, projectLine);

    res.json({
      projectId,
      message: 'Project created successfully'
    });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

app.get('/api/projects', (req, res) => {
  try {
    if (!fs.existsSync(projectsFilePath)) {
      return res.json([]);
    }
    const projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    const lines = projectsContent.trim().split('\n').slice(1);
    const projects = lines.map(line => {
      const [project_id, user_id, project_name, project_type, label_classes, folder_path, created_at] = line.split(',');
      return {
        project_id,
        user_id,
        project_name,
        project_type,
        label_classes: JSON.parse(label_classes.replace(/\|/g, ',')),
        folder_path,
        created_at
      };
    });
    // Optionally, add the first image from the project folder:
    projects.forEach(proj => {
      const folderPath = path.join(__dirname, proj.folder_path);
      if (fs.existsSync(folderPath)) {
        const files = fs.readdirSync(folderPath).filter(file => !file.endsWith('annotations.json'));
        if (files.length > 0) {
          proj.firstImage = files[0];
        }
      }
    });
    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Create new task
// Update the task creation endpoint
app.post('/api/tasks', (req, res) => {
  try {
    const { userId, taskName, folderId, taskType, labelClasses } = req.body;
    const taskId = uuidv4();
    const folderPath = path.join('uploads', folderId);
    const createdAt = new Date().toISOString();

    // Stringify and escape the label classes to store in CSV
    const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');

    const taskLine = `${taskId},${userId},${taskName},${folderPath},${taskType},${escapedLabelClasses},${createdAt}\n`;

    fs.appendFileSync(tasksFilePath, taskLine);

    res.json({
      taskId,
      message: 'Task created successfully'
    });
  } catch (error) {
    console.error('Error creating task:', error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get user's tasks
app.get('/api/tasks/:userId', (req, res) => {
  try {
    const { userId } = req.params;

    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const tasks = tasksContent
      .trim()
      .split('\n')
      .slice(1) // Skip header row
      .map(line => {
        const [task_id, user_id, task_name, folder_path, task_type, label_classes, created_at] = line.split(',');
        return { task_id, user_id, task_name, folder_path, task_type, label_classes: JSON.parse(label_classes.replace(/\|/g, ',')), created_at };
      })
      .filter(task => task.user_id === userId);

    // For each task, check if annotations exist
    const tasksWithStatus = tasks.map(task => {
      const annotationsPath = path.join(__dirname, task.folder_path, 'annotations.json');
      const hasAnnotations = fs.existsSync(annotationsPath);
      if (hasAnnotations) {
        const annotations = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
        return { ...task, annotations, status: 'in_progress' };
      }
      return { ...task, annotations: {}, status: 'new' };
    });

    res.json(tasksWithStatus);
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Add this new endpoint in server.js
// Fix the endpoint in server.js
app.get('/api/tasks/:taskId/files', (req, res) => {
  try {
    const { taskId } = req.params;

    // Read tasks.csv to get the folder path and label classes
    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const tasks = tasksContent
      .trim()
      .split('\n')
      .slice(1)
      .map(line => {
        const parts = line.split(',');
        // Handle case where there might not be a label_classes field
        const task_id = parts[0];
        const folder_path = parts[3];
        let label_classes = [];

        // Check if there's a label_classes field (position 5)
        if (parts.length > 5 && parts[5]) {
          try {
            label_classes = JSON.parse(parts[5].replace(/\|/g, ','));
          } catch (e) {
            console.error('Error parsing label classes:', e);
            label_classes = [];
          }
        }

        return { task_id, folder_path, label_classes };
      });

    const task = tasks.find(t => t.task_id === taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    // Get all image files
    const folderPath = path.join(__dirname, task.folder_path);
    const files = fs.readdirSync(folderPath)
      .filter(file => !file.endsWith('annotations.json'))
      .map(filename => ({
        originalname: filename,
        url: `http://localhost:${PORT}/${task.folder_path}/${filename}`
      }));

    // Get annotations if they exist
    let annotations = {};
    let taskLabelClasses = task.label_classes || [];
    const annotationsPath = path.join(folderPath, 'annotations.json');
    if (fs.existsSync(annotationsPath)) {
      const annotationsContent = fs.readFileSync(annotationsPath, 'utf8');
      const parsedAnnotations = JSON.parse(annotationsContent);
      annotations = parsedAnnotations.annotations || {};

      // If the annotations file has label classes, use those (they may be more up-to-date)
      if (parsedAnnotations.labelClasses && parsedAnnotations.labelClasses.length > 0) {
        taskLabelClasses = parsedAnnotations.labelClasses;
      }
    }

    res.json({
      files,
      annotations,
      labelClasses: taskLabelClasses
    });
  } catch (error) {
    console.error('Error getting task files:', error);
    res.status(500).json({ error: 'Failed to get task files' });
  }
});

// Add this endpoint to server.js
app.put('/api/tasks/:taskId/labels', (req, res) => {
  try {
    const { taskId } = req.params;
    const { labelClasses } = req.body;

    // Read the current CSV content
    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const lines = tasksContent.trim().split('\n');

    // Find and update the specific task line
    const updatedLines = lines.map(line => {
      const [currentTaskId, ...otherFields] = line.split(',');
      if (currentTaskId === taskId) {
        // Preserve all fields except label_classes which is the 6th field (index 5)
        const fields = [currentTaskId, ...otherFields];
        const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');
        fields[5] = escapedLabelClasses;
        return fields.join(',');
      }
      return line;
    });

    // Write back to the CSV file
    fs.writeFileSync(tasksFilePath, updatedLines.join('\n') + '\n');

    res.json({ message: 'Labels updated successfully' });
  } catch (error) {
    console.error('Error updating labels:', error);
    res.status(500).json({ error: 'Failed to update labels' });
  }
});

// Save annotations
app.post('/api/annotations', (req, res) => {
  try {
    const { folderId, taskName, labelClasses, annotations } = req.body;
    const folderPath = path.join(__dirname, 'uploads', folderId);
    const annotationsPath = path.join(folderPath, 'annotations.json');

    fs.writeFileSync(annotationsPath, JSON.stringify({
      taskName,
      labelClasses,
      annotations,
      lastUpdated: new Date().toISOString()
    }, null, 2));

    console.log('Annotations saved to', annotationsPath);
    res.json({ message: 'Annotations saved' });
  } catch (error) {
    console.error('Error saving annotations:', error);
    res.status(500).json({ error: 'Failed to save annotations' });
  }
});

// User authentication endpoints
app.post('/api/signup', (req, res) => {
  const { username, email, password } = req.body;
  const user = { id: Date.now().toString(), username, email, password };
  const csvLine = `${user.id},${user.username},${user.email},${user.password}\n`;

  const filePath = path.join(__dirname, 'users.csv');

  fs.appendFile(filePath, csvLine, (err) => {
    if (err) {
      console.error('Error writing to file', err);
      res.status(500).json({ error: 'Error signing up user' });
    } else {
      console.log('User added to CSV file');
      res.json({ message: 'User signed up successfully' });
    }
  });
});

app.post('/api/signin', (req, res) => {
  const { email, password } = req.body;

  const filePath = path.join(__dirname, 'users.csv');
  const fileContent = fs.readFileSync(filePath, 'utf8');
  const users = fileContent
    .trim()
    .split('\n')
    .map((line) => {
      const [id, username, userEmail, userPassword] = line.split(',');
      return { id, username, email: userEmail, password: userPassword };
    });

  const user = users.find(
    (u) => u.email === email && u.password === password
  );

  if (user) {
    res.json({ user });
  } else {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// Add these endpoints to server.js

// Delete image endpoint
app.delete('/api/images/:folderId/:filename', (req, res) => {
  try {
    const { folderId, filename } = req.params;
    const imagePath = path.join(__dirname, 'uploads', folderId, filename);

    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete the file
    fs.unlinkSync(imagePath);

    // Remove annotations for this image if they exist
    const annotationsPath = path.join(__dirname, 'uploads', folderId, 'annotations.json');
    if (fs.existsSync(annotationsPath)) {
      const annotations = JSON.parse(fs.readFileSync(annotationsPath));
      const imageUrl = `http://localhost:${PORT}/uploads/${folderId}/${filename}`;
      if (annotations[imageUrl]) {
        delete annotations[imageUrl];
        fs.writeFileSync(annotationsPath, JSON.stringify(annotations, null, 2));
      }
    }

    res.json({ message: 'Image deleted successfully' });
  } catch (error) {
    console.error('Error deleting image:', error);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

// Add images to existing folder endpoint
const addImagesUpload = multer({ storage }).array('files');
app.post('/api/images/:folderId', (req, res) => {
  addImagesUpload(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to upload files' });
    }

    const folderId = req.params.folderId;
    const uploadedFiles = req.files.map((f) => ({
      originalname: f.originalname,
      url: `http://localhost:4000/uploads/${folderId}/` + f.originalname
    }));

    res.json({
      files: uploadedFiles,
      message: 'Upload success'
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});