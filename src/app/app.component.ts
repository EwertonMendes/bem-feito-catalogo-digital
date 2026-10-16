import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import gsap from 'gsap';
import { Catalog, Fragrance, ProductFormat, VisualSection } from './models/catalog';
import { CatalogService } from './services/catalog.service';

@Component({
  selector: 'bf-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly root = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly formatViewport = viewChild<ElementRef<HTMLElement>>('formatViewport');
  private formatTouchStart: { x: number; y: number } | null = null;
  private formatDrag: { pointerId: number; startX: number; startScrollLeft: number; dragging: boolean } | null = null;
  private preventFormatClick = false;
  private readonly prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly wheelPause = 760;
  private wheelTimestamp = 0;
  private gestureStart: { x: number; y: number } | null = null;
  private transition?: gsap.core.Timeline;
  private readonly number = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  private readonly wheels = (event: WheelEvent): void => this.onWheel(event);
  private readonly keys = (event: KeyboardEvent): void => this.onKeyDown(event);
  private readonly touchStart = (event: TouchEvent): void => this.onTouchStart(event);
  private readonly touchEnd = (event: TouchEvent): void => this.onTouchEnd(event);
  private readonly pointerMove = (event: PointerEvent): void => this.onPointerMove(event);

  readonly catalog = signal<Catalog | null>(null);
  readonly activeIndex = signal(0);
  readonly currentSection = signal<VisualSection>('fragrances');
  readonly isMenuOpen = signal(false);
  readonly isInfoOpen = signal(false);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly selectedFormatId = signal('barra-arredondada');
  readonly transitioning = signal(false);
  readonly formatDragging = signal(false);
  readonly formatHasOverflow = signal(false);
  readonly formatCanScrollLeft = signal(false);
  readonly formatCanScrollRight = signal(false);

  readonly fragrances = computed(() => this.catalog()?.fragrances ?? []);
  readonly formats = computed(() => this.catalog()?.formats ?? []);
  readonly active = computed(() => this.fragrances()[this.activeIndex()] ?? null);
  readonly selectedFormat = computed(() => this.formats().find((f) => f.id === this.selectedFormatId()) ?? null);
  readonly selectedPrice = computed(() => {
    const fragrance = this.active();
    const format = this.selectedFormat();
    return fragrance && format && fragrance.availableFormats.includes(format.id)
      ? this.number.format(format.prices[fragrance.collection]) : 'Indisponível nesta fragrância';
  });
  readonly currentNumber = computed(() => String(this.activeIndex() + 1).padStart(2, '0'));
  readonly totalNumber = computed(() => String(this.fragrances().length).padStart(2, '0'));
  readonly availableFormats = computed(() =>
    this.formats().filter(format => this.active()?.availableFormats.includes(format.id))
  );
  private readonly formatOverflowEffect = effect((onCleanup) => {
    const element = this.formatViewport()?.nativeElement;
    if (!element) return;
    const observer = new ResizeObserver(() => this.refreshFormatArrows(element));
    observer.observe(element);
    for (const child of Array.from(element.children)) observer.observe(child);
    queueMicrotask(() => this.refreshFormatArrows(element));
    onCleanup(() => observer.disconnect());
  });

  ngOnInit(): void {
    this.catalogService.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (catalog) => {
        if (!catalog.fragrances.length) {
          this.error.set(true);
          this.loading.set(false);
          return;
        }
        this.catalog.set(catalog);
        this.selectedFormatId.set(catalog.config.defaultFormat);
        this.loading.set(false);
        this.preloadAssets();
        if (!this.prefersReduced.matches) requestAnimationFrame(() => this.animateInitial());
      },
      error: (reason: unknown) => {
        console.error('Não foi possível carregar o catálogo público', reason);
        this.loading.set(false);
        this.error.set(true);
      }
    });
  }

  ngAfterViewInit(): void {
    window.addEventListener('wheel', this.wheels, { passive: false });
    window.addEventListener('keydown', this.keys);
    window.addEventListener('touchstart', this.touchStart, { passive: true });
    window.addEventListener('touchend', this.touchEnd, { passive: true });
    window.addEventListener('pointermove', this.pointerMove, { passive: true });
  }

  ngOnDestroy(): void {
    window.removeEventListener('wheel', this.wheels);
    window.removeEventListener('keydown', this.keys);
    window.removeEventListener('touchstart', this.touchStart);
    window.removeEventListener('touchend', this.touchEnd);
    window.removeEventListener('pointermove', this.pointerMove);
    this.transition?.kill();
    this.formatDrag = null;
    gsap.killTweensOf('.scene-backdrop, .scene-product, .scene-title, .scene-copy, .scene-button, .ambient-layer');
  }

  private animateInitial(): void {
    if (!this.active()) return;
    gsap.fromTo('.brand-logo', { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power2.out' });
    gsap.fromTo('.format-option', { y: 17, opacity: 0 }, { y: 0, opacity: 1, duration: .75, delay: .33, stagger: .07, ease: 'power2.out' });
    gsap.fromTo('.scene-title', { y: 30, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power3.out' });
    gsap.fromTo('.scene-copy, .scene-button', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .85, stagger: .12, delay: .2, ease: 'power2.out' });
    gsap.fromTo('.scene-product', { scale: 1.055, opacity: .5 }, { scale: 1, opacity: 1, duration: 1.5, ease: 'power2.out' });
  }

  goTo(index: number): void {
    const items = this.fragrances();
    if (!items.length || this.transitioning() || this.isMenuOpen() || this.isInfoOpen()) return;
    const target = (index + items.length) % items.length;
    if (target === this.activeIndex()) return;
    this.wheelTimestamp = Date.now();
    // Changing fragrance does not reset the chosen format.
    if (this.prefersReduced.matches) {
      this.activeIndex.set(target);
      this.preloadAssets();
      return;
    }
    this.transitioning.set(true);
    this.transition?.kill();
    this.transition = gsap.timeline({
      defaults: { ease: 'power3.inOut' },
      onComplete: () => { this.transitioning.set(false); this.preloadAssets(); }
    });
    this.transition
      .to('.scene-product', { opacity: 0, scale: 1.065, xPercent: -1.4, duration: .38 }, 0)
      .to('.scene-backdrop', { opacity: .3, scale: 1.075, duration: .42 }, 0)
      .to('.scene-title, .scene-copy, .scene-button, .scene-eyebrow', { opacity: 0, y: -17, stagger: .025, duration: .23 }, 0)
      .add(() => {
        this.activeIndex.set(target);
        this.cdr.detectChanges();
      }, .43)
      .fromTo('.scene-product', { opacity: 0, scale: 1.1, xPercent: 1.5 }, { opacity: 1, scale: 1, xPercent: 0, duration: .62, ease: 'power3.out' }, .45)
      .fromTo('.scene-backdrop', { opacity: .45, scale: 1.075 }, { opacity: 1, scale: 1.03, duration: .65, ease: 'power2.out' }, .45)
      .fromTo('.scene-title', { opacity: 0, y: 32 }, { opacity: 1, y: 0, duration: .56, ease: 'power3.out' }, .49)
      .fromTo('.scene-eyebrow, .scene-copy, .scene-button', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: .46, stagger: .065, ease: 'power2.out' }, .56);
  }

  step(delta: number): void { this.goTo(this.activeIndex() + delta); }

  openDetails(): void {
    this.isInfoOpen.set(true);
    this.animateSheet('.details-sheet');
  }

  closeDetails(): void { this.isInfoOpen.set(false); }

  setFormat(format: ProductFormat): void {
    if (!this.active()?.availableFormats.includes(format.id)) return;
    this.selectedFormatId.set(format.id);
    requestAnimationFrame(() => this.revealSelectedFormat());
  }

  stepFormat(delta: number): void {
    const options = this.availableFormats();
    if (!options.length) return;
    const index = Math.max(0, options.findIndex(format => format.id === this.selectedFormatId()));
    this.setFormat(options[Math.min(options.length - 1, Math.max(0, index + delta))]);
  }

  formatPrice(format: ProductFormat): string {
    const fragrance = this.active();
    return fragrance?.availableFormats.includes(format.id)
      ? this.formatMoney(format.prices[fragrance.collection]) : 'Indisponível';
  }

  scrollFormats(direction: -1 | 1): void {
    const element = this.formatViewport()?.nativeElement;
    if (!element) return;
    const first = element.querySelector<HTMLElement>('.format-option');
    const step = (first?.offsetWidth ?? 160) + 10;
    const count = Math.max(1, Math.floor(element.clientWidth / step) - 1);
    element.scrollBy({ left: direction * step * count, behavior: this.prefersReduced.matches ? 'instant' : 'smooth' });
  }

  refreshFormatArrows(element = this.formatViewport()?.nativeElement): void {
    if (!element) return;
    const remaining = element.scrollWidth - element.clientWidth;
    this.formatHasOverflow.set(remaining > 3);
    this.formatCanScrollLeft.set(remaining > 3 && element.scrollLeft > 3);
    this.formatCanScrollRight.set(remaining > 3 && element.scrollLeft < remaining - 3);
  }

  onFormatPointerDown(event: PointerEvent): void {
    // Touch stays managed by the existing gesture handler; only mouse drags
    // initiate manual scrolling here, preserving ordinary button clicks.
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.transitioning() ||
        this.isMenuOpen() || this.isInfoOpen()) return;
    const viewport = this.formatViewport()?.nativeElement;
    if (!viewport || viewport.scrollWidth <= viewport.clientWidth + 3) return;
    this.formatDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
      dragging: false
    };
  }

  onFormatPointerMove(event: PointerEvent): void {
    const state = this.formatDrag;
    const viewport = this.formatViewport()?.nativeElement;
    if (!state || !viewport || state.pointerId !== event.pointerId) return;
    const moved = event.clientX - state.startX;
    if (!state.dragging && Math.abs(moved) > 6) {
      state.dragging = true;
      this.formatDragging.set(true);
      viewport.setPointerCapture(event.pointerId);
    }
    if (state.dragging) {
      event.preventDefault();
      viewport.scrollLeft = state.startScrollLeft - moved;
      this.refreshFormatArrows(viewport);
    }
  }

  onFormatPointerEnd(event: PointerEvent): void {
    const state = this.formatDrag;
    if (!state || state.pointerId !== event.pointerId) return;
    this.formatDrag = null;
    if (!state.dragging) return;
    this.formatDragging.set(false);
    this.preventFormatClick = true;
    const viewport = this.formatViewport()?.nativeElement;
    if (viewport?.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    // A click resulting from pointerup is dispatched before the next frame.
    // Block only that click, then restore regular selection.
    requestAnimationFrame(() => this.preventFormatClick = false);
  }

  onFormatPointerLeave(event: PointerEvent): void {
    if (this.formatDrag?.pointerId === event.pointerId && !this.formatDrag.dragging) {
      this.formatDrag = null;
    }
  }

  onFormatClick(event: MouseEvent, format: ProductFormat): void {
    if (this.preventFormatClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    this.setFormat(format);
  }

  onFormatTouchStart(event: TouchEvent): void {
    const touch = event.touches.item(0);
    if (touch) this.formatTouchStart = { x: touch.clientX, y: touch.clientY };
  }

  onFormatTouchEnd(event: TouchEvent): void {
    const start = this.formatTouchStart;
    this.formatTouchStart = null;
    const touch = event.changedTouches.item(0);
    if (!start || !touch || this.isMenuOpen() || this.isInfoOpen() || this.transitioning()) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) > 42 && Math.abs(dx) > Math.abs(dy) * 1.35) this.stepFormat(dx < 0 ? 1 : -1);
  }

  private revealSelectedFormat(): void {
    const viewport = this.formatViewport()?.nativeElement;
    if (!viewport) return;
    const selected = Array.from(viewport.querySelectorAll<HTMLElement>('.format-option'))
      .find(element => element.dataset['formatId'] === this.selectedFormatId());
    if (!selected) return;
    const view = viewport.getBoundingClientRect();
    const card = selected.getBoundingClientRect();
    const offset = card.left < view.left + 4 ? card.left - view.left - 6
      : card.right > view.right - 4 ? card.right - view.right + 6 : 0;
    if (offset) viewport.scrollBy({ left: offset, behavior: this.prefersReduced.matches ? 'instant' : 'smooth' });
  }

  toggleMenu(): void {
    this.isMenuOpen.update((open) => !open);
    if (this.isMenuOpen()) this.animateSheet('.nav-drawer');
  }
  closeMenu(): void { this.isMenuOpen.set(false); }

  private animateSheet(selector: string): void {
    if (this.prefersReduced.matches) return;
    requestAnimationFrame(() => {
      gsap.fromTo(selector, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .4, ease: 'power2.out' });
    });
  }

  openSection(section: VisualSection): void {
    this.closeMenu();
    this.currentSection.set(section);
    if (section === 'fragrances' || section === 'home') {
      this.currentSection.set('fragrances');
      if (section === 'home') this.goTo(0);
      return;
    }
    this.animateSheet('.editorial-dialog');
  }

  closeSection(): void { this.currentSection.set('fragrances'); }

  openInstagram(): void {
    const url = this.catalog()?.brand.instagram;
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
  }

  private onWheel(event: WheelEvent): void {
    if (this.loading() || this.error() || this.isMenuOpen() || this.isInfoOpen() || this.currentSection() !== 'fragrances') return;
    if (event.ctrlKey) return; // preserve browser zoom gestures
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX) || Math.abs(event.deltaY) < 8) return;
    event.preventDefault();
    const now = Date.now();
    if (this.transitioning() || now - this.wheelTimestamp < this.wheelPause) return;
    this.step(event.deltaY > 0 ? 1 : -1);
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      if (this.isInfoOpen()) this.closeDetails();
      else if (this.isMenuOpen()) this.closeMenu();
      else if (this.currentSection() !== 'fragrances') this.closeSection();
      return;
    }
    if (this.isInfoOpen() || this.isMenuOpen() || this.currentSection() !== 'fragrances') return;
    if (event.target instanceof HTMLElement && ['BUTTON', 'INPUT', 'TEXTAREA', 'SELECT', 'A'].includes(event.target.tagName)) return;
    if (['ArrowDown','PageDown'].includes(event.key)) { event.preventDefault(); this.step(1); }
    if (['ArrowUp','PageUp'].includes(event.key)) { event.preventDefault(); this.step(-1); }
    if (event.key === 'ArrowRight') { event.preventDefault(); this.stepFormat(1); }
    if (event.key === 'ArrowLeft') { event.preventDefault(); this.stepFormat(-1); }
  }

  private onTouchStart(event: TouchEvent): void {
    if (this.isMenuOpen() || this.isInfoOpen() || this.currentSection() !== 'fragrances') return;
    const touch = event.touches.item(0);
    const t = event.target;
    if (!touch || !(t instanceof Element) || t.closest('button, a, [role="dialog"], .format-carousel')) return;
    this.gestureStart = { x: touch.clientX, y: touch.clientY };
  }

  private onTouchEnd(event: TouchEvent): void {
    const start = this.gestureStart;
    this.gestureStart = null;
    if (!start || this.transitioning() || this.isMenuOpen() || this.isInfoOpen() || this.currentSection() !== 'fragrances') return;
    const touch = event.changedTouches.item(0);
    if (!touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dy) > 64 && Math.abs(dy) > Math.abs(dx) * 1.2) this.step(dy < 0 ? 1 : -1);
    else if (Math.abs(dx) > 64 && Math.abs(dx) > Math.abs(dy) * 1.2) this.stepFormat(dx < 0 ? 1 : -1);
  }

  private onPointerMove(event: PointerEvent): void {
    if (event.pointerType !== 'mouse' || this.prefersReduced.matches || this.transitioning() || this.isInfoOpen() || this.isMenuOpen() || window.innerWidth < 900) return;
    const area = this.root()?.nativeElement;
    if (!area) return;
    const x = event.clientX / window.innerWidth - .5;
    const y = event.clientY / window.innerHeight - .5;
    gsap.to(area.querySelector('.ambient-layer'), { x: x*16, y: y*12, duration: 1.6, overwrite: true, ease: 'power2.out' });
    gsap.to(area.querySelector('.botanical-foreground'), { x: x*-19, y: y*-12, duration: 1.9, overwrite: true, ease: 'power2.out' });
  }

  private preloadAssets(): void {
    const items = this.fragrances();
    if (!items.length) return;
    const ahead = items[(this.activeIndex() + 1) % items.length];
    const behind = items[(this.activeIndex() + items.length - 1) % items.length];
    const mobile = window.matchMedia('(max-width: 720px), (orientation: portrait) and (max-width: 1200px)').matches;
    for (const item of [ahead, behind]) {
      const path = mobile ? item.images.mobileHero : item.images.desktopHero;
      const image = new Image(); image.src = path;
    }
  }

  formatMoney(value: number): string { return this.number.format(value); }
  isSelected(index: number): boolean { return this.activeIndex() === index; }
}
