// ============ CALENDAR VIEW COMPONENT ==========

class CalendarView {
    constructor(container, options = {}) {
        this.container = container;
        this.onDateSelect = options.onDateSelect || null;
        this.currentDate = new Date();
        this.episodes = [];
        this.isVisible = false;
        this.render();
        this.attachEvents();
    }
    
    setEpisodes(episodes) { this.episodes = episodes; this.renderCalendar(); }
    
    render() {
        if (!this.container) return;
        this.container.innerHTML = `<div class="calendar-panel ${this.isVisible ? 'visible' : ''}"><div class="calendar-header"><button class="calendar-prev-btn">◀</button><h3 class="calendar-month-title"></h3><button class="calendar-next-btn">▶</button></div><div class="calendar-weekdays"><span>Sun</span><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span></div><div class="calendar-grid"></div><button class="calendar-close-btn">Close</button></div>`;
        this.renderCalendar();
    }
    
    renderCalendar() {
        const monthTitle = this.container.querySelector('.calendar-month-title');
        const calendarGrid = this.container.querySelector('.calendar-grid');
        if (!calendarGrid) return;
        const year = this.currentDate.getFullYear(); const month = this.currentDate.getMonth();
        const firstDay = new Date(year, month, 1); const startDay = firstDay.getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = new Date(); const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (monthTitle) monthTitle.textContent = firstDay.toLocaleString('default', { month: 'long', year: 'numeric' });
        let html = ''; let dayCounter = 1;
        for (let i = 0; i < startDay; i++) html += '<div class="calendar-day other-month"></div>';
        for (let day = 1; day <= daysInMonth; day++) {
            const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasEpisodes = this.episodes.some(ep => ep.dateKey === dateKey);
            const isToday = dateKey === todayKey;
            html += `<div class="calendar-day ${hasEpisodes ? 'has-episode' : ''} ${isToday ? 'today' : ''}" data-date="${dateKey}"><span class="calendar-day-number">${day}</span>${hasEpisodes ? '<span class="dot-indicator"></span>' : ''}</div>`;
        }
        calendarGrid.innerHTML = html;
        calendarGrid.querySelectorAll('.calendar-day[data-date]').forEach(day => { day.addEventListener('click', () => { const date = day.dataset.date; if (this.onDateSelect) { this.onDateSelect(date); this.hide(); } }); });
    }
    
    toggle() { this.isVisible = !this.isVisible; const panel = this.container.querySelector('.calendar-panel'); if (panel) panel.classList.toggle('visible', this.isVisible); if (this.isVisible) this.renderCalendar(); }
    show() { this.isVisible = true; const panel = this.container.querySelector('.calendar-panel'); if (panel) panel.classList.add('visible'); this.renderCalendar(); }
    hide() { this.isVisible = false; const panel = this.container.querySelector('.calendar-panel'); if (panel) panel.classList.remove('visible'); }
    
    attachEvents() {
        const prevBtn = this.container.querySelector('.calendar-prev-btn');
        const nextBtn = this.container.querySelector('.calendar-next-btn');
        const closeBtn = this.container.querySelector('.calendar-close-btn');
        if (prevBtn) prevBtn.addEventListener('click', () => { this.currentDate.setMonth(this.currentDate.getMonth() - 1); this.renderCalendar(); });
        if (nextBtn) nextBtn.addEventListener('click', () => { this.currentDate.setMonth(this.currentDate.getMonth() + 1); this.renderCalendar(); });
        if (closeBtn) closeBtn.addEventListener('click', () => this.hide());
    }
}