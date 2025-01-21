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

// Multer storage => new folder per task
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

// /api/upload => upload images
app.post('/api/upload', upload.array('files'), (req, res) => {
  const folderId = req.body.folderId;
  const taskName = req.body.taskName || '';
  let labelClasses = [];
  try {
    labelClasses = JSON.parse(req.body.labelClasses);
  } catch(e) {
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

// /api/annotations => Save final
app.post('/api/annotations', (req, res) => {
  fs.writeFileSync('annotations.json', JSON.stringify(req.body, null, 2));
  console.log('Annotations saved to annotations.json');
  res.json({ message: 'Annotations saved' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
