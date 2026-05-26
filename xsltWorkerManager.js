// ============ XSLT WORKER MANAGER ============
// Manages the Web Worker lifecycle and message queuing

export class XsltWorkerManager {
    constructor() {
        this.worker = null;
        this.callbacks = new Map();
        this.messageId = 0;
        this.isReady = false;
        this.pendingMessages = [];
        this.retryCount = 0;
        this.maxRetries = 3;
    }
    
    init() {
        return new Promise((resolve, reject) => {
            try {
                this.worker = new Worker('js/workers/xslt-worker.js', { type: 'module' });
                
                this.worker.onmessage = (e) => {
                    const { type, data, id } = e.data;
                    
                    if (type === 'ready') {
                        this.isReady = true;
                        console.log('XSLT Worker ready');
                        this.processPendingMessages();
                        resolve();
                    } else if (type === 'pong') {
                        console.log('Worker ping response:', data);
                    } else if (this.callbacks.has(id)) {
                        const callback = this.callbacks.get(id);
                        callback(data);
                        this.callbacks.delete(id);
                    }
                };
                
                this.worker.onerror = (error) => {
                    console.error('Worker error:', error);
                    this.handleWorkerError();
                    reject(error);
                };
                
                // Send ping to verify worker is responsive
                setTimeout(() => {
                    if (this.isReady) {
                        this.sendMessage('ping', {}).then(() => {
                            console.log('Worker verified responsive');
                        }).catch(() => {
                            console.warn('Worker ping failed');
                        });
                    }
                }, 100);
                
            } catch (error) {
                console.error('Failed to initialize worker:', error);
                reject(error);
            }
        });
    }
    
    processPendingMessages() {
        while (this.pendingMessages.length > 0) {
            const { message, resolve, reject } = this.pendingMessages.shift();
            this.sendMessageInternal(message, resolve, reject);
        }
    }
    
    sendMessageInternal(message, resolve, reject) {
        if (!this.isReady) {
            this.pendingMessages.push({ message, resolve, reject });
            return;
        }
        
        const id = this.messageId++;
        this.callbacks.set(id, resolve);
        
        try {
            this.worker.postMessage({ ...message, id });
        } catch (error) {
            this.callbacks.delete(id);
            reject(error);
        }
    }
    
    sendMessage(type, data) {
        return new Promise((resolve, reject) => {
            this.sendMessageInternal({ type, data }, resolve, reject);
        });
    }
    
    transformFeed(xmlText, xsltText, options = {}) {
        return this.sendMessage('transform', {
            xmlText,
            xsltText,
            useChunking: options.useChunking !== false
        });
    }
    
    handleWorkerError() {
        this.retryCount++;
        
        if (this.retryCount <= this.maxRetries) {
            console.log(`Retrying worker initialization (${this.retryCount}/${this.maxRetries})...`);
            setTimeout(() => {
                this.init().catch(err => {
                    console.error('Worker re-initialization failed:', err);
                });
            }, 1000 * this.retryCount);
        } else {
            console.error('Worker failed after maximum retries');
            this.isReady = false;
            this.worker = null;
            
            // Notify all pending callbacks of failure
            this.callbacks.forEach((callback, id) => {
                callback({ success: false, error: 'Worker unavailable' });
                this.callbacks.delete(id);
            });
        }
    }
    
    terminate() {
        if (this.worker) {
            this.sendMessage('terminate', {});
            setTimeout(() => {
                this.worker.terminate();
                this.worker = null;
                this.isReady = false;
            }, 100);
        }
    }
    
    isWorkerReady() {
        return this.isReady && this.worker !== null;
    }
}

// Singleton instance
let workerManagerInstance = null;

export function getWorkerManager() {
    if (!workerManagerInstance) {
        workerManagerInstance = new XsltWorkerManager();
    }
    return workerManagerInstance;
}