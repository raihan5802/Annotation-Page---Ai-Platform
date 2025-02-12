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

// Initialize tasks.csv if it doesn't exist
const tasksFilePath = path.join(__dirname, 'tasks.csv');
// Modify the tasks.csv header in server.js
if (!fs.existsSync(tasksFilePath)) {
  fs.writeFileSync(tasksFilePath, 'task_id,user_id,task_name,folder_path,task_type,created_at\n');
}

// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folderId = req.body.folderId;
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

// Create new task
// Update the task creation endpoint
app.post('/api/tasks', (req, res) => {
  try {
    const { userId, taskName, folderId, taskType } = req.body;
    const taskId = uuidv4();
    const folderPath = path.join('uploads', folderId);
    const createdAt = new Date().toISOString();

    const taskLine = `${taskId},${userId},${taskName},${folderPath},${taskType},${createdAt}\n`;

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
        const [task_id, user_id, task_name, folder_path, created_at] = line.split(',');
        return { task_id, user_id, task_name, folder_path, created_at };
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
app.get('/api/tasks/:taskId/files', (req, res) => {
  try {
    const { taskId } = req.params;

    // Read tasks.csv to get the folder path
    const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
    const tasks = tasksContent
      .trim()
      .split('\n')
      .slice(1)
      .map(line => {
        const [task_id, user_id, task_name, folder_path, task_type, created_at] = line.split(',');
        return { task_id, folder_path };
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
    const annotationsPath = path.join(folderPath, 'annotations.json');
    if (fs.existsSync(annotationsPath)) {
      const annotationsContent = fs.readFileSync(annotationsPath, 'utf8');
      annotations = JSON.parse(annotationsContent);
    }

    res.json({
      files,
      annotations: annotations.annotations || {},
      labelClasses: annotations.labelClasses || []
    });
  } catch (error) {
    console.error('Error getting task files:', error);
    res.status(500).json({ error: 'Failed to get task files' });
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

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});