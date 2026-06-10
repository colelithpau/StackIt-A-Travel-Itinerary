/*
  script.js
  All frontend logic for StackIt.
  Runs in the browser and talks to the Flask backend via fetch().

  Sections:
    1.  State — all variables that track the app's current condition
    2.  Profiles & Login — profile management and login gate
    3.  Tab switching — which panel is visible
    4.  Theme toggle — dark/light mode
    5.  Weather widget — simulated forecast based on check-in date
    6.  Listings — fetch, filter, sort, binary search, render
    7.  Map — SVG map with dragging, zoom, and property pins
    8.  Bookings — book a property, display active and past bookings
    9.  Spreadsheet — 100-row editable grid
   10.  Linked List (SLL) notes — add, delete, categorize
   11.  Itinerary files — save, load, delete
   12.  Telemetry & deals — track searches, trigger concierge deals
   13.  Activity log — in-page console for DS events
   14.  Init — runs everything on page load
*/


// ═══════════════════════════════════════════
// SECTION 1 — STATE
// All app-wide variables live here so they are easy to find.
// ═══════════════════════════════════════════

// Profiles and authentication
let profiles = [];        // array of { id, name, avatar, role }
let activeProfile = null; // the currently logged-in profile
let selectedForLogin = null; // profile tapped on login screen

// Listings data
let allListings = [];     // full 1000-item dataset from backend
let sortedListings = [];  // result after quicksort/binary search
let visibleCount = 40;    // how many listing cards are shown at once

// Applied filter state
let appliedFilters = {
  bookingType:  'All',
  roomType:     'All',
  propertyType: 'All',
  city:         'All',
  amenities:    [],
  accessibility:[],
  minPrice:     0,
  maxPrice:     99999,
  query:        ''
};

// Guest counters
let guestAdults   = 2;
let guestChildren = 0;
let guestToddlers = 0;
let guestPets     = 0;

// Map state
let zoomLevel = 2;    // 1 = world, 2-5 = Philippines detail
let panX = 0, panY = 0;
let isDragging = false;
let dragStartX = 0, dragStartY = 0;
let popupProperty = null; // property shown in map popup

// Spreadsheet state
let gridData = {};           // { 'A1': 'text', 'B3': 'value', ... }
let selectedCell = null;     // { row: 1, col: 'A' }
let currentFileId   = null;  // id of the currently open itinerary file
let currentFileName = '';    // display name of the open file

// Saved itinerary files
let savedFiles = [];    // array of { id, name, gridData, savedAt }

// Bookings
let bookings = [];  // array of booking records in localStorage

// SLL notes (from backend)
let notesList = [];   // list of note objects from /api/ds/notes

// Active deal (concierge recommendation)
let activeDeal = null;

// Activity log
let logEntries = [];


// ═══════════════════════════════════════════
// SECTION 2 — PROFILES & LOGIN
// ═══════════════════════════════════════════

// Bear avatar emoji mapping
function bearEmoji(avatar) {
  if (avatar === 'grizz')  return '🐻';
  if (avatar === 'panda')  return '🐼';
  if (avatar === 'ice')    return '🐻‍❄️';
  return '🏕️';
}

// Bear name color class (inline style)
function bearColor(avatar) {
  if (avatar === 'grizz')  return '#b07d62';
  if (avatar === 'panda')  return '#5c677d';
  if (avatar === 'ice')    return '#90e0ef';
  return '#8f9779';
}

// Assign a default role based on avatar type
function bearRole(avatar) {
  if (avatar === 'grizz') return 'Adventure Leader';
  if (avatar === 'panda') return 'Social Media Planner';
  if (avatar === 'ice')   return 'Master Chef & Logistics';
  return 'Traveler';
}

// Load profiles from localStorage, or create the default three
function loadProfiles() {
  const saved = localStorage.getItem('stackit_profiles');
  if (saved) {
    try { profiles = JSON.parse(saved); return; } catch (e) {}
  }
  // Default profiles (the three bears)
  profiles = [
    { id: '1', name: 'Grizz',    avatar: 'grizz', role: 'Adventure Leader' },
    { id: '2', name: 'Panda',    avatar: 'panda',  role: 'Social Media Planner' },
    { id: '3', name: 'Ice Bear', avatar: 'ice',    role: 'Master Chef & Logistics' }
  ];
  saveProfiles();
}

function saveProfiles() {
  localStorage.setItem('stackit_profiles', JSON.stringify(profiles));
}

// Render the profile buttons on the login screen
function renderLoginProfiles() {
  const grid = document.getElementById('profile-grid');
  grid.innerHTML = '';
  profiles.forEach(p => {
    const btn = document.createElement('button');
    btn.className = 'profile-card' + (selectedForLogin?.id === p.id ? ' selected' : '');
    btn.innerHTML = `
      <span class="profile-avatar">${bearEmoji(p.avatar)}</span>
      <span class="profile-name">${p.name}</span>
      <span class="profile-role">${p.role}</span>
    `;
    btn.onclick = () => {
      selectedForLogin = p;
      document.getElementById('login-error').classList.add('hidden');
      document.getElementById('password-input').value = '';
      document.getElementById('signin-label').textContent = `Sign in as ${p.name}`;
      document.getElementById('password-section').classList.remove('hidden');
      renderLoginProfiles(); // re-render to show selected state
    };
    grid.appendChild(btn);
  });
}

// Handle the Sign In button click
document.getElementById('signin-btn').addEventListener('click', () => {
  if (!selectedForLogin) return;
  const pw = document.getElementById('password-input').value;
  if (pw === 'stackit') {
    activeProfile = selectedForLogin;
    localStorage.setItem('stackit_active_profile', JSON.stringify(activeProfile));
    localStorage.setItem('stackit_is_logged_in', 'true');
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('password-input').value = '';
    document.getElementById('login-error').classList.add('hidden');
    addLog('Session started for ' + activeProfile.name);
    initApp();
  } else {
    document.getElementById('login-error').classList.remove('hidden');
  }
});

// Allow pressing Enter on password field
document.getElementById('password-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('signin-btn').click();
});

// Create new profile from login screen form
document.getElementById('create-profile-btn').addEventListener('click', () => {
  const name = document.getElementById('new-profile-name').value.trim();
  if (!name) return;
  const avatar = document.getElementById('new-profile-avatar').value;
  const newP = {
    id:     String(Date.now()),
    name:   name,
    avatar: avatar,
    role:   bearRole(avatar)
  };
  profiles.push(newP);
  saveProfiles();
  document.getElementById('new-profile-name').value = '';
  renderLoginProfiles();
  addLog('New profile created: ' + name);
});

// Render profile switcher buttons in the navbar
function renderProfileSwitcher() {
  const sw = document.getElementById('profile-switcher');
  sw.innerHTML = '';

  // Profile avatar buttons
  const btns = document.createElement('div');
  btns.style.display = 'flex';
  btns.style.gap = '4px';

  profiles.forEach(p => {
    const b = document.createElement('button');
    b.className = 'switcher-btn' + (activeProfile?.id === p.id ? ' active-profile' : '');
    b.title = 'Switch to ' + p.name;
    b.textContent = bearEmoji(p.avatar);
    b.onclick = () => {
      activeProfile = p;
      localStorage.setItem('stackit_active_profile', JSON.stringify(p));
      renderProfileSwitcher();
      renderBookings();
      addLog('Switched to ' + p.name);
    };
    btns.appendChild(b);
  });
  sw.appendChild(btns);

  // Active profile label
  if (activeProfile) {
    const label = document.createElement('div');
    label.innerHTML = `
      <span class="active-label">ACTIVE</span>
      <span class="active-name" style="color:${bearColor(activeProfile.avatar)}">${activeProfile.name}</span>
    `;
    sw.appendChild(label);
  }
}

// Logout
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('stackit_is_logged_in');
  localStorage.removeItem('stackit_active_profile');
  activeProfile = null;
  selectedForLogin = null;
  document.getElementById('main-app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('password-section').classList.add('hidden');
  renderLoginProfiles();
});


// ═══════════════════════════════════════════
// SECTION 3 — TAB SWITCHING
// ═══════════════════════════════════════════

function switchTab(tabId) {
  // Remove active class from all tabs and sections
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));

  // Activate the chosen tab and section
  const tabBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
  const section = document.getElementById('tab-' + tabId);
  if (tabBtn)  tabBtn.classList.add('active');
  if (section) section.classList.add('active');

  // Refresh dynamic content when tabs are opened
  if (tabId === 'reservations') renderBookings();
  if (tabId === 'home') updateDealCard();
}

// Tab bar click handler
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});


// ═══════════════════════════════════════════
// SECTION 4 — THEME TOGGLE
// ═══════════════════════════════════════════

let isDark = true;

document.getElementById('theme-btn').addEventListener('click', () => {
  isDark = !isDark;
  document.body.classList.toggle('light', !isDark);
  document.getElementById('theme-btn').textContent = isDark ? '🌙' : '☀️';
});


// ═══════════════════════════════════════════
// SECTION 5 — WEATHER WIDGET
// ═══════════════════════════════════════════

// Simulated forecast — cycles through 4 conditions based on the day of check-in
function updateWeather() {
  const dateVal = document.getElementById('check-in').value;
  const day = dateVal ? parseInt(dateVal.split('-')[2]) || 15 : 15;
  const conditions = [
    { icon: '☀️', temp: '33°C', label: 'Sunny',         rec: 'Great day for outdoor exploration!' },
    { icon: '🌧️', temp: '24°C', label: 'Rainy',          rec: 'Bring a shelter and warm drinks.' },
    { icon: '☁️', temp: '27°C', label: 'Overcast',        rec: 'Good hiking weather, low UV.' },
    { icon: '🌬️', temp: '22°C', label: 'Clear & Windy',   rec: 'Cool night great for stargazing.' }
  ];
  const w = conditions[day % 4];
  document.getElementById('weather-display').innerHTML = `
    <span class="weather-icon">${w.icon}</span>
    <div>
      <span class="weather-temp">${w.temp}</span>
      <span class="weather-label">${w.label}</span>
    </div>
  `;
  document.getElementById('weather-rec').textContent = '🏕️ ' + w.rec;
}

// Recompute weather whenever check-in date changes
document.getElementById('check-in').addEventListener('change', updateWeather);


// ═══════════════════════════════════════════
// SECTION 6 — LISTINGS
// Fetches data from Flask, filters in JS, sends sort/search to backend
// ═══════════════════════════════════════════

// Fetch the full dataset from Python backend
async function fetchListings() {
  try {
    const res = await fetch('/api/listings');
    if (!res.ok) return;
    allListings = await res.json();
    // Run initial binary search with full range so everything appears
    await runBinarySearch(0, 99999);
    renderListings();
    renderMapPins();
  } catch (err) {
    console.error('fetchListings error:', err);
  }
}

// Send a sort request to the Python QuickSort endpoint
async function runQuickSort() {
  try {
    const res = await fetch('/api/ds/sort', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ listings: allListings })
    });
    if (!res.ok) return;
    const data = await res.json();
    sortedListings = data.sortedListings || [];
    addLog('QuickSort by price executed on Python backend.');
    renderListings();
    renderMapPins();
  } catch (err) {
    addLog('QuickSort failed: ' + err.message);
  }
}

// Send a filter-by-budget request to the Python Binary Search endpoint
async function runBinarySearch(minVal, maxVal) {
  try {
    const res = await fetch('/api/ds/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ listings: allListings, min_budget: minVal, max_budget: maxVal })
    });
    if (!res.ok) return;
    const data = await res.json();
    sortedListings = data.filteredListings || [];
    addLog(`Binary Search filtered ₱${minVal}–₱${maxVal}: ${sortedListings.length} results.`);
  } catch (err) {
    addLog('Binary Search failed: ' + err.message);
  }
}

// Apply all current filters to the sorted/all listings and return matching items
function getFilteredListings() {
  const base = sortedListings.length > 0 ? sortedListings : allListings;
  return base.filter(p => {
    if (appliedFilters.bookingType !== 'All' && p.bookingType !== appliedFilters.bookingType) return false;
    if (appliedFilters.roomType   !== 'All' && p.roomType   !== appliedFilters.roomType)   return false;
    if (appliedFilters.propertyType !== 'All' && p.propertyType !== appliedFilters.propertyType) return false;
    if (appliedFilters.city !== 'All' && p.city.toLowerCase() !== appliedFilters.city.toLowerCase()) return false;
    if (p.price < appliedFilters.minPrice || p.price > appliedFilters.maxPrice) return false;
    if (appliedFilters.query) {
      const q = appliedFilters.query.toLowerCase();
      if (!p.property_name.toLowerCase().includes(q) && !p.city.toLowerCase().includes(q)) return false;
    }
    for (const am of appliedFilters.amenities) {
      if (!p.amenities.includes(am)) return false;
    }
    for (const ac of appliedFilters.accessibility) {
      if (!p.accessibility.includes(ac)) return false;
    }
    return true;
  });
}

// Render listing cards into the grid
function renderListings() {
  const grid = document.getElementById('listings-grid');
  const filtered = getFilteredListings();
  const shown    = filtered.slice(0, visibleCount);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="full-col empty-placeholder">
      <div class="empty-icon">🏕️</div>
      <h4 class="empty-title">No Results</h4>
      <p class="muted-text">Try adjusting filters or clicking Search Camps.</p>
    </div>`;
    document.getElementById('load-more-row').classList.add('hidden');
    return;
  }

  shown.forEach(p => {
    const card = document.createElement('div');
    card.className = 'listing-card';
    card.onclick = () => showMapPopup(p);

    // Build amenity and accessibility tag HTML
    const amTags = p.amenities.map(a => `<span class="tag-amenity">${a}</span>`).join('');
    const acTags = p.accessibility.map(a => `<span class="tag-access">♿ ${a}</span>`).join('');

    // Derived rating (makes listings feel unique without extra data)
    const rating = ((p.price % 10) / 5 + 3.2).toFixed(1);
    const reviews = ((p.price * 3) % 800) + 120;

    card.innerHTML = `
      <img src="${p.thumbnail}" alt="${p.property_name}" class="listing-img" loading="lazy" />
      <div class="listing-body">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">
          <div>
            <span class="listing-meta">${p.city} • ${p.propertyType}</span>
            <h4 class="listing-name">${p.property_name}</h4>
            <p class="listing-rating">★ ${rating} &nbsp;(${reviews} reviews)</p>
          </div>
          <span style="font-size:9px;padding:3px 8px;border-radius:999px;background:rgba(77,105,63,0.2);color:var(--green-glow);font-weight:700;white-space:nowrap;">${p.bookingType}</span>
        </div>
        <div class="tags-row">${amTags}${acTags}</div>
        <div class="listing-footer">
          <div>
            <span class="listing-room">${p.roomType}</span>
            <span class="listing-price">₱${p.price}/night</span>
          </div>
          <button class="btn-primary" style="font-size:11px;padding:7px 14px;"
            onclick="event.stopPropagation(); showMapPopup(${JSON.stringify(p).replace(/"/g, '&quot;')})">
            View Details
          </button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  // Load More button
  const loadMore = document.getElementById('load-more-row');
  if (filtered.length > visibleCount) {
    loadMore.classList.remove('hidden');
    document.getElementById('load-more-btn').textContent =
      `Load More Listings (${filtered.length - visibleCount} remaining)`;
  } else {
    loadMore.classList.add('hidden');
  }
}

// Load more listings (paginate)
document.getElementById('load-more-btn').addEventListener('click', () => {
  visibleCount += 40;
  renderListings();
});

// Search Camps button — applies all filters and runs binary search
document.getElementById('search-camps-btn').addEventListener('click', async () => {
  const minP = parseInt(document.getElementById('min-price').value) || 0;
  const maxP = parseInt(document.getElementById('max-price').value) || 99999;

  appliedFilters.bookingType   = document.getElementById('filter-booking-type').value;
  appliedFilters.roomType      = document.getElementById('filter-room-type').value;
  appliedFilters.propertyType  = document.getElementById('filter-property-type').value;
  appliedFilters.city          = document.getElementById('filter-city').value;
  appliedFilters.minPrice      = minP;
  appliedFilters.maxPrice      = maxP;
  appliedFilters.query         = document.getElementById('text-search').value;
  appliedFilters.amenities     = [...document.querySelectorAll('.amenity-cb:checked')].map(c => c.value);
  appliedFilters.accessibility = [...document.querySelectorAll('.access-cb:checked')].map(c => c.value);

  visibleCount = 40;
  addLog(`Searching: ${appliedFilters.city}, Budget ₱${minP}–₱${maxP}`);

  await runBinarySearch(minP, maxP);
  renderListings();
  renderMapPins();
  await sendTelemetry(appliedFilters.city, maxP, 0);
});

// Text search bar quick trigger
document.getElementById('text-search-btn').addEventListener('click', () => {
  appliedFilters.query = document.getElementById('text-search').value;
  visibleCount = 40;
  renderListings();
  renderMapPins();
});

// QuickSort button
document.getElementById('quicksort-btn').addEventListener('click', runQuickSort);

// Binary search button (manual trigger with current price inputs)
document.getElementById('bsearch-btn').addEventListener('click', async () => {
  const minP = parseInt(document.getElementById('min-price').value) || 0;
  const maxP = parseInt(document.getElementById('max-price').value) || 99999;
  await runBinarySearch(minP, maxP);
  renderListings();
  renderMapPins();
});

// Reset all filter controls
document.getElementById('reset-filters-btn').addEventListener('click', () => {
  document.getElementById('filter-booking-type').value  = 'All';
  document.getElementById('filter-room-type').value     = 'All';
  document.getElementById('filter-property-type').value = 'All';
  document.getElementById('filter-city').value          = 'All';
  document.getElementById('min-price').value  = '0';
  document.getElementById('max-price').value  = '99999';
  document.getElementById('min-range').value  = '0';
  document.getElementById('max-range').value  = '99999';
  document.querySelectorAll('.amenity-cb, .access-cb').forEach(cb => cb.checked = false);
  appliedFilters = { bookingType:'All', roomType:'All', propertyType:'All', city:'All',
                     amenities:[], accessibility:[], minPrice:0, maxPrice:99999, query:'' };
  addLog('Filters reset to default.');
  renderListings();
});

// Sync number inputs and range sliders together
['min', 'max'].forEach(prefix => {
  const numEl   = document.getElementById(prefix + '-price');
  const rangeEl = document.getElementById(prefix + '-range');
  numEl.addEventListener('input',   () => rangeEl.value = numEl.value);
  rangeEl.addEventListener('input', () => numEl.value = rangeEl.value);
});

// Guest counter buttons
document.querySelectorAll('.counter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    const dir    = parseInt(btn.dataset.dir);
    const map    = { adults: 'guestAdults', children: 'guestChildren', toddlers: 'guestToddlers', pets: 'guestPets' };
    const varName = map[target];
    if (target === 'adults') guestAdults   = Math.max(1, guestAdults + dir);
    if (target === 'children') guestChildren = Math.max(0, guestChildren + dir);
    if (target === 'toddlers') guestToddlers = Math.max(0, guestToddlers + dir);
    if (target === 'pets')    guestPets     = Math.max(0, guestPets + dir);
    document.getElementById('count-' + target).textContent =
      target === 'adults' ? guestAdults : target === 'children' ? guestChildren : target === 'toddlers' ? guestToddlers : guestPets;
  });
});


// ═══════════════════════════════════════════
// SECTION 7 — MAP
// SVG map with zoom, drag/pan, and property pins
// ═══════════════════════════════════════════

const mapContainer = document.getElementById('map-container');
const mapContent   = document.getElementById('map-content');

// Update the SVG transform based on current zoom and pan values
function applyMapTransform(animate) {
  const g = document.getElementById('map-transform-group');
  if (!g) return;
  g.style.transition = animate ? 'transform 0.2s ease-out' : 'none';
  g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomLevel})`);
}

// Build the base geography of the map (islands, grid)
function buildMapBase() {
  const svg = document.getElementById('map-svg');

  // Remove any previous dynamic group
  const old = document.getElementById('map-transform-group');
  if (old) old.remove();

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.id = 'map-transform-group';
  g.setAttribute('transform', `translate(${panX}, ${panY}) scale(${zoomLevel})`);

  if (zoomLevel === 1) {
    // World view — simplified continent shapes
    g.innerHTML = `
      <rect x="-100" y="-100" width="1000" height="800" fill="#0c110a"/>
      <path d="M 50,120 L 140,90 L 210,160 L 170,240 L 110,230 Z" fill="#20331e" stroke="#2d452a" stroke-width="1"/>
      <path d="M 170,240 L 210,290 L 190,410 L 160,440 Z" fill="#20331e" stroke="#2d452a" stroke-width="1"/>
      <path d="M 290,100 L 590,80 L 680,190 L 640,360 L 480,390 L 390,290 L 310,300 Z" fill="#20331e" stroke="#2d452a" stroke-width="1"/>
      <path d="M 590,390 L 660,400 L 650,470 L 580,450 Z" fill="#20331e" stroke="#2d452a" stroke-width="1"/>
      <g transform="translate(490,275)">
        <circle cx="0" cy="0" r="6" fill="#e07a5f" stroke="#ecf0e5" stroke-width="1.5"/>
        <text x="0" y="24" fill="#e07a5f" font-size="9" font-weight="bold" text-anchor="middle">Philippines 🇵🇭</text>
      </g>
      <text x="400" y="550" fill="#a4a99d" font-size="12" text-anchor="middle">World View — Zoom in to see Philippine campgrounds</text>
    `;
  } else {
    // Philippines detailed view — island shapes
    g.innerHTML = `
      <rect x="-1600" y="-1200" width="4800" height="3600" fill="url(#forestGrid)"/>
      <path d="M 360,60 Q 400,80 425,120 T 405,250 Q 330,270 315,210 T 360,60 Z" fill="#1b2e18" stroke="#314e2c" stroke-width="1.5"/>
      <text x="365" y="140" fill="#a4a99d" font-size="10" font-weight="bold" opacity="0.25">LUZON</text>
      <path d="M 380,290 Q 440,300 465,350 T 415,390 Q 370,350 380,290 Z" fill="#1b2e18" stroke="#314e2c" stroke-width="1.5"/>
      <text x="425" y="340" fill="#a4a99d" font-size="9" opacity="0.25">VISAYAS</text>
      <path d="M 420,410 Q 510,420 495,510 T 375,470 Q 380,430 420,410 Z" fill="#1b2e18" stroke="#314e2c" stroke-width="1.5"/>
      <text x="440" y="465" fill="#a4a99d" font-size="10" opacity="0.25">MINDANAO</text>
      <path d="M 170,285 Q 210,315 250,365 L 240,375 L 160,295 Z" fill="#1b2e18" stroke="#314e2c" stroke-width="1.5"/>
      <circle cx="580" cy="220" r="45" fill="url(#lakeGradient)"/>
      <text x="320" y="110" font-size="12" opacity="0.25">🌲</text>
      <text x="390" y="170" font-size="14" opacity="0.2">🌲</text>
      <text x="450" y="310" font-size="12" opacity="0.25">🌲</text>
    `;
  }

  svg.appendChild(g);
  renderMapPins();
}

// Draw property pins on the map (capped at 100 for performance)
function renderMapPins() {
  // Remove existing pins group
  const existing = document.getElementById('map-pins-group');
  if (existing) existing.remove();

  if (zoomLevel === 1) return; // Don't draw pins in world view

  const g = document.getElementById('map-transform-group');
  if (!g) return;

  const filtered = getFilteredListings();
  const toShow   = filtered.slice(0, 100); // 100-pin cap keeps map smooth

  const pinsGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  pinsGroup.id = 'map-pins-group';

  toShow.forEach(p => {
    const px = (p.x || 50) * 8;
    const py = (p.y || 50) * 6;
    const isActive = popupProperty?.id === p.id;

    const pin = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    pin.setAttribute('transform', `translate(${px}, ${py})`);
    pin.style.cursor = 'pointer';

    pin.innerHTML = `
      <path d="M 0,0 C -7,-7 -11,-15 -11,-22 C -11,-30 -6,-36 0,-36 C 6,-36 11,-30 11,-22 C 11,-15 7,-7 0,0 Z"
        fill="${isActive ? '#e07a5f' : '#4d693f'}" stroke="#ecf0e5" stroke-width="1.5"/>
      <circle cx="0" cy="-22" r="3.5" fill="white"/>
      <text x="0" y="12" fill="#ecf0e5" font-size="7" font-weight="bold" text-anchor="middle"
        style="pointer-events:none;user-select:none;">
        ${p.property_name.split(' ')[0]}
      </text>
    `;
    pin.addEventListener('click', e => {
      e.stopPropagation();
      showMapPopup(p);
    });

    pinsGroup.appendChild(pin);
  });

  g.appendChild(pinsGroup);

  // Update the map status badge
  document.getElementById('map-status').textContent =
    `Philippines 🇵🇭 • ${Math.min(toShow.length, filtered.length)} / ${filtered.length} shown`;
}

// Show a property detail popup overlaid on the map
async function showMapPopup(property) {
  popupProperty = property;
  renderMapPins(); // re-render to highlight active pin

  document.getElementById('popup-img').src    = property.thumbnail;
  document.getElementById('popup-loc').textContent   = `${property.city} • ${property.propertyType}`;
  document.getElementById('popup-name').textContent  = property.property_name;
  document.getElementById('popup-price').textContent = `₱${property.price}/night`;
  document.getElementById('popup-pitch').textContent = 'Fetching travel tip...';
  document.getElementById('map-popup').classList.remove('hidden');

  // Fetch a pitch from the Flask backend
  try {
    const res = await fetch('/api/generate-pitch', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ name: property.property_name, city: property.city, price: property.price })
    });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('popup-pitch').textContent = data.pitch;
    }
  } catch (e) {
    document.getElementById('popup-pitch').textContent = `${property.property_name} — great pick in ${property.city}!`;
  }

  // Wire up the Book Now button in the popup
  document.getElementById('popup-book').onclick = () => {
    bookProperty(property);
    document.getElementById('map-popup').classList.add('hidden');
    popupProperty = null;
  };
}

// Close the map popup
document.getElementById('popup-close').addEventListener('click', () => {
  document.getElementById('map-popup').classList.add('hidden');
  popupProperty = null;
  renderMapPins();
});

// Zoom buttons
document.getElementById('zoom-in-btn').addEventListener('click',  () => {
  zoomLevel = Math.min(5, zoomLevel + 1);
  buildMapBase();
});
document.getElementById('zoom-out-btn').addEventListener('click', () => {
  zoomLevel = Math.max(1, zoomLevel - 1);
  if (zoomLevel === 1) { panX = 0; panY = 0; }
  buildMapBase();
});

// Drag to pan the map
mapContainer.addEventListener('mousedown', e => {
  isDragging = true;
  dragStartX = e.clientX - panX;
  dragStartY = e.clientY - panY;
});
mapContainer.addEventListener('mousemove', e => {
  if (!isDragging) return;
  panX = e.clientX - dragStartX;
  panY = e.clientY - dragStartY;
  applyMapTransform(false);
});
mapContainer.addEventListener('mouseup',   () => isDragging = false);
mapContainer.addEventListener('mouseleave',() => isDragging = false);


// ═══════════════════════════════════════════
// SECTION 8 — BOOKINGS
// Save bookings to localStorage; show active and past lists
// ═══════════════════════════════════════════

function loadBookings() {
  const saved = localStorage.getItem('stackit_bookings');
  if (saved) {
    try { bookings = JSON.parse(saved); return; } catch (e) {}
  }
  // Default sample bookings so the History tab isn't empty on first run
  bookings = [
    {
      id: 'mock_b1', propertyName: 'Serene Baguio City Vista #1', city: 'Baguio City',
      price: 3200, checkIn: '2026-05-10', checkOut: '2026-05-15', guests: 2,
      status: 'completed', bookedAt: '2026-05-09 14:30', profileId: '1',
      thumbnail: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800'
    },
    {
      id: 'mock_b2', propertyName: 'Grand Boracay Island Haven #5', city: 'Boracay Island',
      price: 5400, checkIn: '2026-04-12', checkOut: '2026-04-18', guests: 2,
      status: 'completed', bookedAt: '2026-04-11 09:15', profileId: '2',
      thumbnail: 'https://images.unsplash.com/photo-1439066615861-d1af74d74000?w=800'
    },
    {
      id: 'mock_b3', propertyName: 'Cozy Camiguin Retreat #9', city: 'Camiguin',
      price: 2800, checkIn: '2026-03-01', checkOut: '2026-03-05', guests: 1,
      status: 'completed', bookedAt: '2026-02-28 17:45', profileId: '3',
      thumbnail: 'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800'
    }
  ];
  localStorage.setItem('stackit_bookings', JSON.stringify(bookings));
}

function saveBookings() {
  localStorage.setItem('stackit_bookings', JSON.stringify(bookings));
}

// Add a new booking from a property or deal object
function bookProperty(property) {
  const checkIn  = document.getElementById('check-in').value  || '2026-06-15';
  const checkOut = document.getElementById('check-out').value || '2026-06-20';
  const guests   = guestAdults + guestChildren + guestToddlers;

  const newBooking = {
    id:           'booking_' + Date.now(),
    propertyName: property.property_name || property.name,
    city:         property.city || property.destination_city,
    price:        property.deal_price || property.price,
    checkIn:      checkIn,
    checkOut:     checkOut,
    guests:       guests,
    status:       'active',
    bookedAt:     new Date().toLocaleString(),
    thumbnail:    property.thumbnail,
    profileId:    activeProfile?.id || 'default'
  };

  bookings.unshift(newBooking);
  saveBookings();
  addLog('Booked: ' + newBooking.propertyName);
  alert(`Booking confirmed for ${newBooking.propertyName}!\nCheck "My Bookings & History" tab to see it.`);
}

// Render active and past booking lists on the Reservations tab
function renderBookings() {
  const pid = activeProfile?.id || 'default';

  const active = bookings.filter(b => b.profileId === pid && b.status === 'active');
  const past   = bookings.filter(b => b.profileId === pid && b.status === 'completed');

  renderBookingList('active-bookings-list', active, true);
  renderBookingList('past-bookings-list',   past,   false);

  // State trace info
  document.getElementById('booking-trace').innerHTML = `
    <div class="log-entry">[TRACE] Profile: ${pid} | Active: ${active.length} | Completed: ${past.length}</div>
    <div class="log-entry">[TRACE] localStorage size: ${(localStorage.getItem('stackit_bookings') || '').length} bytes</div>
  `;
}

function renderBookingList(containerId, list, isActive) {
  const el = document.getElementById(containerId);
  el.innerHTML = '';

  if (list.length === 0) {
    el.innerHTML = `<div class="empty-placeholder">
      <p class="muted-text italic">${isActive ? 'No active bookings. Visit Booking & Discovery to reserve a place!' : 'No past trips for this profile yet.'}</p>
    </div>`;
    return;
  }

  list.forEach(b => {
    const card = document.createElement('div');
    card.className = 'booking-card' + (isActive ? '' : ' past');
    card.innerHTML = `
      <img src="${b.thumbnail}" alt="${b.propertyName}" class="booking-img" />
      <div class="booking-info">
        <span class="booking-city">${b.city}</span>
        <h4 class="booking-name">${b.propertyName}</h4>
        <p class="booking-dates">📅 ${b.checkIn} → ${b.checkOut}${!isActive ? ' (Completed)' : ''}</p>
        <div class="booking-footer">
          <span class="listing-price">₱${b.price}/night</span>
          <span class="muted-text" style="font-size:10px;">Guests: ${b.guests}</span>
        </div>
      </div>
      ${isActive ? `<button class="cancel-btn" data-id="${b.id}" title="Cancel">✕</button>` : ''}
    `;
    // Cancel button handler for active bookings
    if (isActive) {
      card.querySelector('.cancel-btn').addEventListener('click', () => {
        if (confirm(`Cancel reservation for ${b.propertyName}?`)) {
          bookings = bookings.filter(x => x.id !== b.id);
          saveBookings();
          addLog('Cancelled: ' + b.propertyName);
          renderBookings();
          alert('Reservation cancelled.');
        }
      });
    }
    el.appendChild(card);
  });
}

// Book deal button wired up after a deal is shown
document.getElementById('book-deal-btn').addEventListener('click', () => {
  if (activeDeal) bookProperty(activeDeal);
});
document.getElementById('deal-modal-book').addEventListener('click', () => {
  if (activeDeal) {
    bookProperty(activeDeal);
    document.getElementById('deal-modal').classList.add('hidden');
  }
});
document.getElementById('deal-modal-close').addEventListener('click', () => {
  document.getElementById('deal-modal').classList.add('hidden');
});


// ═══════════════════════════════════════════
// SECTION 9 — SPREADSHEET
// 100-row editable grid with formula bar support
// ═══════════════════════════════════════════

// Build the 100-row spreadsheet table body
function buildSpreadsheet() {
  const tbody = document.getElementById('sheet-body');
  tbody.innerHTML = '';
  for (let r = 1; r <= 100; r++) {
    const tr = document.createElement('tr');
    tr.className = 'sheet-row';

    // Row number cell
    const th = document.createElement('td');
    th.className = 'row-num-cell';
    th.textContent = r;
    tr.appendChild(th);

    // 6 data columns: A–F
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach(col => {
      const td = document.createElement('td');
      td.className = 'sheet-cell';
      td.dataset.row = r;
      td.dataset.col = col;

      const input = document.createElement('input');
      input.type      = 'text';
      input.className = 'cell-input';
      input.value     = gridData[col + r] || '';

      // When a cell gains focus, update the formula bar
      input.addEventListener('focus', () => {
        selectedCell = { row: r, col };
        document.getElementById('cell-address').textContent = col + r;
        document.getElementById('formula-input').value   = input.value;
        document.getElementById('formula-input').disabled  = false;
        document.getElementById('apply-formula-btn').disabled = false;

        // Highlight active cell
        document.querySelectorAll('.sheet-cell').forEach(c => c.classList.remove('selected'));
        td.classList.add('selected');
      });

      // Sync cell changes back to gridData
      input.addEventListener('input', () => {
        gridData[col + r] = input.value;
        if (selectedCell?.row === r && selectedCell?.col === col) {
          document.getElementById('formula-input').value = input.value;
        }
      });

      td.appendChild(input);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  }
}

// Apply formula bar value to the selected cell
document.getElementById('apply-formula-btn').addEventListener('click', () => {
  if (!selectedCell) return;
  const val = document.getElementById('formula-input').value;
  gridData[selectedCell.col + selectedCell.row] = val;
  // Find the matching input in the grid and update it
  const td = document.querySelector(`.sheet-cell[data-row="${selectedCell.row}"][data-col="${selectedCell.col}"]`);
  if (td) td.querySelector('input').value = val;
});

// Also apply on Enter key in formula bar
document.getElementById('formula-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('apply-formula-btn').click();
});

// Switch between Spreadsheet view and SLL grouped view
document.getElementById('view-spreadsheet-btn').addEventListener('click', () => {
  document.getElementById('spreadsheet-view').classList.remove('hidden');
  document.getElementById('formula-bar').classList.remove('hidden');
  document.getElementById('sll-view').classList.add('hidden');
  document.getElementById('view-spreadsheet-btn').classList.add('active');
  document.getElementById('view-sll-btn').classList.remove('active');
});

document.getElementById('view-sll-btn').addEventListener('click', async () => {
  document.getElementById('spreadsheet-view').classList.add('hidden');
  document.getElementById('formula-bar').classList.add('hidden');
  document.getElementById('sll-view').classList.remove('hidden');
  document.getElementById('view-sll-btn').classList.add('active');
  document.getElementById('view-spreadsheet-btn').classList.remove('active');
  await categorizeSLLNotes();
});

// Clear the spreadsheet and start a fresh file
document.getElementById('clear-sheet-btn').addEventListener('click', async () => {
  if (!confirm('Clear the sheet and start a new blank itinerary?')) return;
  gridData = {};
  currentFileId   = null;
  currentFileName = '';
  buildSpreadsheet();
  updateFileLabel();
  await fetch('/api/ds/notes', { method: 'DELETE' });
  await fetchSLLNotes();
  addLog('Sheet cleared. New blank itinerary started.');
});


// ═══════════════════════════════════════════
// SECTION 10 — LINKED LIST (SLL) NOTES
// Notes are stored on the Flask backend in a manual linked list
// ═══════════════════════════════════════════

// Fetch all notes from the backend linked list
async function fetchSLLNotes() {
  try {
    const res = await fetch('/api/ds/notes');
    if (!res.ok) return;
    const data = await res.json();
    notesList = data.notes || [];
    renderSLLNodes();
  } catch (e) {
    addLog('Could not fetch SLL notes: ' + e.message);
  }
}

// Render linked list node cards
function renderSLLNodes() {
  const container = document.getElementById('sll-nodes-grid');
  const emptyMsg  = document.getElementById('sll-empty-msg');

  if (notesList.length === 0) {
    container.innerHTML = '';
    emptyMsg.classList.remove('hidden');
    return;
  }
  emptyMsg.classList.add('hidden');
  container.innerHTML = '';

  notesList.forEach((node, i) => {
    const card = document.createElement('div');
    card.className = 'node-card';
    card.innerHTML = `
      <div class="node-number">Node #${i + 1}</div>
      <div class="node-id">ID: ${node.id}</div>
      <div>
        <span class="node-field-label">Plan / Item</span>
        <span class="node-field-val">${node.content}</span>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px;">
        <div>
          <span class="node-field-label">Category</span>
          <span style="font-size:11px;color:var(--text-primary);">${node.category}</span>
        </div>
        <div>
          <span class="node-field-label">Companions</span>
          <span style="font-size:11px;color:var(--text-primary);">${node.companions}</span>
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);margin-top:10px;padding-top:8px;">
        <div>
          <span class="node-field-label">Budget</span>
          <span style="font-size:12px;font-family:var(--font-mono);color:var(--orange);">₱${node.budget}</span>
        </div>
        <button class="btn-danger-sm delete-node-btn" data-id="${node.id}">Delete Node</button>
      </div>
    `;
    container.appendChild(card);
  });

  // Wire up delete buttons
  document.querySelectorAll('.delete-node-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await fetch('/api/ds/notes/' + btn.dataset.id, { method: 'DELETE' });
      addLog('Deleted node: ' + btn.dataset.id);
      await fetchSLLNotes();
    });
  });
}

// Call the backend categorizer (which uses the linked list without dict lookups)
async function categorizeSLLNotes() {
  try {
    const res = await fetch('/api/ds/categorize', { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json();
    const grouped = data.categorized || [];
    const output  = document.getElementById('sll-grouped-output');
    output.innerHTML = '';

    if (grouped.length === 0) {
      output.innerHTML = '<p class="muted-text italic">No notes yet. Save an itinerary to populate the linked list.</p>';
      return;
    }
    grouped.forEach(group => {
      const div = document.createElement('div');
      div.style.marginBottom = '16px';
      div.innerHTML = `
        <span class="tag-orange">📂 ${group.category}</span>
        <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;">
          ${group.items.map(item => `
            <div style="display:flex;justify-content:space-between;align-items:center;
                        padding:10px 12px;border-radius:12px;background:var(--bg-card);
                        border:1px solid var(--border);font-size:11px;">
              <div>
                <span style="font-weight:700;color:var(--text-primary);">${item.content}</span>
                <span class="muted-text" style="display:block;font-size:10px;">Companions: ${item.companions}</span>
              </div>
              <span style="font-family:var(--font-mono);color:var(--orange);">₱${item.budget}</span>
            </div>
          `).join('')}
        </div>
      `;
      output.appendChild(div);
    });
    addLog('SLL notes categorized (no dictionary lookups used).');
  } catch (e) {
    addLog('Categorize failed: ' + e.message);
  }
}


// ═══════════════════════════════════════════
// SECTION 11 — ITINERARY FILES
// Save and load named spreadsheet files in localStorage
// ═══════════════════════════════════════════

function loadSavedFiles() {
  const saved = localStorage.getItem('stackit_saved_itineraries');
  if (saved) {
    try { savedFiles = JSON.parse(saved); } catch (e) { savedFiles = []; }
  }
}

function saveSavedFiles() {
  localStorage.setItem('stackit_saved_itineraries', JSON.stringify(savedFiles));
}

function updateFileLabel() {
  document.getElementById('file-id-badge').textContent   = currentFileId || 'UNSAVED DOCUMENT';
  document.getElementById('file-name-label').textContent = currentFileName
    ? 'Editing: ' + currentFileName
    : 'Editing: New Itinerary (Unsaved)';
}

function renderSavedFilesList() {
  const container = document.getElementById('saved-files-list');
  container.innerHTML = '';

  if (savedFiles.length === 0) {
    container.innerHTML = '<p class="muted-text italic">No saved files yet.</p>';
    return;
  }

  savedFiles.forEach(file => {
    // Count how many rows have any data
    let rowCount = 0;
    for (let r = 1; r <= 100; r++) {
      if (['A','B','C','D','E','F'].some(c => (file.gridData[c + r] || '').trim())) rowCount++;
    }
    const isActive = file.id === currentFileId;
    const item = document.createElement('div');
    item.className = 'saved-file-item' + (isActive ? ' active-file' : '');
    item.innerHTML = `
      ${isActive ? '<div class="active-file-badge">Active</div>' : ''}
      <span style="font-size:12px;font-weight:700;color:var(--text-primary);display:block;">${file.name}</span>
      <span class="muted-text" style="font-size:9px;">Saved: ${file.savedAt}</span>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px solid var(--border);">
        <span class="file-row-count">📄 ${rowCount} row(s)</span>
        <div style="display:flex;gap:6px;">
          <button class="btn-secondary load-file-btn" style="font-size:10px;padding:4px 8px;" data-id="${file.id}">Load</button>
          <button class="btn-danger-sm del-file-btn" style="font-size:10px;padding:4px 8px;" data-id="${file.id}">✕</button>
        </div>
      </div>
    `;
    container.appendChild(item);
  });

  // Load file button
  document.querySelectorAll('.load-file-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const file = savedFiles.find(f => f.id === btn.dataset.id);
      if (!file) return;
      gridData        = { ...file.gridData };
      currentFileId   = file.id;
      currentFileName = file.name;
      buildSpreadsheet();
      updateFileLabel();
      renderSavedFilesList();
      // Sync the loaded grid rows to the backend linked list
      await syncGridToSLL(file.gridData);
      addLog('Loaded itinerary: ' + file.name);
    });
  });

  // Delete file button
  document.querySelectorAll('.del-file-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this saved itinerary file?')) return;
      savedFiles = savedFiles.filter(f => f.id !== btn.dataset.id);
      if (currentFileId === btn.dataset.id) {
        currentFileId   = null;
        currentFileName = '';
        updateFileLabel();
      }
      saveSavedFiles();
      renderSavedFilesList();
      addLog('Deleted saved file: ' + btn.dataset.id);
    });
  });
}

// Open save modal
document.getElementById('save-itinerary-btn').addEventListener('click', () => {
  document.getElementById('save-modal-name').value = currentFileName || 'My Itinerary';
  document.getElementById('save-modal').classList.remove('hidden');
  setTimeout(() => document.getElementById('save-modal-name').focus(), 50);
});
document.getElementById('save-modal-cancel').addEventListener('click', () => {
  document.getElementById('save-modal').classList.add('hidden');
});

// Confirm save
document.getElementById('save-modal-confirm').addEventListener('click', async () => {
  const name = document.getElementById('save-modal-name').value.trim();
  if (!name) { alert('Please enter a filename.'); return; }

  const isUpdate = currentFileId && savedFiles.some(f => f.id === currentFileId);
  const fileId   = isUpdate ? currentFileId : 'file_' + Date.now();

  const fileObj = {
    id:       fileId,
    name:     name,
    gridData: { ...gridData },
    savedAt:  new Date().toLocaleString()
  };

  if (isUpdate) {
    savedFiles = savedFiles.map(f => f.id === fileId ? fileObj : f);
  } else {
    savedFiles.push(fileObj);
  }

  saveSavedFiles();
  currentFileId   = fileId;
  currentFileName = name;
  updateFileLabel();
  renderSavedFilesList();
  document.getElementById('save-modal').classList.add('hidden');

  // Sync rows to backend linked list
  addLog('Saving itinerary: ' + name);
  await syncGridToSLL(gridData);
  await fetchSLLNotes();
  addLog('Itinerary "' + name + '" saved and synced to linked list.');
  alert('Itinerary "' + name + '" saved!');
});

// Allow Enter key in save modal
document.getElementById('save-modal-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('save-modal-confirm').click();
});

// Send all non-empty grid rows to the backend linked list
async function syncGridToSLL(data) {
  await fetch('/api/ds/notes', { method: 'DELETE' });
  for (let r = 1; r <= 100; r++) {
    const a = (data['A' + r] || '').trim();
    const b = (data['B' + r] || '').trim();
    const c = (data['C' + r] || '').trim();
    const d = (data['D' + r] || '').trim();
    const e = (data['E' + r] || '').trim();
    const f = (data['F' + r] || '').trim();
    if (a || b || c || d || e || f) {
      await fetch('/api/ds/notes', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          content:    a || 'Untitled',
          category:   b || 'General',
          companions: c || 'None',
          budget:     Number(d) || 0
        })
      });
    }
  }
}


// ═══════════════════════════════════════════
// SECTION 12 — TELEMETRY & DEALS
// Tracks search events and triggers concierge deals
// ═══════════════════════════════════════════

async function sendTelemetry(city, budget, clicks) {
  try {
    const res = await fetch('/track-search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        timestamp:        new Date().toISOString(),
        destination_city: city,
        guest_count:      guestAdults + guestChildren + guestToddlers,
        target_budget:    budget,
        property_clicks:  clicks
      })
    });
    const data = await res.json();
    addLog(`Telemetry sent: ${city}, ₱${budget}`);
    if (data.dealTriggered && data.deal) {
      activeDeal = data.deal;
      addLog('Concierge deal triggered: ' + data.deal.property_name);
      showDealModal(data.deal);
      updateDealCard();
    }
  } catch (e) {
    console.error('Telemetry error:', e);
  }
}

// Show the deal popup modal
function showDealModal(deal) {
  document.getElementById('deal-modal-name').textContent    = deal.property_name;
  document.getElementById('deal-modal-pitch').textContent   = deal.concierge_pitch;
  document.getElementById('deal-modal-original').textContent = `₱${deal.original_price}`;
  document.getElementById('deal-modal-price').textContent   = `₱${deal.deal_price} / night`;
  document.getElementById('deal-modal').classList.remove('hidden');
}

// Update the deal card on the Dashboard tab
function updateDealCard() {
  const card        = document.getElementById('deal-card');
  const placeholder = document.getElementById('no-deal-placeholder');

  if (!activeDeal) {
    card.classList.add('hidden');
    placeholder.classList.remove('hidden');
    return;
  }
  placeholder.classList.add('hidden');
  card.classList.remove('hidden');

  document.getElementById('deal-thumb').src              = activeDeal.thumbnail;
  document.getElementById('deal-name').textContent       = activeDeal.property_name;
  document.getElementById('deal-pitch').textContent      = `"${activeDeal.concierge_pitch}"`;
  document.getElementById('deal-original').textContent   = `₱${activeDeal.original_price}`;
  document.getElementById('deal-price').textContent      = `₱${activeDeal.deal_price} / night`;
}

// Vibe check button — sends a quick telemetry event from the Dashboard
document.getElementById('vibe-btn').addEventListener('click', async () => {
  const text = document.getElementById('vibe-input').value.trim();
  if (!text) return;
  await sendTelemetry('All', 99999, 1);
  document.getElementById('vibe-input').value = '';
  addLog('Vibe check sent.');
});

// Reset DS state (server + localStorage data)
document.getElementById('reset-ds-btn').addEventListener('click', async () => {
  await fetch('/api/reset', { method: 'POST' });
  addLog('DS state reset on server.');
});


// ═══════════════════════════════════════════
// SECTION 13 — ACTIVITY LOG
// In-page console showing DS events with timestamps
// ═══════════════════════════════════════════

function addLog(message) {
  const time  = new Date().toLocaleTimeString();
  const entry = `[${time}] ${message}`;
  logEntries.unshift(entry);
  if (logEntries.length > 100) logEntries.pop();

  const logEl = document.getElementById('activity-log');
  if (!logEl) return;
  logEl.innerHTML = logEntries.map(l => `<div class="log-entry">${l}</div>`).join('');
}


// ═══════════════════════════════════════════
// SECTION 14 — INIT
// Called after login to set up the whole app
// ═══════════════════════════════════════════

function initApp() {
  renderProfileSwitcher();
  loadBookings();
  loadSavedFiles();
  buildSpreadsheet();
  updateFileLabel();
  renderSavedFilesList();
  buildMapBase();
  updateWeather();
  fetchListings();
  fetchSLLNotes();
  updateDealCard();
  addLog('App initialized. Welcome, ' + (activeProfile?.name || 'Guest') + '!');
}

// On page load: restore login state from localStorage, or show login screen
window.addEventListener('DOMContentLoaded', () => {
  loadProfiles();
  renderLoginProfiles();

  const isLoggedIn   = localStorage.getItem('stackit_is_logged_in') === 'true';
  const savedProfile = localStorage.getItem('stackit_active_profile');

  if (isLoggedIn && savedProfile) {
    try {
      activeProfile = JSON.parse(savedProfile);
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      initApp();
    } catch (e) {
      // If stored session is corrupted, fall back to login screen
      localStorage.removeItem('stackit_is_logged_in');
    }
  }
});
