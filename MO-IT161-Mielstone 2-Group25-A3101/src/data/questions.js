// Single source of truth for the assessment: used by the form view, scoring and the API.
// safeAnswer = the answer that counts as "secure". fix = checklist item shown when it isn't.
const QUESTIONS = [
  { id: 'q1', text: 'Do you use a strong password for your Wi-Fi network?', safeAnswer: 'yes', fix: 'Use a stronger, unique Wi-Fi password.' },
  { id: 'q2', text: 'Is your Wi-Fi password shared with many people?', safeAnswer: 'no', fix: 'Limit who knows your Wi-Fi password.' },
  { id: 'q3', text: "Is your router's admin password still the default one?", safeAnswer: 'no', fix: "Change your router's default admin password." },
  { id: 'q4', text: "Do you keep your router's firmware updated?", safeAnswer: 'yes', fix: "Update your router's firmware regularly." },
  { id: 'q5', text: 'Do you use WPA2 or WPA3 encryption?', safeAnswer: 'yes', fix: 'Enable WPA2 or WPA3 encryption.' },
  { id: 'q6', text: 'Is your Wi-Fi network hidden from public view?', safeAnswer: 'yes', fix: 'Consider hiding your Wi-Fi network name (SSID).' },
  { id: 'q7', text: 'Do you have a guest network for visitors?', safeAnswer: 'yes', fix: 'Set up a separate guest network for visitors.' },
  { id: 'q8', text: 'Do you regularly check who is connected to your network?', safeAnswer: 'yes', fix: 'Regularly check who is connected to your network.' },
  { id: 'q9', text: 'Is your router placed in a secure location?', safeAnswer: 'yes', fix: 'Place your router in a secure location.' },
  { id: 'q10', text: 'Do you use a firewall on your network?', safeAnswer: 'yes', fix: 'Enable a firewall on your network.' },
];

module.exports = { QUESTIONS };
