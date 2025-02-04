import { ChangeDetectorRef, Component, Input } from '@angular/core';

@Component({
  selector: 'app-identicon',
  templateUrl: './identicon.component.html',
  styleUrls: ['./identicon.component.scss']
})
export class IdenticonComponent {
  @Input() data: string | null = null;
  @Input() hash: string | null = null;

  sliceColor: string[] = [
    '#FFFFFF7F',
    '#FFFFFF5F',
    '#FFFFFF7F',
    '#FFFFFF5F'
  ];

  constructor(private cd: ChangeDetectorRef) {}

  async ngOnInit(): Promise<void> {
    if (this.data && !this.hash) {
      this.hash = await this.sha256(this.data);
    }
    this.sliceColor = Array.from({ length: 4 }, (_, i) =>
      '#' + this.hash!.slice(i * 6, (i + 1) * 6)
    );
    this.cd.markForCheck();
  }

  private async sha256(message: string): Promise<string> {
    // Encode the message as UTF-8
    const msgBuffer = new TextEncoder().encode(message);
    // Hash the message
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    // Convert ArrayBuffer to Array
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Convert bytes to hex string
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }
}
