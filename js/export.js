// export.js — Gera uma imagem PNG do recibo de uma pessoa (para compartilhar/enviar),
// desenhada em canvas replicando o visual da tela de recibo. Sem dependências externas.
const ReceiptExport = (() => {
  const COLORS = {
    bg: '#ffffff',
    ink900: '#14161f',
    ink700: '#40434f',
    ink500: '#6b6f7d',
    ink300: '#9a9db0',
    amber: '#d98a1c',
    divider: 'rgba(20,22,31,0.18)',
  };
  const FONT_DISPLAY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const FONT_BODY = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

  function truncate(ctx, text, maxWidth) {
    if (ctx.measureText(text).width <= maxWidth) return text;
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
    return t + '…';
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // rows: [{ title, meta, valueLabel }], todos já formatados como string.
  function buildCanvas({ personName, subtitle, rows, totalLabel, totalValue, footer }) {
    const W = 420;
    const rowH = 44;
    const headerH = 84;
    const totalH = 60;
    const footerH = 32;
    const padX = 20;
    const H = headerH + Math.max(rows.length, 1) * rowH + totalH + footerH + 20;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // fundo
    ctx.fillStyle = '#eef1f8';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = COLORS.bg;
    roundRect(ctx, 8, 8, W - 16, H - 16, 20);
    ctx.fill();

    let y = 34;
    // cabeçalho
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.ink900;
    ctx.font = `800 18px ${FONT_DISPLAY}`;
    ctx.fillText(personName, W / 2, y);
    y += 18;
    ctx.fillStyle = COLORS.ink500;
    ctx.font = `500 10.5px ${FONT_BODY}`;
    wrapCenteredText(ctx, subtitle, W / 2, y, W - padX * 2, 13);
    y += subtitleLines(ctx, subtitle, W - padX * 2) * 13 + 10;

    // divisor tracejado
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.divider;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 22;

    ctx.textAlign = 'left';
    if (!rows.length) {
      ctx.fillStyle = COLORS.ink500;
      ctx.font = `500 12px ${FONT_BODY}`;
      ctx.textAlign = 'center';
      ctx.fillText('Nenhuma compra vinculada', W / 2, y + 8);
      ctx.fillText('neste período.', W / 2, y + 24);
      ctx.textAlign = 'left';
      y += rowH;
    } else {
      rows.forEach((r) => {
        const valueX = W - padX;
        ctx.font = `700 12.5px ${FONT_DISPLAY}`;
        const valueW = ctx.measureText(r.valueLabel).width;
        const titleMaxWidth = (valueX - valueW - 10) - padX;

        ctx.fillStyle = COLORS.ink900;
        ctx.font = `650 12.5px ${FONT_BODY}`;
        ctx.fillText(truncate(ctx, r.title, titleMaxWidth), padX, y);

        ctx.fillStyle = COLORS.ink500;
        ctx.font = `500 9.5px ${FONT_BODY}`;
        ctx.fillText(truncate(ctx, r.meta, titleMaxWidth), padX, y + 14);

        ctx.fillStyle = COLORS.ink900;
        ctx.font = `700 12.5px ${FONT_DISPLAY}`;
        ctx.textAlign = 'right';
        ctx.fillText(r.valueLabel, valueX, y + 4);
        ctx.textAlign = 'left';

        y += rowH;
      });
    }

    // divisor + total
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = COLORS.divider;
    ctx.beginPath();
    ctx.moveTo(padX, y);
    ctx.lineTo(W - padX, y);
    ctx.stroke();
    ctx.setLineDash([]);
    y += 26;

    ctx.fillStyle = COLORS.ink700;
    ctx.font = `700 12px ${FONT_DISPLAY}`;
    const totalLabelMaxW = W - padX * 2 - 90;
    ctx.fillText(truncate(ctx, totalLabel, totalLabelMaxW), padX, y);
    ctx.fillStyle = COLORS.amber;
    ctx.font = `800 18px ${FONT_DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.fillText(totalValue, W - padX, y + 1);
    ctx.textAlign = 'center';
    y += 30;

    ctx.fillStyle = COLORS.ink300;
    ctx.font = `500 9.5px ${FONT_BODY}`;
    ctx.fillText(footer, W / 2, y);

    return canvas;
  }

  // Dica de "quanto eu gastei" pode ser longa — quebra em até 2 linhas centralizadas.
  function subtitleLines(ctx, text, maxWidth) {
    return ctx.measureText(text).width <= maxWidth ? 1 : 2;
  }
  function wrapCenteredText(ctx, text, cx, y, maxWidth, lineHeight) {
    if (ctx.measureText(text).width <= maxWidth) { ctx.fillText(text, cx, y); return; }
    const words = text.split(' ');
    let line1 = '';
    let i = 0;
    while (i < words.length && ctx.measureText(line1 + words[i] + ' ').width <= maxWidth) { line1 += words[i] + ' '; i++; }
    const line2 = words.slice(i).join(' ');
    ctx.fillText(line1.trim(), cx, y);
    ctx.fillText(line2, cx, y + lineHeight);
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
  }

  // Gera a imagem e tenta compartilhar diretamente (Web Share API, com arquivo);
  // se não for suportado no dispositivo/navegador, baixa o PNG.
  async function exportAndShare({ personName, subtitle, rows, totalLabel, totalValue, footer, fileName }) {
    const canvas = buildCanvas({ personName, subtitle, rows, totalLabel, totalValue, footer });
    const blob = await canvasToBlob(canvas);
    if (!blob) { UI.toast('Não foi possível gerar a imagem.', 'error'); return; }
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: `Recibo — ${personName}`, text: `Recibo de ${personName}` });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // usuário cancelou o compartilhamento
        // se falhar por outro motivo, cai para o download abaixo
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    UI.toast('Imagem do recibo baixada.', 'success');
  }

  return { exportAndShare };
})();
window.ReceiptExport = ReceiptExport;
