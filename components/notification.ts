export function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then((permission) => {
            console.log("📢 وضعیت نوتیفیکیشن:", permission);
        });
    }
}
