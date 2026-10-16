import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  NgZone,
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
import { FormatMedallionComponent } from './components/format-medallion/format-medallion.component';

@Component({
  selector: 'bf-root',
  standalone: true,
  imports: [CommonModule, FormatMedallionComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly catalogService = inject(CatalogService);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly root = viewChild<ElementRef<HTMLElement>>('stage');
  private readonly formatViewport = viewChild<ElementRef<HTMLElement>>('formatViewport');
  private readonly formatCaption = viewChild<ElementRef<HTMLElement>>('formatCaption');
  private formatTouchStart: { x: number; y: number } | null = null;
  private formatDrag: {
    pointerId: number;
    startX: number;
    startScrollLeft: number;
    lastX: number;
    lastTime: number;
    velocity: number;
    dragging: boolean;
  } | null = null;
  private dragFrame: number | null = null;
  private dragTarget = 0;
  private dragMomentum?: gsap.core.Tween;
  private captionTransition?: gsap.core.Timeline;
  private captionTargetId: string | null = null;
  private lastDragEnd = -Infinity;
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
  private layeredFragranceId: string | null = null;
  private readonly loadedSceneAssets = new Map<string, Promise<void>>();
  readonly layeredReady = signal(false);
  readonly displayedProductSrc = signal<string | null>(null);
  readonly layeredScene = computed(() => this.layeredReady() ? this.active()?.sceneLayers ?? null : null);

  /**
   * Keep the existing, proven composition visible until both the backdrop and
   * the transparent soap have decoded. Do not flash empty images on slow mobile
   * connections or show a previous fragrance's product while a new one loads.
   */
  private readonly sceneAssetEffect = effect((onCleanup) => {
    const fragrance = this.active();
    const formatId = this.selectedFormatId();
    const assets = fragrance?.sceneLayers;
    const src = assets?.products[formatId];
    if (!fragrance || !assets || !src) {
      this.layeredFragranceId = null;
      this.layeredReady.set(false);
      this.displayedProductSrc.set(null);
      return;
    }

    const isNewFragrance = this.layeredFragranceId !== fragrance.id;
    this.layeredFragranceId = fragrance.id;
    if (isNewFragrance) {
      this.layeredReady.set(false);
      this.displayedProductSrc.set(null);
    }

    let cancelled = false;
    const portrait = window.matchMedia('(max-width: 720px), (orientation: portrait) and (max-width: 1200px)').matches;
    const background = portrait ? assets.mobileBackground : assets.desktopBackground;
    Promise.all([this.ensureSceneImage(background), this.ensureSceneImage(src)])
      .then(() => {
        if (cancelled) return;
        const wasVisible = this.layeredReady();
        this.displayedProductSrc.set(src);
        this.layeredReady.set(true);
        if (wasVisible && !this.prefersReduced.matches) {
          requestAnimationFrame(() => {
            gsap.fromTo('.scene-layered-soap', { autoAlpha: .25, scale: .965 },
              { autoAlpha: 1, scale: 1, duration: .48, ease: 'power2.out', overwrite: true, clearProps: 'transform,opacity,visibility' });
          });
        }
      })
      .catch(() => {
        if (cancelled) return;
        this.layeredReady.set(false);
        this.displayedProductSrc.set(null);
      });

    onCleanup(() => { cancelled = true; });
  });

  private ensureSceneImage(url: string): Promise<void> {
    const cached = this.loadedSceneAssets.get(url);
    if (cached) return cached;
    const pending = new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Scene image could not load: ' + url));
      image.src = url;
      if (image.complete && image.naturalWidth > 0) resolve();
    }).catch((error) => {
      this.loadedSceneAssets.delete(url);
      throw error;
    });
    this.loadedSceneAssets.set(url, pending);
    return pending;
  }


  readonly catalog = signal<Catalog | null>(null);
  readonly activeIndex = signal(0);
  readonly currentSection = signal<VisualSection>('fragrances');
  readonly isMenuOpen = signal(false);
  readonly isInfoOpen = signal(false);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly selectedFormatId = signal('barra-arredondada');
  readonly previewFormatId = signal<string | null>(null);
  readonly captionFormat = signal<ProductFormat | null>(null);
  readonly transitioning = signal(false);
  readonly formatHasOverflow = signal(false);
  readonly formatCanScrollLeft = signal(false);
  readonly formatCanScrollRight = signal(false);

  readonly fragrances = computed(() => this.catalog()?.fragrances ?? []);
  readonly formats = computed(() => this.catalog()?.formats ?? []);
  readonly active = computed(() => this.fragrances()[this.activeIndex()] ?? null);
  readonly selectedFormat = computed(() => this.formats().find((f) => f.id === this.selectedFormatId()) ?? null);
  readonly previewedFormat = computed(() => this.formats().find((f) => f.id === this.previewFormatId()) ?? null);
  readonly focusedFormat = computed(() => this.previewedFormat() ?? this.selectedFormat());
  private readonly captionEffect = effect(() => {
    const next = this.focusedFormat();
    const caption = this.formatCaption()?.nativeElement;
    if (next && caption && next.id !== this.captionTargetId) this.animateFormatCaption(next, caption);
  });
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
    const viewport = this.formatViewport()?.nativeElement;
    if (!viewport) return;

    // Drag listeners run outside Angular's change detection: one visual update
    // per animation frame, even when the mouse sends hundreds of events.
    const pointerDown = (event: PointerEvent) => this.onFormatPointerDown(event, viewport);
    const pointerMove = (event: PointerEvent) => this.onFormatPointerMove(event, viewport);
    const pointerUp = (event: PointerEvent) => this.onFormatPointerEnd(event, viewport);
    const pointerCancel = (event: PointerEvent) => this.onFormatPointerEnd(event, viewport, true);
    const pointerLeave = (event: PointerEvent) => this.onFormatPointerLeave(event);
    this.zone.runOutsideAngular(() => {
      viewport.addEventListener('pointerdown', pointerDown);
      viewport.addEventListener('pointermove', pointerMove);
      viewport.addEventListener('pointerup', pointerUp);
      viewport.addEventListener('pointercancel', pointerCancel);
      viewport.addEventListener('pointerleave', pointerLeave);
    });

    const observer = new ResizeObserver(() => this.zone.run(() => this.refreshFormatArrows(viewport)));
    observer.observe(viewport);
    for (const child of Array.from(viewport.children)) observer.observe(child);
    queueMicrotask(() => this.zone.run(() => this.refreshFormatArrows(viewport)));
    onCleanup(() => {
      observer.disconnect();
      viewport.removeEventListener('pointerdown', pointerDown);
      viewport.removeEventListener('pointermove', pointerMove);
      viewport.removeEventListener('pointerup', pointerUp);
      viewport.removeEventListener('pointercancel', pointerCancel);
      viewport.removeEventListener('pointerleave', pointerLeave);
      viewport.classList.remove('is-dragging');
      this.cancelFormatFrame();
      this.dragMomentum?.kill();
      this.formatDrag = null;
    });
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
        // The default format may be in the middle of a narrow touch carousel.
        // Show its medallion immediately rather than leaving the selection off-screen.
        requestAnimationFrame(() => this.revealSelectedFormat(true));
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
    this.cancelFormatFrame();
    this.dragMomentum?.kill();
    this.captionTransition?.kill();
    this.loadedSceneAssets.clear();
    this.formatDrag = null;
    gsap.killTweensOf('.scene-backdrop, .scene-product, .scene-title, .scene-copy, .scene-button, .ambient-layer');
  }

  private animateInitial(): void {
    if (!this.active()) return;
    gsap.fromTo('.brand-logo', { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power2.out' });
    // Keep cards within their viewport while introducing them with a brief, subtle settling motion.
    // Clear GSAP inline transforms afterwards so CSS hover/selection styles remain authoritative.
    gsap.fromTo('.format-option',
      { y: 5, opacity: 0 },
      { y: 0, opacity: 1, duration: .38, delay: .12, stagger: .035, ease: 'power2.out', clearProps: 'transform,opacity' });
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

  /**
   * Animate a single, centered editorial caption. The Angular signal owns its
   * content; GSAP only animates presentation and never calculates layout.
   * A new hover cancels the previous timeline, so no stale caption can win.
   */
  private animateFormatCaption(format: ProductFormat, caption: HTMLElement): void {
    this.captionTargetId = format.id;
    this.captionTransition?.kill();
    this.captionTransition = undefined;

    const pieces = caption.querySelectorAll<HTMLElement>(
      '.format-editorial-name, .format-editorial-detail'
    );

    if (!this.captionFormat() || this.prefersReduced.matches) {
      this.captionFormat.set(format);
      gsap.set(pieces, { clearProps: 'opacity,transform,visibility' });
      return;
    }

    this.captionTransition = gsap.timeline({
      onComplete: () => { this.captionTransition = undefined; }
    })
      .to(pieces, {
        opacity: 0, y: -5, duration: .13, stagger: .018, ease: 'power1.in'
      })
      .call(() => {
        this.zone.run(() => {
          this.captionFormat.set(format);
          this.cdr.detectChanges();
        });
      })
      .set(pieces, { opacity: 0, y: 8 })
      .set(caption.querySelectorAll<HTMLElement>('.format-editorial-rule'), { scaleX: 0 })
      .to(pieces, {
        opacity: 1, y: 0, duration: .37, stagger: .055, ease: 'power2.out'
      })
      .to(caption.querySelectorAll<HTMLElement>('.format-editorial-rule'), {
        scaleX: 1, duration: .38, ease: 'power2.out'
      }, '<.13');
  }

  /** Preview only for hover-capable pointers and keyboard focus. */
  previewFormat(format: ProductFormat, event: Event): void {
    if (this.formatDrag?.dragging || this.transitioning()) return;
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) return;
    if (event.type === 'mouseenter' && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (event.type === 'focus' && !target.matches(':focus-visible')) return;
    this.previewFormatId.set(format.id);
  }

  clearFormatPreview(format: ProductFormat): void {
    if (this.previewFormatId() === format.id) this.previewFormatId.set(null);
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
    const viewport = this.formatViewport()?.nativeElement;
    if (!viewport) return;
    this.dragMomentum?.kill();
    const first = viewport.querySelector<HTMLElement>('.format-option');
    const gap = Number.parseFloat(getComputedStyle(viewport).columnGap) || 0;
    const itemSize = (first?.offsetWidth ?? 170) + gap;
    const count = Math.max(1, Math.floor(viewport.clientWidth / itemSize) - 1);
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const target = Math.max(0, Math.min(max, viewport.scrollLeft + direction * itemSize * count));
    viewport.scrollTo({ left: target, behavior: this.prefersReduced.matches ? 'instant' : 'smooth' });
  }

  refreshFormatArrows(viewport = this.formatViewport()?.nativeElement): void {
    if (!viewport) return;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const position = Math.min(max, Math.max(0, viewport.scrollLeft));
    // Browser scroll offsets can be fractional; tolerate a few pixels near edges.
    const edge = Math.min(12, Math.max(4, viewport.clientWidth * 0.015));
    this.formatHasOverflow.set(max > edge);
    this.formatCanScrollLeft.set(max > edge && position > edge);
    this.formatCanScrollRight.set(max > edge && max - position > edge);
  }

  private cancelFormatFrame(): void {
    if (this.dragFrame !== null) {
      cancelAnimationFrame(this.dragFrame);
      this.dragFrame = null;
    }
  }

  private onFormatPointerDown(event: PointerEvent, viewport: HTMLElement): void {
    if (event.pointerType !== 'mouse' || event.button !== 0 || this.transitioning() ||
      this.isMenuOpen() || this.isInfoOpen() || this.currentSection() !== 'fragrances') return;
    if (viewport.scrollWidth - viewport.clientWidth <= 4) return;
    this.dragMomentum?.kill();
    this.cancelFormatFrame();
    this.formatDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: viewport.scrollLeft,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
      dragging: false
    };
    this.dragTarget = viewport.scrollLeft;
  }

  private onFormatPointerMove(event: PointerEvent, viewport: HTMLElement): void {
    const drag = this.formatDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const displacement = event.clientX - drag.startX;
    if (!drag.dragging) {
      if (Math.abs(displacement) <= 6) return; // keep normal button clicks intact
      drag.dragging = true;
      this.zone.run(() => this.previewFormatId.set(null));
      viewport.classList.add('is-dragging'); // synchronous; prevents CSS snap conflicts
      viewport.setPointerCapture(event.pointerId);
    }
    event.preventDefault();
    const dt = Math.max(1, event.timeStamp - drag.lastTime);
    const instantVelocity = (event.clientX - drag.lastX) / dt;
    drag.velocity = .55 * drag.velocity + .45 * instantVelocity;
    drag.lastX = event.clientX;
    drag.lastTime = event.timeStamp;
    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    this.dragTarget = Math.max(0, Math.min(max, drag.startScrollLeft - displacement));

    if (this.dragFrame === null) {
      this.dragFrame = requestAnimationFrame(() => {
        this.dragFrame = null;
        viewport.scrollLeft = this.dragTarget;
      });
    }
  }

  private onFormatPointerEnd(event: PointerEvent, viewport: HTMLElement, cancelled = false): void {
    const drag = this.formatDrag;
    if (!drag || event.pointerId !== drag.pointerId) return;
    this.formatDrag = null;
    this.cancelFormatFrame();
    if (!drag.dragging) return;
    viewport.scrollLeft = this.dragTarget;
    viewport.classList.remove('is-dragging');
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    this.lastDragEnd = performance.now();

    const max = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    // Keep the gallery exactly at its boundaries, avoiding a phantom previous arrow.
    if (viewport.scrollLeft < 12) viewport.scrollLeft = 0;
    if (max - viewport.scrollLeft < 12) viewport.scrollLeft = max;

    const recent = event.timeStamp - drag.lastTime < 90;
    if (!cancelled && recent && !this.prefersReduced.matches && Math.abs(drag.velocity) > .08) {
      const target = Math.max(0, Math.min(max, viewport.scrollLeft - drag.velocity * 135));
      this.dragMomentum = gsap.to(viewport, {
        scrollLeft: target,
        duration: .36,
        ease: 'power2.out',
        overwrite: true,
        onComplete: () => {
          if (viewport.scrollLeft < 12) viewport.scrollLeft = 0;
          if (max - viewport.scrollLeft < 12) viewport.scrollLeft = max;
          this.zone.run(() => this.refreshFormatArrows(viewport));
        }
      });
    } else {
      this.zone.run(() => this.refreshFormatArrows(viewport));
    }
  }

  private onFormatPointerLeave(event: PointerEvent): void {
    if (this.formatDrag?.pointerId === event.pointerId && !this.formatDrag.dragging) {
      this.formatDrag = null;
    }
  }

  onFormatClick(event: MouseEvent, format: ProductFormat): void {
    // A release after dragging may synthesize a click on an image card.
    if (event.detail > 0 && performance.now() - this.lastDragEnd < 160) {
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

  private revealSelectedFormat(instant = false): void {
    const viewport = this.formatViewport()?.nativeElement;
    if (!viewport) return;
    const selected = Array.from(viewport.querySelectorAll<HTMLElement>('.format-option'))
      .find(element => element.dataset['formatId'] === this.selectedFormatId());
    if (!selected) return;
    const view = viewport.getBoundingClientRect();
    const card = selected.getBoundingClientRect();
    const offset = card.left < view.left + 4 ? card.left - view.left - 6
      : card.right > view.right - 4 ? card.right - view.right + 6 : 0;
    if (offset) viewport.scrollBy({ left: offset, behavior: instant || this.prefersReduced.matches ? 'instant' : 'smooth' });
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
    if (this.layeredReady()) {
      gsap.to(area.querySelector('.scene-layered-stage'), { x: x*-17, y: y*-12, duration: 1.45, overwrite: true, ease: 'power2.out' });
      gsap.to(area.querySelector('.scene-layered-foliage'), { x: x*11, y: y*9, duration: 2.1, overwrite: true, ease: 'power2.out' });
    }
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
