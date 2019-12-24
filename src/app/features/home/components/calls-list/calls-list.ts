import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-calls-list',
  templateUrl: './calls-list.html',
  styleUrls: ['./calls-list.scss'],
})
export class CallsListComponent implements OnInit {
  data: any;

  constructor() {}

  ionViewWillEnter() {
    setTimeout(() => {
      this.data = {
        'heading': 'Normal text',
        'para1': 'Lorem ipsum dolor sit amet, consectetur',
        'para2': 'adipiscing elit.'
      };
    }, 5000);
  }

  ngOnInit() {

  }

}
