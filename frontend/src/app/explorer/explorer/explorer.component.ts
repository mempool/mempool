import { Component, OnInit } from '@angular/core';
import { ApiService } from 'src/app/services/api.service';

@Component({
  selector: 'app-explorer',
  templateUrl: './explorer.component.html',
  styleUrls: ['./explorer.component.scss']
})
export class ExplorerComponent implements OnInit {
  blocks: any[] = [];
  isLoading = true;

  constructor(
    private apiService: ApiService,
  ) { }

  ngOnInit() {
    this.apiService.listBlocks$()
      .subscribe((blocks) => {
        this.blocks = blocks;
        this.isLoading = false;
      });
  }

  loadMore() {
    this.isLoading = true;
    this.apiService.listBlocks$(this.blocks[this.blocks.length - 1].height - 1)
      .subscribe((blocks) => {
        this.blocks = this.blocks.concat(blocks);
        this.isLoading = false;
      });
  }
}
