/**
 * Urban Builds Admin Dashboard Portal Controller
 * Manages: Admin Authentications, Server Token Sessions, landing Hero settings,
 * Project inventory additions & deletions synced directly to server databases.
 */

class UrbanBuildsAdmin {
  constructor() {
    this.projects = [];
    this.formMaterialRows = [];
    this.sessionTokenKey = "ub_admin_token";
  }

  async init() {
    // 1. Initialize Theme (syncs with client state)
    this.initTheme();

    // 2. Check if admin is already authenticated in active session
    await this.checkAuthStatus();
  }

  /* ==========================================================================
     Dashboard Authentication & Verification Shell
     ========================================================================== */

  initTheme() {
    const savedTheme = localStorage.getItem("ub_theme") || "dark";
    document.documentElement.setAttribute("data-theme", savedTheme);
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute("data-theme");
    const newTheme = currentTheme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem("ub_theme", newTheme);
    this.showToast(`Theme switched to ${newTheme.toUpperCase()}`, "info");
  }

  async handleLogin(event) {
    if (event) event.preventDefault();
    
    const usernameEl = document.getElementById("login-username");
    const passwordEl = document.getElementById("login-password");
    
    if (!usernameEl || !passwordEl) return;
    
    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();

    this.showToast("Authenticating credentials session...", "info");

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        // Store Session Token in SessionStorage
        sessionStorage.setItem(this.sessionTokenKey, data.token);
        
        // Hide authentication sheet and reveal content workspace
        this.showToast("Authentication successful! Welcome to Dashboard.", "success");
        
        await this.revealDashboardWorkspace();
      } else {
        this.showToast(data.message || "Invalid administrator credentials", "error");
      }
    } catch (e) {
      console.error("Login request error:", e);
      this.showToast("API server authentication error.", "error");
    }
  }

  async checkAuthStatus() {
    const token = sessionStorage.getItem(this.sessionTokenKey);
    
    if (token) {
      // Re-validate session by checking if we can query project inventory successfully
      await this.revealDashboardWorkspace();
    } else {
      // Retain full login overlay screen
      const authScreen = document.getElementById("admin-auth-screen");
      const dashWrapper = document.getElementById("admin-dashboard-wrapper");
      
      if (authScreen) authScreen.classList.remove("hidden");
      if (dashWrapper) dashWrapper.classList.add("hidden");
    }
  }

  async revealDashboardWorkspace() {
    const authScreen = document.getElementById("admin-auth-screen");
    const dashWrapper = document.getElementById("admin-dashboard-wrapper");
    
    if (authScreen) authScreen.classList.add("hidden");
    if (dashWrapper) dashWrapper.classList.remove("hidden");

    // Load active inventory listings, Hero settings, and Contact info from Server database
    await this.fetchInventory();
    await this.fetchHeroSettings();
    await this.fetchContactSettings();
  }

  handleLogout() {
    sessionStorage.removeItem(this.sessionTokenKey);
    this.showToast("Logged out of Administrator Portal", "info");
    
    // Clear inventory tables and input values
    const tbody = document.getElementById("admin-projects-list");
    if (tbody) tbody.innerHTML = "";

    // Show login panel again
    const authScreen = document.getElementById("admin-auth-screen");
    const dashWrapper = document.getElementById("admin-dashboard-wrapper");
    
    if (authScreen) authScreen.classList.remove("hidden");
    if (dashWrapper) dashWrapper.classList.add("hidden");

    // Reset login form fields
    const loginForm = document.getElementById("admin-login-form");
    if (loginForm) loginForm.reset();
  }

  getAuthHeaders() {
    const token = sessionStorage.getItem(this.sessionTokenKey);
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  }

  /* ==========================================================================
     Landing Page Hero Customizer API Sync
     ========================================================================== */

  async fetchHeroSettings() {
    try {
      const response = await fetch('/api/hero');
      if (response.ok) {
        const hero = await response.json();
        
        // Populates settings form
        const titleInput = document.getElementById("hero-title-input");
        const subtitleText = document.getElementById("hero-subtitle-input");
        const bgTypeSel = document.getElementById("hero-bg-type");
        const sourceInput = document.getElementById("hero-bg-source");

        if (titleInput) titleInput.value = hero.title || "";
        if (subtitleText) subtitleText.value = hero.subtitle || "";
        if (bgTypeSel) bgTypeSel.value = hero.bgType || "video";
        if (sourceInput) sourceInput.value = hero.source || "";
      }
    } catch (e) {
      console.error("Error reading hero configuration:", e);
    }
  }

  async saveHeroCustomizer(event) {
    if (event) event.preventDefault();

    const title = document.getElementById("hero-title-input").value.trim();
    const subtitle = document.getElementById("hero-subtitle-input").value.trim();
    const bgType = document.getElementById("hero-bg-type").value;
    const source = document.getElementById("hero-bg-source").value.trim();

    if (!title || !subtitle || !source) {
      this.showToast("Please fill all Landing Hero parameters.", "error");
      return;
    }

    try {
      const response = await fetch('/api/hero', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ title, subtitle, bgType, source })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast("Landing Page Highlight Showcase applied successfully!", "success");
      } else {
        this.showToast(data.message || "Failed to update highlight settings.", "error");
      }
    } catch (e) {
      console.error("Hero customizer sync error:", e);
      this.showToast("Network error trying to submit hero configurations.", "error");
    }
  }

  handleHeroBgTypeChange() {
    const bgType = document.getElementById("hero-bg-type").value;
    const sourceInput = document.getElementById("hero-bg-source");
    if (sourceInput) {
      if (bgType === "video") {
        sourceInput.placeholder = "e.g. https://assets.mixkit.co/.../video.mp4";
      } else {
        sourceInput.placeholder = "e.g. https://images.unsplash.com/.../photo.jpg";
      }
    }
  }

  /* ==========================================================================
     Contact Information API Sync
     ========================================================================== */

  async fetchContactSettings() {
    try {
      const response = await fetch('/api/contact');
      if (response.ok) {
        const contact = await response.json();
        
        // Populates settings form
        const emailInput = document.getElementById("contact-email-input");
        const addressInput = document.getElementById("contact-address-input");
        const aboutInput = document.getElementById("contact-about-input");

        if (emailInput) emailInput.value = contact.email || "";
        if (addressInput) addressInput.value = contact.address || "";
        if (aboutInput) aboutInput.value = contact.about || "";
      }
    } catch (e) {
      console.error("Error reading contact configuration:", e);
    }
  }

  async saveContactInfo(event) {
    if (event) event.preventDefault();

    const email = document.getElementById("contact-email-input").value.trim();
    const address = document.getElementById("contact-address-input").value.trim();
    const about = document.getElementById("contact-about-input").value.trim();

    if (!email || !address || !about) {
      this.showToast("Please fill all contact parameters.", "error");
      return;
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, address, about })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast("Contact details updated successfully!", "success");
      } else {
        this.showToast(data.message || "Failed to update contact settings.", "error");
      }
    } catch (e) {
      console.error("Contact details sync error:", e);
      this.showToast("Network error trying to submit contact configurations.", "error");
    }
  }

  /* ==========================================================================
     Active Inventory Table Controller
     ========================================================================== */

  async fetchInventory() {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        this.projects = await response.json();
        this.renderAdminInventory();
      } else {
        this.showToast("Failed to fetch inventory from database.", "error");
      }
    } catch (e) {
      console.error("Inventory loading error:", e);
    }
  }

  renderAdminInventory() {
    const tbody = document.getElementById("admin-projects-list");
    if (!tbody) return;
    tbody.innerHTML = ""; // Clear existing

    if (this.projects.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; padding: 40px; color:var(--text-muted);">
            <i class="fa-solid fa-list-check" style="font-size: 28px; margin-bottom: 10px; opacity:0.5;"></i>
            <p>No projects listed in database. Add new design tours above.</p>
          </td>
        </tr>
      `;
      return;
    }

    this.projects.forEach(project => {
      const tr = document.createElement("tr");
      
      const details = project.details || {};
      const shortLocation = project.location ? project.location.split(",")[0] : "";

      tr.innerHTML = `
        <td>
          <img src="${project.heroImage}" alt="${project.title}" class="admin-thumbnail-preview">
        </td>
        <td>
          <div class="admin-project-title-meta">
            <strong style="display: flex; align-items: center; gap: 8px;">
              ${project.title}
              <span class="badge" style="background: rgba(255, 149, 0, 0.15); color: var(--primary-color); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-family: 'Inter', sans-serif; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">${project.category || 'Design Tours'}</span>
            </strong>
            <span><i class="fa-solid fa-compass-drafting"></i> ${project.architect} &nbsp;|&nbsp; <i class="fa-solid fa-location-dot"></i> ${project.location}</span>
          </div>
        </td>
        <td>
          <div class="admin-project-title-meta">
            <strong>${project.style}</strong>
            <span>${project.area} &nbsp;|&nbsp; ${details.bhk || "BHK Config"}</span>
          </div>
        </td>
        <td>
          <span style="color: var(--primary-color); font-weight: 700;">${project.budget}</span>
        </td>
        <td>
          <div class="admin-action-btn-group">
            <button class="btn-action-edit" onclick="admin.editProject('${project.id}')" title="Modify architectural parameters">
              <i class="fa-solid fa-pen-to-square"></i>
            </button>
            <button class="btn-action-delete" onclick="admin.deleteProject('${project.id}')" title="Delete listing permanent">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  /* ==========================================================================
     CRUD Project Addition & Modification Form Controllers
     ========================================================================== */

  openNewProjectForm() {
    // Reset inputs
    document.getElementById("form-project-id").value = "";
    document.getElementById("project-entry-form").reset();
    document.getElementById("form-modal-title").innerText = "Add New Interior Design Project";
    
    // Reset category selector explicitly
    const categoryEl = document.getElementById("form-category");
    if (categoryEl) categoryEl.value = "Design Tours";
    
    // Default dynamic materials spec layout builders to aid input
    this.formMaterialRows = [];
    this.addMaterialRowToForm("Flooring", "Nexion", "Italian Marble Finish Vitrified Tiles");
    this.addMaterialRowToForm("Lighting", "Philips Hue", "Smart Architectural Dimmable LEDs");
    this.addMaterialRowToForm("Hardware", "Blum / Hettich", "Seamless Soft-close Drawer Assemblies");

    // Display Form overlay modal
    const modalEl = document.getElementById("project-form-modal");
    if (modalEl) modalEl.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  closeProjectForm() {
    const modalEl = document.getElementById("project-form-modal");
    if (modalEl) modalEl.classList.remove("active");
    document.body.style.overflow = "";
  }

  addMaterialRowToForm(category = "", brand = "", material = "") {
    this.formMaterialRows.push({ category, brand, material });
    this.renderFormMaterialRows();
  }

  removeMaterialRowFromForm(idx) {
    this.formMaterialRows.splice(idx, 1);
    this.renderFormMaterialRows();
  }

  renderFormMaterialRows() {
    const tbody = document.getElementById("form-materials-tbody");
    if (!tbody) return;
    tbody.innerHTML = ""; // Clear active rows

    this.formMaterialRows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input type="text" value="${row.category}" placeholder="e.g. Flooring" onchange="admin.updateFormMaterialCell(${idx}, 'category', this.value)" required></td>
        <td><input type="text" value="${row.brand}" placeholder="e.g. Kohler" onchange="admin.updateFormMaterialCell(${idx}, 'brand', this.value)" required></td>
        <td><input type="text" value="${row.material}" placeholder="e.g. Matte Black fittings" onchange="admin.updateFormMaterialCell(${idx}, 'material', this.value)" required></td>
        <td>
          <button type="button" class="btn-action-delete" onclick="admin.removeMaterialRowFromForm(${idx})" style="padding: 4px; height: 32px; width: 32px;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  updateFormMaterialCell(idx, field, value) {
    if (this.formMaterialRows[idx]) {
      this.formMaterialRows[idx][field] = value;
    }
  }

  async submitProjectForm(event) {
    if (event) event.preventDefault();

    const id = document.getElementById("form-project-id").value;
    const title = document.getElementById("form-title").value.trim();
    const architect = document.getElementById("form-architect").value.trim();
    const location = document.getElementById("form-location").value.trim();
    const category = document.getElementById("form-category").value;
    const style = document.getElementById("form-style").value;
    const budget = document.getElementById("form-budget").value.trim();
    const budgetRange = document.getElementById("form-budget-range").value;
    const area = document.getElementById("form-area").value.trim();
    const areaRange = document.getElementById("form-area-range").value;
    
    const bhk = document.getElementById("form-bhk").value.trim();
    const orientation = document.getElementById("form-orientation").value.trim();
    const year = document.getElementById("form-year").value.trim() || new Date().getFullYear().toString();
    const costBreakdown = document.getElementById("form-cost-breakdown").value.trim();
    const description = document.getElementById("form-desc").value.trim();
    
    const heroImage = document.getElementById("form-hero-image").value.trim();
    const videoUrl = document.getElementById("form-video-url").value.trim();
    const galleryText = document.getElementById("form-gallery").value.trim();
    const floorPlan = document.getElementById("form-floor-plan").value.trim();

    // Parse gallery URLs array
    const gallery = galleryText ? galleryText.split("\n").map(url => url.trim()).filter(url => url.length > 0) : [];

    const projectData = {
      id: id || undefined, // undefined sends server new ID request
      title,
      architect,
      location,
      category,
      style,
      budget,
      budgetRange,
      area,
      areaRange,
      heroImage,
      videoUrl,
      videoSrcType: videoUrl.includes(".mp4") ? "mock" : "embed",
      mockVideoUrl: videoUrl.includes(".mp4") ? videoUrl : "",
      gallery: gallery.length > 0 ? gallery : [heroImage],
      floorPlan: floorPlan || undefined,
      materials: [...this.formMaterialRows],
      details: { bhk, orientation, year, costBreakdown, description }
    };

    this.showToast("Transmitting listing details to server...", "info");

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(projectData)
      });

      const result = await response.json();

      if (response.ok && result.success) {
        this.showToast(result.message || "Project saved successfully on server!", "success");
        this.closeProjectForm();
        
        // Refresh active list inventory table
        await this.fetchInventory();
      } else {
        this.showToast(result.message || "Failed to save design guide details.", "error");
      }
    } catch (e) {
      console.error("Project submission error:", e);
      this.showToast("Network error trying to submit project guidance.", "error");
    }
  }

  editProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    // Prefill modal form components
    document.getElementById("form-project-id").value = project.id;
    document.getElementById("form-title").value = project.title || "";
    document.getElementById("form-architect").value = project.architect || "";
    document.getElementById("form-location").value = project.location || "";
    document.getElementById("form-category").value = project.category || "Design Tours";
    document.getElementById("form-style").value = project.style || "Modern Minimalist";
    document.getElementById("form-budget").value = project.budget || "";
    document.getElementById("form-budget-range").value = project.budgetRange || "1cr-2cr";
    document.getElementById("form-area").value = project.area || "";
    document.getElementById("form-area-range").value = project.areaRange || "1500-3000";
    
    const details = project.details || {};
    document.getElementById("form-bhk").value = details.bhk || "";
    document.getElementById("form-orientation").value = details.orientation || "";
    document.getElementById("form-year").value = details.year || "2025";
    document.getElementById("form-cost-breakdown").value = details.costBreakdown || "";
    document.getElementById("form-desc").value = details.description || "";
    
    document.getElementById("form-hero-image").value = project.heroImage || "";
    document.getElementById("form-video-url").value = project.mockVideoUrl || project.videoUrl || "";
    document.getElementById("form-gallery").value = project.gallery ? project.gallery.join("\n") : "";
    document.getElementById("form-floor-plan").value = project.floorPlan || "";

    // Set Materials builder
    this.formMaterialRows = project.materials ? [...project.materials] : [];
    this.renderFormMaterialRows();

    // Adjust title and open form
    document.getElementById("form-modal-title").innerText = `Edit Design Guide: ${project.title}`;
    
    const modalEl = document.getElementById("project-form-modal");
    if (modalEl) modalEl.classList.add("active");
    document.body.style.overflow = "hidden";
  }

  async deleteProject(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    const confirmDeletion = confirm(`Are you absolutely sure you want to PERMANENTLY remove project listing "${project.title}" from the server? This will wipe it from all connected displays.`);
    
    if (confirmDeletion) {
      this.showToast("Deleting listing from database...", "info");

      try {
        const response = await fetch(`/api/projects/${id}`, {
          method: 'DELETE',
          headers: this.getAuthHeaders()
        });

        const result = await response.json();

        if (response.ok && result.success) {
          this.showToast(result.message || "Project deleted successfully!", "success");
          await this.fetchInventory(); // Reload inventory
        } else {
          this.showToast(result.message || "Failed to delete project.", "error");
        }
      } catch (e) {
        console.error("Deletion API error:", e);
        this.showToast("Network error trying to delete listing.", "error");
      }
    }
  }

  /* ==========================================================================
     Notification Toast Helper
     ========================================================================== */

  showToast(message, type = "success") {
    const toast = document.getElementById("toast-notification");
    if (!toast) return;

    // Apply color theme classes
    toast.className = `toast-notification toast-${type} active`;
    
    let icon = "circle-check";
    if (type === "error") icon = "triangle-exclamation";
    if (type === "info") icon = "circle-info";

    toast.innerHTML = `<i class="fa-solid fa-${icon}"></i> ${message}`;

    // Dismiss toast after 3.5s automatically
    setTimeout(() => {
      toast.classList.remove("active");
    }, 3500);
  }
}

// Boot Admin Application Dashboard
const admin = new UrbanBuildsAdmin();
window.addEventListener("DOMContentLoaded", () => {
  admin.init();
});
