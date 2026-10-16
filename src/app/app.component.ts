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

  readonly fragrances = computed(() => this.catalog()?.fragrances ?? []);
  readonly formats = computed(() => this.catalog()?.formats ?? []);
  readonly active = computed(() => this.fragrances()[this.activeIndex()] ?? null);
  readonly selectedFormat = computed(() => this.formats().find((f) => f.id === this.selectedFormatId()) ?? null);
  readonly selectedPrice = computed(() => {
    const fragrance = this.active();
    const format = this.selectedFormat();
    return fragrance && format ? this.number.format(format.prices[fragrance.collection]) : '';
  });
  readonly currentNumber = computed(() => String(this.activeIndex() + 1).padStart(2, '0'));
  readonly totalNumber = computed(() => String(this.fragrances().length).padStart(2, '0'));

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
    gsap.killTweensOf('.scene-backdrop, .scene-product, .scene-title, .scene-copy, .scene-button, .ambient-layer');
  }

  private animateInitial(): void {
    if (!this.active()) return;
    gsap.fromTo('.brand-logo', { y: -12, opacity: 0 }, { y: 0, opacity: 1, duration: .9, ease: 'power2.out' });
    gsap.fromTo('.thumbnail', { y: 17, opacity: 0 }, { y: 0, opacity: 1, duration: .75, delay: .33, stagger: .1, ease: 'power2.out' });
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
    this.selectedFormatId.set('barra-arredondada');
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

  setFormat(format: ProductFormat): void { this.selectedFormatId.set(format.id); }

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
    if (['ArrowDown','ArrowRight','PageDown'].includes(event.key)) { event.preventDefault(); this.step(1); }
    if (['ArrowUp','ArrowLeft','PageUp'].includes(event.key)) { event.preventDefault(); this.step(-1); }
  }

  private onTouchStart(event: TouchEvent): void {
    if (this.isMenuOpen() || this.isInfoOpen() || this.currentSection() !== 'fragrances') return;
    const touch = event.touches.item(0);
    const t = event.target;
    if (!touch || !(t instanceof Element) || t.closest('button, a, [role="dialog"]')) return;
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
