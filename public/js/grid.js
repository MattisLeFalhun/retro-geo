// Grid Component for Retro-Geo
// 2D grid with Expected/Surprising (Y) and Negative/Positive (X) axes

class Grid {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        this.options = {
            size: options.size || 400,
            padding: options.padding || 50,
            interactive: options.interactive !== false,
            onSelect: options.onSelect || null,
            showLabels: options.showLabels !== false
        };

        this.canvas.width = this.options.size;
        this.canvas.height = this.options.size;

        this.selectedPoint = null;
        this.points = [];

        this.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
            '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
            '#BB8FCE', '#85C1E9'
        ];
        this.colorMap = {};

        if (this.options.interactive) {
            this.canvas.addEventListener('click', this.handleClick.bind(this));
            this.canvas.style.cursor = 'crosshair';
        }

        this.draw();
    }

    // Convert pixel coordinates to grid coordinates (-1 to 1)
    pixelToGrid(x, y) {
        const gridSize = this.options.size - 2 * this.options.padding;
        const gridX = ((x - this.options.padding) / gridSize) * 2 - 1;
        const gridY = -(((y - this.options.padding) / gridSize) * 2 - 1); // Inverted Y
        return {
            x: Math.max(-1, Math.min(1, gridX)),
            y: Math.max(-1, Math.min(1, gridY))
        };
    }

    // Convert grid coordinates to pixel coordinates
    gridToPixel(x, y) {
        const gridSize = this.options.size - 2 * this.options.padding;
        const pixelX = ((x + 1) / 2) * gridSize + this.options.padding;
        const pixelY = ((-y + 1) / 2) * gridSize + this.options.padding; // Inverted Y
        return { x: pixelX, y: pixelY };
    }

    handleClick(event) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        // Check if click is within grid area
        const padding = this.options.padding;
        if (x < padding || x > this.options.size - padding ||
            y < padding || y > this.options.size - padding) {
            return;
        }

        this.selectedPoint = this.pixelToGrid(x, y);
        this.draw();

        if (this.options.onSelect) {
            this.options.onSelect(this.selectedPoint);
        }
    }

    // Set a single selected point (for input mode)
    setSelectedPoint(x, y) {
        this.selectedPoint = { x, y };
        this.draw();
    }

    // Clear the selected point
    clearSelection() {
        this.selectedPoint = null;
        this.draw();
    }

    // Add multiple points (for reveal mode)
    setPoints(points) {
        // points: [{ name: 'string', x: number, y: number, isOriginal?: boolean }]
        this.points = points;
        this.draw();
    }

    // Clear all points
    clearPoints() {
        this.points = [];
        this.colorMap = {};
        this.draw();
    }

    // Get color for a person
    getColorForPerson(name) {
        if (!this.colorMap[name]) {
            const usedColors = Object.values(this.colorMap);
            const availableColors = this.colors.filter(c => !usedColors.includes(c));
            this.colorMap[name] = availableColors.length > 0
                ? availableColors[0]
                : this.colors[Object.keys(this.colorMap).length % this.colors.length];
        }
        return this.colorMap[name];
    }

    draw() {
        const ctx = this.ctx;
        const size = this.options.size;
        const padding = this.options.padding;
        const gridSize = size - 2 * padding;

        // Clear canvas
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, size, size);

        // Draw grid background
        ctx.fillStyle = '#16213e';
        ctx.fillRect(padding, padding, gridSize, gridSize);

        // Draw grid lines
        ctx.strokeStyle = '#0f3460';
        ctx.lineWidth = 1;

        // Vertical lines
        for (let i = 0; i <= 10; i++) {
            const x = padding + (i / 10) * gridSize;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, size - padding);
            ctx.stroke();
        }

        // Horizontal lines
        for (let i = 0; i <= 10; i++) {
            const y = padding + (i / 10) * gridSize;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(size - padding, y);
            ctx.stroke();
        }

        // Draw center lines (axes)
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;

        // Vertical center line
        ctx.beginPath();
        ctx.moveTo(size / 2, padding);
        ctx.lineTo(size / 2, size - padding);
        ctx.stroke();

        // Horizontal center line
        ctx.beginPath();
        ctx.moveTo(padding, size / 2);
        ctx.lineTo(size - padding, size / 2);
        ctx.stroke();

        // Draw labels
        if (this.options.showLabels) {
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';

            // X-axis labels
            ctx.fillStyle = '#ff6b6b';
            ctx.fillText('Negative', padding + 40, size - padding + 25);
            ctx.fillStyle = '#4ecdc4';
            ctx.fillText('Positive', size - padding - 40, size - padding + 25);

            // Y-axis labels
            ctx.save();
            ctx.translate(padding - 25, size / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#ffeaa7';
            ctx.fillText('Expected', -gridSize / 4, 0);
            ctx.fillStyle = '#a29bfe';
            ctx.fillText('Surprising', gridSize / 4, 0);
            ctx.restore();
        }

        // Draw multiple points (reveal mode)
        this.points.forEach(point => {
            const pixel = this.gridToPixel(point.x, point.y);
            const color = point.isOriginal ? '#FFD700' : this.getColorForPerson(point.name);
            const radius = point.isOriginal ? 12 : 8;

            // Draw point
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.strokeStyle = point.isOriginal ? '#FFF' : '#333';
            ctx.lineWidth = point.isOriginal ? 3 : 2;
            ctx.stroke();

            // Draw name label
            ctx.font = point.isOriginal ? 'bold 12px Arial' : '11px Arial';
            ctx.fillStyle = '#FFF';
            ctx.textAlign = 'center';
            ctx.fillText(point.name, pixel.x, pixel.y - radius - 5);
        });

        // Draw selected point (input mode)
        if (this.selectedPoint) {
            const pixel = this.gridToPixel(this.selectedPoint.x, this.selectedPoint.y);

            // Draw crosshair
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);

            ctx.beginPath();
            ctx.moveTo(pixel.x, padding);
            ctx.lineTo(pixel.x, size - padding);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(padding, pixel.y);
            ctx.lineTo(size - padding, pixel.y);
            ctx.stroke();

            ctx.setLineDash([]);

            // Draw point
            ctx.beginPath();
            ctx.arc(pixel.x, pixel.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = '#e94560';
            ctx.fill();
            ctx.strokeStyle = '#FFF';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
    }

    // Get the current selection
    getSelection() {
        return this.selectedPoint;
    }

    // Disable interaction
    disable() {
        this.options.interactive = false;
        this.canvas.style.cursor = 'default';
        this.canvas.removeEventListener('click', this.handleClick.bind(this));
    }

    // Enable interaction
    enable() {
        this.options.interactive = true;
        this.canvas.style.cursor = 'crosshair';
    }
}
