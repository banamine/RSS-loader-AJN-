// ============ QUEUE MANAGER COMPONENT ==========
import { escapeHtml, showToast } from '../utils/helpers.js';

export class QueueManager {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.queue = [];
        this.draggedItem = null;
        this.dragOverItem = null;
        this.onPlayCallback = null;
        
        this.loadQueue();
        this.render();
        this.setupDragAndDrop();
    }
    
    loadQueue() {
        try {
            const saved = localStorage.getItem('userQueue');
            if (saved) {
                this.queue = JSON.parse(saved);
            }
        } catch (error) {
            this.queue = [];
        }
        this.updateStats();
    }
    
    saveQueue() {
        localStorage.setItem('userQueue', JSON.stringify(this.queue));
        this.updateStats();
    }
    
    updateStats() {
        const statsElement = document.querySelector('#queueSection .queue-stats');
        if (statsElement) {
            statsElement.textContent = `${this.queue.length} item${this.queue.length !== 1 ? 's' : ''}`;
        }
    }
    
    setOnPlay(callback) {
        this.onPlayCallback = callback;
    }
    
    addToQueue(episode) {
        if (!episode) return;
        
        const queueItem = {
            id: episode.id,
            title: episode.title,
            show: episode.show,
            hour: episode.hour,
            centralDate: episode.centralDate,
            videoUrl: episode.videoUrl
        };
        
        this.queue.push(queueItem);
        this.saveQueue();
        this.render();
        showToast(`Added "${episode.title.substring(0, 40)}..." to queue`);
    }
    
    removeFromQueue(index) {
        if (index < 0 || index >= this.queue.length) return;
        this.queue.splice(index, 1);
        this.saveQueue();
        this.render();
        showToast('Removed from queue');
    }
    
    clearQueue() {
        if (this.queue.length === 0) return;
        if (confirm(`Clear ${this.queue.length} item${this.queue.length !== 1 ? 's' : ''} from queue?`)) {
            this.queue = [];
            this.saveQueue();
            this.render();
            showToast('Queue cleared');
        }
    }
    
    playQueueItem(index) {
        const item = this.queue[index];
        if (item && this.onPlayCallback) {
            this.onPlayCallback(item);
        }
    }
    
    setupDragAndDrop() {
        if (!this.container) return;
        
        this.container.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.queue-item');
            if (!item) return;
            this.draggedItem = item;
            item.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/html', item.innerHTML);
        });
        
        this.container.addEventListener('dragend', () => {
            if (this.draggedItem) this.draggedItem.classList.remove('dragging');
            document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('drag-over'));
            this.draggedItem = null;
            this.dragOverItem = null;
        });
        
        this.container.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const targetItem = e.target.closest('.queue-item');
            if (!targetItem || targetItem === this.draggedItem) return;
            document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('drag-over'));
            targetItem.classList.add('drag-over');
            this.dragOverItem = targetItem;
        });
        
        this.container.addEventListener('drop', (e) => {
            e.preventDefault();
            if (!this.draggedItem || !this.dragOverItem) return;
            
            const fromIndex = parseInt(this.draggedItem.dataset.index);
            const toIndex = parseInt(this.dragOverItem.dataset.index);
            
            if (!isNaN(fromIndex) && !isNaN(toIndex) && fromIndex !== toIndex) {
                const [movedItem] = this.queue.splice(fromIndex, 1);
                this.queue.splice(toIndex, 0, movedItem);
                this.saveQueue();
                this.render();
                showToast('Queue reordered');
            }
            
            this.draggedItem.classList.remove('dragging');
            document.querySelectorAll('.queue-item').forEach(el => el.classList.remove('drag-over'));
            this.draggedItem = null;
            this.dragOverItem = null;
        });
    }
    
    render() {
        if (!this.container) return;
        
        if (this.queue.length === 0) {
            this.container.innerHTML = '<div class="empty-queue">Queue is empty. Use "Add to Queue" on any episode.</div>';
            return;
        }
        
        this.container.innerHTML = `
            <div class="queue-header">
                <h3>📋 Play Queue <span class="queue-stats">${this.queue.length} items</span></h3>
                <button class="clear-queue-btn" aria-label="Clear queue">Clear Queue</button>
            </div>
            <div class="queue-items">
                ${this.queue.map((item, index) => `
                    <div class="queue-item" draggable="true" data-index="${index}">
                        <span class="drag-handle" draggable="false">⠿</span>
                        <div class="queue-info" onclick="window.playFromQueue(${index})">
                            <div class="queue-title">${escapeHtml(item.title)}</div>
                            <div class="queue-date">${item.show} ${item.hour}</div>
                        </div>
                        <button class="remove-queue-item" onclick="event.stopPropagation(); window.removeFromQueue(${index})">×</button>
                    </div>
                `).join('')}
            </div>
        `;
        
        const clearBtn = this.container.querySelector('.clear-queue-btn');
        if (clearBtn) clearBtn.addEventListener('click', () => this.clearQueue());
        
        this.setupDragAndDrop();
    }
}