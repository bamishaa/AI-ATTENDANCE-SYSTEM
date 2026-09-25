// Global scripts for FaceTrack AI Attendance System
document.addEventListener('DOMContentLoaded', () => {
    // Set formatted current date in top header
    const dateDisplay = document.getElementById('current-date-display');
    if (dateDisplay) {
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        dateDisplay.innerText = new Date().toLocaleDateString('en-US', options);
    }
});
