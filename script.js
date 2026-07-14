document.addEventListener("DOMContentLoaded", () => {
  // Configs
  const GITHUB_USERNAME = "2902Duy";
  
  // DOM Elements
  const contributorsGrid = document.getElementById("contributors-grid");
  const toggleRegistered = document.getElementById("toggle-registered");
  const rangeSlider = document.getElementById("range-slider");
  const sliderValLabel = document.getElementById("slider-val");
  
  // Variables to hold loaded database
  let gitDB = null;
  let commitsChart = null;
  let filterRegisteredOnly = false; // State of the toggle switch
  
  // Initialize
  fetchGitDatabase();
  setupEventListeners();

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
   * Formats a date YYYY-MM-DD to a shorter string (e.g. Jun 22)
   */
  function formatDateLabel(dateStr) {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
});
