// Create main sidebar container
const sidebar = document.createElement('div');
sidebar.id = 'Versatile';

// Build HTML structure
sidebar.innerHTML = `
  <h2>Versatile</h2>
  
  <div class="cp-section">
    <div class="section-title">To-Do</div>
    <div class="cp-task-card">
      <p class="cp-title">CS 3214: Final Project</p>
      <p class="cp-task-date">Due: Tomorrow at 11:59 PM</p>
    </div>
    <div class="cp-task-card">
      <p class="cp-title">CS 3304: Study Guide Review</p>
      <p class="cp-task-date">Due: Friday at 5:00 PM</p>
    </div>
    <div class="cp-task-card">
      <p class="cp-title">CS 3114: Practice Exam</p>
      <p class="cp-task-date">Due: Monday at 9:00 AM</p>
    </div>
  </div>

  <div class="cp-section">
    <div class="section-title">Topics</div>
    <div class="cp-topic-card">
      <p class="cp-title">CS 3214: Computer Systems</p>
    </div>
    <div class="cp-topic-card">
      <p class="cp-title">CS 3304: Comparative Languages</p>
    </div>
    <div class="cp-topic-card">
      <p class="cp-title">CS 3114: Data Strucutures and Algorithms</p>
    </div>
  </div>

  <div class="cp-section">
    <div class="section-title">Notifications</div>
    <div class="cp-topic-card">
      <p class="cp-title">Office hours moved to Zoom today.</p>
    </div>
    <div class="cp-topic-card">
      <p class="cp-title">Exam grades have been posted.</p>
    </div>
  </div>
`;

// Inject sidebar
document.body.appendChild(sidebar);

// Adjust main Canvas body
document.body.style.paddingRight = '350px';