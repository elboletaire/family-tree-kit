/* jsdom implements neither scrolling nor ResizeObserver; and, without `globals`, each test unmounts by hand what it renders */
import { cleanup } from '@solidjs/testing-library';
import { afterEach } from 'vitest';

Element.prototype.scrollIntoView = function () {};
Element.prototype.scrollTo = function () {};
window.scrollTo = () => {};
globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} };
afterEach(cleanup);
