document.addEventListener("DOMContentLoaded", () => {
  // Configs
  const GITHUB_USERNAME = "2902Duy";
  
  // DOM Elements
  const contributorsGrid = document.getElementById("contributors-grid");
  const toggleRegistered = document.getElementById("toggle-registered");
  const rangeSlider = document.getElementById("range-slider");
  const sliderValLabel = document.getElementById("slider-val");
  const heatmapTitle = document.getElementById("heatmap-title");
  const calendarSquaresGrid = document.getElementById("calendar-squares-grid");
  const monthsLabels = document.getElementById("months-labels");
  
  // Variables to hold loaded database
  let gitDB = null;
  let commitsChart = null;
  let filterRegisteredOnly = false; // State of the toggle switch
  
  // Initialize
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
    
    // Year selector buttons click event
    document.querySelectorAll(".year-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        document.querySelectorAll(".year-btn").forEach(b => b.classList.remove("active"));
        e.target.classList.add("active");
        
        const selectedYear = parseInt(e.target.dataset.year);
        if (gitDB) {
          buildContributionCalendarForYear(gitDB.contributors, selectedYear);
        }
      });
    });
  }

  /**
   * Fetches Git Database from git_db.json
   */
  async function fetchGitDatabase() {
    try {
      const response = await fetch(`./git_db.json?t=${Date.now()}`);
      if (!response.ok) throw new Error("Database error");
      gitDB = await response.json();
      
      renderContributors(gitDB.contributors);
      initCommitsChart(gitDB.contributors);
      buildContributionCalendarForYear(gitDB.contributors, 2026); // Default year
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
      
      // Target profile link
      const profileUrl = c.profile_url || "#";
      const sparklineHTML = generateSparklineSVG(c.history);
      
      card.innerHTML = `
        <div class="contributor-header">
          <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="contributor-profile">
            ${avatarHTML}
            <div class="contributor-name" title="${c.name}">${c.name}</div>
          </a>
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
   * Initializes the main Chart.js Commits-over-time wave line chart
   * Matches "Dyu's Contribution Graph" style (pink curved wave)
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
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Commits',
          data: data,
          fill: true,
          backgroundColor: 'rgba(219, 39, 119, 0.1)', // Light pink glow fill
          borderColor: '#db2777', // Deep pink/magenta wave border
          borderWidth: 2.5,
          tension: 0.45, // Beautiful curved wave (cubic interpolation)
          pointBackgroundColor: '#111827',
          pointBorderColor: '#db2777',
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointHoverBackgroundColor: '#db2777',
          pointHoverBorderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: "Dyu's Contribution Graph",
            color: '#db2777',
            font: { family: 'Outfit', size: 16, weight: 'bold' },
            padding: { bottom: 10 }
          },
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
    
    // Set initial view to 3 Months
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

  /**
   * Dynamically constructs the GitHub Contribution Calendar Heatmap Grid
   */
  function buildContributionCalendarForYear(contributors, selectedYear) {
    const user = contributors.find(c => c.name === "2902Duy");
    if (!user || !user.daily_history) return;
    
    calendarSquaresGrid.innerHTML = "";
    monthsLabels.innerHTML = "";
    
    // Create a lookup map for daily commits
    const commitMap = {};
    user.daily_history.forEach(item => {
      commitMap[item.day] = item.commits;
    });
    
    // Define the start and end dates for a full 53-week year view
    // GitHub contribution grid always starts on a Sunday and ends on a Saturday
    let startDate, endDate;
    
    if (selectedYear === 2026) {
      // Show rolling last 1 year starting from 365 days ago
      endDate = new Date();
      startDate = new Date(endDate);
      startDate.setFullYear(endDate.getFullYear() - 1);
    } else {
      // Show calendar for the specific calendar year (e.g. Jan 1 to Dec 31)
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31);
    }
    
    // Adjust startDate back to the nearest Sunday to keep the columns aligned
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - startDay);
    
    // Adjust endDate forward to the nearest Saturday
    const endDay = endDate.getDay();
    endDate.setDate(endDate.getDate() + (6 - endDay));
    
    // Calculate total days and loop through them
    const oneDayMs = 24 * 60 * 60 * 1000;
    const totalDays = Math.round((endDate - startDate) / oneDayMs) + 1;
    
    let totalCommitsInPeriod = 0;
    let currentMonth = -1;
    const monthsArray = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Track column index for month label placements
    let colIndex = 0;
    
    // Initialize currentDate at the start of day (local time)
    let currentDate = new Date(startDate);
    currentDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < totalDays; i++) {
      // Get exact YYYY-MM-DD in local time
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      
      const commitsCount = commitMap[dateStr] || 0;
      totalCommitsInPeriod += commitsCount;
      
      // Determine color level (0 to 4)
      let level = 0;
      if (commitsCount > 0) {
        if (commitsCount <= 2) level = 1;
        else if (commitsCount <= 5) level = 2;
        else if (commitsCount <= 9) level = 3;
        else level = 4;
      }
      
      // Create HTML element for this day
      const square = document.createElement("div");
      square.className = `calendar-square level-${level}`;
      
      // Tooltip formatting
      const readableDate = currentDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric"
      });
      const tooltipText = `${commitsCount === 0 ? 'No' : commitsCount} commit${commitsCount !== 1 ? 's' : ''} on ${readableDate}`;
      square.setAttribute("data-tooltip", tooltipText);
      
      calendarSquaresGrid.appendChild(square);
      
      // Handle Month labels alignment
      // GitHub calendar places month label at the top column when a new month starts
      if (currentDate.getDay() === 0) { // Sunday represents start of a new column
        const month = currentDate.getMonth();
        if (month !== currentMonth) {
          currentMonth = month;
          const monthLabel = document.createElement("span");
          monthLabel.textContent = monthsArray[month];
          monthLabel.style.gridColumn = `${colIndex + 1} / span 4`;
          monthsLabels.appendChild(monthLabel);
        }
        colIndex++;
      }
      
      // Increment by exactly 1 day locally
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Update Title with computed commits
    heatmapTitle.textContent = `${totalCommitsInPeriod.toLocaleString()} contributions in the last year`;
  }
});
