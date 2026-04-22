export function triggerCartFlyAnimation(sourceEl: HTMLElement) {
  const sourceRect = sourceEl.getBoundingClientRect();

  // Find cart icon (data-cart-icon="true" on the cart Link in client.layout.tsx)
  const cartEl = document.querySelector('[data-cart-icon]');
  if (!cartEl) return;
  const cartRect = cartEl.getBoundingClientRect();

  const flyEl = document.createElement('div');
  flyEl.style.cssText = `
    position: fixed;
    left: ${sourceRect.left + sourceRect.width / 2 - 16}px;
    top: ${sourceRect.top + sourceRect.height / 2 - 16}px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: #006241;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-size: 14px;
    z-index: 9999;
    pointer-events: none;
    transition: none;
  `;
  flyEl.innerHTML = '🛒';

  document.body.appendChild(flyEl);

  const dx = cartRect.left + cartRect.width / 2 - (sourceRect.left + sourceRect.width / 2);
  const dy = cartRect.top + cartRect.height / 2 - (sourceRect.top + sourceRect.height / 2);

  flyEl.style.setProperty('--fly-x', `${dx}px`);
  flyEl.style.setProperty('--fly-y', `${dy}px`);
  flyEl.classList.add('fly-to-cart');

  flyEl.addEventListener('animationend', () => {
    flyEl.remove();
    // Brief cart icon bounce
    cartEl.classList.add('cart-bounce');
    setTimeout(() => cartEl.classList.remove('cart-bounce'), 300);
  });
}
