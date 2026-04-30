import { getCurrentUserId } from './auth.js';

let currentTripData = {};
let allSavedTrips = []; // Track all fetched trips for dashboard interaction


// ----------------------------------------------------------------
// COST ANALYSIS HEURISTICS
// ----------------------------------------------------------------
const COST_INDEX_MAP = {
    'paris': 2.5, 'london': 2.5, 'tokyo': 2.5, 'nyc': 2.8, 'new york': 2.8, 'zurich': 3.0, 'geneva': 3.0, 
    'singapore': 2.2, 'dubai': 2.0, 'hong kong': 2.2, 'venice': 2.3, 'rome': 1.8, 'milan': 1.9, 'sthlm': 2.1,
    'mumbai': 1.2, 'delhi': 1.2, 'bangalore': 1.1, 'hyderabad': 1.0, 'goa': 1.1, 'pune': 1.0,
    'istanbul': 1.3, 'capetown': 1.4, 'mexico city': 1.3, 'phuket': 1.0,
    'bali': 0.7, 'bangkok': 0.8, 'hanoi': 0.6, 'ho chi minh': 0.6, 'vienna': 1.5, 'kolkata': 0.7, 
    'kathmandu': 0.5, 'pokhara': 0.5, 'jaipur': 0.8, 'rishikesh': 0.7
};

function getHeuristicBudget(dests, totalBudget, daysPerCity) {
    let totalWeightedDays = 0;
    const weights = daysPerCity.map(d => {
        const cityLower = d.city.toLowerCase();
        let weight = 1.0; 
        for(const [key, val] of Object.entries(COST_INDEX_MAP)) {
            if (cityLower.includes(key)) { weight = val; break; }
        }
        const wDays = d.days * weight;
        totalWeightedDays += wDays;
        return { city: d.city, weight, wDays };
    });

    const result = {};
    weights.forEach(w => {
        result[w.city] = {
            allocation: Math.round((w.wDays / (totalWeightedDays || 1)) * totalBudget),
            reasoning: `Cost-index adjusted analysis (${w.weight > 1.2 ? 'High tier' : w.weight < 0.9 ? 'Budget tier' : 'Moderate tier'})`
        };
    });
    return result;
}

// ----------------------------------------------------------------
// UTILITY
// ----------------------------------------------------------------
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}

function debounce(func, timeout = 500) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

// ----------------------------------------------------------------
// SIDEBAR NAVIGATION
// ----------------------------------------------------------------
const viewHeadings = { dashboard: 'Dashboard', 'new-plan': 'New Plan', account: 'Account' };

function switchView(viewName) {
    // Hide all views
    document.querySelectorAll('.app-view').forEach(v => {
        v.style.display = 'none';
        v.classList.remove('active-view');
    });
    // Show target
    const target = document.getElementById(`view-${viewName}`);
    if (target) {
        target.style.display = 'flex';
        target.classList.add('active-view');
    }
    // Update sidebar active state
    document.querySelectorAll('.nav-item[data-view]').forEach(a => {
        a.classList.toggle('active', a.dataset.view === viewName);
    });
    // Update header
    const heading = document.getElementById('viewHeading');
    if (heading) heading.textContent = viewHeadings[viewName] || '';

    // Trigger view-specific actions
    if (viewName === 'dashboard') loadSavedTrips();
    if (viewName === 'new-plan') {
        document.querySelectorAll('.dashboard-content, .cta-area').forEach(d => d.style.display = '');
        document.getElementById('analysis-section').style.display = 'none';
        document.getElementById('itinerary-section').style.display = 'none';
    }
    if (viewName === 'account') populateAccount();
}

document.querySelectorAll('.nav-item[data-view]').forEach(link => {
    link.addEventListener('click', e => {
        e.preventDefault();
        switchView(link.dataset.view);
    });
});

// "Plan New Trip" button on Dashboard
document.getElementById('goToNewPlan')?.addEventListener('click', () => switchView('new-plan'));

// ----------------------------------------------------------------
// DASHBOARD: Load Saved Trips (with Demo Fallback)
// ----------------------------------------------------------------
const SAMPLE_TRIPS = [
    {
        id: 'sample-1',
        input: { destinations: ['Paris', 'Lyon'], days: 7, budget: 150000, currentLocation: 'Mumbai' },
        totalEstimatedCost: 142500,
        savedAt: new Date().toISOString(),
        isDemo: true
    },
    {
        id: 'sample-2',
        input: { destinations: ['Tokyo', 'Kyoto', 'Osaka'], days: 10, budget: 250000, currentLocation: 'Delhi' },
        totalEstimatedCost: 238000,
        savedAt: new Date(Date.now() - 86400000).toISOString(),
        isDemo: true
    },
    {
        id: 'sample-3',
        input: { destinations: ['Bali', 'Ubud'], days: 5, budget: 85000, currentLocation: 'Bangalore' },
        totalEstimatedCost: 78500,
        savedAt: new Date(Date.now() - 172800000).toISOString(),
        isDemo: true
    }
];

async function loadSavedTrips() {
    const listEl = document.getElementById('savedTripsList');
    if (!listEl) return;

    const uid = getCurrentUserId();
    if (!uid) {
        listEl.innerHTML = '<div class="no-trips-msg"><i class="fas fa-lock"></i><h3>Not signed in</h3><p>Sign in to see your saved trips.</p></div>';
        return;
    }

    listEl.innerHTML = '<div class="trips-loading"><i class="fas fa-spinner fa-spin"></i><span>Loading your trips…</span></div>';

    let trips = [];
    let isDemoMode = false;

    try {
        const res = await fetch(`/api/trips/list?userId=${encodeURIComponent(uid)}`);
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error: ${res.status}`);
        }
        const data = await res.json();
        trips = data.trips || [];
    } catch (err) {
        console.warn('Dashboard connection blocked (Sync Issue). Falling back to Demo Mode:', err.message);
        trips = SAMPLE_TRIPS;
        isDemoMode = true;
    }

    allSavedTrips = trips; // Store for interaction


    if (trips.length === 0) {
        listEl.innerHTML = `
            <div class="no-trips-msg">
                <i class="fas fa-map-marked-alt"></i>
                <h3>No trips planned yet</h3>
                <p>Use "New Plan" to craft your first AI-powered itinerary!</p>
            </div>`;
        return;
    }

    listEl.innerHTML = trips.map(trip => {
        const input = trip.input || {};
        const dests = (input.destinations || []).join(', ') || 'Unknown';
        const days  = input.days || '?';
        const budget = input.budget ? `₹${Number(input.budget).toLocaleString('en-IN')}` : '—';
        const cost = trip.totalEstimatedCost ? `₹${Number(trip.totalEstimatedCost).toLocaleString('en-IN')}` : budget;
        const loc  = input.currentLocation || '';
        const savedAt = trip.savedAt ? new Date(trip.savedAt).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' }) : '';

        return `
            <div class="trip-card ${trip.isDemo ? 'demo-card' : ''}" onclick="openTrip('${trip.id}')">
                ${trip.isDemo ? '<div class="demo-badge">PREVIEW DATA</div>' : ''}
                <div class="trip-card-dest"><i class="fas fa-plane"></i> ${dests}</div>
                <div class="trip-card-meta">
                    <span class="trip-meta-pill"><i class="fas fa-calendar"></i> ${days} days</span>
                    ${loc ? `<span class="trip-meta-pill"><i class="fas fa-location-dot"></i> ${loc}</span>` : ''}
                    ${savedAt ? `<span class="trip-meta-pill"><i class="fas fa-clock"></i> ${savedAt}</span>` : ''}
                </div>
                <div class="trip-card-cost">Est. Cost: ${cost}</div>
            </div>`;

    }).join('');

    if (isDemoMode) {
        const demoInfo = document.createElement('div');
        demoInfo.className = 'demo-info-toast';
        demoInfo.innerHTML = '<i class="fas fa-info-circle"></i> Showing <b>Sample Data</b> (Cloud sync blocked by local clock).';
        listEl.prepend(demoInfo);
    }

    // Update trip count on Account tab
    try {
        const count = document.getElementById('accountTripCount');
        if (count) count.textContent = isDemoMode ? '0' : document.querySelectorAll('.trip-card').length;
    } catch (_) {}
}

/**
 * Opens a specific trip from the dashboard
 */
window.openTrip = function(tripId) {
    const trip = allSavedTrips.find(t => t.id === tripId);
    if (!trip) return;

    // Set as current trip
    currentTripData = trip;

    // Switch to new-plan view (which contains the itinerary section)
    switchView('new-plan');

    // Hide any existing form/analysis and render the itinerary
    setTimeout(() => {
        renderItinerary(trip);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
};


// ----------------------------------------------------------------
// ACCOUNT: Populate user information
// ----------------------------------------------------------------
function populateAccount() {
    const uid  = getCurrentUserId();
    const emailEl = document.getElementById('userEmailDisplay');
    const email = emailEl?.textContent || '—';

    const initial = email && email !== '—' ? email[0].toUpperCase() : 'U';
    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

    setEl('accountAvatar',    initial);
    setEl('accountName',      email.split('@')[0] || 'Traveler');
    setEl('accountEmail',     email);
    setEl('accountEmailFull', email);
    setEl('accountUID',       uid || '—');

    // Member since — pulled from auth if available
    const created = window.__userCreatedAt;
    setEl('accountCreated', created
        ? new Date(created).toLocaleDateString('en-IN', { day:'numeric', month:'long', year:'numeric' })
        : 'N/A');

    setEl('accountTripCount', document.querySelectorAll('.trip-card').length.toString() || '0');
}

// Account page logout button
document.getElementById('accountLogoutBtn')?.addEventListener('click', async () => {
    if (confirm('Are you sure you want to sign out?')) {
        const { signOut, getAuth } = await import("https://www.gstatic.com/firebasejs/10.9.0/firebase-auth.js");
        try { await signOut(getAuth()); } catch (e) { console.error(e); }
    }
});

// ----------------------------------------------------------------
// LOCATION BUTTON
// ----------------------------------------------------------------
document.getElementById('getLocationBtn')?.addEventListener('click', () => {
    const locInput = document.getElementById('currentLocation');
    if (!navigator.geolocation) { alert('Geolocation not supported'); return; }
    locInput.placeholder = 'Detecting location…';
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${coords.latitude}&lon=${coords.longitude}`);
            const data = await res.json();
            const city = data.address.city || data.address.town || data.address.village || data.address.county;
            locInput.value = city ? `${city}, ${data.address.country}` : `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        } catch {
            locInput.value = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        }
    }, () => {
        alert('Unable to retrieve location');
        locInput.placeholder = 'e.g. Mumbai, India';
    });
});

// ----------------------------------------------------------------
// ANALYZE BUTTON
// ----------------------------------------------------------------
document.getElementById('analyzeButton')?.addEventListener('click', async () => {
    const destinationsInput = document.getElementById('destinations').value;
    const destinations = destinationsInput.split(',').map(d => d.trim()).filter(d => d);
    const budget = document.getElementById('budget').value;
    const days   = document.getElementById('days').value;
    const currentLocation = document.getElementById('currentLocation').value;
    const tripType = document.querySelector('input[name="tripType"]:checked')?.value;
    const isInternationalRequested = tripType === 'true';
    const isMultiCityRequested     = tripType === 'multi';

    // Collect preferences
    const preferences = Array.from(document.querySelectorAll('.pref-tag.active')).map(tag => tag.dataset.pref);

    if (!destinations.length || !budget || days <= 0 || !currentLocation) {
        alert('Please fill in all required fields and ensure trip duration is greater than 0');
        return;
    }

    if (isMultiCityRequested && destinations.length < 2) { alert('Multi-city trip must have at least 2 destinations.'); return; }
    if (!isMultiCityRequested && destinations.length > 1) { alert('Please select "Multi-city" for multiple destinations.'); return; }

    const indianCities = ['mumbai','delhi','bangalore','hyd','chennai','kolkata','pune','goa','jaipur','lucknow','kanpur','nagpur','indore','thane','bhopal','visakhapatnam','patna','surat'];
    const hasIntlDest = destinations.some(d => {
        const dest = d.toLowerCase();
        return !indianCities.some(c => dest.includes(c)) && !dest.includes('india');
    });

    if (isInternationalRequested && !hasIntlDest) { alert('International trip must have at least one foreign destination.'); return; }
    if (!isInternationalRequested && tripType !== 'multi' && hasIntlDest) { alert('Domestic trip cannot have foreign destinations. Please select International.'); return; }

    // Multi-city Days Validation
    let daysPerCity = [];
    if (destinations.length > 1) {
        let sum = 0;
        document.querySelectorAll('.city-day-input').forEach(input => {
            const d = parseInt(input.value) || 0;
            sum += d;
            daysPerCity.push({ city: input.dataset.city, days: d });
        });
        if (sum !== parseInt(days)) {
            alert(`Total days must sum up to ${days}. Currently it's ${sum}.`);
            return;
        }
    }

    showLoading(true);
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const response = await fetch('/api/trips/analyze', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            signal: controller.signal,
            body: JSON.stringify({ 
                destinations, 
                budget, 
                days, 
                currentLocation, 
                isInternational: isInternationalRequested,
                daysPerCity: daysPerCity.length ? daysPerCity : null,
                preferences: preferences.length ? preferences : null
            }) 
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server ${response.status}`);
        }
        const data = await response.json();
        currentTripData = { 
            ...data, 
            input: { destinations, budget, days, currentLocation, daysPerCity, preferences },
            nearestAirport: data.nearestAirport,
            nearestStation: data.nearestStation
        };
        renderAnalysis(data);
    } catch (e) {
        if (e.name === 'AbortError') {
            alert('Analysis timed out. The server may be busy — please try again.');
        } else {
            alert('Analysis failed: ' + e.message);
        }
    }
    finally { showLoading(false); }
});

function renderAnalysis(data) {
    document.querySelectorAll('.dashboard-content, .cta-area').forEach(d => d.style.display = 'none');
    const section = document.getElementById('analysis-section');
    section.style.display = 'block';

    const hubsHtml = `
        <div style="margin-bottom:1.5rem;padding:1rem;background:rgba(255,255,255,0.03);border-radius:12px;border:1px solid var(--border);display:flex;gap:1.5rem;flex-wrap:wrap;">
            <div style="flex:1;min-width:200px;">
                <p style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:0.4rem;"><i class="fas fa-plane"></i> Nearest Major Airport</p>
                <div style="font-size:0.9rem;font-weight:600;color:var(--accent);">${data.nearestAirport || 'Searching...'}</div>
            </div>
            <div style="flex:1;min-width:200px;">
                <p style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:0.4rem;"><i class="fas fa-train"></i> Nearest Major Station</p>
                <div style="font-size:0.9rem;font-weight:600;color:var(--accent);">${data.nearestStation || 'Searching...'}</div>
            </div>
        </div>`;
    
    const message = document.getElementById('analysis-message');
    const breakdown = document.getElementById('breakdown-container');
    message.innerHTML = hubsHtml + (data.message || '');

    breakdown.innerHTML = data.cityBreakdown.map(city => {
        const local = city.localCurrency || { symbol: '₹', code: 'INR', rate: 1, amount: city.allocationINR || (typeof city.totalMin === 'number' ? city.totalMin : 0) };
        const symbol = local.symbol || (local.code + ' ');
        const amount = local.amount || (city.allocationINR || (typeof city.totalMin === 'number' ? city.totalMin : 0));

        return `
        <div style="background:rgba(255,255,255,0.05);padding:1.25rem;border-radius:16px;margin-bottom:1rem;border:1px solid ${data.feasible ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:1rem;">
                <h4 style="color:var(--primary);margin:0;">${city.city}</h4>
                <div style="text-align:right;">
                    <span style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Allocation</span>
                    <div style="font-weight:700;color:var(--accent);font-size:1.1rem;">${symbol}${amount.toLocaleString()} <span style="font-size:0.8rem;color:var(--text-muted);font-weight:400;">(${local.code})</span></div>
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem;opacity:0.8;">
                <div><small style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Flights</small><div style="font-weight:600;">${symbol}${(city.minFlights * (local.rate || 1)).toLocaleString()}</div></div>
                <div><small style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Hotels</small><div style="font-weight:600;">${symbol}${(city.minHotels * (local.rate || 1)).toLocaleString()}</div></div>
                <div><small style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);">Food/Local</small><div style="font-weight:600;">${symbol}${(city.minFood * (local.rate || 1)).toLocaleString()}</div></div>
            </div>
        </div>`;
    }).join('');

    const generateBtn = document.getElementById('generateButton');
    const suggContainer = document.getElementById('suggestion-container');
    const transportSection = document.getElementById('transport-details-section');

    if (data.feasible) {
        generateBtn.style.display = 'block';
        suggContainer.style.display = 'none';
        transportSection.style.display = 'block'; // Show transport form when feasible
    } else {
        generateBtn.style.display = 'none';
        suggContainer.style.display = 'block';
        transportSection.style.display = 'none';
        
        // Render selectable alternative cards
        const altCards = document.getElementById('alternative-cards');
        if (data.alternatives && data.alternatives.length > 0) {
            altCards.innerHTML = data.alternatives.map(alt => `
                <div class="card clickable-alt" data-city="${alt.city}" style="background:rgba(255,255,255,0.03);padding:1rem;cursor:pointer;border:1px solid var(--border);">
                    <h4 style="color:var(--accent);margin:0;">${alt.city}</h4>
                    <p style="font-size:0.75rem;margin-top:0.5rem;">${alt.reason}</p>
                    <div style="margin-top:0.75rem;font-size:0.7rem;text-transform:uppercase;color:var(--primary);">Select this instead <i class="fas fa-arrow-right"></i></div>
                </div>
            `).join('');
            
            // Add click listeners to alt cards
            document.querySelectorAll('.clickable-alt').forEach(card => {
                card.addEventListener('click', () => {
                    const city = card.dataset.city;

                    // 1. Fill in the destination field
                    const destField = document.getElementById('destinations');
                    if (destField) destField.value = city;

                    // 2. Auto-detect trip type and set the correct radio
                    const indianCities = ['mumbai','delhi','bangalore','hyd','chennai','kolkata','pune','goa','jaipur','lucknow','kanpur','nagpur','indore','thane','bhopal','visakhapatnam','patna','surat'];
                    const isIntl = !indianCities.some(c => city.toLowerCase().includes(c)) && !city.toLowerCase().includes('india');
                    const radioVal = isIntl ? 'true' : 'false';
                    const radio = document.querySelector(`input[name="tripType"][value="${radioVal}"]`);
                    if (radio) radio.checked = true;

                    // 3. Reset the frontend classify cache so fresh data is fetched for the new city
                    _lastClassifyKey = '';
                    _lastClassification = {};

                    // 4. Hide the analysis section and show the form again
                    const analysisSection = document.getElementById('analysis-section');
                    if (analysisSection) analysisSection.style.display = 'none';
                    document.querySelectorAll('.dashboard-content, .cta-area').forEach(el => el.style.display = '');

                    // 5. Run trip logic to refresh currency/budget panel
                    updateTripLogic();

                    // 6. Smooth scroll to the destination input so user sees it pre-filled
                    setTimeout(() => {
                        if (destField) {
                            destField.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            destField.focus();
                        }
                    }, 100);
                });
            });
        } else {
            altCards.innerHTML = '';
        }

        document.getElementById('suggestion-list').innerHTML = (data.suggestions || []).map(s =>
            `<li style="margin-bottom:0.4rem;">${s}</li>`
        ).join('');
    }
}

// ----------------------------------------------------------------
// GENERATE ITINERARY
// ----------------------------------------------------------------
document.getElementById('generateButton')?.addEventListener('click', async () => {
    const budgetInput = document.getElementById('budget');
    const budget = budgetInput ? parseInt(budgetInput.value) || 0 : 0;
    const days = document.getElementById('days').value;
    const currentLocation = document.getElementById('currentLocation').value;
    
    const transportDetails = {
        mode: document.getElementById('transportMode')?.value || 'flight',
        departureTime: document.getElementById('departureTime')?.value || '09:00',
        arrivalTime: document.getElementById('arrivalTime')?.value || '18:00'
    };

    const dests = document.getElementById('destinations').value.split(',').map(d => d.trim()).filter(d => d);
    const preferences = Array.from(document.querySelectorAll('.pref-tag.active')).map(t => t.dataset.pref);

    const isFlight = transportDetails.mode.toLowerCase().includes('flight');
    const homeHub = isFlight ? (currentTripData.nearestAirport || null) : (currentTripData.nearestStation || null);

    showLoading(true, "AI is crafting your time-aware itinerary...");
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45000);
        const response = await fetch('/api/trips/plan', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            signal: controller.signal,
            body: JSON.stringify({ 
                destinations: dests, 
                budget, 
                days, 
                currentLocation, 
                allocation: currentTripData.cityBreakdown.reduce((acc, c) => {
                    acc[c.city] = c.allocationINR || (typeof c.totalMin === 'number' ? c.totalMin : 0);
                    return acc;
                }, {}),
                transportDetails,
                preferences,
                homeHub
            }) 
        });
        clearTimeout(timeout);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${response.status}`);
        }
        const data = await response.json();
        currentTripData = { ...currentTripData, itinerary:data.days, totalEstimatedCost:data.totalEstimatedCost, weatherContext:data.weatherContext };
        renderItinerary(currentTripData);

        const uid = getCurrentUserId();
        if (uid) {
            try {
                await fetch('/api/trips/save', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ userId:uid, itineraryData:currentTripData }) });
                console.log('Itinerary auto-saved.');
            } catch (e) { console.error('Auto-save failed:', e); }
        }
    } catch (e) { alert('Itinerary generation failed:\n\n' + e.message); }
    finally { showLoading(false); }
});

// ----------------------------------------------------------------
// RESTART
// ----------------------------------------------------------------
document.getElementById('restartButton')?.addEventListener('click', () => location.reload());

// ----------------------------------------------------------------
// RENDER ITINERARY
// ----------------------------------------------------------------
function renderItinerary(data) {
    // Hide form elements and analysis section
    document.querySelectorAll('.dashboard-content, .cta-area').forEach(d => d.style.display = 'none');
    document.getElementById('analysis-section').style.display = 'none';
    
    const section = document.getElementById('itinerary-section');
    section.style.display = 'block';


    // ── Currency conversion setup ─────────────────────────────────
    // All internal costs are in INR (the user's input currency).
    // For international destinations, we convert & show local currency equivalent.
    let localCurrencyInfo = null; // { symbol, code, rate }
    try {
        const firstCity = (data.cityBreakdown || [])[0];
        if (firstCity?.localCurrency?.code && firstCity.localCurrency.code !== 'INR' && firstCity.localCurrency.rate) {
            localCurrencyInfo = {
                symbol: firstCity.localCurrency.symbol || (firstCity.localCurrency.code + ' '),
                code: firstCity.localCurrency.code,
                rate: firstCity.localCurrency.rate
            };
        }
    } catch (_) {}

    // ── Safe helpers ──────────────────────────────────────────────
    const fmt  = (n) => (typeof n === 'number' ? n.toLocaleString('en-IN') : '—');
    const fmtLocal = (n) => (typeof n === 'number' ? Math.round(n).toLocaleString() : '—');
    // Primary: always show INR. Secondary: show local currency equivalent if applicable.
    const cost = (n) => {
        if (typeof n !== 'number') return '₹—';
        const inrStr = `₹${fmt(n)}`;
        if (localCurrencyInfo && localCurrencyInfo.rate) {
            const localAmt = Math.round(n * localCurrencyInfo.rate);
            return `${inrStr} <span style="font-size:0.75em;color:var(--text-muted);">(≈ ${localCurrencyInfo.symbol}${fmtLocal(localAmt)})</span>`;
        }
        return inrStr;
    };

    // ── Weather banner ────────────────────────────────────────────
    let weatherHtml = '';
    if (data.weatherContext && Object.keys(data.weatherContext).length > 0) {
        weatherHtml = `
        <div style="margin:1rem 0;padding:1rem;background:rgba(16,185,129,0.1);border-radius:12px;border:1px solid rgba(16,185,129,0.2);">
            <h4 style="color:var(--accent);margin-bottom:0.5rem;font-size:0.9rem;text-transform:uppercase;letter-spacing:1px;">
                <i class="fas fa-cloud-sun" style="margin-right:6px;"></i>Live Weather Context
            </h4>
            <div style="display:flex;flex-wrap:wrap;gap:0.75rem;">
                ${Object.entries(data.weatherContext).map(([city, w]) => `
                    <div style="background:rgba(255,255,255,0.05);padding:0.5rem 1rem;border-radius:8px;font-size:0.85rem;">
                        <strong>${city}:</strong> ${w?.temp ?? '—'}°C, ${w?.condition ?? '—'}
                    </div>`).join('')}
            </div>
        </div>`;
    }

    // ── Days HTML ─────────────────────────────────────────────────
    const itinerary = data.itinerary || [];
    const blockIcons = { Morning: 'fa-sun', Afternoon: 'fa-cloud-sun', Evening: 'fa-moon', Night: 'fa-star' };
    const categoryColors = { Food: '#f59e0b', Transport: '#3b82f6', Activity: '#10b981' };

    const daysHtml = itinerary.map(day => {
        // Support both old single-hotel and new multi-hotel format
        const hotelOptions = day.hotelOptions || (day.hotelSuggestion ? [day.hotelSuggestion] : []);
        const tierColors = { 'Budget': '#10b981', 'Mid-range': '#3b82f6', 'Premium': '#f59e0b' };

        const hotelHtml = hotelOptions.length > 0 ? `
            <div style="margin-bottom:1.5rem;">
                <h4 style="font-size:0.78rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.75rem;letter-spacing:1.5px;display:flex;align-items:center;gap:6px;">
                    <i class="fas fa-hotel"></i> Accommodation Options
                </h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;">
                    ${hotelOptions.map(h => {
                        const tierColor = tierColors[h.tier] || 'var(--accent)';
                        return `
                        <div style="background:rgba(255,255,255,0.03);padding:1rem;border-radius:12px;border:1px solid ${tierColor}33;transition:border 0.2s;"
                             onmouseover="this.style.border='1px solid ${tierColor}'"
                             onmouseout="this.style.border='1px solid ${tierColor}33'">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem;">
                                <span style="font-weight:700;font-size:0.9rem;color:var(--text);">${h.name || 'Hotel'}</span>
                                ${h.tier ? `<span style="font-size:0.6rem;padding:2px 8px;border-radius:100px;background:${tierColor}22;color:${tierColor};border:1px solid ${tierColor};">${h.tier}</span>` : ''}
                            </div>
                            <p style="font-size:0.75rem;color:var(--text-muted);margin:0 0 0.5rem;">${h.description || ''}</p>
                            <div style="font-weight:700;color:var(--accent);font-size:0.95rem;">
                                ${cost(h.estimatedCostPerNight)}<small style="font-weight:400;">/night</small>
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </div>` : '';

        const blocksHtml = ['Morning', 'Afternoon', 'Evening', 'Night'].map(block => {
            const acts = (day.blocks?.[block]) || [];
            if (!acts.length) return '';
            const icon = blockIcons[block] || 'fa-clock';
            return `
                <div style="margin-bottom:1.5rem;">
                    <h4 style="font-size:0.78rem;text-transform:uppercase;color:var(--text-muted);margin-bottom:0.75rem;letter-spacing:1.5px;display:flex;align-items:center;gap:6px;">
                        <i class="fas ${icon}"></i> ${block}
                    </h4>
                    ${acts.map((act, idx) => {
                        const catColor = categoryColors[act.category] || 'var(--accent)';
                        const travelTimeHtml = act.travelTimeFromPrevious ? `
                            <div style="display:flex;align-items:center;gap:6px;margin: -0.5rem 0 0.5rem 4.5rem;color:var(--text-muted);font-size:0.75rem;">
                                <i class="fas fa-car-side" style="opacity:0.6;"></i>
                                <span>${act.travelTimeFromPrevious}</span>
                            </div>` : '';
                        
                        return `
                        ${travelTimeHtml}
                        <div style="display:flex;gap:1rem;background:rgba(255,255,255,0.03);padding:1rem;border-radius:12px;margin-bottom:0.5rem;border:1px solid rgba(255,255,255,0.04);transition:border 0.2s;" 
                             onmouseover="this.style.border='1px solid rgba(255,107,157,0.2)'" 
                             onmouseout="this.style.border='1px solid rgba(255,255,255,0.04)'">
                            <span style="font-family:monospace;color:var(--accent);font-weight:700;min-width:60px;padding-top:2px;">${act.time || '--:--'}</span>
                            <div style="flex:1;">
                                <div style="display:flex;justify-content:space-between;align-items:start;gap:0.5rem;flex-wrap:wrap;">
                                    <strong style="font-size:0.95rem;">
                                        ${act.place || 'Activity'}
                                        ${(act.description || '').includes('[RESCHEDULED]') ? `<span style="font-size:0.55rem;background:var(--accent)22;color:var(--accent);padding:1px 5px;border-radius:4px;border:1px solid var(--accent)44;text-transform:uppercase;margin-left:6px;vertical-align:middle;">Rescheduled</span>` : ''}
                                    </strong>
                                    <span style="font-size:0.68rem;padding:2px 10px;border-radius:100px;background:${catColor}22;color:${catColor};border:1px solid ${catColor};white-space:nowrap;">
                                        ${act.category || 'Activity'}
                                    </span>
                                </div>
                                <p style="font-size:0.83rem;color:var(--text-muted);margin:0.4rem 0 0.6rem;">${act.description || ''}</p>
                                <div style="display:flex;justify-content:space-between;align-items:center;">
                                    <span style="font-weight:700;color:var(--accent);font-size:0.95rem;">${cost(act.cost ?? 0)}</span>
                                    <button 
                                        onclick="markMissed(${day.day},'${block}',${idx})"
                                        style="padding:4px 14px;font-size:0.7rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#ef4444;cursor:pointer;transition:all 0.2s;"
                                        onmouseover="this.style.background='rgba(239,68,68,0.18)'"
                                        onmouseout="this.style.background='rgba(239,68,68,0.08)'">
                                        <i class="fas fa-times-circle" style="margin-right:4px;"></i>Missed
                                    </button>
                                </div>
                            </div>
                        </div>`;
                    }).join('')}
                </div>`;
        }).join('');

        return `
            <div style="border-left:4px solid var(--primary);padding-left:1.5rem;padding-bottom:1rem;">
                <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
                    <div style="background:var(--primary);color:#fff;font-weight:700;font-size:0.8rem;padding:4px 12px;border-radius:100px;">Day ${day.day}</div>
                    <h3 style="margin:0;color:var(--primary);font-size:1.1rem;">
                        <i class="fas fa-map-marker-alt" style="margin-right:6px;opacity:0.7;"></i>${day.city || ''}
                    </h3>
                    ${day.dailyBudgetUsed ? `<span style="margin-left:auto;font-size:0.78rem;color:var(--text-muted);">Daily spend: ${cost(day.dailyBudgetUsed)}</span>` : ''}
                </div>
                ${hotelHtml}
                ${blocksHtml}
            </div>`;
    }).join('<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:0.5rem 0 2rem;">');

    // ── Final render ──────────────────────────────────────────────
    section.innerHTML = `
        <div class="planner-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:1rem;">
                <div>
                    <h2 style="margin:0;"><i class="fas fa-route" style="margin-right:8px;color:var(--primary);"></i>AI-Optimized Schedule</h2>
                    <p style="color:var(--accent);margin:0.25rem 0;font-weight:600;">
                        Total Estimated Cost: ${cost(data.totalEstimatedCost ?? 0)}
                    </p>
                </div>
                <div style="display:flex;gap:0.75rem;">
                    <button id="restartButton" style="padding:0.6rem 1.2rem;font-size:0.85rem;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);cursor:pointer;">
                        <i class="fas fa-redo" style="margin-right:6px;"></i>Start Over
                    </button>
                    <button id="saveItineraryBtn" class="cta-button" style="width:auto;padding:0.6rem 1.2rem;font-size:0.9rem;">
                        <i class="fas fa-bookmark" style="margin-right:6px;"></i>Save Trip
                    </button>
                </div>
            </div>
            ${weatherHtml}
            <div style="display:flex;flex-direction:column;gap:1.5rem;margin-top:2rem;">
                ${daysHtml || '<p style="color:var(--text-muted);text-align:center;">No itinerary data available.</p>'}
            </div>
        </div>`;

    // ── Button listeners ──────────────────────────────────────────
    document.getElementById('saveItineraryBtn')?.addEventListener('click', async () => {
        const uid = getCurrentUserId();
        if (!uid) { alert('You must be logged in to save itineraries.'); return; }
        showLoading(true);
        try {
            const res = await fetch('/api/trips/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: uid, itineraryData: currentTripData })
            });
            const result = await res.json();
            if (result.success) alert('✅ Itinerary saved! ID: ' + result.id);
            else throw new Error(result.details || result.error || 'Save failed');
        } catch (e) { 
            console.error('--- ITINERARY SAVE FAILED ---');
            console.error('Error Details:', e);
            alert('Failed to save trip. Check your connection or see console for details.');
        }
        finally { showLoading(false); }
    });

    document.getElementById('restartButton')?.addEventListener('click', () => location.reload());
}


// ----------------------------------------------------------------
// MARK MISSED
// ----------------------------------------------------------------
window.markMissed = async (day, blockName, idx) => {
    if (!currentTripData || !currentTripData.itinerary) {
        alert('No active itinerary found to reschedule.');
        return;
    }

    const dayData = currentTripData.itinerary.find(d => d.day === day);
    if (!dayData || !dayData.blocks || !dayData.blocks[blockName]) return;

    const missedActivity = dayData.blocks[blockName][idx];
    if (!missedActivity) return;

    const name = (missedActivity.place || '').toLowerCase();
    const isGenericMeal = (missedActivity.category === 'Food') && 
                          (name.includes('breakfast') || name.includes('lunch') || name.includes('dinner')) &&
                          !(name.includes('cruise') || name.includes('show') || name.includes('class') || name.includes('tour'));

    if (isGenericMeal) {
        // Just remove it from the local view and re-render
        dayData.blocks[blockName].splice(idx, 1);
        renderItinerary(currentTripData);
        alert('🍽️ Meal skipped. Generic meals aren\'t rescheduled to the next day.');
        return;
    }

    // Filter to only future days (current day and onwards)
    const remainingItinerary = JSON.parse(JSON.stringify(currentTripData.itinerary.filter(d => d.day >= day)));
    
    // Crucial: Remove the missed activity from its original spot in the data we send to the AI
    const targetDay = remainingItinerary.find(d => d.day === day);
    if (targetDay && targetDay.blocks && targetDay.blocks[blockName]) {
        targetDay.blocks[blockName].splice(idx, 1);
        // Decrease budget used for that day since the activity is "gone" from there
        targetDay.dailyBudgetUsed = (targetDay.dailyBudgetUsed || 0) - (missedActivity.cost || 0);
    }
    
    showLoading(true, "AI is intelligently rescheduling your trip...");
    try {
        const res = await fetch('/api/trips/reschedule', { 
            method:'POST', 
            headers:{'Content-Type':'application/json'}, 
            body: JSON.stringify({ 
                remainingItinerary, 
                missedActivity, 
                remainingBudget: (currentTripData.input ? currentTripData.input.budget : currentTripData.totalEstimatedCost) || 0, 
                currentLocation: (currentTripData.input ? currentTripData.input.currentLocation : 'Unknown City')
            }) 
        });
        
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Server error ${res.status}`);
        }
        
        const data = await res.json();
        if (!data.days) throw new Error('Invalid rescheduling response from AI');

        // Merge updated days back into the itinerary
        currentTripData.itinerary = [
            ...currentTripData.itinerary.filter(d => d.day < day), 
            ...data.days
        ];
        
        renderItinerary(currentTripData);
        alert('✨ Activity rescheduled! We\'ve moved it to a better time in your remaining schedule.');
    } catch (e) { 
        console.error('--- RESCHEDULE FAILED ---', e);
        alert('Rescheduling failed: ' + e.message); 
    }
    finally { showLoading(false); }
};


// ----------------------------------------------------------------
// DATE PICKER
// ----------------------------------------------------------------
const startDateInput = document.getElementById('startDate');
const endDateInput   = document.getElementById('endDate');
const daysHidden     = document.getElementById('days');
const durationDisplay = document.getElementById('durationDisplay');

if (startDateInput && endDateInput) {
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;

    const calcDuration = () => {
        const start = new Date(startDateInput.value);
        const end   = new Date(endDateInput.value);
        if (startDateInput.value && endDateInput.value) {
            if (end < start) {
                durationDisplay.textContent = 'Error: End date before start';
                durationDisplay.style.color = 'var(--accent)';
                daysHidden.value = 0;
            } else {
                const diff = Math.ceil(Math.abs(end - start) / 86400000) + 1;
                durationDisplay.textContent = `Duration: ${diff} days`;
                durationDisplay.style.color = 'var(--accent)';
                daysHidden.value = diff;
            }
        }
    };
    startDateInput.addEventListener('change', e => { endDateInput.min = e.target.value; calcDuration(); updateTripLogic(); });
    endDateInput.addEventListener('change', () => { calcDuration(); updateTripLogic(); });
}

// ----------------------------------------------------------------
// BUDGET SLIDER & MANUAL INPUT
// ----------------------------------------------------------------
const budgetRange = document.getElementById('budgetRange');
const manualBudget = document.getElementById('manualBudgetInput');
const hiddenBudget = document.getElementById('budget');

const syncBudget = (val, source) => {
    const v = parseInt(val) || 0;
    const hiddenBudget = document.getElementById('budget');
    const budgetRange = document.getElementById('budgetRange');
    const manualBudget = document.getElementById('manualBudgetInput');
    const inrDisplay = document.getElementById('inrValueDisplay');

    if (hiddenBudget) hiddenBudget.value = v;
    if (inrDisplay) inrDisplay.textContent = new Intl.NumberFormat('en-IN').format(v);
    
    if (source !== 'range' && budgetRange) {
        budgetRange.value = v > 500000 ? 500000 : v;
    }
    if (source !== 'manual' && manualBudget) {
        manualBudget.value = v;
    }
    
    // Trigger analysis update
    if (typeof debouncedUpdateTripLogic === 'function') {
        debouncedUpdateTripLogic();
    }
};

if (budgetRange) {
    budgetRange.addEventListener('input', e => syncBudget(e.target.value, 'range'));
}
if (manualBudget) {
    manualBudget.addEventListener('input', e => syncBudget(e.target.value, 'manual'));
}

// ----------------------------------------------------------------
// QUICK TAGS & LOGIC
// ----------------------------------------------------------------
const destInput = document.getElementById('destinations');

let lastRenderedDests = "";
let lastRenderedTotalDays = 0;

const renderPerCityDays = (dests) => {
    const container = document.getElementById('perCityDaysContainer');
    const list = document.getElementById('cityDaysList');
    const totalDaysInput = document.getElementById('days');
    const totalDays = totalDaysInput ? (parseInt(totalDaysInput.value) || 0) : 0;
    const allocationDisplay = document.getElementById('allocationDisplay');

    if (!container || !list) return;

    // Only re-render if the list of cities has changed
    const currentLabels = Array.from(list.querySelectorAll('.city-day-label')).map(l => l.innerText);
    if (JSON.stringify(currentLabels) === JSON.stringify(dests) && list.innerHTML !== '') {
        return;
    }

    if (dests.length > 1 && totalDays > 0) {
        container.style.display = 'block';
        list.innerHTML = dests.map(city => {
            const val = Math.floor(totalDays/dests.length);
            return `
                <div class="city-day-input-group" style="margin-bottom: 0.75rem;">
                    <span class="city-day-label" style="font-weight:600;">${city}</span>
                    <input type="number" class="city-day-input" data-city="${city}" value="${val}" data-old-value="${val}" min="1" max="${totalDays}" style="width: 70px;">
                </div>
            `;
        }).join('') + `
            <div id="allocationDisplay" style="font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px solid var(--border); margin-top: 0.5rem; color: var(--text-muted);">
                Allocated: <span id="allocatedSum">0</span> / ${totalDays} days
            </div>
        `;

        // Add listeners to these new inputs
        document.querySelectorAll('.city-day-input').forEach(input => {
            input.addEventListener('change', debouncedUpdateTripLogic);
            input.addEventListener('input', e => {
                rebalanceCityDays(e.target);
                debouncedUpdateTripLogic();
            });
        });
    } else {
        container.style.display = 'none';
        list.innerHTML = '';
    }
};

const rebalanceCityDays = (changedInput) => {
    const totalDaysInput = document.getElementById('days');
    const totalDays = totalDaysInput ? (parseInt(totalDaysInput.value) || 0) : 0;
    const allInputs = Array.from(document.querySelectorAll('.city-day-input'));
    if (allInputs.length < 2 || totalDays === 0) return;

    const newVal = parseInt(changedInput.value) || 1;
    const oldVal = parseInt(changedInput.dataset.oldValue) || 1;
    
    // Ensure the new value doesn't make it impossible for others to have at least 1 day
    const maxAllowed = totalDays - (allInputs.length - 1);
    const finalVal = Math.max(1, Math.min(newVal, maxAllowed));
    changedInput.value = finalVal;
    
    const delta = finalVal - oldVal;
    if (delta === 0) return;

    const otherInputs = allInputs.filter(i => i !== changedInput);

    if (otherInputs.length === 1) {
        // Simple 2-city case: absolute compensation
        const targetVal = totalDays - finalVal;
        otherInputs[0].value = targetVal;
        otherInputs[0].dataset.oldValue = targetVal;
    } else {
        // Multi-city case: subtract delta from other cities, priority to subsequent ones
        let remainingDelta = delta;
        
        // Try to take from cities after the current one first, then before
        const currentIndex = allInputs.indexOf(changedInput);
        const rebalanceOrder = [
            ...allInputs.slice(currentIndex + 1),
            ...allInputs.slice(0, currentIndex).reverse()
        ];

        for (const input of rebalanceOrder) {
            const currentVal = parseInt(input.value) || 1;
            if (remainingDelta > 0) {
                // We need to reduce other cities
                const canReduce = currentVal - 1;
                const reduction = Math.min(canReduce, remainingDelta);
                input.value = currentVal - reduction;
                input.dataset.oldValue = input.value;
                remainingDelta -= reduction;
            } else if (remainingDelta < 0) {
                // We need to increase other cities (delta is negative, so remainingDelta is negative)
                const addition = Math.abs(remainingDelta);
                input.value = currentVal + addition;
                input.dataset.oldValue = input.value;
                remainingDelta = 0;
            }
            if (remainingDelta === 0) break;
        }
    }
    
    // Update old value for the primary input
    changedInput.dataset.oldValue = finalVal;
};

// ── Frontend classify cache ── prevents hammering /classify on every
//    budget slider move or date change. Cache invalidates when the
//    key (destinations + daysPerCity) actually changes.
let _lastClassifyKey = '';
let _lastClassification = {};

const updateTripLogic = async () => {
    if (!destInput) return;
    const dests = destInput.value.split(',').map(d => d.trim()).filter(d => d);
    
    renderPerCityDays(dests);
    
    if (!dests.length) return;

    const listContainer = document.getElementById('currencyConversionList');
    const budgetInput = document.getElementById('budget');
    const budget = budgetInput ? parseInt(budgetInput.value) || 0 : 0;
    if (!listContainer) return;

    // 1. Get Days per city and Update Sum
    let daysPerCity = [];
    let totalAssigned = 0;
    document.querySelectorAll('.city-day-input').forEach(input => {
        const val = parseInt(input.value) || 0;
        daysPerCity.push({ city: input.dataset.city, days: val });
        totalAssigned += val;
    });

    const totalDays = parseInt(document.getElementById('days').value) || 0;
    const allocatedSumEl = document.getElementById('allocatedSum');
    if (allocatedSumEl) {
        allocatedSumEl.innerText = totalAssigned;
        allocatedSumEl.style.color = (totalAssigned === totalDays) ? 'var(--accent)' : '#ff4444';
    }

    // 2. Classify Budget (Split it)
    //    Only call /classify when:
    //    (a) multi-city trip with at least 2 destinations
    //    (b) all days are assigned (sum matches total)
    //    (c) the destinations+days combo has actually changed since last call
    let classification = {};
    const classifyKey = JSON.stringify({ dests, daysPerCity });

    if (dests.length > 1 && daysPerCity.length === dests.length && totalAssigned === totalDays && totalDays > 0) {
        if (classifyKey === _lastClassifyKey && Object.keys(_lastClassification).length > 0) {
            // Use cached result — no API call needed
            classification = _lastClassification;
        } else {
            // Show loading state
            listContainer.innerHTML = `
                <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
                    <i class="fas fa-microchip fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; color: var(--accent);"></i>
                    <p style="font-size: 0.85rem; margin:0;">Calculating smart budget split…</p>
                </div>
            `;

            try {
                const classRes = await fetch('/api/trips/classify', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ destinations: dests, budget, daysPerCity })
                });
                if (classRes.ok) {
                    classification = await classRes.json();
                } else {
                    throw new Error('Non-OK status: ' + classRes.status);
                }
            } catch (e) {
                console.warn('[Classify] Falling back to heuristic:', e.message);
                classification = getHeuristicBudget(dests, budget, daysPerCity);
            }

            _lastClassifyKey    = classifyKey;
            _lastClassification = classification;
        }
    } else if (dests.length === 1) {
        // Single city gets 100%
        classification[dests[0]] = { allocation: budget, reasoning: 'Full budget for single destination' };
    } else {
        // Days not fully assigned yet — use heuristic silently, no API call
        classification = getHeuristicBudget(dests, budget, daysPerCity);
    }

    // 3. Clear and Populate
    const listContainerFinal = document.getElementById('currencyConversionList');
    if (!listContainerFinal) return;
    listContainerFinal.innerHTML = '';
    
    let runningBudgetSum = 0;
    for (let i = 0; i < dests.length; i++) {
        const dest = dests[i];
        try {
            const res = await fetch(`/api/trips/currency-suggestion?destination=${encodeURIComponent(dest)}`);
            if (!res.ok) continue;
            const data = await res.json();
            
            const cityDaysData = daysPerCity.find(d => d.city === dest);
            const cityDays = cityDaysData ? cityDaysData.days : (totalDays / dests.length);
            const totalAssignedDays = daysPerCity.reduce((sum, d) => sum + d.days, 0) || totalDays || 1;
            
            const cityData = classification[dest] || { 
                allocation: (budget * (cityDays / totalAssignedDays)),
                reasoning: "Proportional split based on duration"
            };

            // EXACT MATH: If last city, use remainder to avoid rounding drift
            let cityBudget;
            if (i === dests.length - 1) {
                cityBudget = Math.max(0, budget - runningBudgetSum);
            } else {
                cityBudget = Math.round(cityData.allocation);
                runningBudgetSum += cityBudget;
            }

            const reasoning = cityData.reasoning;

            const isIntl = data.currency !== 'INR';
            if (dests.indexOf(dest) === 0 && dests.length === 1) {
                const radio = document.querySelector(`input[name="tripType"][value="${isIntl}"]`);
                if (radio) radio.checked = true;
            } else if (dests.length > 1) {
                const multi = document.querySelector('input[name="tripType"][value="multi"]');
                if (multi) multi.checked = true;
            }

            const convertedAmount = (cityBudget * data.rate).toFixed(2);
            
            const item = document.createElement('div');
            item.className = 'currency-item';
            item.style.background = 'rgba(255,255,255,0.03)';
            item.style.padding = '0.75rem';
            item.style.borderRadius = '8px';
            item.style.marginBottom = '0.5rem';
            item.style.display = 'flex';
            item.style.justifyContent = 'space-between';
            item.style.alignItems = 'center';
            item.style.border = '1px solid rgba(255,255,255,0.05)';
            
            item.innerHTML = `
                <div style="flex:1;">
                    <p style="font-size:0.7rem;color:var(--text-muted);margin:0;text-transform:uppercase;letter-spacing:0.5px;">${dest}${cityDaysData ? ` (${cityDaysData.days}d)` : ''}</p>
                    <p style="font-size:1.1rem;font-weight:700;margin:0;">₹${Math.round(cityBudget).toLocaleString()}</p>
                    <p style="font-size:0.65rem;color:var(--accent);margin-top:2px;opacity:0.8;font-style:italic;">${reasoning}</p>
                </div>
                <div style="font-size:1rem;opacity:0.2;margin:0 10px;"><i class="fas fa-chevron-right"></i></div>
                <div style="text-align:right;flex:1;">
                    <p style="font-size:0.7rem;color:var(--text-muted);margin:0;text-transform:uppercase;letter-spacing:0.5px;">${data.currency}</p>
                    <p style="font-size:1.1rem;font-weight:700;color:var(--accent);margin:0;">${data.symbol || ''}${Number(convertedAmount).toLocaleString()}</p>
                </div>
            `;
            listContainerFinal.appendChild(item);
        } catch (e) { console.error('Currency suggestion error:', e); }
    }
};

// 1200ms debounce — gives the user time to finish typing before we fire any API calls
const debouncedUpdateTripLogic = debounce(updateTripLogic, 1200);

if (destInput) destInput.addEventListener('input', updateTripLogic);

document.querySelectorAll('#quick-tags .tag').forEach(tag => {
    tag.addEventListener('click', () => {
        if (!destInput) return;
        destInput.value = destInput.value ? `${destInput.value}, ${tag.textContent}` : tag.textContent;
        updateTripLogic();
    });
});

// ----------------------------------------------------------------
// AUTH STATE from auth.js
// ----------------------------------------------------------------
window.addEventListener('user-ready', e => {
    const mainApp = document.getElementById('mainAppContent');
    if (e.detail?.uid) {
        if (mainApp) mainApp.style.display = 'block';
        // Load saved trips when user logs in
        loadSavedTrips();
    } else {
        if (mainApp) mainApp.style.display = 'none';
    }
});

// Preference Tags Toggle
document.querySelectorAll('.pref-tag').forEach(tag => {
    tag.addEventListener('click', () => {
        tag.classList.toggle('active');
    });
});
