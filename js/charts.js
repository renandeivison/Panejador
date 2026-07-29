// charts.js — gráficos SVG simples, sem dependências externas (necessário para funcionamento offline).

const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, attrs = {}) {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
    return n;
  }

  function barChart({ data, width = 320, height = 180, color = '#3f6fe0', onBarClick, formatValue }) {
    // data: [{ label, value }]
    const wrap = UI.el('div', { class: 'chart-wrap glass' });
    const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: height });
    const barW = data.length ? (width / data.length) * 0.55 : 0;
    const gap = data.length ? (width / data.length) : 0;

    data.forEach((d, i) => {
      const h = Math.max(2, (Math.abs(d.value) / max) * (height - 34));
      const x = i * gap + (gap - barW) / 2;
      const y = height - h - 20;
      const rect = svgEl('rect', { x, y, width: barW, height: h, rx: 6, fill: d.color || color, opacity: 0.9, style: 'cursor:pointer;transition:opacity .2s' });
      rect.addEventListener('mouseenter', () => rect.setAttribute('opacity', '1'));
      rect.addEventListener('mouseleave', () => rect.setAttribute('opacity', '0.9'));
      if (onBarClick) rect.addEventListener('click', () => onBarClick(d, i));
      svg.appendChild(rect);
      const label = svgEl('text', { x: x + barW / 2, y: height - 6, 'text-anchor': 'middle', 'font-size': '9', fill: '#6b6f7d', 'font-family': 'inherit' });
      label.textContent = d.label;
      svg.appendChild(label);
      const valText = svgEl('text', { x: x + barW / 2, y: y - 5, 'text-anchor': 'middle', 'font-size': '9', 'font-weight': '700', fill: '#40434f' });
      valText.textContent = formatValue ? formatValue(d.value) : d.value;
      svg.appendChild(valText);
    });
    wrap.appendChild(svg);
    return wrap;
  }

  function donutChart({ data, size = 200, onSliceClick }) {
    // data: [{ label, value, color }]
    const total = data.reduce((a, d) => a + d.value, 0) || 1;
    const wrap = UI.el('div', { class: 'flex items-center gap-12', style: 'flex-wrap:wrap' });
    const strokeWidth = 22;
    const svg = svgEl('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, style: `max-width:${size}px;width:100%;height:auto` });
    const r = size / 2 - strokeWidth / 2 - 4;
    const cx = size / 2, cy = size / 2;
    let angleStart = -90;

    if (data.length === 0 || total === 0) {
      const circle = svgEl('circle', { cx, cy, r, fill: 'none', stroke: '#e5e7eb', 'stroke-width': strokeWidth });
      svg.appendChild(circle);
    } else {
      data.forEach((d) => {
        const angle = (d.value / total) * 360;
        const path = describeArc(cx, cy, r, angleStart, angleStart + angle);
        const p = svgEl('path', { d: path, fill: 'none', stroke: d.color, 'stroke-width': strokeWidth, 'stroke-linecap': data.length > 1 ? 'butt' : 'round', style: 'cursor:pointer' });
        if (onSliceClick) p.addEventListener('click', () => onSliceClick(d));
        svg.appendChild(p);
        angleStart += angle;
      });
    }
    const centerText = svgEl('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', 'font-size': '11', fill: '#6b6f7d', 'font-weight': '700' });
    centerText.textContent = 'Total';
    svg.appendChild(centerText);
    const centerVal = svgEl('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', 'font-size': '13', fill: '#14161f', 'font-weight': '800' });
    centerVal.textContent = UI.fmtMoney(total);
    svg.appendChild(centerVal);

    const legend = UI.el('div', { class: 'flex-col gap-8', style: 'min-width:140px' });
    data.forEach((d) => {
      legend.appendChild(UI.el('div', { class: 'flex items-center gap-8', style: 'cursor:pointer', onclick: () => onSliceClick && onSliceClick(d) }, [
        UI.el('span', { style: `width:10px;height:10px;border-radius:3px;background:${d.color};flex-shrink:0` }),
        UI.el('span', { class: 'text-xs', style: 'flex:1' }, d.label),
        UI.el('span', { class: 'text-xs', style: 'font-weight:700' }, UI.fmtMoney(d.value)),
      ]));
    });

    wrap.appendChild(svg);
    wrap.appendChild(legend);
    return wrap;
  }

  function polarToCartesian(cx, cy, r, angleDeg) {
    const a = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }
  function describeArc(cx, cy, r, startAngle, endAngle) {
    const start = polarToCartesian(cx, cy, r, endAngle - 0.001);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  function lineChart({ data, width = 340, height = 160, color = '#3f6fe0', onPointClick, formatValue }) {
    // data: [{ label, value }]
    const wrap = UI.el('div', { class: 'chart-wrap glass' });
    const values = data.map((d) => d.value);
    const max = Math.max(...values, 0);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const padX = 24, padY = 22;
    const stepX = data.length > 1 ? (width - padX * 2) / (data.length - 1) : 0;

    const points = data.map((d, i) => {
      const x = padX + i * stepX;
      const y = height - padY - ((d.value - min) / range) * (height - padY * 2);
      return { x, y, d };
    });

    const svg = svgEl('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height });
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    const areaD = `${pathD} L ${points[points.length - 1]?.x || 0} ${height - padY} L ${points[0]?.x || 0} ${height - padY} Z`;
    svg.appendChild(svgEl('path', { d: areaD, fill: color, opacity: 0.08 }));
    svg.appendChild(svgEl('path', { d: pathD, fill: 'none', stroke: color, 'stroke-width': 2.4 }));
    points.forEach((p) => {
      const c = svgEl('circle', { cx: p.x, cy: p.y, r: 4, fill: '#fff', stroke: color, 'stroke-width': 2.4, style: 'cursor:pointer' });
      if (onPointClick) c.addEventListener('click', () => onPointClick(p.d));
      svg.appendChild(c);
      const label = svgEl('text', { x: p.x, y: height - 4, 'text-anchor': 'middle', 'font-size': '8.5', fill: '#6b6f7d' });
      label.textContent = p.d.label;
      svg.appendChild(label);
    });
    wrap.appendChild(svg);
    return wrap;
  }

  return { barChart, donutChart, lineChart };
})();

window.Charts = Charts;
