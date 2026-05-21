const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and Body Parser
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Allows base64 image uploads up to 50MB
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

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

  if (!newProject.title || !newProject.architect || !newProject.location) {
    return res.status(400).json({ success: false, message: "Title, Architect, and Location are required." });
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
    about: "A premium architectural & interior design platform documenting state-of-the-art residential tours, floor plans, and material specifications. Handcrafted for modern home builders."
  };
  const contact = readJsonFile(contactPath, defaultContact);
  res.json(contact);
});

// 8. POST Contact info settings (Requires Auth)
app.post('/api/contact', requireAdminAuth, (req, res) => {
  const newContact = req.body;
  const contactPath = path.join(__dirname, 'contact.json');
  
  if (!newContact.email || !newContact.address || !newContact.about) {
    return res.status(400).json({ success: false, message: "Email, address, and about description are required." });
  }

  writeJsonFile(contactPath, newContact);
  res.json({ success: true, message: "Contact details updated successfully on server.", contact: newContact });
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
