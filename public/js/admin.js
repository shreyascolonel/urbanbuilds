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
    await this.fetchCategories();
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

  handleCategoryChange() {
    const categoryEl = document.getElementById("form-category");
    if (!categoryEl) return;
    const category = categoryEl.value;

    const isBookshelf = (category === "Material Boards" || category === "UB Magazine");
    const isNoVideo = (category === "Floor Plan" || category === "Design Style");
    const isFloorPlanOrDesignTour = (category === "Floor Plan" || category === "Design Tour");

    // Toggle standard fields
    const standardFields = document.querySelectorAll(".standard-only-field");
    standardFields.forEach(wrapper => {
      wrapper.style.display = isBookshelf ? "none" : "";
      
      // Toggle required attribute for inputs inside standard fields
      const inputs = wrapper.querySelectorAll("input, select, textarea");
      inputs.forEach(input => {
        if (isBookshelf) {
          if (input.hasAttribute("required") || input.required) {
            input.setAttribute("data-was-required", "true");
            input.removeAttribute("required");
            input.required = false;
          }
        } else {
          if (input.getAttribute("data-was-required") === "true") {
            input.setAttribute("required", "true");
            input.required = true;
          }
        }
      });
    });

    // Toggle architect field for Floor Plan or Design Tour
    const archWrapper = document.querySelector(".architect-field-wrapper");
    if (archWrapper) {
      archWrapper.style.display = (isBookshelf || isFloorPlanOrDesignTour) ? "none" : "";
    }

    // Toggle budget fields for Floor Plan or Design Tour
    const budgetWrapper = document.querySelector(".budget-fields-wrapper");
    if (budgetWrapper) {
      budgetWrapper.style.display = (isBookshelf || isFloorPlanOrDesignTour) ? "none" : "";
    }

    // Toggle video field
    const videoWrapper = document.querySelector(".video-field-wrapper");
    if (videoWrapper) {
      videoWrapper.style.display = (isBookshelf || isNoVideo) ? "none" : "";
    }

    // Toggle PDF field
    const pdfGroup = document.getElementById("admin-form-group-pdf");
    const pdfUrlInput = document.getElementById("form-pdf-url");
    if (pdfGroup) {
      pdfGroup.style.display = isBookshelf ? "" : "none";
    }
    if (pdfUrlInput) {
      pdfUrlInput.removeAttribute("required");
      pdfUrlInput.required = false;
    }
  }

  async handlePdfUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const statusLabel = document.getElementById("upload-pdf-status");

    if (file.type !== "application/pdf") {
      this.showToast("Please upload standard PDF documents only.", "error");
      if (statusLabel) statusLabel.innerText = "Error: Invalid file format";
      return;
    }

    if (statusLabel) statusLabel.innerText = "Reading file content...";

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        if (statusLabel) statusLabel.innerText = "Uploading to server...";

        const response = await fetch('/api/upload-pdf', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ filename: file.name, base64Data })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.showToast("PDF document uploaded successfully!", "success");
          
          const urlInput = document.getElementById("form-pdf-url");
          if (urlInput) urlInput.value = data.url;

          if (statusLabel) statusLabel.innerText = `Uploaded: ${file.name}`;
        } else {
          this.showToast(data.message || "PDF upload failed.", "error");
          if (statusLabel) statusLabel.innerText = "Upload failed";
        }
      } catch (err) {
        console.error("PDF reader save error:", err);
        this.showToast("Failed to upload document PDF.", "error");
        if (statusLabel) statusLabel.innerText = "Upload failed";
      }
    };

    reader.onerror = () => {
      this.showToast("FileReader failed to process PDF.", "error");
      if (statusLabel) statusLabel.innerText = "Read failed";
    };

    reader.readAsDataURL(file);
  }

  async handleHeroUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const statusLabel = document.getElementById("upload-hero-status");

    if (!file.type.startsWith("image/")) {
      this.showToast("Please upload image files only.", "error");
      if (statusLabel) statusLabel.innerText = "Error: Invalid file format";
      return;
    }

    if (statusLabel) statusLabel.innerText = "Reading file...";

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        if (statusLabel) statusLabel.innerText = "Uploading...";

        const response = await fetch('/api/upload-photo', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ filename: file.name, base64Data })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.showToast("Hero cover image uploaded successfully!", "success");
          
          const urlInput = document.getElementById("form-hero-image");
          if (urlInput) urlInput.value = data.url;

          if (statusLabel) statusLabel.innerText = `Uploaded: ${file.name}`;
        } else {
          this.showToast(data.message || "Cover image upload failed.", "error");
          if (statusLabel) statusLabel.innerText = "Upload failed";
        }
      } catch (err) {
        console.error("Cover image upload error:", err);
        this.showToast("Failed to upload cover image.", "error");
        if (statusLabel) statusLabel.innerText = "Upload failed";
      }
    };

    reader.onerror = () => {
      this.showToast("FileReader failed to process image.", "error");
      if (statusLabel) statusLabel.innerText = "Read failed";
    };

    reader.readAsDataURL(file);
  }

  renderGalleryPreviews() {
    const previewGrid = document.getElementById("gallery-preview-grid");
    if (!previewGrid) return;
    previewGrid.innerHTML = "";

    const galleryText = document.getElementById("form-gallery").value.trim();
    const urls = galleryText ? galleryText.split("\n").map(url => url.trim()).filter(url => url.length > 0) : [];

    urls.forEach((url, idx) => {
      const wrapper = document.createElement("div");
      wrapper.style.position = "relative";
      wrapper.style.width = "80px";
      wrapper.style.height = "80px";
      wrapper.style.borderRadius = "4px";
      wrapper.style.overflow = "hidden";
      wrapper.style.border = "1px solid rgba(255,255,255,0.1)";
      
      const img = document.createElement("img");
      img.src = url;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";

      const delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
      delBtn.style.position = "absolute";
      delBtn.style.top = "2px";
      delBtn.style.right = "2px";
      delBtn.style.background = "rgba(255, 0, 0, 0.8)";
      delBtn.style.color = "white";
      delBtn.style.border = "none";
      delBtn.style.borderRadius = "50%";
      delBtn.style.width = "18px";
      delBtn.style.height = "18px";
      delBtn.style.cursor = "pointer";
      delBtn.style.display = "flex";
      delBtn.style.alignItems = "center";
      delBtn.style.justifyContent = "center";
      delBtn.style.fontSize = "10px";
      
      delBtn.onclick = () => this.deleteGalleryImage(idx);

      wrapper.appendChild(img);
      wrapper.appendChild(delBtn);
      previewGrid.appendChild(wrapper);
    });
  }

  deleteGalleryImage(index) {
    const galleryText = document.getElementById("form-gallery").value.trim();
    const urls = galleryText ? galleryText.split("\n").map(url => url.trim()).filter(url => url.length > 0) : [];
    urls.splice(index, 1);
    document.getElementById("form-gallery").value = urls.join("\n");
    this.renderGalleryPreviews();
  }

  async handleGalleryUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const files = Array.from(input.files);
    this.showToast(`Uploading ${files.length} gallery image(s)...`, "info");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        this.showToast(`File ${file.name} is not an image. Skipping.`, "error");
        continue;
      }

      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result.split(',')[1];
            const response = await fetch('/api/upload-photo', {
              method: 'POST',
              headers: this.getAuthHeaders(),
              body: JSON.stringify({ filename: file.name, base64Data })
            });

            const data = await response.json();

            if (response.ok && data.success) {
              const galleryTextArea = document.getElementById("form-gallery");
              const currentVal = galleryTextArea.value.trim();
              const separator = currentVal ? "\n" : "";
              galleryTextArea.value = currentVal + separator + data.url;
              this.renderGalleryPreviews();
            } else {
              this.showToast(`Failed to upload ${file.name}`, "error");
            }
          } catch (err) {
            console.error(`Gallery upload error for ${file.name}:`, err);
            this.showToast(`Error uploading ${file.name}`, "error");
          }
          resolve();
        };
        reader.onerror = () => {
          this.showToast(`Failed to read file ${file.name}`, "error");
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }
    this.showToast("Gallery upload session complete.", "success");
  }

  async handleHeroBgSourceUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const statusLabel = document.getElementById("upload-hero-bg-status");

    if (statusLabel) statusLabel.innerText = "Reading file...";

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        if (statusLabel) statusLabel.innerText = "Uploading...";

        const isVideo = file.type.startsWith("video/") || file.name.endsWith(".mp4");
        const endpoint = isVideo ? '/api/upload-video' : '/api/upload-photo';

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ filename: file.name, base64Data })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.showToast("Hero background media uploaded!", "success");
          
          const urlInput = document.getElementById("hero-bg-source");
          if (urlInput) urlInput.value = data.url;

          const bgTypeSel = document.getElementById("hero-bg-type");
          if (bgTypeSel) {
            bgTypeSel.value = isVideo ? "video" : "image";
            this.handleHeroBgTypeChange();
          }

          if (statusLabel) statusLabel.innerText = `Uploaded: ${file.name}`;
        } else {
          this.showToast(data.message || "Upload failed.", "error");
          if (statusLabel) statusLabel.innerText = "Upload failed";
        }
      } catch (err) {
        console.error("Hero background upload error:", err);
        this.showToast("Failed to upload background media.", "error");
        if (statusLabel) statusLabel.innerText = "Upload failed";
      }
    };

    reader.onerror = () => {
      this.showToast("FileReader failed to process file.", "error");
      if (statusLabel) statusLabel.innerText = "Read failed";
    };

    reader.readAsDataURL(file);
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
        const whatsappInput = document.getElementById("contact-whatsapp-input");

        if (emailInput) emailInput.value = contact.email || "";
        if (addressInput) addressInput.value = contact.address || "";
        if (aboutInput) aboutInput.value = contact.about || "";
        if (whatsappInput) whatsappInput.value = contact.whatsapp || "";
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
    const whatsapp = document.getElementById("contact-whatsapp-input").value.trim();

    if (!email || !address || !about || !whatsapp) {
      this.showToast("Please fill all contact parameters.", "error");
      return;
    }

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ email, address, about, whatsapp })
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
     Navbar & Dynamic Categories API Sync
     ========================================================================== */

  async fetchCategories() {
    try {
      const response = await fetch('/api/categories');
      if (response.ok) {
        const categories = await response.json();
        
        // Populates categories dropdown in projects form
        const categorySelect = document.getElementById("form-category");
        if (categorySelect) {
          categorySelect.innerHTML = "";
          categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.innerText = cat;
            categorySelect.appendChild(opt);
          });
        }

        // Populates comma-separated reorder customizer input
        const textarea = document.getElementById("categories-editor-textarea");
        if (textarea) {
          textarea.value = categories.join(", ");
        }
      }
    } catch (e) {
      console.error("Error fetching navigation categories:", e);
    }
  }

  async saveCategories(event) {
    if (event) event.preventDefault();

    const textarea = document.getElementById("categories-editor-textarea");
    if (!textarea) return;

    const rawValue = textarea.value;
    const cleanCategories = rawValue.split(",")
      .map(cat => cat.trim())
      .filter(cat => cat.length > 0);

    if (cleanCategories.length === 0) {
      this.showToast("Please supply at least one category.", "error");
      return;
    }

    this.showToast("Saving categories order configuration...", "info");

    try {
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(cleanCategories)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.showToast("Navigation categories updated successfully!", "success");
        await this.fetchCategories(); // Refresh options
      } else {
        this.showToast(data.message || "Failed to save category order.", "error");
      }
    } catch (e) {
      console.error("Categories order sync error:", e);
      this.showToast("Network error trying to submit category order.", "error");
    }
  }

  /* ==========================================================================
     Premium Video Upload Base64 Sync
     ========================================================================== */

  async handleVideoUpload(input) {
    if (!input.files || input.files.length === 0) return;
    
    const file = input.files[0];
    const statusLabel = document.getElementById("upload-video-status");

    if (file.type !== "video/mp4") {
      this.showToast("Please upload H.264 widescreen standard MP4 format video files only.", "error");
      if (statusLabel) statusLabel.innerText = "Error: Invalid file format";
      return;
    }

    if (statusLabel) statusLabel.innerText = "Reading file content...";

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result.split(',')[1];
        if (statusLabel) statusLabel.innerText = "Uploading to server...";

        const response = await fetch('/api/upload-video', {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({ filename: file.name, base64Data })
        });

        const data = await response.json();

        if (response.ok && data.success) {
          this.showToast("Video walkthrough uploaded successfully!", "success");
          
          const urlInput = document.getElementById("form-video-url");
          if (urlInput) urlInput.value = data.url;

          if (statusLabel) statusLabel.innerText = `Uploaded: ${file.name}`;
        } else {
          this.showToast(data.message || "Video upload failed.", "error");
          if (statusLabel) statusLabel.innerText = "Upload failed";
        }
      } catch (err) {
        console.error("Video reader save error:", err);
        this.showToast("Failed to upload walkthrough video.", "error");
        if (statusLabel) statusLabel.innerText = "Upload failed";
      }
    };

    reader.onerror = () => {
      this.showToast("FileReader failed to process video.", "error");
      if (statusLabel) statusLabel.innerText = "Read failed";
    };

    reader.readAsDataURL(file);
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

      const isFloorPlanOrDesignTour = (project.category === "Floor Plan" || project.category === "Design Tour" || project.category === "Floor Plans" || project.category === "Design Tours");
      const architectMeta = isFloorPlanOrDesignTour ? "" : `<i class="fa-solid fa-compass-drafting"></i> ${project.architect} &nbsp;|&nbsp; `;
      const budgetCell = isFloorPlanOrDesignTour ? `<span style="color: var(--text-muted); font-style: italic;">N/A</span>` : `<span style="color: var(--primary-color); font-weight: 700;">${project.budget}</span>`;

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
            <span>${architectMeta}<i class="fa-solid fa-location-dot"></i> ${project.location}</span>
          </div>
        </td>
        <td>
          <div class="admin-project-title-meta">
            <strong>${project.style}</strong>
            <span>${project.area} &nbsp;|&nbsp; ${details.bhk || "BHK Config"}</span>
          </div>
        </td>
        <td>
          ${budgetCell}
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
    
    // Reset PDF inputs explicitly
    const pdfUrlInput = document.getElementById("form-pdf-url");
    const uploadStatus = document.getElementById("upload-pdf-status");
    if (pdfUrlInput) pdfUrlInput.value = "";
    if (uploadStatus) uploadStatus.innerText = "No file selected";

    // Reset cover upload status explicitly
    const uploadHeroStatus = document.getElementById("upload-hero-status");
    if (uploadHeroStatus) uploadHeroStatus.innerText = "No file selected";

    // Reset gallery text area and preview grid
    const formGallery = document.getElementById("form-gallery");
    if (formGallery) formGallery.value = "";
    this.renderGalleryPreviews();

    // Reset category selector explicitly
    const categoryEl = document.getElementById("form-category");
    if (categoryEl) categoryEl.value = categoryEl.options[0]?.value || "";
    
    // Default dynamic materials spec layout builders to aid input
    this.formMaterialRows = [];
    this.addMaterialRowToForm("Flooring", "Nexion", "Italian Marble Finish Vitrified Tiles");
    this.addMaterialRowToForm("Lighting", "Philips Hue", "Smart Architectural Dimmable LEDs");
    this.addMaterialRowToForm("Hardware", "Blum / Hettich", "Seamless Soft-close Drawer Assemblies");

    // Dynamic layout check
    this.handleCategoryChange();

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

    const isBookshelf = (category === "Material Boards" || category === "UB Magazine");
    const isNoVideo = (category === "Floor Plan" || category === "Design Style");
    const isFloorPlanOrDesignTour = (category === "Floor Plan" || category === "Design Tour");

    let finalArchitect = architect;
    let finalLocation = location;
    let finalStyle = style;
    let finalBudget = budget;
    let finalBudgetRange = budgetRange;
    let finalArea = area;
    let finalAreaRange = areaRange;
    let finalBhk = bhk;
    let finalOrientation = orientation;
    let finalYear = year;
    let finalCostBreakdown = costBreakdown;
    let finalDescription = description;
    let finalGallery = gallery;
    let finalMaterials = [...this.formMaterialRows];
    let finalFloorPlan = floorPlan;
    let finalVideoUrl = videoUrl;

    if (isBookshelf) {
      finalArchitect = "Urban Builds Curated";
      finalLocation = "Editorial";
      finalStyle = "Editorial Select";
      finalBudget = "N/A";
      finalBudgetRange = "1cr-2cr";
      finalArea = "N/A";
      finalAreaRange = "1500-3000";
      finalBhk = "";
      finalOrientation = "";
      finalYear = "";
      finalCostBreakdown = "";
      finalDescription = "Premium curated design catalog.";
      finalGallery = [heroImage];
      finalMaterials = [];
      finalFloorPlan = "";
      finalVideoUrl = "";
    } else {
      if (isNoVideo) {
        finalVideoUrl = "";
      }
      if (isFloorPlanOrDesignTour) {
        finalArchitect = "";
        finalBudget = "";
        finalBudgetRange = "";
        finalCostBreakdown = "";
      }
    }

    const pdfUrl = isBookshelf ? document.getElementById("form-pdf-url").value.trim() : "";

    const projectData = {
      id: id || undefined, // undefined sends server new ID request
      title,
      architect: finalArchitect,
      location: finalLocation,
      category,
      style: finalStyle,
      budget: finalBudget,
      budgetRange: finalBudgetRange,
      area: finalArea,
      areaRange: finalAreaRange,
      heroImage,
      videoUrl: finalVideoUrl || "",
      videoSrcType: finalVideoUrl ? (finalVideoUrl.includes(".mp4") ? "mock" : "embed") : "",
      mockVideoUrl: finalVideoUrl && finalVideoUrl.includes(".mp4") ? finalVideoUrl : "",
      gallery: finalGallery.length > 0 ? finalGallery : [heroImage],
      floorPlan: finalFloorPlan || undefined,
      materials: finalMaterials,
      details: {
        bhk: finalBhk,
        orientation: finalOrientation,
        year: finalYear,
        costBreakdown: finalCostBreakdown,
        description: finalDescription
      },
      pdfUrl: pdfUrl || undefined
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
    const categoryEl = document.getElementById("form-category");
    if (categoryEl) {
      let targetCat = project.category;
      if (targetCat === "Design Tours") targetCat = "Design Tour";
      if (targetCat === "Floor Plans") targetCat = "Floor Plan";
      if (targetCat === "UB Magazines") targetCat = "UB Magazine";
      categoryEl.value = targetCat || categoryEl.options[0]?.value || "";
    }
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
    this.renderGalleryPreviews();
    
    const uploadHeroStatus = document.getElementById("upload-hero-status");
    if (uploadHeroStatus) {
      uploadHeroStatus.innerText = project.heroImage ? "Saved cover image loaded" : "No file selected";
    }
    
    document.getElementById("form-floor-plan").value = project.floorPlan || "";

    // Set Materials builder
    this.formMaterialRows = project.materials ? [...project.materials] : [];
    this.renderFormMaterialRows();

    // Prefill PDF URL and status
    const pdfUrlInput = document.getElementById("form-pdf-url");
    const uploadStatus = document.getElementById("upload-pdf-status");
    if (pdfUrlInput) pdfUrlInput.value = project.pdfUrl || "";
    if (uploadStatus) {
      uploadStatus.innerText = project.pdfUrl ? "Saved PDF loaded" : "No file selected";
    }

    // Adjust title and open form
    document.getElementById("form-modal-title").innerText = `Edit Design Guide: ${project.title}`;
    
    // Dynamic layout check
    this.handleCategoryChange();
    
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
