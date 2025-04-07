// server.js - Backend for Discussion Tracker

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Data paths
const DATA_DIR = path.join(__dirname, 'data');
const ACTIVE_FILE = path.join(DATA_DIR, 'active-topics.json');
const ARCHIVE_FILE = path.join(DATA_DIR, 'archived-topics.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize data files if they don't exist
if (!fs.existsSync(ACTIVE_FILE)) {
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify([]));
}

if (!fs.existsSync(ARCHIVE_FILE)) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify([]));
}

// Helper functions
function readTopics() {
  const data = fs.readFileSync(ACTIVE_FILE);
  return JSON.parse(data);
}

function saveTopics(topics) {
  fs.writeFileSync(ACTIVE_FILE, JSON.stringify(topics, null, 2));
}

function readArchive() {
  const data = fs.readFileSync(ARCHIVE_FILE);
  return JSON.parse(data);
}

function saveArchive(topics) {
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(topics, null, 2));
}

// API Routes
// Get all active topics
app.get('/api/topics', (req, res) => {
  try {
    const topics = readTopics();
    res.json(topics);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve topics' });
  }
});

// Add a new topic
app.post('/api/topics', (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Topic text is required' });
    }
    
    const topics = readTopics();
    const newTopic = {
      id: Date.now().toString(),
      text: text.trim(),
      dateAdded: new Date().toISOString()
    };
    
    topics.push(newTopic);
    saveTopics(topics);
    
    res.status(201).json(newTopic);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add topic' });
  }
});

// Complete a topic (move to archive)
app.post('/api/topics/:id/complete', (req, res) => {
  try {
    const { id } = req.params;
    const topics = readTopics();
    const archive = readArchive();
    
    const topicIndex = topics.findIndex(topic => topic.id === id);
    
    if (topicIndex === -1) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    
    const completedTopic = topics[topicIndex];
    completedTopic.dateCompleted = new Date().toISOString();
    
    archive.push(completedTopic);
    topics.splice(topicIndex, 1);
    
    saveTopics(topics);
    saveArchive(archive);
    
    res.json(completedTopic);
  } catch (error) {
    res.status(500).json({ error: 'Failed to complete topic' });
  }
});

// Get all archived topics
app.get('/api/archive', (req, res) => {
  try {
    const archive = readArchive();
    res.json(archive);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve archived topics' });
  }
});

// Export archive (return the entire archive for download)
app.get('/api/archive/export', (req, res) => {
  try {
    const archive = readArchive();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=discussion-archive-${new Date().toISOString().split('T')[0]}.json`);
    res.json(archive);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export archive' });
  }
});

// Serve the main HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});