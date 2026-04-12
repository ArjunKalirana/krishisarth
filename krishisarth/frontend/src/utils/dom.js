/**
 * KrishiSarth DOM Utilities
 */

/**
 * Animates a numeric value from 0 to target.
 * @param {HTMLElement} el 
 * @param {number} target 
 * @param {number} duration 
 */
export function countUp(el, target, duration = 1500) {
    if (!el) return;
    const startValue = 0;
    const endValue = parseFloat(target) || 0;
    if (isNaN(endValue)) return;
    
    let startTime = null;

    function animation(currentTime) {
        if (!startTime) startTime = currentTime;
        const progress = Math.min((currentTime - startTime) / duration, 1);
        const value = progress * (endValue - startValue) + startValue;
        
        // Show decimals if endValue is small or explicitly formatted
        if (endValue < 10 && endValue % 1 !== 0) {
            el.textContent = value.toFixed(1);
        } else {
            el.textContent = Math.floor(value).toLocaleString();
        }

        if (progress < 1) {
            requestAnimationFrame(animation);
        } else {
            el.textContent = endValue.toLocaleString();
        }
    }

    requestAnimationFrame(animation);
}
