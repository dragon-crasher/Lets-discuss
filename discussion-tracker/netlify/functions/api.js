    // netlify/functions/api.js - Serverless function for our API

const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const bodyParser = require('body-parser');
const faunadb = require('faunadb');
const q = faunadb.query;

// Initialize express app
const app = express();
const router = express.Router();

// Initialize FaunaDB client (we'll use FaunaDB instead of local files)
const client = new faunadb.Client({
  secret: process.env.FAUNA_SECRET_KEY,
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// API Routes
// Get all active topics
router.get('/topics', async (req, res) => {
  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('active_topics'))),
        q.Lambda('topic', q.Get(q.Var('topic')))
      )
    );
    
    const topics = result.data.map(item => ({
      id: item.ref.id,
      ...item.data
    }));
    
    res.json(topics);
  } catch (error) {
    console.error('Error getting topics:', error);
    res.status(500).json({ error: 'Failed to retrieve topics' });
  }
});

// Add a new topic
router.post('/topics', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Topic text is required' });
    }
    
    const topicData = {
      text: text.trim(),
      dateAdded: new Date().toISOString(),
      status: 'active'
    };
    
    const result = await client.query(
      q.Create(q.Collection('topics'), { data: topicData })
    );
    
    res.status(201).json({
      id: result.ref.id,
      ...topicData
    });
  } catch (error) {
    console.error('Error adding topic:', error);
    res.status(500).json({ error: 'Failed to add topic' });
  }
});

// Complete a topic (mark as archived)
router.post('/topics/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Update the topic
    const result = await client.query(
      q.Let(
        {
          topicRef: q.Ref(q.Collection('topics'), id),
          topic: q.Get(q.Var('topicRef'))
        },
        q.Update(q.Var('topicRef'), {
          data: {
            status: 'archived',
            dateCompleted: new Date().toISOString()
          }
        })
      )
    );
    
    res.json({
      id: result.ref.id,
      ...result.data
    });
  } catch (error) {
    console.error('Error completing topic:', error);
    res.status(500).json({ error: 'Failed to complete topic' });
  }
});

// Get all archived topics
router.get('/archive', async (req, res) => {
  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('archived_topics'))),
        q.Lambda('topic', q.Get(q.Var('topic')))
      )
    );
    
    const archivedTopics = result.data.map(item => ({
      id: item.ref.id,
      ...item.data
    }));
    
    res.json(archivedTopics);
  } catch (error) {
    console.error('Error getting archived topics:', error);
    res.status(500).json({ error: 'Failed to retrieve archived topics' });
  }
});

// Export archive
router.get('/archive/export', async (req, res) => {
  try {
    const result = await client.query(
      q.Map(
        q.Paginate(q.Match(q.Index('archived_topics')), { size: 1000 }),
        q.Lambda('topic', q.Get(q.Var('topic')))
      )
    );
    
    const archivedTopics = result.data.map(item => ({
      id: item.ref.id,
      ...item.data
    }));
    
    res.json(archivedTopics);
  } catch (error) {
    console.error('Error exporting archive:', error);
    res.status(500).json({ error: 'Failed to export archive' });
  }
});

// Use router for all api routes
app.use('/.netlify/functions/api', router);

// Export the serverless function
module.exports.handler = serverless(app);