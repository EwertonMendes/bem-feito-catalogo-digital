import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One vector illustration for each real soap mould; colours follow the active fragrance. */
@Component({
  selector: 'bf-format-icon',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './format-icon.component.html',
  styleUrl: './format-icon.component.css',
  host: { 'aria-hidden': 'true' },
})
export class FormatIconComponent {
  readonly formatId = input.required<string>();
  readonly petals = [0, 45, 90, 135, 180, 225, 270, 315];
  readonly floralPetals = [0, 36, 72, 108, 144, 180, 216, 252, 288, 324];
}
