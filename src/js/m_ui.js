/*
export function updateCurrentYear() {
  const yearSpan = document.getElementById('current-year');
  if (yearSpan) {
    const currentYear = new Date().getFullYear();
    yearSpan.textContent = currentYear;
  }
}
*/

export function updateClock() {
  const clockElement = document.getElementById('live-clock');
  if (!clockElement) {
    return;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');

  const timezoneOffsetMinutes = now.getTimezoneOffset();
  const timezoneOffsetHours = -timezoneOffsetMinutes / 60;
  const timezoneOffsetMinutesRemainder = Math.abs(timezoneOffsetMinutes) % 60;
  const timezoneSign = timezoneOffsetHours >= 0 ? '+' : '';
  const timezoneString = `${timezoneSign}${String(timezoneOffsetHours).padStart(2, '0')}:${String(timezoneOffsetMinutesRemainder).padStart(2, '0')}`;

  clockElement.textContent = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}