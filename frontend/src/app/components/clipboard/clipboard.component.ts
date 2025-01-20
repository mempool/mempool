import { Component, Input, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-clipboard',
  templateUrl: './clipboard.component.html',
  styleUrls: ['./clipboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ClipboardComponent {
  @Input() button = false;
  @Input() class = 'btn btn-secondary ml-1';
  @Input() size: 'small' | 'normal' | 'large' = 'normal';
  @Input() text: string;
  @Input() leftPadding = true;
  copiedMessage: string = $localize`:@@clipboard.copied-message:Copied!`;
  showMessage = false;

  widths = {
    small: '10',
    normal: '13',
    large: '18',
  };

  constructor(
    private cd: ChangeDetectorRef,
  ) { }

  async copyText() {
    if (this.text && !this.showMessage) {
      try {
        await this.copyToClipboard(this.text);
        this.showMessage = true;
        this.cd.markForCheck();
        setTimeout(() => {
          this.showMessage = false;
          this.cd.markForCheck();
        }, 1000);
      } catch (error) {
        console.error('Clipboard copy failed:', error);
      }
    }
  }

  async copyToClipboard(text: string) {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      // Use the 'out of viewport hidden text area' trick on non-secure contexts
      const textarea = document.createElement('textarea');
      textarea.value = this.text;
      textarea.style.opacity = '0';
      textarea.setAttribute('readonly', 'true'); // Don't trigger keyboard on mobile
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }
  }

}
