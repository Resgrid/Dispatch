import { Injectable, Pipe, PipeTransform } from "@angular/core";

@Pipe({
  name: "conversationFilter",
})
@Injectable()
export class ConversationPipe implements PipeTransform {
  // ConversationPipe
  // Filter conversation based on friend's name or username.
  transform(conversations: any[], search: string): any {
    if (!conversations) {
      return;
    } else if (!search) {
      return conversations;
    } else {
      let term = search.toLowerCase();
      return conversations.filter(
        (conversation) =>
          conversation.friend.name.toLowerCase().indexOf(term) > -1 || conversation.friend.username.toLowerCase().indexOf(term) > -1,
      );
    }
  }
}
