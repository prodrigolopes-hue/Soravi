export class NotificationsUnreadCountResponseDto {
  count!: number;

  constructor(count: number) {
    this.count = count;
  }
}
