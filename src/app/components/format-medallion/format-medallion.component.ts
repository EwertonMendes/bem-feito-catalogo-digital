import {
  AfterViewInit, ChangeDetectionStrategy, Component, OnDestroy,
  ElementRef, effect, input, viewChild,
} from '@angular/core';
import gsap from 'gsap';
import { ProductFormat } from '../../models/catalog';
import { FormatIconComponent } from '../format-icon/format-icon.component';

/** Pure visual button content. The parent remains in charge of selection and carousel gestures. */
@Component({
  selector: 'bf-format-medallion',
  standalone: true,
  imports: [FormatIconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span #disc class="format-disc" [class.has-artwork]="!!artwork()" [class.is-selected]="selected()" [class.is-expanded]="expanded()" [attr.data-format]="format().id" aria-hidden="true">
      <span class="disc-sheen"></span>
      @if (artwork(); as image) {
        <img class="soap-photo" [src]="image" alt="" width="160" height="160" draggable="false" decoding="async" />
      } @else {
        <bf-format-icon [formatId]="format().id" />
      }
    </span>
  `,
  styleUrl: './format-medallion.component.css',
})
export class FormatMedallionComponent implements AfterViewInit, OnDestroy {
  readonly format = input.required<ProductFormat>();
  /** An optional image specific to the active fragrance, absent for future fragrances. */
  readonly artwork = input<string | null>(null);
  readonly selected = input(false);
  readonly expanded = input(false);
  private readonly disc = viewChild<ElementRef<HTMLElement>>('disc');
  private animation?: gsap.core.Timeline;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  constructor() {
    effect(() => {
      const show = this.expanded();
      if (this.animation) {
        if (show) this.animation.play();
        else this.animation.reverse();
      }
    });
  }

  ngAfterViewInit(): void {
    const disc = this.disc()?.nativeElement;
    if (!disc || this.reducedMotion.matches) return;
    this.animation = gsap.timeline({ paused: true }).to(disc, {
      scale: 1.075, y: -2, duration: .34, ease: 'power2.out', transformOrigin: 'center center',
    });
    if (this.expanded()) this.animation.progress(1);
  }

  ngOnDestroy(): void { this.animation?.kill(); }
}
