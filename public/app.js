import { getCurrentUserId } from './auth.js';

let currentTripData = {};

// Show Loading Spinner
function showLoading(show) {
    const loader = document.getElementById('loading');
    if (loader) loader.style.display = show ? 'flex' : 'none';
}



document.getElementById('getLocationBtn').addEventListener('click', () => {
    const locInput = document.getElementById('currentLocation');
    
    if (!navigator.geolocation) {
        alert('Geolocation is not supported by your browser');
        return;
    }

    locInput.placeholder = "Detecting location...";
    
    // For now, we'll just put the coordinates in if Maps API isn't ready,
    // or use a free reverse geocoding API to get the city name.
    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            
            try {
                // Using a free, unauthenticated reverse geocoding API for immediate use
                // (OpenStreetMap Nominatim) - Google Maps can replace this later.
                const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
                const data = await response.json();
                
                const city = data.address.city || data.address.town || data.address.village || data.address.county;
                const country = data.address.country;
                
                if (city && country) {
                    locInput.value = `${city}, ${country}`;
                } else {
                    locInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`; // Fallback to raw coords
                }
            } catch (err) {
                console.error("Reverse geocoding failed", err);
                locInput.value = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
            }
        },
        (error) => {
            alert('Unable to retrieve your location');
            locInput.placeholder = "e.g. Mumbai, India";
        }
    );
});

document.getElementById('analyzeButton').addEventListener('click', async () => {
    console.log("Analyze Button Clicked!");
    const destinationsInput = document.getElementById('destinations').value;
    const destinations = destinationsInput.split(',').map(d => d.trim()).filter(d => d);
    const budget = document.getElementById('budget').value;
    const days = document.getElementById('days').value;
    const currentLocation = document.getElementById('currentLocation').value;
    const tripType = document.querySelector('input[name="tripType"]:checked').value;
    const isInternationalRequested = tripType === 'true';
    const isMultiCityRequested = tripType === 'multi';

    if (destinations.length === 0 || !budget || days <= 0 || !currentLocation) {
        alert('Please fill in all required fields and ensure trip duration is greater than 0');
        return;
    }

    // --- LOGIC VALIDATIONS ---
    
    // 1. Multi-city Validation
    if (isMultiCityRequested && destinations.length < 2) {
        alert('Multi-city trip must have at least 2 destinations.');
        return;
    }
    if (!isMultiCityRequested && destinations.length > 1) {
        alert('Please select "Multi-city" for multiple destinations.');
        return;
    }

    // 2. Domestic/International Validation
    const indianCities = ['mumbai', 'delhi', 'bangalore', 'hyd', 'chennai', 'kolkata', 'pune', 'goa', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'surat'];
    const hasInternationalDest = destinations.some(d => {
        const dest = d.toLowerCase();
        return !indianCities.some(city => dest.includes(city)) && !dest.includes('india');
    });

    if (isInternationalRequested && !hasInternationalDest) {
        alert('International trip must have at least one foreign destination.');
        return;
    }
    if (!isInternationalRequested && tripType !== 'multi' && hasInternationalDest) {
        alert('Domestic trip cannot have foreign destinations. Please select International.');
        return;
    }

    showLoading(true);
    try {
        const response = await fetch('/api/trips/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ destinations, budget, days, currentLocation, isInternational: isInternationalRequested })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            console.error("Analysis API error:", errText);
            throw new Error(`Server returned ${response.status}: ${errText}`);
        }

        const data = await response.json();
        console.log("Analysis data received:", data);
        currentTripData = { ...data, input: { destinations, budget, days, currentLocation } };
        renderAnalysis(data);
    } catch (error) {
        alert('Analysis failed.');
    } finally {
        showLoading(false);
    }
});

function renderAnalysis(data) {
    // Hide input dashboard content
    const dashboards = document.querySelectorAll('.dashboard-content, .cta-area');
    dashboards.forEach(d => d.style.display = 'none');
    
    const section = document.getElementById('analysis-section');
    section.style.display = 'block';

    const message = document.getElementById('analysis-message');
    const breakdown = document.getElementById('breakdown-container');
    
    if (!message || !breakdown) {
        console.error("Critical UI elements missing: analysis-message or breakdown-container");
        return;
    }

    message.innerHTML = `<strong>${data.message}</strong>`;
    if (data.currencyContext && data.currencyContext.currency !== 'INR') {
        message.innerHTML += `<br><small>Analysis performed in ${data.currencyContext.currency} (Rate: 1 INR = ${data.currencyContext.rate.toFixed(4)})</small>`;
    }

    const symbol = (data.currencyContext && data.currencyContext.currency !== 'INR') ? (data.currencyContext.symbol || data.currencyContext.currency + ' ') : '₹';
    
    breakdown.innerHTML = data.cityBreakdown.map(city => `
        <div style="background: rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 16px; margin-bottom: 1rem; border: 1px solid ${data.feasible ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}">
            <h4 style="color: var(--primary); margin-bottom: 1rem;">${city.city}</h4>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
                <div><small>Flights</small><div style="font-weight: 600;">${symbol}${city.minFlights.toLocaleString()}</div></div>
                <div><small>Hotels</small><div style="font-weight: 600;">${symbol}${city.minHotels.toLocaleString()}</div></div>
                <div><small>Food/Local</small><div style="font-weight: 600;">${symbol}${city.minFood.toLocaleString()}</div></div>
            </div>
            <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem; text-align: right;">
                <strong style="color: var(--accent)">Estimated Min: ${symbol}${city.totalMin.toLocaleString()}</strong>
            </div>
        </div>
    `).join('');

    const generateBtn = document.getElementById('generateButton');
    const suggContainer = document.getElementById('suggestion-container');
    
    if (data.feasible) {
        generateBtn.style.display = 'block';
        suggContainer.style.display = 'none';
    } else {
        generateBtn.style.display = 'none';
        suggContainer.style.display = 'block';
        const list = document.getElementById('suggestion-list');
        list.innerHTML = data.suggestions.map(s => `
            <li style="margin-bottom: 0.5rem; padding: 0.5rem; background: rgba(239, 68, 68, 0.1); border-radius: 8px; border-left: 3px solid #ef4444;">
                ${s}
            </li>
        `).join('');
    }
}

document.getElementById('generateButton').addEventListener('click', async () => {
    showLoading(true);
    try {
        const response = await fetch('/api/trips/plan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                destinations: currentTripData.input.destinations,
                budget: currentTripData.input.budget,
                days: currentTripData.input.days,
                currentLocation: currentTripData.input.currentLocation,
                allocation: currentTripData.cityBreakdown
            })
        });

        const data = await response.json();
        currentTripData = { ...currentTripData, itinerary: data.days, totalEstimatedCost: data.totalEstimatedCost, weatherContext: data.weatherContext };
        renderItinerary(currentTripData);
        
        // Auto-save if User is logged in
        const uid = getCurrentUserId();
        if (uid) {
            try {
                await fetch('/api/trips/save', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: uid, itineraryData: currentTripData })
                });
                console.log("Itinerary auto-saved to Firebase.");
            } catch (err) {
                console.error("Auto-save failed:", err);
            }
        }
    } catch (error) {
        console.error("Planning error:", error);
        alert('Failed to generate itinerary.');
    } finally {
        showLoading(false);
    }
});

document.getElementById('restartButton').addEventListener('click', () => {
    location.reload();
});

function renderItinerary(data) {
    document.getElementById('analysis-section').style.display = 'none';
    const section = document.getElementById('itinerary-section');
    section.style.display = 'block';

    const symbol = (data.currencyContext && data.currencyContext.currency !== 'INR') ? (data.currencyContext.symbol || data.currencyContext.currency + ' ') : '₹';

    let weatherHtml = '';
    if (data.weatherContext && Object.keys(data.weatherContext).length > 0) {
        weatherHtml = `<div style="margin: 1rem 0; padding: 1rem; background: rgba(16, 185, 129, 0.1); border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.2);">
            <h4 style="color: var(--accent); margin-bottom: 0.5rem; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 1px;">Live Weather Context</h4>
            <div style="display: flex; flex-wrap: wrap; gap: 1rem;">
                ${Object.entries(data.weatherContext).map(([city, weather]) => `
                    <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 8px;">
                        <strong>${city}:</strong> ${weather.temp}°C, ${weather.condition}
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    section.innerHTML = `
        <div class="planner-card">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <div>
                    <h2 style="margin: 0;">AI-Optimized Schedule</h2>
                    <p style="color: var(--accent); margin: 0.25rem 0; font-weight: 600;">Total Estimated Cost: ${symbol}${data.totalEstimatedCost.toLocaleString()}</p>
                </div>
                <button id="saveItineraryBtn" style="width: auto; padding: 0.6rem 1.2rem; font-size: 0.9rem;">Save to Account</button>
            </div>
            
            ${weatherHtml}
            
            <div id="itinerary-grid" style="display: flex; flex-direction: column; gap: 2rem; margin-top: 2rem;">
                ${data.itinerary.map(day => `
                    <div class="itinerary-day" data-day="${day.day}" style="border-left: 4px solid var(--primary); padding-left: 1.5rem;">
                        <h3 style="margin-bottom: 0.5rem; color: var(--primary);">Day ${day.day}: ${day.city}</h3>
                        
                        ${day.hotelSuggestion ? `
                        <div style="background: rgba(var(--accent-rgb), 0.1); padding: 1rem; border-radius: 12px; margin-bottom: 1.5rem; border: 1px solid var(--accent);">
                            <div style="display: flex; justify-content: space-between; align-items: start;">
                                <div>
                                    <h4 style="color: var(--accent); margin: 0; font-size: 1rem;"><i class="fas fa-hotel"></i> ${day.hotelSuggestion.name}</h4>
                                    <p style="font-size: 0.8rem; color: var(--text-muted); margin: 0.25rem 0;">${day.hotelSuggestion.description}</p>
                                </div>
                                <div style="font-weight: 700; color: var(--accent);">${symbol}${day.hotelSuggestion.estimatedCostPerNight.toLocaleString()}<small>/night</small></div>
                            </div>
                        </div>
                        ` : ''}
                        
                        ${['Morning', 'Afternoon', 'Evening', 'Night'].map(blockName => {
                            const activities = day.blocks[blockName] || [];
                            if (activities.length === 0) return '';
                            
                            return `
                                <div class="time-block" style="margin-bottom: 1.5rem;">
                                    <h4 style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.75rem; letter-spacing: 1px;">${blockName}</h4>
                                    ${activities.map((act, idx) => `
                                        <div class="activity-item" style="display: flex; gap: 1rem; background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 12px; margin-bottom: 0.5rem; position: relative;">
                                            <span class="time" style="font-family: monospace; color: var(--accent); font-weight: 600; min-width: 60px;">${act.time}</span>
                                            <div style="flex: 1">
                                                <div style="display: flex; justify-content: space-between; align-items: start;">
                                                    <strong>${act.place}</strong>
                                                    <span style="font-size: 0.7rem; padding: 2px 8px; border-radius: 100px; background: rgba(var(--accent-rgb), 0.1); color: var(--accent); border: 1px solid var(--accent);">${act.category}</span>
                                                </div>
                                                <p style="font-size: 0.85rem; color: var(--text-muted); margin: 0.5rem 0;">${act.description}</p>
                                                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem;">
                                                    <span style="font-weight: 600; color: var(--accent)">${symbol}${act.cost.toLocaleString()}</span>
                                                    <button onclick="markMissed(${day.day}, '${blockName}', ${idx})" style="padding: 4px 12px; font-size: 0.7rem; background: var(--secondary); border-radius: 4px;">Missed</button>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            `;
                        }).join('')}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    // Add save listener after rendering
    document.getElementById('saveItineraryBtn').addEventListener('click', async () => {
        const uid = getCurrentUserId();
        if (!uid) {
            alert('You must be logged in to save itineraries.');
            return;
        }

        showLoading(true);
        try {
            const response = await fetch('/api/trips/save', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userId: uid,
                    itineraryData: currentTripData 
                })
            });
            const result = await response.json();
            if (result.success) {
                alert('Itinerary saved to Firebase successfully! ID: ' + result.id);
            }
        } catch (error) {
            alert('Failed to save to Firebase.');
        } finally {
            showLoading(false);
        }
    });
}


async function markMissed(day, blockName, idx) {
    const dayData = currentTripData.itinerary.find(d => d.day === day);
    const missedActivity = dayData.blocks[blockName][idx];
    const remainingBudget = currentTripData.input.budget; // Simplified for now
    
    // Slice itinerary from current day onwards for rescheduling
    const remainingItinerary = currentTripData.itinerary.filter(d => d.day >= day);

    showLoading(true);
    try {
        const response = await fetch('/api/trips/reschedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                remainingItinerary, 
                missedActivity, 
                remainingBudget,
                currentLocation: currentTripData.input.currentLocation
            })
        });

        if (!response.ok) throw new Error('Reschedule API failed');

        const data = await response.json();
        // Merge rescheduled days back into the itinerary
        currentTripData.itinerary = [
            ...currentTripData.itinerary.filter(d => d.day < day),
            ...data.days
        ];
        renderItinerary(currentTripData);
    } catch (error) {
        console.error("Reschedule error:", error);
        alert('Rescheduling failed.');
    } finally {
        showLoading(false);
    }
}

// --- New UI Interactivity ---

// Date Picker Logic
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const daysHidden = document.getElementById('days');
const durationDisplay = document.getElementById('durationDisplay');

if (startDateInput && endDateInput) {
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    startDateInput.min = today;
    
    const calculateDuration = () => {
        const start = new Date(startDateInput.value);
        const end = new Date(endDateInput.value);
        
        if (startDateInput.value && endDateInput.value) {
            if (end < start) {
                durationDisplay.textContent = "Error: End date before start date";
                durationDisplay.style.color = "var(--secondary)";
                daysHidden.value = 0;
            } else {
                const diffTime = Math.abs(end - start);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // Inclusive
                durationDisplay.textContent = `Duration: ${diffDays} days`;
                durationDisplay.style.color = "var(--accent)";
                daysHidden.value = diffDays;
            }
        }
    };

    startDateInput.addEventListener('change', (e) => {
        endDateInput.min = e.target.value;
        calculateDuration();
    });
    endDateInput.addEventListener('change', calculateDuration);
}

// Budget Slider Logic
const budgetRange = document.getElementById('budgetRange');
const budgetValue = document.getElementById('budgetValue');
const budgetHidden = document.getElementById('budget');
const inrValueDisplay = document.getElementById('inrValueDisplay');
const eurValueDisplay = document.getElementById('eurValueDisplay');

if (budgetRange) {
    budgetRange.addEventListener('input', (e) => {
        const value = e.target.value;
        budgetValue.textContent = value;
        budgetHidden.value = value;
        inrValueDisplay.textContent = new Intl.NumberFormat('en-IN').format(value);
        updateTripLogic(); // Refresh the conversion card
    });
}

// Quick Tags Logic
const quickTags = document.querySelectorAll('#quick-tags .tag');
const destInput = document.getElementById('destinations');

const updateTripLogic = async () => {
    const destinations = destInput.value.split(',').map(d => d.trim()).filter(d => d);
    if (destinations.length === 0) return;

    // Auto-toggle Multi-city if multiple destinations
    if (destinations.length > 1) {
        const multiRadio = document.querySelector('input[name="tripType"][value="multi"]');
        if (multiRadio) multiRadio.checked = true;
    } else if (destinations.length === 1) {
        // Fetch accurate currency info from ExchangeRate mapping
        try {
            console.log("Fetching currency for:", destinations[0]);
            const response = await fetch(`/api/trips/currency-suggestion?destination=${encodeURIComponent(destinations[0])}`);
            if (!response.ok) {
                console.error("Currency fetch failed:", response.status);
                return;
            }
            const data = await response.json();
            console.log("Currency data received:", data);
            
            if (data.currency) {
                // Update Trip Type Radio
                const isInternational = data.currency !== 'INR';
                const radio = document.querySelector(`input[name="tripType"][value="${isInternational}"]`);
                if (radio) radio.checked = true;

                // Update Currency Card UI
                const label = document.getElementById('targetCurrencyLabel');
                const symbol = document.getElementById('targetCurrencySymbol');
                const valueDisp = document.getElementById('eurValueDisplay');

                if (label) label.textContent = data.currency;
                if (symbol) symbol.textContent = data.symbol || '';
                
                const currentBudget = document.getElementById('budget').value;
                if (valueDisp) valueDisp.textContent = (currentBudget * data.rate).toFixed(2);
                
                // Set hidden inputs or just rely on analyze endpoint
            }
        } catch (err) {
            console.error("Currency suggestion failed:", err);
        }
    }
};

const hasInternationalDest = (destinations) => {
    const indianCities = ['mumbai', 'delhi', 'bangalore', 'hyd', 'chennai', 'kolkata', 'pune', 'goa', 'jaipur', 'lucknow', 'kanpur', 'nagpur', 'indore', 'thane', 'bhopal', 'visakhapatnam', 'patna', 'surat'];
    return destinations.some(d => {
        const dest = d.toLowerCase();
        return !indianCities.some(city => dest.includes(city)) && !dest.includes('india');
    });
};

destInput.addEventListener('input', updateTripLogic);

quickTags.forEach(tag => {
    tag.addEventListener('click', () => {
        const val = tag.textContent;
        if (destInput.value) {
            destInput.value += `, ${val}`;
        } else {
            destInput.value = val;
        }
        updateTripLogic();
    });
});

// Authentication UI handling (Toggle sections)
window.addEventListener('user-ready', (e) => {
    const authNav = document.getElementById('auth-nav');
    const userNav = document.getElementById('user-nav');
    const mainApp = document.getElementById('mainAppContent');
    const emailDisplay = document.getElementById('userEmailDisplay');

    if (e.detail && e.detail.uid) {
        console.log(`User logged in: ${e.detail.uid}`);
        authNav.style.display = 'none';
        userNav.style.display = 'flex';
        mainApp.style.display = 'block';
        emailDisplay.textContent = e.detail.email || 'Logged In';
    } else {
        console.log('User logged out');
        authNav.style.display = 'flex';
        userNav.style.display = 'none';
        mainApp.style.display = 'none';
        emailDisplay.textContent = '';
    }
});

