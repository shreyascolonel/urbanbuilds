const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// JSON body limit (base64 inflates file size ~33%; videos need more headroom)
const UPLOAD_BODY_LIMIT = process.env.UPLOAD_BODY_LIMIT || '250mb';

// Enable CORS and Body Parser
app.use(cors());
app.use(bodyParser.json({ limit: UPLOAD_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ limit: UPLOAD_BODY_LIMIT, extended: true }));

// Disable aggressive browser caching for development
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  next();
});

// Serve static assets from front-end public folder
app.use(express.static(path.join(__dirname, 'public')));

// Secure Admin Credentials Configuration (Change as preferred)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin"
};
const MOCK_TOKEN = "session_token_ub_987654";

// Utility function to read JSON data safely
const readJsonFile = (filePath, defaultData = []) => {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
      return defaultData;
    }
    const rawContent = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(rawContent);
  } catch (e) {
    console.error(`Error reading database file ${filePath}:`, e);
    return defaultData;
  }
};

// Utility function to write JSON data safely
const writeJsonFile = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Error writing database file ${filePath}:`, e);
    return false;
  }
};

// Middleware: Validate Admin Authentication Token
const requireAdminAuth = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader === `Bearer ${MOCK_TOKEN}`) {
    next();
  } else {
    res.status(401).json({ success: false, message: "Unauthorized. Valid credentials session required." });
  }
};

/* ==========================================================================
   REST API Endpoints
   ========================================================================== */

// 1. Admin Authentication Login Route
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    res.json({
      success: true,
      message: "Successfully logged in as administrator",
      token: MOCK_TOKEN
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid administrator username or password"
    });
  }
});

// 2. GET all projects
app.get('/api/projects', (req, res) => {
  const projects = readJsonFile(path.join(__dirname, 'projects.json'), []);
  res.json(projects);
});

// 3. POST add/edit project (Requires Auth)
app.post('/api/projects', requireAdminAuth, (req, res) => {
  const newProject = req.body;
  const projectsPath = path.join(__dirname, 'projects.json');
  const projects = readJsonFile(projectsPath, []);

  if (!newProject.title) {
    return res.status(400).json({ success: false, message: "Title is required." });
  }

  const existingIndex = projects.findIndex(p => p.id === newProject.id);

  if (existingIndex !== -1) {
    // EDIT MODE
    projects[existingIndex] = {
      ...projects[existingIndex],
      ...newProject
    };
    writeJsonFile(projectsPath, projects);
    res.json({ success: true, message: "Project updated successfully on server.", project: projects[existingIndex] });
  } else {
    // ADD NEW MODE
    const projectWithId = {
      ...newProject,
      id: newProject.id || `p_${Date.now()}`
    };
    projects.push(projectWithId);
    writeJsonFile(projectsPath, projects);
    res.status(201).json({ success: true, message: "Project created successfully on server.", project: projectWithId });
  }
});

// 4. DELETE project by ID (Requires Auth)
app.delete('/api/projects/:id', requireAdminAuth, (req, res) => {
  const id = req.params.id;
  const projectsPath = path.join(__dirname, 'projects.json');
  const projects = readJsonFile(projectsPath, []);

  const exists = projects.some(p => p.id === id);
  if (!exists) {
    return res.status(404).json({ success: false, message: "Project not found." });
  }

  const filteredProjects = projects.filter(p => p.id !== id);
  writeJsonFile(projectsPath, filteredProjects);
  res.json({ success: true, message: `Successfully deleted project "${id}" from server.` });
});

// 5. GET Hero settings
app.get('/api/hero', (req, res) => {
  const heroPath = path.join(__dirname, 'hero.json');
  const defaultHero = {
    title: "The Courtyard House",
    subtitle: "A stunning 4 BHK sanctuary centered around an open-to-sky courtyard in Bangalore.",
    bgType: "video",
    source: "https://assets.mixkit.co/videos/preview/mixkit-modern-apartment-interior-design-39933-large.mp4"
  };
  const hero = readJsonFile(heroPath, defaultHero);
  res.json(hero);
});

// 6. POST Hero settings (Requires Auth)
app.post('/api/hero', requireAdminAuth, (req, res) => {
  const newHero = req.body;
  const heroPath = path.join(__dirname, 'hero.json');
  
  if (!newHero.title || !newHero.subtitle || !newHero.source) {
    return res.status(400).json({ success: false, message: "Title, subtitle, and source are required." });
  }

  writeJsonFile(heroPath, newHero);
  res.json({ success: true, message: "Hero settings applied successfully on server.", hero: newHero });
});

// 7. GET Contact info settings
app.get('/api/contact', (req, res) => {
  const contactPath = path.join(__dirname, 'contact.json');
  const defaultContact = {
    email: "contact@urbanbuilds.com",
    address: "Indiranagar, Bangalore, India",
    about: "A premium architectural & interior design platform documenting state-of-the-art residential tours, floor plans, and material specifications. Handcrafted for modern home builders.",
    whatsapp: "+919876543210"
  };
  const contact = readJsonFile(contactPath, defaultContact);
  res.json(contact);
});

// 8. POST Contact info settings (Requires Auth)
app.post('/api/contact', requireAdminAuth, (req, res) => {
  const newContact = req.body;
  const contactPath = path.join(__dirname, 'contact.json');
  
  if (!newContact.email || !newContact.address || !newContact.about || !newContact.whatsapp) {
    return res.status(400).json({ success: false, message: "Email, address, about description, and WhatsApp contact are required." });
  }

  writeJsonFile(contactPath, newContact);
  res.json({ success: true, message: "Contact details updated successfully on server.", contact: newContact });
});

// 9. GET Categories list
app.get('/api/categories', (req, res) => {
  const categoriesPath = path.join(__dirname, 'categories.json');
  const defaultCategories = [
    "Design Tour",
    "Design Style",
    "Material Boards",
    "Floor Plan",
    "UB Magazine"
  ];
  const categories = readJsonFile(categoriesPath, defaultCategories);
  res.json(categories);
});

// 10. POST Categories list (Requires Auth)
app.post('/api/categories', requireAdminAuth, (req, res) => {
  const newCategories = req.body;
  const categoriesPath = path.join(__dirname, 'categories.json');
  
  if (!Array.isArray(newCategories) || newCategories.length === 0) {
    return res.status(400).json({ success: false, message: "Categories must be a non-empty array." });
  }

  writeJsonFile(categoriesPath, newCategories);
  res.json({ success: true, message: "Navbar categories updated successfully on server.", categories: newCategories });
});

// Shared upload payload parser (supports legacy field aliases)
const parseUploadPayload = (body = {}) => {
  const filename = body.filename || body.name;
  const base64Data = body.base64Data || body.base64 || body.data;
  return { filename, base64Data };
};

// 11. POST Video Upload (Requires Auth)
app.post('/api/upload-video', requireAdminAuth, (req, res) => {
  const { filename, base64Data } = parseUploadPayload(req.body);

  if (!filename || !base64Data) {
    return res.status(400).json({ success: false, message: "Filename and base64Data are required." });
  }

  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      message: "Video file uploaded and stored successfully.",
      url: `/uploads/${filename}`
    });
  } catch (e) {
    console.error("Video upload saving error:", e);
    res.status(500).json({ success: false, message: "Failed to store uploaded video on server." });
  }
});

// 12. POST PDF Upload (Requires Auth)
app.post('/api/upload-pdf', requireAdminAuth, (req, res) => {
  const { filename, base64Data } = parseUploadPayload(req.body);

  if (!filename || !base64Data) {
    return res.status(400).json({ success: false, message: "Filename and base64Data are required." });
  }

  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      message: "PDF file uploaded and stored successfully.",
      url: `/uploads/${filename}`
    });
  } catch (e) {
    console.error("PDF upload saving error:", e);
    res.status(500).json({ success: false, message: "Failed to store uploaded PDF on server." });
  }
});

// 13. POST Photo Upload (Requires Auth)
app.post('/api/upload-photo', requireAdminAuth, (req, res) => {
  const { filename, base64Data } = parseUploadPayload(req.body);

  if (!filename || !base64Data) {
    return res.status(400).json({ success: false, message: "Filename and base64Data are required." });
  }

  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const filePath = path.join(uploadsDir, filename);
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(filePath, buffer);

    res.json({
      success: true,
      message: "Photo uploaded and stored successfully.",
      url: `/uploads/${filename}`
    });
  } catch (e) {
    console.error("Photo upload saving error:", e);
    res.status(500).json({ success: false, message: "Failed to store uploaded photo on server." });
  }
});

// API 404 Handler - fallback for unmatched API requests
app.use('/api', (req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// Custom Error Handling Middleware for standard JSON errors (e.g. body-parser limit exceeded)
app.use((err, req, res, next) => {
  console.error("Express Server Error:", err);

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      success: false,
      message: `Upload is too large. Maximum request size is ${UPLOAD_BODY_LIMIT}. Use a smaller or compressed video file.`
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: err.message || "An unexpected server error occurred."
  });
});

// For any other route, redirect to main landing page
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`Urban Builds Premium Platform Server Running Live!`);
  console.log(`Serving front-end from /public`);
  console.log(`Backend REST APIs accessible at /api`);
  console.log(`Local Access URL: http://localhost:${PORT}`);
  console.log(`=================================================`);
});
