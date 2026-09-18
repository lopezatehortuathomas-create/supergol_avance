export function renderBarChart(containerId, data, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return null;

    destroyChart(containerId);

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">Sin datos para mostrar</div>';
        return null;
    }

    const {
        horizontal = true,
        barColor = '#2D6A4F',
        height = 300
    } = options;

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = height + 'px';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    
    const draw = () => {
        const rect = container.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

        const w = rect.width;
        const h = height;

        ctx.clearRect(0, 0, w, h);

        const maxValue = Math.max(...data.map(d => d.value)) || 1;
        
        ctx.font = '14px system-ui, -apple-system, sans-serif';
        ctx.textBaseline = 'middle';

        if (horizontal) {
            const padding = 40;
            const labelWidth = 120;
            const barMaxWidth = w - labelWidth - padding * 2;
            const barHeight = Math.min((h - padding * 2) / data.length - 10, 40);

            data.forEach((item, i) => {
                const y = padding + i * (h - padding * 2) / data.length;
                const barWidth = (item.value / maxValue) * barMaxWidth;

                // Draw label
                ctx.fillStyle = '#333';
                ctx.textAlign = 'right';
                ctx.fillText(item.label.substring(0, 15) + (item.label.length > 15 ? '...' : ''), labelWidth - 10, y + barHeight / 2);

                // Draw bar
                ctx.fillStyle = item.color || barColor;
                ctx.beginPath();
                ctx.roundRect(labelWidth, y, Math.max(barWidth, 2), barHeight, 4);
                ctx.fill();

                // Draw value
                ctx.fillStyle = '#666';
                ctx.textAlign = 'left';
                ctx.fillText(item.value.toString(), labelWidth + barWidth + 10, y + barHeight / 2);
            });
        }
    };

    draw();
    
    const resizeObserver = new ResizeObserver(() => {
        requestAnimationFrame(draw);
    });
    resizeObserver.observe(container);

    container._chartObserver = resizeObserver;

    return () => destroyChart(containerId);
}

export function destroyChart(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (container._chartObserver) {
        container._chartObserver.disconnect();
        delete container._chartObserver;
    }
    container.innerHTML = '';
}
