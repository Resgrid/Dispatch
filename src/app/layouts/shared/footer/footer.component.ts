import { Component, OnInit } from '@angular/core';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.component.html',
  styleUrls: ['./footer.component.scss']
})
export class FooterComponent implements OnInit {

  public version: string;

  constructor() { 

  }

  ngOnInit(): void {
    this.version = environment.version;
  }

  public currentYear() {
    return new Date().getFullYear();
  }
}
