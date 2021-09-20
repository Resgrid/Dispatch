import { NgModule } from '@angular/core';

import { OrderByPipe } from './orderBy.directive';
import { GroupByPipe } from './groupBy.directive';
import { TruncatePipe } from './truncate.directive';
import { RGTimeAgoPipe } from './rgTimeAgo.directive';
import { RGTimeAgoUTCPipe } from './rgTimeAgoUtc.directive';
import { ConversationPipe } from './conversation.directive';

@NgModule({
  declarations: [OrderByPipe, GroupByPipe, TruncatePipe, RGTimeAgoPipe, RGTimeAgoUTCPipe, ConversationPipe],
  imports: [],
  exports: [OrderByPipe, GroupByPipe, TruncatePipe, RGTimeAgoPipe, RGTimeAgoUTCPipe, ConversationPipe]
})
export class DirectivesModule { }
