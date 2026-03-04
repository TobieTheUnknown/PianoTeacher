import { useRef, useEffect, useCallback, useState } from 'react';

/**
 * Hook optimisé pour gérer plusieurs layers de canvas
 * Permet de redessiner uniquement les layers qui changent
 * Supports dynamic dimensions and devicePixelRatio for HD screens
 *
 * @param {number} width - Largeur logique du canvas
 * @param {number} height - Hauteur logique du canvas
 * @returns {Object} Références aux canvas et fonctions de rendu
 */
export const useCanvasLayers = (width, height) => {
  // Layer statique: grille, mesures, etc. (rarement mis à jour)
  const staticLayerRef = useRef(null);

  // Layer dynamique: notes qui tombent, animations
  const dynamicLayerRef = useRef(null);

  // Layer overlay: feedback, UI overlays
  const overlayLayerRef = useRef(null);

  // Container pour tous les canvas
  const containerRef = useRef(null);

  // Track if canvases are mounted
  const [mounted, setMounted] = useState(false);

  // Flags pour savoir quels layers ont besoin d'être redessinés
  const needsRedrawRef = useRef({
    static: true,
    dynamic: true,
    overlay: true
  });

  // Helper function to setup a canvas with DPR scaling
  const setupCanvas = useCallback((canvas, w, h) => {
    if (!canvas) return null;

    const dpr = window.devicePixelRatio || 1;
    const ctx = canvas.getContext('2d', { alpha: true });

    // Set physical (pixel) size
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Scale context so drawing operations use logical coordinates
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Optimisations rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    return ctx;
  }, []);

  // Mark as mounted after first render
  useEffect(() => {
    // Use requestAnimationFrame to ensure DOM is ready
    const frameId = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(frameId);
  }, []);

  // Setup canvases when dimensions change or after mount
  useEffect(() => {
    if (!mounted) return;

    // Setup each canvas if it exists
    if (staticLayerRef.current) setupCanvas(staticLayerRef.current, width, height);
    if (dynamicLayerRef.current) setupCanvas(dynamicLayerRef.current, width, height);
    if (overlayLayerRef.current) setupCanvas(overlayLayerRef.current, width, height);

    // Mark all layers as needing redraw after resize
    needsRedrawRef.current.static = true;
    needsRedrawRef.current.dynamic = true;
    needsRedrawRef.current.overlay = true;
  }, [width, height, mounted, setupCanvas]);

  // Fonctions pour marquer les layers à redessiner
  const markStaticDirty = useCallback(() => {
    needsRedrawRef.current.static = true;
  }, []);

  const markDynamicDirty = useCallback(() => {
    needsRedrawRef.current.dynamic = true;
  }, []);

  const markOverlayDirty = useCallback(() => {
    needsRedrawRef.current.overlay = true;
  }, []);

  // Fonction pour dessiner sur un layer spécifique
  const drawLayer = useCallback((layerName, drawFn) => {
    let canvas;
    if (layerName === 'static') canvas = staticLayerRef.current;
    else if (layerName === 'dynamic') canvas = dynamicLayerRef.current;
    else if (layerName === 'overlay') canvas = overlayLayerRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = window.devicePixelRatio || 1;

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Restore DPR scaling for drawing
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Dessiner
    drawFn(ctx);

    // Marquer comme à jour
    needsRedrawRef.current[layerName] = false;
  }, []);

  // Clear un layer spécifique
  const clearLayer = useCallback((layerName) => {
    let canvas;
    if (layerName === 'static') canvas = staticLayerRef.current;
    else if (layerName === 'dynamic') canvas = dynamicLayerRef.current;
    else if (layerName === 'overlay') canvas = overlayLayerRef.current;

    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  return {
    containerRef,
    staticLayerRef,
    dynamicLayerRef,
    overlayLayerRef,
    drawLayer,
    clearLayer,
    markStaticDirty,
    markDynamicDirty,
    markOverlayDirty,
    needsRedraw: needsRedrawRef
  };
};
