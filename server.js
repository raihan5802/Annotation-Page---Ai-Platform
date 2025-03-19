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
// Create tasks.csv with the new header if it doesn't exist
if (!fs.existsSync(tasksFilePath)) {
  fs.writeFileSync(tasksFilePath, 'task_id,user_id,project_id,task_name,project_name,annotation_type,selected_files,created_at\n');
}

const jobsFilePath = path.join(__dirname, 'jobs.csv');
if (!fs.existsSync(jobsFilePath)) {
  fs.writeFileSync(jobsFilePath, 'job_id,user_id,task_id,project_id,progress,created_at\n');
}


// Multer storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folderId = req.params.folderId || req.body.folderId;
    if (!folderId) {
      folderId = uuidv4();
      req.body.folderId = folderId;
    }

    // Get the relative path from webkitRelativePath (excluding the file name)
    let relativePath = '';
    if (file.webkitRelativePath) {
      const pathParts = file.webkitRelativePath.split('/');
      // Remove the root folder name and the file name
      pathParts.shift(); // Remove root folder (test1)
      pathParts.pop();   // Remove file name
      relativePath = pathParts.join('/');
    }

    // Create full upload path including subdirectories
    const uploadPath = path.join(__dirname, 'uploads', folderId, relativePath);
    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    // Extract just the filename without the path
    const filename = file.originalname;
    cb(null, filename);
  }
});

const multerMiddleware = multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      let folderId = req.params.folderId || req.body.folderId;
      if (!folderId) {
        folderId = uuidv4();
        req.body.folderId = folderId;
      }

      // Check if this is a file from folder upload
      const isFromFolderUpload = file.webkitRelativePath ||
        (req.body.filePaths &&
          Array.isArray(req.body.filePaths) &&
          req.body.filePaths.some(p => p.includes('/')));

      // For regular file uploads (not from folder structure)
      if (!isFromFolderUpload) {
        const uploadPath = path.join(__dirname, 'uploads', folderId, 'roots');
        fs.mkdirSync(uploadPath, { recursive: true });
        cb(null, uploadPath);
        return;
      }

      // For folder uploads
      let relativePath = '';

      // Find the relative path for this file
      if (file.webkitRelativePath) {
        // Use webkitRelativePath if available
        const pathParts = file.webkitRelativePath.split('/');

        // If file is directly in the root folder (only 2 parts: folderName/fileName)
        if (pathParts.length === 2) {
          relativePath = 'roots';
        } else {
          // Remove the root folder name and the file name
          pathParts.shift(); // Remove root folder name
          pathParts.pop();   // Remove file name
          relativePath = pathParts.join('/');
        }
      } else if (req.body.filePaths && Array.isArray(req.body.filePaths)) {
        // Try to find the path from filePaths array
        const filePath = req.body.filePaths.find(p => p.includes(file.originalname));
        if (filePath) {
          const pathParts = filePath.split('/');

          // If file is directly in the root folder (only 2 parts: folderName/fileName)
          if (pathParts.length === 2) {
            relativePath = 'roots';
          } else {
            // Remove the root folder name and the file name
            pathParts.shift(); // Remove root folder name
            pathParts.pop();   // Remove file name
            relativePath = pathParts.join('/');
          }
        } else {
          // Default to roots if no path information is found
          relativePath = 'roots';
        }
      } else {
        // Default to roots if no path information is available
        relativePath = 'roots';
      }

      // Create full upload path
      const uploadPath = path.join(__dirname, 'uploads', folderId, relativePath);
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  })
});

const upload = multer({ storage });

// File upload endpoint
app.post('/api/upload', multerMiddleware.array('files'), (req, res) => {
  const folderId = req.body.folderId;
  const taskName = req.body.taskName || '';
  let labelClasses = [];
  try {
    labelClasses = JSON.parse(req.body.labelClasses);
  } catch (e) {
    labelClasses = [];
  }

  // Process files and preserve folder structure
  const uploadedFiles = req.files.map((f) => {
    // Extract relative path from the file
    let relativePath = '';
    if (f.originalname.includes('/')) {
      // Extract path from file name if multer doesn't preserve it
      relativePath = f.originalname.substring(0, f.originalname.lastIndexOf('/'));
      f.originalname = f.originalname.substring(f.originalname.lastIndexOf('/') + 1);
    } else if (f.webkitRelativePath) {
      // If webkitRelativePath is available (might need middleware to preserve)
      relativePath = f.webkitRelativePath.split('/').slice(0, -1).join('/');
    }

    return {
      originalname: f.originalname,
      relativePath: relativePath,
      url: `http://localhost:${PORT}/uploads/${folderId}/${relativePath ? relativePath + '/' : ''}${f.originalname}`
    };
  });

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

    // Find thumbnail image for each project
    projects.forEach(proj => {
      const projectDir = path.join(__dirname, proj.folder_path);

      // Function to find the first image in a directory (recursive)
      const findFirstImage = (dir) => {
        if (!fs.existsSync(dir)) return null;

        const items = fs.readdirSync(dir);

        // First check for image files directly in this directory
        const imageFile = items.find(item => {
          const fullPath = path.join(dir, item);
          const isFile = fs.statSync(fullPath).isFile();
          const ext = path.extname(item).toLowerCase();
          return isFile && ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].includes(ext);
        });

        if (imageFile) {
          return path.relative(projectDir, path.join(dir, imageFile))
            .replace(/\\/g, '/'); // Normalize path separators
        }

        // If no image found, recursively search subdirectories
        for (const item of items) {
          const fullPath = path.join(dir, item);
          if (fs.statSync(fullPath).isDirectory()) {
            const found = findFirstImage(fullPath);
            if (found) return found;
          }
        }

        return null;
      };

      const relativePath = findFirstImage(projectDir);
      if (relativePath) {
        proj.thumbnailImage = `http://localhost:${PORT}/${proj.folder_path}/${relativePath}`;
      }
    });

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Endpoint to get folder structure recursively for a given folderId
app.get('/api/folder-structure/:folderId(*)', (req, res) => {
  const folderId = decodeURIComponent(req.params.folderId);
  const basePath = path.join(__dirname, 'uploads', folderId);

  function readDirRecursive(dir) {
    const items = fs.readdirSync(dir);
    return items.map(item => {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        return {
          name: item,
          type: 'folder',
          children: readDirRecursive(fullPath)
        };
      } else {
        return {
          name: item,
          type: 'file'
        };
      }
    });
  }

  if (!fs.existsSync(basePath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }

  const tree = {
    name: path.basename(basePath),
    type: 'folder',
    children: readDirRecursive(basePath)
  };

  res.json(tree);
});


// Update project labels endpoint
app.put('/api/projects/:projectId/labels', (req, res) => {
  try {
    const { projectId } = req.params;
    const { labelClasses } = req.body; // expecting an array of label objects: {name, color}
    // Read projects.csv
    let projectsContent = fs.readFileSync(projectsFilePath, 'utf8');
    let lines = projectsContent.trim().split('\n');
    const header = lines[0];
    const updatedLines = lines.map((line, index) => {
      if (index === 0) return line; // keep header
      let parts = line.split(',');
      if (parts[0] === projectId) {
        // update label_classes field (index 4)
        const escapedLabelClasses = JSON.stringify(labelClasses).replace(/,/g, '|');
        parts[4] = escapedLabelClasses;
        return parts.join(',');
      }
      return line;
    });
    fs.writeFileSync(projectsFilePath, updatedLines.join('\n') + '\n');
    res.json({ message: 'Project labels updated successfully' });
  } catch (error) {
    console.error('Error updating project labels:', error);
    res.status(500).json({ error: 'Failed to update project labels' });
  }
});

// In server.js, add the following endpoint:
app.post('/api/tasks', (req, res) => {
  const { userId, projectId, taskName, projectName, annotationType, selectedFolders } = req.body;

  // Validate that none of the fields are empty
  if (!userId || !projectId || !taskName || !projectName || !annotationType || !selectedFolders) {
    return res.status(400).json({ error: "All fields are required" });
  }

  // Extract only the folder paths that were checked
  const selectedFolderPaths = Object.keys(selectedFolders).filter(key => selectedFolders[key]);
  if (selectedFolderPaths.length === 0) {
    return res.status(400).json({ error: "At least one folder must be selected" });
  }

  const taskId = uuidv4();
  const createdAt = new Date().toISOString();

  // Build a CSV line with selected_folder paths joined by semicolons
  const line = `${taskId},${userId},${projectId},${taskName},${projectName},${annotationType},"${selectedFolderPaths.join(';')}",${createdAt}\n`;

  try {
    fs.appendFileSync(tasksFilePath, line);
    res.json({ taskId, message: "Task created successfully" });
  } catch (error) {
    console.error("Error writing to tasks.csv:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET tasks endpoint to list all tasks from tasks.csv
app.get('/api/tasks', (req, res) => {
  try {
    if (!fs.existsSync(tasksFilePath)) return res.json([]);
    const content = fs.readFileSync(tasksFilePath, 'utf8');
    // Split into lines and skip header
    const lines = content.trim().split('\n').slice(1);
    const tasks = lines.map(line => {
      // Split on commas not inside quotes
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
      return {
        task_id: parts[0],
        user_id: parts[1],
        project_id: parts[2],
        task_name: parts[3],
        project_name: parts[4],
        annotation_type: parts[5],
        // Remove leading/trailing quotes from selected_files field
        selected_files: parts[6].replace(/^"|"$/g, ""),
        created_at: parts[7]
      };
    });
    res.json(tasks);
  } catch (error) {
    console.error("Error reading tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// image for tasks card
app.get('/api/first-image', (req, res) => {
  const folderPath = req.query.folderPath; // e.g. "61c36569-7d69-4654-8516-22d40d4b24a6/test_imag3"
  if (!folderPath) return res.status(400).json({ error: 'folderPath required' });
  const basePath = path.join(__dirname, 'uploads', folderPath);
  if (!fs.existsSync(basePath)) {
    return res.status(404).json({ error: 'Folder not found' });
  }
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
  function findFirstImage(dir) {
    const items = fs.readdirSync(dir);
    for (let item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (imageExtensions.includes(ext)) {
          return item; // Return the file name
        }
      } else if (stat.isDirectory()) {
        const found = findFirstImage(fullPath);
        if (found) return path.join(item, found);
      }
    }
    return null;
  }
  const imageFile = findFirstImage(basePath);
  if (imageFile) {
    return res.json({ imageUrl: `uploads/${folderPath}/${imageFile}` });
  } else {
    return res.status(404).json({ error: 'No image found in folder' });
  }
});

app.post('/api/jobs', (req, res) => {
  try {
    const { userId, taskId, projectId } = req.body;
    if (!userId || !taskId || !projectId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const jobId = uuidv4();
    const progress = 0; // initial progress (0%)
    const createdAt = new Date().toISOString();
    const line = `${jobId},${userId},${taskId},${projectId},${progress},${createdAt}\n`;
    fs.appendFileSync(jobsFilePath, line);
    res.json({ jobId, message: 'Job created successfully' });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

// app.get('/api/jobs', (req, res) => {
//   try {
//     if (!fs.existsSync(jobsFilePath)) return res.json([]);
//     const content = fs.readFileSync(jobsFilePath, 'utf8');
//     const lines = content.trim().split('\n').slice(1);
//     const jobs = lines.map(line => {
//       const [job_id, user_id, task_id, project_id, progress, created_at] = line.split(',');
//       return { job_id, user_id, task_id, project_id, progress, created_at };
//     });
//     res.json(jobs);
//   } catch (error) {
//     console.error('Error fetching jobs:', error);
//     res.status(500).json({ error: 'Failed to fetch jobs' });
//   }
// });


// Save annotations

app.get('/api/jobs', (req, res) => {
  try {
    if (!fs.existsSync(jobsFilePath)) return res.json([]);
    const content = fs.readFileSync(jobsFilePath, 'utf8');
    const lines = content.trim().split('\n').slice(1);
    let jobs = lines.map(line => {
      const [job_id, user_id, task_id, project_id, progress, created_at] = line.split(',');
      return { job_id, user_id, task_id, project_id, progress, created_at };
    });

    if (fs.existsSync(tasksFilePath)) {
      const tasksContent = fs.readFileSync(tasksFilePath, 'utf8');
      const taskLines = tasksContent.trim().split('\n').slice(1);
      const tasks = taskLines.map(line => {
        const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
        return {
          task_id: parts[0],
          selected_files: parts[6].replace(/^"|"$/g, "")
        };
      });

      function countImagesInDir(dir) {
        let count = 0;
        if (!fs.existsSync(dir)) return 0;
        const items = fs.readdirSync(dir);
        items.forEach(item => {
          const fullPath = path.join(dir, item);
          const stat = fs.statSync(fullPath);
          if (stat.isDirectory()) {
            count += countImagesInDir(fullPath);
          } else {
            const ext = path.extname(item).toLowerCase();
            if (['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.txt'].includes(ext)) {
              count++;
            }
          }
        });
        return count;
      }

      function countAnnotatedInFolder(selectedFolder) {
        const parts = selectedFolder.split('/');
        const uniqueFolder = parts[0];
        const annotationsPath = path.join(__dirname, 'uploads', uniqueFolder, 'annotations.json');
        let annotated = 0;
        if (fs.existsSync(annotationsPath)) {
          try {
            const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
            if (data && data.annotations && typeof data.annotations === 'object') {
              const prefix = `http://localhost:4000/uploads/${selectedFolder}/`;
              annotated = Object.keys(data.annotations).filter(key => key.startsWith(prefix)).length;
            }
          } catch (err) { }
        }
        return annotated;
      }

      jobs = jobs.map(job => {
        const task = tasks.find(t => t.task_id === job.task_id);
        if (task && task.selected_files) {
          const folderIds = task.selected_files.split(';').filter(x => x);
          let totalImages = 0;
          let annotatedImages = 0;
          folderIds.forEach(folder => {
            const dirPath = path.join(__dirname, 'uploads', folder);
            totalImages += countImagesInDir(dirPath);
            annotatedImages += countAnnotatedInFolder(folder);
          });
          const progress = totalImages > 0 ? ((annotatedImages / totalImages) * 100).toFixed(2) : 0;
          job.progress = progress;
        }
        return job;
      });
    }
    res.json(jobs);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

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

// load annotations from annotations.json
app.get('/api/annotations/:folderId', (req, res) => {
  const folderId = req.params.folderId;
  const folderPath = path.join(__dirname, 'uploads', folderId);
  const annotationsPath = path.join(folderPath, 'annotations.json');
  if (fs.existsSync(annotationsPath)) {
    const data = JSON.parse(fs.readFileSync(annotationsPath, 'utf8'));
    res.json(data);
  } else {
    res.json({ annotations: {} });
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

// Delete image endpoint accepting subfolder paths
app.delete('/api/images/:folderId/*', (req, res) => {
  const folderId = req.params.folderId;
  const filePathInFolder = req.params[0]; // Everything after :folderId/
  const imagePath = path.join(__dirname, 'uploads', folderId, filePathInFolder);

  if (!fs.existsSync(imagePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  try {
    fs.unlinkSync(imagePath);

    // Remove image from annotations (if needed)
    const annotationsPath = path.join(__dirname, 'uploads', folderId, 'annotations.json');
    if (fs.existsSync(annotationsPath)) {
      const annotations = JSON.parse(fs.readFileSync(annotationsPath));
      const imageUrl = `http://localhost:${PORT}/uploads/${folderId}/${filePathInFolder}`;
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
  // Update storage configuration for this route
  const uploadStorage = multer.diskStorage({
    destination: function (req, file, cb) {
      const folderId = req.params.folderId;
      const uploadPath = path.join(__dirname, 'uploads', folderId, 'roots');
      fs.mkdirSync(uploadPath, { recursive: true });
      cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
      cb(null, file.originalname);
    }
  });

  const upload = multer({ storage: uploadStorage }).array('files');

  upload(req, res, (err) => {
    if (err) {
      return res.status(500).json({ error: 'Failed to upload files' });
    }

    const folderId = req.params.folderId;
    const uploadedFiles = req.files.map((f) => ({
      originalname: f.originalname,
      url: `http://localhost:4000/uploads/${folderId}/roots/${f.originalname}`
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