/**
 * Urban Builds client-side Core Application
 * Handles: SPA Views, Interactive Dynamic Listings, Light/Dark Modes,
 * Client REST API synchronization, Multi-facet search/filtering, and detail modal.
 */

class UrbanBuildsApp {
  constructor() {
    this.projects = [];
    this.currentView = "home";
    this.activeProject = null;
    this.activeCarouselIndex = 0;
    
    // Category Navigation State
    this.activeCategory = "Design Tours";
  }

  async init() {
    // 1. Initialize Theme (persists in localStorage)
    this.initTheme();

    // 2. Load dynamic data from Backend REST APIs
    await this.loadDataFromServer();

    // 3. Render listings grid
    this.renderProjectGrid();

    this.showToast("Welcome to Urban Builds Premium Tours", "info");
  }

  /* ==========================================================================
     Theme & Initial Data Synchronization
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
    this.showToast(`Switched to ${newTheme.toUpperCase()} theme`, "info");
  }

  async loadDataFromServer() {
    try {
      // Fetch projects listing
      const projectsRes = await fetch('/api/projects');
      if (projectsRes.ok) {
        this.projects = await projectsRes.json();
      } else {
        throw new Error("Failed to load projects listing");
      }

      // Fetch Landing Hero Customizer settings
      const heroRes = await fetch('/api/hero');
      if (heroRes.ok) {
        const heroData = await heroRes.json();
        this.applyHeroSettings(heroData);
      }

      // Fetch Contact settings
      const contactRes = await fetch('/api/contact');
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        this.applyContactSettings(contactData);
      }
    } catch (e) {
      console.error("Critical error synchronization with server:", e);
      this.showToast("Server connection error. Operating in offline mock mode.", "error");
    }
  }

  applyContactSettings(contact) {
    const aboutEl = document.getElementById("footer-about-text");
    const emailEl = document.getElementById("footer-email-link");
    const addressEl = document.getElementById("footer-address-text");

    if (aboutEl) aboutEl.innerText = contact.about;
    if (emailEl) {
      emailEl.innerText = contact.email;
      emailEl.href = `mailto:${contact.email}`;
    }
    if (addressEl) addressEl.innerText = contact.address;
  }

  applyHeroSettings(hero) {
    // Apply server-persisted highlight settings to landing section
    const titleEl = document.getElementById("hero-main-title");
    const subEl = document.getElementById("hero-sub-title");
    if (titleEl) titleEl.innerText = hero.title;
    if (subEl) subEl.innerText = hero.subtitle;

    const mediaContainer = document.getElementById("hero-background-media");
    if (mediaContainer) {
      mediaContainer.innerHTML = ""; // Clear existing
      if (hero.bgType === "video") {
        mediaContainer.innerHTML = `
          <video autoplay muted loop playsinline class="hero-video" id="hero-video-element">
            <source src="${hero.source}" type="video/mp4">
          </video>
          <div class="hero-overlay"></div>
        `;
      } else {
        mediaContainer.innerHTML = `
          <img src="${hero.source}" alt="Urban Builds Cover Highlight" class="hero-image-bg">
          <div class="hero-overlay"></div>
        `;
      }
    }

    // Set landing page Watch Walkthrough CTA click action to open this highlighted project
    const ctaBtn = document.getElementById("hero-cta-btn");
    if (ctaBtn) {
      ctaBtn.onclick = () => {
        // Find matching project in our inventory to display full spec modal
        const matchingProject = this.projects.find(p => p.title.toLowerCase().trim() === hero.title.toLowerCase().trim());
        if (matchingProject) {
          this.openProjectDetail(matchingProject.id);
        } else {
          // If highlight name doesn't match an active project id, default to the first project
          if (this.projects.length > 0) {
            this.openProjectDetail(this.projects[0].id);
          } else {
            this.showToast("No active projects listed.", "info");
          }
        }
      };
    }
  }

  /* ==========================================================================
     Navigation & Routing Routing
     ========================================================================== */

  filterByCategory(categoryName, element) {
    this.activeCategory = categoryName;

    // Toggle active classes on category links
    const catNav = document.getElementById("category-navigation");
    if (catNav) {
      catNav.querySelectorAll(".nav-link").forEach(link => {
        link.classList.remove("active");
      });
    }
    if (element) {
      element.classList.add("active");
    }

    this.applyFilters();
  }

  applyFilters() {
    const filtered = this.projects.filter(project => {
      const matchesCategory = (project.category || "Design Tours") === this.activeCategory;
      return matchesCategory;
    });

    this.renderFilteredProjectCards(filtered);
  }

  /* ==========================================================================
     Listing Visual Renderer Engine
     ========================================================================== */

  renderProjectGrid() {
    this.applyFilters();
  }

  renderFilteredProjectCards(filteredList) {
    const grid = document.getElementById("project-cards-grid");
    const countText = document.getElementById("project-results-count");
    
    if (!grid) return;
    grid.innerHTML = ""; // Clear active listings

    if (countText) {
      countText.textContent = `Showing ${filteredList.length} showcases in ${this.activeCategory}`;
    }

    if (filteredList.length === 0) {
      grid.innerHTML = `
        <div class="grid-empty-state" style="grid-column: 1 / -1; text-align: center; padding: 70px 20px;">
          <i class="fa-solid fa-house-laptop" style="font-size: 52px; color: var(--text-muted); margin-bottom: 20px; opacity: 0.4;"></i>
          <h3>No Showcases Found</h3>
          <p style="color: var(--text-muted); font-size: 14px; margin-top: 8px;">No listings have been posted under ${this.activeCategory} category yet.</p>
        </div>
      `;
      return;
    }

    filteredList.forEach(project => {
      const card = document.createElement("div");
      card.className = "project-card glassmorphism";
      card.innerHTML = `
        <div class="card-media-wrapper">
          <img src="${project.heroImage}" alt="${project.title}" class="card-thumbnail" loading="lazy">
          <span class="video-tour-badge"><i class="fa-solid fa-circle-play pulsing-icon"></i> Dynamic Tour</span>
          
          <!-- Immersive card hover quick link overlay -->
          <div class="card-quick-overlay">
            <button class="btn btn-primary btn-sm" onclick="app.openProjectDetail('${project.id}')">
              <i class="fa-solid fa-circle-info"></i> View Design Guide
            </button>
          </div>
        </div>
        
        <div class="card-content">
          <div class="card-tag-row">
            <span class="card-style-tag">${project.style}</span>
            <span class="card-area-tag"><i class="fa-solid fa-ruler-combined"></i> ${project.area}</span>
          </div>
          <h3 class="card-title">${project.title}</h3>
          <p class="card-architect"><i class="fa-solid fa-compass-drafting"></i> By ${project.architect}</p>
          
          <div class="card-specs-row">
            <div class="card-spec-item">
              <span class="card-spec-lbl">Location</span>
              <span class="card-spec-val"><i class="fa-solid fa-location-dot"></i> ${project.location.split(",")[0]}</span>
            </div>
            <div class="card-spec-item">
              <span class="card-spec-lbl">Est. Budget</span>
              <span class="card-spec-val budget-val">${project.budget}</span>
            </div>
          </div>
        </div>
      `;
      grid.appendChild(card);
    });
  }

  /* ==========================================================================
     Immersive Specification Modal View Controller
     ========================================================================== */

  openProjectDetail(id, initialTab = "tab-overview") {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;
    
    this.activeProject = project;
    this.activeCarouselIndex = 0;

    // Set Text Parameters
    document.getElementById("modal-project-title").innerText = project.title;
    document.getElementById("modal-project-style").innerText = project.style;
    document.getElementById("modal-project-architect").innerText = project.architect;
    document.getElementById("modal-project-location").innerText = project.location;
    
    const details = project.details || {};
    document.getElementById("modal-project-desc").innerText = details.description || "";
    
    document.getElementById("modal-stat-bhk").innerText = details.bhk || "Multi-purpose";
    document.getElementById("modal-stat-orientation").innerText = details.orientation || "N/A";
    document.getElementById("modal-stat-area").innerText = project.area;
    document.getElementById("modal-stat-year").innerText = details.year || "2024";
    
    document.getElementById("modal-project-cost").innerText = project.budget;
    document.getElementById("modal-project-cost-breakdown").innerText = details.costBreakdown || "Interiors and structural finish included";

    // Set Media Walkthrough Player Frame
    const videoContainer = document.getElementById("project-modal-video-container");
    if (videoContainer) {
      videoContainer.innerHTML = ""; // Clear existing
      
      // Determine if mock video link is used
      if (project.videoSrcType === "mock" || project.mockVideoUrl || project.videoUrl.includes(".mp4")) {
        const videoSrc = project.mockVideoUrl || project.videoUrl;
        videoContainer.innerHTML = `
          <video controls autoplay class="modal-video-player" style="width:100%; height:100%; object-fit:cover;">
            <source src="${videoSrc}" type="video/mp4">
            Your browser does not support HTML5 video walkthrough playback.
          </video>
        `;
      } else {
        // Embed standard YouTube layout
        let embedUrl = project.videoUrl;
        if (embedUrl.includes("watch?v=")) {
          embedUrl = embedUrl.replace("watch?v=", "embed/");
        }
        videoContainer.innerHTML = `
          <iframe src="${embedUrl}?autoplay=1&mute=1" allow="autoplay; encrypted-media" allowfullscreen style="width:100%; height:100%; border:none;"></iframe>
        `;
      }
    }

    // Set slider gallery carousel
    this.renderModalGallery();

    // Set SVG blueprint canvas or fallback
    const planCanvas = document.getElementById("modal-floorplan-canvas");
    if (planCanvas) {
      if (project.floorPlan && project.floorPlan.trim()) {
        planCanvas.innerHTML = project.floorPlan;
      } else {
        planCanvas.innerHTML = this.generateFallbackFloorplanSVG(project);
      }
    }

    // Set dynamic materials specs list
    const matTableBody = document.getElementById("modal-materials-table-body");
    if (matTableBody) {
      matTableBody.innerHTML = ""; // Clear active rows
      if (project.materials && project.materials.length > 0) {
        project.materials.forEach(mat => {
          const tr = document.createElement("tr");
          tr.innerHTML = `
            <td><strong>${mat.category}</strong></td>
            <td>${mat.brand}</td>
            <td>${mat.material}</td>
          `;
          matTableBody.appendChild(tr);
        });
      } else {
        matTableBody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding: 15px;">No material specification board configured for this tour yet.</td></tr>';
      }
    }

    // Navigate to requested default tab panel (Overview)
    this.switchTabDirectly(initialTab === "floorplan" ? "tab-floorplan" : "tab-overview");

    // Display modal container
    const modalEl = document.getElementById("project-detail-modal");
    if (modalEl) modalEl.classList.add("active");
    
    document.body.style.overflow = "hidden"; // Block page scrolling behind card
  }

  closeProjectDetail() {
    const modalEl = document.getElementById("project-detail-modal");
    if (modalEl) modalEl.classList.remove("active");
    
    document.body.style.overflow = ""; // Restore scrolling

    // Shutdown video playback immediately on close
    const videoContainer = document.getElementById("project-modal-video-container");
    if (videoContainer) videoContainer.innerHTML = "";
    
    this.activeProject = null;
  }

  /* Image Slider Carousel Engine */
  renderModalGallery() {
    if (!this.activeProject || !this.activeProject.gallery || this.activeProject.gallery.length === 0) return;

    const activeImageElement = document.getElementById("active-carousel-image");
    if (activeImageElement) {
      activeImageElement.src = this.activeProject.gallery[this.activeCarouselIndex];
    }

    const dotsContainer = document.getElementById("carousel-dots-indicator");
    if (dotsContainer) {
      dotsContainer.innerHTML = ""; // Clear existing dots
      
      this.activeProject.gallery.forEach((photo, idx) => {
        const dot = document.createElement("div");
        dot.className = `carousel-thumbnail-dot ${idx === this.activeCarouselIndex ? "active" : ""}`;
        dot.innerHTML = `<img src="${photo}" alt="Interior Shot ${idx + 1}">`;
        dot.onclick = () => {
          this.activeCarouselIndex = idx;
          this.renderModalGallery();
        };
        dotsContainer.appendChild(dot);
      });
    }
  }

  slideGallery(direction) {
    if (!this.activeProject || !this.activeProject.gallery) return;
    const count = this.activeProject.gallery.length;

    this.activeCarouselIndex += direction;
    if (this.activeCarouselIndex >= count) this.activeCarouselIndex = 0;
    if (this.activeCarouselIndex < 0) this.activeCarouselIndex = count - 1;

    this.renderModalGallery();
  }

  /* Specification Modal Tab switcher */
  switchTab(event, panelId) {
    const specsColumn = event.target.closest(".modal-specs-column");
    if (!specsColumn) return;

    // Toggle button active styling states
    specsColumn.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.remove("active");
    });
    event.target.classList.add("active");

    // Toggle visibility of panels
    specsColumn.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.remove("active");
    });
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add("active");
  }

  switchTabDirectly(panelId) {
    const tabContainer = document.querySelector(".modal-specs-column");
    if (!tabContainer) return;

    tabContainer.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.remove("active");
      if (panelId === "tab-floorplan" && btn.innerText.toLowerCase().includes("floor plan")) {
        btn.classList.add("active");
      } else if (panelId === "tab-overview" && btn.innerText.toLowerCase().includes("overview")) {
        btn.classList.add("active");
      } else if (panelId === "tab-materials" && btn.innerText.toLowerCase().includes("material")) {
        btn.classList.add("active");
      }
    });

    tabContainer.querySelectorAll(".tab-panel").forEach(panel => {
      panel.classList.remove("active");
    });
    const targetPanel = document.getElementById(panelId);
    if (targetPanel) targetPanel.classList.add("active");
  }

  generateFallbackFloorplanSVG(project) {
    return `
      <svg viewBox="0 0 800 500" class="vector-floor-plan">
        <style>
          .wall { stroke: var(--text-color); stroke-width: 5; fill: none; stroke-linecap: round; }
          .thin-wall { stroke: var(--text-color); stroke-width: 2.5; fill: none; opacity: 0.7; }
          .door { stroke: var(--primary-color); stroke-width: 2.5; fill: none; }
          .room-label { fill: var(--text-color); font-family: 'Outfit', sans-serif; font-weight: 600; font-size: 14px; text-anchor: middle; }
          .room-dims { fill: var(--text-muted); font-family: 'Inter', sans-serif; font-size: 11px; text-anchor: middle; }
          .furniture { fill: rgba(255, 149, 0, 0.08); stroke: rgba(255, 149, 0, 0.4); stroke-width: 1.5; }
        </style>
        <rect x="50" y="50" width="700" height="400" rx="10" class="wall" />
        <line x1="300" y1="50" x2="300" y2="450" class="wall" />
        <line x1="300" y1="250" x2="750" y2="250" class="wall" />
        
        <rect x="80" y="150" width="40" height="120" rx="4" class="furniture" />
        <rect x="550" y="120" width="120" height="100" rx="6" class="furniture" />
        
        <text x="175" y="240" class="room-label">LIVING & COFFEE BAR</text>
        <text x="175" y="260" class="room-dims">Layout plan of ${project.title}</text>
        
        <text x="525" y="150" class="room-label">SUITE ROOM 1</text>
        <text x="525" y="170" class="room-dims">18'0" x 14'0"</text>
        
        <text x="525" y="350" class="room-label">OPEN DINING & KITCHEN</text>
        <text x="525" y="370" class="room-dims">18'0" x 16'0"</text>
      </svg>
    `;
  }

  /* ==========================================================================
     Premium Toast Notifications Engine
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

// Boot Client App
const app = new UrbanBuildsApp();
window.addEventListener("DOMContentLoaded", () => {
  app.init();
});
