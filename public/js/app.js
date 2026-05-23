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
    this.activeCategory = "Design Tour";

    // Native PDF Reader State
    this.pdfDoc = null;
    this.pdfCurrentPageNum = 1;
    this.pdfZoomScale = 1.0;
    this.pdfIsRendering = false;
    this.pdfPagePendingNum = null;
  }

  async init() {
    // 1. Initialize Theme (persists in localStorage)
    this.initTheme();

    // Initialize PDF.js Worker Configuration
    if (window.pdfjsLib) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
    }

    // Handle dynamic PDF resizing to fit container width
    window.addEventListener("resize", () => {
      const modal = document.getElementById("magazine-reader-modal");
      if (this.pdfDoc && modal && modal.classList.contains("active")) {
        this.queueRenderPdfPage(this.pdfCurrentPageNum);
      }
    });

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

      // Fetch dynamic categories
      const categoriesRes = await fetch('/api/categories');
      let categories = ["Design Tour", "Design Style", "Material Boards", "Floor Plan", "UB Magazine"];
      if (categoriesRes.ok) {
        categories = await categoriesRes.json();
      }
      this.categories = categories;
      this.activeCategory = categories[0] || "Design Tour";
      this.renderNavbar(categories);
    } catch (e) {
      console.error("Critical error synchronization with server:", e);
      this.showToast("Server connection error. Operating in offline mock mode.", "error");
    }
  }

  renderNavbar(categories) {
    const catNav = document.getElementById("category-navigation");
    if (!catNav) return;
    catNav.innerHTML = "";

    categories.forEach((cat, idx) => {
      const a = document.createElement("a");
      a.href = "#projects-grid-section";
      a.className = `nav-link ${cat === this.activeCategory ? "active" : ""}`;
      a.innerText = cat;
      a.onclick = (e) => {
        this.filterByCategory(cat, a);
      };
      catNav.appendChild(a);
    });
  }

  applyContactSettings(contact) {
    this.contactInfo = contact;
    const aboutEl = document.getElementById("footer-about-text");
    const emailEl = document.getElementById("footer-email-link");
    const addressEl = document.getElementById("footer-address-text");

    if (aboutEl) aboutEl.innerText = contact.about;
    if (emailEl) {
      emailEl.innerText = contact.email;
      emailEl.href = `mailto:${contact.email}`;
    }
    if (addressEl) addressEl.innerText = contact.address;

    // Bind floating global WhatsApp button
    const whatsappEl = document.getElementById("global-whatsapp-btn");
    if (whatsappEl && contact.whatsapp) {
      const formattedNum = contact.whatsapp.replace(/[^0-9]/g, "");
      whatsappEl.href = `https://wa.me/${formattedNum}`;
    }
  }

  applyHeroSettings(hero) {
    this.hero = hero;
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
      const matchesCategory = (project.category || "Design Tour") === this.activeCategory;
      return matchesCategory;
    });

    this.renderFilteredProjectCards(filtered);

    // Dynamic visibility of the Hero Highlight Showcase section
    const heroSection = document.getElementById("hero-section");
    if (heroSection) {
      const heroTitle = this.hero ? this.hero.title : "";
      const matchingProject = this.projects.find(p => p.title.toLowerCase().trim() === heroTitle.toLowerCase().trim());
      
      let shouldShowHero = false;
      if (matchingProject) {
        shouldShowHero = (matchingProject.category === this.activeCategory);
      } else {
        // Fallback: If highlight title doesn't match a project, show it only on the first/default category
        const firstCategory = this.categories && this.categories.length > 0 ? this.categories[0] : "Design Tour";
        shouldShowHero = (this.activeCategory === firstCategory);
      }

      if (shouldShowHero) {
        heroSection.style.display = "";
      } else {
        heroSection.style.display = "none";
      }
    }
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

    // Toggle bookshelf layout style dynamically based on category
    const isBookshelf = this.activeCategory === "Material Boards" || this.activeCategory === "UB Magazine";
    if (isBookshelf) {
      grid.classList.add("bookshelf-layout");
    } else {
      grid.classList.remove("bookshelf-layout");
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

    const placeholderImage = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23121214"/><path d="M150 150 L650 150 L650 450 L150 450 Z" fill="none" stroke="%2327272a" stroke-width="2"/><text x="400" y="300" fill="%23a1a1aa" font-family="Outfit" font-size="24" text-anchor="middle">URBAN BUILDS SHOWCASE</text></svg>';

    filteredList.forEach(project => {
      const heroImageSrc = project.heroImage || placeholderImage;

      if (isBookshelf) {
        // Bookshelf 3D realistic card rendering
        const card = document.createElement("div");
        card.className = "book-card";
        card.onclick = () => this.openMagazineReader(project.id);
        card.innerHTML = `
          <div class="book-cover-3d">
            <img src="${heroImageSrc}" alt="${project.title}" class="book-cover-img" loading="lazy">
            <div class="book-overlay">
              <span class="book-badge">${project.category}</span>
              <h4 class="book-title">${project.title}</h4>
              <div class="book-read-cta">
                <i class="fa-solid fa-book-open"></i> Read Issue
              </div>
            </div>
          </div>
        `;
        grid.appendChild(card);
      } else {
        // Standard high-end card rendering
        const card = document.createElement("div");
        card.className = "project-card glassmorphism";
        
        const isFloorPlanOrDesignTour = (project.category === "Floor Plan" || project.category === "Design Tour" || project.category === "Floor Plans" || project.category === "Design Tours");

        // Determine whether to display the budget element
        const hasBudget = project.budget && project.budget.trim() !== "" && project.budget !== "N/A";
        const budgetHtml = (hasBudget && !isFloorPlanOrDesignTour) ? `
          <div class="card-spec-item">
            <span class="card-spec-lbl">Est. Budget</span>
            <span class="card-spec-val budget-val">${project.budget}</span>
          </div>
        ` : '';

        // If category has no video tour (Floor Plan and Design Style), show alternate badge or none
        const showVideoBadge = (project.category !== "Floor Plan" && project.category !== "Design Style" && project.videoUrl && project.videoUrl.trim() !== "");
        const badgeHtml = showVideoBadge ? `
          <span class="video-tour-badge"><i class="fa-solid fa-circle-play pulsing-icon"></i> Dynamic Tour</span>
        ` : '';

        const hasArchitect = project.architect && project.architect.trim() !== "" && project.architect !== "N/A";
        const architectHtml = (hasArchitect && !isFloorPlanOrDesignTour) ? `
          <p class="card-architect"><i class="fa-solid fa-compass-drafting"></i> By ${project.architect}</p>
        ` : '';

        const styleHtml = (project.style && project.style.trim() !== "" && project.style !== "N/A") ? `
          <span class="card-style-tag">${project.style}</span>
        ` : '';

        const hasArea = project.area && project.area.trim() !== "" && project.area !== "N/A";
        const areaHtml = hasArea ? `
          <span class="card-area-tag"><i class="fa-solid fa-ruler-combined"></i> ${project.area}</span>
        ` : '';

        const hasLocation = project.location && project.location.trim() !== "" && project.location !== "N/A";
        const locationHtml = hasLocation ? `
          <div class="card-spec-item">
            <span class="card-spec-lbl">Location</span>
            <span class="card-spec-val"><i class="fa-solid fa-location-dot"></i> ${project.location.split(",")[0]}</span>
          </div>
        ` : '';

        card.innerHTML = `
          <div class="card-media-wrapper">
            <img src="${heroImageSrc}" alt="${project.title}" class="card-thumbnail" loading="lazy">
            ${badgeHtml}
            
            <!-- Immersive card hover quick link overlay -->
            <div class="card-quick-overlay">
              <button class="btn btn-primary btn-sm" onclick="app.openProjectDetail('${project.id}')">
                <i class="fa-solid fa-circle-info"></i> View Design Guide
              </button>
            </div>
          </div>
          
          <div class="card-content">
            <div class="card-tag-row">
              ${styleHtml}
              ${areaHtml}
            </div>
            <h3 class="card-title">${project.title}</h3>
            ${architectHtml}
            
            <div class="card-specs-row">
              ${locationHtml}
              ${budgetHtml}
            </div>
          </div>
        `;
        grid.appendChild(card);
      }
    });
  }

  /* ==========================================================================
     Magazine PDF Document Reader Handlers
     ========================================================================== */

  async openMagazineReader(id) {
    const project = this.projects.find(p => p.id === id);
    if (!project) return;

    const modalEl = document.getElementById("magazine-reader-modal");
    const titleEl = document.getElementById("magazine-modal-title");
    const loadingOverlay = document.getElementById("pdf-loading-overlay");

    if (modalEl && titleEl) {
      titleEl.innerText = project.title;
      modalEl.classList.add("active");
      document.body.style.overflow = "hidden";

      if (loadingOverlay) loadingOverlay.style.display = "flex";

      const pdfUrl = project.pdfUrl || "";
      if (!pdfUrl) {
        this.showToast("No PDF document link provided.", "error");
        if (loadingOverlay) loadingOverlay.style.display = "none";
        return;
      }

      try {
        // Load PDF using PDF.js
        const loadingTask = window.pdfjsLib.getDocument(pdfUrl);
        this.pdfDoc = await loadingTask.promise;
        this.pdfCurrentPageNum = 1;
        this.pdfZoomScale = 1.0;
        
        const totalPagesEl = document.getElementById("pdf-total-pages");
        if (totalPagesEl) totalPagesEl.innerText = this.pdfDoc.numPages;

        const currentPageEl = document.getElementById("pdf-current-page");
        if (currentPageEl) {
          currentPageEl.value = 1;
          currentPageEl.max = this.pdfDoc.numPages;
        }

        const zoomLevelEl = document.getElementById("pdf-zoom-level");
        if (zoomLevelEl) zoomLevelEl.innerText = "100%";

        // Render first page
        await this.renderPdfPage(this.pdfCurrentPageNum);
      } catch (err) {
        console.error("Error loading PDF with PDF.js:", err);
        this.showToast("Failed to load PDF document dynamically.", "error");
      } finally {
        if (loadingOverlay) loadingOverlay.style.display = "none";
      }
    }
  }

  async renderPdfPage(num) {
    if (!this.pdfDoc) return;
    this.pdfIsRendering = true;

    try {
      const page = await this.pdfDoc.getPage(num);
      const canvas = document.getElementById("pdf-render-canvas");
      if (!canvas) return;

      const container = document.getElementById("pdf-canvas-container");
      const containerWidth = container ? container.clientWidth : 800;

      // Calculate viewport at scale 1.0 first
      let viewport = page.getViewport({ scale: 1.0 });

      // Determine scaling factor to fit the container's width (full-width)
      // We also apply the user's interactive zoom scale
      const fitScale = (containerWidth - 20) / viewport.width;
      const finalScale = fitScale * this.pdfZoomScale;

      viewport = page.getViewport({ scale: finalScale });
      const context = canvas.getContext("2d");
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };

      await page.render(renderContext).promise;
      this.pdfIsRendering = false;

      // Update current page inputs
      const pageInput = document.getElementById("pdf-current-page");
      if (pageInput) pageInput.value = num;

      if (this.pdfPagePendingNum !== null) {
        const nextNum = this.pdfPagePendingNum;
        this.pdfPagePendingNum = null;
        this.renderPdfPage(nextNum);
      }
    } catch (err) {
      console.error("PDF page rendering error:", err);
      this.pdfIsRendering = false;
    }
  }

  queueRenderPdfPage(num) {
    if (this.pdfIsRendering) {
      this.pdfPagePendingNum = num;
    } else {
      this.renderPdfPage(num);
    }
  }

  pdfPrevPage() {
    if (!this.pdfDoc || this.pdfCurrentPageNum <= 1) return;
    this.pdfCurrentPageNum--;
    this.queueRenderPdfPage(this.pdfCurrentPageNum);
  }

  pdfNextPage() {
    if (!this.pdfDoc || this.pdfCurrentPageNum >= this.pdfDoc.numPages) return;
    this.pdfCurrentPageNum++;
    this.queueRenderPdfPage(this.pdfCurrentPageNum);
  }

  pdfGoToPage(val) {
    let pageNum = parseInt(val);
    if (!this.pdfDoc || isNaN(pageNum)) return;

    if (pageNum < 1) pageNum = 1;
    if (pageNum > this.pdfDoc.numPages) pageNum = this.pdfDoc.numPages;

    this.pdfCurrentPageNum = pageNum;
    this.queueRenderPdfPage(pageNum);
  }

  pdfZoomIn() {
    if (!this.pdfDoc) return;
    this.pdfZoomScale += 0.2;
    if (this.pdfZoomScale > 3.0) this.pdfZoomScale = 3.0;
    
    const zoomLevelEl = document.getElementById("pdf-zoom-level");
    if (zoomLevelEl) zoomLevelEl.innerText = `${Math.round(this.pdfZoomScale * 100)}%`;
    
    this.queueRenderPdfPage(this.pdfCurrentPageNum);
  }

  pdfZoomOut() {
    if (!this.pdfDoc) return;
    this.pdfZoomScale -= 0.2;
    if (this.pdfZoomScale < 0.5) this.pdfZoomScale = 0.5;

    const zoomLevelEl = document.getElementById("pdf-zoom-level");
    if (zoomLevelEl) zoomLevelEl.innerText = `${Math.round(this.pdfZoomScale * 100)}%`;

    this.queueRenderPdfPage(this.pdfCurrentPageNum);
  }

  closeMagazineReader() {
    const modalEl = document.getElementById("magazine-reader-modal");
    if (modalEl) modalEl.classList.remove("active");

    this.pdfDoc = null;
    this.pdfCurrentPageNum = 1;
    this.pdfZoomScale = 1.0;
    this.pdfIsRendering = false;
    this.pdfPagePendingNum = null;

    document.body.style.overflow = "";
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

    // 1. Hide Architect info dynamically for Design Tour and Floor Plan
    const archWrapper = document.getElementById("modal-architect-wrapper");
    if (archWrapper) {
      if (project.category === "Design Tour" || project.category === "Floor Plan") {
        archWrapper.style.display = "none";
      } else {
        archWrapper.style.display = "";
      }
    }

    // 2. Configure Overview Stat Cards conditionally based on category
    const bhkCard = document.getElementById("modal-stat-card-bhk");
    const orientCard = document.getElementById("modal-stat-card-orientation");
    const areaCard = document.getElementById("modal-stat-card-area");
    const yearCard = document.getElementById("modal-stat-card-year");
    const statsGrid = document.querySelector(".overview-stats-grid");

    // Default all to visible initially
    if (bhkCard) bhkCard.style.display = "";
    if (orientCard) orientCard.style.display = "";
    if (areaCard) areaCard.style.display = "";
    if (yearCard) yearCard.style.display = "";
    if (statsGrid) statsGrid.style.display = "";

    const hasBhk = details.bhk && details.bhk.trim() !== "" && details.bhk !== "N/A";
    const hasOrient = details.orientation && details.orientation.trim() !== "" && details.orientation !== "N/A";
    const hasArea = project.area && project.area.trim() !== "" && project.area !== "N/A";
    const hasYear = details.year && details.year.trim() !== "" && details.year !== "N/A";

    if (project.category === "Design Tour") {
      if (bhkCard) bhkCard.style.display = hasBhk ? "" : "none";
      if (orientCard) orientCard.style.display = hasOrient ? "" : "none";
      if (areaCard) areaCard.style.display = hasArea ? "" : "none";
      if (yearCard) yearCard.style.display = hasYear ? "" : "none";
    } else if (project.category === "Floor Plan") {
      // Keep only Facing & Total Area if present; remove Layout & Finished In
      if (bhkCard) bhkCard.style.display = "none";
      if (yearCard) yearCard.style.display = "none";
      if (orientCard) orientCard.style.display = hasOrient ? "" : "none";
      if (areaCard) areaCard.style.display = hasArea ? "" : "none";
    } else if (project.category === "Design Style") {
      // Remove Layout, Facing, Total Area, Finished In
      if (bhkCard) bhkCard.style.display = "none";
      if (orientCard) orientCard.style.display = "none";
      if (areaCard) areaCard.style.display = "none";
      if (yearCard) yearCard.style.display = "none";
    }

    // Hide overview stats grid if no cards are displayed
    if (statsGrid) {
      const visibleCards = Array.from(statsGrid.children).filter(card => card.style.display !== "none");
      if (visibleCards.length === 0) {
        statsGrid.style.display = "none";
      }
    }

    // 3. Est. Budget Summary Box visibility adjustments
    const costSummary = document.getElementById("modal-cost-summary-wrapper");
    const costBreakdown = document.getElementById("modal-project-cost-breakdown");

    if (project.category === "Floor Plan" || project.category === "Design Tour" || project.category === "Design Style") {
      if (costSummary) costSummary.style.display = "none"; // Hide the entire budget box
    } else {
      if (costBreakdown) costBreakdown.style.display = "";
      if (costSummary) {
        costSummary.style.display = (project.budget && project.budget !== "N/A" && project.budget.trim() !== "") ? "" : "none";
      }
    }

    // 4. Tab Navigation buttons show/hide controls
    const tabFloorPlanBtn = document.querySelector('button[onclick*="tab-floorplan"]');
    const tabMaterialsBtn = document.querySelector('button[onclick*="tab-materials"]');
    const modalTabsContainer = document.querySelector(".modal-tabs");

    if (project.category === "Floor Plan" || project.category === "Design Style") {
      if (tabFloorPlanBtn) tabFloorPlanBtn.style.display = "none";
      if (tabMaterialsBtn) tabMaterialsBtn.style.display = "none";
      if (modalTabsContainer) modalTabsContainer.style.display = "none";
    } else {
      if (tabFloorPlanBtn) tabFloorPlanBtn.style.display = "";
      if (tabMaterialsBtn) tabMaterialsBtn.style.display = "";
      if (modalTabsContainer) modalTabsContainer.style.display = "";
    }

    // 5. Walkthrough Video and Photos Gallery visibility options
    let showVideo = false;
    let showGallery = false;

    if (project.category === "Design Tour") {
      showVideo = !!(project.videoUrl && project.videoUrl.trim() !== "");
      showGallery = !!(project.gallery && project.gallery.length > 0);
    } else if (project.category === "Floor Plan" || project.category === "Design Style") {
      showVideo = false; // Hide video player completely
      showGallery = !!(project.gallery && project.gallery.length > 0);
    } else {
      showVideo = !!(project.videoUrl && project.videoUrl.trim() !== "");
      showGallery = !!(project.gallery && project.gallery.length > 0);
    }

    const videoContainer = document.getElementById("project-modal-video-container");
    const galleryWrapper = document.querySelector(".modal-gallery-wrapper");
    const detailGrid = document.querySelector(".project-detail-grid");

    if (videoContainer) {
      videoContainer.innerHTML = ""; // Clear active
      videoContainer.style.display = showVideo ? "" : "none";
      
      if (showVideo) {
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
    }

    if (galleryWrapper) {
      galleryWrapper.style.display = showGallery ? "" : "none";
    }

    // Set slider gallery carousel internally
    if (showGallery) {
      this.renderModalGallery();
    }

    // Toggle 1-column detail grid if both video and gallery are missing
    if (detailGrid) {
      if (!showVideo && !showGallery) {
        detailGrid.style.gridTemplateColumns = "1fr";
      } else {
        detailGrid.style.gridTemplateColumns = "";
      }
    }

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
    this.switchTabDirectly("tab-overview");

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
