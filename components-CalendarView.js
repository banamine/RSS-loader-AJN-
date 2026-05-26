// ============ UPDATED CALENDAR VIEW WITH SLIDE ANIMATION ==========

export class CalendarView {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        this.episodes = [];
        this.currentDate = new Date();
        this.onDateSelect = options.onDateSelect || null;
        this.isOpen = false;
        
        this.render();
        this.attachEvents();
    }
    
    render() {
        if (!this.container) return;
        
        this.container.innerHTML = `
            <div class="calendar-slide-container" id="calendarSlideContainer">
                <div class="calendar-section">
                    <div class="calendar-container">
                        <div class="calendar-header">
                            <button id="calendarPrevMonth" class="calendar-nav-btn" aria-label="Previous month">◀</button>
                            <h2 id="calendarMonthTitle" class="calendar-month-title"></h2>
                            <button id="calendarNextMonth" class="calendar-nav-btn" aria-label="Next month">▶</button>
                        </div>
                        <div class="calendar-weekdays">
                            <span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span>
                        </div>
                        <div id="calendarGrid" class="calendar-grid"></div>
                    </div>
                </div>
            </div>
        `;
        
        this.renderCalendar();
    }
    
    toggle() {
        const slideContainer = document.getElementById('calendarSlideContainer');
        if (slideContainer) {
            this.isOpen = !this.isOpen;
            slideContainer.classList.toggle('active', this.isOpen);
            
            // Update toggle button if exists
            const toggleBtn = document.getElementById('calendarToggleBtn');
            if (toggleBtn) {
                toggleBtn.classList.toggle('active', this.isOpen);
                const icon = toggleBtn.querySelector('.calendar-toggle-icon');
                if (icon) {
                    icon.textContent = this.isOpen ? '▲' : '▼';
                }
            }
        }
    }
    
    open() {
        if (!this.isOpen) this.toggle();
    }
    
    close() {
        if (this.isOpen) this.toggle();
    }
    
    renderCalendar() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const firstDayOfMonth = new Date(year, month, 1);
        const lastDayOfMonth = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDayOfMonth.getDay();
        const daysInMonth = lastDayOfMonth.getDate();
        const today = new Date();
        const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        
        const monthTitle = document.getElementById('calendarMonthTitle');
        if (monthTitle) {
            monthTitle.textContent = firstDayOfMonth.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
        
        const calendarGrid = document.getElementById('calendarGrid');
        if (!calendarGrid) return;
        
        let html = '';
        let dayCounter = 1;
        const totalCells = Math.ceil((daysInMonth + startDayOfWeek) / 7) * 7;
        
        for (let i = 0; i < totalCells; i++) {
            if (i < startDayOfWeek || dayCounter > daysInMonth) {
                html += `<div class="calendar-day other-month"></div>`;
            } else {
                const currentDate = new Date(year, month, dayCounter);
                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayCounter).padStart(2, '0')}`;
                const dayEpisodes = this.episodes.filter(ep => ep.dateKey === dateKey);
                const isToday = dateKey === todayKey;
                const hasEpisodes = dayEpisodes.length > 0;
                
                let tooltipHtml = '';
                if (dayEpisodes.length > 0) {
                    tooltipHtml = `<div class="calendar-tooltip">
                        ${dayEpisodes.slice(0, 3).map(ep => `
                            <div class="tooltip-episode">
                                <div class="tooltip-episode-title">${this.escapeHtml(ep.title.substring(0, 40))}${ep.title.length > 40 ? '...' : ''}</div>
                                <div class="tooltip-episode-time">${ep.show} ${ep.hour}</div>
                            </div>
                        `).join('')}
                        ${dayEpisodes.length > 3 ? `<div class="tooltip-episode">+${dayEpisodes.length - 3} more</div>` : ''}
                    </div>`;
                }
                
                html += `
                    <div class="calendar-day ${isToday ? 'today' : ''} ${hasEpisodes ? 'has-episode' : ''}" 
                         data-date="${dateKey}"
                         tabindex="0"
                         role="button"
                         aria-label="${dateKey}${hasEpisodes ? `, ${dayEpisodes.length} episodes` : ''}">
                        <span class="calendar-day-number">${dayCounter}</span>
                        ${hasEpisodes ? '<div class="episode-indicators"><span class="dot-indicator"></span></div>' : ''}
                        ${tooltipHtml}
                    </div>
                `;
                dayCounter++;
            }
        }
        
        calendarGrid.innerHTML = html;
        
        document.querySelectorAll('.calendar-day[data-date]').forEach(day => {
            day.addEventListener('click', () => {
                const dateKey = day.getAttribute('data-date');
                if (this.onDateSelect && dateKey) {
                    this.onDateSelect(dateKey);
                    this.close(); // Auto-close calendar after selection
                }
            });
            day.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    const dateKey = day.getAttribute('data-date');
                    if (this.onDateSelect && dateKey) {
                        this.onDateSelect(dateKey);
                        this.close();
                    }
                }
            });
        });
    }
    
    attachEvents() {
        const prevBtn = document.getElementById('calendarPrevMonth');
        const nextBtn = document.getElementById('calendarNextMonth');
        
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.renderCalendar();
            });
        }
        
        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.renderCalendar();
            });
        }
    }
    
    setEpisodes(episodes) {
        this.episodes = episodes;
        this.renderCalendar();
    }
    
    goToToday() {
        this.currentDate = new Date();
        this.renderCalendar();
    }
    
    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
}

// Create and attach calendar toggle button to header
export function attachCalendarToggle() {
    const headerControls = document.querySelector('.header-controls');
    if (!headerControls) return;
    
    const toggleBtn = document.createElement('button');
    toggleBtn.id = 'calendarToggleBtn';
    toggleBtn.className = 'calendar-toggle-btn';
    toggleBtn.setAttribute('aria-label', 'Toggle calendar view');
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.innerHTML = '<span>📅</span> <span class="calendar-toggle-icon">▼</span>';
    
    headerControls.appendChild(toggleBtn);
    
    return toggleBtn;
}