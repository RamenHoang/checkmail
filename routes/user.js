const express = require('express');
const Database = require('../database/database');

const router = express.Router();
const db = new Database();

// Initialize database connection
db.init().catch(console.error);

// Helper function to mask email addresses
function maskEmail(email) {
  const [username, domain] = email.split('@');
  if (username.length <= 2) {
    return `${username[0]}***@${domain}`;
  }
  const visibleChars = Math.max(1, Math.min(3, Math.floor(username.length * 0.3)));
  const masked = username.substring(0, visibleChars) + '*'.repeat(Math.max(3, username.length - visibleChars));
  return `${masked}@${domain}`;
}

// User homepage - show email list interface
router.get('/', async (req, res) => {
  try {
    res.render('index', { 
      title: 'Email Checker',
      message: null
    });
  } catch (error) {
    console.error('Error rendering homepage:', error);
    res.render('index', { 
      title: 'Email Checker',
      message: 'Đã xảy ra lỗi khi tải trang'
    });
  }
});

// API: Get email list (masked for security) with pagination
router.get('/api/emails', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const showOnlyAvailable = req.query.available === 'true';
    
    console.log('API /api/emails called with:', { page, limit, showOnlyAvailable });
    
    const emails = await db.getAllEmails();
    console.log('Total emails from database:', emails.length);
    
    // Filter emails based on availability if requested
    let filteredEmails = emails;
    if (showOnlyAvailable) {
      filteredEmails = emails.filter(e => e.status === 'available');
      console.log('Filtered emails (available only):', filteredEmails.length);
    }
    
    // Sort emails by created_at descending (newest first)
    filteredEmails.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    // Calculate pagination
    const totalEmails = filteredEmails.length;
    const totalPages = Math.ceil(totalEmails / limit);
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedEmails = filteredEmails.slice(startIndex, endIndex);
    
    console.log('Pagination info:', { 
      totalEmails, 
      totalPages, 
      startIndex, 
      endIndex, 
      paginatedEmailsCount: paginatedEmails.length 
    });
    
    // Mask email addresses for security
    const maskedEmails = paginatedEmails.map(email => ({
      id: email.id,
      email_masked: maskEmail(email.email),
      status: email.status,
      created_at: email.created_at,
      domain: email.email.split('@')[1] // Show domain for reference
    }));
    
    const responseData = { 
      success: true, 
      emails: maskedEmails,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalItems: totalEmails,
        limit: limit,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        startIndex: startIndex + 1,
        endIndex: Math.min(endIndex, totalEmails)
      },
      total: emails.length,
      available: emails.filter(e => e.status === 'available').length
    };
    
    console.log('API response pagination:', responseData.pagination);
    res.json(responseData);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.json({ success: false, message: 'Có lỗi xảy ra khi tải danh sách email: ' + error.message });
  }
});

// API: Get specific email for copying (requires authentication-like mechanism)
router.post('/api/get-email', async (req, res) => {
  try {
    const { id } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!id) {
      return res.json({ success: false, message: 'Email ID is required' });
    }

    const email = await db.getEmailById(id);
    
    if (!email) {
      return res.json({ success: false, message: 'Email không tồn tại' });
    }
    
    if (email.status !== 'available') {
      return res.json({ success: false, message: 'Email không khả dụng' });
    }

    // Return actual email for copying
    res.json({ 
      success: true, 
      email: email.email,
      id: email.id,
      message: 'Email sẵn sàng để copy'
    });
  } catch (error) {
    console.error('Error fetching specific email:', error);
    res.json({ success: false, message: 'Có lỗi xảy ra khi lấy email' });
  }
});

// Mark email as used (copy action)
router.post('/copy', async (req, res) => {
  try {
    const { id } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
    
    if (!id) {
      return res.json({ success: false, message: 'Email ID is required' });
    }

    const success = await db.markEmailAsUsed(id, clientIP);
    
    if (success) {
      res.json({ success: true, message: 'Email đã được đánh dấu là đã sử dụng' });
    } else {
      res.json({ success: false, message: 'Email không khả dụng hoặc đã được sử dụng' });
    }
  } catch (error) {
    console.error('Error marking email as used:', error);
    res.json({ success: false, message: 'Có lỗi xảy ra khi xử lý yêu cầu' });
  }
});

module.exports = router;
