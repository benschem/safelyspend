const HEIGHT_PROPERTY = '--visual-viewport-height';
const OFFSET_TOP_PROPERTY = '--visual-viewport-offset-top';

/**
 * Publishes the visible part of the screen as CSS variables, so dialogs can
 * centre and size themselves inside it (see `.dialog-viewport-fit` in index.css).
 *
 * iOS Safari does not shrink the page when the on-screen keyboard opens. Only
 * the visual viewport shrinks, and `position: fixed` ignores it, so a centred
 * dialog ends up behind the keyboard. No CSS unit tracks the keyboard on iOS,
 * which is why this needs script.
 */
export function trackVisualViewport(): void {
  const visualViewport = window.visualViewport;
  if (!visualViewport) return;

  const rootStyle = document.documentElement.style;

  const publishVisibleArea = () => {
    // Pinch-zoom also shrinks the visual viewport. Dialogs should stay put
    // while zoomed, so fall back to the defaults in index.css.
    const isPinchZoomed = Math.abs(visualViewport.scale - 1) > 0.01;
    if (isPinchZoomed) {
      rootStyle.removeProperty(HEIGHT_PROPERTY);
      rootStyle.removeProperty(OFFSET_TOP_PROPERTY);
      return;
    }

    rootStyle.setProperty(HEIGHT_PROPERTY, `${visualViewport.height}px`);
    rootStyle.setProperty(OFFSET_TOP_PROPERTY, `${visualViewport.offsetTop}px`);
  };

  publishVisibleArea();
  // resize fires when the keyboard opens or closes, scroll when iOS pans the
  // page to bring the focused field into view.
  visualViewport.addEventListener('resize', publishVisibleArea);
  visualViewport.addEventListener('scroll', publishVisibleArea);
}
