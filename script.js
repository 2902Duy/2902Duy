document.addEventListener("DOMContentLoaded", () => {
  // Configs
  const GITHUB_USERNAME = "2902Duy";
  
  // DOM Elements
  const projectsGrid = document.getElementById("projects-grid");
  const contributorsGrid = document.getElementById("contributors-grid");
  const toggleRegistered = document.getElementById("toggle-registered");
  const rangeSlider = document.getElementById("range-slider");
  const sliderValLabel = document.getElementById("slider-val");
  
  // Variables to hold loaded database
  let gitDB = null;
  let commitsChart = null;
  let filterRegisteredOnly = false; // State of the toggle switch
  
  // Initialize
  fetchGitHubRepos();
  fetchGitDatabase();
  setupEventListeners();
  
  /**
   * Setup Event Listeners for interactive elements
   */
  function setupEventListeners() {
    // Toggle switch click event
    toggleRegistered.addEventListener("click", () => {
      filterRegisteredOnly = !filterRegisteredOnly;
      toggleRegistered.classList.toggle("active", filterRegisteredOnly);
      if (gitDB) {
        renderContributors(gitDB.contributors);
      }
    });

    // Range slider input event
    rangeSlider.addEventListener("input", (e) => {
      const months = parseInt(e.target.value);
      sliderValLabel.textContent = `${months} Month${months > 1 ? 's' : ''}`;
      if (gitDB && commitsChart) {
        updateChartRange(months);
      }
    });
  }

  /**
   * Fetches public repositories from GitHub API
   */
  async function fetchGitHubRepos() {
    try {
      const response = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=6`);
      if (!response.ok) throw new Error("API error");
      const repos = await response.json();
      
      const filteredRepos = repos
        .filter(repo => repo.name.toLowerCase() !== GITHUB_USERNAME.toLowerCase())
        .slice(0, 6);
        
      renderRepos(filteredRepos);
    } catch (error) {
      console.error("Error fetching GitHub repos:", error);
      renderReposError();
    }
  }

  /**
   * Renders the repository cards in the UI
   */
  function renderRepos(repos) {
    projectsGrid.innerHTML = "";
    if (repos.length === 0) {
      projectsGrid.innerHTML = `<div class="card" style="grid-column: 1/-1; text-align: center;"><p class="card-desc">No public repositories found.</p></div>`;
      return;
    }
    
    repos.forEach(repo => {
      const card = document.createElement("a");
      card.href = repo.html_url;
      card.target = "_blank";
      card.className = "card";
      card.setAttribute("aria-label", `Repository ${repo.name}: ${repo.description}`);
      
      const language = repo.language || "Unknown";
      const langClass = `lang-${language.toLowerCase().replace(/[+#]/g, "")}`;
      
      card.innerHTML = `
        <div>
          <div class="card-title">
            <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
            </svg>
            ${repo.name}
          </div>
          <p class="card-desc">${repo.description || "No description provided."}</p>
        </div>
        <div class="card-meta">
          <div class="card-lang">
            <span class="lang-dot ${langClass}"></span>
            ${language}
          </div>
          <div class="card-stats">
            <div class="card-stat-item" title="Stars">
              <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
              </svg>
              ${repo.stargazers_count}
            </div>
            <div class="card-stat-item" title="Forks">
              <svg stroke="currentColor" fill="none" stroke-width="2" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg">
                <circle cx="18" cy="18" r="3"></circle>
                <circle cx="6" cy="6" r="3"></circle>
                <circle cx="6" cy="18" r="3"></circle>
                <path d="M18 15V9a4 4 0 0 0-4-4H9"></path>
                <line x1="6" y1="9" x2="6" y2="15"></line>
              </svg>
              ${repo.forks_count}
            </div>
          </div>
        </div>
      `;
      projectsGrid.appendChild(card);
    });
  }

  function renderReposError() {
    projectsGrid.innerHTML = `<div class="card" style="grid-column: 1/-1; border-color: var(--accent-pink); text-align: center;"><p class="card-desc" style="color: var(--accent-pink);">Failed to load repositories.</p></div>`;
  }

  /**
   * Fetches Git Database from git_db.json
   */
  async function fetchGitDatabase() {
    try {
      const response = await fetch("./git_db.json");
      if (!response.ok) throw new Error("Database error");
      gitDB = await response.json();
      
      renderContributors(gitDB.contributors);
      initCommitsChart(gitDB.contributors);
    } catch (error) {
      console.error("Error loading git database:", error);
      contributorsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--accent-pink); padding: 2rem;">Failed to load contributor database.</div>`;
    }
  }

  /**
   * Renders Contributor Cards (styled like GitHub's Contributors graph cards)
   */
  function renderContributors(contributors) {
    contributorsGrid.innerHTML = "";
    
    // Filter if "Only registered accounts" toggle is active
    let filtered = contributors;
    if (filterRegisteredOnly) {
      filtered = contributors.filter(c => c.is_registered);
    }
    
    if (filtered.length === 0) {
      contributorsGrid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-sub); padding: 2rem;">No matching contributors found.</div>`;
      return;
    }
    
    filtered.forEach((c, index) => {
      const card = document.createElement("div");
      card.className = "contributor-card";
      
      // Determine rank tag
      const rank = `#${index + 1}`;
      
      // Format additions and deletions with commas
      const additionsFormatted = Number(c.additions).toLocaleString();
      const deletionsFormatted = Number(c.deletions).toLocaleString();
      
      // Generate avatar HTML
      let avatarHTML = "";
      if (c.avatar_url.startsWith("http")) {
        avatarHTML = `<img class="contributor-avatar" src="${c.avatar_url}" alt="${c.name}" />`;
      } else {
        const firstLetter = c.name.charAt(0).toUpperCase();
        const avatarClass = `avatar-${c.avatar_url.split("-")[1] || "generic"}`;
        avatarHTML = `<div class="contributor-avatar-fallback ${avatarClass}">${firstLetter}</div>`;
      }
      
      // Generate mini SVG sparkline
      const sparklineHTML = generateSparklineSVG(c.history);
      
      card.innerHTML = `
        <div class="contributor-header">
          <div class="contributor-profile">
            ${avatarHTML}
            <div class="contributor-name" title="${c.name}">${c.name}</div>
          </div>
          <span class="contributor-rank">${rank}</span>
        </div>
        <div class="contributor-stats">
          <div class="contributor-commits">${c.commits} commit${c.commits > 1 ? 's' : ''}</div>
          <div class="contributor-diff">
            <span class="diff-add">${additionsFormatted} ++</span>
            <span class="diff-del">${deletionsFormatted} --</span>
          </div>
        </div>
        <div class="contributor-sparkline">
          ${sparklineHTML}
        </div>
      `;
      
      contributorsGrid.appendChild(card);
    });
  }

  /**
   * Generates a lightweight, responsive SVG sparkline path
   */
  function generateSparklineSVG(history) {
    if (!history || history.length === 0) return "";
    
    const values = history.map(h => h.commits);
    const maxVal = Math.max(...values, 1);
    const width = 240;
    const height = 24;
    const padding = 2;
    
    // Calculate SVG point coordinates
    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * (width - padding * 2) + padding;
      const y = height - (val / maxVal) * (height - padding * 2) - padding;
      return `${x},${y}`;
    });
    
    const pathD = `M ${points.join(" L ")}`;
    
    // Area polygon d property
    const areaD = `M ${points[0].split(",")[0]},${height} L ${points.join(" L ")} L ${points[points.length - 1].split(",")[0]},${height} Z`;
    
    return `
      <svg viewBox="0 0 ${width} ${height}" width="100%" height="100%" preserveAspectRatio="none">
        <path class="sparkline-area" d="${areaD}"></path>
        <path class="sparkline-path" d="${pathD}"></path>
      </svg>
    `;
  }

  /**
   * Initializes the main Chart.js Commits-over-time bar chart
   */
  function initCommitsChart(contributors) {
    // Find you (2902Duy) to render the main commit history
    const user = contributors.find(c => c.name === "2902Duy");
    if (!user || !user.history) return;
    
    const ctx = document.getElementById("commits-chart-canvas").getContext("2d");
    
    // Sort and format database values
    const labels = user.history.map(h => formatDateLabel(h.week));
    const data = user.history.map(h => h.commits);
    
    commitsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Commits',
          data: data,
          backgroundColor: 'rgba(6, 182, 212, 0.2)',
          borderColor: '#06b6d4',
          borderWidth: 1.5,
          borderRadius: 4,
          hoverBackgroundColor: 'rgba(16, 185, 129, 0.4)',
          hoverBorderColor: '#10b981',
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: '#111827',
            titleFont: { family: 'Outfit', weight: 'bold' },
            bodyFont: { family: 'Fira Code' },
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.02)' },
            ticks: { color: '#6b7280', font: { family: 'Outfit', size: 10 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#6b7280', font: { family: 'Fira Code', size: 10 } }
          }
        }
      }
    });
    
    // Set initial view to 3 Months (standard developer timeline)
    rangeSlider.value = 3;
    sliderValLabel.textContent = "3 Months";
    updateChartRange(3);
  }

  /**
   * Filters the Chart.js timeline dynamically when range slider changes
   */
  function updateChartRange(months) {
    if (!gitDB || !commitsChart) return;
    
    const user = gitDB.contributors.find(c => c.name === "2902Duy");
    if (!user || !user.history) return;
    
    // Calculate cutoff date in the past
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - months);
    
    // Filter history based on dates
    const filteredHistory = user.history.filter(h => {
      const commitDate = new Date(h.week);
      return commitDate >= cutoffDate;
    });
    
    // Update chart
    commitsChart.data.labels = filteredHistory.map(h => formatDateLabel(h.week));
    commitsChart.data.datasets[0].data = filteredHistory.map(h => h.commits);
    commitsChart.update();
  }

  /**
   * Formats a date YYYY-MM-DD to a shorter string (e.g. Jun 22)
   */
  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
});
