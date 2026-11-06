'use client';

import { useEffect } from 'react';

/**
 * Empreinte de la machine, pour limiter à un compte par appareil même si les cookies sont effacés :
 * traits stables du matériel et du système (écran, fuseau, processeur, carte graphique, rendu du canvas),
 * réduits à un hachage SHA-256. Aucune donnée personnelle n'est envoyée, seulement ce hachage.
 */
export function DeviceMark() {
  useEffect(() => {
    const run = async () => {
      try {
        if (document.cookie.includes('clap_fp=')) return;
        const canvas = document.createElement('canvas');
        canvas.width = 220;
        canvas.height = 40;
        const g = canvas.getContext('2d');
        if (g) {
          g.textBaseline = 'top';
          g.font = '16px Arial';
          g.fillStyle = '#ff4a1c';
          g.fillRect(4, 4, 90, 22);
          g.fillStyle = '#123456';
          g.fillText('Clap · 35 mm ✦', 6, 8);
        }
        const gl = document.createElement('canvas').getContext('webgl');
        const dbg = gl?.getExtension('WEBGL_debug_renderer_info');
        const gpu = gl && dbg ? `${gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL)}|${gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)}` : '';
        const nav = navigator as Navigator & { deviceMemory?: number };
        const traits = [
          screen.width, screen.height, screen.colorDepth, window.devicePixelRatio,
          Intl.DateTimeFormat().resolvedOptions().timeZone, navigator.hardwareConcurrency, nav.deviceMemory ?? '',
          navigator.platform, gpu, canvas.toDataURL(),
        ].join('§');
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(traits));
        const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 40);
        document.cookie = `clap_fp=${hex}; path=/; max-age=${5 * 365 * 24 * 3600}; samesite=lax${location.protocol === 'https:' ? '; secure' : ''}`;
      } catch {
        // Navigateur trop ancien ou restreint : le cookie d'appareil et la limite par adresse restent actifs.
      }
    };
    void run();
  }, []);
  return null;
}
